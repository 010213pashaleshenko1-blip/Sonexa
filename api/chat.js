/**
 * Sonexa Assistant — chat API (Gradio SSE streaming)
 *
 * Endpoint:
 *   POST /api/chat
 *     { messages: [{role, content}] }
 *     → text/event-stream
 *       data: {"status":"started"}
 *       data: {"status":"chunk","content":"накопленный текст"}
 *       ...
 *       data: {"status":"done","content":"полный текст"}
 *
 * Backend: приватный HF Space Cartik/Sonexa-AQ-Server (Gradio API)
 * URL: https://cartik-sonexa-aq-server.hf.space
 *
 * Стратегия:
 *   1. POST {BASE}/gradio_api/call/predict  (с Authorization: Bearer HF_TOKEN)
 *      body: { data: [prompt_string] }
 *      → { event_id }
 *   2. GET {BASE}/gradio_api/call/predict/{event_id}  (с Authorization)
 *      → SSE stream, ждём event: complete
 *      data: [response_text]
 *
 * Fallback paths: пробуем /gradio_api/call/predict → /call/predict → /api/predict
 * (разные версии Gradio используют разные пути)
 */

const HF_TOKEN = process.env.HF_TOKEN || "";
const BASE = "https://cartik-sonexa-aq-server.hf.space";

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

function authHeaders(extra = {}) {
  const h = { "Content-Type": "application/json", ...extra };
  if (HF_TOKEN) {
    h["Authorization"] = `Bearer ${HF_TOKEN}`;
  }
  return h;
}

function buildPromptFromMessages(messages) {
  const lines = [];
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
 * Пробуем разные варианты Gradio API paths.
 * Возвращаем [eventId, usedPath].
 */
async function createGradioTask(prompt) {
  const candidates = [
    "/gradio_api/call/predict",
    "/call/predict",
    "/api/predict",
    "/run/predict",
  ];

  let lastErr = null;

  for (const path of candidates) {
    const url = `${BASE}${path}`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ data: [prompt] }),
      });

      if (res.status === 404) {
        // Этот path не существует — пробуем следующий
        continue;
      }

      if (!res.ok) {
        const text = await res.text();
        lastErr = new Error(`${path} → HTTP ${res.status}: ${text.slice(0, 200)}`);
        continue;
      }

      const data = await res.json();
      if (!data.event_id) {
        lastErr = new Error(`${path} → нет event_id в ответе: ${JSON.stringify(data).slice(0, 200)}`);
        continue;
      }

      return { eventId: data.event_id, path };
    } catch (e) {
      lastErr = new Error(`${path} → ${e.message}`);
    }
  }

  throw new Error(
    `Ни один Gradio endpoint не сработал. Последняя ошибка: ${lastErr?.message || "unknown"}`
  );
}

/**
 * Читает SSE-стрим Gradio и ждёт событие complete.
 * Пробуем path по умолчанию + варианты.
 */
async function waitForGradioResult(eventId, usedPath) {
  // Строим варианты stream URLs на основе использованного POST path
  const streamPaths = [
    `${usedPath}/${eventId}`,
    `/gradio_api/call/predict/${eventId}`,
    `/call/predict/${eventId}`,
  ];
  // Убираем дубликаты
  const uniquePaths = [...new Set(streamPaths)];

  let lastErr = null;

  for (const path of uniquePaths) {
    const url = `${BASE}${path}`;
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: authHeaders({ "Content-Type": undefined }),
      });

      if (res.status === 404) continue;

      if (!res.ok) {
        const text = await res.text();
        lastErr = new Error(`${path} → HTTP ${res.status}: ${text.slice(0, 200)}`);
        continue;
      }

      // Читаем SSE поток
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let result = null;
      let error = null;
      let gotAnyEvent = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() || "";

        for (const block of blocks) {
          gotAnyEvent = true;
          const eventMatch = block.match(/^event:\s*(.+)$/m);
          const dataMatch = block.match(/^data:\s*(.+)$/m);

          if (eventMatch && eventMatch[1].trim() === "error") {
            error = dataMatch ? dataMatch[1].trim() : "unknown error";
            break;
          }
          if (eventMatch && eventMatch[1].trim() === "complete") {
            if (!dataMatch) {
              result = "";
            } else {
              try {
                const payload = JSON.parse(dataMatch[1].trim());
                if (Array.isArray(payload) && payload.length > 0) {
                  result = payload[0];
                } else {
                  result = String(payload);
                }
              } catch {
                result = dataMatch[1].trim();
              }
            }
            break;
          }
        }
        if (error || result !== null) break;
      }

      if (!gotAnyEvent) {
        // Поток пустой — пробуем следующий path
        lastErr = new Error(`${path} → пустой SSE поток`);
        continue;
      }

      if (error) throw new Error(`Gradio error: ${error}`);
      if (result === null) {
        lastErr = new Error(`${path} → нет события complete`);
        continue;
      }
      return result;
    } catch (e) {
      lastErr = e;
    }
  }

  throw new Error(
    `Не удалось получить результат Gradio. Последняя ошибка: ${lastErr?.message || "unknown"}`
  );
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
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

    const prompt = buildPromptFromMessages(messages);
    const { eventId, path: usedPath } = await createGradioTask(prompt);
    const fullText = await waitForGradioResult(eventId, usedPath);

    if (!fullText || !fullText.trim()) {
      throw new Error("Модель вернула пустой ответ");
    }

    // Эмуляция стриминга для UX
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
