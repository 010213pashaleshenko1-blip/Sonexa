export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text, voice } = req.body || {};

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Invalid text' });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30 секунд таймаут

    const hfToken = process.env.HF_TOKEN;
    if (!hfToken) {
      clearTimeout(timeout);
      return res.status(500).json({ error: 'HF token not configured' });
    }

    // Gradio 5.16.0 - используем /run/predict
    const hfRes = await fetch('https://cartik-sonexa-1-server.hf.space/run/predict', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: [text.trim(), voice || 'serena']
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!hfRes.ok) {
      const raw = await hfRes.text();
      console.error('HF Error:', hfRes.status, raw);
      return res.status(502).json({
        error: `HF API error: ${hfRes.status} ${hfRes.statusText}`,
        details: raw.slice(0, 500)
      });
    }

    const result = await hfRes.json();
    
    // Gradio возвращает результат в data[0]
    const audioUrl = result?.data?.[0];

    if (!audioUrl) {
      console.error('No audio URL in response:', result);
      return res.status(502).json({
        error: 'No audio generated',
        response: result
      });
    }

    // Если URL relative, добавляем базовый URL
    const fullUrl = audioUrl.startsWith('http') 
      ? audioUrl 
      : `https://cartik-sonexa-1-server.hf.space${audioUrl}`;

    return res.status(200).json({ audio_url: fullUrl });
  } catch (err) {
    console.error('API Error:', err);
    return res.status(500).json({
      error: err?.name === 'AbortError' 
        ? 'Request timeout (30s limit)' 
        : err.message || String(err)
    });
  }
}
