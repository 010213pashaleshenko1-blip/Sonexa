/**
 * Sonexa — audio download proxy
 *
 * GET /api/download?url=<audio_url>
 *
 * Проксирует аудиофайл с Gradio Space (кросс-доменный) через наш сервер,
 * чтобы обойти CORS и добавить Content-Disposition: attachment.
 *
 * Это позволяет браузеру корректно скачивать файл вместо открытия в новой вкладке.
 *
 * Безопасность: разрешаем только URL с домена cartik-sonexa-1-server.hf.space
 * (защита от SSRF — нельзя использовать прокси для произвольных URL).
 */

const ALLOWED_HOSTS = [
  "cartik-sonexa-1-server.hf.space",
  "cartik-sonexa-aq-server.hf.space",
];

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { url } = req.query;
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
    const audioRes = await fetch(url, {
      headers: {
        // Gradio иногда требует Authorization для приватных Spaces
        // Для TTS Space (публичный) не нужно, но добавим на всякий случай
        ...(process.env.HF_TOKEN
          ? { Authorization: `Bearer ${process.env.HF_TOKEN.trim()}` }
          : {}),
      },
    });

    if (!audioRes.ok) {
      return res.status(audioRes.status).json({
        error: `Failed to fetch audio: HTTP ${audioRes.status}`,
      });
    }

    // Определяем Content-Type и расширение
    const contentType = audioRes.headers.get("content-type") || "audio/mpeg";
    let ext = "mp3";
    if (contentType.includes("wav")) ext = "wav";
    else if (contentType.includes("mpeg") || contentType.includes("mp3")) ext = "mp3";
    else if (contentType.includes("ogg")) ext = "ogg";
    else if (contentType.includes("webm")) ext = "webm";
    else {
      // Проверим расширение в URL
      const urlExt = parsedUrl.pathname.match(/\.(\w{3,4})$/)?.[1]?.toLowerCase();
      if (["wav", "mp3", "ogg", "webm", "m4a", "flac"].includes(urlExt)) {
        ext = urlExt;
      }
    }

    const filename = `sonexa-speech-${Date.now()}.${ext}`;

    // Прокидываем аудио как blob
    const buffer = Buffer.from(await audioRes.arrayBuffer());

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", buffer.length.toString());
    res.setHeader("Cache-Control", "no-cache");

    return res.status(200).send(buffer);
  } catch (err) {
    console.error("Download proxy error:", err);
    return res.status(500).json({
      error: err.message || "Download failed",
    });
  }
}
