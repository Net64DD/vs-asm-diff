import * as vscode from 'vscode';

export default class ConfigWrapper {
    private _wcfg: vscode.WorkspaceConfiguration;
    private _cfg: any = {}

    constructor() {
        this._wcfg = vscode.workspace.getConfiguration();
    }

    public has(key: string): boolean {
        return this._wcfg.has(`asm-diff.${key}`) || this._cfg[key] !== undefined;
    }

    public get(key: string): any {
        if (this._cfg[key] === undefined) {
            this._cfg[key] = this._wcfg.get(`asm-diff.${key}`);
        }
        return this._cfg[key];
    }

    public set(key: string, value: any): Thenable<void> {
        this._cfg[key] = value;
        return this._wcfg.update(`asm-diff.${key}`, value, true);
    }
}