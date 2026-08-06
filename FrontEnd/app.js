"use strict";

const STORAGE_KEYS = Object.freeze({
  chats: "multi-chat.chats.v1",
  settings: "multi-chat.settings.v1",
  activeChat: "multi-chat.active-chat.v1",
});

const DEFAULT_SETTINGS = Object.freeze({
  baseUrl: window.location.origin,
  endpoint: "/v1/chat/text",
});

const NEW_CHAT_TITLE = "محادثة جديدة";
const REQUEST_TIMEOUT_MS = 60_000;

const state = {
  chats: loadJSON(STORAGE_KEYS.chats, []),
  activeChatId: localStorage.getItem(STORAGE_KEYS.activeChat),
  settings: {
    ...DEFAULT_SETTINGS,
    ...loadJSON(STORAGE_KEYS.settings, {}),
  },
  searchTerm: "",
  pendingChatIds: new Set(),
  requestControllers: new Map(),
};

const elements = {
  sidebar: document.getElementById("sidebar"),
  sidebarOverlay: document.getElementById("sidebarOverlay"),
  openSidebarButton: document.getElementById("openSidebarBtn"),
  closeSidebarButton: document.getElementById("closeSidebarBtn"),
  newChatButton: document.getElementById("newChatBtn"),
  chatSearch: document.getElementById("chatSearch"),
  chatList: document.getElementById("chatList"),
  baseUrlInput: document.getElementById("baseUrlInput"),
  endpointInput: document.getElementById("endpointInput"),
  saveSettingsButton: document.getElementById("saveSettingsBtn"),
  statusDot: document.getElementById("statusDot"),
  chatTitle: document.getElementById("chatTitle"),
  threadLabel: document.getElementById("threadLabel"),
  clearChatButton: document.getElementById("clearChatBtn"),
  messages: document.getElementById("messages"),
  emptyState: document.getElementById("emptyState"),
  chatForm: document.getElementById("chatForm"),
  messageInput: document.getElementById("messageInput"),
  sendButton: document.getElementById("sendBtn"),
  toast: document.getElementById("toast"),
};

let toastTimer = null;

initialize();

function initialize() {
  normalizeSavedChats();
  ensureActiveChat();

  elements.baseUrlInput.value = state.settings.baseUrl;
  elements.endpointInput.value = state.settings.endpoint;

  bindEvents();
  persistState();
  render();
  elements.messageInput.focus();
}

function bindEvents() {
  elements.newChatButton.addEventListener("click", () => {
    createChat();
    closeSidebar();
    elements.messageInput.focus();
  });

  elements.chatSearch.addEventListener("input", (event) => {
    state.searchTerm = event.target.value.trim().toLowerCase();
    renderChatList();
  });

  elements.chatForm.addEventListener("submit", handleSubmit);

  elements.messageInput.addEventListener("input", autoResizeTextarea);
  elements.messageInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      elements.chatForm.requestSubmit();
    }
  });

  elements.saveSettingsButton.addEventListener("click", saveSettings);
  elements.clearChatButton.addEventListener("click", clearActiveChat);

  elements.openSidebarButton.addEventListener("click", openSidebar);
  elements.closeSidebarButton.addEventListener("click", closeSidebar);
  elements.sidebarOverlay.addEventListener("click", closeSidebar);

  document.querySelectorAll("[data-prompt]").forEach((button) => {
    button.addEventListener("click", () => {
      elements.messageInput.value = button.dataset.prompt || "";
      autoResizeTextarea();
      elements.messageInput.focus();
    });
  });

  window.addEventListener("beforeunload", persistState);
}

function normalizeSavedChats() {
  if (!Array.isArray(state.chats)) {
    state.chats = [];
    return;
  }

  state.chats = state.chats
    .filter((chat) => chat && chat.id)
    .map((chat) => {
      const createdAt = toTimestamp(chat.createdAt, Date.now());
      const messages = Array.isArray(chat.messages)
        ? chat.messages.map(normalizeMessage).filter(Boolean)
        : [];

      return {
        id: String(chat.id),
        threadId: String(chat.threadId || chat.thread_id || createThreadId()),
        title: String(chat.title || NEW_CHAT_TITLE),
        messages,
        createdAt,
        updatedAt: toTimestamp(chat.updatedAt, createdAt),
      };
    })
    .sort((first, second) => second.updatedAt - first.updatedAt);
}

