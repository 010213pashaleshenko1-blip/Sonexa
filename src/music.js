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
    <span class="coming-soon" style="background:var(--accent);color:#fff">NEW!</span>
  `;

  if (!existing && servicesGroup) servicesGroup.appendChild(musicButton);

  const pagesRoot = document.querySelector('.main-container');
  if (!pagesRoot || document.getElementById('music-page')) return;

  const page = document.createElement('div');
  page.id = 'music-page';
  page.className = 'page';
  page.innerHTML = `
    <section class="endpoint-shell" style="max-width:1000px;margin:0 auto;padding:32px 20px 60px">
      <div class="endpoint-card">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
          <span class="beta-badge">BETA</span>
          <span class="coming-soon" style="background:var(--accent);color:#fff">NEW!</span>
        </div>
        <h1>Music AI Generation</h1>
        <p>Создай музыку по описанию. Для более точного результата можно добавить текст песни.</p>

        <label for="music-prompt" style="display:block;margin-top:22px;font-weight:600">Описание музыки</label>
        <textarea id="music-prompt" rows="5" maxlength="2000" placeholder="Например: atmospheric electronic pop, warm female vocals, soft piano, deep bass, energetic chorus"></textarea>

        <label for="music-lyrics" style="display:block;margin-top:16px;font-weight:600">Текст песни (необязательно)</label>
        <textarea id="music-lyrics" rows="7" maxlength="6000" placeholder="[Verse]\n...\n[Chorus]\n..."></textarea>

        <div style="display:flex;gap:12px;align-items:center;margin-top:16px;flex-wrap:wrap">
          <label style="display:flex;align-items:center;gap:8px">Длительность
            <select id="music-duration">
              <option value="30">30 сек</option>
              <option value="60" selected>60 сек</option>
              <option value="90">90 сек</option>
            </select>
          </label>
          <button id="music-generate" class="btn btn-primary" type="button">Создать музыку</button>
        </div>

        <div id="music-status" style="margin-top:18px"></div>
        <div id="music-result" style="display:none;margin-top:20px">
          <audio id="music-audio" controls style="width:100%"></audio>
          <a id="music-download" class="btn btn-secondary" style="display:inline-block;margin-top:12px" download="sonexa-music.wav">Скачать</a>
        </div>
      </div>
    </section>
  `;
  pagesRoot.appendChild(page);

  const prompt = document.getElementById('music-prompt');
  const lyrics = document.getElementById('music-lyrics');
  const duration = document.getElementById('music-duration');
  const button = document.getElementById('music-generate');
  const status = document.getElementById('music-status');
  const result = document.getElementById('music-result');
  const audio = document.getElementById('music-audio');
  const download = document.getElementById('music-download');

  const setStatus = (text, error = false) => {
    status.textContent = text;
    status.style.color = error ? 'var(--danger, #dc2626)' : 'var(--text-secondary, #777)';
  };

  const generate = async () => {
    const musicPrompt = prompt.value.trim();
    const musicLyrics = lyrics.value.trim();
    if (!musicPrompt) {
      setStatus('Опиши, какую музыку нужно создать.', true);
      return;
    }

    button.disabled = true;
    result.style.display = 'none';
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
      result.style.display = 'block';
      setStatus('Готово!');
      audio.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (error) {
      setStatus(error.message || 'Не удалось создать музыку.', true);
    } finally {
      button.disabled = false;
    }
  };

  button.addEventListener('click', generate);

  musicButton.addEventListener('click', () => {
    if (typeof window.showPage === 'function') {
      window.showPage('music');
    } else {
      document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
      page.classList.add('active');
    }
  });
})();
