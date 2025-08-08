<script lang="ts">
  import { onMount } from 'svelte';
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
    { id: 'o3-mini', name: 'OpenAI GPT-4o reasoning (o3-mini)' },
    { id: 'gemini', name: 'Gemini 2.5 Pro (Google)' },
    { id: 'claude', name: 'Claude 3 (Anthropic)' },
    { id: 'openrouter', name: 'OpenRouter Llama 3.1 Free' }
  ];

  // 狀態變數
  let selectedModels: string[] = ['o3-mini', 'gemini', 'openrouter'];
  let question = '';
  let maxRounds = 3;
  let isDebating = false;
  let chatHistory: HistoryItem[] = [];

  // 從 localStorage 載入現有聊天紀錄
  onMount(() => {
    const stored = localStorage.getItem('multiAgentChat');
    if (stored) {
      chatHistory = JSON.parse(stored) as HistoryItem[];
    }
  });

  /**
   * 取得指定模型的推理與回答。
   * 根據模型 ID 呼叫對應的 API，如果調用成功，解析格式化的回覆；
   * 否則回傳錯誤訊息。
   */
  async function getAgentResponse(
    modelId: string,
    question: string,
    round: number
  ): Promise<{ thought: string; answer: string }> {
    const modelName = availableModels.find(m => m.id === modelId)?.name || modelId;
    // 提示模型逐步推理，並要求以指定格式回覆
    const prompt = `請以繁體中文回答下列問題，並逐步思考；回覆時使用兩行顯示：\n思考過程：<你的思考過程>\n答案：<最終答案>\n問題：${question}`;
    let rawResponse: string | null = null;
    if (modelId === 'o3-mini') {
      rawResponse = await callOpenAI([
        { role: 'system', content: '你是一個樂於助人的 AI，需要逐步思考並在回覆中附上思考過程和最終答案。' },
        { role: 'user', content: prompt }
      ] as ChatMessage[]);
    } else if (modelId === 'gemini') {
      rawResponse = await callGemini(prompt);
    } else if (modelId === 'claude') {
      rawResponse = await callAnthropic([
        { role: 'system', content: '你是一個樂於助人的 AI，需要逐步思考並在回覆中附上思考過程和最終答案。' },
        { role: 'user', content: prompt }
      ] as ChatMessage[]);
    } else if (modelId === 'openrouter') {
      rawResponse = await callOpenRouter([
        { role: 'system', content: '你是一個樂於助人的 AI，需要逐步思考並在回覆中附上思考過程和最終答案。' },
        { role: 'user', content: prompt }
      ] as ChatMessage[]);
    }
    // 解析回覆成「思考過程」與「答案」
    if (rawResponse) {
      const parts = rawResponse.split('答案：');
      if (parts.length === 2) {
        const thoughtPart = parts[0].replace(/^[\n\s]*思考過程：/u, '').trim();
        const answerPart = parts[1].trim();
        return { thought: thoughtPart, answer: answerPart };
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

  // 開始辯論
  async function startDebate() {
    if (!question.trim() || selectedModels.length === 0) return;
    isDebating = true;
    chatHistory = [];
    for (let round = 1; round <= maxRounds; round++) {
      for (const modelId of selectedModels) {
        const { thought, answer } = await getAgentResponse(modelId, question, round);
        chatHistory.push({ round, modelId, thought, answer });
        // 更新 localStorage
        localStorage.setItem('multiAgentChat', JSON.stringify(chatHistory));
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
</style>

<div class="container">
  <h1>多 AI 交叉辯論聊天系統</h1>
  <div>
    <label>選擇模型：</label>
    {#each availableModels as model}
      <label style="margin-right: 1rem;">
        <input type="checkbox" bind:group={selectedModels} value={model.id} />
        {model.name}
      </label>
    {/each}
  </div>
  <div style="margin-top: 0.5rem;">
    <label for="maxRounds">最多辯論回合：</label>
    <input id="maxRounds" type="number" bind:value={maxRounds} min="1" max="10" style="width: 60px;" />
  </div>
  <div style="margin-top: 0.5rem;">
    <textarea rows="4" placeholder="請輸入您的問題" bind:value={question} style="width: 100%;"></textarea>
  </div>
  <button on:click={startDebate} disabled={isDebating || !question.trim()} style="margin-top: 0.5rem;">
    {isDebating ? '辯論中…' : '開始辯論'}
  </button>
  <button on:click={exportChat} style="margin-top: 0.5rem; margin-left: 1rem;">
    匯出聊天
  </button>

  <div class="chat-window">
    {#if chatHistory.length === 0}
      <p>尚無聊天記錄。</p>
    {:else}
      {#each chatHistory as item, index}
        <div class="message">
          <div class="thought">回合 {item.round} / {availableModels.find(m => m.id === item.modelId)?.name}</div>
          <div class="thought">推理：{item.thought}</div>
          <div class="answer">回答：{item.answer}</div>
        </div>
      {/each}
    {/if}
  </div>
</div>