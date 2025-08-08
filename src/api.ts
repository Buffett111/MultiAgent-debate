// API utility functions for calling different LLM providers.
// These functions read API keys from Vite's environment variables. Users need
// to create a `.env` file at the project root with the variables
// `VITE_OPENAI_API_KEY`, `VITE_GEMINI_API_KEY`, `VITE_ANTHROPIC_API_KEY` and
// `VITE_OPENROUTER_API_KEY`.
// See the README or documentation for details.

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Call OpenAI's GPT-4o reasoning model (o3-mini) via the Responses API.
 * Accepts an array of message objects and returns the assistant's reply.
 * If the API key is missing or the request fails, returns null.
 */
export async function callOpenAI(messages: ChatMessage[]): Promise<string | null> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) return null;
  const prompt = messages.map(m => `${m.role}: ${m.content}`).join('\n');
  try {
    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'OpenAI-Beta': 'reasoning=2'
      },
      body: JSON.stringify({
        model: 'o3-mini',
        reasoning: { effort: 'medium' },
        input: prompt,
        max_output_tokens: 512,
        temperature: 0.7
      })
    });
    if (!res.ok) {
      console.warn('OpenAI API error', await res.text());
      return null;
    }
    const data = await res.json();
    const content = data?.output?.[0]?.content?.[0]?.text as string | undefined;
    return content ?? null;
  } catch (err) {
    console.error('OpenAI API error', err);
    return null;
  }
}

/**
 * Call Google's Gemini API using the Gemini 2.5 Pro model.
 * Accepts a plain string prompt and returns the model's reply as a string.
 */
export async function callGemini(prompt: string): Promise<string | null> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) return null;
  const url =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent';
  const body = {
    contents: [
      {
        parts: [{ text: prompt }]
      }
    ]
  };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      console.warn('Gemini API error', await res.text());
      return null;
    }
    const data = await res.json();
    const content = data?.candidates?.[0]?.content?.parts?.[0]?.text as
      | string
      | undefined;
    return content ?? null;
  } catch (err) {
    console.error('Gemini API error', err);
    return null;
  }
}

/**
 * Call Anthropic's Claude Messages API. Accepts an array of message objects and
 * returns the assistant's reply as a string. If the API key is missing or
 * there is an error, returns null.
 */
export async function callAnthropic(
  messages: ChatMessage[]
): Promise<string | null> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const url = 'https://api.anthropic.com/v1/messages';
  const body = {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    temperature: 1,
    messages
  };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      console.warn('Anthropic API error', await res.text());
      return null;
    }
    const data = await res.json();
    const content = data?.content?.[0]?.text as string | undefined;
    return content ?? null;
  } catch (err) {
    console.error('Anthropic API error', err);
    return null;
  }
}

/**
 * Call the OpenRouter API using the free Llama 3.1 model.
 * Accepts an array of message objects and returns the assistant's reply.
 */
export async function callOpenRouter(
  messages: ChatMessage[]
): Promise<string | null> {
  const apiKey =
    import.meta.env.VITE_OPENROUTER_API_KEY || import.meta.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;
  const url = 'https://openrouter.ai/api/v1/chat/completions';
  const body = {
    model: 'nvidia/llama-3.1-nemotron-ultra-253b-v1:free',
    messages
  };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://example.com', // optional
        'X-Title': 'MultiAgent Debate' // optional
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      console.warn('OpenRouter API error', await res.text());
      return null;
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content as string | undefined;
    return content ?? null;
  } catch (err) {
    console.error('OpenRouter API error', err);
    return null;
  }
}
