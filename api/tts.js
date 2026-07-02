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
    const timeout = setTimeout(() => controller.abort(), 9000);

    const hfRes = await fetch('https://cartik-sonexa-1-server.hf.space/run/predict', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        data: [text.trim(), voice || 'serena']
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    // Проверяем статус ответа ДО парсинга JSON
    if (!hfRes.ok) {
      const raw = await hfRes.text();
      return res.status(502).json({
        error: `HF API error: ${hfRes.status} ${hfRes.statusText}`,
        debug: raw.slice(0, 300)
      });
    }

    const raw = await hfRes.text();

    let json;
    try {
      json = JSON.parse(raw);
    } catch {
      return res.status(502).json({
        error: 'HF returned non-JSON response',
        debug: raw.slice(0, 300)
      });
    }

    const audioUrl = json?.data?.[0];

    if (!audioUrl) {
      return res.status(502).json({
        error: 'No audio returned from HF',
        debug: json
      });
    }

    return res.status(200).json({ audio_url: audioUrl });
  } catch (err) {
    return res.status(500).json({
      error: err?.name === 'AbortError' ? 'HF timeout (9s limit)' : String(err)
    });
  }
}
