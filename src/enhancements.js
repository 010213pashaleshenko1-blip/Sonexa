(() => {
  const THEME_KEY = 'sonexa-theme-preference';
  let currentThemeChoice = 'system';
  let settingsModal = null;

  const prefersDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;
  const resolveTheme = (choice) => (choice === 'system' ? (prefersDark() ? 'dark' : 'light') : choice);

  function injectStyles() {
    if (document.getElementById('sonexa-enhancements-styles')) return;
    const style = document.createElement('style');
    style.id = 'sonexa-enhancements-styles';
    style.textContent = `
      html[data-theme='light'] {
        color-scheme: light;
        --text-primary: #20242a;
        --text-secondary: #515965;
        --text-tertiary: #68707d;
        --bg-soft: rgba(16, 24, 40, 0.04);
        --surface: rgba(255, 255, 255, 0.82);
        --surface-strong: #ffffff;
        --surface-muted: #f1ece4;
        --border: rgba(16, 24, 40, 0.10);
        --border-strong: rgba(16, 24, 40, 0.14);
        --shadow-sm: 0 1px 2px rgba(16, 24, 40, 0.07);
        --shadow-md: 0 12px 28px rgba(16, 24, 40, 0.09);
        --shadow-lg: 0 24px 56px rgba(16, 24, 40, 0.10);
        --shadow-xl: 0 34px 74px rgba(16, 24, 40, 0.12);
      }

      html[data-theme='light'] body {
        background:
          radial-gradient(circle at top left, rgba(245, 158, 11, 0.10), transparent 30%),
          radial-gradient(circle at top right, rgba(15, 23, 42, 0.06), transparent 22%),
          linear-gradient(180deg, #f8f5ef 0%, #efe8de 100%);
      }

      html[data-theme='light'] body::before { background: rgba(245, 158, 11, 0.10); }
      html[data-theme='light'] body::after { background: rgba(15, 23, 42, 0.06); }
      html[data-theme='light'] .navbar { background: rgba(255, 255, 255, 0.76); border-bottom-color: rgba(16, 24, 40, 0.08); }

      html[data-theme='light'] .menu-toggle,
      html[data-theme='light'] .nav-link,
      html[data-theme='light'] .tab-btn,
      html[data-theme='light'] .hero-pill,
      html[data-theme='light'] .text-input,
      html[data-theme='light'] .voice-select,
      html[data-theme='light'] .spoiler-card,
      html[data-theme='light'] .status,
      html[data-theme='light'] .player-section,
      html[data-theme='light'] .feature-card,
      html[data-theme='light'] .about-card,
      html[data-theme='light'] .welcome-side-card,
      html[data-theme='light'] .nav-drawer,
      html[data-theme='light'] .welcome-card,
      html[data-theme='light'] .footer-content,
      html[data-theme='light'] .panel {
        background: rgba(255, 255, 255, 0.72);
        border-color: rgba(16, 24, 40, 0.08);
      }

      html[data-theme='light'] .btn-secondary { background: rgba(16, 24, 40, 0.04); }
      html[data-theme='light'] .settings-modal__sheet { background: rgba(255, 255, 255, 0.92); border-color: rgba(16, 24, 40, 0.08); }

      .welcome-card {
        position: relative;
        overflow: visible;
        isolation: isolate;
        padding-top: 24px;
      }

      .welcome-card::before,
      .welcome-card::after { content: none !important; }

      .welcome-orb-cloud {
        position: relative;
        width: min(100%, 920px);
        height: clamp(150px, 20vw, 260px);
        margin: -16px auto 6px;
        perspective: 1200px;
        transform-style: preserve-3d;
        pointer-events: none;
        overflow: visible;
      }

      .welcome-orb-cloud__glow {
        position: absolute;
        inset: 8% 8% 6%;
        border-radius: 999px;
        background: radial-gradient(ellipse at center, rgba(245, 158, 11, 0.20) 0%, rgba(245, 158, 11, 0.08) 36%, rgba(245, 158, 11, 0.00) 72%);
        filter: blur(22px);
        opacity: 0.9;
        transform: translateZ(-40px);
        animation: orbGlow 8s ease-in-out infinite;
      }

      .welcome-orb-cloud__sphere {
        position: absolute;
        left: 50%;
        top: 50%;
        width: var(--size);
        height: var(--size);
        border-radius: 999px;
        transform-style: preserve-3d;
        transform: translate3d(var(--x), var(--y), var(--z));
        background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.98), rgba(255, 255, 255, 0.18) 18%, hsla(var(--h), 92%, 62%, 0.95) 46%, hsla(var(--h), 92%, 52%, 0.28) 74%, transparent 78%);
        box-shadow: 0 0 12px hsla(var(--h), 92%, 62%, 0.40), 0 0 32px hsla(var(--h), 92%, 62%, 0.16);
        opacity: var(--o);
        animation: orbDrift var(--d) ease-in-out infinite;
        animation-delay: var(--delay);
        filter: saturate(1.08);
      }

      .welcome-orb-cloud__sphere::before {
        content: '';
        position: absolute;
        inset: 12% 18% auto auto;
        width: 28%;
        height: 28%;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.9);
        filter: blur(2px);
        opacity: 0.82;
      }

      .welcome-orb-cloud__sphere::after {
        content: '';
        position: absolute;
        inset: 18% 16% auto auto;
        width: 18%;
        height: 18%;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.55);
        filter: blur(8px);
        opacity: 0.52;
      }

      .welcome-greeting {
        background: linear-gradient(135deg, rgba(217, 119, 6, 0.22), rgba(255, 255, 255, 0.08));
        color: #f8d08a;
        box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.05) inset, 0 14px 30px rgba(0, 0, 0, 0.18);
      }

      .welcome-copy > *, .welcome-spoilers > * {
        opacity: 0;
        transform: translateY(12px) scale(0.99);
        animation: riseIn 720ms cubic-bezier(0.2, 0, 0, 1) forwards;
      }
      .welcome-copy > *:nth-child(1) { animation-delay: 60ms; }
      .welcome-copy > *:nth-child(2) { animation-delay: 140ms; }
      .welcome-copy > *:nth-child(3) { animation-delay: 220ms; }
      .welcome-copy > *:nth-child(4) { animation-delay: 300ms; }
      .welcome-copy > *:nth-child(5) { animation-delay: 380ms; }
      .welcome-spoilers > *:nth-child(1) { animation-delay: 480ms; }
      .welcome-spoilers > *:nth-child(2) { animation-delay: 560ms; }
      .welcome-spoilers > *:nth-child(3) { animation-delay: 640ms; }

      .hero-pill, .welcome-actions .btn, .spoiler-card, .welcome-side-card, .nav-link, .tab-btn, .menu-toggle, .theme-option {
        transition: transform 240ms ease, box-shadow 240ms ease, border-color 240ms ease, background 240ms ease;
      }

      .hero-pill:hover, .welcome-actions .btn:hover, .nav-link:hover, .tab-btn:hover:not(.disabled), .menu-toggle:hover, .theme-option:hover {
        transform: translateY(-1px);
      }

      .spoiler-card:hover, .welcome-side-card:hover {
        transform: translateY(-2px);
        border-color: rgba(255, 255, 255, 0.14);
        box-shadow: 0 18px 38px rgba(0, 0, 0, 0.22);
      }

      .welcome-title strong { position: relative; display: inline-block; }
      .welcome-title strong::after {
        content: '';
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0.05em;
        height: 0.42em;
        border-radius: 999px;
        background: linear-gradient(90deg, rgba(245, 158, 11, 0.0), rgba(245, 158, 11, 0.30), rgba(245, 158, 11, 0.0));
        z-index: -1;
        filter: blur(8px);
        animation: highlightPulse 3.8s ease-in-out infinite;
      }

      .settings-trigger {
        width: 100%;
        display: inline-flex;
        justify-content: flex-start;
        align-items: center;
        gap: 10px;
      }

      .settings-modal {
        position: fixed;
        inset: 0;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 20px;
        z-index: 220;
      }
      .settings-modal.open { display: flex; }
      .settings-modal__backdrop { position: absolute; inset: 0; background: rgba(0, 0, 0, 0.46); backdrop-filter: blur(10px); }
      .settings-modal__sheet {
        position: relative;
        z-index: 1;
        width: min(100%, 520px);
        border-radius: 28px;
        background: rgba(24, 24, 24, 0.88);
        border: 1px solid rgba(255, 255, 255, 0.08);
        box-shadow: var(--shadow-xl);
        padding: 22px;
      }
      .settings-modal__top { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 18px; }
      .settings-modal__title { font-size: 1.1rem; letter-spacing: -0.03em; }
      .settings-modal__hint { color: var(--text-secondary); font-size: 13px; margin-bottom: 14px; }
      .settings-group { display: grid; gap: 10px; margin-bottom: 18px; }
      .settings-group__label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--text-tertiary); }
      .theme-options { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
      .theme-option {
        border-radius: 18px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(255, 255, 255, 0.04);
        color: var(--text-primary);
        padding: 14px 12px;
        font: inherit;
        cursor: pointer;
        text-align: left;
        display: grid;
        gap: 4px;
      }
      .theme-option strong { font-size: 14px; }
      .theme-option span { color: var(--text-secondary); font-size: 12px; }
      .theme-option.is-active {
        border-color: rgba(245, 158, 11, 0.42);
        background: linear-gradient(135deg, rgba(217, 119, 6, 0.20), rgba(255, 255, 255, 0.06));
        box-shadow: 0 14px 28px rgba(217, 119, 6, 0.16);
      }
      .settings-modal__footer { display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap; }

      @keyframes riseIn { to { opacity: 1; transform: translateY(0) scale(1); } }
      @keyframes orbDrift {
        0%, 100% { transform: translate3d(var(--x), var(--y), var(--z)) scale(1); }
        50% { transform: translate3d(calc(var(--x) * 1.02), calc(var(--y) * 0.96), calc(var(--z) + 18px)) scale(1.04); }
      }
      @keyframes orbGlow { 0%, 100% { opacity: 0.75; transform: scale(1); } 50% { opacity: 1; transform: scale(1.04); } }
      @keyframes highlightPulse { 0%, 100% { opacity: 0.55; transform: scaleX(0.96); } 50% { opacity: 1; transform: scaleX(1.03); } }

      @media (prefers-reduced-motion: reduce) {
        .welcome-copy > *, .welcome-spoilers > *, .welcome-title strong::after, .welcome-orb-cloud__sphere, .welcome-orb-cloud__glow {
          animation: none !important;
        }
        .welcome-copy > *, .welcome-spoilers > * { opacity: 1; transform: none; }
      }

      @media (max-width: 760px) {
        .welcome-orb-cloud { height: 140px; margin: -8px auto 8px; }
        .theme-options { grid-template-columns: 1fr; }
        .settings-modal__sheet { padding: 18px; border-radius: 24px; }
      }
    `;
    document.head.appendChild(style);
  }

  function makeSphere({ x, y, z, size, hue, opacity, duration, delay }) {
    const el = document.createElement('span');
    el.className = 'welcome-orb-cloud__sphere';
    el.style.setProperty('--x', `${x}px`);
    el.style.setProperty('--y', `${y}px`);
    el.style.setProperty('--z', `${z}px`);
    el.style.setProperty('--size', `${size}px`);
    el.style.setProperty('--h', String(hue));
    el.style.setProperty('--o', String(opacity));
    el.style.setProperty('--d', `${duration}s`);
    el.style.setProperty('--delay', `${delay}s`);
    return el;
  }

  function setupOrbCloud() {
    const welcomeCard = document.querySelector('.welcome-card');
    if (!welcomeCard) return;

    let cloud = welcomeCard.querySelector('.welcome-orb-cloud');
    if (!cloud) {
      cloud = document.createElement('div');
      cloud.className = 'welcome-orb-cloud';
      cloud.setAttribute('aria-hidden', 'true');
      welcomeCard.insertBefore(cloud, welcomeCard.firstChild);
    }

    cloud.innerHTML = '';
    const glow = document.createElement('span');
    glow.className = 'welcome-orb-cloud__glow';
    cloud.appendChild(glow);

    const rings = [
      { count: 12, rx: 280, ry: 48, z: 0, size: [10, 18], hue: 35, opacity: 0.92, duration: 8.8 },
      { count: 10, rx: 195, ry: 28, z: 24, size: [12, 24], hue: 42, opacity: 0.88, duration: 10.2 },
      { count: 8, rx: 126, ry: 18, z: 54, size: [14, 28], hue: 30, opacity: 0.84, duration: 11.5 },
    ];

    rings.forEach((ring, ringIndex) => {
      for (let i = 0; i < ring.count; i += 1) {
        const angle = (i / ring.count) * Math.PI * 2 + ringIndex * 0.22;
        const wobble = Math.sin(angle * 2.2 + ringIndex) * (ring.ry * 0.25);
        const x = Math.cos(angle) * ring.rx + Math.sin(angle * 1.3) * 12;
        const y = Math.sin(angle) * ring.ry + wobble;
        const z = ring.z + Math.sin(angle * 1.7) * 24;
        const size = ring.size[0] + ((i + ringIndex) % 4) * ((ring.size[1] - ring.size[0]) / 3);
        const hue = ring.hue + (((i + ringIndex) % 5) - 2) * 3;
        const opacity = ring.opacity - (i % 3) * 0.04;
        const duration = ring.duration + (i % 4) * 0.6;
        const delay = -(ringIndex * 0.8 + i * 0.35);
        cloud.appendChild(makeSphere({ x, y, z, size, hue, opacity, duration, delay }));
      }
    });

    [
      { x: -12, y: -6, z: 80, size: 34, hue: 37, opacity: 0.9, duration: 9.6, delay: -1.2 },
      { x: 22, y: -10, z: 96, size: 28, hue: 44, opacity: 0.86, duration: 10.4, delay: -2.1 },
      { x: 0, y: 14, z: 108, size: 42, hue: 33, opacity: 0.88, duration: 11.0, delay: -3.2 },
    ].forEach((sphere) => cloud.appendChild(makeSphere(sphere)));
  }

  function openSettings() {
    if (!settingsModal) buildSettingsModal();
    updateThemeButtons();
    settingsModal.classList.add('open');
    settingsModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeSettings() {
    if (!settingsModal) return;
    settingsModal.classList.remove('open');
    settingsModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function buildSettingsModal() {
    if (settingsModal) return settingsModal;
    settingsModal = document.createElement('div');
    settingsModal.className = 'settings-modal';
    settingsModal.setAttribute('aria-hidden', 'true');
    settingsModal.innerHTML = `
      <div class="settings-modal__backdrop" data-close-settings="true"></div>
      <div class="settings-modal__sheet" role="dialog" aria-modal="true" aria-labelledby="settings-modal-title">
        <div class="settings-modal__top">
          <h2 class="settings-modal__title" id="settings-modal-title">Настройки</h2>
          <button class="btn-icon-only" type="button" aria-label="Закрыть настройки" data-close-settings="true">
            <span class="icon icon-sm" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </span>
          </button>
        </div>
        <p class="settings-modal__hint">Выбери тему интерфейса. Можно оставить системную, либо жёстко закрепить светлую или тёмную.</p>
        <div class="settings-group">
          <div class="settings-group__label">Тема</div>
          <div class="theme-options" role="radiogroup" aria-label="Выбор темы">
            <button class="theme-option" type="button" data-theme-choice="system">
              <strong>Системная</strong>
              <span>Следует за устройством</span>
            </button>
            <button class="theme-option" type="button" data-theme-choice="dark">
              <strong>Тёмная</strong>
              <span>Классический вид</span>
            </button>
            <button class="theme-option" type="button" data-theme-choice="light">
              <strong>Светлая</strong>
              <span>Светлый рабочий стол</span>
            </button>
          </div>
        </div>
        <div class="settings-modal__footer">
          <span class="settings-modal__hint" style="margin:0;" data-theme-current></span>
        </div>
      </div>
    `;

    settingsModal.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.matches('[data-close-settings="true"]')) {
        closeSettings();
        return;
      }
      const choiceButton = target.closest('[data-theme-choice]');
      if (choiceButton instanceof HTMLElement) {
        const choice = choiceButton.dataset.themeChoice;
        if (choice) applyTheme(choice, true);
      }
    });

    document.body.appendChild(settingsModal);
    return settingsModal;
  }

  function updateThemeButtons() {
    if (!settingsModal) return;
    settingsModal.querySelectorAll('[data-theme-choice]').forEach((btn) => {
      const choice = btn.dataset.themeChoice;
      const active = choice === currentThemeChoice;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    });

    const label = settingsModal.querySelector('[data-theme-current]');
    if (label) {
      const resolved = resolveTheme(currentThemeChoice);
      label.textContent = currentThemeChoice === 'system'
        ? `Системная (${resolved === 'dark' ? 'тёмная' : 'светлая'})`
        : currentThemeChoice === 'dark'
          ? 'Тёмная тема активна'
          : 'Светлая тема активна';
    }
  }

  function applyTheme(choice, persist = true) {
    currentThemeChoice = choice;
    document.documentElement.dataset.theme = resolveTheme(choice);
    document.documentElement.dataset.themeChoice = choice;
    if (persist) {
      try { localStorage.setItem(THEME_STORAGE_KEY, choice); } catch { /* ignore */ }
    }
    updateThemeButtons();
  }

  function addTopSettingsButton() {
    const navbarTop = document.querySelector('.navbar-top');
    if (!navbarTop || navbarTop.querySelector('.top-settings-btn')) return;

    const btn = document.createElement('button');
    btn.className = 'top-settings-btn menu-toggle';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Открыть настройки');
    btn.innerHTML = `
      <span></span>
      <span></span>
      <span></span>
    `;
    btn.style.marginLeft = 'auto';
    btn.addEventListener('click', openSettings);
    navbarTop.appendChild(btn);
  }

  function patchNavigation() {
    if (!navDrawer) return;

    const groups = Array.from(navDrawer.querySelectorAll('.nav-group'));
    if (groups.length < 2) return;

    const pagesGroup = groups[0];
    const servicesGroup = groups[1];
    const ttsButton = navDrawer.querySelector('.nav-link.nav-btn[data-page="tts"]');

    if (ttsButton && ttsButton.parentElement !== servicesGroup) {
      servicesGroup.insertBefore(ttsButton, servicesGroup.querySelector('.nav-link.is-disabled') || null);
    }

    const settingsGroup = document.createElement('div');
    settingsGroup.className = 'nav-group';
    settingsGroup.dataset.group = 'settings';
    settingsGroup.innerHTML = `
      <div class="nav-group-title">Настройки</div>
      <button class="nav-link nav-btn settings-trigger" type="button" data-action="open-settings">
        <span class="icon icon-sm" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
            <path d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.06.06a2.2 2.2 0 1 1-3.11 3.11l-.06-.06a1.8 1.8 0 0 0-1.98-.36 1.8 1.8 0 0 0-1.08 1.63V21a2.2 2.2 0 1 1-4.4 0v-.14a1.8 1.8 0 0 0-1.08-1.63 1.8 1.8 0 0 0-1.98.36l-.06.06a2.2 2.2 0 1 1-3.11-3.11l.06-.06a1.8 1.8 0 0 0 .36-1.98 1.8 1.8 0 0 0-1.63-1.08H3a2.2 2.2 0 1 1 0-4.4h.14A1.8 1.8 0 0 0 4.77 8.6a1.8 1.8 0 0 0-.36-1.98l-.06-.06A2.2 2.2 0 1 1 7.46 3.45l.06.06A1.8 1.8 0 0 0 9.5 3.86 1.8 1.8 0 0 0 10.58 2.23V2a2.2 2.2 0 1 1 4.4 0v.14a1.8 1.8 0 0 0 1.08 1.63 1.8 1.8 0 0 0 1.98-.36l.06-.06a2.2 2.2 0 1 1 3.11 3.11l-.06.06a1.8 1.8 0 0 0-.36 1.98 1.8 1.8 0 0 0 1.63 1.08H22a2.2 2.2 0 1 1 0 4.4h-.14a1.8 1.8 0 0 0-1.63 1.08Z" />
          </svg>
        </span>
        <span>Настройки</span>
      </button>
    `;
    navDrawer.appendChild(settingsGroup);

    const settingsButton = settingsGroup.querySelector('[data-action="open-settings"]');
    settingsButton?.addEventListener('click', openSettings);

    Array.from(pagesGroup.querySelectorAll('.nav-link')).forEach((btn) => {
      if (btn.dataset.page === 'tts') btn.remove();
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
    if (!target || !pages.length) return false;

    pages.forEach((p) => p.classList.remove('active'));
    target.classList.add('active');
    updateNavState(page);

    if (pushState) {
      const url = new URL(window.location.href);
      if (page === 'main') url.searchParams.delete('page');
      else url.searchParams.set('page', page);
      window.history.pushState({ page }, '', url);
    }

    closeMenu();
    closeSettings();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return true;
  }

  function bindBaseInteractions() {
    menuToggle?.addEventListener('click', toggleMenu);
    overlay?.addEventListener('click', closeMenu);
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeMenu();
        closeSettings();
      }
    });

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

    const systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (currentThemeChoice === 'system') applyTheme('system', false);
    };
    if (typeof systemThemeQuery.addEventListener === 'function') systemThemeQuery.addEventListener('change', onChange);
    else if (typeof systemThemeQuery.addListener === 'function') systemThemeQuery.addListener(onChange);
  }

  function initTheme() {
    let stored = 'system';
    try {
      stored = localStorage.getItem(THEME_STORAGE_KEY) || 'system';
    } catch {
      stored = 'system';
    }
    if (!['system', 'dark', 'light'].includes(stored)) stored = 'system';
    applyTheme(stored, false);
  }

  function initTtsLogic() {
    if (!(textInput && generateBtn && voiceSelect)) return;

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
      if (playerSection) playerSection.style.display = 'none';
      setStatus('busy', 'Создаём речь', 'Пожалуйста, подожди — это может занять несколько секунд');

      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, voice }),
        });

        const raw = await res.text();
        const data = safeJSONParse(raw) || {};

        if (!res.ok) throw new Error(data?.error || 'Ошибка при создании речи');
        if (!data.audio_url) throw new Error('Нет URL аудиофайла в ответе');

        if (audioElement) audioElement.src = data.audio_url;
        if (playerSection) {
          playerSection.style.display = 'block';
          playerSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        try {
          await audioElement?.play();
        } catch {
          // autoplay can be blocked
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

  function init() {
    injectStyles();
    buildSettingsModal();
    setupOrbCloud();
    addTopSettingsButton();
    patchNavigation();
    initTheme();
    setDynamicGreeting();
    bindBaseInteractions();
    initTtsLogic();

    const initialPage = new URL(window.location.href).searchParams.get('page') || 'main';
    if (document.querySelector('.page')) {
      showPage(initialPage, { pushState: false });
    }

    updateThemeButtons();
  }

  init();
})();
