const SPACE_URL = "https://cartik-sonexa-music-server.hf.space";
const TIMEOUT_MS = 300000;

export const config = {
  api: {
    bodyParser: true,
    responseLimit: false,
  },
  maxDuration: 300,
};

function withTimeout(promise, ms = TIMEOUT_MS) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error("Music generation timed out after 5 minutes."));
    }, ms);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function normalizeAudioResult(result) {
  const first = Array.isArray(result?.data) ? result.data[0] : result?.data;

  if (typeof first === "string") {
    return first.startsWith("http://") || first.startsWith("https://")
      ? first
      : `${SPACE_URL}/file=${encodeURIComponent(first)}`;
  }

  if (first && typeof first === "object") {
    for (const key of ["url", "path", "name"]) {
      if (typeof first[key] !== "string") continue;
      if (first[key].startsWith("http://") || first[key].startsWith("https://")) {
        return first[key];
      }
      return `${SPACE_URL}/file=${encodeURIComponent(first[key])}`;
    }
  }

  return null;
}

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

    if (!prompt) {
      return res.status(400).json({ error: "Music description is required." });
    }

    if (![30, 60, 90].includes(duration)) {
      return res.status(400).json({ error: "Duration must be 30, 60, or 90 seconds." });
    }

    const { Client } = await import("@gradio/client");

    console.log(`Connecting directly to ${SPACE_URL}...`);

    const client = await withTimeout(
      Client.connect(SPACE_URL)
    );

    console.log("Connected. Calling /predict...");

    const result = await withTimeout(
      client.predict("/predict", [prompt, lyrics, duration])
    );

    console.log("Raw Gradio result:", JSON.stringify(result));

    const audioUrl = normalizeAudioResult(result);

    if (!audioUrl) {
      return res.status(502).json({
        error: "Music backend returned an invalid audio result.",
        backend: result,
      });
    }

    return res.status(200).json({
      audio_url: audioUrl,
      duration,
    });
  } catch (error) {
    console.error("Music API error:", error);

    return res.status(502).json({
      error: `Music backend error: ${error?.message || String(error)}`,
    });
  }
}
