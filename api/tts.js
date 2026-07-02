import { Client } from "@gradio/client";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    const { text, voice } = req.body || {};

    if (!text || !text.trim()) {
      return res.status(400).json({
        error: "Text is required",
      });
    }

    const client = await Client.connect(
      "https://cartik-sonexa-1-server.hf.space"
    );

    const result = await client.predict("/predict", {
      text: text.trim(),
      speaker: voice || "serena",
    });

    const file = result.data;

    let audio = null;

    if (Array.isArray(file)) {
      audio = file[0];
    } else {
      audio = file;
    }

    if (!audio) {
      return res.status(500).json({
        error: "No audio returned",
      });
    }

    return res.status(200).json({
      audio_url: audio.url || audio.path,
    });

  } catch (err) {
    console.error(err);

    return res.status(500).json({
      error: err.message,
    });
  }
}
