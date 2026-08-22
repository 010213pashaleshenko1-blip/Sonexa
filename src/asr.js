(() => {
  const escapeHTML = (v) => String(v)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  /* ========================= ASR ========================= */
  const dropzone = document.getElementById('asr-dropzone');
  const fileInput = document.getElementById('asr-file-input');
  const dropzoneContent = document.getElementById('asr-dropzone-content');
  const recordBtn = document.getElementById('asr-record-btn');
  const recordText = document.getElementById('asr-record-text');
  const preview = document.getElementById('asr-preview');
  const processBtn = document.getElementById('asr-process-btn');
  const status = document.getElementById('asr-status');
  const resultSection = document.getElementById('asr-result-section');
  const resultText = document.getElementById('asr-result-text');
  const copyBtn = document.getElementById('asr-copy-btn');
  const clearBtn = document.getElementById('asr-clear-btn');

  const setStatus = (type, title, message) => {
    if (!status) return;
    const icons = { idle: '&#10003;', busy: '&#9203;', success: '&#10003;', error: '&#10005;' };
    status.className = `status ${type}`;
    status.innerHTML = `<span class="status-icon">${icons[type] || icons.idle}</span><div class="status-content"><div class="status-title">${escapeHTML(title)}</div><div class="status-message">${escapeHTML(message)}</div></div>`;
  };

  if (dropzone && fileInput && processBtn) {
    let currentFile = null;
    let currentFileName = '';
    let recorder = null;
    let chunks = [];
    let recording = false;

    const setFile = (file, name) => {
      currentFile = file;
      currentFileName = name || file?.name || 'audio.wav';

      if (!file) {
        dropzone.classList.remove('has-file');
        if (dropzoneContent) dropzoneContent.innerHTML = '<div class="asr-dropzone-icon">↥</div><div class="asr-dropzone-title">Перетащи аудио сюда</div><div class="asr-dropzone-text">или нажми, чтобы выбрать файл</div><div class="asr-dropzone-hint">WAV, MP3, OGG, WEBM, M4A · макс. 25 МБ</div>';
        if (preview) {
          preview.style.display = 'none';
          preview.src = '';
        }
        processBtn.disabled = true;
        return;
      }

      if (preview) {
        preview.src = URL.createObjectURL(file);
        preview.style.display = 'block';
      }

      dropzone.classList.add('has-file');
      const size = file.size > 1024 * 1024
        ? `${(file.size / 1024 / 1024).toFixed(1)} МБ`
        : `${(file.size / 1024).toFixed(1)} КБ`;

      if (dropzoneContent) {
        dropzoneContent.innerHTML = `<div class="asr-dropzone-icon" style="color:var(--success)">✓</div><div class="asr-dropzone-filename">${escapeHTML(currentFileName)}</div><div class="asr-dropzone-text">${size} · нажми чтобы заменить</div>`;
      }
      processBtn.disabled = false;
    };

    dropzone.addEventListener('click', () => {
      if (!recording) fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files?.[0]) setFile(e.target.files[0]);
    });

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('is-dragover');
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('is-dragover');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('is-dragover');
      if (e.dataTransfer?.files?.[0]) setFile(e.dataTransfer.files[0]);
    });

    recordBtn?.addEventListener('click', async () => {
      if (recording) {
        recorder?.stop();
        recording = false;
        recordBtn.classList.remove('is-recording');
        if (recordText) recordText.textContent = 'Записать с микрофона';
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        chunks = [];
        const mime = ['audio/webm', 'audio/ogg', 'audio/mp4'].find((x) => MediaRecorder.isTypeSupported(x)) || '';
        recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
        recorder.ondataavailable = (e) => {
          if (e.data.size) chunks.push(e.data);
        };
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: mime || 'audio/webm' });
          const ext = mime.includes('ogg') ? 'ogg' : mime.includes('mp4') ? 'm4a' : 'webm';
          setFile(blob, `recording-${Date.now()}.${ext}`);
          stream.getTracks().forEach((t) => t.stop());
        };
        recorder.start();
        recording = true;
        recordBtn.classList.add('is-recording');
        if (recordText) recordText.textContent = 'Остановить запись';
        setStatus('busy', 'Идёт запись', 'Нажми кнопку снова, чтобы остановить.');
      } catch (e) {
        setStatus('error', 'Нет доступа к микрофону', e?.message || 'Разреши доступ к микрофону в браузере.');
      }
    });

    processBtn.addEventListener('click', async () => {
      if (!currentFile) return;
      processBtn.disabled = true;
      if (resultSection) resultSection.style.display = 'none';
      setStatus('busy', 'Распознавание речи', 'Модель работает на CPU — это может занять некоторое время.');

      try {
        const form = new FormData();
        form.append('audio', currentFile, currentFileName);

        const res = await fetch('/api/asr', {
          method: 'POST',
          body: form,
        });

        const raw = await res.text();
        let data = {};
        try { data = JSON.parse(raw); } catch {}

        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

        const text = data.text || '';
        if (resultText) resultText.textContent = text;
        if (resultSection) resultSection.style.display = 'block';

        setStatus(
          text ? 'success' : 'error',
          text ? 'Готово!' : 'Пусто',
          text ? 'Речь распознана.' : 'Не удалось распознать речь.'
        );
      } catch (e) {
        setStatus('error', 'Ошибка', e?.message || 'Не удалось распознать аудио.');
      } finally {
        processBtn.disabled = false;
      }
    });

    copyBtn?.addEventListener('click', async () => {
      const text = resultText?.textContent || '';
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        const old = copyBtn.innerHTML;
        copyBtn.innerHTML = '✓ Скопировано!';
        setTimeout(() => copyBtn.innerHTML = old, 1600);
      } catch {}
    });

    clearBtn?.addEventListener('click', () => {
      setFile(null);
      if (resultText) resultText.textContent = '';
      if (resultSection) resultSection.style.display = 'none';
      fileInput.value = '';
      setStatus('idle', 'Готово', 'Загрузи аудио и нажми кнопку, чтобы распознать речь');
    });

    setStatus('idle', 'Готово', 'Загрузи аудио и нажми кнопку, чтобы распознать речь');
  }

  /* ========================= MUSIC ========================= */
  const navDrawer = document.getElementById('nav-drawer');
  const servicesGroup = navDrawer?.querySelectorAll('.nav-group')[1];
  const main = document.querySelector('.main-container');

  if (servicesGroup && main && !document.getElementById('music-page')) {
    const oldMusicButton = Array.from(servicesGroup.querySelectorAll('.nav-link'))
      .find((b) => b.textContent.includes('Music AI Generation'));

    const musicButton = oldMusicButton || document.createElement('button');
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
      <span class="coming-soon">NEW!</span>
    `;

    if (!oldMusicButton) servicesGroup.appendChild(musicButton);

    const musicPage = document.createElement('div');
    musicPage.id = 'music-page';
    musicPage.className = 'page';
    musicPage.innerHTML = `
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
                <textarea
                  id="music-prompt"
                  class="text-input music-text-input"
                  rows="6"
                  maxlength="2000"
                  placeholder="Например: dark cinematic electronic, deep bass, atmospheric pads, energetic drums..."
                ></textarea>
              </div>

              <div class="form-group">
                <label class="form-label" for="music-lyrics">Текст песни <span class="form-label-muted">(необязательно)</span></label>
                <textarea
                  id="music-lyrics"
                  class="text-input music-text-input music-lyrics-input"
                  rows="8"
                  maxlength="6000"
                  placeholder="[Verse]\n...\n\n[Chorus]\n..."
                ></textarea>
              </div>

              <div class="form-group">
                <label class="form-label" for="music-duration">Длительность</label>
                <select id="music-duration" class="voice-select">
                  <option value="30">30 секунд</option>
                  <option value="60" selected>60 секунд</option>
                  <option value="90">90 секунд</option>
                </select>
              </div>

              <button id="music-generate" class="btn btn-primary btn-large" type="button">
                <span class="icon icon-sm" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 3v18"/>
                    <path d="M5 10l7-7 7 7"/>
                  </svg>
                </span>
                <span class="btn-text">Создать музыку</span>
                <span class="btn-arrow" aria-hidden="true">&rarr;</span>
              </button>
            </div>

            <div class="column">
              <div id="music-status-section" class="status-section">
                <div id="music-status" class="status idle">
                  <span class="status-icon">&#10003;</span>
                  <div class="status-content">
                    <div class="status-title">Готово</div>
                    <div class="status-message">Опиши музыку и нажми кнопку, чтобы создать трек</div>
                  </div>
                </div>
              </div>

              <div id="music-result" class="player-section" style="display:none;">
                <div class="player-header">
                  <h3 class="player-title">
                    <span class="icon icon-sm" aria-hidden="true">♫</span>
                    Результат
                  </h3>
                </div>
                <audio id="music-audio" controls class="audio-player"></audio>
                <div class="player-actions">
                  <a id="music-download" class="btn btn-secondary" href="#" download="sonexa-music.wav">
                    <span class="icon icon-sm" aria-hidden="true">↓</span>
                    Скачать
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    `;

    main.appendChild(musicPage);

    const prompt = document.getElementById('music-prompt');
    const lyrics = document.getElementById('music-lyrics');
    const duration = document.getElementById('music-duration');
    const generateButton = document.getElementById('music-generate');
    const musicStatus = document.getElementById('music-status');
    const musicResult = document.getElementById('music-result');
    const musicAudio = document.getElementById('music-audio');
    const musicDownload = document.getElementById('music-download');

    const setMusicStatus = (type, title, message) => {
      musicStatus.className = `status ${type}`;
      const icons = { idle: '&#10003;', busy: '&#9203;', success: '&#10003;', error: '&#10005;' };
      musicStatus.innerHTML = `
        <span class="status-icon">${icons[type] || icons.idle}</span>
        <div class="status-content">
          <div class="status-title">${escapeHTML(title)}</div>
          <div class="status-message">${escapeHTML(message)}</div>
        </div>
      `;
    };

    const openMusic = () => {
      // Use the site's real menu closing logic so the mobile overlay and blur
      // are removed correctly before the page is shown.
      try {
        if (typeof closeMenu === 'function') closeMenu();
      } catch {}

      document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
      musicPage.classList.add('active');
      musicPage.style.opacity = '1';
      musicPage.style.filter = 'none';
      musicPage.style.transform = 'none';

      document.querySelectorAll('.nav-btn[data-page]').forEach((b) => {
        b.classList.toggle('is-active', b.dataset.page === 'music');
      });

      history.replaceState({ page: 'music' }, '', `${location.pathname}?page=music`);
      window.scrollTo(0, 0);
    };

    musicButton.addEventListener('click', openMusic);

    generateButton.addEventListener('click', async () => {
      const p = prompt.value.trim();
      const l = lyrics.value.trim();

      if (!p) {
        setMusicStatus('error', 'Нет описания', 'Опиши, какую музыку нужно создать.');
        prompt.focus();
        return;
      }

      generateButton.disabled = true;
      musicResult.style.display = 'none';
      setMusicStatus('busy', 'Генерация', 'Создаём трек — это может занять некоторое время.');

      try {
        const res = await fetch('/api/music', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: p,
            lyrics: l,
            duration: Number(duration.value),
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        if (!data.audio_url) throw new Error('Сервер не вернул аудиофайл.');

        musicAudio.src = data.audio_url;
        musicDownload.href = data.audio_url;
        musicResult.style.display = 'block';
        setMusicStatus('success', 'Готово!', 'Музыка создана.');
      } catch (e) {
        setMusicStatus('error', 'Ошибка', e?.message || 'Не удалось создать музыку.');
      } finally {
        generateButton.disabled = false;
      }
    });

    if (new URL(location.href).searchParams.get('page') === 'music') {
      openMusic();
    }
  }
})();
