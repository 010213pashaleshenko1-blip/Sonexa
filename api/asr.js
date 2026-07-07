/**
 * Sonexa ASR — speech-to-text API
 *
 * Endpoint:
 *   POST /api/asr
 *     FormData: { audio: <file> }  (wav/mp3/ogg/webm/m4a)
 *     → { text: "распознанный текст" }
 *
 * Backend: HF Space Cartik/Sonexa-1-ASR (Gradio API)
 * URL: https://cartik-sonexa-1-asr.hf.space
 *
 * Стратегия (Gradio API для audio input):
 *   1. POST /gradio_api/upload — загружаем аудиофайл на Space, получаем filepath
 *   2. POST /gradio_api/call/predict — вызываем predict с data:[filepath]
 *      → { event_id }
 *   3. GET /gradio_api/call/predict/{event_id} — SSE stream, ждём complete
 *      data: [recognized_text]
 *
 * Space публичный, токен не требуется (но добавим на всякий случай).
 */

const BASE = "https://cartik-sonexa-1-asr.hf.space";
const FETCH_TIMEOUT_MS = 90000; // ASR на CPU может быть медленным

function authHeaders(extra = {}) {
  const h = { ...extra };
  if (process.env.HF_TOKEN) {
    h["Authorization"] = `Bearer ${process.env.HF_TOKEN.trim()}`;
  }
  return h;
}

function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timeout));
}

/**
 * Загружает аудиофайл на Gradio Space.
 * Возвращает путь к загруженному файлу на сервере Space.
 */
