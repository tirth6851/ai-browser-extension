/**
 * chat-watcher.js
 * Injected into claude.ai — watches AI responses for [ACTION: ...] tags
 * and forwards them to the background service worker.
 */

const ACTION_REGEX = /\[ACTION:\s*(\w+)\.(\w+)\((\{[\s\S]*?\})\)\]/g;

let lastProcessedText = '';

function extractActions(text) {
  const actions = [];
  let match;
  const regex = new RegExp(ACTION_REGEX.source, 'g');
  while ((match = regex.exec(text)) !== null) {
    try {
      const payload = JSON.parse(match[3]);
      actions.push({
        platform: match[1],
        method: match[2],
        payload,
        raw: match[0]
      });
    } catch (e) {
      console.warn('[AI Browser Action] Could not parse action payload:', match[3]);
    }
  }
  return actions;
}

function getLatestAssistantMessage() {
  // Claude.ai renders messages in divs with data-is-streaming or completed turns
  // Target the last assistant message content
  const messages = document.querySelectorAll('[data-test-render-count], .font-claude-message');
  if (!messages.length) return null;
  return messages[messages.length - 1].innerText || '';
}

function processNewContent(text) {
  if (text === lastProcessedText) return;
  lastProcessedText = text;

  const actions = extractActions(text);
  if (!actions.length) return;

  actions.forEach(action => {
    chrome.runtime.sendMessage({
      type: 'ACTION_DETECTED',
      action
    });
  });
}

// Watch DOM for new AI response content
const observer = new MutationObserver(() => {
  const text = getLatestAssistantMessage();
  if (text) processNewContent(text);
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
  characterData: true
});

// Listen for toast injection requests from background
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'SHOW_TOAST') {
    showToast(message.action, message.actionId);
  }
  if (message.type === 'ACTION_RESULT') {
    showResultToast(message.success, message.message);
  }
});

function showToast(action, actionId) {
  // Remove existing toast if any
  const existing = document.getElementById('aba-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'aba-toast';
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: #1a1a2e;
    color: #e0e0e0;
    border: 1px solid #4a4aff;
    border-radius: 10px;
    padding: 14px 18px;
    font-family: monospace;
    font-size: 13px;
    z-index: 999999;
    max-width: 380px;
    box-shadow: 0 4px 20px rgba(74,74,255,0.3);
    animation: aba-slide-in 0.2s ease;
  `;

  const style = document.createElement('style');
  style.textContent = `
    @keyframes aba-slide-in {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);

  toast.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
      <span style="color:#4a4aff;font-size:16px;">⚡</span>
      <strong style="color:#fff;">AI Action Detected</strong>
    </div>
    <div style="color:#aaa;margin-bottom:4px;">${action.platform}.${action.method}</div>
    <pre style="margin:6px 0;color:#7fdbff;font-size:11px;overflow:auto;max-height:80px;">${JSON.stringify(action.payload, null, 2)}</pre>
    <div style="display:flex;gap:8px;margin-top:10px;">
      <button id="aba-execute" style="
        background:#4a4aff;color:#fff;border:none;border-radius:6px;
        padding:6px 14px;cursor:pointer;font-size:12px;flex:1;">
        Execute
      </button>
      <button id="aba-cancel" style="
        background:#333;color:#ccc;border:none;border-radius:6px;
        padding:6px 14px;cursor:pointer;font-size:12px;">
        Cancel
      </button>
    </div>
  `;

  document.body.appendChild(toast);

  document.getElementById('aba-execute').onclick = () => {
    toast.remove();
    chrome.runtime.sendMessage({ type: 'EXECUTE_ACTION', actionId });
  };

  document.getElementById('aba-cancel').onclick = () => {
    toast.remove();
    chrome.runtime.sendMessage({ type: 'CANCEL_ACTION', actionId });
  };

  // Auto-dismiss after 30 seconds if no interaction
  setTimeout(() => {
    if (document.getElementById('aba-toast') === toast) toast.remove();
  }, 30000);
}

function showResultToast(success, message) {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: ${success ? '#0f2a1a' : '#2a0f0f'};
    color: #e0e0e0;
    border: 1px solid ${success ? '#2ecc71' : '#e74c3c'};
    border-radius: 10px;
    padding: 12px 18px;
    font-family: monospace;
    font-size: 13px;
    z-index: 999999;
    max-width: 380px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  `;
  toast.textContent = `${success ? '✓' : '✗'} ${message}`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

console.log('[AI Browser Action] Chat watcher active on', window.location.hostname);
