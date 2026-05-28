export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { skinType, concerns, currentProduct, reviewText } = req.body;

  if (!skinType && (!reviewText || reviewText.trim().length < 10)) {
    return res.status(400).json({ error: '肌タイプかレビューを入力してください' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const profileLines = [];
  if (skinType) profileLines.push(`肌タイプ：${skinType}`);
  if (concerns && concerns.length > 0) profileLines.push(`気になること：${concerns.join('、')}`);
  if (currentProduct) profileLines.push(`現在使用中の商品：${currentProduct}`);
  const profileText = profileLines.length > 0
    ? `【ユーザーの肌プロフィール】\n${profileLines.join('\n')}`
    : '';

  const reviewSection = reviewText && reviewText.trim().length > 0
    ? `【商品レビュー】\n${reviewText.slice(0, 3000)}`
    : '（商品レビューなし。肌プロフィールのみで判断してください）';

  const prompt = `あなたは敏感肌の30代男性向けスキンケア専門のAIアドバイザーです。
以下の情報をもとに、この商品がユーザーに合うかを判定してください。
必ずJSON形式のみで返答してください。余分な文章やマークダウンは一切含めないでください。

${profileText}

${reviewSection}

以下のJSON形式で返してください:
{
  "score": 0から100の数値,
  "status": "買い" または "注意" または "見送り",
  "reasons": ["理由1", "理由2", "理由3"],
  "goodFor": ["向いている人1", "向いている人2"],
  "badFor": ["向いていない人1", "向いていない人2"],
  "summary": "30文字以内の結論",
  "personalInsight": "ユーザーの肌プロフィールを踏まえた50文字以内のパーソナルコメント（肌タイプ情報がある場合のみ。ない場合は空文字）",
  "alternatives": [
    { "name": "代替商品名1", "reason": "この人に合う理由", "price": "価格帯" },
    { "name": "代替商品名2", "reason": "この人に合う理由", "price": "価格帯" }
  ]
}

判定基準：
- score 70以上 → status: "買い"
- score 40〜69 → status: "注意"
- score 39以下 → status: "見送り"
- ユーザーの肌タイプ・悩みを最優先に考慮すること
- 代替商品はユーザーの肌プロフィールに合った日本で購入可能な商品を提案すること
- 現在使用中の商品がある場合は、それとの相性や重複も考慮すること`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'あなたはスキンケア専門のAIアドバイザーです。必ずJSON形式のみで返答してください。' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Groq API error:', err);
      return res.status(500).json({ error: 'AI解析に失敗しました' });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('JSON parse failed. Raw:', text);
      return res.status(500).json({ error: 'AI応答の解析に失敗しました' });
    }

    const result = JSON.parse(jsonMatch[0]);
    return res.status(200).json(result);

  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
}
