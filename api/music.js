const SPACE = "Cartik/Sonexa-Music-Server";
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

  return Promise.race([promise, timeout]).finally(() => {
    clearTimeout(timer);
  });
}

function normalizeAudioResult(result) {
  const data = result?.data;

  const first = Array.isArray(data) ? data[0] : data;

  if (typeof first === "string") {
    if (first.startsWith("http://") || first.startsWith("https://")) {
      return first;
    }

    return `${SPACE_URL}/file=${encodeURIComponent(first)}`;
  }

  if (first && typeof first === "object") {
    if (typeof first.url === "string") {
      return first.url;
    }

    if (typeof first.path === "string") {
      if (first.path.startsWith("http://") || first.path.startsWith("https://")) {
        return first.path;
      }

      return `${SPACE_URL}/file=${encodeURIComponent(first.path)}`;
    }

    if (typeof first.name === "string") {
      if (first.name.startsWith("http://") || first.name.startsWith("https://")) {
        return first.name;
      }

      return `${SPACE_URL}/file=${encodeURIComponent(first.name)}`;
    }
  }

  return null;
}

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
    const prompt = typeof req.body?.prompt === "string"
      ? req.body.prompt.trim()
      : "";

    const lyrics = typeof req.body?.lyrics === "string"
      ? req.body.lyrics.trim()
      : "";

    const duration = Number(req.body?.duration || 60);

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

    const { Client } = await import("@gradio/client");

    console.log(`Connecting to ${SPACE}...`);

    const client = await withTimeout(
      Client.connect(SPACE)
    );

    console.log("Connected. Calling /predict...");

    const result = await withTimeout(
      client.predict("/predict", [
        prompt,
        lyrics,
        duration,
      ])
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

    const message = error?.message || String(error);

    return res.status(502).json({
      error: `Music backend error: ${message}`,
    });
  }
}
