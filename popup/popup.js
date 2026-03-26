const SYSTEM_PROMPT = `You are an AI assistant with the ability to take real actions in the user's browser using the AI Browser Action extension.

When you need to perform an action on an external platform (Supabase, Vercel, etc.), output a special action tag in your response. The extension will automatically detect it and execute it.

ACTION TAG FORMAT:
[ACTION: platform.method({"key": "value"})]

AVAILABLE ACTIONS:

Supabase:
- [ACTION: supabase.createTable({"name": "table_name", "schema": "public", "columns": [{"name": "id", "type": "uuid", "primaryKey": true}, {"name": "title", "type": "text"}]})]
- [ACTION: supabase.getApiKeys({"projectRef": "your-project-ref"})]
- [ACTION: supabase.createProject({"name": "my-app", "organizationId": "org_xxx", "region": "us-east-1", "dbPassword": "secure-password"})]

Vercel:
- [ACTION: vercel.getDeploymentLogs({"projectId": "prj_xxx"})]
- [ACTION: vercel.setEnvVar({"projectId": "prj_xxx", "key": "NEXT_PUBLIC_SUPABASE_URL", "value": "https://xxx.supabase.co"})]
- [ACTION: vercel.listDeployments({"projectId": "prj_xxx", "limit": 5})]
- [ACTION: vercel.getLatestDeploymentStatus({"projectId": "prj_xxx"})]

RULES:
1. Only output action tags when you actually need to perform the action (not just describe it)
2. Always explain what you're about to do before the action tag
3. After an action, continue with the next steps assuming it succeeded
4. For destructive actions (dropping tables, deleting), warn the user first
5. You can chain multiple actions in one response if needed

Example:
"I'll create the users table in Supabase now:

[ACTION: supabase.createTable({"name": "users", "columns": [{"name": "id", "type": "uuid", "primaryKey": true}, {"name": "email", "type": "text", "notNull": true}, {"name": "created_at", "type": "timestamptz", "default": "now()"}]})]

Once that's created, let's set up the auth flow..."`;

// --- Tab switching ---
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-actions').style.display = tab.dataset.tab === 'actions' ? '' : 'none';
    document.getElementById('tab-settings').style.display = tab.dataset.tab === 'settings' ? '' : 'none';
  });
});

// --- Show/hide API key ---
document.querySelectorAll('.btn-show').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.target);
    if (input.type === 'password') {
      input.type = 'text';
      btn.textContent = 'Hide';
    } else {
      input.type = 'password';
      btn.textContent = 'Show';
    }
  });
});

// --- Save API keys ---
document.getElementById('save-keys-btn').addEventListener('click', async () => {
  const keys = {
    apiKeyAnthropic: document.getElementById('key-anthropic').value.trim(),
    apiKeyOpenAI: document.getElementById('key-openai').value.trim(),
    apiKeyGoogle: document.getElementById('key-google').value.trim()
  };
  await chrome.storage.local.set(keys);
  const btn = document.getElementById('save-keys-btn');
  btn.textContent = 'Saved!';
  setTimeout(() => { btn.textContent = 'Save Keys'; }, 2000);
});

// --- Clear API keys ---
document.getElementById('clear-keys-btn').addEventListener('click', async () => {
  await chrome.storage.local.remove(['apiKeyAnthropic', 'apiKeyOpenAI', 'apiKeyGoogle']);
  document.getElementById('key-anthropic').value = '';
  document.getElementById('key-openai').value = '';
  document.getElementById('key-google').value = '';
});

// --- Actions tab ---
async function init() {
  const data = await chrome.storage.local.get([
    'actionHistory', 'extensionEnabled',
    'apiKeyAnthropic', 'apiKeyOpenAI', 'apiKeyGoogle'
  ]);

  renderHistory(data.actionHistory || []);

  const toggle = document.getElementById('enabled-toggle');
  toggle.checked = data.extensionEnabled !== false;
  updateStatusBar(toggle.checked);

  toggle.addEventListener('change', () => {
    chrome.storage.local.set({ extensionEnabled: toggle.checked });
    updateStatusBar(toggle.checked);
  });

  // Pre-fill saved keys
  if (data.apiKeyAnthropic) document.getElementById('key-anthropic').value = data.apiKeyAnthropic;
  if (data.apiKeyOpenAI) document.getElementById('key-openai').value = data.apiKeyOpenAI;
  if (data.apiKeyGoogle) document.getElementById('key-google').value = data.apiKeyGoogle;
}

function renderHistory(history) {
  const list = document.getElementById('history-list');
  if (!history.length) {
    list.innerHTML = '<div class="empty-state">No actions yet.<br>Paste the system prompt into any AI chat and start building.</div>';
    return;
  }
  list.innerHTML = [...history].reverse().map(item => {
    const icon = { success: '✓', failed: '✗', cancelled: '○', executing: '⟳', detected: '⚡' }[item.status] || '·';
    const action = item.platform && item.method ? `${item.platform}.${item.method}` : '—';
    const time = item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : '';
    return `
      <div class="history-item">
        <span class="history-icon">${icon}</span>
        <div class="history-content">
          <div class="history-action">${action}</div>
          <div class="history-meta">${time}</div>
        </div>
        <span class="history-status status-${item.status}">${item.status}</span>
      </div>
    `;
  }).join('');
}

function updateStatusBar(enabled) {
  const dot = document.getElementById('status-dot');
  const text = document.getElementById('status-text');
  dot.className = enabled ? 'dot active' : 'dot inactive';
  text.textContent = enabled ? 'Watching AI chats' : 'Extension paused';
}

document.getElementById('copy-prompt-btn').addEventListener('click', async () => {
  await navigator.clipboard.writeText(SYSTEM_PROMPT);
  const btn = document.getElementById('copy-prompt-btn');
  btn.textContent = 'Copied!';
  setTimeout(() => { btn.textContent = 'Copy System Prompt'; }, 2000);
});

document.getElementById('clear-btn').addEventListener('click', () => {
  chrome.storage.local.set({ actionHistory: [] });
  renderHistory([]);
});

init();
