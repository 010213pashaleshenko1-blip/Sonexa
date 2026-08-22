const BASE = "https://cartik-sonexa-music-server.hf.space";
const TIMEOUT_MS = 300000;

function withTimeout(promiseFactory, ms = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return promiseFactory(controller.signal).finally(() => clearTimeout(timer));
}

async function predict(prompt, lyrics, duration) {
  return withTimeout(async (signal) => {
    const res = await fetch(`${BASE}/api/predict/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: [prompt, lyrics, duration],
        fn_index: 0,
      }),
      signal,
    });

    const text = await res.text();

    if (!res.ok) {
      throw new Error(
        `Music backend: HTTP ${res.status}: ${text.slice(0, 500)}`
      );
    }

    let body;

    try {
      body = JSON.parse(text);
    } catch {
      throw new Error(
        `Music backend returned invalid JSON: ${text.slice(0, 500)}`
      );
    }

    if (body.error) {
      throw new Error(String(body.error));
    }

    return body.data;
  });
}

function extractAudioUrl(data) {
  const first = Array.isArray(data) ? data[0] : data;

  if (typeof first === "string") {
    if (first.startsWith("http://") || first.startsWith("https://")) {
      return first;
    }

    return `${BASE}/file=${encodeURIComponent(first)}`;
  }

  if (first && typeof first === "object") {
    if (typeof first.url === "string") {
      return first.url;
    }

    if (typeof first.path === "string") {
      return `${BASE}/file=${encodeURIComponent(first.path)}`;
    }

    if (typeof first.name === "string") {
      return `${BASE}/file=${encodeURIComponent(first.name)}`;
    }
  }

  throw new Error("Music backend returned an unsupported audio result.");
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

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    const prompt =
      typeof req.body?.prompt === "string"
        ? req.body.prompt.trim()
        : "";

    const lyrics =
      typeof req.body?.lyrics === "string"
        ? req.body.lyrics.trim()
        : "";

    const duration = Number(
      req.body?.duration ?? 60
    );

    if (!prompt) {
      return res.status(400).json({
        error: "Music description is required.",
      });
    }

    if (![30, 60, 90].includes(duration)) {
      return res.status(400).json({
        error: "Duration must be 30, 60, or 90 seconds.",
      });
    }

    const data = await predict(
      prompt,
      lyrics,
      duration
    );

    const audioUrl = extractAudioUrl(data);

    return res.status(200).json({
      success: true,
      audio_url: audioUrl,
      duration,
    });

  } catch (error) {
    console.error("Music API error:", error);

    return res.status(500).json({
      error:
        error?.message ||
        "Music generation failed.",
    });
  }
}
