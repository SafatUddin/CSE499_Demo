const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const model = process.env.OLLAMA_MODEL || 'qwen2.5:3b';

export const ollamaEnabled = process.env.OLLAMA_ENABLED !== 'false';

interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Calls Ollama's /api/chat with a JSON schema to force structured output, matching the
// shape we previously got from Gemini's responseSchema. Throws on any failure so callers
// can fall back to the local rule-based simulator, same as the old Gemini error handling.
export async function ollamaChatJSON(messages: OllamaChatMessage[], schema: object): Promise<string> {
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      format: schema,
      // Ollama unloads a model from VRAM after 5 minutes idle by default, and reloading
      // it mid-conversation costs ~90s. Keep it resident indefinitely instead — this
      // process only ever talks to one model, so there's no reason to evict it.
      keep_alive: -1,
      options: { temperature: 0.7, num_predict: 400 },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama request failed: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  return data.message?.content;
}

// Fire-and-forget request to force the model into VRAM at server startup, so the first
// real customer message doesn't pay the ~90s cold-load cost itself.
export function warmUpOllama() {
  if (!ollamaEnabled) return;
  fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: 'hi' }], stream: false, keep_alive: -1 }),
  })
    .then(() => console.log(`Ollama model "${model}" warmed up.`))
    .catch((err) => console.error('Ollama warm-up failed (will retry on first real message):', err.message));
}
