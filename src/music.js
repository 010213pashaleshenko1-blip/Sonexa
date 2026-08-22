/* Sonexa Music Generation */
(() => {
  const navDrawer = document.getElementById('nav-drawer');
  const pagesRoot = document.querySelector('.main-container');

  if (!navDrawer || !pagesRoot) return;

  if (!document.querySelector('link[data-sonexa-music-style]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/style-music.css';
    link.dataset.sonexaMusicStyle = 'true';
    document.head.appendChild(link);
  }

  const servicesGroup = navDrawer.querySelectorAll('.nav-group')[1];
  if (!servicesGroup) return;

  const musicButton = Array.from(navDrawer.querySelectorAll('.nav-link')).find(
    (button) => button.textContent.includes('Music AI Generation')
  ) || document.createElement('button');

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
    <span class="music-new-badge">NEW!</span>
  `;

  if (!musicButton.parentElement) {
    servicesGroup.appendChild(musicButton);
  }

  if (document.getElementById('music-page')) return;

  const page = document.createElement('div');
  page.id = 'music-page';
  page.className = 'page';
  page.innerHTML = `
    <section class="music-shell">
      <div class="music-card">
        <div class="music-head">
          <div class="music-kicker">
            <span>Сервис</span>
            <span class="music-new-badge">NEW!</span>
            <span class="beta-badge">BETA</span>
          </div>
          <h1 class="music-title">Music AI Generation</h1>
          <p class="music-subtitle">
            Создавай музыку по описанию стиля, настроения и звучания. Можно добавить текст песни.
          </p>
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
              <div class="music-duration-wrap">
                <label class="music-label" for="music-duration">Длительность</label>
                <select id="music-duration" class="music-select">
                  <option value="30">30 секунд</option>
                  <option value="60" selected>60 секунд</option>
                  <option value="90">90 секунд</option>
                </select>
              </div>
              <button id="music-generate" class="btn btn-primary music-generate" type="button">Создать музыку</button>
            </div>

            <div id="music-status" class="music-status" aria-live="polite"></div>
          </div>

          <div class="music-panel">
            <div class="music-label">Результат</div>
            <div id="music-result" class="music-result">
              <audio id="music-audio" controls preload="none"></audio>
              <div class="player-actions">
                <a id="music-download" class="btn btn-secondary" href="#" download="sonexa-music.wav">Скачать WAV</a>
              </div>
            </div>
            <div class="music-hint">После запуска генерации не закрывай страницу. В зависимости от нагрузки создание трека может занять время.</div>
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

  const setStatus = (text, type = '') => {
    status.textContent = text;
    status.className = `music-status${type ? ` is-${type}` : ''}`;
  };

  const generate = async () => {
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
  };

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
      return;
    }

    document.querySelectorAll('.page').forEach((pageElement) => {
      pageElement.classList.remove('active');
    });
    page.classList.add('active');
  });

  if (new URL(window.location.href).searchParams.get('page') === 'music') {
    requestAnimationFrame(() => {
      if (typeof window.showPage === 'function') {
        window.showPage('music', { pushState: false });
      } else {
        document.querySelectorAll('.page').forEach((pageElement) => {
          pageElement.classList.remove('active');
        });
        page.classList.add('active');
      }
    });
  }
})();
