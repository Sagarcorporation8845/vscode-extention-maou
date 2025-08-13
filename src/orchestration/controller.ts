import * as vscode from 'vscode';
import { TextDecoder } from 'util';
import { GeminiClient } from '../gemini/client';
import { Attachment, ExecutionPlan } from './planTypes';
import { Prompter } from './prompter';
import { Executor } from './executor';
import { PreviewContentProvider } from '../preview/previewProvider';

export class MaouController {
  private webviewView?: vscode.WebviewView;
  private attachments: Attachment[] = [];
  private prompter = new Prompter();
  private executor: Executor;
  private pendingPlan: ExecutionPlan | undefined;
  private autoApplyPlans: boolean;
  private selectedModel: string;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly gemini: GeminiClient,
    previewProvider: PreviewContentProvider,
    opts: { autoApplyPlans: boolean; defaultModel: string }
  ) {
    this.executor = new Executor(previewProvider);
    this.autoApplyPlans = opts.autoApplyPlans;
    this.selectedModel = opts.defaultModel;
  }

  bindWebview(view: vscode.WebviewView) {
    this.webviewView = view;
    // Initialize UI state
    view.webview.postMessage({ type: 'model', model: this.selectedModel });
    view.webview.postMessage({ type: 'auto-apply', enabled: this.autoApplyPlans });
  }

  setSelectedModel(model: string) {
    this.selectedModel = model;
    this.webviewView?.webview.postMessage({ type: 'model', model });
  }

  getSelectedModel(): string {
    return this.selectedModel;
  }

  setAutoApply(enabled: boolean) {
    this.autoApplyPlans = enabled;
    this.context.workspaceState.update('maou.autoApplyPlans', enabled);
  }

  async handleUserMessage(text: string) {
    if (!text || !text.trim()) return;

    this.webviewView?.webview.postMessage({ type: 'chat:user', text });

    const prompt = this.prompter.buildPlanPrompt(text, this.attachments);
    this.webviewView?.webview.postMessage({ type: 'chat:assistant', text: 'Thinking…' });

    try {
      const modelText = await this.gemini.generateText(prompt);
      const plan = this.prompter.parsePlanFromModelText(modelText);
      if (!plan) {
        this.webviewView?.webview.postMessage({ type: 'chat:assistant', text: 'Failed to parse plan. Please try again.' });
        return;
      }

      this.pendingPlan = plan;
      this.webviewView?.webview.postMessage({ type: 'plan', plan });

      const prepared = await this.executor.prepare(plan);

      if (!this.autoApplyPlans) {
        await this.executor.previewDiffs(prepared);
        this.webviewView?.webview.postMessage({ type: 'plan:await-approval' });
      } else {
        await this.executor.apply(prepared);
        await this.executor.confirmAndDelete(prepared.deletePaths);
        this.webviewView?.webview.postMessage({ type: 'chat:assistant', text: 'Changes applied.' });
        this.attachments = [];
        this.pendingPlan = undefined;
      }
    } catch (err: any) {
      this.webviewView?.webview.postMessage({ type: 'chat:assistant', text: `Error: ${err.message || String(err)}` });
    }
  }

  async acceptPlan() {
    if (!this.pendingPlan) return;
    const prepared = await this.executor.prepare(this.pendingPlan);
    await this.executor.apply(prepared);
    await this.executor.confirmAndDelete(prepared.deletePaths);
    this.webviewView?.webview.postMessage({ type: 'chat:assistant', text: 'Plan applied.' });
    this.attachments = [];
    this.pendingPlan = undefined;
  }

  async rejectPlan() {
    this.pendingPlan = undefined;
    this.webviewView?.webview.postMessage({ type: 'chat:assistant', text: 'Plan rejected.' });
  }

  async attachFileFlow() {
    const files = await vscode.workspace.findFiles('**/*', '**/node_modules/**');
    const picks = files.map((f) => ({ label: vscode.workspace.asRelativePath(f), uri: f }));
    const selected = await vscode.window.showQuickPick(picks, { placeHolder: 'Attach a file for context' });
    if (!selected) return;

    const contentBytes = await vscode.workspace.fs.readFile(selected.uri);
    const content = new TextDecoder().decode(contentBytes);
    const attachment = { filePath: selected.label, content };
    this.attachments.push(attachment);
    this.webviewView?.webview.postMessage({ type: 'attachment', attachment: { filePath: attachment.filePath } });
  }
}