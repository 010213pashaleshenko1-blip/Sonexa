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

const menuToggle = document.getElementById('menu-toggle');
const navDrawer = document.getElementById('nav-drawer');
const overlay = document.getElementById('overlay');

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

function safeJSONParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function closeMenu() {
  if (!navDrawer || !overlay || !menuToggle) return;

  navDrawer.classList.remove('open');
  overlay.classList.remove('open');
  navDrawer.setAttribute('aria-hidden', 'true');
  menuToggle.setAttribute('aria-expanded', 'false');
  document.body.style.overflow = '';
}

function openMenu() {
  if (!navDrawer || !overlay || !menuToggle) return;

  navDrawer.classList.add('open');
  overlay.classList.add('open');
  navDrawer.setAttribute('aria-hidden', 'false');
  menuToggle.setAttribute('aria-expanded', 'true');
  document.body.style.overflow = 'hidden';
}

function toggleMenu() {
  if (navDrawer?.classList.contains('open')) {
    closeMenu();
  } else {
    openMenu();
  }
}

function setStatus(type, title, message) {
  const status = statusSection?.querySelector('.status');
  if (!status) return;

  const icons = {
    idle: '✓',
    busy: '⏳',
    success: '✓',
    error: '✕',
  };

  status.className = `status ${type}`;
  status.innerHTML = `
    <span class="status-icon" aria-hidden="true">${icons[type] || icons.idle}</span>
    <div class="status-content">
      <div class="status-title">${escapeHTML(title)}</div>
      <div class="status-message">${escapeHTML(message)}</div>
    </div>
  `;
}

function updateCharCount() {
  if (charCount && textInput) {
    charCount.textContent = String(textInput.value.length);
  }
}

function updateNavState(page) {
  document.querySelectorAll('.nav-btn[data-page]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.page === page);
  });
}

function injectHomeAnimations() {
  if (document.getElementById('sonexa-home-animations')) return;

  const style = document.createElement('style');
  style.id = 'sonexa-home-animations';
  style.textContent = `
    .welcome-card {
      position: relative;
      overflow: hidden;
      isolation: isolate;
    }

    .welcome-card::before,
    .welcome-card::after {
      content: "";
      position: absolute;
      inset: auto;
      border-radius: 999px;
      pointer-events: none;
      z-index: -1;
      filter: blur(26px);
      opacity: 0.8;
      animation: sonexa-orb-float 10s ease-in-out infinite;
    }

    .welcome-card::before {
      width: 18rem;
      height: 18rem;
      top: -4rem;
      right: -3rem;
      background: radial-gradient(circle, rgba(245, 158, 11, 0.18), rgba(245, 158, 11, 0));
    }

    .welcome-card::after {
      width: 14rem;
      height: 14rem;
      bottom: -4rem;
      left: -2rem;
      background: radial-gradient(circle, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0));
      animation-delay: -4s;
    }

    .welcome-greeting {
      background: linear-gradient(135deg, rgba(217, 119, 6, 0.22), rgba(255, 255, 255, 0.08));
      color: #f8d08a;
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.05) inset, 0 14px 30px rgba(0, 0, 0, 0.18);
    }

    .welcome-copy > *,
    .welcome-side > *,
    .welcome-spoilers > * {
      opacity: 0;
      transform: translateY(14px) scale(0.99);
      animation: sonexa-rise-in 700ms cubic-bezier(0.2, 0, 0, 1) forwards;
    }

    .welcome-copy > *:nth-child(1) { animation-delay: 40ms; }
    .welcome-copy > *:nth-child(2) { animation-delay: 110ms; }
    .welcome-copy > *:nth-child(3) { animation-delay: 180ms; }
    .welcome-copy > *:nth-child(4) { animation-delay: 250ms; }

    .welcome-side > *:nth-child(1) { animation-delay: 180ms; }
    .welcome-side > *:nth-child(2) { animation-delay: 260ms; }
    .welcome-side > *:nth-child(3) { animation-delay: 340ms; }

    .welcome-spoilers > *:nth-child(1) { animation-delay: 420ms; }
    .welcome-spoilers > *:nth-child(2) { animation-delay: 500ms; }
    .welcome-spoilers > *:nth-child(3) { animation-delay: 580ms; }

    .welcome-side-card,
    .spoiler-card,
    .hero-pill,
    .welcome-actions .btn {
      transition: transform 240ms ease, box-shadow 240ms ease, border-color 240ms ease, background 240ms ease;
    }

    .welcome-side-card:hover,
    .spoiler-card:hover {
      transform: translateY(-2px);
      border-color: rgba(255, 255, 255, 0.14);
      box-shadow: 0 18px 38px rgba(0, 0, 0, 0.24);
    }

    .hero-pill:hover,
    .welcome-actions .btn:hover {
      transform: translateY(-1px);
    }

    .welcome-title strong {
      position: relative;
      display: inline-block;
    }

    .welcome-title strong::after {
      content: "";
      position: absolute;
      left: 0;
      right: 0;
      bottom: 6px;
      height: 10px;
      border-radius: 999px;
      background: linear-gradient(90deg, rgba(245, 158, 11, 0.0), rgba(245, 158, 11, 0.28), rgba(245, 158, 11, 0.0));
      z-index: -1;
      filter: blur(8px);
      animation: sonexa-highlight-pulse 3.8s ease-in-out infinite;
    }

    @keyframes sonexa-rise-in {
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    @keyframes sonexa-highlight-pulse {
      0%, 100% { opacity: 0.55; transform: scaleX(0.96); }
      50% { opacity: 1; transform: scaleX(1.03); }
    }

    @keyframes sonexa-orb-float {
      0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
      50% { transform: translate3d(0, -10px, 0) scale(1.04); }
    }

    @media (prefers-reduced-motion: reduce) {
      .welcome-card::before,
      .welcome-card::after,
      .welcome-copy > *,
      .welcome-side > *,
      .welcome-spoilers > *,
      .welcome-title strong::after {
        animation: none !important;
      }

      .welcome-copy > *,
      .welcome-side > *,
      .welcome-spoilers > * {
        opacity: 1;
        transform: none;
      }
    }
  `;
  document.head.appendChild(style);
}

