(() => {
  const escapeHTML = (v) => String(v)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

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
        if (preview) { preview.style.display = 'none'; preview.src = ''; }
        processBtn.disabled = true;
        return;
      }
      if (preview) { preview.src = URL.createObjectURL(file); preview.style.display = 'block'; }
      dropzone.classList.add('has-file');
      const size = file.size > 1024 * 1024 ? `${(file.size / 1024 / 1024).toFixed(1)} МБ` : `${(file.size / 1024).toFixed(1)} КБ`;
      if (dropzoneContent) dropzoneContent.innerHTML = `<div class="asr-dropzone-icon" style="color:var(--success)">✓</div><div class="asr-dropzone-filename">${escapeHTML(currentFileName)}</div><div class="asr-dropzone-text">${size} · нажми чтобы заменить</div>`;
      processBtn.disabled = false;
    };

    dropzone.addEventListener('click', () => { if (!recording) fileInput.click(); });
    fileInput.addEventListener('change', (e) => { if (e.target.files?.[0]) setFile(e.target.files[0]); });
    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('is-dragover'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('is-dragover'));
    dropzone.addEventListener('drop', (e) => { e.preventDefault(); dropzone.classList.remove('is-dragover'); if (e.dataTransfer?.files?.[0]) setFile(e.dataTransfer.files[0]); });

    recordBtn?.addEventListener('click', async () => {
      if (recording) { recorder?.stop(); recording = false; recordBtn.classList.remove('is-recording'); if (recordText) recordText.textContent = 'Записать с микрофона'; return; }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        chunks = [];
        const mime = ['audio/webm', 'audio/ogg', 'audio/mp4'].find((x) => MediaRecorder.isTypeSupported(x)) || '';
        recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
        recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
        recorder.onstop = () => { const blob = new Blob(chunks, { type: mime || 'audio/webm' }); const ext = mime.includes('ogg') ? 'ogg' : mime.includes('mp4') ? 'm4a' : 'webm'; setFile(blob, `recording-${Date.now()}.${ext}`); stream.getTracks().forEach((t) => t.stop()); };
        recorder.start(); recording = true; recordBtn.classList.add('is-recording'); if (recordText) recordText.textContent = 'Остановить запись'; setStatus('busy', 'Идёт запись', 'Нажми кнопку снова, чтобы остановить.');
      } catch (e) { setStatus('error', 'Нет доступа к микрофону', e?.message || 'Разреши доступ к микрофону в браузере.'); }
    });

    processBtn.addEventListener('click', async () => {
      if (!currentFile) return;
      processBtn.disabled = true; if (resultSection) resultSection.style.display = 'none';
      setStatus('busy', 'Распознавание речи', 'Модель работает на CPU — это может занять некоторое время.');
      try {
        const form = new FormData(); form.append('audio', currentFile, currentFileName);
        const res = await fetch('/api/asr', { method: 'POST', body: form });
        const raw = await res.text(); let data = {}; try { data = JSON.parse(raw); } catch {}
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        const text = data.text || ''; if (resultText) resultText.textContent = text; if (resultSection) resultSection.style.display = 'block';
        setStatus(text ? 'success' : 'error', text ? 'Готово!' : 'Пусто', text ? 'Речь распознана.' : 'Не удалось распознать речь.');
      } catch (e) { setStatus('error', 'Ошибка', e?.message || 'Не удалось распознать аудио.'); }
      finally { processBtn.disabled = false; }
    });

    copyBtn?.addEventListener('click', async () => { const text = resultText?.textContent || ''; if (!text) return; try { await navigator.clipboard.writeText(text); const old = copyBtn.innerHTML; copyBtn.innerHTML = '✓ Скопировано!'; setTimeout(() => copyBtn.innerHTML = old, 1600); } catch {} });
    clearBtn?.addEventListener('click', () => { setFile(null); if (resultText) resultText.textContent = ''; if (resultSection) resultSection.style.display = 'none'; fileInput.value = ''; setStatus('idle', 'Готово', 'Загрузи аудио и нажми кнопку, чтобы распознать речь'); });
    setStatus('idle', 'Готово', 'Загрузи аудио и нажми кнопку, чтобы распознать речь');
  }

  /* ========================= MUSIC ========================= */
  const navDrawer = document.getElementById('nav-drawer');
  const servicesGroup = navDrawer?.querySelectorAll('.nav-group')[1];
  const oldMusicButton = Array.from(navDrawer?.querySelectorAll('.nav-link') || []).find((b) => b.textContent.includes('Music AI Generation'));
  const musicButton = oldMusicButton || document.createElement('button');
  musicButton.type = 'button'; musicButton.disabled = false; musicButton.className = 'nav-link nav-btn'; musicButton.dataset.page = 'music';
  musicButton.innerHTML = `<span class="icon icon-sm" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></span><span>Music AI Generation</span><span class="coming-soon" style="background:var(--accent);color:#fff">NEW!</span>`;
  if (!oldMusicButton && servicesGroup) servicesGroup.appendChild(musicButton);

  const main = document.querySelector('.main-container');
  if (!main || document.getElementById('music-page')) return;

  const musicPage = document.createElement('div'); musicPage.id = 'music-page'; musicPage.className = 'page';
  musicPage.innerHTML = `<section style="max-width:1050px;margin:0 auto;padding:32px 20px 60px"><div class="endpoint-card"><div style="display:flex;gap:8px;align-items:center;margin-bottom:10px"><span class="beta-badge">BETA</span><span class="coming-soon" style="background:var(--accent);color:#fff">NEW!</span></div><h1 style="margin:0 0 8px">Music AI Generation</h1><p style="margin:0 0 24px;color:var(--text-secondary,#777)">Создавай музыку по описанию. Lyrics можно добавить для вокального трека.</p><label for="music-prompt" style="display:block;font-weight:600;margin-bottom:8px">Описание музыки</label><textarea id="music-prompt" rows="5" maxlength="2000" placeholder="Dark cinematic electronic, deep bass, atmospheric pads, energetic drums"></textarea><label for="music-lyrics" style="display:block;font-weight:600;margin:18px 0 8px">Текст песни <span style="font-weight:400;color:var(--text-secondary,#777)">(необязательно)</span></label><textarea id="music-lyrics" rows="7" maxlength="6000" placeholder="[Verse]\n...\n[Chorus]\n..."></textarea><div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin-top:18px"><label style="display:flex;align-items:center;gap:8px;font-weight:600">Длительность<select id="music-duration"><option value="30">30 сек</option><option value="60" selected>60 сек</option><option value="90">90 сек</option></select></label><button id="music-generate" class="btn btn-primary" type="button">Создать музыку</button></div><div id="music-status" style="margin-top:18px"></div><div id="music-result" style="display:none;margin-top:22px"><audio id="music-audio" controls style="width:100%"></audio><a id="music-download" class="btn btn-secondary" style="display:inline-block;margin-top:12px" download="sonexa-music.wav">Скачать</a></div></div></section>`;
  main.appendChild(musicPage);

  const prompt = document.getElementById('music-prompt'); const lyrics = document.getElementById('music-lyrics'); const duration = document.getElementById('music-duration'); const generateButton = document.getElementById('music-generate'); const musicStatus = document.getElementById('music-status'); const musicResult = document.getElementById('music-result'); const musicAudio = document.getElementById('music-audio'); const musicDownload = document.getElementById('music-download');
  const statusMusic = (msg, error = false) => { musicStatus.textContent = msg; musicStatus.style.color = error ? 'var(--danger,#dc2626)' : 'var(--text-secondary,#777)'; };
  const openMusic = () => { document.querySelectorAll('.page').forEach((p) => p.classList.remove('active')); musicPage.classList.add('active'); document.querySelectorAll('.nav-btn[data-page]').forEach((b) => b.classList.toggle('is-active', b.dataset.page === 'music')); history.replaceState({ page: 'music' }, '', `${location.pathname}?page=music`); window.scrollTo({ top: 0, behavior: 'smooth' }); document.getElementById('navbar')?.classList.remove('is-open'); };
  musicButton.addEventListener('click', openMusic);

  generateButton.addEventListener('click', async () => {
    const p = prompt.value.trim(); const l = lyrics.value.trim(); if (!p) { statusMusic('Опиши, какую музыку нужно создать.', true); prompt.focus(); return; }
    generateButton.disabled = true; musicResult.style.display = 'none'; statusMusic('Создаём трек… это может занять некоторое время.');
    try {
      const res = await fetch('/api/music', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: p, lyrics: l, duration: Number(duration.value) }) });
      const data = await res.json().catch(() => ({})); if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`); if (!data.audio_url) throw new Error('Сервер не вернул аудиофайл.');
      musicAudio.src = data.audio_url; musicDownload.href = data.audio_url; musicResult.style.display = 'block'; statusMusic('Готово!');
    } catch (e) { statusMusic(e?.message || 'Не удалось создать музыку.', true); }
    finally { generateButton.disabled = false; }
  });

  /* Allow direct ?page=music links. */
  if (new URL(location.href).searchParams.get('page') === 'music') openMusic();

  /* ========================= USER DOCS ========================= */
  const docsButtons = document.querySelectorAll('[data-page="docs"]');
  if (!document.getElementById('docs-page') && docsButtons.length) {
    const docs = document.createElement('div'); docs.id = 'docs-page'; docs.className = 'page';
    docs.innerHTML = `<section style="max-width:900px;margin:0 auto;padding:32px 20px 60px"><div class="endpoint-card"><span class="beta-badge">СПРАВКА</span><h1>Документация</h1><p><strong>TTS:</strong> введи текст, выбери голос и нажми «Озвучить».</p><p><strong>ASR:</strong> загрузи аудио или запиши его с микрофона, затем нажми «Распознать».</p><p><strong>Music AI:</strong> опиши музыку, при необходимости добавь lyrics, выбери длительность и нажми «Создать музыку».</p><p>Если генерация долго выполняется, не закрывай страницу: модели работают на сервере и могут требовать время на обработку.</p><p>Для Music AI доступна длительность 30, 60 или 90 секунд.</p></div></section>`;
    main.appendChild(docs);
  }
})();
