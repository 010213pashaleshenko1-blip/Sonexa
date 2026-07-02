const btn = document.getElementById('generate');
const audio = document.getElementById('audio');
const status = document.getElementById('status');

function setStatus(type, text, loading = false) {
  status.className = `status${type ? ` ${type}` : ''}`;
  status.innerHTML = loading
    ? `<span class="status-spinner" aria-hidden="true"></span><span>${text}</span>`
    : `<span>${text}</span>`;
}

btn.addEventListener('click', async () => {
  const text = document.getElementById('text').value.trim();
  const voice = document.getElementById('voice').value;

  if (!text) {
    setStatus('err', 'Сначала введи текст для озвучки.');
    return;
  }

  btn.disabled = true;
  setStatus('busy', 'Ожидаем TTS-файл... Сейчас модель его готовит.', true);

  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error || 'Ошибка генерации');
    }

    if (data.audio_url) {
      audio.src = data.audio_url;
      await audio.play().catch(() => {});
      setStatus('ok', 'TTS-файл готов. Можно слушать результат.');
    } else {
      throw new Error('HF не вернул аудиофайл');
    }
  } catch (error) {
    setStatus('err', `Ошибка: ${error.message}`);
  } finally {
    btn.disabled = false;
  }
});