function patchShellNavigation() {
  if (!navDrawer) return;

  const groups = Array.from(navDrawer.querySelectorAll('.nav-group'));
  if (groups.length < 2) return;

  const pagesGroup = groups[0];
  const servicesGroup = groups[1];
  const ttsButton = navDrawer.querySelector('.nav-link.nav-btn[data-page="tts"]');

  if (ttsButton && ttsButton.parentElement !== servicesGroup) {
    servicesGroup.insertBefore(ttsButton, servicesGroup.querySelector('.nav-link.is-disabled') || null);
  }

  const serviceButtons = Array.from(servicesGroup.querySelectorAll('.nav-link'));
  serviceButtons.forEach((btn) => {
    const textSpan = Array.from(btn.querySelectorAll('span')).find((el) => !el.classList.contains('icon') && !el.classList.contains('coming-soon'));
    if (!textSpan) return;
    if (/^STT$/i.test(textSpan.textContent.trim())) textSpan.textContent = 'ASR';
  });

  let musicButton = servicesGroup.querySelector('[data-service="music-ai"]');
  if (!musicButton) {
    musicButton = document.createElement('button');
    musicButton.type = 'button';
    musicButton.disabled = true;
    musicButton.className = 'nav-link nav-btn is-disabled';
    musicButton.dataset.service = 'music-ai';
    musicButton.innerHTML = `
      <span class="icon icon-sm" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 4v16" />
          <path d="M8 8c2-3 6-3 8 0" />
          <path d="M8 16c2 3 6 3 8 0" />
        </svg>
      </span>
      <span>Music AI Generation</span>
      <span class="coming-soon">Скоро</span>
    `;
  }

  const musicExisting = Array.from(servicesGroup.querySelectorAll('.nav-link.is-disabled')).find(
    (btn) => btn.textContent.includes('Music AI Generation')
  );
  if (!musicExisting) {
    const asrButton = Array.from(servicesGroup.querySelectorAll('.nav-link.is-disabled')).find((btn) => {
      const textSpan = Array.from(btn.querySelectorAll('span')).find((el) => !el.classList.contains('icon') && !el.classList.contains('coming-soon'));
      return textSpan && textSpan.textContent.trim() === 'ASR';
    });
    servicesGroup.insertBefore(musicButton, asrButton || null);
  }

  Array.from(pagesGroup.querySelectorAll('.nav-link')).forEach((btn) => {
    if (btn.dataset.page === 'tts') {
      btn.remove();
    }
  });

  const metricBlocks = document.querySelectorAll('.metric-block');
  metricBlocks.forEach((block) => {
    const strong = block.querySelector('strong');
    const span = block.querySelector('span');
    if (strong && strong.textContent.trim() === 'STT') {
      strong.textContent = 'ASR';
      if (span && /скоро/i.test(span.textContent)) {
        span.textContent = 'скоро будет';
      }
    }
  });

  document.querySelectorAll('.spoiler-card summary').forEach((summary) => {
    if (summary.textContent.includes('STT')) {
      summary.textContent = summary.textContent.replace('STT', 'ASR');
    }
  });
}

