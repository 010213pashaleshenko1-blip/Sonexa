/**
 * Sonexa Assistant — chat API
 *
 * Endpoints:
 *   POST /api/chat
 *     { messages: [{role, content}], model?: "sonexa", temperature?: 0.7, max_tokens?: 1024 }
 *     → { job_id }
 *
 *   GET /api/chat?job_id=xxx
 *     → { status: "running" | "done" | "error", content: string, error?: string }
 *
 * Стратегия стриминга (по требованию пользователя):
 *   - Клиент шлёт POST → сервер стартует фоновую задачу на HF Inference API
 *   - Сервер хранит in-memory job store (для serverless это работает в рамках одного isolate)
 *   - Клиент поллит GET /api/chat?job_id=xxx каждые 500ms
 *   - На сервере: если контент не менялся 2 секунды — считаем что модель дописала, ставим status=done
 *
 * Безопасность:
 *   - HF_TOKEN читается из process.env (Vercel Environment Variables)
 *   - Токен НИКОГДА не возвращается клиенту
 *
 * Model: "Sonexa" — алиас. По умолчанию используется Mistral-7B-Instruct.
 *   Можно переопределить через env HF_CHAT_MODEL.
 */

const HF_TOKEN = process.env.HF_TOKEN || "";
const HF_MODEL = process.env.HF_CHAT_MODEL || "mistralai/Mistral-7B-Instruct-v0.3";

// In-memory job store. В Vercel serverless каждый isolate имеет свой store,
// но запросы одного пользователя обычно попадают в один isolate в течение сессии.
// Для прод-решения стоит использовать Redis/Upstash — но для демо этого достаточно.
const jobs = new Map();

// System prompt для Sonexa Assistant
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

const STALL_TIMEOUT_MS = 2000; // 2 секунды без изменений = модель дописала
const MAX_TOKENS_DEFAULT = 1024;

/**
 * Преобразует messages в chat-формат для HF Inference API.
 */
function buildPrompt(messages) {
  // Готовим полный список с system prompt
  const full = [
    { role: "system", content: SYSTEM_PROMPT },
    ...messages.filter(m => m.role === "user" || m.role === "assistant"),
  ];
  return full;
}

/**
 * Запрос к HF Inference API (text-generation task).
 * Возвращает полный сгенерированный текст.
 */
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
  // HF text-generation возвращает массив объектов с полем generated_text
  if (Array.isArray(data) && data[0]?.generated_text) {
    return data[0].generated_text.trim();
  }
  // Некоторые модели возвращают объект с token-streaming — берём что есть
  if (typeof data === "string") return data.trim();
  if (data.generated_text) return data.generated_text.trim();
  throw new Error("Unexpected HF response format");
}

/**
 * Фоновая задача: вызывает HF API, обновляет job по мере "стриминга".
 * Поскольку HF Inference API не стримит через этот endpoint, мы симулируем
 * постепенное появление текста — но это даёт стабильный polling UX.
 */
async function runJob(jobId, messages, options) {
  const job = jobs.get(jobId);
  if (!job) return;

  job.status = "running";
  job.startedAt = Date.now();

  try {
    // Полный запрос к HF
    const fullText = await callHFInference(messages, options);

    // Симулируем стриминг: показываем текст постепенно, по словам
    const words = fullText.split(/(\s+)/); // сохраняем пробелы
    let accumulated = "";

    for (let i = 0; i < words.length; i++) {
      accumulated += words[i];
      job.content = accumulated;
      job.lastUpdateAt = Date.now();
      // Небольшая задержка для эффекта стриминга
      await new Promise(r => setTimeout(r, 30));
    }

    job.content = fullText;
    job.status = "done";
    job.finishedAt = Date.now();
  } catch (err) {
    job.status = "error";
    job.error = err.message || "Unknown error";
    job.finishedAt = Date.now();
  }
}

/**
 * Очистка старых завершённых задач (раз в 5 минут).
 */
function cleanupOldJobs() {
  const now = Date.now();
  const TTL = 30 * 60 * 1000; // 30 минут
  for (const [id, job] of jobs) {
    if (job.finishedAt && now - job.finishedAt > TTL) {
      jobs.delete(id);
    }
  }
}

// CORS headers
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(res, status, body) {
  return res.status(status).json(body);
}

export default async function handler(req, res) {
  // CORS preflight
  if (req.method === "OPTIONS") {
    Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(204).end();
  }
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));

  // Periodic cleanup
  cleanupOldJobs();

  // GET — polling статуса задачи
  if (req.method === "GET") {
    const { job_id } = req.query;
    if (!job_id) {
      return json(res, 400, { error: "job_id required" });
    }
    const job = jobs.get(job_id);
    if (!job) {
      return json(res, 404, { error: "job not found (возможно, истёк или isolate перезапущен)" });
    }

    // Проверяем stall: если running и контент не менялся > STALL_TIMEOUT_MS
    if (job.status === "running" && job.lastUpdateAt) {
      const stallMs = Date.now() - job.lastUpdateAt;
      if (stallMs > STALL_TIMEOUT_MS && job.content) {
        // Модель дописала — фиксируем done
        job.status = "done";
        job.finishedAt = Date.now();
      }
    }

    return json(res, 200, {
      status: job.status,
      content: job.content || "",
      error: job.error || null,
      startedAt: job.startedAt || null,
      finishedAt: job.finishedAt || null,
    });
  }

  // POST — запуск новой задачи
  if (req.method === "POST") {
    if (!HF_TOKEN) {
      return json(res, 500, {
        error: "HF_TOKEN не настроен на сервере. Добавь его в Vercel Environment Variables.",
      });
    }

    const { messages, temperature, max_tokens } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return json(res, 400, { error: "messages array required" });
    }

    // Валидация
    const valid = messages.every(
      m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string"
    );
    if (!valid) {
      return json(res, 400, { error: "each message must have {role, content}" });
    }

    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    jobs.set(jobId, {
      status: "queued",
      content: "",
      error: null,
      createdAt: Date.now(),
      startedAt: null,
      finishedAt: null,
      lastUpdateAt: null,
    });

    // Запускаем в фоне (не await)
    runJob(jobId, messages, { temperature, max_tokens }).catch(err => {
      const job = jobs.get(jobId);
      if (job) {
        job.status = "error";
        job.error = err.message;
        job.finishedAt = Date.now();
      }
    });

    return json(res, 200, {
      job_id: jobId,
      model: "sonexa",
      backend_model: HF_MODEL,
      poll_interval_ms: 500,
      stall_timeout_ms: STALL_TIMEOUT_MS,
    });
  }

  return json(res, 405, { error: "Method not allowed" });
}
