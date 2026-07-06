export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const BASE = "https://cartik-sonexa-1-server.hf.space";
  // Таймаут 60с — Gradio Space может "просыпаться" при первом запросе
  const FETCH_TIMEOUT_MS = 60000;

  function fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    return fetch(url, { ...options, signal: controller.signal })
      .finally(() => clearTimeout(timeout));
  }

  try {
    const { text, voice } = req.body || {};

    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({
        error: "Invalid text"
      });
    }

    const headers = {
      "Content-Type": "application/json"
    };

    // Создаем задачу
    const postRes = await fetchWithTimeout(`${BASE}/gradio_api/call/predict`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        data: [
          text.trim(),
          voice || "serena"
        ]
      })
    });

    if (!postRes.ok) {
      return res.status(postRes.status).json({
        error: await postRes.text()
      });
    }

    const { event_id } = await postRes.json();

    if (!event_id) {
      return res.status(500).json({
        error: "event_id not returned"
      });
    }

    // Ждем результат (увеличенный таймаут для cold start Space)
    const streamRes = await fetchWithTimeout(
      `${BASE}/gradio_api/call/predict/${event_id}`,
      { method: "GET" }
    );

    if (!streamRes.ok) {
      return res.status(streamRes.status).json({
        error: await streamRes.text()
      });
    }

    const sse = await streamRes.text();

    let payload = null;

    for (const block of sse.split("\n\n")) {
      const event = block.match(/^event:\s*(.+)$/m)?.[1];
      const data = block.match(/^data:\s*(.+)$/m)?.[1];

      if (!event || !data) continue;

      if (event === "complete") {
        payload = JSON.parse(data);
        break;
      }

      if (event === "error") {
        return res.status(500).json({
          error: data
        });
      }
    }

    if (!payload || !payload[0]) {
      return res.status(500).json({
        error: "No audio generated"
      });
    }

    const file = payload[0];

    const originalUrl =
      typeof file === "string"
        ? `${BASE}/gradio_api/file=${file}`
        : file.url ||
          `${BASE}/gradio_api/file=${file.path}`;

    // Важно: возвращаем URL на НАШ домен (/api/download), а не напрямую на Gradio.
    // Gradio Space (*.hf.space) часто блокируется или медленно грузится из России,
    // а Vercel-домен работает стабильно.
    // Фронтенд использует этот URL для <audio src> и для скачивания.
    const proxyUrl = `/api/download?url=${encodeURIComponent(originalUrl)}`;

    return res.status(200).json({
      audio_url: proxyUrl,
      // Оригинальный URL — на случай если прокси упадёт (фронтенд может сделать fallback)
      original_url: originalUrl,
    });

  } catch (e) {
    console.error(e);

    return res.status(500).json({
      error: e.message
    });
  }
}
