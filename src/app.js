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
const THEME_STORAGE_KEY = 'sonexa-theme';

const DEFAULT_STATUS = {
  title: 'Готово',
  message: 'Введи текст и нажми кнопку, чтобы создать речь',
};

/* ---------------------------------------------------------------------------
   Theme management
   --------------------------------------------------------------------------- */
function getStoredTheme() {
  return localStorage.getItem(THEME_STORAGE_KEY) || 'system';
}

function applyTheme(theme) {
  const root = document.documentElement;

  if (theme === 'system') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', theme);
  }

  // Update meta theme-color
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) {
    themeColorMeta.setAttribute('content', isDark ? '#151515' : '#FAFAF8');
  }

  // Update active button
  document.querySelectorAll('.theme-btn[data-theme-value]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.themeValue === theme);
  });
}

function setTheme(theme) {
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  applyTheme(theme);
}

// Apply saved theme immediately (before paint to avoid flash)
(function initTheme() {
  const saved = getStoredTheme();
  applyTheme(saved);
})();

// Listen for system theme changes when in "system" mode
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (getStoredTheme() === 'system') {
    applyTheme('system');
  }
});

// Theme button listeners
document.querySelectorAll('.theme-btn[data-theme-value]').forEach((btn) => {
  btn.addEventListener('click', () => {
    setTheme(btn.dataset.themeValue);
  });
});

/* ---------------------------------------------------------------------------
   Quick theme toggle (top bar) — cycles dark → light → system
   --------------------------------------------------------------------------- */
const quickThemeBtn = document.getElementById('quick-theme-toggle');
const THEME_CYCLE = ['dark', 'light', 'system'];

const QUICK_THEME_ICONS = {
  dark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
  light: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>',
  system: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><path d="M8 21h8M12 17v4"/></svg>',
};

const THEME_LABELS = {
  dark: 'Тёмная',
  light: 'Светлая',
  system: 'Системная',
};

function updateQuickThemeIcon() {
  if (!quickThemeBtn) return;
  const current = getStoredTheme();
  const wrap = quickThemeBtn.querySelector('.icon');
  if (wrap) wrap.innerHTML = QUICK_THEME_ICONS[current] || QUICK_THEME_ICONS.dark;
  quickThemeBtn.setAttribute('aria-label', `Тема: ${THEME_LABELS[current]}. Переключить.`);
  quickThemeBtn.title = `Тема: ${THEME_LABELS[current]}`;
}

if (quickThemeBtn) {
  quickThemeBtn.addEventListener('click', () => {
    const current = getStoredTheme();
    const idx = THEME_CYCLE.indexOf(current);
    const next = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
    setTheme(next);
    updateQuickThemeIcon();
  });
  updateQuickThemeIcon();
}

// Keep quick icon in sync when system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateQuickThemeIcon);

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

/* ---------------------------------------------------------------------------
   Char progress bar (visual indicator for 0/2000 limit)
   --------------------------------------------------------------------------- */
const charProgressBar = document.getElementById('char-progress-bar');
const MAX_CHARS = 2000;

function updateCharProgress() {
  if (!textInput || !charCount) return;
  const len = textInput.value.length;
  charCount.textContent = String(len);
  if (charProgressBar) {
    const pct = Math.min(100, (len / MAX_CHARS) * 100);
    charProgressBar.style.width = pct + '%';
    charProgressBar.classList.toggle('is-warning', len >= MAX_CHARS * 0.9 && len < MAX_CHARS);
    charProgressBar.classList.toggle('is-danger', len >= MAX_CHARS);
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

// Footer navigation links (data-page attribute on .footer-link--btn)
document.querySelectorAll('.footer-link--btn[data-page]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const page = btn.dataset.page;
    if (page) showPage(page);
  });
});

/* ---------------------------------------------------------------------------
   Voice card grid — sync with hidden select
   --------------------------------------------------------------------------- */
const voiceGrid = document.getElementById('voice-grid');

