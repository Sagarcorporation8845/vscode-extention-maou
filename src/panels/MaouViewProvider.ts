import * as vscode from 'vscode';
import { MaouController } from '../orchestration/controller';
import { GoogleAuth } from '../auth/googleAuth';

export class MaouViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly controller: MaouController,
    private readonly auth: GoogleAuth
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void | Thenable<void> {
    this._view = webviewView;
    const webview = webviewView.webview;
    webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, 'src', 'ui', 'webview'),
        vscode.Uri.joinPath(this.extensionUri, 'node_modules', '@vscode', 'webview-ui-toolkit', 'dist'),
      ],
    };

    webview.html = this.getHtml(webview);

    webview.onDidReceiveMessage(async (message) => {
      switch (message.type) {
        case 'ready': {
          await this.auth.initialize();
          this.postAuthState();
          this.controller.bindWebview(this._view!);
          break;
        }
        case 'login': {
          await this.auth.login();
          this.postAuthState();
          break;
        }
        case 'logout': {
          await this.auth.logout();
          this.postAuthState();
          break;
        }
        case 'send': {
          await this.controller.handleUserMessage(message.text);
          break;
        }
        case 'attach-file': {
          await this.controller.attachFileFlow();
          break;
        }
        case 'accept-plan': {
          await this.controller.acceptPlan();
          break;
        }
        case 'reject-plan': {
          await this.controller.rejectPlan();
          break;
        }
        case 'select-model': {
          const model = message.model as string;
          this.controller.setSelectedModel(model);
          break;
        }
        case 'toggle-auto-apply': {
          this.controller.setAutoApply(message.enabled === true);
          break;
        }
      }
    });
  }

  postAuthState() {
    this._view?.webview.postMessage({ type: 'auth-state', loggedIn: this.auth.isAuthenticatedSync() });
  }

  focusInput() {
    this._view?.webview.postMessage({ type: 'focus-input' });
  }

  private getHtml(webview: vscode.Webview): string {
    const toolkitUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'node_modules', '@vscode', 'webview-ui-toolkit', 'dist', 'toolkit.js')
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'src', 'ui', 'webview', 'main.js')
    );
    const stylesUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'src', 'ui', 'webview', 'styles.css')
    );
    const nonce = getNonce();

    const csp = [
      "default-src 'none'",
      `img-src ${webview.cspSource} https: data:`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src 'nonce-${nonce}' ${webview.cspSource}`,
      `font-src ${webview.cspSource}`,
      `connect-src ${webview.cspSource} https: http:`,
    ].join('; ');

    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link href="${stylesUri}" rel="stylesheet" />
    <title>Maou</title>
  </head>
  <body>
    <div class="container">
      <header class="header">
        <div class="title">Maou</div>
        <div class="controls">
          <vscode-dropdown id="model-select">
            <vscode-option value="gemini-2.5-pro">Gemini 2.5 Pro</vscode-option>
            <vscode-option value="gemini-2.5-flash">Gemini 2.5 Flash</vscode-option>
          </vscode-dropdown>
          <vscode-checkbox id="auto-apply">Auto-apply</vscode-checkbox>
          <vscode-button id="login-btn" appearance="secondary">Login</vscode-button>
          <vscode-button id="logout-btn" appearance="secondary">Logout</vscode-button>
        </div>
      </header>

      <main id="chat" class="chat"></main>

      <footer class="composer">
        <vscode-button id="attach-file" appearance="icon">
          <span class="codicon codicon-link"></span>
        </vscode-button>
        <textarea id="input" rows="3" placeholder="Ask Maou... Use @ to attach files"></textarea>
        <vscode-button id="send" appearance="primary">Send</vscode-button>
      </footer>
    </div>

    <script nonce="${nonce}" type="module" src="${toolkitUri}"></script>
    <script nonce="${nonce}" src="${scriptUri}"></script>
  </body>
</html>`;
  }
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}