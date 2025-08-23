<script lang="ts">
  import { onMount, tick } from 'svelte';
  let markedParse: ((md: string) => string) | null = null;
  let sanitizeFn: ((html: string) => string) | null = null;
  import {
    callOpenAI,
    callGemini,
    callAnthropic,
    callOpenRouter,
    type ChatMessage
  } from './api';

  interface ModelOption {
    id: string;
    name: string;
  }

  interface HistoryItem {
    round: number;
    modelId: string;
    thought: string;
    answer: string;
  }

  // 可用模型列表
  const availableModels: ModelOption[] = [

    { id: 'gpt-5', name: 'OpenAI GPT-5' },
    { id: 'gemini', name: 'Gemini 2.5 Pro (Google)' },
    { id: 'claude', name: 'Claude 3 (Anthropic)' },
    { id: 'openrouter', name: 'OpenRouter Free' }
  ];

  // 狀態變數
  let selectedModels: string[] = ['gpt-5', 'gemini', 'openrouter'];

  let question = '';
  let maxRounds = 3;
  let isDebating = false;
  let chatHistory: HistoryItem[] = [];
  let completedSteps = 0;
  $: totalSteps = Math.max(1, maxRounds * (selectedModels?.length || 0));
  $: progressPercent = isDebating
    ? Math.min(100, Math.round((completedSteps / totalSteps) * 100))
    : 0;

  // 從 localStorage 載入現有聊天紀錄
  onMount(async () => {
    const stored = localStorage.getItem('multiAgentChat');
    if (stored) {
      chatHistory = JSON.parse(stored) as HistoryItem[];
    }
    // Lazy-load markdown libs to avoid type issues if not installed yet
    // Dynamic import without types to satisfy bundler at runtime
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const markedMod: any = await import(/* @vite-ignore */ 'marked');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dompurifyMod: any = await import(/* @vite-ignore */ 'dompurify');
    const markedApi: any = markedMod;
    const dompurifyApi: any = (dompurifyMod as any).default || dompurifyMod;
    markedParse = (md: string) => (markedApi.marked?.parse ? markedApi.marked.parse(md || '') : (markedApi.parse ? markedApi.parse(md || '') : String(md)));
    sanitizeFn = (html: string) => (dompurifyApi?.sanitize ? dompurifyApi.sanitize(html) : html);
  });

  // Markdown action
  function renderMarkdown(node: HTMLElement, content: string) {
    const render = (md: string) => {
      const html = sanitizeFn && markedParse
        ? sanitizeFn(markedParse(md))
        : md;
      node.innerHTML = html;
    };
    render(content);
    return {
      update(newContent: string) {
        render(newContent);
      }
    };
  }

  // 將環境變數讀入本地變數，避免 TS 對 import.meta.env 的存取報錯
  const hasOpenAI = Boolean((import.meta as any).env?.VITE_OPENAI_API_KEY);
  const hasGemini = Boolean((import.meta as any).env?.VITE_GEMINI_API_KEY);
  const hasOpenRouter = Boolean(((import.meta as any).env?.VITE_OPENROUTER_API_KEY) || ((import.meta as any).env?.OPENROUTER_API_KEY));

  /**
   * 取得指定模型的回答（不要求公開思考過程）。
   * 接受已組裝完成的 prompt，使外層可注入前序模型的回覆進行辯論。
   */
  async function getAgentResponse(
    modelId: string,
    finalPrompt: string,
    round: number
  ): Promise<{ thought: string; answer: string }> {
    const modelName = availableModels.find(m => m.id === modelId)?.name || modelId;
    let rawResponse: string | null = null;
    if (modelId === 'gpt-5') {

      rawResponse = await callOpenAI([
        { role: 'system', content: '你是一個樂於助人的 AI。回答時使用繁體中文，逐步思考後直接給出清晰結論與必要理由。' },
        { role: 'user', content: finalPrompt }
      ] as ChatMessage[]);
    } else if (modelId === 'gemini') {
      const res = await callGemini(finalPrompt, { timeoutMs: 45000, retries: 2, retryDelayMs: 1500 });
      if (res === '__TIMEOUT__') {
        return {
          thought: '（Gemini 回應逾時）將跳過本回合，繼續下一個模型。',
          answer: 'Gemini 回應逾時'
        };
      }
      rawResponse = res as string | null;
    } else if (modelId === 'claude') {
      rawResponse = await callAnthropic([
        { role: 'system', content: '你是一個樂於助人的 AI。回答時使用繁體中文，思考後給出清晰結論與必要理由。' },
        { role: 'user', content: finalPrompt }
      ] as ChatMessage[]);
    } else if (modelId === 'openrouter') {
      rawResponse = await callOpenRouter([
        { role: 'system', content: '你是一個樂於助人的 AI。回答時使用繁體中文，思考後給出清晰結論與必要理由。' },
        { role: 'user', content: finalPrompt }
      ] as ChatMessage[]);

    }
    // 解析回覆成「思考過程」與「答案」
    console.log("current model:", modelName, "rawResponse:", rawResponse);
    if (rawResponse) {
      const parts = rawResponse.split('答案：');
      if (parts.length === 2) {
        const answerPart = parts[1].trim();
        return { thought: '', answer: answerPart };
      }
      // 若格式不符，將整段視為答案
      return { thought: '', answer: rawResponse.trim() };
    }
    // API 回傳 null 時顯示錯誤訊息
    return {
      thought: `（${modelName} 第 ${round} 輪推理）無法取得回覆，請檢查 API 金鑰或網路。`,
      answer: `（${modelName} 最終答覆）無法取得回覆。`
    };
  }

  function buildFirstPrompt(q: string): string {
    return `請以繁體中文回答下列問題，直接給出清楚的「答案」與必要理由（避免透露內部思考過程）。\n若可，請以「答案：<你的結論>」開頭。\n問題：${q}`;
  }

  function buildDebatePrompt(
    q: string,
    prior: HistoryItem[],
    modelOrderIndex: number
  ): string {
    const priorText = prior
      .map((p, idx) => {
        const name = availableModels.find(m => m.id === p.modelId)?.name || p.modelId;
        return `第${idx + 1}位（${name}）\n- 答案：${p.answer}`;
      })
      .join('\n\n');
    return `你是此回合的第 ${modelOrderIndex + 1} 位模型。請閱讀前面模型的回覆並進行辯論與評估，明確指出你「同意或不同意」及簡要理由，最後給出你的結論。\n已知前述回覆：\n${priorText}\n\n請用繁體中文作答，避免描述內部思考過程；如可，請以「答案：<你的結論>」開頭。\n問題：${q}`;
  }

  // 開始辯論
  async function startDebate() {
    if (!question.trim() || selectedModels.length === 0) return;
    isDebating = true;
    chatHistory = [];
    completedSteps = 0;
    for (let round = 1; round <= maxRounds; round++) {
      const priorThisRound: HistoryItem[] = [];
      for (let i = 0; i < selectedModels.length; i++) {
        const modelId = selectedModels[i];
        const prompt = i === 0
          ? buildFirstPrompt(question)
          : buildDebatePrompt(question, priorThisRound, i);
        const { thought, answer } = await getAgentResponse(modelId, prompt, round);
        const item = { round, modelId, thought, answer } as HistoryItem;
        chatHistory = [...chatHistory, item];
        priorThisRound.push(item);
        completedSteps += 1;
        // 更新 localStorage
        localStorage.setItem('multiAgentChat', JSON.stringify(chatHistory));
        // 讓畫面立即刷新
        await tick();
      }
    }
    isDebating = false;
  }

  // 匯出聊天紀錄
  function exportChat() {
    const data = JSON.stringify(chatHistory, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat_history_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
</script>

<style>
  .container {
    background: #fff;
    border-radius: 8px;
    padding: 1.5rem;
    box-shadow: 0 2px 6px rgba(0,0,0,0.1);
  }
  .chat-window {
    max-height: 400px;
    overflow-y: auto;
    margin-top: 1rem;
    border: 1px solid #ddd;
    padding: 1rem;
    border-radius: 4px;
    background: #fafafa;
  }
  .progress {
    height: 8px;
    background: #e6e6e6;
    border-radius: 4px;
    overflow: hidden;
    margin-top: 0.5rem;
  }
  .progress-bar {
    height: 100%;
    background: linear-gradient(90deg, #4caf50, #2e7d32);
    transition: width 0.25s ease;
  }
  .message {
    margin-bottom: 1rem;
  }
  .thought {
    font-size: 0.9rem;
    color: #555;
    margin-bottom: 0.25rem;
  }
  .answer {
    font-weight: bold;
  }
  .markdown :global(pre) {
    background: #0f172a;
    color: #e2e8f0;
    padding: 0.75rem 1rem;
    border-radius: 6px;
    overflow-x: auto;
  }
  .markdown :global(code) {
    background: #f4f6f8;
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
  }
  .markdown :global(h1),
  .markdown :global(h2),
  .markdown :global(h3) {
    margin: 0.6rem 0 0.25rem;
  }
</style>

<div class="container">
  <h1>多 AI 交叉辯論聊天系統</h1>
  <div>
    <fieldset style="border: 0; padding: 0; margin: 0;">
      <legend>選擇模型：</legend>
      {#each availableModels as model}
        <label style="margin-right: 1rem;">
          <input type="checkbox" bind:group={selectedModels} value={model.id} />
          {model.name}
        </label>
      {/each}
    </fieldset>
  </div>
  <div style="margin-top: 0.5rem;">
    <label for="maxRounds">最多辯論回合：</label>
    <input id="maxRounds" type="number" bind:value={maxRounds} min="1" max="10" style="width: 60px;" />
  </div>
  {#if !hasOpenAI || !hasGemini || !hasOpenRouter}
    <div style="margin-top: 0.5rem; padding: 0.5rem; background: #fff4e5; border: 1px solid #ffc107; border-radius: 4px; color: #7a5c00;">
      缺少 API 金鑰：
      {#if !hasOpenAI}<span>OpenAI </span>{/if}
      {#if !hasGemini}<span>Gemini </span>{/if}
      {#if !hasOpenRouter}<span>OpenRouter </span>{/if}
      （請於專案根目錄新增 .env 並設定對應的 VITE_*_API_KEY）
    </div>
  {/if}
  <div style="margin-top: 0.5rem;">
    <textarea rows="4" placeholder="請輸入您的問題" bind:value={question} style="width: 100%;"></textarea>
  </div>
  <button on:click={startDebate} disabled={isDebating || !question.trim()} style="margin-top: 0.5rem;">
    {isDebating ? '辯論中…' : '開始辯論'}
  </button>
  <button on:click={exportChat} style="margin-top: 0.5rem; margin-left: 1rem;">
    匯出聊天
  </button>

  {#if isDebating}
    <div class="progress" aria-label="progress">
      <div class="progress-bar" style={`width:${progressPercent}%;`}></div>
    </div>
    <div style="margin-top: 0.25rem; font-size: 0.9rem; color: #555;">
      進度：{completedSteps} / {totalSteps}（{progressPercent}%）
    </div>
  {/if}

  <div class="chat-window">
    {#if chatHistory.length === 0}
      <p>尚無聊天記錄。</p>
    {:else}
      {#each chatHistory as item, index}
        <div class="message">
          <div class="thought">回合 {item.round} / {availableModels.find(m => m.id === item.modelId)?.name}</div>
          <div class="thought">推理：{item.thought}</div>
          <div class="answer">回答：</div>
          <div class="markdown" use:renderMarkdown={item.answer}></div>
        </div>
      {/each}
    {/if}
  </div>
</div>