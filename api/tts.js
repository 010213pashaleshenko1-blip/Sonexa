export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const HF_TOKEN = process.env.HF_TOKEN;
  const BASE = "https://cartik-sonexa-1-server.hf.space";

  if (!HF_TOKEN) {
    return res.status(500).json({
      error: "HF_TOKEN is not configured"
    });
  }

  try {
    const { text, voice } = req.body || {};

    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({
        error: "Invalid text"
      });
    }

    const headers = {
      "Authorization": `Bearer ${HF_TOKEN}`,
      "Content-Type": "application/json"
    };

    // Создаем задачу
    const postRes = await fetch(`${BASE}/gradio_api/call/predict`, {
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

    // Ждем результат
    const streamRes = await fetch(
      `${BASE}/gradio_api/call/predict/${event_id}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${HF_TOKEN}`
        }
      }
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

    const url =
      typeof file === "string"
        ? `${BASE}/gradio_api/file=${file}`
        : file.url ||
          `${BASE}/gradio_api/file=${file.path}`;

    return res.status(200).json({
      audio_url: url
    });

  } catch (e) {
    console.error(e);

    return res.status(500).json({
      error: e.message
    });
  }
}
