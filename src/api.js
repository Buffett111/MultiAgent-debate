// API utility functions for calling different LLM providers.  
// These functions read API keys from Vite's environment variables. Users need
// to create a `.env` file at the project root with the variables
// `VITE_OPENAI_API_KEY`, `VITE_GEMINI_API_KEY` and `VITE_ANTHROPIC_API_KEY`.
// See the README or documentation for details.

/**
 * Call OpenAI's Chat Completion API. Accepts an array of message objects of
 * the shape { role: 'user' | 'assistant' | 'system', content: string } and
 * returns the assistant's reply as a string.
 * If the API key is missing or the request fails, returns null.
 *
 * @param {Array<{role: string, content: string}>} messages
 * @returns {Promise<string|null>}
 */
export async function callOpenAI(messages) {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo-1106',
        messages,
        // You can adjust max_tokens and temperature if needed
        max_tokens: 512,
        temperature: 0.7
      })
    });
    if (!res.ok) {
      console.warn('OpenAI API error', await res.text());
      return null;
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    return content ?? null;
  } catch (err) {
    console.error('OpenAI API error', err);
    return null;
  }
}

/**
 * Call Google's Gemini API. Accepts a plain string prompt and returns the model's
 * reply as a string. Currently uses the Gemini 2.5 Pro model. If the API key
 * is missing or an error occurs, returns null.
 *
 * @param {string} prompt
 * @returns {Promise<string|null>}
 */
export async function callGemini(prompt) {
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
    const content =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
    return content;
  } catch (err) {
    console.error('Gemini API error', err);
    return null;
  }
}

/**
 * Call Anthropic's Claude Messages API. Accepts an array of message objects and
 * returns the assistant's reply as a string. If the API key is missing or
 * there is an error, returns null.
 *
 * @param {Array<{role: string, content: string}>} messages
 * @returns {Promise<string|null>}
 */
export async function callAnthropic(messages) {
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
    const content = data?.content?.[0]?.text ?? null;
    return content;
  } catch (err) {
    console.error('Anthropic API error', err);
    return null;
  }
}