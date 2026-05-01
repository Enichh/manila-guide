const { handleCors, wrapResponse } = require("../_shared/cors.js");
const { TOOL_DEFINITIONS, executeTool } = require("./tools.js");
const supabase = require("./supabase.js");

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = {
  role: "system",
  content:
    "You are Manila Guide's friendly AI assistant — like a warm, knowledgeable local friend showing visitors around the city. " +
    "You help tourists discover the best spots in Manila: historical landmarks, " +
    "parks, museums, restaurants, and hidden gems. " +
    "You give concise, helpful answers about entrance fees, operating hours, " +
    "best times to visit, and how to get there. " +
    "You are warm, enthusiastic, and passionate about Filipino culture and history. " +
    "Keep responses under 3 paragraphs unless asked for detail. " +
    "Use a conversational tone — like you're chatting with a friend. " +
    "Do NOT use emojis in your responses. Keep it clean and professional. " +
    // --- IMPORTANT: How to talk to the user ---
    "NEVER show raw dates like '2025-06-15' or internal IDs to the user. " +
    "Instead say things like 'Friday, June 15th' or 'next Monday'. " +
    "Never mention item IDs, database IDs, or technical details — the user doesn't need them. " +
    "When tools return results, restate them naturally in your own warm words. " +
    // --- Itinerary management capability ---
    "You can also help users manage their personal trip itinerary. " +
    "When a user asks to plan, add, remove, change, or view their itinerary, " +
    "use the available tools to perform those actions directly. " +
    "Always confirm successful changes with a friendly, encouraging summary. " +
    "If a tool returns an error or indicates the user is not signed in, " +
    "politely ask them to sign in first before explaining what went wrong. " +
    "When the user wants to add a spot but doesn't specify a date or time, " +
    "ask them for the missing information instead of guessing.",
};

// ---------------------------------------------------------------------------
// Mistral API configuration
// ---------------------------------------------------------------------------
const MISTRAL_API_URL = "https://api.mistral.ai/v1/chat/completions";

/** Maximum tool-calling loop iterations to prevent infinite loops. */
const MAX_TOOL_ITERATIONS = 5;

// ---------------------------------------------------------------------------
// Round-robin key rotation
// ---------------------------------------------------------------------------

/** @type {string[]|null} Parsed array of Mistral API keys (loaded lazily). */
let apiKeys = null;

/** Current round-robin index (module-scoped; persists across warm invocations). */
let keyIndex = 0;

/**
 * Loads keys from `process.env.MISTRAL_API_KEYS` on first use and returns the
 * next key in the rotation.
 *
 * @returns {string} A single Mistral API key.
 * @throws {Error} If no keys are configured.
 */
function getNextKey() {
  if (!apiKeys) {
    const raw = process.env.MISTRAL_API_KEYS || "";
    apiKeys = raw
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);

    if (apiKeys.length === 0) {
      throw new Error("No MISTRAL_API_KEYS configured in environment.");
    }
  }

  const key = apiKeys[keyIndex];
  keyIndex = (keyIndex + 1) % apiKeys.length;
  return key;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Send a chat completion request to Mistral with optional tool definitions.
 *
 * @param {object[]} messages     Conversation messages (including system prompt)
 * @param {object[]} tools        Mistral tool definitions array
 * @param {string}   apiKey       Mistral API key
 * @returns {Promise<object>}     Parsed Mistral API response JSON
 */
async function callMistral(messages, tools, apiKey) {
  const response = await fetch(MISTRAL_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "mistral-small-latest",
      messages,
      tools,
      max_tokens: 1000,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Mistral API returned ${response.status}: ${errorText}`);
  }

  return await response.json();
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

exports.handler = async (event) => {
  // --- CORS preflight ----------------------------------------------------
  const corsResponse = handleCors(event);
  if (corsResponse) return corsResponse;

  // --- Method guard ------------------------------------------------------
  if (event.httpMethod !== "POST") {
    return wrapResponse(405, "Method not allowed");
  }

  // --- Parse body --------------------------------------------------------
  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return wrapResponse(400, "Invalid JSON body");
  }

  const { messages, userId } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return wrapResponse(
      400,
      'Missing or invalid "messages" array in request body.',
    );
  }

  // userId is optional — tools that require it will return a helpful
  // message asking the user to sign in when it's missing.

  // --- Prepend the system prompt -----------------------------------------
  const conversationMessages = [SYSTEM_PROMPT, ...messages];

  // --- Pick an API key (round-robin) -------------------------------------
  let apiKey;
  try {
    apiKey = getNextKey();
  } catch (err) {
    return wrapResponse(500, err.message);
  }

  // =======================================================================
  // TOOL-CALLING LOOP
  // =======================================================================
  //
  // We send the conversation to Mistral with our tool definitions.  If
  // Mistral responds with one or more tool_calls we execute those tools
  // against Supabase, feed the results back into the conversation, and
  // loop.  Mistral then uses those results to produce the final natural-
  // language answer.  We cap iterations at MAX_TOOL_ITERATIONS to guard
  // against infinite loops.
  // =======================================================================

  try {
    // Work on a mutable copy of the messages array
    let currentMessages = [...conversationMessages];

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      // --- Send to Mistral (with tools) ----------------------------------
      const data = await callMistral(currentMessages, TOOL_DEFINITIONS, apiKey);

      const assistantMessage = data?.choices?.[0]?.message;

      if (!assistantMessage) {
        return wrapResponse(
          500,
          "Unexpected response format from Mistral API.",
        );
      }

      // --- No tool calls?  Return the text reply directly. ---------------
      if (
        !assistantMessage.tool_calls ||
        assistantMessage.tool_calls.length === 0
      ) {
        const reply = assistantMessage.content || "";
        return wrapResponse(200, JSON.stringify({ reply }));
      }

      // --- Otherwise, Mistral is requesting tool executions. -------------
      //     Push the assistant's message (which contains the tool_calls)
      //     into the conversation so Mistral sees what it asked for.
      currentMessages.push(assistantMessage);

      for (const toolCall of assistantMessage.tool_calls) {
        const { id, function: fn } = toolCall;

        // Parse the JSON arguments string from Mistral
        let parsedArgs;
        try {
          parsedArgs = JSON.parse(fn.arguments);
        } catch {
          // If parsing fails, feed the error back as a tool result
          currentMessages.push({
            role: "tool",
            tool_call_id: id,
            content: `Invalid JSON arguments: ${fn.arguments}`,
          });
          continue;
        }

        // Execute the tool against Supabase
        let toolResult;
        try {
          toolResult = await executeTool(
            fn.name,
            parsedArgs,
            supabase,
            userId || null,
          );
        } catch (err) {
          toolResult = `Tool execution error (${fn.name}): ${err.message}`;
        }

        // Feed the tool result back into the conversation
        currentMessages.push({
          role: "tool",
          tool_call_id: id,
          content: toolResult,
        });
      }

      // --- Loop continues — Mistral will now see the tool results -------
      //     and either call more tools or produce a final text answer.
    }

    // --- Exceeded max iterations — return a fallback --------------------
    return wrapResponse(
      200,
      JSON.stringify({
        reply:
          "I encountered an issue processing your request. " +
          "Please try again with a simpler request.",
      }),
    );
  } catch (err) {
    return wrapResponse(500, `Unexpected error: ${err.message}`);
  }
};
