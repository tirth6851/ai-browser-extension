/**
 * supabase.js
 * Injected into supabase.com — executes Supabase actions via the Supabase Management API
 * using the user's existing authenticated session (no credentials stored).
 */

(function () {
  // Avoid re-registering listener if script injected multiple times
  if (window.__abaSupabaseLoaded) return;
  window.__abaSupabaseLoaded = true;

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type !== 'EXECUTE_PLATFORM_ACTION' || message.platform !== 'supabase') return;
    handleAction(message.method, message.payload, message.sourceTabId);
  });

  async function handleAction(method, payload, sourceTabId) {
    try {
      let result;
      switch (method) {
        case 'createTable':
          result = await createTable(payload);
          break;
        case 'getApiKeys':
          result = await getApiKeys(payload);
          break;
        case 'createProject':
          result = await createProject(payload);
          break;
        default:
          throw new Error(`Unknown Supabase method: ${method}`);
      }
      report(true, result, sourceTabId);
    } catch (err) {
      report(false, err.message, sourceTabId);
    }
  }

  async function getAccessToken() {
    // Extract token from Supabase's session stored in localStorage
    const keys = Object.keys(localStorage);
    const sessionKey = keys.find(k => k.includes('supabase') && k.includes('auth'));
    if (!sessionKey) throw new Error('Not logged into Supabase. Please log in at supabase.com first.');
    const session = JSON.parse(localStorage.getItem(sessionKey));
    return session?.access_token || session?.currentSession?.access_token;
  }

  async function getProjectRef(payload) {
    // Use provided projectRef or infer from current URL
    if (payload.projectRef) return payload.projectRef;
    const match = window.location.pathname.match(/project\/([a-z0-9]+)/);
    if (match) return match[1];
    throw new Error('No projectRef provided and could not detect project from URL. Navigate to your Supabase project first, or provide projectRef in the action.');
  }

  async function createTable({ projectRef: ref, name, columns = [], schema = 'public' }) {
    const token = await getAccessToken();
    const projectRef = await getProjectRef({ projectRef: ref });

    if (!name) throw new Error('Table name is required');

    // Build SQL from column definitions
    const colDefs = columns.length
      ? columns.map(c => `"${c.name}" ${c.type || 'text'}${c.primaryKey ? ' PRIMARY KEY' : ''}${c.notNull ? ' NOT NULL' : ''}${c.default !== undefined ? ` DEFAULT ${c.default}` : ''}`).join(',\n  ')
      : '"id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,\n  "created_at" timestamptz DEFAULT now()';

    const sql = `CREATE TABLE IF NOT EXISTS "${schema}"."${name}" (\n  ${colDefs}\n);`;

    const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: sql })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Supabase API error ${res.status}`);
    }

    return `Table "${name}" created in schema "${schema}" on project ${projectRef}`;
  }

  async function getApiKeys({ projectRef: ref }) {
    const token = await getAccessToken();
    const projectRef = await getProjectRef({ projectRef: ref });

    const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/api-keys`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) throw new Error(`Failed to fetch API keys: ${res.status}`);
    const keys = await res.json();

    // Display keys in a toast-like overlay on the page too
    const anon = keys.find(k => k.name === 'anon')?.api_key;
    const service = keys.find(k => k.name === 'service_role')?.api_key;

    // Copy anon key to clipboard
    if (anon) {
      await navigator.clipboard.writeText(anon).catch(() => {});
    }

    return `API keys retrieved for project ${projectRef}.\nAnon key (copied to clipboard): ${anon ? anon.substring(0, 20) + '...' : 'not found'}\nService role key: ${service ? service.substring(0, 20) + '...' : 'not found'}`;
  }

  async function createProject({ name, organizationId, region = 'us-east-1', dbPassword }) {
    const token = await getAccessToken();

    if (!name) throw new Error('Project name is required');
    if (!organizationId) throw new Error('organizationId is required');
    if (!dbPassword) throw new Error('dbPassword is required');

    const res = await fetch('https://api.supabase.com/v1/projects', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name, organization_id: organizationId, region, db_pass: dbPassword })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to create project: ${res.status}`);
    }

    const project = await res.json();
    return `Project "${name}" created! Project ref: ${project.id}. It will be ready in ~1 minute.`;
  }

  function report(success, message, sourceTabId) {
    chrome.runtime.sendMessage({
      type: 'PLATFORM_RESULT',
      success,
      resultMessage: message,
      sourceTabId
    });
  }

  console.log('[AI Browser Action] Supabase platform script loaded');
})();
