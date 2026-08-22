const SPACE = "Cartik/Sonexa-Music-Server";
const TIMEOUT_MS = 300000;

function withTimeout(promise, ms = TIMEOUT_MS) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("Music generation timed out.")), ms);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function extractAudioUrl(result) {
  const first = Array.isArray(result?.data) ? result.data[0] : result?.data;

  if (typeof first === "string") {
    if (first.startsWith("http://") || first.startsWith("https://")) return first;
    return null;
  }

  if (first && typeof first === "object") {
    if (typeof first.url === "string") return first.url;
    if (typeof first.path === "string" && first.path.startsWith("http")) return first.path;
    if (typeof first.name === "string" && first.name.startsWith("http")) return first.name;
  }

  return null;
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

    if (!prompt) {
      return res.status(400).json({ error: "Music description is required." });
    }

    if (![30, 60, 90].includes(duration)) {
      return res.status(400).json({
        error: "Duration must be 30, 60, or 90 seconds.",
      });
    }

    const { Client } = await import("@gradio/client");

    const client = await withTimeout(
      Client.connect(SPACE)
    );

    console.log("Connected to", SPACE);
    console.log("Calling /predict...");

    const result = await withTimeout(
      client.predict("/predict", [
        prompt,
        lyrics,
        duration,
      ])
    );

    console.log("Music backend result received.");

    const audioUrl = extractAudioUrl(result);

    if (!audioUrl) {
      console.error("Unexpected Gradio result:", result);
      return res.status(502).json({
        error: "Music backend returned an audio result without a public URL.",
      });
    }

    return res.status(200).json({
      audio_url: audioUrl,
      duration,
    });

  } catch (error) {
    console.error("Music API error:", error);

    return res.status(500).json({
      error: error?.message || "Music generation failed.",
    });
  }
}
