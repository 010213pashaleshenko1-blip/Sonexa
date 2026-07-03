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

const ICONS = {
  idle: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  `,
  busy: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M21 12a9 9 0 1 1-3.1-6.8" />
      <path d="M21 3v6h-6" />
    </svg>
  `,
  success: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="m20 6-11 11-5-5" />
    </svg>
  `,
  error: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  `,
};

const DEFAULT_STATUS = {
  title: 'Готово',
  message: 'Введи текст и нажми кнопку, чтобы создать речь',
};

function escapeHTML(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function setStatus(type, title, message) {
  const status = statusSection.querySelector('.status');
  if (!status) return;

  status.className = `status ${type}`;
  const icon = ICONS[type] || ICONS.idle;

  status.innerHTML = `
    <span class="status-icon" aria-hidden="true">${icon}</span>
    <div class="status-content">
      <div class="status-title">${escapeHTML(title)}</div>
      <div class="status-message">${escapeHTML(message)}</div>
    </div>
  `;
}

function updateCharCount() {
  if (charCount) {
    charCount.textContent = String(textInput.value.length);
  }
}

function setPage(page) {
  document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
  const nextPage = document.getElementById(`${page}-page`);
  if (nextPage) nextPage.classList.add('active');

  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.page === page);
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setActiveTab(tab) {
  document.querySelectorAll('.tab-btn').forEach((btn) => btn.classList.remove('active'));
  document.querySelectorAll('.panel').forEach((panel) => {
    panel.style.display = 'none';
  });

  const activeBtn = document.querySelector(`.tab-btn[data-tab="${tab}"]`);
  if (activeBtn) activeBtn.classList.add('active');

  const activePanel = document.getElementById(`${tab}-panel`);
  if (activePanel) activePanel.style.display = 'block';
}

function safeJSONParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// Переключение страниц
document.querySelectorAll('.nav-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const page = btn.dataset.page;
    if (!page) return;
    setPage(page);
  });
});

// Переключение вкладок TTS/STT
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (btn.classList.contains('disabled')) return;
    const tab = btn.dataset.tab;
    if (!tab) return;
    setActiveTab(tab);
  });
});

// Счётчик символов
textInput.addEventListener('input', updateCharCount);
updateCharCount();

// Инициализация статуса
setStatus('idle', DEFAULT_STATUS.title, DEFAULT_STATUS.message);
setPage('main');
setActiveTab('tts');

// Кнопка генерирования речи
generateBtn.addEventListener('click', async () => {
  const text = textInput.value.trim();
  const voice = voiceSelect.value;

  if (!text) {
    setStatus('error', 'Пусто', 'Пожалуйста, введи текст для озвучки');
    textInput.focus();
    return;
  }

  generateBtn.disabled = true;
  playerSection.style.display = 'none';
  setStatus('busy', 'Создаём речь', 'Пожалуйста, подожди — это может занять несколько секунд');

  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice }),
    });

    const raw = await res.text();
    const data = safeJSONParse(raw) || {};

    if (!res.ok) {
      throw new Error(data?.error || 'Ошибка при создании речи');
    }

    if (!data.audio_url) {
      throw new Error('Нет URL аудиофайла в ответе');
    }

    audioElement.src = data.audio_url;
    playerSection.style.display = 'block';
    playerSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    try {
      await audioElement.play();
    } catch {
      // Автовоспроизведение может быть заблокировано браузером — это окей.
    }

    setStatus('success', 'Готово!', 'Твоя речь создана и готова к прослушиванию');
  } catch (error) {
    setStatus('error', 'Ошибка', error?.message || 'Произошла неожиданная ошибка');
  } finally {
    generateBtn.disabled = false;
  }
});

// Кнопка скачивания
downloadBtn.addEventListener('click', () => {
  if (!audioElement.src) return;

  const link = document.createElement('a');
  link.href = audioElement.src;
  link.download = `sonexa-speech-${Date.now()}.mp3`;
  document.body.appendChild(link);
  link.click();
  link.remove();
});

// Кнопка копирования ссылки
copyUrlBtn.addEventListener('click', async () => {
  if (!audioElement.src) return;

  const originalHTML = copyUrlBtn.innerHTML;

  try {
    await navigator.clipboard.writeText(audioElement.src);
    copyUrlBtn.innerHTML = '<span class="icon icon-sm" aria-hidden="true">✓</span>Скопировано!';
    setTimeout(() => {
      copyUrlBtn.innerHTML = originalHTML;
    }, 1800);
  } catch {
    setStatus('error', 'Ошибка', 'Не удалось скопировать ссылку');
  }
});

// Кнопка очистки
clearBtn.addEventListener('click', () => {
  textInput.value = '';
  updateCharCount();
  audioElement.src = '';
  playerSection.style.display = 'none';
  setStatus('idle', DEFAULT_STATUS.title, DEFAULT_STATUS.message);
  generateBtn.disabled = false;
  textInput.focus();
});

// Горячая клавиша: Ctrl+Enter для отправки
textInput.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    generateBtn.click();
  }
});