function setDynamicGreeting() {
  const eyebrow = document.querySelector('.welcome-eyebrow');
  if (!eyebrow) return;

  const hour = new Date().getHours();
  const greeting = hour < 6 ? 'Доброй ночи' : hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';
  eyebrow.textContent = greeting;
  eyebrow.classList.add('welcome-greeting');
}

function showPage(page, { pushState = true } = {}) {
  const target = document.getElementById(`${page}-page`);
  const pages = document.querySelectorAll('.page');

  if (!target || pages.length === 0) {
    return false;
  }

  pages.forEach((p) => p.classList.remove('active'));
  target.classList.add('active');
  updateNavState(page);

  if (pushState) {
    const url = new URL(window.location.href);
    if (page === 'main') {
      url.searchParams.delete('page');
    } else {
      url.searchParams.set('page', page);
    }
    window.history.pushState({ page }, '', url);
  }

  closeMenu();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  return true;
}

// Drawer controls
menuToggle?.addEventListener('click', toggleMenu);
overlay?.addEventListener('click', closeMenu);
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeMenu();
});

// Navigation buttons and links
document.querySelectorAll('.nav-btn[data-page]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const page = btn.dataset.page;
    if (page) showPage(page);
  });
});

document.querySelectorAll('[data-page-jump]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const page = btn.dataset.pageJump;
    if (page) showPage(page);
  });
});

injectHomeAnimations();
patchShellNavigation();
setDynamicGreeting();

// If the page is loaded with ?page=tts or ?page=about
const initialPage = new URL(window.location.href).searchParams.get('page') || 'main';
if (document.querySelector('.page')) {
  showPage(initialPage, { pushState: false });
}

// TTS form logic (runs on the same shell only if TTS elements exist)
if (textInput && generateBtn && voiceSelect) {
  updateCharCount();
  setStatus('idle', DEFAULT_STATUS.title, DEFAULT_STATUS.message);

  textInput.addEventListener('input', updateCharCount);

  generateBtn.addEventListener('click', async () => {
    const text = textInput.value.trim();
    const voice = voiceSelect.value;

    if (!text) {
      setStatus('error', 'Пусто', 'Пожалуйста, введи текст для озвучки');
      textInput.focus();
      return;
    }

    generateBtn.disabled = true;
    playerSection && (playerSection.style.display = 'none');
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

      if (audioElement) {
        audioElement.src = data.audio_url;
      }
      if (playerSection) {
        playerSection.style.display = 'block';
        playerSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }

      try {
        await audioElement?.play();
      } catch {
        // Autoplay can be blocked by the browser. That's fine.
      }

      setStatus('success', 'Готово!', 'Твоя речь создана и готова к прослушиванию');
    } catch (error) {
      setStatus('error', 'Ошибка', error?.message || 'Произошла неожиданная ошибка');
    } finally {
      generateBtn.disabled = false;
    }
  });

  downloadBtn?.addEventListener('click', () => {
    if (!audioElement?.src) return;

    const link = document.createElement('a');
    link.href = audioElement.src;
    link.download = `sonexa-speech-${Date.now()}.mp3`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  });

  copyUrlBtn?.addEventListener('click', async () => {
    if (!audioElement?.src) return;

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

  clearBtn?.addEventListener('click', () => {
    textInput.value = '';
    updateCharCount();
    if (audioElement) audioElement.src = '';
    if (playerSection) playerSection.style.display = 'none';
    setStatus('idle', DEFAULT_STATUS.title, DEFAULT_STATUS.message);
    generateBtn.disabled = false;
    textInput.focus();
  });

  textInput.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      generateBtn.click();
    }
  });
}
