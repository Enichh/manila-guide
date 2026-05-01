// ---------------------------------------------------------------------------
// chat-api.js — Chat API Service (DIP / Anti-Corruption Layer)
// ---------------------------------------------------------------------------
// The UI layer never touches fetch URLs or Mistral directly.  All chat AI
// I/O flows through this class, making it trivial to swap backends later.
//
// Exports (default):
//   ChatApi
// ---------------------------------------------------------------------------

/**
 * @typedef {object} ChatResult
 * @property {string|null} reply  - The AI assistant's reply text on success.
 * @property {Error|null}  error  - An Error instance on failure.
 */

/**
 * @typedef {object} ChatMessage
 * @property {string} role    - One of `"system"`, `"user"`, or `"assistant"`.
 * @property {string} content - The message body.
 */

/**
 * Encapsulates every AI-chat I/O operation — the only method talks to the
 * Netlify Function `/ai-proxy`, which forwards requests to Mistral (or
 * whichever LLM is configured server‑side).
 *
 * **No dependencies** — the constructor takes nothing, keeping the class
 * trivially constructable and true to the Dependency Inversion Principle.
 */
export default class ChatApi {
  constructor() {
    // Intentionally empty — this service is a pure stateless HTTP adapter.
  }

  /**
   * Send an array of conversation messages to the AI backend and get a reply.
   *
   * **Important:** The caller is responsible for maintaining the full message
   * history if a multi‑turn conversation is desired.  This method simply
   * forwards whatever `messages` it receives.
   *
   * @param {ChatMessage[]} messages - The conversation history to send.
   * @param {string|null}  [userId=null] - Optional authenticated user ID for
   *   per‑user operations (e.g. itinerary CRUD).  Passed through to the
   *   Netlify Function as `body.userId`.
   * @returns {Promise<ChatResult>}
   *
   * @example
   * const chatApi = new ChatApi();
   * const { reply, error } = await chatApi.sendMessage([
   *   { role: 'system', content: 'You are a helpful Manila tour guide.' },
   *   { role: 'user',   content: 'Best places to visit in Intramuros?' },
   * ]);
   *
   * if (error) {
   *   console.error('Chat failed:', error.message);
   * } else {
   *   console.log('AI reply:', reply);
   * }
   */
  async sendMessage(messages, userId = null) {
    try {
      const body = { messages };
      if (userId) body.userId = userId;

      const response = await fetch("/.netlify/functions/ai-proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const message = await response.text();
        return {
          reply: null,
          error: new Error(message || `ai-proxy failed (${response.status})`),
        };
      }

      const data = await response.json();
      return { reply: data.reply, error: null };
    } catch (err) {
      return {
        reply: null,
        error: err instanceof Error ? err : new Error(String(err)),
      };
    }
  }
}
