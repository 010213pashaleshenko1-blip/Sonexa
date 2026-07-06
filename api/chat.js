/**
 * Sonexa Assistant — chat API (Gradio ChatInterface SSE streaming)
 *
 * Backend: приватный HF Space Cartik/Sonexa-AQ-Server
 * URL: https://cartik-sonexa-aq-server.hf.space
 *
 * Space использует gr.ChatInterface с api_name="predict":
 *   def respond(message, history, system_message, max_tokens, temperature, top_p)
 *
 * Поэтому payload для /call/predict:
 *   data: [message_string, [[user, bot], ...], system_string, max_tokens, temperature, top_p]
 *
 * Стратегия:
 *   1. POST {BASE}/call/predict с Authorization: Bearer HF_TOKEN
 *      body: { data: [message, history, system_msg, 512, 0.7, 0.9] }
 *      → { event_id }
 *   2. GET {BASE}/call/predict/{event_id} (с Authorization)
 *      → SSE stream, ждём event: complete
 *      data: [response_text]
 */

const HF_TOKEN = (process.env.HF_TOKEN || "").trim();
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

/**
 * Преобразуем наши messages [{role, content}] в Gradio history format:
 * [[user_msg, bot_msg], [user_msg, bot_msg], ...]
 * Последнее user-сообщение становится message-аргументом.
 */
function convertMessagesToGradio(messages) {
  const history = [];
  let lastUserMessage = "";

  // Фильтруем только user/assistant
  const filtered = messages.filter(m => m.role === "user" || m.role === "assistant");

  // Идём парами: user + assistant
  for (let i = 0; i < filtered.length; i++) {
    const m = filtered[i];
    if (m.role === "user") {
      // Если следующее — assistant, образуют пару
      if (i + 1 < filtered.length && filtered[i + 1].role === "assistant") {
        history.push([m.content, filtered[i + 1].content]);
        i++; // пропускаем assistant
      } else {
        // User без ответа — это текущее сообщение
        lastUserMessage = m.content;
      }
    }
  }

  // Если последнее сообщение — user без пары, это наш message
  if (filtered.length > 0 && filtered[filtered.length - 1].role === "user") {
    lastUserMessage = filtered[filtered.length - 1].content;
    // Убираем его из history (он уже в history как непарный — нужно убрать)
    // На самом деле, в нашем цикле он не попал в history (т.к. нет следующего assistant)
    // так что lastUserMessage уже установлен корректно
  }

  // Если history содержит lastUserMessage как непарный — оставляем только пары
  // (наш цикл уже это сделал правильно)

  return { message: lastUserMessage, history };
}

/**
 * Проверяем валидность HF_TOKEN через HF whoami API.
 * Также проверяем, есть ли у токена доступ к конкретному Space.
 */
async function verifyToken() {
  const result = { valid: false, user: null, spaceAccess: null, error: null };

  // 1. Проверяем токен через whoami
  try {
    const res = await fetch("https://huggingface.co/api/whoami-v2", {
      headers: { "Authorization": `Bearer ${HF_TOKEN.trim()}` },
    });
    if (res.ok) {
      const data = await res.json();
      result.valid = true;
      result.user = data.name || data.fullname || "unknown";
    } else {
      result.error = `whoami → ${res.status}`;
      return result;
    }
  } catch (e) {
    result.error = `whoami exception: ${e.message}`;
    return result;
  }

  // 2. Проверяем доступ к Space
  try {
    const res = await fetch(`https://huggingface.co/api/spaces/Cartik/Sonexa-AQ-Server`, {
      headers: { "Authorization": `Bearer ${HF_TOKEN.trim()}` },
    });
    if (res.ok) {
      const data = await res.json();
      result.spaceAccess = {
        status: "ok",
        runtime: data.runtime?.stage || "unknown",
        hardware: data.runtime?.hardware?.current || "unknown",
      };
    } else {
      result.spaceAccess = { status: `error ${res.status}` };
    }
  } catch (e) {
    result.spaceAccess = { status: `exception: ${e.message}` };
  }

  return result;
}

/**
 * Диагностика: проверяем, что HF_TOKEN доходит до Space.
 */
async function diagnoseSpace() {
  // Сначала проверяем токен через HF API
  const tokenInfo = await verifyToken();

  const diagPaths = [
    "/gradio_api/heartbeat",
    "/config",
    "/",
  ];
  const results = [
    `token: ${tokenInfo.valid ? `valid (${tokenInfo.user})` : `INVALID (${tokenInfo.error})`}`,
    `space: ${tokenInfo.spaceAccess ? JSON.stringify(tokenInfo.spaceAccess) : "no info"}`,
  ];

  for (const path of diagPaths) {
    try {
      // Пробуем с Authorization header
      const res = await fetch(`${BASE}${path}`, {
        method: "GET",
        headers: { "Authorization": `Bearer ${HF_TOKEN.trim()}` },
      });
      const body = await res.text();
      const isHtml404 = body.includes("<!DOCTYPE html>") && res.status === 404;
      results.push(
        `${path} → ${res.status}${isHtml404 ? " (HF 404 page)" : ""}` +
        (res.status !== 200 ? `, body[0:80]: ${body.slice(0, 80)}` : "")
      );
      if (res.status === 200) break;

      // Если 404 — пробуем с ?token= query param (альтернативный метод)
      if (res.status === 404) {
        const res2 = await fetch(`${BASE}${path}?token=${encodeURIComponent(HF_TOKEN.trim())}`, {
          method: "GET",
        });
        results.push(`${path}?token=... → ${res2.status}`);
        if (res2.status === 200) break;
      }
    } catch (e) {
      results.push(`${path} → exception: ${e.message}`);
    }
  }

  return results;
}

