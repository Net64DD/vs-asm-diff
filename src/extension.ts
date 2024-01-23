// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

let context: vscode.ExtensionContext;
let panel: vscode.WebviewPanel;
let funcName: string;
let file: string;

function getCWD() {
	return vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri.fsPath : undefined;
}

function setDiffASMPath(){
	const cwd = getCWD();

	const options: vscode.OpenDialogOptions = {
		openLabel: 'Open',
		canSelectMany: false,
		canSelectFiles: false,
        canSelectFolders: true,
		defaultUri: cwd ? vscode.Uri.file(cwd) : undefined
   };

	vscode.window.showOpenDialog(options).then(fileUri => {
		if (fileUri && fileUri[0]) {
			let diff = fileUri[0].fsPath;

			if (!diff.startsWith(cwd!)) {
				vscode.window.showErrorMessage('Path must be relative to workspace');
				return;
			}

			if (fs.existsSync(path.join(diff, 'diff.py'))) {
				diff = path.relative(cwd!, diff);
				vscode.workspace.getConfiguration().update('asm-diff.path', diff, true);
				vscode.window.showInformationMessage('asm-diff path set to ' + diff);
			} else {
				vscode.window.showErrorMessage('Invalid path, diff.py not found');
			}
		}
	});
}

function build(){
	generateDiff(panel);
}

function executeASMDiff(){
	const config = vscode.workspace.getConfiguration();

	if (!config.has('asm-diff.path')) {
		vscode.window.showErrorMessage('No path set for asm-diff, please set one');
		setDiffASMPath();
		return;
	}

	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		return;
	}
	const selection = editor.selection;
	if (selection && !selection.isEmpty) {
		const selectionRange = new vscode.Range(selection.start.line, selection.start.character, selection.end.line, selection.end.character);
		funcName = editor.document.getText(selectionRange).trim();
		file = editor.document.fileName;

		panel = vscode.window.createWebviewPanel(
			'diff',
			'ASM Diff',
			vscode.ViewColumn.Beside,
			{
				enableScripts: true,
				localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'assets'))]
			}
		);
		deployHTML(panel, fs.readFileSync(path.join(context.extensionPath, 'assets', 'loading.html'), 'utf8'));
		build();
	} else {
		vscode.window.showInformationMessage('No text selected');
	}
}

function generateDiff(panel: vscode.WebviewPanel) {
	const config = vscode.workspace.getConfiguration();
	const command = `python3 -u ./${path.join(config.get('asm-diff.path')!, 'diff.py')} -mow3 --format html ${funcName}`;
	const child = exec(command, { cwd: getCWD() });
	let buffer = '';
	child.stdout?.on('data', (data) => {
		buffer += data.toString();
	});
	child.on('close', async () => {
		buffer = buffer.slice(buffer.indexOf("<table class='diff'>"));
		deployHTML(panel, `
			<html>
				<head>
					<meta name="viewport" content="width=device-width, initial-scale=1.0">
					<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src {cspSource} https:; script-src {cspSource}; style-src {cspSource};"/>
					<link href='https://fonts.googleapis.com/css?family=JetBrains Mono' rel='stylesheet'>
					<link rel="stylesheet" href={assets:style.css}>
					<link rel="preconnect" href="https://fonts.googleapis.com">
					<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
					<link href="https://fonts.googleapis.com/css2?family=Inconsolata:wght@500&display=swap" rel="stylesheet">
					<script src={assets:line.js}></script>
				</head>
				<body>
					<div id="app">
						${buffer}
					</div>
				</body>
			</html>`
		)
		ping();
	});
	child.stderr?.on('data', data => {
		vscode.window.showErrorMessage(data);
	});
}

function importAssets(html: string, panel: vscode.WebviewPanel) {
	let pattern = /\{assets:(.*?)\}/g;
	let match = pattern.exec(html);
	while (match != null) {
		const asset = match[1];
		const url = panel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, 'assets', asset))).toString();
		console.log(url);
		html = html.replace(`{assets:${asset}}`, `${url}`);
		match = pattern.exec(html);
	}
	return html;
}

function deployHTML(panel: vscode.WebviewPanel, html: string) {
	html = html.replace(/\{cspSource\}/g, panel.webview.cspSource);
	html = importAssets(html, panel);
	panel.webview.html = html;
}

function ping(){
	if(!vscode.window.activeTextEditor) return;
	const line = vscode.window.activeTextEditor.selection.start.line + 1;
	panel.webview.postMessage({
		command: 'ping',
		line: line
	});
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(ctx: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	context = ctx;

	vscode.workspace.onDidSaveTextDocument((document: vscode.TextDocument) => {
		if (document.fileName === file) {
			build();
			panel.webview.postMessage({ command: 'rebuild' });
		}
	});

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json

	ctx.subscriptions.push(
		vscode.commands.registerCommand('asm-diff.setDiffTool', setDiffASMPath),
		vscode.commands.registerCommand('asm-diff.diffFunc', executeASMDiff)
	);

	setInterval(ping, 50);
}

// This method is called when your extension is deactivated
export function deactivate() {}
