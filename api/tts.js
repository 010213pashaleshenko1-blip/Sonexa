export default async function handler(req, res) {
  // Vercel Serverless Function (no Express)

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text, voice } = req.body || {};

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Invalid text' });
    }

    const SPACE_URL = 'https://cartik-sonexa-1-server.hf.space/run/predict';

    const hfRes = await fetch(SPACE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        data: [text.trim(), voice || 'serena']
      })
    });

    const raw = await hfRes.text();

    let json;
    try {
      json = JSON.parse(raw);
    } catch (e) {
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

    return res.status(200).json({
      audio_url: audioUrl
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}