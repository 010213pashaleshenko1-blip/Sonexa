/**
 * Sonexa ASR — speech-to-text API
 *
 * Endpoint:
 *   POST /api/asr
 *     FormData: { audio: <file>, language?: <string> }
 *     → { text: "распознанный текст", language: "Russian" }
 *
 * Backend: HF Space Cartik/Sonexa-1-ASR
 * FastAPI endpoint: POST /predict
 *
 * The ASR Space exposes a native FastAPI endpoint. We call it directly
 * instead of going through Gradio's /upload + /call/predict SSE protocol.
 * This is more reliable with Gradio 5.x and avoids FileData/SSE compatibility
 * problems completely.
 */

const BASE = "https://cartik-sonexa-1-asr.hf.space";
const REQUEST_TIMEOUT_MS = 240000; // CPU ASR can be slow
const MAX_SIZE = 25 * 1024 * 1024;

function fetchWithTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timeout));
}

// Vercel function configuration.
export const config = {
  api: {
    responseLimit: false,
  },
  maxDuration: 300,
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const contentType = req.headers["content-type"] || "";
    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      return res.status(400).json({
        error: "Expected multipart/form-data with an audio file",
      });
    }

    const contentLength = Number.parseInt(
      req.headers["content-length"] || "0",
      10
    );

    if (Number.isFinite(contentLength) && contentLength > MAX_SIZE) {
      return res.status(413).json({
        error: `File too large. Max ${MAX_SIZE / 1024 / 1024} MB`,
      });
    }

    // Read the incoming multipart request without relying on Vercel's
    // automatic body parser. This keeps binary audio intact.
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    const bodyBuffer = Buffer.concat(chunks);
    if (bodyBuffer.length === 0) {
      return res.status(400).json({ error: "Empty request body" });
    }

    if (bodyBuffer.length > MAX_SIZE) {
      return res.status(413).json({
        error: `File too large. Max ${MAX_SIZE / 1024 / 1024} MB`,
      });
    }

    const boundary = extractBoundary(contentType);
    if (!boundary) {
      return res.status(400).json({ error: "No boundary in content-type" });
    }

    const parts = parseMultipart(bodyBuffer, boundary);
    const audioPart = parts.find(
      (part) => part.name === "audio" && part.filename
    );

    if (!audioPart) {
      return res.status(400).json({
        error: "No audio file found. Use multipart field 'audio'.",
      });
    }

    if (!audioPart.data || audioPart.data.length === 0) {
      return res.status(400).json({ error: "Empty audio file" });
    }

    const languagePart = parts.find((part) => part.name === "language");
    const language = languagePart?.data?.toString("utf8").trim() || "Russian";

    // Forward the original binary audio to the FastAPI /predict endpoint.
    // Do not set Content-Type manually: undici/fetch adds the multipart
    // boundary for FormData automatically.
    const formData = new FormData();
    const audioBlob = new Blob([audioPart.data], {
      type: audioPart.contentType || "application/octet-stream",
    });

    formData.append(
      "audio",
      audioBlob,
      audioPart.filename || "audio.wav"
    );
    formData.append("language", language);

    const upstream = await fetchWithTimeout(`${BASE}/predict`, {
      method: "POST",
      body: formData,
    });

    const responseText = await upstream.text();
    let payload;

    try {
      payload = JSON.parse(responseText);
    } catch {
      payload = { detail: responseText };
    }

    if (!upstream.ok) {
      const detail = payload?.detail || payload?.error || responseText;
      return res.status(upstream.status).json({
        error: `ASR backend failed (HTTP ${upstream.status})`,
        detail: String(detail).slice(0, 2000),
      });
    }

    return res.status(200).json({
      text: String(payload?.text || "").trim(),
      language: payload?.language || language,
    });
  } catch (err) {
    console.error("ASR error:", err);

    if (err?.name === "AbortError") {
      return res.status(504).json({
        error: "ASR backend timeout",
        detail: "The CPU ASR model did not finish within 4 minutes.",
      });
    }

    return res.status(500).json({
      error: "ASR failed",
      detail: err?.message || String(err),
    });
  }
}

/**
 * Extract multipart boundary from Content-Type.
 */
function extractBoundary(contentType) {
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  return match?.[1] || match?.[2]?.trim();
}

/**
 * Minimal binary-safe multipart/form-data parser.
 * Returns { name, filename, contentType, data: Buffer } objects.
 */
function parseMultipart(buffer, boundary) {
  const parts = [];
  const marker = Buffer.from(`--${boundary}`);
  const endMarker = Buffer.from(`--${boundary}--`);

  let cursor = 0;

  while (cursor < buffer.length) {
    const boundaryStart = buffer.indexOf(marker, cursor);
    if (boundaryStart === -1) break;

    if (buffer.indexOf(endMarker, boundaryStart) === boundaryStart) break;

    const afterBoundary = boundaryStart + marker.length;

    // Normal multipart boundaries are followed by CRLF.
    let partStart = afterBoundary;
    if (buffer.slice(partStart, partStart + 2).equals(Buffer.from("\r\n"))) {
      partStart += 2;
    }

    const nextBoundary = buffer.indexOf(marker, partStart);
    if (nextBoundary === -1) break;

    let partEnd = nextBoundary;
    if (partEnd >= 2 && buffer.slice(partEnd - 2, partEnd).equals(Buffer.from("\r\n"))) {
      partEnd -= 2;
    }

    const part = buffer.slice(partStart, partEnd);
    const headerEnd = part.indexOf(Buffer.from("\r\n\r\n"));

    if (headerEnd === -1) {
      cursor = nextBoundary;
      continue;
    }

    const headerStr = part.slice(0, headerEnd).toString("utf8");
    const data = part.slice(headerEnd + 4);

    const nameMatch = headerStr.match(/name="([^"]+)"/i);
    const filenameMatch = headerStr.match(/filename="([^"]*)"/i);
    const contentTypeMatch = headerStr.match(
      /Content-Type:\s*([^\r\n]+)/i
    );

    parts.push({
      name: nameMatch?.[1] || "",
      filename: filenameMatch?.[1] || undefined,
      contentType:
        contentTypeMatch?.[1]?.trim() || "application/octet-stream",
      data,
    });

    cursor = nextBoundary;
  }

  return parts;
}
