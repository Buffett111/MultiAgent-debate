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
 * Call OpenAI's GPT-5 via the Chat Completions API.
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
    // 動態載入 SDK 以避免在某些環境下的靜態型別解析問題
    const OpenAIModule = await import('openai');
    const OpenAI = OpenAIModule.OpenAI
    const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
    const completion = await client.chat.completions.create({
      model: 'gpt-5',
      max_completion_tokens: 4096,
      messages: messages,
      reasoning_effort: 'medium',
    });
    const raw = completion?.choices?.[0]?.message?.content as unknown;
    console.log("OpenAI Chat Completions API response:", JSON.stringify(raw));
    if (typeof raw === 'string') return raw;
    if (Array.isArray(raw)) {
      const text = raw
        .map((p: any) => (typeof p?.text === 'string' ? p.text : ''))
        .join('\n')
        .trim();
      if (text) return text;
    }
    console.warn('OpenAI SDK returned unexpected content shape', JSON.stringify(completion));
    return null;
  } catch (err) {
    console.error('OpenAI SDK error', err);
    return null;
  }
}

/**
 * Call Google's Gemini API using the Gemini 2.5 Pro model.
 * Accepts a plain string prompt and returns the model's reply as a string.
 */
export async function callGemini(
  prompt: string,
  options?: { timeoutMs?: number; retries?: number; retryDelayMs?: number }
): Promise<string | null | '__TIMEOUT__'> {
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
  const maxAttempts = Math.max(1, (options?.retries ?? 2) + 1);
  const retryDelayMs = options?.retryDelayMs ?? 1500;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutMs = options?.timeoutMs ?? 45000;
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!res.ok) {
        const errText = await res.text();
        console.warn(`Gemini API error (attempt ${attempt}/${maxAttempts})`, res.status, errText);
        if (attempt < maxAttempts && (res.status >= 500 || res.status === 429)) {
          let waitMs = retryDelayMs;
          try {
            const parsed = JSON.parse(errText);
            const retryDelay = parsed?.error?.details?.find((d: any) => d?.['@type']?.includes('RetryInfo'))?.retryDelay as string | undefined;
            if (retryDelay && retryDelay.endsWith('s')) {
              const sec = Number(retryDelay.replace('s',''));
              if (!Number.isNaN(sec)) {
                waitMs = Math.min(60000, Math.max(retryDelayMs, sec * 1000));
              }
            }
          } catch {}
          await new Promise(r => setTimeout(r, waitMs));
          continue;
        }
        return null;
      }
      const data = await res.json();
      const content = data?.candidates?.[0]?.content?.parts?.[0]?.text as
        | string
        | undefined;
      if (content) return content;
      // If empty, consider retrying
      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, retryDelayMs));
        continue;
      }
      return null;
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        console.warn(`Gemini API timeout (attempt ${attempt}/${maxAttempts})`);
        if (attempt < maxAttempts) {
          await new Promise(r => setTimeout(r, retryDelayMs));
          continue;
        }
        return '__TIMEOUT__';
      }
      console.error('Gemini API error', err);
      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, retryDelayMs));
        continue;
      }
      return null;
    }
  }
  return null;
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
  // Prefer free-tier models and keep token usage modest to avoid 402 errors.
  const modelCandidates = [
    // 'meta-llama/llama-3.1-8b-instruct:free',
    'openrouter/auto'
  ];
  const tokenBudgets = [512, 256];

  const tryOnce = async (model: string, maxTokens: number) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({ model, max_tokens: maxTokens, messages })
    });
    if (!res.ok) {
      const errorText = await res.text();
      console.warn('OpenRouter API error', res.status, errorText);
      return { ok: false, status: res.status as number, errorText } as const;
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
    if (!content) return { ok: false, status: 200 as number, errorText: 'empty content' } as const;
    return { ok: true, content } as const;
  };

  try {
    for (const model of modelCandidates) {
      for (const maxTokens of tokenBudgets) {
        const result = await tryOnce(model, maxTokens);
        if ((result as any).ok) {
          return (result as any).content as string;
        }
        const status = (result as any).status as number | undefined;
        if (status && status >= 500) {
          continue; // retry next option on server errors
        }
      }
    }
    return null;
  } catch (err) {
    console.error('OpenRouter API error', err);
    return null;
  }
}