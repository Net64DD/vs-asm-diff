import * as vscode from 'vscode';
import path from 'path';
import fs from 'fs';
import ASMDiffWrapper from './asm.handler';

type WebviewListener = (message: any) => void;

class ASMDiffWebview {

    private panel: vscode.WebviewPanel;
    private initialized: boolean = false;
    private currentTimer: NodeJS.Timeout | undefined;
    private _listeners: WebviewListener[] = [];

    constructor(
		private readonly _context: vscode.ExtensionContext,
        private readonly _asm: ASMDiffWrapper
	) {
        // Stupid hack to make TypeScript happy
        this.panel = {} as any;
    }

    public create(){
        if (this.initialized) {
            return;
        }

        this.initialized = true;
        this.panel = vscode.window.createWebviewPanel(
			'asm:diff',
			'ASM Diff',
			vscode.ViewColumn.Beside, {
                enableFindWidget: true,
				enableScripts: true,
				localResourceRoots: [
                    vscode.Uri.file(path.join(this._context.extensionPath, 'assets'))
                ]
			}
		);

        this.panel.webview.onDidReceiveMessage(message => {
            this._listeners.forEach(listener => listener(message));
        });

        this.panel.onDidDispose(this.onViewClose.bind(this));

        this.currentTimer = setInterval(this.emitCurrentLine.bind(this), 50);

        this.deployHTML('views/loading/loading.html');
    }

    public onViewClose() {
        this.initialized = false;
        this._asm.clearCurrent();
        if (this.currentTimer) {
            clearTimeout(this.currentTimer);
        }
    }

    public emitCurrentLine() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }
        this.postMessage({
            command: 'ping',
            line: editor.selection.start.line + 1
        });
    }

    public deployHTML(file: string, replacements?: { [key: string]: string }) {
        let html = fs.readFileSync(path.join(this._context.extensionPath, 'assets', file), 'utf8')
        html = html.replace(/\{cspSource\}/g, this.panel.webview.cspSource);
        if (replacements) {
            for (const key in replacements) {
                html = html.replace(new RegExp(`{${key}}`, 'g'), replacements[key]);
            }
        }
        this.panel.webview.html = this.importAssets(html, path.dirname(file));
    }

    public onMessage(listener: WebviewListener) {
        this._listeners.push(listener);
    }

    public postMessage(message: any) {
        this.panel.webview.postMessage(message);
    }

    private importAssets(html: string, parent?: string) {
        let pattern = /\{assets:(.*?)\}/g;
        let match = pattern.exec(html);
        while (match != null) {
            const asset = match[1];
            // Calculate relative path from the parent file
            const isRelative = asset.startsWith('./') || asset.startsWith('../') || !asset.startsWith('/');
            const url = this.panel.webview.asWebviewUri(vscode.Uri.file(path.join(this._context.extensionPath, 'assets', isRelative ? path.join(parent || '', asset) : asset))).toString()
            html = html.replace(`{assets:${asset}}`, `${url}`);
            match = pattern.exec(html);
        }
        return html;
    }
}

export default ASMDiffWebview;