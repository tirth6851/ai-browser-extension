# AI Browser Action

A browser extension that bridges the gap between AI chat tools and your browser — letting AI actually *do things* on your behalf, not just tell you what to do.

## The Problem

When you're building a web app with AI, the AI writes the code — but you still have to:

- Manually go to Supabase and create tables / copy API keys
- Click through Vercel dashboards to debug deployment errors
- Context-switch between your AI chat and 5 different browser tabs

The AI knows what needs to happen, but it can't reach out and do it.

## The Solution

AI Browser Action is the bridge. It sits in your browser and listens to your AI chat. When the AI needs to take a real action — like creating a Supabase table or reading a Vercel error log — the extension handles it automatically. You stay in the chat. The work gets done.

---

## Installation

This extension is not on the Chrome Web Store yet. Load it manually in 4 steps:

1. **Clone or download this repo**
   ```
   git clone https://github.com/tirth6851/ai-browser-extension.git
   ```

2. **Open your browser's extensions page**
   - Chrome: `chrome://extensions`
   - Comet / Arc / Brave / Edge: same URL — `chrome://extensions`

3. **Enable Developer Mode**
   Toggle the switch in the top-right corner of the extensions page.

4. **Load the extension**
   Click **Load unpacked** → select the `ai-browser-extension` folder.

The ⚡ icon will appear in your toolbar. You're ready.

---

## How to Use

### Step 1 — Copy the system prompt

Click the ⚡ extension icon in your toolbar, then click **Copy System Prompt**.

This copies a special prompt that tells Claude how to trigger browser actions using the extension.

### Step 2 — Paste it into Claude

1. Go to [claude.ai](https://claude.ai)
2. Start a new conversation
3. Paste the copied system prompt as your **first message** (or into the system prompt field if using Projects)

### Step 3 — Make sure you're logged in to your platforms

The extension uses your existing browser sessions — no passwords stored. Before asking Claude to do anything, make sure you're logged into:

- [supabase.com](https://supabase.com) — if using Supabase actions
- [vercel.com](https://vercel.com) — if using Vercel actions

### Step 4 — Start building and let Claude take actions

Chat with Claude normally. When Claude needs to perform a browser action (e.g. create a table), it will output a special action tag. The extension detects it and shows a **confirmation toast** in the bottom-right corner of your screen:

```
⚡ AI Action Detected
supabase.createTable
{ "name": "users", ... }

[ Execute ]  [ Cancel ]
```

Click **Execute** to run it, or **Cancel** to skip it.

### Step 5 — Check results

- A green toast appears on success, red on failure
- The extension popup shows a history of all actions taken

---

## What Claude Can Do

### Supabase

| Action | What it does |
|---|---|
| `supabase.createTable` | Creates a new table with custom columns |
| `supabase.getApiKeys` | Fetches your anon + service role keys (copies anon key to clipboard) |
| `supabase.createProject` | Creates a new Supabase project |

**Example prompt to Claude:**
> "Create a users table in my Supabase project with id, email, and created_at columns"

Claude will output:
```
[ACTION: supabase.createTable({"name": "users", "columns": [
  {"name": "id", "type": "uuid", "primaryKey": true},
  {"name": "email", "type": "text", "notNull": true},
  {"name": "created_at", "type": "timestamptz", "default": "now()"}
]})]
```
The extension detects it → you click Execute → table is created.

---

### Vercel

| Action | What it does |
|---|---|
| `vercel.listDeployments` | Lists recent deployments for a project |
| `vercel.getLatestDeploymentStatus` | Gets the status and URL of the latest deploy |
| `vercel.getDeploymentLogs` | Fetches build/error logs from a deployment |
| `vercel.setEnvVar` | Sets an environment variable on a project |

**Example prompt to Claude:**
> "My Vercel deployment is failing, check the logs for project prj_abc123"

Claude will output:
```
[ACTION: vercel.getDeploymentLogs({"projectId": "prj_abc123"})]
```
The extension fetches the logs and reports them back to the chat so Claude can diagnose the error.

---

## Full Example Workflow

Here's a real end-to-end session:

1. You tell Claude: *"I'm building a todo app. Set up Supabase and Vercel for me."*
2. Claude creates a Supabase table → you click Execute
3. Claude fetches your API keys → anon key is copied to clipboard automatically
4. Claude sets your `NEXT_PUBLIC_SUPABASE_URL` env var on Vercel → you click Execute
5. Claude checks your latest deployment status → sees it failed → reads the logs → explains the error

You never left the chat window.

---

## Supported Platforms

| Platform | Status |
|---|---|
| Supabase | ✅ Supported |
| Vercel | ✅ Supported |
| GitHub | Roadmap |
| Railway | Roadmap |
| PlanetScale / Neon | Roadmap |

---

## Project Structure

```
ai-browser-extension/
├── manifest.json                  # Extension config (Manifest V3)
├── SYSTEM_PROMPT.txt              # Paste this into Claude to enable actions
├── background/
│   └── service-worker.js          # Orchestrates action flow and messaging
├── content/
│   ├── chat-watcher.js            # Watches Claude.ai for [ACTION: ...] tags
│   └── platform-scripts/
│       ├── supabase.js            # Supabase browser actions
│       └── vercel.js              # Vercel browser actions
├── popup/
│   ├── popup.html                 # Extension popup UI
│   ├── popup.css                  # Popup styles
│   └── popup.js                   # Popup logic + system prompt copy button
└── icons/                         # Extension icons
```

---

## How It Works (Technical)

1. The extension injects `chat-watcher.js` into claude.ai
2. It watches the DOM for Claude responses containing `[ACTION: platform.method({...})]` tags
3. When detected, it sends the action to the background service worker
4. A confirmation toast appears on screen — you approve or cancel
5. On approval, the service worker opens (or reuses) a tab for the target platform
6. The platform script (`supabase.js` / `vercel.js`) is injected and uses your existing login session to call the platform's API
7. The result is reported back to your Claude tab

No credentials are ever stored. The extension only uses your existing logged-in browser sessions.

---

## Roadmap

- [ ] Support for ChatGPT and Gemini
- [ ] GitHub actions (create repos, manage secrets)
- [ ] Railway / Render deployment support
- [ ] PlanetScale / Neon database support
- [ ] Action history log in popup
- [ ] One-click approval flow for sensitive actions

---

## Contributing

Ideas, issues, and PRs are welcome. This project is early-stage — if you have a platform integration you'd like to see, open an issue.

## License

MIT
