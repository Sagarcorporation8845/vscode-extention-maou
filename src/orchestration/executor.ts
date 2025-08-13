import * as vscode from 'vscode';
import { ExecutionPlan, PlanAction } from './planTypes';
import { PreviewContentProvider } from '../preview/previewProvider';

export interface PreparedEdit {
  edit: vscode.WorkspaceEdit;
  changedFiles: { path: string; oldUri: vscode.Uri; newUri: vscode.Uri }[];
  deletePaths: string[];
}

export class Executor {
  constructor(private readonly previewProvider: PreviewContentProvider) {}

  async prepare(plan: ExecutionPlan): Promise<PreparedEdit> {
    const edit = new vscode.WorkspaceEdit();
    const changedFiles: { path: string; oldUri: vscode.Uri; newUri: vscode.Uri }[] = [];
    const deletePaths: string[] = [];

    for (const action of plan.actions) {
      if (action.type === 'DELETE_FILE') {
        deletePaths.push(action.path);
        continue;
      }

      const fsPath = this.toWorkspaceUri(action.path);
      const exists = await this.fileExists(fsPath);
      const newContent = (action as any).content as string;

      if (!exists) {
        edit.createFile(fsPath, { ignoreIfExists: true });
        edit.insert(fsPath, new vscode.Position(0, 0), newContent);

        const oldUri = vscode.Uri.parse('untitled:' + fsPath.toString());
        const newUri = this.previewUri(fsPath);
        this.previewProvider.setPreviewContent(newUri, newContent);
        changedFiles.push({ path: action.path, oldUri, newUri });
      } else {
        const doc = await vscode.workspace.openTextDocument(fsPath);
        const fullRange = new vscode.Range(
          doc.positionAt(0),
          doc.positionAt(doc.getText().length)
        );
        edit.replace(fsPath, fullRange, newContent);

        const newUri = this.previewUri(fsPath);
        this.previewProvider.setPreviewContent(newUri, newContent);
        changedFiles.push({ path: action.path, oldUri: fsPath, newUri });
      }
    }

    return { edit, changedFiles, deletePaths };
  }

  async previewDiffs(prepared: PreparedEdit) {
    for (const change of prepared.changedFiles) {
      const title = `Maou Preview: ${change.path}`;
      await vscode.commands.executeCommand('vscode.diff', change.oldUri, change.newUri, title);
    }
  }

  async apply(prepared: PreparedEdit) {
    const applied = await vscode.workspace.applyEdit(prepared.edit);
    if (!applied) {
      throw new Error('Failed to apply workspace edit');
    }
  }

  async confirmAndDelete(deletePaths: string[]) {
    for (const path of deletePaths) {
      const uri = this.toWorkspaceUri(path);
      const choice = await vscode.window.showWarningMessage(
        `Maou wants to delete ${path}. Proceed?`,
        { modal: true },
        'Delete',
        'Cancel'
      );
      if (choice === 'Delete') {
        await vscode.workspace.fs.delete(uri, { recursive: false, useTrash: true });
      }
    }
  }

  private previewUri(target: vscode.Uri): vscode.Uri {
    const encoded = Buffer.from(target.toString()).toString('base64');
    return vscode.Uri.parse(`${PreviewContentProvider.scheme}://${encoded}`);
  }

  private async fileExists(uri: vscode.Uri): Promise<boolean> {
    try {
      await vscode.workspace.fs.stat(uri);
      return true;
    } catch {
      return false;
    }
  }

  private toWorkspaceUri(relPath: string): vscode.Uri {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) throw new Error('No workspace folder open');
    return vscode.Uri.joinPath(folder.uri, ...relPath.split('/'));
  }

  private async openDoc(uri: vscode.Uri): Promise<vscode.TextDocument> {
    try {
      return await vscode.workspace.openTextDocument(uri);
    } catch {
      // Create an empty virtual doc if not exists
      return await vscode.workspace.openTextDocument({ content: '' });
    }
  }
}