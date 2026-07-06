/**
 * Sonexa Assistant — Chat Widget
 *
 * Возможности:
 * - Floating Action Button (FAB) — открывает/закрывает чат
 * - Несколько чатов с переключением (сохраняются в localStorage)
 * - Header показывает название текущего чата + модель "Sonexa"
 * - Кнопка ">" открывает dropdown со всеми чатами + "Новый чат"
 * - Стриминг ответа через polling:
 *     • POST /api/chat → { job_id }
 *     • GET /api/chat?job_id=xxx каждые 500мс
 *     • Если контент не менялся 2с → ответ завершён
 * - Авто-resize textarea, отправка по Enter (Shift+Enter = перенос строки)
 * - Markdown-подобное форматирование: **bold**, *italic*, `code`, переносы строк
 */

(() => {
  const STORAGE_KEY = 'sonexa-chat-chats';
  const ACTIVE_KEY = 'sonexa-chat-active';

  // DOM
  const fab = document.getElementById('chat-fab');
  const panel = document.getElementById('chat-panel');
  const switcherToggle = document.getElementById('chat-switcher-toggle');
  const switcher = document.getElementById('chat-switcher');
  const chatList = document.getElementById('chat-list');
  const newChatBtn = document.getElementById('chat-new-btn');
  const messagesEl = document.getElementById('chat-messages');
  const form = document.getElementById('chat-form');
  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send');
  const stopBtn = document.getElementById('chat-stop');
  const currentNameEl = document.getElementById('chat-current-name');

  // State
  let chats = loadChats(); // [{id, name, messages: [{role, content}]}]
  let activeChatId = localStorage.getItem(ACTIVE_KEY) || null;
  let isStreaming = false;
  let abortController = null;

  /* ---------- Persistence ---------- */
  function loadChats() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveChats() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
    } catch (e) {
      console.warn('chat: cannot save to localStorage', e);
    }
  }

  function getActiveChat() {
    return chats.find(c => c.id === activeChatId) || null;
  }

  function setActiveChat(id) {
    activeChatId = id;
    localStorage.setItem(ACTIVE_KEY, id);
    renderHeader();
    renderChatList();
    renderMessages();
  }

  /* ---------- Chat management ---------- */
  function createChat(name) {
    const id = `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const chat = {
      id,
      name: name || `Чат ${chats.length + 1}`,
      messages: [],
      createdAt: Date.now(),
    };
    chats.unshift(chat); // новый чат — первый в списке
    saveChats();
    setActiveChat(id);
    return chat;
  }

  function deleteChat(id) {
    const idx = chats.findIndex(c => c.id === id);
    if (idx === -1) return;
    chats.splice(idx, 1);
    saveChats();
    if (activeChatId === id) {
      activeChatId = chats[0]?.id || null;
      if (activeChatId) {
        localStorage.setItem(ACTIVE_KEY, activeChatId);
      } else {
        localStorage.removeItem(ACTIVE_KEY);
      }
    }
    renderHeader();
    renderChatList();
    renderMessages();
  }

  function ensureFirstChat() {
    // Если нет ни одного чата — создаём "Первый чат"
    if (chats.length === 0) {
      const first = createChat('Первый чат');
      // Если после создания всё равно пусто (ошибка localStorage) — fallback
      if (chats.length === 0) {
        chats.push({ id: 'first', name: 'Первый чат', messages: [], createdAt: Date.now() });
        activeChatId = 'first';
        saveChats();
      }
    }
    if (!activeChatId || !getActiveChat()) {
      activeChatId = chats[0].id;
      localStorage.setItem(ACTIVE_KEY, activeChatId);
    }
  }

  /* ---------- Rendering ---------- */
  function renderHeader() {
    const chat = getActiveChat();
    if (chat) {
      currentNameEl.textContent = chat.name;
    } else {
      currentNameEl.textContent = 'Нет чата';
    }
  }

  function renderChatList() {
    chatList.innerHTML = '';
    chats.forEach((chat, idx) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'chat-list-item' + (chat.id === activeChatId ? ' is-active' : '');
      item.dataset.chatId = chat.id;
      item.innerHTML = `
        <span class="chat-list-item-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </span>
        <span class="chat-list-item-name">${escapeHTML(chat.name)}</span>
        <button class="chat-list-item-delete" aria-label="Удалить чат" type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6h18"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      `;
      item.addEventListener('click', (e) => {
        // Если клик по кнопке удаления — не выбираем чат
        if (e.target.closest('.chat-list-item-delete')) return;
        setActiveChat(chat.id);
        closeSwitcher();
      });
      const deleteBtn = item.querySelector('.chat-list-item-delete');
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`Удалить чат "${chat.name}"?`)) {
          deleteChat(chat.id);
        }
      });
      chatList.appendChild(item);
    });
  }

  function renderMessages() {
    const chat = getActiveChat();
    messagesEl.innerHTML = '';

    if (!chat || chat.messages.length === 0) {
      renderEmptyState();
      return;
    }

    chat.messages.forEach(msg => {
      appendMessageEl(msg.role, msg.content);
    });
    scrollToBottom();
  }

  function renderEmptyState() {
    const empty = document.createElement('div');
    empty.className = 'chat-empty';
    empty.innerHTML = `
      <div class="chat-empty-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
        </svg>
      </div>
      <div class="chat-empty-title">Sonexa Assistant</div>
      <div class="chat-empty-text">Привет! Я готов помочь с озвучкой, голосами и рассказать про Sonexa.</div>
      <div class="chat-empty-suggestions">
        <button class="chat-suggestion-btn" data-text="Какие голоса есть в Sonexa?" type="button">Какие голоса есть в Sonexa?</button>
        <button class="chat-suggestion-btn" data-text="Напиши короткий текст для озвучки" type="button">Напиши короткий текст для озвучки</button>
        <button class="chat-suggestion-btn" data-text="Что такое Sonexa?" type="button">Что такое Sonexa?</button>
      </div>
    `;
    empty.querySelectorAll('.chat-suggestion-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        input.value = btn.dataset.text;
        autoResize();
        updateSendButton();
        form.requestSubmit();
      });
    });
    messagesEl.appendChild(empty);
  }

  function appendMessageEl(role, content, { streaming = false } = {}) {
    // Удаляем empty-state если есть
    const empty = messagesEl.querySelector('.chat-empty');
    if (empty) empty.remove();

    const msg = document.createElement('div');
    msg.className = `chat-message chat-message-${role}`;
    const avatarText = role === 'user' ? 'Я' : 'S';
    msg.innerHTML = `
      <div class="chat-message-avatar" aria-hidden="true">${avatarText}</div>
      <div class="chat-message-content${streaming ? ' is-streaming' : ''}"></div>
    `;
    const contentEl = msg.querySelector('.chat-message-content');
    contentEl.innerHTML = formatMessage(content);
    messagesEl.appendChild(msg);
    scrollToBottom();
    return contentEl;
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    });
  }

  /* ---------- Simple markdown formatting ---------- */
  function formatMessage(text) {
    if (!text) return '';
    let s = escapeHTML(text);
    // Code blocks ```
    s = s.replace(/```([\s\S]*?)```/g, (_, code) => {
      return `<pre style="background:var(--surface-muted);padding:8px 10px;border-radius:6px;overflow-x:auto;font-size:12px;margin:6px 0"><code>${code.trim()}</code></pre>`;
    });
    // Inline code
    s = s.replace(/`([^`\n]+)`/g, '<code style="background:var(--surface-muted);padding:1px 5px;border-radius:4px;font-size:12px">$1</code>');
    // Bold
    s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    // Italic
    s = s.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
    // Line breaks
    s = s.replace(/\n/g, '<br>');
    return s;
  }

  function escapeHTML(s) {
    return String(s)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  /* ---------- FAB + panel toggle ---------- */
  function openPanel() {
    panel.classList.add('is-open');
    panel.setAttribute('aria-hidden', 'false');
    fab.classList.add('is-open');
    fab.setAttribute('aria-expanded', 'true');
    setTimeout(() => input.focus(), 280);
  }

  function closePanel() {
    panel.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
    fab.classList.remove('is-open');
    fab.setAttribute('aria-expanded', 'false');
    closeSwitcher();
  }

  function togglePanel() {
    if (panel.classList.contains('is-open')) closePanel();
    else openPanel();
  }

  /* ---------- Switcher dropdown ---------- */
  function openSwitcher() {
    switcher.classList.add('is-open');
    switcher.setAttribute('aria-hidden', 'false');
    switcherToggle.classList.add('is-open');
    switcherToggle.setAttribute('aria-expanded', 'true');
  }

  function closeSwitcher() {
    switcher.classList.remove('is-open');
    switcher.setAttribute('aria-hidden', 'true');
    switcherToggle.classList.remove('is-open');
    switcherToggle.setAttribute('aria-expanded', 'false');
  }

  function toggleSwitcher() {
    if (switcher.classList.contains('is-open')) closeSwitcher();
    else openSwitcher();
  }

  /* ---------- Input handling ---------- */
  function autoResize() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  }

  function updateSendButton() {
    const hasText = input.value.trim().length > 0;
    sendBtn.disabled = !hasText || isStreaming;
    // Показываем stop вместо send во время стриминга
    if (isStreaming) {
      sendBtn.style.display = 'none';
      stopBtn.style.display = 'grid';
    } else {
      sendBtn.style.display = 'grid';
      stopBtn.style.display = 'none';
    }
  }

  /* ---------- Send message + streaming ---------- */
  async function sendMessage(text) {
    const chat = getActiveChat();
    if (!chat) return;
    if (isStreaming) return;
    if (!text.trim()) return;

    // Добавляем user message
    chat.messages.push({ role: 'user', content: text });
    saveChats();

    // Если это первое сообщение — переименовываем чат по нему
    if (chat.messages.length === 1) {
      chat.name = text.slice(0, 40) + (text.length > 40 ? '…' : '');
      renderHeader();
      renderChatList();
    }

    // Рендерим user message
    appendMessageEl('user', text);

    // Очищаем ввод
    input.value = '';
    autoResize();
    isStreaming = true;
    updateSendButton();
    input.disabled = true;

    // Создаём AbortController для возможности остановки
    abortController = new AbortController();

    // Создаём placeholder для assistant
    const assistantContentEl = appendMessageEl('assistant', '', { streaming: true });
    assistantContentEl.innerHTML = '<div class="chat-typing"><span></span><span></span><span></span></div>';

    let lastStreamedContent = '';

    try {
      await streamAssistantResponse(chat, assistantContentEl, abortController.signal, (content) => {
        lastStreamedContent = content;
      });
    } catch (err) {
      // Если пользователь отменил — сохраняем то, что уже пришло
      if (err.name === 'AbortError' || err.message === 'Aborted by user') {
        assistantContentEl.classList.remove('is-streaming');
        if (lastStreamedContent) {
          assistantContentEl.innerHTML = formatMessage(lastStreamedContent) +
            '<div style="margin-top:6px;font-size:11px;color:var(--text-tertiary);font-style:italic">⏹ Остановлено</div>';
          chat.messages.push({ role: 'assistant', content: lastStreamedContent });
          saveChats();
        } else {
          assistantContentEl.innerHTML = '<div style="color:var(--text-tertiary);font-style:italic">⏹ Запрос остановлен</div>';
        }
      } else {
        assistantContentEl.classList.remove('is-streaming');
        assistantContentEl.innerHTML = `<span style="color:var(--error)">⚠ Ошибка: ${escapeHTML(err.message || 'неизвестная')}</span>`;
        chat.messages.push({
          role: 'assistant',
          content: `⚠ Ошибка: ${err.message || 'неизвестная'}`,
        });
        saveChats();
      }
    } finally {
      isStreaming = false;
      abortController = null;
      input.disabled = false;
      updateSendButton();
      input.focus();
    }
  }

  /* ---------- Stop streaming ---------- */
  function stopStreaming() {
    if (abortController) {
      abortController.abort();
    }
  }

  async function streamAssistantResponse(chat, contentEl, signal, onContent) {
    // Используем fetch с потоковым чтением (SSE)
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: chat.messages,
        temperature: 0.7,
        max_tokens: 1024,
      }),
      signal,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    if (!res.body) {
      // Fallback: читаем весь ответ
      const text = await res.text();
      contentEl.innerHTML = formatMessage(text);
      chat.messages.push({ role: 'assistant', content: text });
      saveChats();
      return;
    }

    // Читаем SSE поток
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullContent = '';
    let gotFirstChunk = false;

    // Обработка abort — освобождаем reader
    signal?.addEventListener('abort', () => {
      try { reader.cancel(); } catch {}
    });

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // последняя неполная строка

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr) continue;

        let data;
        try {
          data = JSON.parse(jsonStr);
        } catch {
          continue;
        }

        if (data.status === 'error') {
          throw new Error(data.error || 'Сервер сообщил об ошибке');
        }

        if (data.status === 'chunk') {
          if (!gotFirstChunk) {
            gotFirstChunk = true;
            contentEl.classList.add('is-streaming');
          }
          fullContent = data.content || '';
          contentEl.innerHTML = formatMessage(fullContent);
          scrollToBottom();
          // Сообщаем вызывающему коду текущий контент (для abort)
          onContent?.(fullContent);
        }

        if (data.status === 'done') {
          fullContent = data.content || fullContent;
          contentEl.innerHTML = formatMessage(fullContent);
          contentEl.classList.remove('is-streaming');
          onContent?.(fullContent);
        }
      }
    }

    // Если был abort — бросаем ошибку, чтобы sendMessage обработал
    if (signal?.aborted) {
      throw new DOMException('Aborted by user', 'AbortError');
    }

    // Обрабатываем оставшийся буфер
    if (buffer.startsWith('data: ')) {
      try {
        const data = JSON.parse(buffer.slice(6).trim());
        if (data.status === 'done' && data.content) {
          fullContent = data.content;
          contentEl.innerHTML = formatMessage(fullContent);
          onContent?.(fullContent);
        }
      } catch {}
    }

    contentEl.classList.remove('is-streaming');
    if (!fullContent) {
      throw new Error('Пустой ответ от модели');
    }

    // Сохраняем финальный ответ в chat
    chat.messages.push({ role: 'assistant', content: fullContent });
    saveChats();
  }

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  /* ---------- Event listeners ---------- */
  fab.addEventListener('click', togglePanel);
  switcherToggle.addEventListener('click', toggleSwitcher);
  stopBtn.addEventListener('click', stopStreaming);
  newChatBtn.addEventListener('click', () => {
    createChat();
    closeSwitcher();
    input.focus();
  });

  // Закрытие switcher по клику вне него
  document.addEventListener('click', (e) => {
    if (!switcher.classList.contains('is-open')) return;
    if (e.target.closest('.chat-switcher') || e.target.closest('.chat-switcher-toggle')) return;
    closeSwitcher();
  });

  // Закрытие панели по Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (switcher.classList.contains('is-open')) {
        closeSwitcher();
      } else if (panel.classList.contains('is-open')) {
        closePanel();
      }
    }
  });

  // Input: auto-resize + send button state
  input.addEventListener('input', () => {
    autoResize();
    updateSendButton();
  });

  // Enter = отправить, Shift+Enter = перенос
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!sendBtn.disabled) form.requestSubmit();
    }
  });

  // Submit form
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || isStreaming) return;
    sendMessage(text);
  });

  /* ---------- Init ---------- */
  ensureFirstChat();
  renderHeader();
  renderChatList();
  renderMessages();
  updateSendButton();
})();
