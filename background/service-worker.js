/**
 * service-worker.js
 * Orchestrates action execution: receives detected actions from chat-watcher,
 * opens the target platform tab, injects the platform script, and reports results.
 */

const PLATFORM_URLS = {
  supabase: 'https://supabase.com/dashboard',
  vercel: 'https://vercel.com/dashboard'
};

const PLATFORM_SCRIPTS = {
  supabase: 'content/platform-scripts/supabase.js',
  vercel: 'content/platform-scripts/vercel.js'
};

// Pending actions waiting for user confirmation: { actionId -> actionData }
const pendingActions = {};
let actionCounter = 0;

// Action history stored in memory (also persisted to chrome.storage)
const actionHistory = [];

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ACTION_DETECTED') {
    handleActionDetected(message.action, sender.tab);
  }

  if (message.type === 'EXECUTE_ACTION') {
    const action = pendingActions[message.actionId];
    if (action) executeAction(action, sender.tab);
  }

  if (message.type === 'CANCEL_ACTION') {
    delete pendingActions[message.actionId];
    logAction(message.actionId, 'cancelled', null);
  }

  if (message.type === 'PLATFORM_RESULT') {
    // Forwarded from platform script back to chat tab
    handlePlatformResult(message);
  }

  if (message.type === 'GET_HISTORY') {
    sendResponse({ history: actionHistory });
    return true;
  }
});

function handleActionDetected(action, sourceTab) {
  const actionId = `action_${++actionCounter}_${Date.now()}`;
  pendingActions[actionId] = { ...action, sourceTabId: sourceTab?.id };

  logAction(actionId, 'detected', action);

  // Send toast to the chat tab
  if (sourceTab?.id) {
    chrome.tabs.sendMessage(sourceTab.id, {
      type: 'SHOW_TOAST',
      action,
      actionId
    });
  }
}

async function executeAction(actionData, sourceTab) {
  const { platform, method, payload, sourceTabId, raw } = actionData;
  const actionId = Object.keys(pendingActions).find(k => pendingActions[k] === actionData);

  logAction(actionId, 'executing', actionData);

  const platformUrl = PLATFORM_URLS[platform];
  const platformScript = PLATFORM_SCRIPTS[platform];

  if (!platformUrl || !platformScript) {
    notifyChatTab(sourceTabId, false, `Unknown platform: ${platform}`);
    return;
  }

  try {
    // Find existing tab for this platform or open a new one
    const tabs = await chrome.tabs.query({ url: `${platformUrl}*` });
    let targetTab;

    if (tabs.length > 0) {
      targetTab = tabs[0];
      await chrome.tabs.update(targetTab.id, { active: true });
    } else {
      targetTab = await chrome.tabs.create({ url: platformUrl });
      // Wait for tab to load
      await waitForTabLoad(targetTab.id);
    }

    // Inject platform script and execute action
    const results = await chrome.scripting.executeScript({
      target: { tabId: targetTab.id },
      files: [platformScript]
    });

    // Send the action command to the platform tab
    await chrome.tabs.sendMessage(targetTab.id, {
      type: 'EXECUTE_PLATFORM_ACTION',
      platform,
      method,
      payload,
      sourceTabId
    });

    delete pendingActions[actionId];
  } catch (err) {
    console.error('[AI Browser Action] Execution error:', err);
    notifyChatTab(sourceTabId, false, `Error: ${err.message}`);
    logAction(actionId, 'error', { error: err.message });
  }
}

function handlePlatformResult(message) {
  const { success, resultMessage, sourceTabId } = message;
  notifyChatTab(sourceTabId, success, resultMessage);

  // Update history
  const latest = actionHistory[actionHistory.length - 1];
  if (latest) {
    latest.status = success ? 'success' : 'failed';
    latest.result = resultMessage;
    persistHistory();
  }
}

function notifyChatTab(tabId, success, message) {
  if (!tabId) return;
  chrome.tabs.sendMessage(tabId, {
    type: 'ACTION_RESULT',
    success,
    message
  });
}

function logAction(actionId, status, data) {
  const entry = {
    actionId,
    status,
    timestamp: new Date().toISOString(),
    platform: data?.platform,
    method: data?.method,
    payload: data?.payload
  };
  // Update existing entry or add new
  const existing = actionHistory.findIndex(h => h.actionId === actionId);
  if (existing >= 0) {
    actionHistory[existing] = { ...actionHistory[existing], status, ...entry };
  } else {
    actionHistory.push(entry);
    if (actionHistory.length > 50) actionHistory.shift(); // keep last 50
  }
  persistHistory();
}

function persistHistory() {
  chrome.storage.local.set({ actionHistory: actionHistory.slice(-50) });
}

function waitForTabLoad(tabId) {
  return new Promise((resolve) => {
    function listener(id, info) {
      if (id === tabId && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
    // Timeout after 15s
    setTimeout(resolve, 15000);
  });
}

console.log('[AI Browser Action] Service worker started');
