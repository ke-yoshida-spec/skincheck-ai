export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { skinTypes, constitutions, concerns, products, skinCondition, newProduct } = req.body;

  if (!skinTypes || skinTypes.length === 0) {
    return res.status(400).json({ error: '肌タイプを選択してください' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const profileLines = [];
  profileLines.push(`肌タイプ：${skinTypes.join('、')}`);
  if (constitutions && constitutions.length > 0) profileLines.push(`体質・アレルギー：${constitutions.join('、')}`);
  if (concerns && concerns.length > 0) profileLines.push(`気になること：${concerns.join('、')}`);

  const productLines = [];
  if (products) {
    if (products.toner) productLines.push(`化粧水：${products.toner}`);
    if (products.lotion) productLines.push(`乳液：${products.lotion}`);
    if (products.booster) productLines.push(`導入化粧水：${products.booster}`);
    if (products.serum) productLines.push(`美容液：${products.serum}`);
    if (products.cleanse) productLines.push(`クレンジング：${products.cleanse}`);
    if (products.sunscreen) productLines.push(`日焼け止め：${products.sunscreen}`);
  }

  const randomSeed = Math.floor(Math.random() * 1000);

  const prompt = `あなたは皮膚科学の専門知識を持つスキンケアAIアドバイザーです。
敏感肌の30代男性向けに、以下の情報をもとにスキンケアの相性診断を行ってください。
必ずJSON形式のみで返答してください。余分な文章やマークダウンは一切含めないでください。

【ユーザーの肌プロフィール】
${profileLines.join('\n')}

${productLines.length > 0 ? `【現在使用中のアイテム】\n${productLines.join('\n')}` : '（現在使用中のアイテムなし）'}

${skinCondition ? `【今の肌の状態・使用感】\n${skinCondition}` : ''}

${newProduct ? `【新しく試したいアイテム】\n${newProduct}` : ''}

以下のJSON形式で返してください:
{
  "score": 0から100の数値（総合的なスキンケア相性スコア）,
  "status": "おすすめ" または "要注意" または "見直し推奨",
  "summary": "40文字以内の総合診断結論",
  "reasons": ["診断理由1", "診断理由2", "診断理由3"],
  "goodFor": ["あなたの肌に合っている点1", "合っている点2"],
  "badFor": ["注意が必要な点1", "注意が必要な点2"],
  "compatibility": [
    {
      "name": "アイテム名",
      "status": "good" または "caution" または "bad",
      "comment": "このアイテムとあなたの肌の相性に関する皮膚科学的な見解（30文字以内）"
    }
  ],
  "personalAdvice": "ユーザーの肌プロフィールと使用アイテムを踏まえた、具体的で実践的なアドバイス（100文字以内）",
  "alternatives": [
    { "name": "推奨アイテム名1", "reason": "この人の肌に合う皮膚科学的な理由", "price": "価格帯" },
    { "name": "推奨アイテム名2", "reason": "この人の肌に合う皮膚科学的な理由", "price": "価格帯" },
    { "name": "推奨アイテム名3", "reason": "この人の肌に合う皮膚科学的な理由", "price": "価格帯" },
    { "name": "推奨アイテム名4", "reason": "この人の肌に合う皮膚科学的な理由", "price": "価格帯" }
  ]
}

【代替商品の選定ルール（最重要）】
以下のルールを必ず守って4つの代替商品を選定してください。

1. 価格帯を必ず分散させること
   - 1つ目：500円〜1,000円のプチプラ商品
   - 2つ目：1,000円〜2,000円の手頃な商品
   - 3つ目：2,000円〜4,000円のミドル価格帯商品
   - 4つ目：4,000円以上のプレミアム商品

2. ブランドを毎回必ず変えること（4つすべて異なるブランド）
   - 選択可能ブランド例：無印良品・ちふれ・ニベア・肌ラボ・キュレル・セタフィル・ロゼット・コーセー・なめらか本舗・雪肌精・メンズビオレ・ハトムギ化粧水・ナールス・オルビス・ファンケル・アクアレーベル・BULK HOMME・ルシード・ビオレ・ミノン・Dプログラム・資生堂・花王・ポーラなど
   - 現在使用中のアイテムと同じブランドは避ける

3. カテゴリを肌の悩みに合わせて選ぶこと
   - 乾燥が気になる場合：ヒアルロン酸・セラミド配合を優先
   - 赤み・敏感肌の場合：無添加・低刺激処方を優先
   - ニキビが気になる場合：ノンコメドジェニック処方を優先
   - テカリが気になる場合：さっぱりテクスチャーを優先

4. 今回のシード値：${randomSeed}（このシード値に基づいて毎回異なる商品を選ぶこと）

5. 日本のドラッグストア・バラエティショップ・ECサイトで実際に購入可能な商品のみ

【その他の診断基準】
- score 70以上 → status: "おすすめ"
- score 40〜69 → status: "要注意"
- score 39以下 → status: "見直し推奨"
- 皮膚科学的な成分の相性・刺激リスク・保湿バランスを重視すること
- アトピーやアレルギー体質の場合は特に成分の安全性を厳しく評価すること
- 複数アイテムを使用している場合は成分の重複・競合も考慮すること
- compatibilityは入力されたアイテムのみ含める（入力がない場合は空配列）`;

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
          { role: 'system', content: 'あなたは皮膚科学の専門知識を持つスキンケアAIアドバイザーです。必ずJSON形式のみで返答してください。代替商品は必ず4つ、すべて異なるブランド・異なる価格帯から選んでください。' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.8,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Groq API error:', err);
      return res.status(500).json({ error: 'AI診断に失敗しました' });
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