/**
 * POST to /call/predict с правильным ChatInterface payload.
 */
async function createGradioTask(message, history) {
  const candidates = [
    "/call/predict",
    "/gradio_api/call/predict",
    "/api/predict",
  ];

  const attempts = [];
  let lastErr = null;

  for (const path of candidates) {
    const url = `${BASE}${path}`;
    try {
      const body = JSON.stringify({
        data: [
          message,           // message: str
          history,           // history: [[user, bot], ...]
          SYSTEM_PROMPT,     // system_message: str
          512,               // max_tokens
          0.7,               // temperature
          0.9,               // top_p
        ],
      });

      const res = await fetch(url, {
        method: "POST",
        headers: authHeaders(),
        body,
      });

      const text = await res.text();
      attempts.push(`${path} → ${res.status}`);

      if (res.status === 404) continue;

      if (!res.ok) {
        lastErr = new Error(`${path} → HTTP ${res.status}: ${text.slice(0, 300)}`);
        continue;
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        lastErr = new Error(`${path} → невалидный JSON: ${text.slice(0, 300)}`);
        continue;
      }

      if (!data.event_id) {
        lastErr = new Error(`${path} → нет event_id: ${JSON.stringify(data).slice(0, 300)}`);
        continue;
      }

      return { eventId: data.event_id, path };
    } catch (e) {
      attempts.push(`${path} → exception: ${e.message}`);
      lastErr = new Error(`${path} → ${e.message}`);
    }
  }

  const all404 = attempts.every(a => a.includes("→ 404"));
  if (all404) {
    // Запускаем диагностику, чтобы понять, что происходит с Space
    const diagResults = await diagnoseSpace();
    throw new Error(
      `Space ${BASE} не отвечает на API endpoints (все predict вернули 404). ` +
      `Диагностика: [${diagResults.join(" | ")}]. ` +
      `Если даже /gradio_api/heartbeat возвращает 404 — Space сломан (модель не загрузилась). ` +
      `Зайди на huggingface.co/spaces/Cartik/Sonexa-AQ-Server и проверь логи в "Logs". ` +
      `Возможные причины: 1) Модель не загрузилась (OOM), 2) Build error, 3) Space paused.`
    );
  }

  throw new Error(
    `Gradio API не сработал. Попытки: ${attempts.join(" | ")}. Последняя ошибка: ${lastErr?.message || "unknown"}`
  );
}

/**
 * Читает SSE-стрим Gradio и стримит промежуточные события клиенту.
 *
 * Gradio отправляет 3 типа событий:
 *   event: generating  data: [response_so_far]   ← промежуточный (стриминг!)
 *   event: complete    data: [final_response]      ← финальный
 *   event: error       data: "error message"       ← ошибка
 *
 * onChunk(content) вызывается при каждом generating событии.
 */
async function streamGradioResult(eventId, usedPath, onChunk) {
  const streamPaths = [
    `${usedPath}/${eventId}`,
    `/gradio_api/call/predict/${eventId}`,
  ];
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
          const eventName = eventMatch ? eventMatch[1].trim() : null;
          const dataStr = dataMatch ? dataMatch[1].trim() : null;

          if (eventName === "error") {
            error = dataStr || "unknown error";
            break;
          }

          if (eventName === "generating" && dataStr) {
            // Промежуточный результат — стримим!
            try {
              const payload = JSON.parse(dataStr);
              if (Array.isArray(payload) && payload.length > 0) {
                const content = payload[0];
                if (typeof content === "string" && content) {
                  onChunk(content);
                }
              }
            } catch {
              // payload может быть невалидным JSON на промежуточных шагах — игнорируем
            }
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

      if (!gotAnyEvent) {
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
    `Не удалось получить результат. Последняя ошибка: ${lastErr?.message || "unknown"}`
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
      error: "HF_TOKEN не настроен на сервере. Добавь его в Vercel Environment Variables (Settings → Environment Variables → HF_TOKEN).",
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
    // Явно сообщаем клиенту, что токен настроен (для отладки)
    send({ status: "started", model: "sonexa", tokenConfigured: true });

    // Преобразуем messages → Gradio format
    const { message, history } = convertMessagesToGradio(messages);
    if (!message) {
      throw new Error("Не найдено user-сообщение для отправки");
    }

    // Создаём задачу
    const { eventId, path: usedPath } = await createGradioTask(message, history);

    // Стримим результат: каждый generating-чанк сразу отправляем клиенту
    let lastSentContent = "";
    let finalContent = "";

    finalContent = await streamGradioResult(eventId, usedPath, (content) => {
      // Gradio отдаёт накопленный контент (всё больше и больше)
      // Отправляем только если контент изменился
      if (content !== lastSentContent) {
        lastSentContent = content;
        send({ status: "chunk", content });
      }
    });

    // Финальный ответ
    const finalText = finalContent || lastSentContent;
    if (!finalText || !finalText.trim()) {
      throw new Error("Модель вернула пустой ответ");
    }

    send({ status: "done", content: finalText });
  } catch (err) {
    send({ status: "error", error: err.message || "Unknown error" });
  } finally {
    res.end();
  }
}
