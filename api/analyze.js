export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { reviewText } = req.body;

  if (!reviewText || reviewText.trim().length < 10) {
    return res.status(400).json({ error: 'レビューテキストが短すぎます' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const prompt = `
あなたは敏感肌の30代男性向けスキンケア商品のレビュー解析AIです。
以下のレビューテキストを分析して、必ずJSON形式のみで返答してください。
余分な文章やマークダウンは一切含めないでください。

レビューテキスト:
${reviewText.slice(0, 3000)}

以下のJSON形式で返してください:
{
  "score": 0から100の数値,
  "status": "買い" または "注意" または "見送り",
  "reasons": ["理由1", "理由2", "理由3"],
  "goodFor": ["向いている人1", "向いている人2"],
  "badFor": ["向いていない人1", "向いていない人2"],
  "summary": "30文字以内の結論",
  "alternatives": [
    { "name": "代替商品名1", "reason": "理由", "price": "価格帯" },
    { "name": "代替商品名2", "reason": "理由", "price": "価格帯" }
  ]
}

判定基準:
- score 70以上 → status: "買い"
- score 40〜69 → status: "注意"
- score 39以下 → status: "見送り"
- 敏感肌への刺激、保湿力、成分の安全性を重視して評価すること
- 代替商品は実在する日本で購入可能な商品を提案すること
`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1024,
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error('Gemini API error:', err);
      return res.status(500).json({ error: 'AI解析に失敗しました' });
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // JSON部分だけ抽出
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
