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
  if (!apiKey) {
    console.error('OpenAI API key (VITE_OPENAI_API_KEY) is missing');
    return null;
  }
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        temperature: 0.7,
        max_tokens: 512,
        messages
      })
    });
    if (!res.ok) {
      console.warn('OpenAI Chat Completions API error', res.status, await res.text());
      return null;
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content as string | undefined;
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
 * Call the OpenRouter API using the free Llama‑3.1‑Nemotron‑Ultra‑253B‑v1 model,
 * which is derived from Meta's Llama‑3.1‑405B‑Instruct via neural architecture
 * search. The model is optimized for advanced reasoning, interactive chat,
 * retrieval‑augmented generation, and tool use, supporting up to 128K tokens of
 * context. Include a system prompt requesting detailed step‑by‑step thinking to
 * fully activate its reasoning capabilities. Accepts an array of message
 * objects and returns the assistant's reply.
 */
export async function callOpenRouter(
  messages: ChatMessage[]
): Promise<string | null> {
  const apiKey =
    import.meta.env.VITE_OPENROUTER_API_KEY || import.meta.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error('OpenRouter API key (VITE_OPENROUTER_API_KEY) is missing');
    return null;
  }
  const url = 'https://openrouter.ai/api/v1/chat/completions';
  const body = {
    // Prefer a widely available free-tier model
    model: 'meta-llama/llama-3.1-8b-instruct:free',
    messages
  };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const errorText = await res.text();
      console.warn('OpenRouter API error', res.status, errorText);
      // If model not found, retry with auto router
      if (res.status === 404) {
        const autoRes = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
          },
          body: JSON.stringify({ model: 'openrouter/auto', messages })
        });
        if (!autoRes.ok) {
          console.warn('OpenRouter auto route error', autoRes.status, await autoRes.text());
          return null;
        }
        const autoData = await autoRes.json();
        const autoRaw = autoData?.choices?.[0]?.message?.content as unknown;
        return typeof autoRaw === 'string' ? autoRaw : Array.isArray(autoRaw)
          ? autoRaw.map((p: any) => (typeof p?.text === 'string' ? p.text : '')).join('\n').trim() || null
          : null;
      }
      return null;
    }
    const data = await res.json();
    const rawContent = data?.choices?.[0]?.message?.content as unknown;
    let content: string | null = null;
    if (Array.isArray(rawContent)) {
      content = rawContent
        .map((p: any) => (typeof p?.text === 'string' ? p.text : ''))
        .join('\n')
        .trim();
      if (content.length === 0) content = null;
    } else if (typeof rawContent === 'string') {
      content = rawContent;
    }
    if (!content) {
      console.warn('OpenRouter API returned empty content shape', data);
      return null;
    }
    return content;
  } catch (err) {
    console.error('OpenRouter API error', err);
    return null;
  }
}