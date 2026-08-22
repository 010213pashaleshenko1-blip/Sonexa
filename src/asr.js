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

  let currentFile = null;
  let currentFileName = '';
  let mediaRecorder = null;
  let recordedChunks = [];
  let isRecording = false;

  const DEFAULT_STATUS = {
    title: 'Готово',
    message: 'Загрузи аудио и нажми кнопку, чтобы распознать речь',
  };

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

    const url = URL.createObjectURL(file);
    preview.src = url;
    preview.style.display = 'block';

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

      const mimeTypes = ['audio/webm', 'audio/ogg', 'audio/mp4'];
      const mimeType = mimeTypes.find(t => MediaRecorder.isTypeSupported(t)) || '';

      mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mediaRecorder.addEventListener('dataavailable', (e) => {
        if (e.data.size > 0) recordedChunks.push(e.data);
      });
      mediaRecorder.addEventListener('stop', () => {
        const blob = new Blob(recordedChunks, { type: mimeType || 'audio/webm' });
        const ext = mimeType.includes('webm') ? 'webm' : (mimeType.includes('ogg') ? 'ogg' : 'm4a');
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

  setStatus('idle', DEFAULT_STATUS.title, DEFAULT_STATUS.message);
})();

/* ---------------------------------------------------------------------------
   User documentation
   The site menu already contains a "Документация" button with data-page="docs".
   We attach the user guide here so no developer-facing API documentation is
   shown to regular users.
   --------------------------------------------------------------------------- */
