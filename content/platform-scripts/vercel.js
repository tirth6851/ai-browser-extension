/**
 * vercel.js
 * Injected into vercel.com — executes Vercel actions via the Vercel API
 * using the user's existing authenticated session token.
 */

(function () {
  if (window.__abaVercelLoaded) return;
  window.__abaVercelLoaded = true;

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type !== 'EXECUTE_PLATFORM_ACTION' || message.platform !== 'vercel') return;
    handleAction(message.method, message.payload, message.sourceTabId);
  });

  async function handleAction(method, payload, sourceTabId) {
    try {
      let result;
      switch (method) {
        case 'getDeploymentLogs':
          result = await getDeploymentLogs(payload);
          break;
        case 'setEnvVar':
          result = await setEnvVar(payload);
          break;
        case 'listDeployments':
          result = await listDeployments(payload);
          break;
        case 'getLatestDeploymentStatus':
          result = await getLatestDeploymentStatus(payload);
          break;
        default:
          throw new Error(`Unknown Vercel method: ${method}`);
      }
      report(true, result, sourceTabId);
    } catch (err) {
      report(false, err.message, sourceTabId);
    }
  }

  async function getAuthToken() {
    // Vercel stores auth token in cookies or localStorage
    // Try localStorage first
    const storedToken = localStorage.getItem('token') || localStorage.getItem('vercel-token');
    if (storedToken) return storedToken;

    // Try to extract from cookie
    const cookies = document.cookie.split(';').map(c => c.trim());
    const tokenCookie = cookies.find(c => c.startsWith('token=') || c.startsWith('_vercel_token='));
    if (tokenCookie) return tokenCookie.split('=')[1];

    throw new Error('Not logged into Vercel. Please log in at vercel.com first.');
  }

  async function vercelFetch(path, options = {}) {
    const token = await getAuthToken();
    const res = await fetch(`https://api.vercel.com${path}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Vercel API error ${res.status}`);
    }

    return res.json();
  }

  async function getDeploymentLogs({ projectId, deploymentId, limit = 20 }) {
    if (!deploymentId && !projectId) {
      throw new Error('deploymentId or projectId is required');
    }

    let depId = deploymentId;

    // If no deploymentId, get the latest deployment for the project
    if (!depId && projectId) {
      const data = await vercelFetch(`/v6/deployments?projectId=${projectId}&limit=1`);
      depId = data.deployments?.[0]?.uid;
      if (!depId) throw new Error(`No deployments found for project ${projectId}`);
    }

    const data = await vercelFetch(`/v2/deployments/${depId}/events?limit=${limit}`);
    const logs = (data || [])
      .filter(e => e.type === 'stdout' || e.type === 'stderr' || e.type === 'error')
      .map(e => `[${e.type}] ${e.text || e.payload?.text || ''}`)
      .join('\n');

    return `Deployment logs for ${depId}:\n${logs || '(no logs found)'}`;
  }

  async function setEnvVar({ projectId, key, value, target = ['production', 'preview', 'development'], type = 'plain' }) {
    if (!projectId) throw new Error('projectId is required');
    if (!key) throw new Error('env var key is required');
    if (value === undefined) throw new Error('env var value is required');

    await vercelFetch(`/v10/projects/${projectId}/env`, {
      method: 'POST',
      body: JSON.stringify({ key, value, target, type })
    });

    return `Environment variable "${key}" set on project ${projectId} for targets: ${target.join(', ')}`;
  }

  async function listDeployments({ projectId, limit = 5 }) {
    if (!projectId) throw new Error('projectId is required');

    const data = await vercelFetch(`/v6/deployments?projectId=${projectId}&limit=${limit}`);
    const list = (data.deployments || []).map(d =>
      `• ${d.name} — ${d.state} — ${new Date(d.createdAt).toLocaleString()} (${d.uid})`
    ).join('\n');

    return `Recent deployments for ${projectId}:\n${list || '(none found)'}`;
  }

  async function getLatestDeploymentStatus({ projectId }) {
    if (!projectId) throw new Error('projectId is required');

    const data = await vercelFetch(`/v6/deployments?projectId=${projectId}&limit=1`);
    const dep = data.deployments?.[0];
    if (!dep) return `No deployments found for project ${projectId}`;

    return `Latest deployment: ${dep.name}\nStatus: ${dep.state}\nURL: ${dep.url ? 'https://' + dep.url : 'N/A'}\nCreated: ${new Date(dep.createdAt).toLocaleString()}\nID: ${dep.uid}`;
  }

  function report(success, message, sourceTabId) {
    chrome.runtime.sendMessage({
      type: 'PLATFORM_RESULT',
      success,
      resultMessage: message,
      sourceTabId
    });
  }

  console.log('[AI Browser Action] Vercel platform script loaded');
})();
