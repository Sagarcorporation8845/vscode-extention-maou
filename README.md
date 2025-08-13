# Maou VS Code Extension

Maou is a workspace-aware AI partner for VS Code, powered by Google's Gemini 2.5 (Pro/Flash) models. It can understand your workspace, propose multi-file change plans, preview diffs, and apply changes on approval (or automatically if enabled).

## Key Features
- Sidebar chat with modern UI
- Secure Google OAuth 2.0 login (stored via VS Code Secrets)
- Model selection: `gemini-2.5-pro` and `gemini-2.5-flash`
- @-attach files to share context
- Orchestration Engine that produces structured JSON plans
- Diff previews for CREATE/UPDATE before apply
- Safe DELETE with explicit confirmation
- Auto-apply toggle (except DELETE)
- Status bar to show Maou state

## Setup
1. Install dependencies and compile:
```bash
npm install
npm run compile
```
2. Update settings if needed (client id/secret) under `Maou` settings.
3. Press F5 to run the Extension Development Host.
4. Open the Maou view in the Explorer sidebar and click Login.

## Notes
- Tokens are stored using the VS Code Secrets API.
- OAuth uses a secure loopback (localhost) receiver; ensure your firewall allows localhost callbacks.
- The extension requests the `https://www.googleapis.com/auth/generative-language` scope.
