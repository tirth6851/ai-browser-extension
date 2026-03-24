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

## Features

- **Supabase integration** — create tables, fetch project URLs, manage API keys
- **Vercel integration** — read deployment logs, check build errors
- **Works with Claude** — listens to Claude.ai chat and responds to action commands
- **Zero setup** — install the extension, load it in Chrome, and go

## Supported Platforms

| Platform | Actions |
|---|---|
| Supabase | Create tables, read project info, get API keys |
| Vercel | Read deployment logs, check errors |
| More coming | GitHub, Railway, PlanetScale, etc. |

## Installation

This extension is not yet on the Chrome Web Store. Install it manually:

1. Clone or download this repo
   ```
   git clone https://github.com/tirth6851/ai-browser-extension.git
   ```
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked**
5. Select the `ai-browser-extension` folder
6. The extension icon will appear in your toolbar

## Usage

1. Open [Claude.ai](https://claude.ai) (or your AI chat of choice)
2. Click the extension icon to see its status
3. Start chatting — when the AI detects it needs to take a browser action, the extension will handle it
4. You'll see a confirmation in the extension popup for each action taken

## Project Structure

```
ai-browser-extension/
├── manifest.json              # Extension config (Manifest V3)
├── background/
│   └── service-worker.js      # Background script, handles messaging
├── content/
│   ├── chat-watcher.js        # Watches AI chat for action commands
│   └── platform-scripts/
│       ├── supabase.js        # Supabase browser actions
│       └── vercel.js          # Vercel browser actions
├── popup/
│   ├── popup.html             # Extension popup UI
│   ├── popup.css              # Popup styles
│   └── popup.js               # Popup logic
└── icons/                     # Extension icons
```

## Roadmap

- [ ] Support for more AI platforms (ChatGPT, Gemini)
- [ ] GitHub actions (create repos, manage secrets)
- [ ] Railway / Render deployment support
- [ ] PlanetScale / Neon database support
- [ ] Action history log in popup
- [ ] One-click approval flow for sensitive actions

## Contributing

Ideas, issues, and PRs are welcome. This project is early-stage — if you have a platform integration you'd like to see, open an issue.

## License

MIT
