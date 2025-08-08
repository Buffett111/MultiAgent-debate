# MultiAgent Debate

A Svelte + TypeScript playground for comparing reasoning models in a debate interface.

## Requirements

- Node.js >= 16
- [pnpm](https://pnpm.io/) package manager
- API keys for the models you plan to use

## Environment Variables

Create a `.env` file based on `.env.example` and supply the following keys:

- `VITE_OPENAI_API_KEY` – OpenAI GPT-4o reasoning model (`o3-mini`)
- `VITE_GEMINI_API_KEY` – Google Gemini 2.5 Pro
- `VITE_ANTHROPIC_API_KEY` – Anthropic Claude (`claude-sonnet-4-20250514`)
- `VITE_OPENROUTER_API_KEY` – OpenRouter free Llama‑3.1‑Nemotron‑Ultra‑253B‑v1 model (`nvidia/llama-3.1-nemotron-ultra-253b-v1:free`)

`VITE_OPENROUTER_API_KEY` may alternatively be provided as `OPENROUTER_API_KEY`.

## Setup

1. Install dependencies:
   ```bash
   pnpm install
   ```
2. Run the development server:
   ```bash
   pnpm run dev
   ```
3. Build for production:
   ```bash
   pnpm run build
   ```

## Model Endpoints

The `src/api.ts` file exposes helpers for each provider:

- `callOpenAI` – calls the OpenAI GPT-4o reasoning model (o3-mini)
- `callGemini` – calls the Gemini 2.5 Pro model
- `callAnthropic` – calls Anthropic's Claude model (`claude-sonnet-4-20250514`)
- `callOpenRouter` – calls OpenRouter's free Llama‑3.1‑Nemotron‑Ultra‑253B‑v1 model (`nvidia/llama-3.1-nemotron-ultra-253b-v1:free`), derived from Meta’s Llama‑3.1‑405B‑Instruct via neural architecture search. It is optimized for advanced reasoning, human-interactive chat, RAG, and tool-calling tasks, supports up to 128K tokens of context, and runs efficiently on an 8×NVIDIA H100 node. Include a system prompt requesting detailed step-by-step reasoning when using this model.

Select any model in the UI to have agents debate using that provider.

## Testing

The project is written in TypeScript. To verify everything compiles, run:

```bash
pnpm run build
```

