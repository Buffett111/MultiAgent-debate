<script>
  import { onMount } from 'svelte';

  // 可用模型列表
  const availableModels = [
    { id: 'gpt4o', name: 'GPT‑4o (OpenAI)' },
    { id: 'gemini', name: 'Gemini 2.5 Pro (Google)' },
    { id: 'claude', name: 'Claude 3 (Anthropic)' }
  ];

  // 狀態變數
  let selectedModels = ['gpt4o', 'gemini'];
  let question = '';
  let maxRounds = 3;
  let isDebating = false;
  let chatHistory = [];

  // 從 localStorage 載入現有聊天紀錄
  onMount(() => {
    const stored = localStorage.getItem('multiAgentChat');
    if (stored) {
      chatHistory = JSON.parse(stored);
    }
  });

  // 模擬代理模型的思考與回答
  async function simulateAgentResponse(modelId, question, round, context) {
    // 在實際專案中，這裡會調用外部 API
    // 我們暫用固定文本模擬不同模型的推理過程和答案
    const modelName = availableModels.find(m => m.id === modelId)?.name || modelId;
    const thought = `（${modelName} 第 ${round} 輪推理）我將問題分解為幾個步驟並逐步思考…`;
    const answer = `（${modelName} 最終答覆）根據我的推理，初步答案為 ${Math.floor(Math.random() * 100)}。`;
    // 模擬延遲
    await new Promise(resolve => setTimeout(resolve, 200));
    return { thought, answer };
  }

  // 開始辯論
  async function startDebate() {
    if (!question.trim() || selectedModels.length === 0) return;
    isDebating = true;
    chatHistory = [];
    let context = {};
    for (let round = 1; round <= maxRounds; round++) {
      for (const modelId of selectedModels) {
        const { thought, answer } = await simulateAgentResponse(modelId, question, round, context);
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