async function uploadAudio(fileBuffer, filename, contentType) {
  const formData = new FormData();
  // Создаём Blob из Buffer для FormData
  const blob = new Blob([fileBuffer], { type: contentType || "audio/wav" });
  formData.append("files", blob, filename);

  const res = await fetchWithTimeout(`${BASE}/gradio_api/upload`, {
    method: "POST",
    headers: authHeaders(), // без Content-Type — FormData сам ставит boundary
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed: HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  // Gradio возвращает массив путней, например ["/tmp/gradio/xxx/audio.wav"]
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(`Upload вернул неожиданный ответ: ${JSON.stringify(data).slice(0, 200)}`);
  }

  return data[0]; // путь к файлу на сервере Space
}

/**
 * Вызывает predict endpoint Gradio.
 * Возвращает event_id.
 */
async function callPredict(audioPath) {
  const res = await fetchWithTimeout(`${BASE}/gradio_api/call/predict`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      data: [audioPath],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Predict call failed: HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  if (!data.event_id) {
    throw new Error(`Predict не вернул event_id: ${JSON.stringify(data).slice(0, 200)}`);
  }

  return data.event_id;
}

/**
 * Читает SSE-стрим Gradio и ждёт событие complete.
 * Возвращает распознанный текст.
 */
async function waitForResult(eventId) {
  const url = `${BASE}/gradio_api/call/predict/${eventId}`;
  const res = await fetchWithTimeout(url, {
    method: "GET",
    headers: authHeaders(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Stream failed: HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result = null;
  let error = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() || "";

    for (const block of blocks) {
      const eventMatch = block.match(/^event:\s*(.+)$/m);
      const dataMatch = block.match(/^data:\s*(.+)$/m);
      const eventName = eventMatch ? eventMatch[1].trim() : null;
      const dataStr = dataMatch ? dataMatch[1].trim() : null;

      if (eventName === "error") {
        error = dataStr || "unknown error";
        break;
      }
      if (eventName === "complete") {
        if (!dataStr) {
          result = "";
        } else {
          try {
            const payload = JSON.parse(dataStr);
            if (Array.isArray(payload) && payload.length > 0) {
              result = payload[0];
            } else {
              result = String(payload);
            }
          } catch {
            result = dataStr;
          }
        }
        break;
      }
    }
    if (error || result !== null) break;
  }

  if (error) throw new Error(`ASR error: ${error}`);
  if (result === null) throw new Error("ASR не вернул результат (timeout?)");
  return result;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Получаем файл из FormData
    // Vercel Node.js runtime парсит multipart/form-data через req.body
    // Но проще использовать busboy или вручную. Проверим что пришло.
    const contentType = req.headers["content-type"] || "";

    if (!contentType.includes("multipart/form-data")) {
      return res.status(400).json({
        error: "Expected multipart/form-data with audio file",
      });
    }

    // Парсим multipart вручную (Vercel Node.js 20+ поддерживает req.body как Buffer)
    // Но надёжнее использовать Web API Request
    const contentLength = parseInt(req.headers["content-length"] || "0", 10);
    const MAX_SIZE = 25 * 1024 * 1024; // 25 MB лимит
    if (contentLength > MAX_SIZE) {
      return res.status(413).json({
        error: `File too large. Max ${MAX_SIZE / 1024 / 1024} MB`,
      });
    }

    // Читаем всё тело запроса как Buffer
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const bodyBuffer = Buffer.concat(chunks);

    // Парсим multipart/form-data
    const boundary = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.[1] || contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.[2];
    if (!boundary) {
      return res.status(400).json({ error: "No boundary in content-type" });
    }

    const parts = parseMultipart(bodyBuffer, boundary);
    const audioPart = parts.find(p => p.name === "audio" || p.filename);
    if (!audioPart) {
      return res.status(400).json({ error: "No audio file in request" });
    }

    if (!audioPart.data || audioPart.data.length === 0) {
      return res.status(400).json({ error: "Empty audio file" });
    }

    // 1. Загружаем аудио на Gradio Space
    const audioPath = await uploadAudio(
      audioPart.data,
      audioPart.filename || "audio.wav",
      audioPart.contentType || "audio/wav"
    );

    // 2. Вызываем predict
    const eventId = await callPredict(audioPath);

    // 3. Ждём результат
    const recognizedText = await waitForResult(eventId);

    if (!recognizedText || !recognizedText.trim()) {
      return res.status(200).json({
        text: "",
        warning: "Модель не распознала речь в аудио",
      });
    }

    return res.status(200).json({
      text: recognizedText.trim(),
    });
  } catch (err) {
    console.error("ASR error:", err);
    return res.status(500).json({
      error: err.message || "ASR failed",
    });
  }
}

/**
 * Простой парсер multipart/form-data.
 * Возвращает массив { name, filename, contentType, data: Buffer }.
 */
function parseMultipart(buffer, boundary) {
  const parts = [];
  const boundaryBuffer = Buffer.from("--" + boundary);
  const endBoundaryBuffer = Buffer.from("--" + boundary + "--");

  let start = 0;
  while (start < buffer.length) {
    const bStart = buffer.indexOf(boundaryBuffer, start);
    if (bStart === -1) break;

    const nextBStart = buffer.indexOf(boundaryBuffer, bStart + boundaryBuffer.length);
    if (nextBStart === -1) break;

    // Часть между boundary и следующей boundary
    const partData = buffer.slice(bStart + boundaryBuffer.length + 2, nextBStart - 2); // -2 for \r\n before next boundary

    // Парсим заголовки части
    const headerEnd = partData.indexOf("\r\n\r\n");
    if (headerEnd === -1) {
      start = nextBStart;
      continue;
    }

    const headerStr = partData.slice(0, headerEnd).toString("utf-8");
    const contentBuffer = partData.slice(headerEnd + 4);

    // Извлекаем name и filename из Content-Disposition
    const nameMatch = headerStr.match(/name="([^"]+)"/);
    const filenameMatch = headerStr.match(/filename="([^"]+)"/);
    const ctMatch = headerStr.match(/Content-Type:\s*([^\r\n]+)/i);

    parts.push({
      name: nameMatch?.[1] || "",
      filename: filenameMatch?.[1] || undefined,
      contentType: ctMatch?.[1]?.trim() || "application/octet-stream",
      data: contentBuffer,
    });

    start = nextBStart;

    // Проверим не конец ли это
    if (buffer.indexOf(endBoundaryBuffer, nextBStart) !== -1) break;
  }

  return parts;
}
