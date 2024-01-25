import * as vscode from 'vscode';
import path from 'path';
import { exec } from 'child_process';
import ASMDiffExtension from '../extension';

class M2CGenWrapper {
    constructor(
        private readonly _context: ASMDiffExtension,
    ){}

    public init(){

    }

    private async validateM2CPath(){
        const config = this._context.getConfig();

        if (!config.has('path:m2c')) {
            vscode.window.showErrorMessage('No path set for asm-diff, please set one');
            await this._context.setCFGPath('path:m2c', 'm2c.py', false);
            return false;
        }

        return true;
    }

    private genCodeFromASM(func: string, ctx: string): Promise<string> {
        const config = this._context.getConfig();

        const command = `python3 -u ./${path.join(config.get('path:m2c')!, 'm2c.py')} --context=${ctx} ${path.join(this._context.getCurrentDirectory()!, func)}`;
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
                const fakeDetection = raw.includes("{") && raw.includes(";");

                if(failed && !fakeDetection){
                    return reject(new M2CGenerationException(buffer.replace(/\x1b[^m]*m/g, '')));
                }

                if(raw.includes('No such file or directory')){
                    return reject(new M2CGenerationException('No such file or directory'));
                }

                if(!fakeDetection){
                    return reject(new M2CGenerationException('Unknown error'));
                }

                resolve(buffer);
            });
        });
    }

    private async getCurrentASM(): Promise<string | undefined> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return undefined;
        }

        const selection = editor.selection;
        if (!selection) {
            return undefined;
        }

        const line = editor.document.lineAt(selection.start.line);
        if (!line) {
            return undefined;
        }

        const match = line.text.match(/#pragma GLOBAL_ASM\("([^"]+)"\)/);

        if (!match) {
            return undefined;
        }

        return match[1].replace(/"/g, '');
    }

    public async executeM2C(){
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        try {
            if(!await this.validateM2CPath()){
                return;
            }
            const asm = await this.getCurrentASM();
            console.log(asm);
            if (!asm) {
                vscode.window.showErrorMessage('No ASM function found');
                return;
            }

            const ctx = await vscode.window.showInputBox({
                prompt: 'Enter the context to use',
                value: 'ctx.c',
            });

            if (!ctx) {
                return;
            }

            const code = await this.genCodeFromASM(asm, ctx);
            const selection = editor.selection;
            if (!selection) {
                return;
            }

            const range = editor.document.lineAt(selection.start.line).range;
            editor.edit(edit => {
                let buffer = [
                    '#if 0',
                    `#pragma GLOBAL_ASM("${asm}")`,
                    '#else',
                    code,
                    '#endif',
                ]
                edit.replace(range, buffer.join('\n'));
            });
            vscode.window.showInformationMessage('Code generated!');
        } catch (e) {
            if (e instanceof M2CGenerationException) {
                vscode.window.showErrorMessage(e.message);
            } else {
                vscode.window.showErrorMessage('Unknown error');
            }
        }
    }
}

class M2CGenerationException extends Error {
    constructor(message: string) {
        super(message);
    }
}


export default M2CGenWrapper;