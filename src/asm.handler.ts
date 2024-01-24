import * as vscode from 'vscode';
import path from 'path';
import ASMDiffExtension from './extension';
import { exec } from 'child_process';

const faces = [
    '°՞(ᗒᗣᗕ)՞°',
    '(っ◞‸◟ c)',
    '｡°(°.◜ᯅ◝°)°｡',
    '(◞‸◟；)',
    'ヽ(´□｀。)ﾉ'
]

type ASMContext = {
    function: string;
    file: string;
}

class ASMDiffWrapper {

    current: ASMContext | undefined;

    constructor(
        private readonly _context: ASMDiffExtension,
    ){}

    public init(){
        vscode.workspace.onDidSaveTextDocument(this.onDocumentSave.bind(this));
    }

    private async onDocumentSave(document: vscode.TextDocument){
        if(!this.current || this.current.file !== document.fileName){
            return;
        }

        await this.executeASMDiff();
    }

    private async validateASMPath(){
        const config = this._context.getConfig();

        if (!config.has('path')) {
            vscode.window.showErrorMessage('No path set for asm-diff, please set one');
            await this._context.setDiffASMPath();
            return false;
        }

        return true;
    }

    private getFunctionDiff(func: string): Promise<string> {
        const config = this._context.getConfig();

        const command = `python3 -u ./${path.join(config.get('path')!, 'diff.py')} -mow3 --format html ${func}`;
        const child = exec(command, { cwd: this._context.getCurrentDirectory() });
        let buffer = '';
        let failed = false;

        return new Promise<string>((resolve, reject) => {
            child.stdout?.on('data', (data) => {
                buffer += data.toString();
                failed = true;
            });

            child.stderr?.on('data', data => {
                buffer += data.toString();
            });

            child.on('close', async () => {
                const raw = buffer.toLowerCase();
                const fakeDetection = raw.includes("<table class='diff'>")

                if(failed && !fakeDetection){
                    reject(new DiffGenerationException(buffer.replace(/\x1b[^m]*m/g, '')));
                }

                if(raw.includes('No such file or directory')){
                    reject(new DiffGenerationException('No such file or directory'));
                }

                if(raw.includes('Not able to find')){
                    reject(new DiffGenerationException('No such function found'));
                }

                if(raw.includes('error')){
                    reject(new DiffGenerationException('ASM-Diff encountered an error'));
                }

                if(!fakeDetection){
                    reject(new DiffGenerationException('No diff generated, compilation may have failed!'));
                }

                const html = buffer.slice(buffer.indexOf("<table class='diff'>"));
                resolve(html);
            });
        });
    }

    public async getCurrentFunction(): Promise<string | undefined> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return undefined;
        }

        // Try to get the function name from the current line
        const documentSymbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>('vscode.executeDocumentSymbolProvider', editor.document.uri);
        if ( Symbol.iterator in Object(documentSymbols)) {
            for (const item of documentSymbols) {
                if (item.range.contains(editor.selection.active)) {
                    let symbol = item.name.replace(/\(.*$/, "");
                    return symbol;
                }
            }
        }

        // Fallback to the selection
        const selection = editor.selection;
        if (selection && !selection.isEmpty) {
            const selectionRange = new vscode.Range(selection.start.line, selection.start.character, selection.end.line, selection.end.character);
            return editor.document.getText(selectionRange).trim();
        }
    }

    public async executeASMDiff(){
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        const file = editor.document.fileName;
        const func = this.current ? this.current.function : await this.getCurrentFunction();

        if(!func){
            vscode.window.showErrorMessage('No function found or selected');
            return;
        }

        const view = this._context.getView();

        try {
            if(!await this.validateASMPath()){
                return;
            }
            view.create();
            const html = await this.getFunctionDiff(func);
            view.deployHTML('views/differ/differ.html', {
                'buffer': html
            });
            view.postMessage({
                command: 'rebuild'
            });
            if(!this.current){
                this.current = {
                    function: func,
                    file: file
                };
            }
        } catch (e) {
            const face = faces[Math.floor(Math.random() * faces.length)];
            view.deployHTML('views/differ/differ.html', {
                'buffer': `<div class="error-app"><p>An error occurred during compilation ${face}</p>` + (e instanceof DiffGenerationException ? e.message.split('\n').filter(m=> m.trim().length != 0).map(m => {
                    return `<span class="error">${m.trim().replace('\n', '')}</span>`;
                }).join('\n') : 'An unknown error occurred, try to validate your code and rebuild') + '</div>'
            });
        }
    }

    public clearCurrent(){
        this.current = undefined;
    }
}

class DiffGenerationException extends Error {
    constructor(message: string) {
        super(message);
    }
}

export default ASMDiffWrapper;