(() => {
  const DOCS_ID = 'docs-page';
  const docsButtons = Array.from(document.querySelectorAll('[data-page="docs"]'));
  if (!docsButtons.length) return;

  const docsStyles = `
    .sonexa-user-docs {
      max-width: 980px;
      margin: 0 auto;
      padding: 32px 20px 56px;
    }
    .sonexa-docs-hero {
      margin-bottom: 26px;
      padding: 28px;
      border: 1px solid var(--border, rgba(127,127,127,.2));
      border-radius: 24px;
      background: var(--surface, rgba(255,255,255,.04));
      box-shadow: var(--shadow-md, 0 12px 40px rgba(0,0,0,.08));
    }
    .sonexa-docs-kicker {
      display: inline-flex;
      padding: 5px 10px;
      border-radius: 999px;
      background: var(--accent-soft);
      color: var(--accent);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: .04em;
      text-transform: uppercase;
    }
    .sonexa-docs-hero h1 {
      margin: 14px 0 8px;
      font-size: clamp(30px, 5vw, 46px);
      line-height: 1.05;
    }
    .sonexa-docs-hero p {
      margin: 0;
      max-width: 760px;
      color: var(--text-secondary, #777);
      font-size: 16px;
      line-height: 1.65;
    }
    .sonexa-docs-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0,1fr));
      gap: 16px;
    }
    .sonexa-guide {
      border: 1px solid var(--border, rgba(127,127,127,.2));
      border-radius: 20px;
      background: var(--surface, rgba(255,255,255,.04));
      padding: 22px;
    }
    .sonexa-guide--wide { grid-column: 1 / -1; }
    .sonexa-guide h2 {
      margin: 0 0 10px;
      font-size: 21px;
    }
    .sonexa-guide h3 {
      margin: 18px 0 8px;
      font-size: 15px;
    }
    .sonexa-guide p, .sonexa-guide li {
      color: var(--text-secondary, #777);
      line-height: 1.65;
      font-size: 14px;
    }
    .sonexa-guide ol, .sonexa-guide ul {
      margin: 10px 0 0;
      padding-left: 20px;
    }
    .sonexa-tip {
      margin-top: 14px;
      padding: 12px 14px;
      border-radius: 14px;
      background: var(--accent-soft);
      color: var(--text-primary, #222);
      font-size: 13px;
      line-height: 1.55;
    }
    .sonexa-warning {
      margin-top: 14px;
      padding: 12px 14px;
      border-radius: 14px;
      background: rgba(245,158,11,.10);
      color: var(--text-primary, #222);
      font-size: 13px;
      line-height: 1.55;
    }
    .sonexa-faq details {
      border-top: 1px solid var(--border, rgba(127,127,127,.16));
      padding: 13px 0;
    }
    .sonexa-faq details:first-child { border-top: 0; }
    .sonexa-faq summary {
      cursor: pointer;
      font-weight: 650;
      color: var(--text-primary, #222);
    }
    .sonexa-docs-back {
      margin-top: 24px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      border: 1px solid var(--border, rgba(127,127,127,.2));
      background: var(--surface, rgba(255,255,255,.04));
      color: var(--text-primary, #222);
      border-radius: 12px;
      padding: 10px 14px;
      cursor: pointer;
    }
    @media (max-width: 720px) {
      .sonexa-docs-grid { grid-template-columns: 1fr; }
      .sonexa-guide--wide { grid-column: auto; }
      .sonexa-user-docs { padding: 20px 14px 40px; }
      .sonexa-docs-hero { padding: 22px; }
    }
  `;

  if (!document.getElementById('sonexa-user-docs-style')) {
    const style = document.createElement('style');
    style.id = 'sonexa-user-docs-style';
    style.textContent = docsStyles;
    document.head.appendChild(style);
  }

  const mainContainer = document.querySelector('.main-container');
  if (!mainContainer) return;

  const docsPage = document.createElement('div');
  docsPage.id = DOCS_ID;
  docsPage.className = 'page';
  docsPage.innerHTML = `
    <section class="sonexa-user-docs">
      <div class="sonexa-docs-hero">
        <span class="sonexa-docs-kicker">Справка Sonexa</span>
        <h1>Как пользоваться Sonexa</h1>
        <p>Здесь собраны простые инструкции без технической терминологии. Выбери нужный раздел, повтори несколько шагов и сразу получишь результат.</p>
      </div>

      <div class="sonexa-docs-grid">
        <article class="sonexa-guide">
          <h2>Быстрый старт</h2>
          <ol>
            <li>Открой боковое меню кнопкой ☰.</li>
            <li>Выбери нужный сервис: <b>TTS</b> для озвучки текста или <b>ASR</b> для расшифровки аудио.</li>
            <li>Сделай действие, которое просит выбранный сервис.</li>
            <li>Дождись статуса «Готово» и используй полученный результат.</li>
          </ol>
          <div class="sonexa-tip">На телефоне меню открывается поверх страницы. На компьютере оно сдвигает содержимое в сторону.</div>
        </article>

        <article class="sonexa-guide">
          <h2>TTS — озвучка текста</h2>
          <ol>
            <li>Открой раздел <b>TTS</b>.</li>
            <li>Вставь или напиши текст в поле.</li>
            <li>Выбери подходящий голос.</li>
            <li>Нажми кнопку создания речи.</li>
            <li>После готовности прослушай результат в плеере.</li>
          </ol>
          <p>В интерфейсе отображается счётчик символов. Для одного запуска доступно до <b>2000 символов</b>.</p>
        </article>

        <article class="sonexa-guide">
          <h2>ASR — из аудио в текст</h2>
          <ol>
            <li>Открой <b>ASR</b>.</li>
            <li>Перетащи файл в большую область загрузки или нажми на неё и выбери файл.</li>
            <li>Проверь превью и нажми кнопку распознавания.</li>
            <li>Дождись результата и при необходимости отредактируй текст.</li>
            <li>Нажми копирование, чтобы забрать текст в буфер обмена.</li>
          </ol>
          <p>Поддерживаются WAV, MP3, OGG, WEBM и M4A. Максимальный размер файла — <b>25 МБ</b>.</p>
          <div class="sonexa-warning">ASR работает на CPU, поэтому обработка длинной записи может занять несколько минут. Не закрывай страницу во время распознавания.</div>
        </article>

        <article class="sonexa-guide">
          <h2>Запись с микрофона</h2>
          <ol>
            <li>В разделе ASR нажми кнопку записи.</li>
            <li>Когда браузер спросит доступ к микрофону, разреши его.</li>
            <li>Говори в обычном темпе и без сильного фонового шума.</li>
            <li>Нажми кнопку остановки записи.</li>
            <li>После этого запись появится в ASR как обычный аудиофайл — её можно отправлять на распознавание.</li>
          </ol>
          <div class="sonexa-tip">Если микрофон не работает, проверь разрешение для сайта в настройках браузера и наличие выбранного микрофона в системе.</div>
        </article>

        <article class="sonexa-guide">
          <h2>Что делать с результатом TTS</h2>
          <ul>
            <li><b>Прослушать</b> — используй встроенный аудиоплеер.</li>
            <li><b>Скачать</b> — нажми кнопку скачивания после генерации.</li>
            <li><b>Поделиться</b> — скопируй ссылку на готовое аудио, если кнопка доступна в плеере.</li>
            <li><b>Начать заново</b> — очисти поле и создай новую запись.</li>
          </ul>
        </article>

        <article class="sonexa-guide">
          <h2>Sonexa Assistant</h2>
          <p>Плавающая кнопка чата внизу страницы открывает Sonexa Assistant.</p>
          <ol>
            <li>Нажми кнопку чата.</li>
            <li>Напиши вопрос или задачу.</li>
            <li>Нажми отправку и дождись ответа.</li>
            <li>Для отдельной темы можно создать новый чат.</li>
          </ol>
          <p>Поле сообщения поддерживает до <b>2000 символов</b>.</p>
        </article>

        <article class="sonexa-guide sonexa-guide--wide">
          <h2>Настройки и внешний вид</h2>
          <h3>Тема</h3>
          <p>В Sonexa доступны три режима: <b>тёмная</b>, <b>светлая</b> и <b>системная</b>. В системном режиме сайт подстраивается под тему устройства.</p>
          <h3>Скорость речи</h3>
          <p>Настройка скорости речи отображается в меню, но пока помечена как функция «Скоро» и недоступна.</p>
        </article>

        <article class="sonexa-guide sonexa-guide--wide sonexa-faq">
          <h2>Если что-то пошло не так</h2>
          <details open>
            <summary>ASR показывает ошибку 404 или сервис не найден</summary>
            <p>Попробуй обновить страницу и повторить запрос. Если ошибка сохраняется, сервис распознавания временно недоступен — повтори попытку позже.</p>
          </details>
          <details>
            <summary>ASR очень долго распознаёт аудио</summary>
            <p>Это нормально для длинных записей: модель работает на CPU. Не закрывай страницу до появления результата.</p>
          </details>
          <details>
            <summary>Браузер не даёт записывать с микрофона</summary>
            <p>Разреши доступ к микрофону для Sonexa. На мобильных устройствах также проверь системное разрешение для браузера.</p>
          </details>
          <details>
            <summary>Файл не загружается в ASR</summary>
            <p>Проверь формат и размер. Поддерживаются WAV, MP3, OGG, WEBM и M4A, максимальный размер — 25 МБ.</p>
          </details>
          <details>
            <summary>TTS не запускается</summary>
            <p>Проверь, что поле текста не пустое и не превышает 2000 символов. После этого повтори генерацию.</p>
          </details>
          <details>
            <summary>Не меняется тема</summary>
            <p>Открой «Настройки» и выбери нужный режим. Быстрая кнопка темы в верхней панели переключает режимы по кругу.</p>
          </details>
        </article>
      </div>

      <button class="sonexa-docs-back" id="sonexa-docs-back" type="button">← Вернуться на главную</button>
    </section>
  `;

  mainContainer.appendChild(docsPage);

  function openDocs() {
    document.querySelectorAll('.page').forEach((page) => page.classList.remove('active'));
    docsPage.classList.add('active');
    document.querySelectorAll('.nav-btn[data-page]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.page === 'docs');
    });
    document.querySelector('.navbar')?.classList.remove('is-open');
    document.querySelector('.overlay')?.classList.remove('open', 'visible');
    document.body.style.overflow = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const url = new URL(window.location.href);
    url.searchParams.set('page', 'docs');
    window.history.pushState({ page: 'docs' }, '', url);
  }

  function closeDocs() {
    document.querySelectorAll('.page').forEach((page) => page.classList.remove('active'));
    const home = document.getElementById('main-page');
    home?.classList.add('active');
    document.querySelectorAll('.nav-btn[data-page]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.page === 'main');
    });
    const url = new URL(window.location.href);
    url.searchParams.delete('page');
    window.history.pushState({ page: 'main' }, '', url);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  docsButtons.forEach((btn) => {
    btn.addEventListener('click', openDocs);
  });

  document.getElementById('sonexa-docs-back')?.addEventListener('click', closeDocs);

  window.addEventListener('popstate', () => {
    const page = new URL(window.location.href).searchParams.get('page') || 'main';
    if (page === 'docs') openDocs();
  });
})();
