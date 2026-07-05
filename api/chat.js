/**
 * Sonexa Assistant — chat API (SSE streaming)
 *
 * Endpoint:
 *   POST /api/chat
 *     { messages: [{role, content}], model?: "sonexa", temperature?: 0.7, max_tokens?: 1024 }
 *     → text/event-stream
 *       data: {"status":"started"}
 *       data: {"status":"chunk","content":"привет"}
 *       data: {"status":"chunk","content":" мир"}
 *       ...
 *       data: {"status":"done","content":"полный текст"}
 *
 * Стратегия стриминга (требование пользователя):
 *   - Сервер делает запрос к HF Inference API
 *   - HF API отдаёт текст одним куском (не стримит)
 *   - Сервер эмулирует стриминг: разбивает ответ на слова и поэтапно отправляет
 *   - Если контент не менялся 2с — клиент считает что модель дописала
 *   (в нашей реализации сервер сам решает когда done, клиенту не нужно stall detection)
 *
 * Безопасность:
 *   - HF_TOKEN из process.env (Vercel Environment Variables)
 *   - Токен НИКОГДА не возвращается клиенту
 */

const HF_TOKEN = process.env.HF_TOKEN || "";
const HF_MODEL = process.env.HF_CHAT_MODEL || "mistralai/Mistral-7B-Instruct-v0.3";

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

const MAX_TOKENS_DEFAULT = 1024;

function buildPrompt(messages) {
  const full = [
    { role: "system", content: SYSTEM_PROMPT },
    ...messages.filter(m => m.role === "user" || m.role === "assistant"),
  ];
  return full;
}

async function callHFInference(messages, options = {}) {
  const prompt = buildPrompt(messages);
  const temperature = options.temperature ?? 0.7;
  const maxTokens = options.max_tokens ?? MAX_TOKENS_DEFAULT;

  const url = `https://api-inference.huggingface.co/models/${HF_MODEL}`;
  const body = {
    inputs: prompt,
    parameters: {
      temperature,
      max_new_tokens: maxTokens,
      return_full_text: false,
      do_sample: temperature > 0,
    },
    options: {
      wait_for_model: true,
      use_cache: false,
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${HF_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    let msg = `HF API error ${res.status}`;
    try {
      const j = JSON.parse(text);
      if (j.error) msg += `: ${j.error}`;
    } catch {
      if (text) msg += `: ${text.slice(0, 200)}`;
    }
    throw new Error(msg);
  }

  const data = await res.json();
  if (Array.isArray(data) && data[0]?.generated_text) {
    return data[0].generated_text.trim();
  }
  if (typeof data === "string") return data.trim();
  if (data.generated_text) return data.generated_text.trim();
  throw new Error("Unexpected HF response format");
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

  const { messages, temperature, max_tokens } = req.body || {};
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

    const fullText = await callHFInference(messages, { temperature, max_tokens });

    // Эмуляция стриминга: разбиваем на слова, отправляем поэтапно
    // Это даёт эффект "модель набирает текст"
    const tokens = fullText.split(/(\s+)/); // сохраняем пробелы
    let accumulated = "";

    send({ status: "chunk", content: "" });

    for (let i = 0; i < tokens.length; i++) {
      accumulated += tokens[i];
      send({ status: "chunk", content: accumulated });
      // Небольшая задержка — клиент увидит постепенное появление
      await new Promise(r => setTimeout(r, 35));
    }

    send({ status: "done", content: fullText });
  } catch (err) {
    send({ status: "error", error: err.message || "Unknown error" });
  } finally {
    res.end();
  }
}
