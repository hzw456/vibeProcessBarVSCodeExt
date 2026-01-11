import * as vscode from 'vscode';
import * as crypto from 'crypto';

/**
 * 窗口状态上报器
 * 
 * 职责：
 * - 管理任务 ID 和窗口基础信息
 * - 心跳保活 (每3秒上报)
 * - 窗口焦点状态上报
 * - 窗口关闭时清理任务
 * 
 * API 接口：
 * - POST /api/task/report: 心跳 + 窗口信息上报
 * - POST /api/task/delete: 删除任务
 */

let outputChannel: vscode.OutputChannel | null = null;

function log(message: string) {
    const timestamp = new Date().toISOString();
    const msg = `[${timestamp}] [WindowReporter] ${message}`;
    console.log(msg);
    if (outputChannel) {
        outputChannel.appendLine(msg);
    }
}

export function setOutputChannel(channel: vscode.OutputChannel) {
    outputChannel = channel;
}

export class WindowReporter implements vscode.Disposable {
    private disposables: vscode.Disposable[] = [];

    // 基础信息
    private taskId: string;
    private ideName: string = 'vscode';
    private windowTitle: string = 'Unknown';
    private activeFile: string = '';

    // 焦点状态
    private isFocused: boolean = true;

    // 心跳
    private heartbeatTimer: NodeJS.Timeout | null = null;
    private readonly HEARTBEAT_INTERVAL_MS = 3000;
    private isConnected: boolean = false;
    private lastHeartbeatSuccess: number = 0;

    // 焦点变化回调
    private onFocusChangeCallback: ((focused: boolean) => void) | null = null;

    constructor() {
        this.taskId = crypto.randomUUID();
        this.initialize();
    }

    private initialize(): void {
        const appName = vscode.env.appName || 'VS Code';
        this.ideName = this.detectIdeName(appName);
        this.windowTitle = this.getWindowTitle();
        this.activeFile = this.getActiveFileName();

        log(`Initializing...`);
        log(`IDE: ${appName} -> ${this.ideName}`);
        log(`Window: ${this.windowTitle}`);
        log(`Task ID: ${this.taskId}`);

        // 监听窗口焦点变化
        this.disposables.push(
            vscode.window.onDidChangeWindowState((state) => {
                this.handleWindowStateChange(state.focused);
            })
        );

        // 监听活动编辑器变化
        this.disposables.push(
            vscode.window.onDidChangeActiveTextEditor((editor) => {
                if (editor) {
                    this.activeFile = this.getActiveFileName();
                }
            })
        );

        // 启动心跳
        this.startHeartbeat();
        this.sendReport();

        log('Initialized');
    }

    private handleWindowStateChange(focused: boolean): void {
        const wasFocused = this.isFocused;
        this.isFocused = focused;

        log(`Focus changed: ${wasFocused} -> ${focused}`);
        this.sendReport();

        // 通知回调
        if (this.onFocusChangeCallback) {
            this.onFocusChangeCallback(focused);
        }
    }

    // ========== 公共方法 ==========

    public getTaskId(): string {
        return this.taskId;
    }

    public getIdeName(): string {
        return this.ideName;
    }