function selectVoice(value) {
  if (!voiceSelect || !voiceGrid) return;
  voiceSelect.value = value;
  voiceGrid.querySelectorAll('.voice-card').forEach((card) => {
    const isActive = card.dataset.voiceValue === value;
    card.classList.toggle('is-active', isActive);
    card.setAttribute('aria-checked', isActive ? 'true' : 'false');
  });
}

if (voiceGrid && voiceSelect) {
  voiceGrid.addEventListener('click', (e) => {
    const card = e.target.closest('.voice-card');
    if (!card) return;
    selectVoice(card.dataset.voiceValue);
  });

  // Keyboard navigation: arrow keys to move between voice cards
  voiceGrid.addEventListener('keydown', (e) => {
    const cards = Array.from(voiceGrid.querySelectorAll('.voice-card'));
    const currentIndex = cards.findIndex((c) => c.classList.contains('is-active'));
    let nextIndex = currentIndex;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nextIndex = (currentIndex + 1) % cards.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') nextIndex = (currentIndex - 1 + cards.length) % cards.length;
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cards[currentIndex]?.click(); return; }
    else return;
    e.preventDefault();
    cards[nextIndex]?.focus();
    selectVoice(cards[nextIndex].dataset.voiceValue);
  });

  // Make voice cards focusable for keyboard
  voiceGrid.querySelectorAll('.voice-card').forEach((card) => {
    card.setAttribute('tabindex', card.classList.contains('is-active') ? '0' : '-1');
  });
}

/* ---------------------------------------------------------------------------
   Player waveform — animate when audio plays, pause when not
   --------------------------------------------------------------------------- */
const waveformEl = document.getElementById('player-waveform');
if (audioElement && waveformEl) {
  audioElement.addEventListener('play', () => waveformEl.classList.add('is-playing'));
  audioElement.addEventListener('pause', () => waveformEl.classList.remove('is-playing'));
  audioElement.addEventListener('ended', () => waveformEl.classList.remove('is-playing'));
  audioElement.addEventListener('emptied', () => waveformEl.classList.remove('is-playing'));
}

injectHomeAnimations();
patchShellNavigation();
setDynamicGreeting();

const initialPage = new URL(window.location.href).searchParams.get('page') || 'main';
if (document.querySelector('.page')) {
  showPage(initialPage, { pushState: false });
}

