// ---------------------------------------------------------------------------
// chat-widget.js — Floating Chat Widget for Manila Guide AI Assistant
// ---------------------------------------------------------------------------
// Renders a floating chat toggle button and expandable chat panel for
// interacting with the Manila Guide AI.  All API I/O goes through ChatApi.
// Uses event delegation on the widget container for all click handlers.
//
// Exports (default): ChatWidget
// ---------------------------------------------------------------------------

/**
 * Floating chat widget component.
 *
 * **Single Responsibility:** Own the chat UI — rendering, toggling open/close,
 * message display, typing indicator, and error handling.  All network I/O is
 * delegated to the injected `ChatApi` instance.
 *
 * All external dependencies arrive via the constructor (DI).
 */
export default class ChatWidget {
  /**
   * @param {import('../services/chat-api.js').default} chatApi - Chat AI adapter
   * @param {import('../core/event-bus.js')} eventBus - Pub/sub event bus
   * @param {import('../services/session-store.js').default} sessionStore - Session store for reading userId
   */
  constructor(chatApi, eventBus, sessionStore) {
    /** @private */
    this._chatApi = chatApi;
    /** @private */
    this._eventBus = eventBus;
    /** @private */
    this._sessionStore = sessionStore;

    // Bound handlers (stored for cleanup)
    /** @private */
    this._onContainerClick = this._onContainerClick.bind(this);
    /** @private */
    this._onKeyDown = this._onKeyDown.bind(this);

    // State
    /** @private */
    this._isOpen = false;

    /**
     * Full conversation history sent to the AI each turn.
     * Starts with a system prompt that sets the persona but is never displayed.
     * @private
     * @type {Array<{ role: string, content: string }>}
     */
    this._messageHistory = [
      {
        role: "system",
        content:
          "You are Manila Guide AI, a friendly and knowledgeable tour guide specializing in Manila, Philippines. " +
          "You help tourists and locals discover historical landmarks, parks, local food spots, and cultural attractions. " +
          "You provide accurate information about entrance fees, operating hours, schedules, transportation tips, and nearby points of interest. " +
          "Keep responses concise, warm, and helpful. Use emoji sparingly for a friendly tone. " +
          "When recommending places, mention practical details like fees, best times to visit, and how to get there. " +
          "If you do not know something, say so honestly rather than making up information.",
      },
    ];
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Create the widget DOM, inject CSS styles, and attach event listeners.
   * Safe to call multiple times — previous state is cleaned up first.
   */
  init() {
    // Prevent double-initialization
    if (document.getElementById("chatWidget")) return;

    this._injectStyles();
    this._render();
    this._attachListeners();
  }

  /**
   * Open the chat panel with a slide-up animation.
   */
  open() {
    const panel = document.getElementById("chatPanel");
    if (!panel) return;

    panel.classList.add("open");
    this._isOpen = true;

    const toggleBtn = document.getElementById("chatToggle");
    if (toggleBtn) {
      toggleBtn.classList.add("active");
    }

    // Focus the input when opening
    setTimeout(() => {
      const input = document.getElementById("chatInput");
      if (input) input.focus();
    }, 300);
  }

  /**
   * Close the chat panel.
   */
  close() {
    const panel = document.getElementById("chatPanel");
    if (!panel) return;

    panel.classList.remove("open");
    this._isOpen = false;

    const toggleBtn = document.getElementById("chatToggle");
    if (toggleBtn) {
      toggleBtn.classList.remove("active");
    }
  }

  /**
   * Toggle the chat panel open/closed.
   */
  toggle() {
    if (this._isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Remove the widget DOM, injected styles, and event listeners.
   * Call when the component is torn down.
   */
  cleanup() {
    this._removeListeners();

    const widget = document.getElementById("chatWidget");
    if (widget) widget.remove();

    const style = document.getElementById("chat-widget-styles");
    if (style) style.remove();

    this._isOpen = false;
  }

  // -----------------------------------------------------------------------
  // Private — rendering
  // -----------------------------------------------------------------------

  /**
   * Create the entire widget DOM structure and append it to `document.body`.
   * @private
   */
  _render() {
    const container = document.createElement("div");
    container.innerHTML = this._renderHTML();
    document.body.appendChild(container.firstElementChild);
  }

  /**
   * Return the full widget HTML string.
   * @returns {string}
   * @private
   */
  _renderHTML() {
    return `
<div class="chat-widget" id="chatWidget">
  <!-- Floating toggle button -->
  <button class="chat-toggle-btn" id="chatToggle" aria-label="Open chat">
    <span class="chat-toggle-icon">💬</span>
  </button>

  <!-- Chat panel (hidden by default) -->
  <div class="chat-panel" id="chatPanel">
    <!-- Header -->
    <div class="chat-header">
      <div class="chat-header-info">
        <div class="chat-avatar">🤖</div>
        <div>
          <div class="chat-title">Manila Guide AI</div>
          <div class="chat-subtitle">Ask me anything about Manila!</div>
        </div>
      </div>
      <button class="chat-close-btn" id="chatClose" aria-label="Close chat">✕</button>
    </div>

    <!-- Messages area -->
    <div class="chat-messages" id="chatMessages">
      <!-- Welcome message from assistant (not stored in history) -->
      <div class="chat-msg assistant">
        <div class="chat-msg-avatar">🤖</div>
        <div class="chat-msg-bubble">
          <p>Hello! I'm your Manila Guide assistant. Ask me about:</p>
          <ul>
            <li>🏛️ Historical landmarks</li>
            <li>🌳 Parks and outdoor spots</li>
            <li>🍽️ Local food recommendations</li>
            <li>💰 Entrance fees and schedules</li>
            <li>🚇 How to get around</li>
          </ul>
          <p>How can I help you today?</p>
        </div>
      </div>
    </div>

    <!-- Input area -->
    <div class="chat-input-area">
      <input
        type="text"
        class="chat-input"
        id="chatInput"
        placeholder="Ask about Manila landmarks, fees, schedules..."
        autocomplete="off"
      />
      <button class="chat-send-btn" id="chatSend" aria-label="Send message">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M2 9L16 2L9 16L8 10L2 9Z" fill="currentColor"/>
        </svg>
      </button>
    </div>
  </div>
</div>`;
  }

  // -----------------------------------------------------------------------
  // Private — styles injection
  // -----------------------------------------------------------------------

  /**
   * Inject the chat widget CSS into `document.head`.
   * Creates a `<style id="chat-widget-styles">` element.
   * @private
   */
  _injectStyles() {
    // Don't inject twice
    if (document.getElementById("chat-widget-styles")) return;

    const style = document.createElement("style");
    style.id = "chat-widget-styles";
    style.textContent = this._getCSS();
    document.head.appendChild(style);
  }

  /**
   * Return all CSS rules for the chat widget as a string.
   * @returns {string}
   * @private
   */
  _getCSS() {
    return `
/* ===================================================================
   Chat Widget — Floating AI Assistant
   =================================================================== */

/* --- Widget container --- */
.chat-widget {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 9999;
  font-family: inherit;
}

/* --- Toggle button --- */
.chat-toggle-btn {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: none;
  background: var(--navy);
  color: var(--white);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-lg);
  transition: background 0.2s ease, transform 0.2s ease;
  position: relative;
  z-index: 2;
}

.chat-toggle-btn:hover,
.chat-toggle-btn.active {
  background: var(--gold);
  transform: scale(1.06);
}

.chat-toggle-btn:active {
  transform: scale(0.96);
}

.chat-toggle-icon {
  font-size: 24px;
  line-height: 1;
}

/* --- Pulse animation on toggle button --- */
@keyframes chatPulse {
  0% {
    box-shadow: 0 0 0 0 rgba(184, 151, 90, 0.4);
  }
  70% {
    box-shadow: 0 0 0 14px rgba(184, 151, 90, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(184, 151, 90, 0);
  }
}

.chat-toggle-btn {
  animation: chatPulse 2.5s infinite;
}

.chat-toggle-btn:hover,
.chat-toggle-btn.active {
  animation: none;
}

/* --- Chat panel --- */
.chat-panel {
  position: absolute;
  bottom: 68px;
  right: 0;
  width: 360px;
  height: 520px;
  background: var(--white);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  opacity: 0;
  transform: translateY(16px) scale(0.95);
  pointer-events: none;
  transition: opacity 0.25s ease, transform 0.25s ease;
  border: 1px solid var(--border);
}

.chat-panel.open {
  opacity: 1;
  transform: translateY(0) scale(1);
  pointer-events: all;
}

/* --- Slide-up animation (used on initial open) --- */
@keyframes chatSlideUp {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.chat-panel.open {
  animation: chatSlideUp 0.3s ease forwards;
}

/* --- Header --- */
.chat-header {
  background: linear-gradient(135deg, var(--navy) 0%, var(--navy-mid) 100%);
  color: var(--white);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  flex-shrink: 0;
}

.chat-header-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.chat-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}

.chat-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--white);
  line-height: 1.2;
}

.chat-subtitle {
  font-size: 11px;
  color: var(--gold-light);
  line-height: 1.3;
}

.chat-close-btn {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.1);
  color: var(--white);
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s ease;
  flex-shrink: 0;
}

.chat-close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* --- Messages area --- */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background: var(--cream);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.chat-messages::-webkit-scrollbar {
  width: 5px;
}

.chat-messages::-webkit-scrollbar-track {
  background: transparent;
}

.chat-messages::-webkit-scrollbar-thumb {
  background: var(--border-mid);
  border-radius: 10px;
}

/* --- Message rows --- */
.chat-msg {
  display: flex;
  gap: 8px;
  align-items: flex-end;
}

.chat-msg.user {
  justify-content: flex-end;
}

/* --- Message avatar --- */
.chat-msg-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--gold-pale);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  flex-shrink: 0;
}

/* --- Message bubble --- */
.chat-msg-bubble {
  padding: 10px 14px;
  border-radius: var(--radius-md);
  max-width: 80%;
  word-break: break-word;
  font-size: 13.5px;
  line-height: 1.55;
}

.chat-msg-bubble p {
  margin: 0;
}

.chat-msg-bubble p + p {
  margin-top: 6px;
}

.chat-msg-bubble ul {
  margin: 6px 0 0 0;
  padding-left: 18px;
}

.chat-msg-bubble li {
  margin-bottom: 3px;
}

.chat-msg-bubble li:last-child {
  margin-bottom: 0;
}

/* Assistant bubble */
.chat-msg.assistant .chat-msg-bubble {
  background: var(--white);
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-top-left-radius: 4px;
}

/* User bubble */
.chat-msg.user .chat-msg-bubble {
  background: var(--navy);
  color: var(--white);
  border-top-right-radius: 4px;
}

/* --- Typing indicator --- */
.chat-msg-bubble.typing {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 12px 16px;
}

.typing-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--gold);
  display: inline-block;
  animation: chatBounce 1.4s infinite ease-in-out both;
}

.typing-dot:nth-child(1) {
  animation-delay: 0s;
}

.typing-dot:nth-child(2) {
  animation-delay: 0.16s;
}

.typing-dot:nth-child(3) {
  animation-delay: 0.32s;
}

@keyframes chatBounce {
  0%, 80%, 100% {
    transform: scale(0.6);
    opacity: 0.4;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

/* --- Input area --- */
.chat-input-area {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid var(--border);
  background: var(--white);
  flex-shrink: 0;
}

.chat-input {
  flex: 1;
  border: 1px solid var(--border);
  outline: none;
  padding: 10px 14px;
  border-radius: 20px;
  font-size: 13.5px;
  font-family: inherit;
  color: var(--text-primary);
  background: var(--cream);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.chat-input:focus {
  border-color: var(--gold);
  box-shadow: 0 0 0 3px rgba(184, 151, 90, 0.12);
}

.chat-input::placeholder {
  color: var(--text-muted);
}

.chat-send-btn {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: none;
  background: var(--gold);
  color: var(--white);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.2s ease, transform 0.15s ease;
}

.chat-send-btn:hover {
  background: var(--navy);
  transform: scale(1.08);
}

.chat-send-btn:active {
  transform: scale(0.94);
}

.chat-send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

/* --- Error message --- */
.chat-msg.error .chat-msg-bubble {
  background: var(--danger-bg);
  color: var(--danger);
  border: 1px solid rgba(153, 27, 27, 0.2);
  font-size: 12.5px;
  text-align: center;
  max-width: 100%;
  margin: 0 auto;
}

/* ===================================================================
   Responsive
   =================================================================== */
@media (max-width: 480px) {
  .chat-widget {
    bottom: 0;
    right: 0;
  }

  .chat-panel {
    width: 100vw;
    height: 100vh;
    /* Use dvh for better mobile support */
    height: 100dvh;
    max-height: 100dvh;
    bottom: 0;
    border-radius: 0;
    border: none;
  }

  .chat-panel.open {
    animation: chatSlideUpMobile 0.3s ease forwards;
  }

  @keyframes chatSlideUpMobile {
    from {
      opacity: 0;
      transform: translateY(30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .chat-toggle-btn {
    bottom: 16px;
    right: 16px;
    position: fixed;
  }

  .chat-header {
    padding: 16px;
  }

  .chat-close-btn {
    width: 34px;
    height: 34px;
    font-size: 16px;
  }
}
`;
  }

  // -----------------------------------------------------------------------
  // Private — event handling
  // -----------------------------------------------------------------------

  /**
   * Attach event listeners to the widget container and document.
   * Using event delegation on the widget container for all internal clicks.
   * @private
   */
  _attachListeners() {
    const widget = document.getElementById("chatWidget");
    if (!widget) return;

    widget.addEventListener("click", this._onContainerClick);

    // Keyboard shortcut: Enter to send
    document.addEventListener("keydown", this._onKeyDown);
  }

  /**
   * Remove event listeners.
   * @private
   */
  _removeListeners() {
    const widget = document.getElementById("chatWidget");
    if (widget) {
      widget.removeEventListener("click", this._onContainerClick);
    }

    document.removeEventListener("keydown", this._onKeyDown);
  }

  /**
   * Delegated click handler for the entire widget container.
   * Routes clicks to the appropriate handler based on the target.
   *
   * @param {MouseEvent} e
   * @private
   */
  _onContainerClick(e) {
    // Toggle button
    const toggleBtn = e.target.closest("#chatToggle");
    if (toggleBtn) {
      e.preventDefault();
      this.toggle();
      return;
    }

    // Close button
    const closeBtn = e.target.closest("#chatClose");
    if (closeBtn) {
      e.preventDefault();
      this.close();
      return;
    }

    // Send button
    const sendBtn = e.target.closest("#chatSend");
    if (sendBtn) {
      e.preventDefault();
      this._sendMessage();
      return;
    }
  }

  /**
   * Global keydown handler.
   * Enter submits the message (Shift+Enter and IME composition are ignored).
   *
   * @param {KeyboardEvent} e
   * @private
   */
  _onKeyDown(e) {
    // Only handle Enter when the chat input is focused
    if (e.key !== "Enter") return;
    if (e.isComposing) return; // Ignore IME composition

    const input = document.getElementById("chatInput");
    if (!input || document.activeElement !== input) return;

    // Shift+Enter for newline (not applicable to <input>, but be safe)
    if (e.shiftKey) return;

    e.preventDefault();
    this._sendMessage();
  }

  // -----------------------------------------------------------------------
  // Private — message sending
  // -----------------------------------------------------------------------

  /**
   * Read the input field, send the message to the AI, and display the reply.
   * @returns {Promise<void>}
   * @private
   */
  async _sendMessage() {
    const input = /** @type {HTMLInputElement} */ (
      document.getElementById("chatInput")
    );
    if (!input) return;

    const text = input.value.trim();
    if (!text) return;

    // Clear input and disable it while processing
    input.value = "";
    this._setInputEnabled(false);

    // Add user message to the chat panel and history
    this._addUserMessage(text);
    this._messageHistory.push({ role: "user", content: text });

    // Show typing indicator
    const typingEl = this._addTypingIndicator();

    // Scroll to bottom
    this._scrollToBottom();

    try {
      // Send full conversation history to the AI
      const userId = this._sessionStore.getUser()?.id || null;

      const { reply, error } = await this._chatApi.sendMessage(
        this._messageHistory,
        userId,
      );

      // Remove typing indicator
      this._removeTypingIndicator();

      if (error) {
        this._addErrorMessage(
          error.message || "Something went wrong. Please try again.",
        );
      } else if (reply) {
        // Add assistant reply to the chat panel and history
        this._addAssistantMessage(reply);
        this._messageHistory.push({ role: "assistant", content: reply });
      } else {
        this._addErrorMessage("No response received. Please try again.");
      }
    } catch (err) {
      this._removeTypingIndicator();
      this._addErrorMessage(
        err instanceof Error ? err.message : "An unexpected error occurred.",
      );
    }

    // Re-enable input and focus it
    this._setInputEnabled(true);
    const inputEl = document.getElementById("chatInput");
    if (inputEl) inputEl.focus();

    // Final scroll
    this._scrollToBottom();
  }

  // -----------------------------------------------------------------------
  // Private — DOM helpers
  // -----------------------------------------------------------------------

  /**
   * Append a user message bubble to the chat messages container.
   * @param {string} message
   * @private
   */
  _addUserMessage(message) {
    const messagesContainer = document.getElementById("chatMessages");
    if (!messagesContainer) return;

    const escaped = this._escapeHtml(message);
    const msgEl = document.createElement("div");
    msgEl.className = "chat-msg user";
    msgEl.innerHTML = `
      <div class="chat-msg-bubble">
        <p>${escaped}</p>
      </div>
    `;
    messagesContainer.appendChild(msgEl);
  }

  /**
   * Append an assistant message bubble to the chat messages container.
   * @param {string} message
   * @private
   */
  _addAssistantMessage(message) {
    const messagesContainer = document.getElementById("chatMessages");
    if (!messagesContainer) return;

    const escaped = this._escapeHtml(message);
    const msgEl = document.createElement("div");
    msgEl.className = "chat-msg assistant";
    msgEl.innerHTML = `
      <div class="chat-msg-avatar">🤖</div>
      <div class="chat-msg-bubble">
        <p>${escaped}</p>
      </div>
    `;
    messagesContainer.appendChild(msgEl);
  }

  /**
   * Append a typing indicator to the chat messages container.
   * @returns {HTMLElement} The typing indicator element.
   * @private
   */
  _addTypingIndicator() {
    const messagesContainer = document.getElementById("chatMessages");
    if (!messagesContainer) return null;

    const el = document.createElement("div");
    el.className = "chat-msg assistant typing-indicator";
    el.innerHTML = `
      <div class="chat-msg-avatar">🤖</div>
      <div class="chat-msg-bubble typing">
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
      </div>
    `;
    messagesContainer.appendChild(el);
    return el;
  }

  /**
   * Remove the typing indicator from the chat messages container.
   * @private
   */
  _removeTypingIndicator() {
    const indicator = document.querySelector(".typing-indicator");
    if (indicator) indicator.remove();
  }

  /**
   * Append an error message to the chat messages container.
   * @param {string} message
   * @private
   */
  _addErrorMessage(message) {
    const messagesContainer = document.getElementById("chatMessages");
    if (!messagesContainer) return;

    const escaped = this._escapeHtml(message);
    const msgEl = document.createElement("div");
    msgEl.className = "chat-msg error";
    msgEl.innerHTML = `
      <div class="chat-msg-bubble">
        <p>⚠️ ${escaped}</p>
      </div>
    `;
    messagesContainer.appendChild(msgEl);
  }

  /**
   * Scroll the chat messages container to the bottom.
   * @private
   */
  _scrollToBottom() {
    const messagesContainer = document.getElementById("chatMessages");
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  /**
   * Enable or disable the chat input and send button.
   * @param {boolean} enabled
   * @private
   */
  _setInputEnabled(enabled) {
    const input = /** @type {HTMLInputElement} */ (
      document.getElementById("chatInput")
    );
    const sendBtn = document.getElementById("chatSend");

    if (input) input.disabled = !enabled;
    if (sendBtn) sendBtn.disabled = !enabled;
  }

  // -----------------------------------------------------------------------
  // Private — utilities
  // -----------------------------------------------------------------------

  /**
   * Escape user-supplied text to prevent XSS.
   * Creates a text node and reads back innerHTML.
   *
   * @param {string} str
   * @returns {string}
   * @private
   */
  _escapeHtml(str) {
    const div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }
}