    public getWindowTitle(): string {
        if (vscode.workspace.name) return vscode.workspace.name;
        if (vscode.workspace.workspaceFolders?.length) {
            return vscode.workspace.workspaceFolders[0].name;
        }
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const doc = editor.document;
            const scheme = doc.uri.scheme;
            if (scheme !== 'file' && scheme !== 'untitled') {
                return 'Untitled';
            }
            if (doc.isUntitled) {
                const match = doc.uri.path.match(/Untitled-\d+/);
                if (match) return match[0];
            }
            const fileName = doc.fileName.split('/').pop() || doc.fileName.split('\\').pop();
            if (fileName) return fileName;
        }
        return 'Untitled';
    }

    public getActiveFileName(): string {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const doc = editor.document;
            const scheme = doc.uri.scheme;
            if (scheme !== 'file' && scheme !== 'untitled') {
                return '';
            }
            return doc.fileName.split('/').pop() || doc.fileName.split('\\').pop() || '';
        }
        return '';
    }

    public getIsFocused(): boolean {
        return this.isFocused;
    }

    public onFocusChange(callback: (focused: boolean) => void): void {
        this.onFocusChangeCallback = callback;
    }

    public updateActiveFile(fileName: string): void {
        this.activeFile = fileName;
    }

    // ========== API 调用 ==========

    public async updateTaskState(status: string): Promise<void> {
        const data = {
            task_id: this.taskId,
            status,
        };

        log(`Updating state: ${status}`);

        try {
            await this.sendRequest('/api/task/update_state', data);
            log(`✅ State updated: ${status}`);
        } catch (err) {
            log(`❌ Failed to update state: ${err}`);
        }
    }

    // ========== 私有方法 ==========

    private detectIdeName(appName: string): string {
        const lower = appName.toLowerCase();
        if (lower.includes('antigravity')) return 'antigravity';
        if (lower.includes('kiro')) return 'kiro';
        if (lower.includes('cursor')) return 'cursor';
        if (lower.includes('windsurf')) return 'windsurf';
        if (lower.includes('codebuddy cn') || lower.includes('codebuddycn')) return 'codebuddycn';
        if (lower.includes('codebuddy') || lower.includes('code buddy')) return 'codebuddy';
        if (lower.includes('trae')) return 'trae';
        if (lower.includes('code - insiders')) return 'vscode-insiders';
        if (lower.includes('visual studio code') || lower.includes('vs code')) return 'vscode';
        if (lower.includes('vscodium')) return 'vscodium';
        return appName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'unknown';
    }

    private getDisplayIdeName(): string {
        const map: Record<string, string> = {
            'antigravity': 'Antigravity',
            'kiro': 'Kiro',
            'cursor': 'Cursor',
            'windsurf': 'Windsurf',
            'codebuddy': 'CodeBuddy',
            'codebuddycn': 'CodeBuddy CN',
            'trae': 'Trae',
            'vscode': 'VS Code',
            'vscode-insiders': 'VS Code Insiders',
            'vscodium': 'VSCodium',
        };
        return map[this.ideName] || vscode.env.appName || 'IDE';
    }

    private shouldSkipReporting(): boolean {
        const hasActiveFile = !!this.activeFile?.trim();
        const hasValidTitle = !!this.windowTitle?.trim() && this.windowTitle !== 'Untitled';
        const hasProjectPath = !!vscode.workspace.workspaceFolders?.length;

        if (!hasActiveFile && !hasValidTitle && !hasProjectPath) {
            log('Skipping report: empty window');
            return true;
        }
        return false;
    }

    private startHeartbeat(): void {
        this.heartbeatTimer = setInterval(() => {
            const now = Date.now();
            const timeSinceLastSuccess = now - this.lastHeartbeatSuccess;

            if (timeSinceLastSuccess > 3500) {
                this.isConnected = false;
            }

            this.sendReport();
        }, this.HEARTBEAT_INTERVAL_MS);
    }

    private async sendReport(): Promise<void> {
        this.activeFile = this.getActiveFileName();
        this.windowTitle = this.getWindowTitle();

        if (this.shouldSkipReporting()) {
            return;
        }

        let projectPath = '';
        if (vscode.workspace.workspaceFolders?.length) {
            projectPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
        }

        const data: Record<string, any> = {
            task_id: this.taskId,
            name: `${this.getDisplayIdeName()} - ${this.windowTitle}`,
            ide: this.ideName,
            window_title: this.windowTitle,
            is_focused: this.isFocused,
            project_path: projectPath,
        };
        if (this.activeFile) {
            data.active_file = this.activeFile;
        }

        try {
            await this.sendRequest('/api/task/report', data);
            this.isConnected = true;
            this.lastHeartbeatSuccess = Date.now();
        } catch (err) {
            // 静默失败，心跳会重试
        }
    }

    private sendRequest(endpoint: string, data: any): Promise<void> {
        return new Promise((resolve, reject) => {
            const postData = JSON.stringify(data);
            const http = require('http');

            const req = http.request({
                hostname: '127.0.0.1',
                port: 31415,
                path: endpoint,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                },
                timeout: 5000
            }, (res: any) => {
                let responseData = '';
                res.on('data', (chunk: any) => responseData += chunk);
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve();
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
                    }
                });
            });

            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            req.write(postData);
            req.end();
        });
    }

    private deleteTaskSync(): void {
        const data = JSON.stringify({ task_id: this.taskId });
        log(`Deleting task (sync): ${this.taskId}`);

        try {
            const http = require('http');
            const req = http.request({
                hostname: '127.0.0.1',
                port: 31415,
                path: '/api/task/delete',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(data)
                },
                timeout: 1000
            });
            req.write(data);
            req.end();
            log(`✅ Task delete request sent`);
        } catch (err: any) {
            log(`❌ Failed to delete task: ${err.message}`);
        }
    }

    public dispose(): void {
        log('Disposing...');

        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }

        this.deleteTaskSync();
        this.disposables.forEach(d => d.dispose());

        log('Disposed');
    }
}
