export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text, voice } = req.body || {};

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Invalid text' });
    }

    const BASE = 'https://cartik-sonexa-1-server.hf.space';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000); // генерация на CPU долгая, ставим побольше

    // Шаг 1: ставим задачу в очередь
    const postRes = await fetch(`${BASE}/gradio_api/call/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: [text.trim(), voice || 'serena']
      }),
      signal: controller.signal
    });

    if (!postRes.ok) {
      const raw = await postRes.text();
      clearTimeout(timeout);
      console.error('HF POST Error:', postRes.status, raw);
      return res.status(502).json({
        error: `HF API error: ${postRes.status} ${postRes.statusText}`,
        details: raw.slice(0, 500)
      });
    }

    const { event_id } = await postRes.json();
    if (!event_id) {
      clearTimeout(timeout);
      return res.status(502).json({ error: 'No event_id returned by HF' });
    }

    // Шаг 2: читаем SSE-поток с результатом
    const getRes = await fetch(`${BASE}/gradio_api/call/predict/${event_id}`, {
      method: 'GET',
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!getRes.ok) {
      const raw = await getRes.text();
      console.error('HF GET Error:', getRes.status, raw);
      return res.status(502).json({
        error: `HF stream error: ${getRes.status}`,
        details: raw.slice(0, 500)
      });
    }

    const rawStream = await getRes.text();

    // Парсим SSE вручную: ищем последнее событие "complete"
    let payload = null;
    const blocks = rawStream.split('\n\n').filter(Boolean);
    for (const block of blocks) {
      const lines = block.split('\n');
      const eventLine = lines.find(l => l.startsWith('event:'));
      const dataLine = lines.find(l => l.startsWith('data:'));
      if (!dataLine) continue;

      const dataStr = dataLine.replace(/^data:\s*/, '');

      if (eventLine?.includes('error')) {
        console.error('HF generation error:', dataStr);
        return res.status(502).json({ error: 'Generation failed on HF side', details: dataStr.slice(0, 500) });
      }

      if (eventLine?.includes('complete')) {
        try {
          payload = JSON.parse(dataStr);
        } catch (e) {
          console.error('Failed to parse complete payload:', dataStr);
        }
      }
    }

    if (!payload || !payload[0]) {
      console.error('No audio in response, raw stream:', rawStream.slice(0, 1000));
      return res.status(502).json({ error: 'No audio generated', raw: rawStream.slice(0, 500) });
    }

    // data[0] может быть строкой (путь) или объектом {path, url, ...}
    const audioEntry = payload[0];
    let audioPath = typeof audioEntry === 'string'
      ? audioEntry
      : (audioEntry.url || audioEntry.path);

    if (!audioPath) {
      return res.status(502).json({ error: 'Audio entry has no path/url', entry: audioEntry });
    }

    const fullUrl = audioPath.startsWith('http')
      ? audioPath
      : `${BASE}/gradio_api/file=${audioPath}`;

    return res.status(200).json({ audio_url: fullUrl });
  } catch (err) {
    console.error('API Error:', err);
    return res.status(500).json({
      error: err?.name === 'AbortError'
        ? 'Timeout (60s limit)'
        : err.message || String(err)
    });
  }
  }
