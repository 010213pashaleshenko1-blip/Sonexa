/**
 * Sonexa ASR — speech-to-text API
 *
 * Endpoint:
 *   POST /api/asr
 *     FormData: { audio: <file> }
 *     → { text: "распознанный текст" }
 *
 * Backend: HF Space Cartik/Sonexa-1-ASR (публичный, без токена)
 * URL: https://cartik-sonexa-1-asr.hf.space
 *
 * Стратегия:
 *   1. POST /gradio_api/upload — загружаем аудио, получаем filepath
 *   2. POST /gradio_api/call/predict с data:[filepath] → { event_id }
 *   3. GET /gradio_api/call/predict/{event_id} → SSE stream → complete event
 */

const BASE = "https://cartik-sonexa-1-asr.hf.space";
const FETCH_TIMEOUT_MS = 30000;    // таймаут для upload/predict (короткие запросы)
const STREAM_TIMEOUT_MS = 180000;  // 3 минуты для стриминга результата (ASR на CPU медленный)

function fetchWithTimeout(url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timeout));
}

/**
 * Загружает аудиофайл на Gradio Space.
 * Возвращает путь к загруженному файлу.
 */
async function uploadAudio(fileBuffer, filename, contentType) {
  const formData = new FormData();
  const blob = new Blob([fileBuffer], { type: contentType || "audio/wav" });
  formData.append("files", blob, filename || "audio.wav");

  const res = await fetchWithTimeout(`${BASE}/gradio_api/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed: HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(`Upload вернул неожиданный ответ: ${JSON.stringify(data).slice(0, 200)}`);
  }

  return data[0];
}

/**
 * Вызывает predict endpoint Gradio.
 */
async function callPredict(audioPath) {
  const res = await fetchWithTimeout(`${BASE}/gradio_api/call/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: [audioPath] }),
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
 *
 * Важные события Gradio:
 *   event: heartbeat  data: null  ← пинг, задача ещё выполняется (ИГНОРИРУЕМ)
 *   event: generating data: ...   ← промежуточный результат (ИГНОРИРУЕМ для ASR)
 *   event: complete   data: [text] ← финальный результат
 *   event: error      data: ...    ← ошибка
 */
async function waitForResult(eventId) {
  const url = `${BASE}/gradio_api/call/predict/${eventId}`;
  // Для стрима используем длинный таймаут — модель на CPU может работать минуты
  const res = await fetch(url, { method: "GET" });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Stream failed: HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result = null;
  let error = null;
  const startTime = Date.now();

  while (true) {
    // Проверяем общий таймаут стрима
    if (Date.now() - startTime > STREAM_TIMEOUT_MS) {
      try { reader.cancel(); } catch {}
      throw new Error("ASR превысил время ожидания (3 минуты). Модель слишком медленная или зависла.");
    }

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

      // heartbeat — пинг, задача ещё выполняется, ПРОДОЛЖАЕМ ЖДАТЬ
      if (eventName === "heartbeat") {
        continue;
      }
      // generating — промежуточный результат, для ASR не нужен
      if (eventName === "generating") {
        continue;
      }

      if (eventName === "error") {
        if (dataStr === "null" || !dataStr) {
          error = "Модель не смогла обработать аудио (возможно, невалидный формат или слишком короткое аудио)";
        } else {
          error = dataStr;
        }
        break;
      }
      if (eventName === "complete") {
        if (!dataStr || dataStr === "null") {
          result = "";
        } else {
          try {
            const payload = JSON.parse(dataStr);
            if (Array.isArray(payload)) {
              result = payload[0] ?? "";
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

// Vercel: увеличиваем таймаут функции до максимума (300с для Pro, 60с для Hobby)
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
    if (!contentType.includes("multipart/form-data")) {
      return res.status(400).json({
        error: "Expected multipart/form-data with audio file",
      });
    }

    // Проверка размера
    const contentLength = parseInt(req.headers["content-length"] || "0", 10);
    const MAX_SIZE = 25 * 1024 * 1024;
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

    if (bodyBuffer.length === 0) {
      return res.status(400).json({ error: "Empty request body" });
    }

    // Парсим multipart/form-data
    const boundary = extractBoundary(contentType);
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

    return res.status(200).json({
      text: (recognizedText || "").trim(),
    });
  } catch (err) {
    console.error("ASR error:", err);
    return res.status(500).json({
      error: err.message || "ASR failed",
    });
  }
}

/**
 * Извлекает boundary из Content-Type заголовка.
 */
function extractBoundary(contentType) {
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/);
  return match?.[1] || match?.[2];
}

/**
 * Парсер multipart/form-data.
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

    // Проверим не end boundary ли это
    if (buffer.indexOf(endBoundaryBuffer, bStart) === bStart) break;

    const nextBStart = buffer.indexOf(boundaryBuffer, bStart + boundaryBuffer.length);
    if (nextBStart === -1) break;

    // Часть между двумя boundary (без CRLF перед/после)
    const partStart = bStart + boundaryBuffer.length + 2; // +2 for \r\n after boundary
    const partEnd = nextBStart - 2; // -2 for \r\n before next boundary
    if (partEnd <= partStart) {
      start = nextBStart;
      continue;
    }
    const partData = buffer.slice(partStart, partEnd);

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
    const filenameMatch = headerStr.match(/filename="([^"]*)"/);
    const ctMatch = headerStr.match(/Content-Type:\s*([^\r\n]+)/i);

    parts.push({
      name: nameMatch?.[1] || "",
      filename: filenameMatch?.[1] || undefined,
      contentType: ctMatch?.[1]?.trim() || "application/octet-stream",
      data: contentBuffer,
    });

    start = nextBStart;
  }

  return parts;
}