function normalizeMessage(message) {
  if (!message || typeof message !== "object") {
    return null;
  }

  const content = String(message.content ?? message.text ?? "").trim();
  if (!content) {
    return null;
  }

  return {
    id: String(message.id || createId("msg")),
    role: message.role === "user" ? "user" : "assistant",
    content,
    isError: Boolean(message.isError),
    timestamp: toTimestamp(message.timestamp, Date.now()),
  };
}

function ensureActiveChat() {
  if (!state.chats.length) {
    createChat({ renderAfterCreate: false });
    return;
  }

  const activeChatExists = state.chats.some(
    (chat) => chat.id === state.activeChatId,
  );

  if (!activeChatExists) {
    state.activeChatId = state.chats[0].id;
  }
}

function createChat({ renderAfterCreate = true } = {}) {
  const now = Date.now();
  const chat = {
    id: createId("chat"),
    threadId: createThreadId(),
    title: NEW_CHAT_TITLE,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };

  state.chats.unshift(chat);
  state.activeChatId = chat.id;
  persistState();

  if (renderAfterCreate) {
    render();
  }

  return chat;
}

function switchChat(chatId) {
  const chatExists = state.chats.some((chat) => chat.id === chatId);
  if (!chatExists) {
    return;
  }

  state.activeChatId = chatId;
  elements.messageInput.value = "";
  autoResizeTextarea();
  persistState();
  render();
  closeSidebar();
  elements.messageInput.focus();
}

function deleteChat(chatId) {
  const chat = getChatById(chatId);
  if (!chat) {
    return;
  }

  const confirmed = window.confirm(`هل تريد حذف "${chat.title}"؟`);
  if (!confirmed) {
    return;
  }

  abortChatRequest(chatId);
  state.chats = state.chats.filter((item) => item.id !== chatId);

  if (!state.chats.length) {
    createChat({ renderAfterCreate: false });
  } else if (state.activeChatId === chatId) {
    state.activeChatId = state.chats[0].id;
  }

  persistState();
  render();
}

function clearActiveChat() {
  const chat = getActiveChat();
  if (!chat || !chat.messages.length) {
    return;
  }

  if (isChatPending(chat.id)) {
    showToast("انتظر اكتمال الرد قبل مسح المحادثة.", true);
    return;
  }

  const confirmed = window.confirm("هل تريد مسح جميع رسائل هذه المحادثة؟");
  if (!confirmed) {
    return;
  }

  chat.messages = [];
  chat.title = NEW_CHAT_TITLE;
  chat.updatedAt = Date.now();
  persistState();
  render();
}

async function handleSubmit(event) {
  event.preventDefault();

  const chat = getActiveChat();
  const text = elements.messageInput.value.trim();

  if (!chat || !text || isChatPending(chat.id)) {
    return;
  }

  addMessage(chat, "user", text);
  updateChatTitle(chat, text);

  elements.messageInput.value = "";
  autoResizeTextarea();

  const chatId = chat.id;
  const threadId = chat.threadId;
  const controller = new AbortController();
  let requestTimedOut = false;

  state.pendingChatIds.add(chatId);
  state.requestControllers.set(chatId, controller);
  persistState();
  render();

  const timeoutId = window.setTimeout(() => {
    requestTimedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const payload = await sendToApi({
      text,
      threadId,
      signal: controller.signal,
    });

    const currentChat = getChatById(chatId);
    if (!currentChat) {
      return;
    }

    addMessage(currentChat, "assistant", extractAssistantText(payload));
    setConnectionStatus("ok");
  } catch (error) {
    const currentChat = getChatById(chatId);

    if (!currentChat) {
      return;
    }

    const friendlyMessage = requestTimedOut
      ? "انتهت مهلة الطلب بعد 60 ثانية."
      : formatError(error);

    addMessage(
      currentChat,
      "assistant",
      `تعذر إرسال الطلب.\n\n${friendlyMessage}`,
      true,
    );
    setConnectionStatus("error");
    showToast(friendlyMessage, true);
  } finally {
    window.clearTimeout(timeoutId);
    state.pendingChatIds.delete(chatId);
    state.requestControllers.delete(chatId);
    persistState();
    render();

    if (state.activeChatId === chatId) {
      elements.messageInput.focus();
    }
  }
}

async function sendToApi({ text, threadId, signal }) {
  const url = buildApiUrl();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      text,
      thread_id: String(threadId),
    }),
    signal,
  });

  const rawBody = await response.text();
  const body = parseResponseBody(rawBody, response.headers.get("content-type"));

  if (!response.ok) {
    const details = extractServerError(body) || response.statusText;
    throw new Error(`HTTP ${response.status}: ${details}`);
  }

  return body;
}

