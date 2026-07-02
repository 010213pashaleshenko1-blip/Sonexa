// DOM элементы
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

// Переключение страниц
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const page = btn.dataset.page;
    
    // Скрыть все страницы
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    
    // Показать нужную страницу
    document.getElementById(`${page}-page`).classList.add('active');
    
    // Прокрутить вверх
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
});

// Переключение вкладок TTS/STT
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.classList.contains('disabled')) return;
    
    const tab = btn.dataset.tab;
    
    // Обновить кнопки вкладок
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    // Обновить панели
    document.querySelectorAll('.panel').forEach(p => p.style.display = 'none');
    document.getElementById(`${tab}-panel`).style.display = 'block';
  });
});

// Счётчик символов
textInput.addEventListener('input', () => {
  charCount.textContent = textInput.value.length;
});

// Установить статус
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

// Инициализация статуса
setStatus('idle', 'Готово', 'Введи текст и нажми кнопку, чтобы создать речь');

// Кнопка генерирования речи
generateBtn.addEventListener('click', async () => {
  const text = textInput.value.trim();
  const voice = voiceSelect.value;

  if (!text) {
    setStatus('error', 'Пусто', 'Пожалуйста, введи текст для озвучки');
    return;
  }

  generateBtn.disabled = true;
  playerSection.style.display = 'none';
  setStatus('busy', 'Создаём речь', 'Пожалуйста, подожди... это может занять несколько секунд');

  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error || 'Ошибка при создании речи');
    }

    if (data.audio_url) {
      audioElement.src = data.audio_url;
      playerSection.style.display = 'block';
      playerSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      
      await audioElement.play().catch(() => {});
      setStatus('success', 'Готово!', 'Твоя речь создана и готова к прослушиванию');
    } else {
      throw new Error('Нет URL аудиофайла в ответе');
    }
  } catch (error) {
    setStatus('error', 'Ошибка', error.message || 'Произошла неожиданная ошибка');
  } finally {
    generateBtn.disabled = false;
  }
});

// Кнопка скачивания
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

// Кнопка копирования ссылки
copyUrlBtn.addEventListener('click', () => {
  if (audioElement.src) {
    navigator.clipboard.writeText(audioElement.src).then(() => {
      const originalHTML = copyUrlBtn.innerHTML;
      copyUrlBtn.innerHTML = '<span class="btn-icon">✓</span>Скопировано!';
      setTimeout(() => {
        copyUrlBtn.innerHTML = originalHTML;
      }, 2000);
    }).catch(() => {
      setStatus('error', 'Ошибка', 'Не удалось скопировать ссылку');
    });
  }
});

// Кнопка очистки
clearBtn.addEventListener('click', () => {
  textInput.value = '';
  charCount.textContent = '0';
  audioElement.src = '';
  playerSection.style.display = 'none';
  setStatus('idle', 'Готово', 'Введи текст и нажми кнопку, чтобы создать речь');
  generateBtn.disabled = false;
  textInput.focus();
});

// Горячая клавиша: Ctrl+Enter для отправки
textInput.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    generateBtn.click();
  }
});
