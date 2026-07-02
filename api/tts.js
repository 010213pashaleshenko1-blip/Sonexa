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

    const hfToken = process.env.HF_TOKEN;
    if (!hfToken) {
      return res.status(500).json({ error: 'HF token not configured' });
    }

    // Первый запрос - начинаем обработку на Gradio
    const initRes = await fetch('https://cartik-sonexa-1-server.hf.space/api/call/predict', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${hfToken}`
      },
      body: JSON.stringify({
        data: [text.trim(), voice || 'serena']
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!initRes.ok) {
      const raw = await initRes.text();
      return res.status(502).json({
        error: `HF API error: ${initRes.status} ${initRes.statusText}`,
        debug: raw.slice(0, 300)
      });
    }

    const initData = await initRes.json();
    const callHash = initData.hash;

    if (!callHash) {
      return res.status(502).json({
        error: 'Failed to get call hash from Gradio',
        debug: initData
      });
    }

    // Второй запрос - получаем результат
    let audioUrl = null;
    let attempts = 0;
    const maxAttempts = 30; // Максимум 30 попыток * 200ms = 6 секунд

    while (!audioUrl && attempts < maxAttempts) {
      attempts++;
      
      const statusRes = await fetch(`https://cartik-sonexa-1-server.hf.space/api/call/predict/status/${callHash}`, {
        headers: {
          'Authorization': `Bearer ${hfToken}`
        },
        signal: controller.signal
      });

      if (!statusRes.ok) {
        const raw = await statusRes.text();
        return res.status(502).json({
          error: `HF status check error: ${statusRes.status}`,
          debug: raw.slice(0, 300)
        });
      }

      const statusData = await statusRes.json();

      if (statusData.data) {
        audioUrl = statusData.data[0];
        break;
      }

      if (statusData.status === 'FAILED') {
        return res.status(502).json({
          error: 'Gradio processing failed',
          debug: statusData
        });
      }

      // Ждём 200мс перед следующей попыткой
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    if (!audioUrl) {
      return res.status(502).json({
        error: 'Timeout waiting for audio from HF',
        debug: `No result after ${attempts} attempts`
      });
    }

    return res.status(200).json({ audio_url: audioUrl });
  } catch (err) {
    return res.status(500).json({
      error: err?.name === 'AbortError' ? 'HF timeout (9s limit)' : String(err)
    });
  }
}
