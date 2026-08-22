# Sonexa ASR Integration Guide

## Endpoint

```text
POST https://cartik-sonexa-1-asr.hf.space/predict
```

Content type:

```text
multipart/form-data
```

Fields:

```text
audio=<binary audio file>
language=Russian
```

## Frontend integration

Не отправляйте аудио как JSON или Base64 без необходимости. Используйте `FormData`, чтобы браузер отправил файл как multipart upload.

```js
async function transcribeAudio(file, language = "Russian") {
  const form = new FormData();
  form.append("audio", file, file.name || "audio.wav");
  form.append("language", language);

  const response = await fetch(
    "https://cartik-sonexa-1-asr.hf.space/predict",
    {
      method: "POST",
      body: form,
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || data.error || `HTTP ${response.status}`);
  }

  return data.text;
}
```

## Node.js backend / proxy

```js
export async function sonexaASR(fileBuffer, filename, language = "Russian") {
  const form = new FormData();

  form.append(
    "audio",
    new Blob([fileBuffer], { type: "audio/wav" }),
    filename || "audio.wav"
  );

  form.append("language", language);

  const response = await fetch(
    "https://cartik-sonexa-1-asr.hf.space/predict",
    {
      method: "POST",
      body: form,
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || `HTTP ${response.status}`);
  }

  return data;
}
```

## Рекомендуемая обработка ошибок

- `400` — проверьте, что поле называется `audio` и файл не пустой.
- `413` — уменьшите размер файла до 25 MB или меньше.
- `503` — модель недоступна или ещё загружается. Повторите запрос после проверки `/health`.
- `500` — смотрите ответ API и логи Space.

Для долгих запросов на стороне своего backend не ставьте слишком маленький timeout. CPU-инференс ASR может занимать заметное время.

## Проверка перед интеграцией

```bash
curl -i https://cartik-sonexa-1-asr.hf.space/health
```

Затем:

```bash
curl -i -X POST \
  https://cartik-sonexa-1-asr.hf.space/predict \
  -F "audio=@speech.wav" \
  -F "language=Russian"
```

## Формат ответа

```json
{
  "text": "Распознанная речь",
  "language": "Russian",
  "model": "Cartik/Sonexa-1-ASR"
}
```

## Важно

Клиентский код должен обращаться к `/predict` напрямую. Старую схему с `/gradio_api/upload`, `/gradio_api/call/predict` и SSE не используйте для новой интеграции.
