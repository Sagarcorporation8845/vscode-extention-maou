import * as vscode from 'vscode';
import { MaouViewProvider } from './panels/MaouViewProvider';
import { GoogleAuth } from './auth/googleAuth';
import { GeminiClient } from './gemini/client';
import { MaouController } from './orchestration/controller';
import { PreviewContentProvider } from './preview/previewProvider';

let statusBarItem: vscode.StatusBarItem | undefined;

export async function activate(context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration('maou');
  const defaultModel = config.get<string>('model.default', 'gemini-2.5-pro');
  const autoApplyPlans = config.get<boolean>('autoApplyPlans', false);

  const googleAuth = new GoogleAuth(context);
  await googleAuth.initialize();
  const geminiClient = new GeminiClient(googleAuth, () => getSelectedModel());
  const previewProvider = new PreviewContentProvider();
  const controller = new MaouController(context, geminiClient, previewProvider, {
    autoApplyPlans,
    defaultModel,
  });

  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(PreviewContentProvider.scheme, previewProvider)
  );

  const viewProvider = new MaouViewProvider(context.extensionUri, controller, googleAuth);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('maou.sidebar', viewProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('maou.login', async () => {
      await googleAuth.login();
      updateStatusBar(googleAuth);
      viewProvider.postAuthState();
    }),
    vscode.commands.registerCommand('maou.logout', async () => {
      await googleAuth.logout();
      updateStatusBar(googleAuth);
      viewProvider.postAuthState();
    }),
    vscode.commands.registerCommand('maou.sendMessage', async () => {
      viewProvider.focusInput();
    })
  );

  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.command = 'maou.sendMessage';
  context.subscriptions.push(statusBarItem);
  updateStatusBar(googleAuth);

  function getSelectedModel(): string {
    return controller.getSelectedModel();
  }
}

export function deactivate() {
  // noop
}

function updateStatusBar(auth: GoogleAuth) {
  if (!statusBarItem) return;
  const isLoggedIn = auth.isAuthenticatedSync();
  statusBarItem.text = isLoggedIn ? 'Maou: Ready' : 'Maou: Login Required';
  statusBarItem.tooltip = isLoggedIn ? 'Maou is ready' : 'Click to open Maou and login';
  statusBarItem.show();
}