function buildApiUrl() {
  const baseUrl = state.settings.baseUrl.replace(/\/+$/, "");
  const endpoint = `/${state.settings.endpoint.replace(/^\/+/, "")}`;
  return `${baseUrl}${endpoint}`;
}

function parseResponseBody(rawBody, contentType = "") {
  if (!rawBody) {
    return null;
  }

  const trimmedBody = rawBody.trim();
  const mayBeJson =
    contentType.includes("application/json") ||
    trimmedBody.startsWith("{") ||
    trimmedBody.startsWith("[") ||
    trimmedBody === "null";

  if (!mayBeJson) {
    return rawBody;
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    return rawBody;
  }
}

function extractAssistantText(payload) {
  const directText = normalizeContentValue(payload);
  if (directText) {
    return directText;
  }

  if (!payload || typeof payload !== "object") {
    return "تم استلام رد فارغ من الخادم.";
  }

  const candidatePaths = [
    ["reply"],
    ["response"],
    ["answer"],
    ["text"],
    ["content"],
    ["message"],
    ["output"],
    ["result"],
    ["data", "reply"],
    ["data", "response"],
    ["data", "answer"],
    ["data", "text"],
    ["data", "content"],
    ["data", "message"],
    ["data", "output"],
    ["data", "result"],
    ["choices", 0, "message", "content"],
    ["choices", 0, "text"],
  ];

  for (const path of candidatePaths) {
    const value = getNestedValue(payload, path);
    const text = normalizeContentValue(value);

    if (text) {
      return text;
    }
  }

  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return "تم استلام رد غير قابل للعرض من الخادم.";
  }
}

function normalizeContentValue(value) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    const parts = value
      .map((item) => {
        if (typeof item === "string") {
          return item.trim();
        }

        if (item && typeof item === "object") {
          return normalizeContentValue(
            item.text ?? item.content ?? item.message ?? item.value,
          );
        }

        return "";
      })
      .filter(Boolean);

    return parts.join("\n");
  }

  if (value && typeof value === "object") {
    const nestedValue =
      value.content ??
      value.text ??
      value.reply ??
      value.answer ??
      value.message;

    if (nestedValue !== undefined && nestedValue !== value) {
      return normalizeContentValue(nestedValue);
    }
  }

  return "";
}

