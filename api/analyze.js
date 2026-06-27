module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { imageBase64, mimeType } = req.body;
  if (!imageBase64 || !mimeType) return res.status(400).json({ error: 'Missing image data' });

  const prompt = `你是"物语"（Thingstory）的AI助手，专门帮助家庭记录老物件背后的故事。

请分析图片中的物件，只返回如下JSON，不要其他内容：

{
  "name": "物件名称（简短，如'海鸥4A相机'）",
  "era": "年代（如'1970—1980年代'）",
  "background": "这类物件的历史与制造背景（2-3句）",
  "cultural": "这件物件在中国家庭文化中的意义（2-3句）",
  "questions": [
    "建议向长辈提问的第1个问题",
    "建议向长辈提问的第2个问题",
    "建议向长辈提问的第3个问题"
  ],
  "starter": "帮助用户开始与长辈对话的第一句话（温暖，口语化，30字以内）"
}`;

  try {
    const apiKey = process.env.GEMINI_API_KEY || '';
    const isOAuth = apiKey.startsWith('AQ') || apiKey.startsWith('ya29');
    const url = isOAuth
      ? 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'
      : `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(isOAuth ? { 'Authorization': `Bearer ${apiKey}` } : {})
        },
        body: JSON.stringify({
          contents: [{ parts: [
            { inline_data: { mime_type: mimeType, data: imageBase64 } },
            { text: prompt }
          ]}],
          generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({ error: JSON.stringify(data) });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'Parse failed', raw: text });

    res.json({ result: JSON.parse(jsonMatch[0]) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
