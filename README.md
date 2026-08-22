# Sonexa

Sonexa is an AI service with speech recognition and other model APIs.

## Documentation

### ASR

- [ASR API](docs/API.md) — endpoints, request format, responses and errors.
- [Quickstart](docs/QUICKSTART.md) — запуск за несколько минут, cURL, browser JavaScript и Python.
- [Integration Guide](docs/INTEGRATION.md) — подключение ASR к frontend и backend.

## ASR API

Base URL:

```text
https://cartik-sonexa-1-asr.hf.space
```

Main endpoint:

```text
POST /predict
```

Example:

```bash
curl -X POST \
  https://cartik-sonexa-1-asr.hf.space/predict \
  -F "audio=@speech.wav" \
  -F "language=Russian"
```

Response:

```json
{
  "text": "Привет, это Sonexa.",
  "language": "Russian",
  "model": "Cartik/Sonexa-1-ASR"
}
```
