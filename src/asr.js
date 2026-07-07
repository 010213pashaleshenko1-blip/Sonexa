/**
 * Sonexa ASR — speech-to-text page logic
 *
 * Возможности:
 * - Drag & Drop загрузка аудио
 * - Выбор файла через клик
 * - Запись с микрофона (MediaRecorder API)
 * - Превью аудио перед отправкой
 * - Отправка на /api/asr → распознанный текст
 * - Копирование/редактирование результата
 */

(() => {
  const dropzone = document.getElementById('asr-dropzone');
  const fileInput = document.getElementById('asr-file-input');
  const dropzoneContent = document.getElementById('asr-dropzone-content');
  const recordBtn = document.getElementById('asr-record-btn');
  const recordText = document.getElementById('asr-record-text');
  const preview = document.getElementById('asr-preview');
  const processBtn = document.getElementById('asr-process-btn');
  const statusSection = document.getElementById('asr-status-section');
  const status = document.getElementById('asr-status');
  const resultSection = document.getElementById('asr-result-section');
  const resultText = document.getElementById('asr-result-text');
  const copyBtn = document.getElementById('asr-copy-btn');
  const clearBtn = document.getElementById('asr-clear-btn');

  if (!dropzone || !fileInput || !processBtn) return;

  let currentFile = null;        // File или Blob
  let currentFileName = '';
  let mediaRecorder = null;
  let recordedChunks = [];
  let isRecording = false;

  const DEFAULT_STATUS = {
    title: 'Готово',
    message: 'Загрузи аудио и нажми кнопку, чтобы распознать речь',
  };

  /* ---------- Status ---------- */
  function setStatus(type, title, message) {
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

  function escapeHTML(s) {
    return String(s)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  /* ---------- File selection ---------- */
  function setFile(file, name) {
    currentFile = file;
    currentFileName = name || (file?.name || 'audio.wav');

    if (!file) {
      dropzone.classList.remove('has-file');
      dropzoneContent.innerHTML = `
        <div class="asr-dropzone-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        </div>
        <div class="asr-dropzone-title">Перетащи аудио сюда</div>
        <div class="asr-dropzone-text">или нажми, чтобы выбрать файл</div>
        <div class="asr-dropzone-hint">Поддерживаются: WAV, MP3, OGG, WEBM, M4A · макс. 25 МБ</div>
      `;
      preview.style.display = 'none';
      preview.src = '';
      processBtn.disabled = true;
      return;
    }

    // Показываем превью
    const url = URL.createObjectURL(file);
    preview.src = url;
    preview.style.display = 'block';

    // Обновляем dropzone
    dropzone.classList.add('has-file');
    const sizeKB = (file.size / 1024).toFixed(1);
    const sizeStr = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} МБ` : `${sizeKB} КБ`;
    dropzoneContent.innerHTML = `
      <div class="asr-dropzone-icon" aria-hidden="true" style="color:var(--success)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 18V5l12-2v13"/>
          <circle cx="6" cy="18" r="3"/>
          <circle cx="18" cy="16" r="3"/>
        </svg>
      </div>
      <div class="asr-dropzone-filename">${escapeHTML(currentFileName)}</div>
      <div class="asr-dropzone-text">${sizeStr} · нажми чтобы заменить</div>
    `;

    processBtn.disabled = false;
  }

  /* ---------- Drag & Drop ---------- */
  dropzone.addEventListener('click', () => {
    if (!isRecording) fileInput.click();
  });

  dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });

  ['dragenter', 'dragover'].forEach(evt => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('is-dragover');
    });
  });

  ['dragleave', 'drop'].forEach(evt => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('is-dragover');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      setFile(files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) setFile(file);
  });

  /* ---------- Microphone recording ---------- */
  recordBtn?.addEventListener('click', async () => {
    if (isRecording) {
      stopRecording();
      return;
    }
    await startRecording();
  });

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordedChunks = [];

      // Выбираем поддерживаемый mime type
      const mimeTypes = ['audio/webm', 'audio/ogg', 'audio/mp4'];
      const mimeType = mimeTypes.find(t => MediaRecorder.isTypeSupported(t)) || '';

      mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mediaRecorder.addEventListener('dataavailable', (e) => {
        if (e.data.size > 0) recordedChunks.push(e.data);
      });
      mediaRecorder.addEventListener('stop', () => {
        const blob = new Blob(recordedChunks, { type: mimeType || 'audio/webm' });
        const ext = (mimeType.includes('webm') ? 'webm' : (mimeType.includes('ogg') ? 'ogg' : 'm4a'));
        setFile(blob, `recording-${Date.now()}.${ext}`);
        stream.getTracks().forEach(t => t.stop());
      });

      mediaRecorder.start();
      isRecording = true;
      recordBtn.classList.add('is-recording');
      recordText.textContent = 'Остановить запись';
      setStatus('busy', 'Идёт запись', 'Нажми кнопку снова, чтобы остановить');
    } catch (err) {
      setStatus('error', 'Нет доступа к микрофону', err.message || 'Разреши доступ в настройках браузера');
    }
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    isRecording = false;
    recordBtn.classList.remove('is-recording');
    recordText.textContent = 'Записать с микрофона';
  }

  /* ---------- Process ASR ---------- */
  processBtn.addEventListener('click', async () => {
    if (!currentFile) return;

    processBtn.disabled = true;
    resultSection.style.display = 'none';
    setStatus('busy', 'Распознавание речи', 'Модель работает на CPU — это может занять до 2-3 минут. Не закрывай страницу.');

    try {
      const formData = new FormData();
      formData.append('audio', currentFile, currentFileName);

      const res = await fetch('/api/asr', {
        method: 'POST',
        body: formData,
      });

      const raw = await res.text();
      let data;
      try { data = JSON.parse(raw); } catch { data = {}; }

      if (!res.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }

      const text = data.text || '';
      resultText.textContent = text;
      resultSection.style.display = 'block';

      if (data.warning) {
        setStatus('error', 'Пусто', data.warning);
      } else if (text) {
        setStatus('success', 'Готово!', 'Речь распознана — текст можно редактировать и копировать');
      } else {
        setStatus('error', 'Пусто', 'Не удалось распознать речь в аудио');
      }

      resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (err) {
      setStatus('error', 'Ошибка', err.message || 'Произошла неожиданная ошибка');
    } finally {
      processBtn.disabled = false;
    }
  });

  /* ---------- Copy / Clear ---------- */
  copyBtn?.addEventListener('click', async () => {
    const text = resultText.textContent || '';
    if (!text) return;
    const originalHTML = copyBtn.innerHTML;
    try {
      await navigator.clipboard.writeText(text);
      copyBtn.innerHTML = '<span class="icon icon-sm" aria-hidden="true">&#10003;</span> Скопировано!';
      setTimeout(() => { copyBtn.innerHTML = originalHTML; }, 1800);
    } catch {
      setStatus('error', 'Ошибка', 'Не удалось скопировать текст');
    }
  });

  clearBtn?.addEventListener('click', () => {
    setFile(null);
    resultText.textContent = '';
    resultSection.style.display = 'none';
    setStatus('idle', DEFAULT_STATUS.title, DEFAULT_STATUS.message);
    fileInput.value = '';
    processBtn.disabled = false;
  });

  /* ---------- Init ---------- */
  setStatus('idle', DEFAULT_STATUS.title, DEFAULT_STATUS.message);
})();
