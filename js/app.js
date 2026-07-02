const btn = document.getElementById('generate');
const audio = document.getElementById('audio');

btn.addEventListener('click', async () => {
  const text = document.getElementById('text').value;
  const voice = document.getElementById('voice').value;

  const res = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice })
  });

  const data = await res.json();

  if (data.audio_url) {
    audio.src = data.audio_url;
    audio.play();
  } else {
    alert('Ошибка генерации');
  }
});