function extractServerError(body) {
  if (typeof body === "string") {
    return body.trim();
  }

  if (!body || typeof body !== "object") {
    return "";
  }

  const value =
    body.detail ??
    body.error ??
    body.message ??
    body.reason ??
    body.errors;

  if (typeof value === "string") {
    return value;
  }

  if (value !== undefined) {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  try {
    return JSON.stringify(body);
  } catch {
    return "";
  }
}

function getNestedValue(object, path) {
  return path.reduce((currentValue, key) => {
    if (currentValue === null || currentValue === undefined) {
      return undefined;
    }

    return currentValue[key];
  }, object);
}

function addMessage(chat, role, content, isError = false) {
  chat.messages.push({
    id: createId("msg"),
    role,
    content: String(content),
    isError,
    timestamp: Date.now(),
  });

  chat.updatedAt = Date.now();
  sortChatsByLastUpdate();
}

function updateChatTitle(chat, text) {
  const userMessageCount = chat.messages.filter(
    (message) => message.role === "user",
  ).length;

  if (userMessageCount !== 1 || chat.title !== NEW_CHAT_TITLE) {
    return;
  }

  const normalizedText = text.replace(/\s+/g, " ").trim();
  chat.title =
    normalizedText.length > 34
      ? `${normalizedText.slice(0, 34)}…`
      : normalizedText;
}

function sortChatsByLastUpdate() {
  state.chats.sort((first, second) => second.updatedAt - first.updatedAt);
}

function render() {
  renderChatList();
  renderActiveChat();
}

function renderChatList() {
  const filteredChats = state.chats.filter((chat) => {
    if (!state.searchTerm) {
      return true;
    }

    const lastMessage = chat.messages.at(-1)?.content || "";
    const searchableText = `${chat.title} ${lastMessage}`.toLowerCase();
    return searchableText.includes(state.searchTerm);
  });

  elements.chatList.replaceChildren();

  if (!filteredChats.length) {
    const emptyMessage = document.createElement("p");
    emptyMessage.textContent = "لا توجد نتائج.";
    emptyMessage.style.cssText =
      "color: var(--muted); font-size: 12px; text-align: center; padding: 20px 0;";
    elements.chatList.appendChild(emptyMessage);
    return;
  }

  filteredChats.forEach((chat) => {
    elements.chatList.appendChild(createChatListItem(chat));
  });
}

function createChatListItem(chat) {
  const item = document.createElement("div");
  item.className = `chat-item${
    chat.id === state.activeChatId ? " active" : ""
  }`;
  item.setAttribute("role", "button");
  item.setAttribute("aria-label", `فتح ${chat.title}`);
  item.tabIndex = 0;

  const content = document.createElement("div");
  content.className = "chat-item-content";

  const title = document.createElement("div");
  title.className = "chat-item-title";
  title.textContent = chat.title;

  const preview = document.createElement("div");
  preview.className = "chat-item-preview";
  preview.textContent = isChatPending(chat.id)
    ? "جاري انتظار الرد..."
    : chat.messages.at(-1)?.content || "لا توجد رسائل بعد";

  const deleteButton = document.createElement("button");
  deleteButton.className = "chat-delete";
  deleteButton.type = "button";
  deleteButton.title = "حذف المحادثة";
  deleteButton.setAttribute("aria-label", `حذف ${chat.title}`);
  deleteButton.textContent = "×";

  content.append(title, preview);
  item.append(content, deleteButton);

  item.addEventListener("click", () => switchChat(chat.id));
  item.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      switchChat(chat.id);
    }
  });

  deleteButton.addEventListener("click", (event) => {
    event.stopPropagation();
    deleteChat(chat.id);
  });

  return item;
}

function renderActiveChat() {
  const chat = getActiveChat();
  if (!chat) {
    return;
  }

  const chatIsPending = isChatPending(chat.id);

  elements.chatTitle.textContent = chat.title;
  elements.threadLabel.textContent = `Thread ID: ${chat.threadId}`;
  elements.clearChatButton.disabled =
    !chat.messages.length || chatIsPending;

  elements.messages.replaceChildren();
  chat.messages.forEach((message) => {
    elements.messages.appendChild(createMessageElement(message));
  });

  if (chatIsPending) {
    elements.messages.appendChild(createTypingIndicator());
  }

  elements.emptyState.classList.toggle(
    "hidden",
    chat.messages.length > 0 || chatIsPending,
  );

  updateComposerState(chatIsPending);
  requestAnimationFrame(scrollMessagesToBottom);
}

function createMessageElement(message) {
  const row = document.createElement("article");
  row.className = `message-row ${message.role}`;

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";

  if (message.isError) {
    bubble.style.borderColor = "rgba(255, 109, 136, 0.35)";
  }

  const content = document.createElement("div");
  content.className = "message-content";
  content.textContent = message.content;

  const meta = document.createElement("div");
  meta.className = "message-meta";

  const copyButton = document.createElement("button");
  copyButton.className = "copy-message";
  copyButton.type = "button";
  copyButton.textContent = "نسخ";
  copyButton.addEventListener("click", async () => {
    const copied = await copyText(message.content);
    showToast(copied ? "تم نسخ الرسالة." : "تعذر نسخ الرسالة.", !copied);
  });

  const time = document.createElement("span");
  time.textContent = formatTime(message.timestamp);

  meta.append(copyButton, time);
  bubble.append(content, meta);
  row.appendChild(bubble);

  return row;
}

