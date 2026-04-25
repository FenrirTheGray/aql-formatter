import * as vscode from 'vscode';
import { formatAql, FormatterDiagnostic } from './formatter';
import { computeDedentIndent } from './on-type';

const toVscodeDiagnostic = (
  document: vscode.TextDocument,
  d: FormatterDiagnostic
): vscode.Diagnostic => {
  const start = document.positionAt(d.offset);
  const end = document.positionAt(d.offset + d.length);
  const severity = d.severity === 'error'
    ? vscode.DiagnosticSeverity.Error
    : vscode.DiagnosticSeverity.Warning;
  const diagnostic = new vscode.Diagnostic(new vscode.Range(start, end), d.message, severity);
  diagnostic.source = 'aql';
  return diagnostic;
};

/**
 * VS Code 1.74+ infers activation from contributes.languages plus the
 * registered formatter, so package.json's activationEvents stays empty
 * by design. Do not add an onLanguage:aql entry here.
 */
export function activate(context: vscode.ExtensionContext) {
  const diagnostics = vscode.languages.createDiagnosticCollection('aql');
  context.subscriptions.push(diagnostics);

  const formatter = vscode.languages.registerDocumentFormattingEditProvider('aql', {
    provideDocumentFormattingEdits(
      document: vscode.TextDocument,
      options: vscode.FormattingOptions
    ): vscode.TextEdit[] {
      try {
        const text = document.getText();
        const config = vscode.workspace.getConfiguration('aql-formatter', document.uri);
        const printWidth = config.get<number>('printWidth', 80);
        const keywordCase = config.get<'upper' | 'lower' | 'preserve'>('keywordCase', 'upper');
        const trailingComma = config.get<'none' | 'multiline' | 'always'>('trailingComma', 'none');

        const result = formatAql(text, {
          tabSize: options.tabSize,
          insertSpaces: options.insertSpaces,
          printWidth,
          keywordCase,
          trailingComma,
        });

        diagnostics.set(document.uri, result.diagnostics.map(d => toVscodeDiagnostic(document, d)));

        const fullRange = new vscode.Range(
          document.positionAt(0),
          document.positionAt(text.length)
        );

        return [vscode.TextEdit.replace(fullRange, result.text)];
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        vscode.window.showWarningMessage(`AQL Formatter: ${msg}`);
        return [];
      }
    },
  });

  context.subscriptions.push(formatter);

  const onType = vscode.languages.registerOnTypeFormattingEditProvider(
    'aql',
    {
      provideOnTypeFormattingEdits(
        document: vscode.TextDocument,
        position: vscode.Position,
        ch: string
      ): vscode.TextEdit[] {
        if (ch !== '}' && ch !== ')' && ch !== ']') return [];
        const text = document.getText();
        const offset = document.offsetAt(position);
        const indent = computeDedentIndent(text, offset, ch);
        if (indent === null) return [];
        const lineStart = document.lineAt(position.line).range.start;
        const triggerStart = position.translate(0, -1);
        return [vscode.TextEdit.replace(new vscode.Range(lineStart, triggerStart), indent)];
      },
    },
    '}',
    ')',
    ']',
    '\n'
  );

  context.subscriptions.push(onType);
}

export function deactivate() {}
