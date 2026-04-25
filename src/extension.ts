import * as vscode from 'vscode';
import { formatAql } from './formatter';

export function activate(context: vscode.ExtensionContext) {
  const formatter = vscode.languages.registerDocumentFormattingEditProvider('aql', {
    provideDocumentFormattingEdits(
      document: vscode.TextDocument,
      options: vscode.FormattingOptions
    ): vscode.TextEdit[] {
      try {
        const text = document.getText();
        const printWidth = vscode.workspace.getConfiguration('aql-formatter', document.uri).get<number>('printWidth', 80);

        const formatted = formatAql(text, {
          tabSize: options.tabSize,
          insertSpaces: options.insertSpaces,
          printWidth,
        });

        const fullRange = new vscode.Range(
          document.positionAt(0),
          document.positionAt(text.length)
        );

        return [vscode.TextEdit.replace(fullRange, formatted)];
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        vscode.window.showWarningMessage(`AQL Formatter: ${msg}`);
        return [];
      }
    },
  });

  context.subscriptions.push(formatter);
}

export function deactivate() {}
