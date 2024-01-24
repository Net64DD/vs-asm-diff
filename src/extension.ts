import * as vscode from 'vscode';
import ConfigWrapper from './config';
import ASMDiffWrapper from './asm.handler';
import ASMDiffWebview from './diff.view';
import path from 'path';
import fs from 'fs';

export default class ASMDiffExtension {

	private config: ConfigWrapper;
	private asm: ASMDiffWrapper;
	private view: ASMDiffWebview;

	constructor(private readonly _context: vscode.ExtensionContext) {
		this.config = new ConfigWrapper();
		this.asm = new ASMDiffWrapper(this);
		this.view = new ASMDiffWebview(_context, this.asm);
	}

	public async onInit(){
		this.asm.init();
		this._context.subscriptions.push(
			vscode.commands.registerCommand('asm-diff.setDiffTool', this.setDiffASMPath.bind(this)),
			vscode.commands.registerCommand('asm-diff.showDiffFunc', this.asm.executeASMDiff.bind(this.asm)),
		);
		vscode.window.showInformationMessage('ASM Diff extension initialized, enjoy it!');
	}

	public async onExit(){}

	public async setDiffASMPath(){
		const cwd = this.getCurrentDirectory();

		const fileUri = await vscode.window.showOpenDialog({
			openLabel: 'Open',
			canSelectMany: false,
			canSelectFiles: false,
			canSelectFolders: true,
			defaultUri: cwd ? vscode.Uri.file(cwd) : undefined
	   	});

		if (fileUri && fileUri[0]) {
			let diff = fileUri[0].fsPath;

			if (!diff.startsWith(cwd!)) {
				vscode.window.showErrorMessage('Path must be relative to workspace');
				return;
			}

			if (fs.existsSync(path.join(diff, 'diff.py'))) {
				diff = path.relative(cwd!, diff);
				this.config.set('path', diff);
				vscode.window.showInformationMessage('asm-diff path set to ' + diff);
			} else {
				vscode.window.showErrorMessage('Invalid path, diff.py not found');
			}
		}
	}

	public getConfig(): ConfigWrapper {
		return this.config;
	}

	public getASM(): ASMDiffWrapper {
		return this.asm;
	}

	public getView(): ASMDiffWebview {
		return this.view;
	}

	public getCurrentDirectory() {
		return vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri.fsPath : undefined;
	}
}

// ASMDiff - Extension API

let extension: ASMDiffExtension;

export function activate(ctx: vscode.ExtensionContext) {
	extension = new ASMDiffExtension(ctx);
	extension.onInit();
}

export function deactivate() {
	extension.onExit();
}
