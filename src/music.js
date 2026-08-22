/* Sonexa Music Generation */
(() => {
  const navDrawer = document.getElementById('nav-drawer');
  if (!navDrawer) return;

  const servicesGroup = navDrawer.querySelectorAll('.nav-group')[1];
  const existing = Array.from(navDrawer.querySelectorAll('.nav-link')).find(
    (btn) => btn.textContent.includes('Music AI Generation')
  );

  const musicButton = existing || document.createElement('button');
  musicButton.type = 'button';
  musicButton.disabled = false;
  musicButton.className = 'nav-link nav-btn';
  musicButton.dataset.page = 'music';
  musicButton.innerHTML = `
    <span class="icon icon-sm" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
    </span>
    <span>Music AI Generation</span>
    <span class="coming-soon music-new-badge">NEW!</span>
  `;

  if (!existing && servicesGroup) servicesGroup.appendChild(musicButton);

  const pagesRoot = document.querySelector('.main-container');
  if (!pagesRoot) return;

  // The base site already provides the page shell, but Music is injected
  // dynamically. Keep its first render fully opaque and avoid inherited
  // transforms/filters from generic page animations.
  if (!document.getElementById('sonexa-music-style')) {
    const style = document.createElement('style');
    style.id = 'sonexa-music-style';
    style.textContent = `
      #music-page {
        opacity: 1 !important;
        filter: none !important;
        transform: none !important;
        will-change: auto;
      }

      #music-page .music-shell {
        max-width: 980px;
        margin: 0 auto;
        padding: 32px 20px 64px;
      }

      #music-page .music-card {
        border: 1px solid var(--border, rgba(127,127,127,.2));
        border-radius: 24px;
        background: var(--surface, rgba(255,255,255,.04));
        box-shadow: var(--shadow-md, 0 12px 40px rgba(0,0,0,.08));
        padding: clamp(22px, 4vw, 34px);
      }

      #music-page .music-head {
        display: flex;
        align-items: center;
        gap: 9px;
        flex-wrap: wrap;
        margin-bottom: 10px;
      }

      #music-page .music-kicker {
        color: var(--text-secondary, #777);
        font-size: 13px;
        font-weight: 700;
        letter-spacing: .08em;
        text-transform: uppercase;
      }

      #music-page .music-title {
        margin: 0;
        font-size: clamp(30px, 5vw, 48px);
        line-height: 1.05;
        letter-spacing: -.03em;
      }

      #music-page .music-subtitle {
        margin: 12px 0 24px;
        max-width: 760px;
        color: var(--text-secondary, #777);
        line-height: 1.65;
      }

      #music-page .music-grid {
        display: grid;
        grid-template-columns: minmax(0, 1.15fr) minmax(300px, .85fr);
        gap: 18px;
        align-items: start;
      }

      #music-page .music-panel {
        border: 1px solid var(--border, rgba(127,127,127,.18));
        border-radius: 18px;
        padding: 18px;
        background: var(--surface-elevated, rgba(127,127,127,.04));
      }

      #music-page .music-label {
        display: block;
        margin: 0 0 8px;
        font-size: 14px;
        font-weight: 700;
      }

      #music-page .music-field {
        width: 100%;
        box-sizing: border-box;
        resize: vertical;
        border: 1px solid var(--border, rgba(127,127,127,.2));
        border-radius: 14px;
        padding: 13px 14px;
        background: var(--input-bg, rgba(127,127,127,.05));
        color: var(--text-primary, inherit);
        font: inherit;
        line-height: 1.5;
        outline: none;
      }

      #music-page .music-field:focus {
        border-color: var(--accent, currentColor);
        box-shadow: 0 0 0 3px var(--accent-soft, rgba(127,127,127,.12));
      }

      #music-page .music-field + .music-label {
        margin-top: 16px;
      }

      #music-page .music-controls {
        display: flex;
        align-items: end;
        gap: 12px;
        margin-top: 16px;
        flex-wrap: wrap;
      }

      #music-page .music-duration-wrap {
        min-width: 150px;
      }

      #music-page .music-select {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid var(--border, rgba(127,127,127,.2));
        border-radius: 12px;
        padding: 11px 12px;
        background: var(--input-bg, rgba(127,127,127,.05));
        color: var(--text-primary, inherit);
        font: inherit;
      }

      #music-page .music-generate {
        min-height: 44px;
      }

      #music-page .music-status {
        min-height: 22px;
        margin-top: 16px;
        font-size: 14px;
        line-height: 1.5;
      }

      #music-page .music-status.is-error {
        color: var(--danger, #dc2626);
      }

      #music-page .music-status.is-success {
        color: var(--success, #15803d);
      }

      #music-page .music-result {
        display: none;
      }

      #music-page .music-result.is-visible {
        display: block;
      }

      #music-page .music-result audio {
        display: block;
        width: 100%;
      }

      #music-page .music-hint {
        margin-top: 10px;
        color: var(--text-secondary, #777);
        font-size: 12px;
        line-height: 1.5;
      }

      #music-page .music-new-badge,
      .music-new-badge {
        display: inline-flex;
        align-items: center;
        min-height: 20px;
        padding: 2px 7px;
        border-radius: 999px;
        background: var(--accent, #111);
        color: #fff;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: .04em;
        line-height: 1;
      }

      @media (max-width: 760px) {
        #music-page .music-shell {
          padding: 20px 14px 44px;
        }

        #music-page .music-grid {
          grid-template-columns: 1fr;
        }
      }
    `;
    document.head.appendChild(style);
  }

  if (document.getElementById('music-page')) {
    return;
  }

  const page = document.createElement('div');
  page.id = 'music-page';
  page.className = 'page';
  page.style.opacity = '1';
  page.style.filter = 'none';
  page.style.transform = 'none';

  page.innerHTML = `
    <section class="music-shell">
      <div class="music-card">
        <div class="music-head">
          <span class="music-kicker">Music AI Generation</span>
          <span class="music-new-badge">NEW!</span>
          <span class="beta-badge">BETA</span>
        </div>

        <h1 class="music-title">Создай свою музыку</h1>
        <p class="music-subtitle">
          Опиши стиль и настроение трека. При желании добавь собственный текст песни.
        </p>

        <div class="music-grid">
          <div class="music-panel">
            <label class="music-label" for="music-prompt">Описание музыки</label>
            <textarea
              id="music-prompt"
              class="music-field"
              rows="6"
              maxlength="2000"
              placeholder="Например: cinematic electronic, dark atmosphere, deep bass, female vocals, energetic chorus"
            ></textarea>

            <label class="music-label" for="music-lyrics">Текст песни — необязательно</label>
            <textarea
              id="music-lyrics"
              class="music-field"
              rows="8"
              maxlength="6000"
              placeholder="[Verse]\n...\n\n[Chorus]\n..."
            ></textarea>

            <div class="music-controls">
              <div class="music-duration-wrap">
                <label class="music-label" for="music-duration">Длительность</label>
                <select id="music-duration" class="music-select">
                  <option value="30">30 секунд</option>
                  <option value="60" selected>60 секунд</option>
                  <option value="90">90 секунд</option>
                </select>
              </div>

              <button id="music-generate" class="btn btn-primary music-generate" type="button">
                Создать музыку
              </button>
            </div>

            <div id="music-status" class="music-status" aria-live="polite"></div>
          </div>

          <div class="music-panel">
            <div class="music-label">Результат</div>

            <div id="music-result" class="music-result">
              <audio id="music-audio" controls preload="none"></audio>

              <a
                id="music-download"
                class="btn btn-secondary"
                href="#"
                download="sonexa-music.wav"
                style="display:inline-flex;margin-top:12px"
              >
                Скачать WAV
              </a>
            </div>

            <div class="music-hint">
              Генерация может занять некоторое время, особенно при нагрузке на backend.
            </div>
          </div>
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

  function setStatus(text, type = '') {
    status.textContent = text;
    status.className = `music-status${type ? ` is-${type}` : ''}`;
  }

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
    setStatus('Создаём трек… пожалуйста, не закрывай страницу.');

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

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      if (!data.audio_url) {
        throw new Error('Сервер не вернул аудиофайл.');
      }

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
    }
  });

  // Support direct opening with ?page=music without requiring a click first.
  if (new URL(window.location.href).searchParams.get('page') === 'music') {
    requestAnimationFrame(() => {
      if (typeof window.showPage === 'function') {
        window.showPage('music', { pushState: false });
      } else {
        document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
        page.classList.add('active');
      }
    });
  }
})();
