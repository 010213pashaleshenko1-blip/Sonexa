/* Sonexa Music AI Generation */
(() => {
  const SPACE_URL = 'https://cartik-sonexa-music-server.hf.space';

  const escapeHTML = (value) => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  const initMusic = () => {
    const navDrawer = document.getElementById('nav-drawer');
    const main = document.querySelector('.main-container');
    const servicesGroup = navDrawer?.querySelectorAll('.nav-group')[1];

    if (!navDrawer || !main || !servicesGroup) return;
    if (document.getElementById('music-page')) return;

    const musicButton = Array.from(servicesGroup.querySelectorAll('.nav-link'))
      .find((button) => button.textContent.includes('Music AI Generation')) || document.createElement('button');

    musicButton.type = 'button';
    musicButton.disabled = false;
    musicButton.className = 'nav-link nav-btn';
    musicButton.dataset.page = 'music';
    musicButton.innerHTML = `
      <span class="icon icon-sm" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 18V5l12-2v13"/>
          <circle cx="6" cy="18" r="3"/>
          <circle cx="18" cy="16" r="3"/>
        </svg>
      </span>
      <span>Music AI Generation</span>
      <span class="coming-soon" style="background:var(--accent);color:#fff">NEW!</span>
    `;

    if (!musicButton.parentElement) servicesGroup.appendChild(musicButton);

    const page = document.createElement('div');
    page.id = 'music-page';
    page.className = 'page';
    page.innerHTML = `
      <section class="service-shell">
        <div class="service-head">
          <div>
            <div class="service-kicker">Сервис <span class="coming-soon">NEW!</span></div>
            <h1 class="service-title">Music AI Generation</h1>
            <p class="service-subtitle">Создавай музыку по описанию и, при необходимости, добавляй текст песни.</p>
          </div>
        </div>

        <div class="service-steps" aria-label="Как работает Music AI">
          <div class="service-step"><strong>1</strong><span>Опиши музыку</span></div>
          <div class="service-step"><strong>2</strong><span>Выбери длину</span></div>
          <div class="service-step"><strong>3</strong><span>Создай трек</span></div>
        </div>

        <div class="panel" id="music-panel">
          <div class="panel-grid">
            <div class="column">
              <div class="form-group">
                <label class="form-label" for="music-prompt">Описание музыки</label>
                <textarea id="music-prompt" class="text-input" rows="6" maxlength="2000" placeholder="Энергичная электронная музыка, мощный бас, быстрые барабаны, яркие синтезаторы..."></textarea>
              </div>

              <div class="form-group">
                <label class="form-label" for="music-lyrics">Текст песни <span class="form-label-muted">(необязательно)</span></label>
                <textarea id="music-lyrics" class="text-input" rows="8" maxlength="6000" placeholder="[Verse]\n...\n\n[Chorus]\n..."></textarea>
              </div>

              <div class="form-group">
                <label class="form-label" for="music-duration">Длительность</label>
                <select id="music-duration" class="voice-select">
                  <option value="30">30 секунд</option>
                  <option value="60" selected>60 секунд</option>
                  <option value="90">90 секунд</option>
                </select>
              </div>

              <button id="music-generate" class="btn btn-primary btn-large" type="button">Создать музыку <span class="btn-arrow">&rarr;</span></button>
            </div>

            <div class="column">
              <div class="status-section">
                <div id="music-status" class="status idle">
                  <span class="status-icon">&#10003;</span>
                  <div class="status-content">
                    <div class="status-title">Готово</div>
                    <div class="status-message">Опиши музыку и нажми кнопку, чтобы создать трек.</div>
                  </div>
                </div>
              </div>

              <div id="music-result" class="player-section" style="display:none;">
                <div class="player-header">
                  <h3 class="player-title">Результат</h3>
                </div>
                <audio id="music-audio" controls class="audio-player"></audio>
                <div class="player-actions">
                  <a id="music-download" class="btn btn-secondary" href="#" download="sonexa-music.wav">Скачать</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    `;

    main.appendChild(page);

    const prompt = page.querySelector('#music-prompt');
    const lyrics = page.querySelector('#music-lyrics');
    const duration = page.querySelector('#music-duration');
    const button = page.querySelector('#music-generate');
    const status = page.querySelector('#music-status');
    const result = page.querySelector('#music-result');
    const audio = page.querySelector('#music-audio');
    const download = page.querySelector('#music-download');

    const setStatus = (type, title, message) => {
      const icons = { idle: '&#10003;', busy: '&#9203;', success: '&#10003;', error: '&#10005;' };
      status.className = `status ${type}`;
      status.innerHTML = `<span class="status-icon">${icons[type] || icons.idle}</span><div class="status-content"><div class="status-title">${escapeHTML(title)}</div><div class="status-message">${escapeHTML(message)}</div></div>`;
    };

    const openMusic = () => {
      try { if (typeof closeMenu === 'function') closeMenu(); } catch {}
      document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
      page.classList.add('active');
      page.style.opacity = '1';
      page.style.filter = 'none';
      page.style.transform = 'none';
      document.querySelectorAll('.nav-btn[data-page]').forEach((b) => b.classList.toggle('is-active', b.dataset.page === 'music'));
      history.replaceState({ page: 'music' }, '', `${location.pathname}?page=music`);
      window.scrollTo(0, 0);
    };

    musicButton.addEventListener('click', openMusic);

    button.addEventListener('click', async () => {
      const p = prompt.value.trim();
      const l = lyrics.value.trim();
      const d = Number(duration.value);

      if (!p) {
        setStatus('error', 'Нет описания', 'Опиши, какую музыку нужно создать.');
        prompt.focus();
        return;
      }

      button.disabled = true;
      result.style.display = 'none';
      setStatus('busy', 'Генерация', 'Создаём трек — это может занять некоторое время.');

      try {
        const response = await fetch('/api/music', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: p, lyrics: l, duration: d }),
        });

        const raw = await response.text();
        let data = {};
        try { data = JSON.parse(raw); } catch {}

        if (!response.ok) {
          throw new Error(data.error || `Music backend HTTP ${response.status}`);
        }

        if (!data.audio_url) {
          throw new Error('Music backend не вернул аудиофайл.');
        }

        audio.src = data.audio_url;
        download.href = data.audio_url;
        result.style.display = 'block';
        setStatus('success', 'Готово!', 'Музыка создана.');
      } catch (error) {
        console.error('Music API error:', error);
        setStatus('error', 'Ошибка', error?.message || 'Не удалось подключиться к Music Server.');
      } finally {
        button.disabled = false;
      }
    });

    if (new URL(location.href).searchParams.get('page') === 'music') {
      openMusic();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMusic, { once: true });
  } else {
    initMusic();
  }
})();
