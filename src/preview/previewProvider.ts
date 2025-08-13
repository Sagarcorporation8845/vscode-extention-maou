import * as vscode from 'vscode';

export class PreviewContentProvider implements vscode.TextDocumentContentProvider {
  static readonly scheme = 'maou-preview';

  private readonly onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
  readonly onDidChange = this.onDidChangeEmitter.event;

  private contentByUri = new Map<string, string>();

  setPreviewContent(uri: vscode.Uri, content: string) {
    this.contentByUri.set(uri.toString(), content);
    this.onDidChangeEmitter.fire(uri);
  }

  provideTextDocumentContent(uri: vscode.Uri): string | Thenable<string> {
    return this.contentByUri.get(uri.toString()) ?? '';
  }
}