// TTS form logic
if (textInput && generateBtn && voiceSelect) {
  updateCharProgress();
  setStatus('idle', DEFAULT_STATUS.title, DEFAULT_STATUS.message);

  textInput.addEventListener('input', updateCharProgress);

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

  downloadBtn?.addEventListener('click', async () => {
    if (!audioElement?.src) return;

    // Меняем иконку/текст на "Скачивание..."
    const originalHTML = downloadBtn.innerHTML;
    downloadBtn.disabled = true;
    downloadBtn.innerHTML = `
      <span class="icon icon-sm" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
      </span>
      Скачивание...
    `;

    try {
      // Используем наш прокси /api/download — он обходит CORS и ставит
      // Content-Disposition: attachment, что форсирует скачивание.
      // Браузер сам определит расширение из Content-Type.
      const proxyUrl = `/api/download?url=${encodeURIComponent(audioElement.src)}`;

      // Простой способ: создаём <a> и кликаем — браузер скачает через прокси
      const link = document.createElement('a');
      link.href = proxyUrl;
      link.download = `sonexa-speech-${Date.now()}.wav`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Download failed:', err);
      // Fallback: открываем в новой вкладке (хоть так)
      window.open(audioElement.src, '_blank');
    } finally {
      // Возвращаем кнопку через 1.5с (даём время на старт скачивания)
      setTimeout(() => {
        downloadBtn.disabled = false;
        downloadBtn.innerHTML = originalHTML;
      }, 1500);
    }
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
    updateCharProgress();
    if (audioElement) audioElement.src = '';
    if (playerSection) playerSection.style.display = 'none';
    if (waveformEl) waveformEl.classList.remove('is-playing');
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

/* ---------------------------------------------------------------------------
   v1.2 — Beautiful animations everywhere
   --------------------------------------------------------------------------- */

/* ——— Animated stat counters (count up from 0) ——— */
function animateCounters() {
  const counters = document.querySelectorAll('.stat-value');
  counters.forEach((el) => {
    const raw = el.textContent.trim();
    const isNumeric = /^\d+$/.test(raw);
    if (!isNumeric) return; // skip "MP3"
    const target = parseInt(raw, 10);
    if (!target) return;
    let current = 0;
    const duration = 900;
    const startTime = performance.now();

    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      current = Math.round(target * eased);
      el.textContent = String(current);
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        el.textContent = String(target);
      }
    }
    el.textContent = '0';
    setTimeout(() => requestAnimationFrame(step), 380);
  });
}

/* ——— Quick theme toggle: spin animation ——— */
const quickThemeToggleBtn = document.getElementById('quick-theme-toggle');
if (quickThemeToggleBtn) {
  const originalClick = quickThemeToggleBtn.onclick;
  quickThemeToggleBtn.addEventListener('click', () => {
    quickThemeToggleBtn.classList.add('is-spinning');
    setTimeout(() => quickThemeToggleBtn.classList.remove('is-spinning'), 500);
  });
}

/* ——— Voice cards: mouse-tracking radial highlight ——— */
document.querySelectorAll('.voice-card').forEach((card) => {
  card.addEventListener('mousemove', (e) => {
    const rect = card.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    card.style.setProperty('--mx', x + '%');
    card.style.setProperty('--my', y + '%');
  });
});

/* ——— Generate button: loading state + ripple on click ——— */
if (generateBtn) {
  generateBtn.addEventListener('click', () => {
    if (generateBtn.disabled) return;
    generateBtn.classList.add('is-rippling');
    setTimeout(() => generateBtn.classList.remove('is-rippling'), 280);
  });
}

// Wrap the existing generate handler to toggle is-loading state
const originalGenerateHandler = generateBtn?.onclick;
if (generateBtn) {
  // The async handler is added via addEventListener above; we augment with a
  // mutation observer to sync is-loading with disabled state.
  const syncLoading = new MutationObserver(() => {
    generateBtn.classList.toggle('is-loading', generateBtn.disabled);
  });
  syncLoading.observe(generateBtn, { attributes: true, attributeFilter: ['disabled'] });
}

/* ——— Reveal-on-scroll for elements with .sonexa-reveal ——— */
function setupRevealOnScroll() {
  const revealEls = document.querySelectorAll('.sonexa-reveal');
  if (!revealEls.length) return;

  if (!('IntersectionObserver' in window)) {
    revealEls.forEach((el) => el.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
  );

  revealEls.forEach((el) => observer.observe(el));
}

/* ——— Smooth <details> expand/collapse for spoiler cards ——— */
function setupSpoilerAnimation() {
  document.querySelectorAll('.spoiler-card').forEach((card) => {
    const summary = card.querySelector('summary');
    if (!summary) return;
    summary.addEventListener('click', (e) => {
      // Let the native toggle happen; the CSS handles the indicator animation.
      // We just prevent default scroll jumps.
      if (card.hasAttribute('open')) {
        // About to close — allow native behavior
        return;
      }
      // About to open — allow native behavior, CSS animates the content
    });
  });
}

/* ——— Init all animation helpers ——— */
animateCounters();
setupRevealOnScroll();
setupSpoilerAnimation();

/* ——— Re-run entrance animations when navigating to a page ——— */
const originalShowPage = window.showPage;
window.showPage = function (page, opts) {
  const result = originalShowPage ? originalShowPage.call(this, page, opts) : false;
  // Re-trigger entrance animations for the newly shown page
  setTimeout(() => {
    const activePage = document.querySelector('.page.active');
    if (!activePage) return;
    // Re-trigger card staggers and stat counters
    if (page === 'main') {
      animateCounters();
    }
    if (page === 'tts') {
      // Re-trigger voice card entrance
      activePage.querySelectorAll('.voice-card').forEach((card, i) => {
        card.style.animation = 'none';
        void card.offsetWidth;
        card.style.animation = '';
      });
    }
  }, 30);
  return result;
};
