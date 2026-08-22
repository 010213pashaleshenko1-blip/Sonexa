# Sonexa ASR Quickstart

Этот гайд показывает минимальный путь от аудиофайла до распознанного текста.

## 1. Проверить API

```bash
curl https://cartik-sonexa-1-asr.hf.space/health
```

Нужен ответ со `status: "ok"` и `model_loaded: true`.

## 2. Отправить аудио

```bash
curl -X POST \
  https://cartik-sonexa-1-asr.hf.space/predict \
  -F "audio=@speech.wav" \
  -F "language=Russian"
```

## 3. Получить текст

Ответ:

```json
{
  "text": "Привет, это мой тест.",
  "language": "Russian",
  "model": "Cartik/Sonexa-1-ASR"
}
```

Используйте значение `text` в своём приложении.

## Browser / JavaScript

```html
<input id="audio" type="file" accept="audio/*" />
<button id="send">Recognize</button>
<pre id="result"></pre>

<script>
const input = document.getElementById("audio");
const button = document.getElementById("send");
const result = document.getElementById("result");

button.addEventListener("click", async () => {
  const file = input.files[0];

  if (!file) {
    result.textContent = "Select an audio file first.";
    return;
  }

  const form = new FormData();
  form.append("audio", file);
  form.append("language", "Russian");

  result.textContent = "Recognizing...";

  try {
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

    result.textContent = data.text;
  } catch (error) {
    result.textContent = `ASR error: ${error.message}`;
  }
});
</script>
```

## Python

Установите `requests`:

```bash
pip install requests
```

Затем:

```python
import requests

with open("speech.wav", "rb") as audio:
    response = requests.post(
        "https://cartik-sonexa-1-asr.hf.space/predict",
        files={"audio": ("speech.wav", audio, "audio/wav")},
        data={"language": "Russian"},
        timeout=300,
    )

response.raise_for_status()
print(response.json()["text"])
```

## Другой язык

Просто измените поле `language`:

```text
English
Russian
```

Например:

```bash
-F "language=English"
```

## Если получили 503

`503 Service Unavailable` обычно означает, что Space ещё загружает модель либо загрузка модели завершилась ошибкой.

Проверьте:

```bash
curl https://cartik-sonexa-1-asr.hf.space/health
```

И логи Hugging Face Space.

## Если получили 404

Проверьте, что используется именно:

```text
POST /predict
```

а не старый Gradio endpoint `/gradio_api/call/predict`.
