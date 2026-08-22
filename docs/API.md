# Sonexa ASR API

Sonexa ASR предоставляет HTTP API для преобразования речи в текст.

## Base URL

```text
https://cartik-sonexa-1-asr.hf.space
```

## Endpoints

| Method | Endpoint | Назначение |
|---|---|---|
| GET | `/health` | Проверка состояния модели |
| GET | `/api/status` | Информация о сервисе |
| POST | `/predict` | Распознавание аудио |
|
## POST /predict

Отправьте `multipart/form-data` с двумя полями:

- `audio` — аудиофайл.
- `language` — язык распознавания. По умолчанию `Russian`.

Поддерживаются обычные аудиоформаты, например WAV, MP3, OGG и WEBM, при условии что окружение Space может декодировать файл.

### Успешный ответ

```json
{
  "text": "Привет, это тест Sonexa.",
  "language": "Russian",
  "model": "Cartik/Sonexa-1-ASR"
}
```

### Ошибки

| HTTP | Значение |
|---:|---|
| 400 | Не указан файл или файл пустой |
| 413 | Файл больше 25 MB |
| 503 | Модель ещё загружается или не загрузилась |
| 500 | Внутренняя ошибка обработки |

### Пример cURL

```bash
curl -X POST \
  https://cartik-sonexa-1-asr.hf.space/predict \
  -F "audio=@speech.wav" \
  -F "language=Russian"
```

### Пример JavaScript

```js
const form = new FormData();
form.append("audio", file);
form.append("language", "Russian");

const response = await fetch(
  "https://cartik-sonexa-1-asr.hf.space/predict",
  {
    method: "POST",
    body: form,
  }
);

if (!response.ok) {
  throw new Error(`Sonexa ASR HTTP ${response.status}`);
}

const result = await response.json();
console.log(result.text);
```

### Пример Python

```python
import requests

url = "https://cartik-sonexa-1-asr.hf.space/predict"

with open("speech.wav", "rb") as audio_file:
    response = requests.post(
        url,
        files={"audio": ("speech.wav", audio_file, "audio/wav")},
        data={"language": "Russian"},
        timeout=300,
    )

response.raise_for_status()
print(response.json()["text"])
```

## GET /health

Проверяет, загружена ли модель.

```bash
curl https://cartik-sonexa-1-asr.hf.space/health
```

Когда модель готова, API возвращает примерно:

```json
{
  "status": "ok",
  "model_loaded": true,
  "model": "Cartik/Sonexa-1-ASR",
  "device": "cpu"
}
```

Если модель ещё не готова или произошла ошибка загрузки, endpoint возвращает HTTP `503`.

## Важно для интеграции

Не используйте Gradio SSE API напрямую для интеграции приложения. Для клиентских приложений используйте стабильный endpoint `/predict`.

Пример архитектуры:

```text
Your app
   |
   | multipart/form-data
   v
POST /predict
   |
   v
Sonexa ASR Space
   |
   v
Qwen3ASRModel
   |
   v
JSON response
```
