(() => {
  const escapeHTML = (v) => String(v)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  const dropzone = document.getElementById('asr-dropzone');
  const fileInput = document.getElementById('asr-file-input');
  const dropzoneContent = document.getElementById('asr-dropzone-content');
  const recordBtn = document.getElementById('asr-record-btn');
  const recordText = document.getElementById('record-text');
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
        recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
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

  /* Music is a separate module. This loader exists only because the current
     index.html already loads asr.js and does not yet include music.js. */
  if (!document.querySelector('script[data-sonexa-music-loader]')) {
    const script = document.createElement('script');
    script.src = '/src/music.js';
    script.dataset.sonexaMusicLoader = 'true';
    document.body.appendChild(script);
  }
})();
