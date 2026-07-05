/**
 * Sonexa Assistant — chat API (Gradio SSE streaming)
 *
 * Endpoint:
 *   POST /api/chat
 *     { messages: [{role, content}], temperature?: 0.7, max_tokens?: 1024 }
 *     → text/event-stream
 *       data: {"status":"started"}
 *       data: {"status":"chunk","content":"накопленный текст"}
 *       ...
 *       data: {"status":"done","content":"полный текст"}
 *
 * Backend: приватный HF Space Cartik/Sonexa-AQ-Server (Gradio API)
 *   1. POST {BASE}/gradio_api/call/predict  → { event_id }   (с Authorization: Bearer HF_TOKEN)
 *   2. GET  {BASE}/gradio_api/call/predict/{event_id}  → SSE stream
 *      event: complete
 *      data: [full_response_text]
 *
 * Токен HF_TOKEN берётся из process.env (Vercel Environment Variables).
 * URL Space берётся из process.env.HF_CHAT_SPACE_URL или дефолтный.
 */

const HF_TOKEN = process.env.HF_TOKEN || "";
// Приватный Space Cartik/Sonexa-AQ-Server
const BASE = process.env.HF_CHAT_SPACE_URL || "https://cartik-sonexa-aq-server.hf.space";

const SYSTEM_PROMPT = `Ты — Sonexa Assistant, дружелюбный ИИ-помощник в одноимённом приложении для синтеза речи (TTS).

О приложении Sonexa:
- AI Voice Studio для озвучки текста
- 9 голосов (Серена, Анна, Софи, Виктория, Райан, Эйден, Дилан, Эрик, Дядя Фу)
- Лимит: 2000 символов на запрос
- Скоро: ASR (распознавание речи) и Music AI Generation
- Дизайн: тёмная/светлая тема, минималистичный интерфейс с анимациями

Твои правила:
- Отвечай на русском языке (если пользователь не пишет на другом)
- Будь дружелюбным, кратким и по делу
- Помогай с вопросами о Sonexa, озвучке, голосах
- Если просят сгенерировать текст для озвучки — предлагай варианты
- Используй эмодзи умеренно (1-2 на сообщение, не больше)`;

/**
 * Форматируем messages в единую строку для Gradio predict.
 * Gradio API на этом Space принимает data: [message_string].
 */
function buildPromptFromMessages(messages) {
  const lines = [];
  // System prompt добавляем первым
  lines.push(`[SYSTEM] ${SYSTEM_PROMPT}`);
  for (const m of messages) {
    if (m.role === "user") {
      lines.push(`[USER] ${m.content}`);
    } else if (m.role === "assistant") {
      lines.push(`[ASSISTANT] ${m.content}`);
    }
  }
  lines.push("[ASSISTANT]");
  return lines.join("\n");
}

/**
 * Шлёт POST на Gradio API для создания задачи.
 * Возвращает event_id.
 */
async function createGradioTask(prompt) {
  const url = `${BASE}/gradio_api/call/predict`;
  const headers = {
    "Content-Type": "application/json",
  };
  if (HF_TOKEN) {
    headers["Authorization"] = `Bearer ${HF_TOKEN}`;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      data: [prompt],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    let msg = `Gradio API error ${res.status}`;
    try {
      const j = JSON.parse(text);
      if (j.error) msg += `: ${j.error}`;
    } catch {
      if (text) msg += `: ${text.slice(0, 300)}`;
    }
    throw new Error(msg);
  }

  const data = await res.json();
  if (!data.event_id) {
    throw new Error("Gradio API не вернул event_id");
  }
  return data.event_id;
}

/**
 * Читает SSE-стрим Gradio и ждёт событие complete.
 * Парсит data: [...] и возвращает распакованный текст.
 */
async function waitForGradioResult(eventId, onChunk) {
  const url = `${BASE}/gradio_api/call/predict/${eventId}`;
  const headers = {};
  if (HF_TOKEN) {
    headers["Authorization"] = `Bearer ${HF_TOKEN}`;
  }

  const res = await fetch(url, { method: "GET", headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gradio stream error ${res.status}: ${text.slice(0, 200)}`);
  }

  // Читаем SSE поток
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result = null;
  let error = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    // SSE события разделены двойным переносом строки
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() || ""; // последний неполный блок

    for (const block of blocks) {
      const eventMatch = block.match(/^event:\s*(.+)$/m);
      const dataMatch = block.match(/^data:\s*(.+)$/m);
      if (!eventMatch || !dataMatch) continue;

      const event = eventMatch[1].trim();
      const dataStr = dataMatch[1].trim();

      if (event === "error") {
        error = dataStr;
        break;
      }
      if (event === "complete") {
        try {
          const payload = JSON.parse(dataStr);
          // Gradio возвращает data: [response] — массив
          if (Array.isArray(payload) && payload.length > 0) {
            result = payload[0];
          } else {
            result = String(payload);
          }
        } catch {
          result = dataStr;
        }
        break;
      }
      // Промежуточные события (generating, etc.) — игнорируем
    }
    if (error || result !== null) break;
  }

  if (error) throw new Error(`Gradio error: ${error}`);
  if (result === null) throw new Error("Gradio не вернул результат (timeout?)");
  return result;
}

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!HF_TOKEN) {
    return res.status(500).json({
      error: "HF_TOKEN не настроен на сервере. Добавь его в Vercel Environment Variables.",
    });
  }

  const { messages } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages array required" });
  }

  const valid = messages.every(
    m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string"
  );
  if (!valid) {
    return res.status(400).json({ error: "each message must have {role, content}" });
  }

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  function send(obj) {
    res.write(`data: ${JSON.stringify(obj)}\n\n`);
  }

  try {
    send({ status: "started", model: "sonexa" });

    // 1. Создаём задачу в Gradio
    const prompt = buildPromptFromMessages(messages);
    const eventId = await createGradioTask(prompt);

    // 2. Ждём результат через SSE
    const fullText = await waitForGradioResult(eventId);

    if (!fullText || !fullText.trim()) {
      throw new Error("Модель вернула пустой ответ");
    }

    // 3. Эмуляция стриминга для UX: разбиваем на слова, отправляем поэтапно
    //    (Gradio отдаёт весь ответ одним куском в complete-событии)
    const tokens = fullText.split(/(\s+)/);
    let accumulated = "";

    for (let i = 0; i < tokens.length; i++) {
      accumulated += tokens[i];
      send({ status: "chunk", content: accumulated });
      await new Promise(r => setTimeout(r, 35));
    }

    send({ status: "done", content: fullText });
  } catch (err) {
    send({ status: "error", error: err.message || "Unknown error" });
  } finally {
    res.end();
  }
}