function createTypingIndicator() {
  const row = document.createElement("article");
  row.className = "message-row assistant";

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  bubble.setAttribute("aria-label", "جاري كتابة الرد");

  const dots = document.createElement("div");
  dots.className = "typing-dots";
  dots.append(
    document.createElement("span"),
    document.createElement("span"),
    document.createElement("span"),
  );

  bubble.appendChild(dots);
  row.appendChild(bubble);
  return row;
}

function updateComposerState(chatIsPending) {
  elements.sendButton.disabled = chatIsPending;
  elements.messageInput.disabled = chatIsPending;

  const label = elements.sendButton.querySelector("span:first-child");
  if (label) {
    label.textContent = chatIsPending ? "انتظر" : "إرسال";
  }
}

function saveSettings() {
  const baseUrl = elements.baseUrlInput.value.trim().replace(/\/+$/, "");
  const rawEndpoint = elements.endpointInput.value.trim();

  if (!baseUrl || !rawEndpoint) {
    showToast("أدخل Base URL و Endpoint.", true);
    return;
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(baseUrl);
  } catch {
    showToast("Base URL غير صالح.", true);
    return;
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    showToast("Base URL يجب أن يبدأ بـ http أو https.", true);
    return;
  }

  state.settings = {
    baseUrl,
    endpoint: rawEndpoint.startsWith("/")
      ? rawEndpoint
      : `/${rawEndpoint}`,
  };

  elements.baseUrlInput.value = state.settings.baseUrl;
  elements.endpointInput.value = state.settings.endpoint;
  saveJSON(STORAGE_KEYS.settings, state.settings);
  showToast("تم حفظ إعدادات الاتصال.");
}

function setConnectionStatus(status) {
  elements.statusDot.classList.remove("ok", "error");

  if (status === "ok" || status === "error") {
    elements.statusDot.classList.add(status);
  }
}

function getActiveChat() {
  return getChatById(state.activeChatId);
}

function getChatById(chatId) {
  return state.chats.find((chat) => chat.id === chatId);
}

function isChatPending(chatId) {
  return state.pendingChatIds.has(chatId);
}

function abortChatRequest(chatId) {
  const controller = state.requestControllers.get(chatId);
  if (controller) {
    controller.abort();
  }

  state.requestControllers.delete(chatId);
  state.pendingChatIds.delete(chatId);
}

function persistState() {
  saveJSON(STORAGE_KEYS.chats, state.chats);

  try {
    localStorage.setItem(STORAGE_KEYS.activeChat, state.activeChatId || "");
  } catch {
    // The UI can continue working even when localStorage is unavailable.
  }
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota or privacy mode errors.
  }
}

function loadJSON(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function createId(prefix) {
  const randomPart =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return `${prefix}-${randomPart}`;
}

function createThreadId() {
  return createId("thread");
}

function toTimestamp(value, fallback) {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) ? timestamp : fallback;
}

function formatTime(timestamp) {
  return new Intl.DateTimeFormat("ar", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function formatError(error) {
  if (error?.name === "AbortError") {
    return "تم إلغاء الطلب.";
  }

  const message = error?.message || "حدث خطأ غير معروف.";

  if (message.toLowerCase().includes("failed to fetch")) {
    return "تعذر الاتصال بالخادم. تأكد أن API يعمل وأن CORS يسمح بعنوان الواجهة.";
  }

  return message;
}

async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Continue to the fallback method.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();

  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }

  textarea.remove();
  return copied;
}

function autoResizeTextarea() {
  elements.messageInput.style.height = "auto";
  elements.messageInput.style.height = `${Math.min(
    elements.messageInput.scrollHeight,
    160,
  )}px`;
}

function scrollMessagesToBottom() {
  elements.messages.scrollTop = elements.messages.scrollHeight;
}

function showToast(message, isError = false) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.toggle("error", isError);
  elements.toast.classList.add("show");

  toastTimer = window.setTimeout(() => {
    elements.toast.classList.remove("show");
  }, 3200);
}

function openSidebar() {
  elements.sidebar.classList.add("open");
  elements.sidebarOverlay.classList.add("show");
}

function closeSidebar() {
  elements.sidebar.classList.remove("open");
  elements.sidebarOverlay.classList.remove("show");
}
