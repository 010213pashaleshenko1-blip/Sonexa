const btn = document.getElementById('generate');
const audio = document.getElementById('audio');
const textInput = document.getElementById('text');
const charCount = document.getElementById('char-count');
const statusContainer = document.getElementById('status-container');
const playerSection = document.getElementById('player-section');
const downloadBtn = document.getElementById('download-btn');
const clearBtn = document.getElementById('clear-btn');

// Character counter
textInput.addEventListener('input', () => {
  charCount.textContent = textInput.value.length;
  if (textInput.value.length > 2000) {
    textInput.value = textInput.value.substring(0, 2000);
    charCount.textContent = '2000';
  }
});

function setStatus(type, text) {
  const statusDiv = statusContainer.querySelector('.status');
  statusDiv.className = `status ${type}`;
  
  let icon = '✓';
  if (type === 'busy') icon = '⏳';
  if (type === 'success') icon = '✓';
  if (type === 'error') icon = '✕';
  
  statusDiv.innerHTML = `<span class="status-icon">${icon}</span><span class="status-text">${text}</span>`;
}

btn.addEventListener('click', async () => {
  const text = textInput.value.trim();
  const voice = document.getElementById('voice').value;

  if (!text) {
    setStatus('error', 'Please enter some text to convert to speech');
    return;
  }

  btn.disabled = true;
  setStatus('busy', 'Generating your speech...');
  playerSection.style.display = 'none';

  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error || 'Generation failed');
    }

    if (data.audio_url) {
      audio.src = data.audio_url;
      playerSection.style.display = 'block';
      await audio.play().catch(() => {});
      setStatus('success', 'Your speech is ready!');
    } else {
      throw new Error('No audio returned');
    }
  } catch (error) {
    setStatus('error', `Error: ${error.message}`);
  } finally {
    btn.disabled = false;
  }
});

// Download button
downloadBtn.addEventListener('click', () => {
  if (audio.src) {
    const a = document.createElement('a');
    a.href = audio.src;
    a.download = 'speech.mp3';
    a.click();
  }
});

// Clear button
clearBtn.addEventListener('click', () => {
  textInput.value = '';
  charCount.textContent = '0';
  audio.src = '';
  playerSection.style.display = 'none';
  setStatus('idle', 'Ready to generate');
  btn.disabled = false;
});

// Initialize
setStatus('idle', 'Ready to generate');
