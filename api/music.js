const BASE = "https://cartik-sonexa-music-server.hf.space";
const TIMEOUT_MS = 300000;

function withTimeout(promiseFactory, ms = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return promiseFactory(controller.signal).finally(() => clearTimeout(timer));
}

async function callPredict(data) {
  return withTimeout(async (signal) => {
    const res = await fetch(`${BASE}/gradio_api/call/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
      signal,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Music backend: HTTP ${res.status}: ${text.slice(0, 300)}`);
    }

    const body = await res.json();
    if (!body.event_id) {
      throw new Error("Music backend did not return event_id.");
    }

    return body.event_id;
  });
}

async function waitForResult(eventId) {
  return withTimeout(async (signal) => {
    const res = await fetch(`${BASE}/gradio_api/call/predict/${eventId}`, { signal });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Music stream: HTTP ${res.status}: ${text.slice(0, 300)}`);
    }

    if (!res.body) {
      throw new Error("Music backend returned an empty stream.");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() || "";

      for (const block of blocks) {
        const event = block.match(/^event:\s*(.+)$/m)?.[1]?.trim();
        const dataLine = block.match(/^data:\s*(.+)$/m)?.[1]?.trim();

        if (event === "error") {
          throw new Error(dataLine || "Music generation failed.");
        }

        if (event !== "complete" || !dataLine) continue;

        let payload;
        try {
          payload = JSON.parse(dataLine);
        } catch {
          throw new Error("Invalid result from music backend.");
        }

        const first = Array.isArray(payload) ? payload[0] : payload;

        if (typeof first === "string") {
          return first.startsWith("http")
            ? first
            : `${BASE}/file=${encodeURIComponent(first)}`;
        }

        if (first && typeof first === "object") {
          if (typeof first.url === "string") return first.url;
          if (typeof first.path === "string") return `${BASE}/file=${encodeURIComponent(first.path)}`;
          if (typeof first.name === "string") return `${BASE}/file=${encodeURIComponent(first.name)}`;
        }

        throw new Error("Music backend returned an unsupported audio result.");
      }
    }

    throw new Error("Music backend finished without a result.");
  });
}

export const config = {
  api: {
    bodyParser: true,
    responseLimit: false,
  },
  maxDuration: 300,
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
    const lyrics = typeof req.body?.lyrics === "string" ? req.body.lyrics.trim() : "";
    const duration = Number(req.body?.duration || 60);

    if (!prompt) return res.status(400).json({ error: "Music description is required." });
    if (![30, 60, 90].includes(duration)) {
      return res.status(400).json({ error: "Duration must be 30, 60, or 90 seconds." });
    }

    const eventId = await callPredict([prompt, lyrics, duration]);
    const audioUrl = await waitForResult(eventId);

    return res.status(200).json({ audio_url: audioUrl, duration });
  } catch (error) {
    console.error("Music API error:", error);
    return res.status(500).json({ error: error?.message || "Music generation failed." });
  }
}
