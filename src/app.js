const generateBtn = document.getElementById('generate');
const textInput = document.getElementById('text');
const voiceSelect = document.getElementById('voice');
const charCount = document.getElementById('char-count');
const statusSection = document.getElementById('status-section');
const playerSection = document.getElementById('player-section');
const audioElement = document.getElementById('audio');
const downloadBtn = document.getElementById('download-btn');
const copyUrlBtn = document.getElementById('copy-url-btn');
const clearBtn = document.getElementById('clear-btn');

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.classList.contains('disabled')) return;
    
    const tab = btn.dataset.tab;
    
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    // Update panels
    document.querySelectorAll('.panel').forEach(p => p.style.display = 'none');
    document.getElementById(`${tab}-panel`).style.display = 'block';
  });
});

// Character counter
textInput.addEventListener('input', () => {
  charCount.textContent = textInput.value.length;
});

// Set status message
function setStatus(type, title, message) {
  const status = statusSection.querySelector('.status');
  status.className = `status ${type}`;
  
  let icon = '✓';
  if (type === 'busy') icon = '⏳';
  if (type === 'success') icon = '✓';
  if (type === 'error') icon = '✕';
  
  status.innerHTML = `
    <span class="status-icon">${icon}</span>
    <div class="status-content">
      <div class="status-title">${title}</div>
      <div class="status-message">${message}</div>
    </div>
  `;
}

// Initialize status
setStatus('idle', 'Ready', 'Enter text and click generate to create speech');

// Generate button
generateBtn.addEventListener('click', async () => {
  const text = textInput.value.trim();
  const voice = voiceSelect.value;

  if (!text) {
    setStatus('error', 'Empty Text', 'Please enter some text to convert to speech');
    return;
  }

  generateBtn.disabled = true;
  playerSection.style.display = 'none';
  setStatus('busy', 'Generating', 'Creating your speech... This may take a few seconds');

  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error || 'Failed to generate speech');
    }

    if (data.audio_url) {
      audioElement.src = data.audio_url;
      playerSection.style.display = 'block';
      playerSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      
      await audioElement.play().catch(() => {});
      setStatus('success', 'Complete', 'Your speech is ready to play!');
    } else {
      throw new Error('No audio URL returned');
    }
  } catch (error) {
    setStatus('error', 'Error', error.message || 'An unexpected error occurred');
  } finally {
    generateBtn.disabled = false;
  }
});

// Download button
downloadBtn.addEventListener('click', () => {
  if (audioElement.src) {
    const a = document.createElement('a');
    a.href = audioElement.src;
    a.download = `sonexa-speech-${new Date().getTime()}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
});

// Copy URL button
copyUrlBtn.addEventListener('click', () => {
  if (audioElement.src) {
    navigator.clipboard.writeText(audioElement.src).then(() => {
      const originalText = copyUrlBtn.textContent;
      copyUrlBtn.textContent = '✓ Copied!';
      setTimeout(() => {
        copyUrlBtn.innerHTML = '<span class="btn-icon">🔗</span>Copy URL';
      }, 2000);
    });
  }
});

// Clear button
clearBtn.addEventListener('click', () => {
  textInput.value = '';
  charCount.textContent = '0';
  audioElement.src = '';
  playerSection.style.display = 'none';
  setStatus('idle', 'Ready', 'Enter text and click generate to create speech');
  generateBtn.disabled = false;
  textInput.focus();
});

// Allow Enter+Ctrl to submit
textInput.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    generateBtn.click();
  }
});
