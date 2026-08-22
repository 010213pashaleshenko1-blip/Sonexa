/* Sonexa Music AI Generation */
(() => {
  const navDrawer = document.getElementById('nav-drawer');
  const pagesRoot = document.querySelector('.main-container');
  if (!navDrawer || !pagesRoot) return;

  // Critical Music styles are injected immediately so the page never flashes unstyled.
  if (!document.getElementById('sonexa-music-inline-style')) {
    const style = document.createElement('style');
    style.id = 'sonexa-music-inline-style';
    style.textContent = `
      #music-page { opacity:1 !important; filter:none !important; transform:none !important; }
      #music-page .music-shell { max-width:920px; margin:0 auto; padding:40px 0 48px; }
      #music-page .music-head { margin-bottom:28px; }
      #music-page .music-kicker { display:flex; align-items:center; gap:9px; margin-bottom:8px; color:var(--accent); font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:.12em; }
      #music-page .music-title { margin:0 0 10px; color:var(--text-primary); font-size:clamp(2rem,4vw,2.8rem); font-weight:700; letter-spacing:-.04em; line-height:1.15; }
      #music-page .music-subtitle { max-width:560px; margin:0; color:var(--text-secondary); font-size:15px; line-height:1.65; }
      #music-page .music-grid { display:grid; grid-template-columns:1fr 1fr; gap:28px; align-items:start; }
      #music-page .music-panel { min-width:0; padding:28px; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-xl); }
      #music-page .music-label { display:block; margin-bottom:8px; color:var(--text-primary); font-size:14px; font-weight:600; }
      #music-page .music-field { display:block; width:100%; min-width:0; min-height:180px; box-sizing:border-box; resize:vertical; padding:12px 14px; border:1px solid var(--border); border-radius:var(--radius-md); background:var(--surface-muted); color:var(--text-primary); line-height:1.6; outline:none; transition:var(--transition); }
      #music-page .music-field::placeholder { color:var(--text-tertiary); }
      #music-page .music-field:focus { border-color:var(--accent); box-shadow:0 0 0 3px var(--accent-soft); }
      #music-page .music-field--lyrics { min-height:220px; margin-top:16px; }
      #music-page .music-controls { display:grid; grid-template-columns:170px 1fr; gap:12px; align-items:end; margin-top:20px; }
      #music-page .music-select { display:block; width:100%; min-height:44px; box-sizing:border-box; padding:0 36px 0 12px; border:1px solid var(--border); border-radius:var(--radius-md); background:var(--surface-muted); color:var(--text-primary); outline:none; appearance:none; -webkit-appearance:none; cursor:pointer; background-image:linear-gradient(45deg,transparent 50%,var(--text-secondary) 50%),linear-gradient(135deg,var(--text-secondary) 50%,transparent 50%); background-position:calc(100% - 17px) 19px,calc(100% - 12px) 19px; background-size:5px 5px,5px 5px; background-repeat:no-repeat; }
      #music-page .music-select:focus { border-color:var(--accent); box-shadow:0 0 0 3px var(--accent-soft); }
      #music-page .music-generate { width:100%; min-height:44px; }
      #music-page .music-status { min-height:22px; margin-top:18px; padding:12px 14px; border-radius:var(--radius-md); background:var(--surface-muted); color:var(--text-secondary); font-size:13px; line-height:1.55; }
      #music-page .music-status.is-error { background:color-mix(in srgb,var(--error) 10%,transparent); color:var(--error); }
      #music-page .music-status.is-success { background:color-mix(in srgb,var(--success) 10%,transparent); color:var(--success); }
      #music-page .music-result { display:none; margin-top:12px; }
      #music-page .music-result.is-visible { display:block; }
      #music-page .music-result audio { display:block; width:100%; max-width:100%; }
      #music-page .music-result .btn { width:100%; margin-top:12px; }
      #music-page .music-hint { margin-top:12px; color:var(--text-tertiary); font-size:13px; line-height:1.6; }
      #music-page .music-new-badge { display:inline-flex; align-items:center; min-height:20px; padding:3px 8px; border-radius:999px; background:var(--accent); color:#fff; font-size:10px; font-weight:800; letter-spacing:.04em; line-height:1; }
      /* Blur must only exist while the menu overlay is actually open. */
      #overlay { backdrop-filter:none !important; -webkit-backdrop-filter:none !important; }
      #overlay.open { backdrop-filter:blur(4px) !important; -webkit-backdrop-filter:blur(4px) !important; }
      @media (max-width:1024px) { #music-page .music-grid { grid-template-columns:1fr; } }
      @media (max-width:768px) {
        #music-page .music-shell { padding:24px 0 36px; }
        #music-page .music-panel { padding:16px; border-radius:var(--radius-lg); }
        #music-page .music-grid { gap:16px; }
        #music-page .music-field { min-height:140px; font-size:16px; }
        #music-page .music-field--lyrics { min-height:170px; }
        #music-page .music-controls { grid-template-columns:1fr; }
      }
    `;
    document.head.appendChild(style);
  }

  // Load the full shared Music stylesheet too, after critical styles.
  if (!document.querySelector('link[data-sonexa-music-style]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/style-music.css';
    link.dataset.sonexaMusicStyle = 'true';
    document.head.appendChild(link);
  }

  const servicesGroup = navDrawer.querySelectorAll('.nav-group')[1];
  if (!servicesGroup) return;

  let musicButton = Array.from(navDrawer.querySelectorAll('.nav-link')).find(
    (button) => button.textContent.includes('Music AI Generation')
  );

  if (!musicButton) {
    musicButton = document.createElement('button');
    musicButton.type = 'button';
    musicButton.className = 'nav-link nav-btn';
    musicButton.dataset.page = 'music';
    servicesGroup.appendChild(musicButton);
  }

  musicButton.disabled = false;
  musicButton.classList.remove('is-disabled');
  musicButton.innerHTML = `
    <span class="icon icon-sm" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
    </span>
    <span>Music AI Generation</span>
    <span class="music-new-badge">NEW!</span>
  `;

  if (document.getElementById('music-page')) return;

  const page = document.createElement('div');
  page.id = 'music-page';
  page.className = 'page';
  page.innerHTML = `
    <section class="music-shell">
      <div class="music-head">
        <div class="music-kicker">
          <span>Сервис</span>
          <span class="music-new-badge">NEW!</span>
          <span class="beta-badge">BETA</span>
        </div>
        <h1 class="music-title">Music AI Generation</h1>
        <p class="music-subtitle">Создавай музыку по описанию стиля, настроения и звучания. Можно добавить текст песни.</p>
      </div>

      <div class="music-grid">
        <div class="music-panel">
          <div class="form-group">
            <label class="music-label" for="music-prompt">Описание музыки</label>
            <textarea id="music-prompt" class="music-field" maxlength="2000" rows="6" placeholder="Например: cinematic electronic pop, dark atmosphere, deep bass, female vocals, energetic chorus"></textarea>
          </div>

          <div class="form-group">
            <label class="music-label" for="music-lyrics">Текст песни</label>
            <textarea id="music-lyrics" class="music-field music-field--lyrics" maxlength="6000" rows="8" placeholder="[Verse]\n...\n\n[Chorus]\n..."></textarea>
          </div>

          <div class="music-controls">
            <div>
              <label class="music-label" for="music-duration">Длительность</label>
              <select id="music-duration" class="music-select">
                <option value="30">30 секунд</option>
                <option value="60" selected>60 секунд</option>
                <option value="90">90 секунд</option>
              </select>
            </div>
            <button id="music-generate" class="btn btn-primary music-generate" type="button">Создать музыку</button>
          </div>

          <div id="music-status" class="music-status" aria-live="polite">Введи описание и нажми кнопку, чтобы создать трек.</div>
        </div>

        <div class="music-panel">
          <div class="music-label">Результат</div>
          <div id="music-result" class="music-result">
            <audio id="music-audio" controls preload="none"></audio>
            <a id="music-download" class="btn btn-secondary" href="#" download="sonexa-music.wav">Скачать WAV</a>
          </div>
          <div class="music-hint">Генерация может занять некоторое время. Не закрывай страницу до завершения.</div>
        </div>
      </div>
    </section>
  `;

  pagesRoot.appendChild(page);

  const prompt = page.querySelector('#music-prompt');
  const lyrics = page.querySelector('#music-lyrics');
  const duration = page.querySelector('#music-duration');
  const button = page.querySelector('#music-generate');
  const status = page.querySelector('#music-status');
  const result = page.querySelector('#music-result');
  const audio = page.querySelector('#music-audio');
  const download = page.querySelector('#music-download');

  const setStatus = (text, type = '') => {
    status.textContent = text;
    status.className = `music-status${type ? ` is-${type}` : ''}`;
  };

  async function generate() {
    const musicPrompt = prompt.value.trim();
    const musicLyrics = lyrics.value.trim();

    if (!musicPrompt) {
      setStatus('Опиши, какую музыку нужно создать.', 'error');
      prompt.focus();
      return;
    }

    button.disabled = true;
    result.classList.remove('is-visible');
    audio.removeAttribute('src');
    audio.load();
    setStatus('Создаём трек… это может занять некоторое время.');

    try {
      const response = await fetch('/api/music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: musicPrompt,
          lyrics: musicLyrics,
          duration: Number(duration.value),
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      if (!data.audio_url) throw new Error('Сервер не вернул аудиофайл.');

      audio.src = data.audio_url;
      download.href = data.audio_url;
      result.classList.add('is-visible');
      setStatus('Готово! Трек можно прослушать или скачать.', 'success');
    } catch (error) {
      setStatus(error.message || 'Не удалось создать музыку.', 'error');
    } finally {
      button.disabled = false;
    }
  }

  button.addEventListener('click', generate);

  prompt.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      generate();
    }
  });

  musicButton.addEventListener('click', () => {
    if (typeof window.showPage === 'function') {
      window.showPage('music');
    } else {
      document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
      page.classList.add('active');
      window.scrollTo(0, 0);
    }
  });

  if (new URL(window.location.href).searchParams.get('page') === 'music') {
    requestAnimationFrame(() => {
      if (typeof window.showPage === 'function') {
        window.showPage('music', { pushState: false });
      } else {
        document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
        page.classList.add('active');
      }
      window.scrollTo(0, 0);
    });
  }
})();
