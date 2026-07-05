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
const navbarClose = document.getElementById('navbar-close');
const navDrawer = document.getElementById('nav-drawer');
const navbar = document.getElementById('navbar');
const overlay = document.getElementById('overlay');
const appContainer = document.getElementById('app-container');
const appBody = document.getElementById('app-body');

const MOBILE_BREAKPOINT = 768;

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

function isMobile() {
  return window.innerWidth < MOBILE_BREAKPOINT;
}

/* ---------------------------------------------------------------------------
   Menu / Drawer logic
   Desktop (>=769px): sidebar pushes content (margin-left on app-body), no overlay
   Mobile  (<768px):   full-screen overlay with sidebar on top
   --------------------------------------------------------------------------- */
function openMenu() {
  if (!navbar || !appContainer) return;

  navbar.classList.add('is-open');
  menuToggle?.classList.add('is-open');
  menuToggle?.setAttribute('aria-expanded', 'true');
  navDrawer?.setAttribute('aria-hidden', 'false');

  if (isMobile()) {
    // Mobile: full-screen overlay
    overlay.classList.add('visible');
    void overlay.offsetWidth; // force reflow for transition
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  } else {
    // Desktop: push content — shift app-body to the right
    appContainer.classList.add('navbar-open');
    appBody.style.marginLeft = '260px';
  }
}

function closeMenu() {
  if (!navbar || !appContainer) return;

  navbar.classList.remove('is-open');
  menuToggle?.classList.remove('is-open');
  menuToggle?.setAttribute('aria-expanded', 'false');
  navDrawer?.setAttribute('aria-hidden', 'true');

  if (isMobile()) {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(() => {
      if (!overlay.classList.contains('open')) {
        overlay.classList.remove('visible');
      }
    }, 280);
  } else {
    appContainer.classList.remove('navbar-open');
    appBody.style.marginLeft = '0';
  }
}

function toggleMenu() {
  if (navbar?.classList.contains('is-open')) {
    closeMenu();
  } else {
    openMenu();
  }
}

function setStatus(type, title, message) {
  const status = statusSection?.querySelector('.status');
  if (!status) return;

  const icons = {
    idle: '&#10003;',
    busy: '&#9203;',
    success: '&#10003;',
    error: '&#10005;',
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

/* ---------------------------------------------------------------------------
   Welcome page — subtle, elegant animations
   --------------------------------------------------------------------------- */
function injectHomeAnimations() {
  if (document.getElementById('sonexa-home-animations')) return;

  const style = document.createElement('style');
  style.id = 'sonexa-home-animations';
  style.textContent = `
    .welcome-copy > *,
    .welcome-spoilers > * {
      opacity: 0;
      transform: translateY(10px);
      animation: sonexa-rise-in 500ms cubic-bezier(0.2, 0, 0, 1) forwards;
    }

    .welcome-copy > *:nth-child(1) { animation-delay: 40ms; }
    .welcome-copy > *:nth-child(2) { animation-delay: 100ms; }
    .welcome-copy > *:nth-child(3) { animation-delay: 160ms; }
    .welcome-copy > *:nth-child(4) { animation-delay: 220ms; }
    .welcome-copy > *:nth-child(5) { animation-delay: 280ms; }

    .welcome-spoilers > *:nth-child(1) { animation-delay: 360ms; }
    .welcome-spoilers > *:nth-child(2) { animation-delay: 420ms; }
    .welcome-spoilers > *:nth-child(3) { animation-delay: 480ms; }

    @media (hover: hover) {
      .hero-pill,
      .welcome-actions .btn,
      .spoiler-card {
        transition: transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease;
      }

      .spoiler-card:hover {
        transform: translateY(-1px);
        border-color: var(--border-strong);
        box-shadow: var(--shadow-md);
      }

      .hero-pill:hover,
      .welcome-actions .btn:hover {
        transform: translateY(-1px);
      }
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
      bottom: 2px;
      height: 6px;
      border-radius: 999px;
      background: linear-gradient(90deg, var(--accent-soft), var(--accent-glow), var(--accent-soft));
      z-index: -1;
      animation: sonexa-highlight-breathe 4s ease-in-out infinite;
    }

    .welcome-greeting {
      background: var(--accent-soft);
      color: var(--accent);
      border-radius: 999px;
      padding: 4px 14px;
    }

    @keyframes sonexa-rise-in {
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes sonexa-highlight-breathe {
      0%, 100% { opacity: 0.6; transform: scaleX(0.96); }
      50% { opacity: 1; transform: scaleX(1.02); }
    }

    @media (prefers-reduced-motion: reduce) {
      .welcome-copy > *,
      .welcome-spoilers > *,
      .welcome-title strong::after {
        animation: none !important;
      }

      .welcome-copy > *,
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

// Menu controls
menuToggle?.addEventListener('click', toggleMenu);
navbarClose?.addEventListener('click', closeMenu);
overlay?.addEventListener('click', closeMenu);
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeMenu();
});

// Swipe left to close (mobile)
let touchStartX = 0;
let touchStartY = 0;
document.addEventListener('touchstart', (e) => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });
document.addEventListener('touchend', (e) => {
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = Math.abs(e.changedTouches[0].clientY - touchStartY);
  if (dx < -60 && dy < 40 && navbar?.classList.contains('is-open')) {
    closeMenu();
  }
}, { passive: true });

// Navigation
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

const initialPage = new URL(window.location.href).searchParams.get('page') || 'main';
if (document.querySelector('.page')) {
  showPage(initialPage, { pushState: false });
}

// TTS form logic
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
        // Autoplay blocked
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
      copyUrlBtn.innerHTML = '<span class="icon icon-sm" aria-hidden="true">&#10003;</span> Скопировано!';
      setTimeout(() => { copyUrlBtn.innerHTML = originalHTML; }, 1800);
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
