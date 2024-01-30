import * as vscode from 'vscode';
import ConfigWrapper from './config';
import ASMDiffWrapper from './asm.handler';
import ASMDiffWebview from './diff.view';
import path from 'path';
import fs from 'fs';
import M2CGenWrapper from './extra/m2c.handler';

export default class ASMDiffExtension {

	private config: ConfigWrapper;
	private asm: ASMDiffWrapper;
	private m2c: M2CGenWrapper;
	private view: ASMDiffWebview;

	constructor(private readonly _context: vscode.ExtensionContext) {
		this.config = new ConfigWrapper();
		this.asm = new ASMDiffWrapper(this);
		this.m2c = new M2CGenWrapper(this);
		this.view = new ASMDiffWebview(_context, this.asm);
	}

	public async onInit(){
		this.asm.init();
		this._context.subscriptions.push(
			vscode.commands.registerCommand('asm-diff.setDiffTool', this.setCFGPath.bind(this, 'path.asm', 'diff.py')),
			vscode.commands.registerCommand('asm-diff.setM2CTool', this.setCFGPath.bind(this, 'path.m2c', 'm2c.py', false)),
			vscode.commands.registerCommand('asm-diff.showDiffFunc', this.asm.executeASMDiff.bind(this.asm)),
			vscode.commands.registerCommand('asm-diff.genM2CFunc', this.m2c.executeM2C.bind(this.m2c)),
		);
		vscode.window.showInformationMessage('ASM Diff extension initialized, enjoy it!');
	}

	public async onExit(){}

	public async setCFGPath(key: string, pyfile: string, relative: boolean = true){
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

			if (relative && !diff.startsWith(cwd!)) {
				vscode.window.showErrorMessage('Path must be relative to workspace');
				return;
			}

			if (fs.existsSync(path.join(diff, pyfile))) {
				diff = path.relative(cwd!, diff);
				this.config.set(key, diff);
				vscode.window.showInformationMessage(`asm-diff ${key} set to ${diff}`);
			} else {
				vscode.window.showErrorMessage(`Invalid path, ${pyfile} not found`);
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
