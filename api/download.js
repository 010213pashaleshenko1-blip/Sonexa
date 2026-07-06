/**
 * Sonexa — audio proxy
 *
 * GET /api/download?url=<audio_url>
 *
 * Проксирует аудиофайл с Gradio Space (кросс-доменный) через наш сервер.
 * Решает две проблемы:
 *   1. CORS — Gradio не отдаёт Access-Control-Allow-Origin
 *   2. Доступность в России — *.hf.space домены часто блокируются,
 *      а Vercel работает стабильно
 *
 * Поддержка:
 *   - Range requests (для <audio> стриминга и перемотки)
 *   - Content-Disposition: attachment (для скачивания)
 *   - Передача Content-Type и Content-Length
 *   - Защита от SSRF (только разрешённые домены)
 *
 * Параметр ?download=1 форсирует attachment (для кнопки "Скачать")
 */

const ALLOWED_HOSTS = [
  "cartik-sonexa-1-server.hf.space",
  "cartik-sonexa-aq-server.hf.space",
];

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { url, download } = req.query;
  if (!url) {
    return res.status(400).json({ error: "url parameter required" });
  }

  // Валидация URL — защита от SSRF
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    return res.status(400).json({ error: "Invalid URL" });
  }

  if (!ALLOWED_HOSTS.includes(parsedUrl.hostname)) {
    return res.status(403).json({
      error: `URL host not allowed. Allowed: ${ALLOWED_HOSTS.join(", ")}`,
    });
  }

  try {
    // Пробрасываем Range header для стриминга
    const upstreamHeaders = {
      ...(process.env.HF_TOKEN
        ? { Authorization: `Bearer ${process.env.HF_TOKEN.trim()}` }
        : {}),
    };
    if (req.headers.range) {
      upstreamHeaders["Range"] = req.headers.range;
    }

    const audioRes = await fetch(url, { headers: upstreamHeaders });

    if (!audioRes.ok && audioRes.status !== 206) {
      return res.status(audioRes.status).json({
        error: `Failed to fetch audio: HTTP ${audioRes.status}`,
      });
    }

    // Определяем Content-Type и расширение
    const contentType =
      audioRes.headers.get("content-type") || "audio/wav";
    let ext = "wav";
    if (contentType.includes("wav")) ext = "wav";
    else if (contentType.includes("mpeg") || contentType.includes("mp3")) ext = "mp3";
    else if (contentType.includes("ogg")) ext = "ogg";
    else if (contentType.includes("webm")) ext = "webm";
    else {
      const urlExt = parsedUrl.pathname.match(/\.(\w{3,4})$/)?.[1]?.toLowerCase();
      if (["wav", "mp3", "ogg", "webm", "m4a", "flac"].includes(urlExt)) {
        ext = urlExt;
      }
    }

    // Пробрасываем важные заголовки от upstream
    const headersToForward = [
      "content-length",
      "content-range",
      "accept-ranges",
      "last-modified",
      "etag",
    ];

    res.setHeader("Content-Type", contentType);
    res.setHeader("Accept-Ranges", "bytes");
    for (const h of headersToForward) {
      const v = audioRes.headers.get(h);
      if (v) res.setHeader(h, v);
    }

    // Content-Disposition: attachment если ?download=1, иначе inline (для <audio>)
    if (download === "1") {
      const filename = `sonexa-speech-${Date.now()}.${ext}`;
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );
    } else {
      res.setHeader("Content-Disposition", `inline; filename="audio.${ext}"`);
    }

    res.setHeader("Cache-Control", "public, max-age=3600");

    // Статус: 200 или 206 (Partial Content для Range)
    res.status(audioRes.status);

    // Стримим тело ответа
    if (audioRes.body) {
      const reader = audioRes.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    } else {
      const buffer = Buffer.from(await audioRes.arrayBuffer());
      res.send(buffer);
    }
  } catch (err) {
    console.error("Download proxy error:", err);
    if (!res.headersSent) {
      return res.status(500).json({
        error: err.message || "Download failed",
      });
    }
    res.end();
  }
}
