import * as vscode from 'vscode';
import path from 'path';
import ASMDiffExtension from './extension';
import { exec } from 'child_process';

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

        return new Promise<string>((resolve, reject) => {
            child.stdout?.on('data', (data) => {
                buffer += data.toString();
                console.log(data.toString());
            });

            child.on('close', async () => {
                const raw = buffer.toLowerCase();
                if(raw.includes('No such file or directory')){
                    reject(new DiffGenerationException('No such file or directory'));
                }

                if(raw.includes('Not able to find')){
                    reject(new DiffGenerationException('No such function found'));
                }

                if(raw.includes('error')){
                    reject(new DiffGenerationException('ASM-Diff encountered an error'));
                }

                if(!raw.includes("<table class='diff'>")){
                    reject(new DiffGenerationException('No diff generated, compilation may have failed!'));
                }

                const html = buffer.slice(buffer.indexOf("<table class='diff'>"));
                resolve(html);
            });
            child.stderr?.on('data', data => {
                reject(new DiffGenerationException(data.toString()));
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
            view.deployHTML('views/differ/differ.html', {
                'buffer': e instanceof DiffGenerationException ? e.message.replace(/\x1b[^m]*m/g, '') : 'An unknown error occurred, try to validate your code and rebuild'
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