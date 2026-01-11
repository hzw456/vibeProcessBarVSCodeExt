import * as vscode from 'vscode';
import * as crypto from 'crypto';

/**
 * AI活动检测器 (重构版 - Axum API)
 * 
 * 状态机：
 * - ACTIVE: 窗口有焦点（前台）
 * - ARMED: 窗口失去焦点（后台）
 * 
 * API 接口：
 * - /api/task/report: 统一的窗口信息上报 (is_focused 区分前台/后台)
 * - /api/task/update_state: 更新进程状态 (running/completed/cancelled)
 */

type State = 'ACTIVE' | 'ARMED';

let outputChannel: vscode.OutputChannel;

function log(message: string) {
    const timestamp = new Date().toISOString();
    const msg = `[${timestamp}] ${message}`;
    console.log(msg);
    if (outputChannel) {
        outputChannel.appendLine(msg);
    }
}

export class AIActivityDetector implements vscode.Disposable {
    // 状态: ACTIVE (前台) 或 ARMED (后台)
    private state: State = 'ACTIVE';
    private disposables: vscode.Disposable[] = [];

    // 基础信息
    private windowTitle = 'Unknown';
    private ideName = 'vscode';
    private taskId: string = '';  // Use windowId as taskId
    private activeFile: string = '';

    // AI 运行状态
    private aiRunning: boolean = false;
    private sessionInsert: number = 0;
    private sessionEvents: number = 0;
    private taskStartTime: number = 0;

    // 滑动窗口: 保存最近 1200ms 的 (timestamp, insertChars)
    private recentInserts: Array<{ timestamp: number; insertChars: number }> = [];
    private readonly SLIDING_WINDOW_MS = 1200;

    // 超时与计时器 - 增加超时时间以减少误报
    private idleTimer: NodeJS.Timeout | null = null;
    private readonly BASE_IDLE_TIMEOUT_MS = 15000;  // 15秒基础空闲超时
    private readonly MIN_RUN_MS = 5000;  // 最少运行5秒才能标记为完成

    // 节流
    private updateThrottleTimer: NodeJS.Timeout | null = null;
    private readonly UPDATE_THROTTLE_MS = 1000;
    private activeFileUpdateTimer: NodeJS.Timeout | null = null;
    private readonly ACTIVE_FILE_THROTTLE_MS = 500;

    // 心跳 - 每3秒上报状态（确保服务器重启后能快速重新连接）
    private heartbeatTimer: NodeJS.Timeout | null = null;
    private readonly HEARTBEAT_INTERVAL_MS = 3000;
    private isConnected: boolean = false;
    private lastHeartbeatSuccess: number = 0;

    constructor() {
        outputChannel = vscode.window.createOutputChannel('AI Status Transmission');
        outputChannel.show(true);
        this.taskId = crypto.randomUUID();  // Use UUID as task ID
        log(`Generated task ID: ${this.taskId}`);
        this.initialize();
    }

    private detectIdeName(appName: string): string {
        const lowerName = appName.toLowerCase();
        if (lowerName.includes('antigravity')) return 'antigravity';
        if (lowerName.includes('kiro')) return 'kiro';
        if (lowerName.includes('cursor')) return 'cursor';
        if (lowerName.includes('windsurf')) return 'windsurf';
        // Check CN version first (more specific)
        if (lowerName.includes('codebuddy cn') || lowerName.includes('codebuddycn')) return 'codebuddycn';
        if (lowerName.includes('codebuddy') || lowerName.includes('code buddy')) return 'codebuddy';
        if (lowerName.includes('trae')) return 'trae';
        if (lowerName.includes('code - insiders')) return 'vscode-insiders';
        if (lowerName.includes('visual studio code') || lowerName.includes('vs code')) return 'vscode';
        if (lowerName.includes('vscodium')) return 'vscodium';
        return appName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'unknown';
    }

    private getDisplayIdeName(): string {
        switch (this.ideName) {
            case 'antigravity': return 'Antigravity';
            case 'kiro': return 'Kiro';
            case 'cursor': return 'Cursor';
            case 'windsurf': return 'Windsurf';
            case 'codebuddy': return 'CodeBuddy';
            case 'codebuddycn': return 'CodeBuddy CN';
            case 'trae': return 'Trae';
            case 'vscode': return 'VS Code';
            case 'vscode-insiders': return 'VS Code Insiders';
            case 'vscodium': return 'VSCodium';
            default: return vscode.env.appName || 'IDE';
        }
    }

    private getWindowTitle(): string {
        if (vscode.workspace.name) return vscode.workspace.name;
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            return vscode.workspace.workspaceFolders[0].name;
        }
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            const doc = activeEditor.document;
            // Only use filename from actual files, not output channels
            const scheme = doc.uri.scheme;
            if (scheme !== 'file' && scheme !== 'untitled') {
                return 'Untitled';  // Don't use output channel names
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

    private getActiveFileName(): string {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            const doc = activeEditor.document;
            // Only return filename for actual files, not output channels, logs, etc.
            const scheme = doc.uri.scheme;
            if (scheme !== 'file' && scheme !== 'untitled') {
                return '';  // Ignore output channels, extension outputs, etc.
            }
            const fileName = doc.fileName.split('/').pop() || doc.fileName.split('\\').pop();
            return fileName || '';
        }
        return '';
    }

    /**
     * Check if we should skip reporting for this window.
     * Skip when: no active file, window title is "Untitled" or empty, and no project path.
     * This typically means an empty/Welcome window.
     */
    private shouldSkipReporting(): boolean {
        const hasActiveFile = !!this.activeFile && this.activeFile.trim() !== '';
        const hasValidTitle = !!this.windowTitle &&
            this.windowTitle.trim() !== '' &&
            this.windowTitle !== 'Untitled';
        const hasProjectPath = vscode.workspace.workspaceFolders &&
            vscode.workspace.workspaceFolders.length > 0;

        // Skip if ALL conditions are false (empty window)
        if (!hasActiveFile && !hasValidTitle && !hasProjectPath) {
            log('Skipping report: empty window (no file, no project, title is Untitled)');
            return true;
        }
        return false;
    }

    private initialize(): void {
        const appName = vscode.env.appName || 'VS Code';
        this.ideName = this.detectIdeName(appName);
        this.windowTitle = this.getWindowTitle();
        this.activeFile = this.getActiveFileName();

        log(`AIActivityDetector initializing...`);
        log(`Detected IDE: ${appName} -> ${this.ideName}`);
        log(`Window title: ${this.windowTitle}`);
        log(`Task ID (UUID): ${this.taskId}`);
        log(`Active file: ${this.activeFile}`);

        // 初始状态: 假设窗口有焦点
        this.state = 'ACTIVE';
        this.aiRunning = false;

        // 监听窗口焦点变化
        this.disposables.push(
            vscode.window.onDidChangeWindowState((windowState) => {
                log(`Window state changed: focused=${windowState.focused}`);
                this.handleWindowStateChange(windowState.focused);
            })
        );

        // 监听文档变化
        this.disposables.push(
            vscode.workspace.onDidChangeTextDocument((event) => {
                this.handleDocumentChange(event);
            })
        );

        // 监听活动编辑器变化
        this.disposables.push(
            vscode.window.onDidChangeActiveTextEditor((editor) => {
                if (editor) {
                    const oldFile = this.activeFile;
                    this.activeFile = this.getActiveFileName();
                    if (oldFile !== this.activeFile && this.state === 'ARMED') {
                        this.throttledUpdateActiveFile();
                    }
                }
            })
        );

        log('AIActivityDetector initialized successfully');
        log(`Current state: ${this.state}`);
        vscode.window.showInformationMessage('AI Status Transmission: Detector initialized');

        // 启动心跳
        this.startHeartbeat();
        // 立即发送一次心跳以确保启动时注册
        this.sendHeartbeat();
    }

    private handleWindowStateChange(focused: boolean): void {
        log(`handleWindowStateChange: focused=${focused}, state=${this.state}, aiRunning=${this.aiRunning}`);

        if (!focused) {
            // 窗口失去焦点 -> ARMED
            this.state = 'ARMED';
            this.aiRunning = false;
            this.resetSession();
            this.sendReport(false);  // is_focused=false
            log('Window lost focus, entering ARMED state');
        } else {
            // 窗口获得焦点 -> ACTIVE
            this.state = 'ACTIVE';
            this.sendReport(true);  // is_focused=true

            if (this.aiRunning) {
                // 后台任务未结束，立即完成
                this.completeTask();
                this.aiRunning = false;
                log('Window regained focus with aiRunning=true, task completed');
            }

            this.clearSessionTimers();
            this.recentInserts = [];
            log('Window gained focus, now ACTIVE');
        }
    }

    private resetSession(): void {
        this.sessionInsert = 0;
        this.sessionEvents = 0;
        this.recentInserts = [];
        this.clearSessionTimers();
    }

    private clearSessionTimers(): void {
        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
            this.idleTimer = null;
        }
        if (this.updateThrottleTimer) {
            clearTimeout(this.updateThrottleTimer);
            this.updateThrottleTimer = null;
        }
        if (this.activeFileUpdateTimer) {
            clearTimeout(this.activeFileUpdateTimer);
            this.activeFileUpdateTimer = null;
        }
    }

    private clearHeartbeatTimer(): void {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    // 心跳机制：每3秒上报状态，确保服务器重启后能快速重新连接
    private startHeartbeat(): void {
        this.heartbeatTimer = setInterval(() => {
            // 每3秒都发送心跳，无论连接状态
            // 这样当 vibeProcessBar 重启后，会在 3 秒内重新连接
            const now = Date.now();
            const timeSinceLastSuccess = now - this.lastHeartbeatSuccess;

            // 如果超过 3.5 秒没有成功，标记为未连接
            if (timeSinceLastSuccess > 3500) {
                this.isConnected = false;
            }

            log(`Heartbeat: connected = ${this.isConnected}, lastSuccess = ${timeSinceLastSuccess}ms ago`);
            this.sendHeartbeat();
        }, this.HEARTBEAT_INTERVAL_MS);
    }

    private async sendHeartbeat(): Promise<void> {
        // 使用统一的 report 接口进行心跳保活
        // 发送当前焦点状态
        const isFocused = this.state === 'ACTIVE';
        await this.sendReport(isFocused);
    }

    private handleDocumentChange(event: vscode.TextDocumentChangeEvent): void {
        // 仅当 state === ARMED 才处理
        if (this.state !== 'ARMED') {
            return;
        }

        // 过滤: 只处理 file scheme (可选 untitled)
        const scheme = event.document.uri.scheme;
        if (scheme !== 'file' && scheme !== 'untitled') {
            return;
        }

        // 更新活动文件
        const fileName = event.document.fileName.split('/').pop() || event.document.fileName.split('\\').pop() || '';
        if (fileName && fileName !== this.activeFile) {
            this.activeFile = fileName;
            this.throttledUpdateActiveFile();
        }

        // 统计本次变更
        let insert = 0;
        let deleteCount = 0;
        const segments = event.contentChanges.length;

        for (const change of event.contentChanges) {
            insert += change.text.length;
            deleteCount += change.rangeLength;
        }

        // 无变更则跳过
        if (insert === 0 && deleteCount === 0) {
            return;
        }

        const now = Date.now();

        // 维护 1200ms 滑动窗口
        this.recentInserts.push({ timestamp: now, insertChars: insert });
        this.recentInserts = this.recentInserts.filter(r => now - r.timestamp <= this.SLIDING_WINDOW_MS);

        const winInsert = this.recentInserts.reduce((sum, r) => sum + r.insertChars, 0);
        const winEvents = this.recentInserts.length;

        // AI-like 判定
        const aiLike = this.isAiLike(insert, deleteCount, segments, winInsert, winEvents);

        const relativePath = vscode.workspace.asRelativePath(event.document.fileName);
        log(`Doc change: insert = ${insert}, delete=${deleteCount}, segments = ${segments}, winInsert = ${winInsert}, winEvents = ${winEvents}, aiLike = ${aiLike}, file = ${relativePath} `);

        if (aiLike && !this.aiRunning) {
            // 开始新任务
            this.aiRunning = true;
            this.sessionInsert = 0;
            this.sessionEvents = 0;
            this.taskStartTime = Date.now();
            this.startTask();
            this.resetIdleTimer();
            log('🤖 AI activity detected, starting task');
        }

        if (this.aiRunning) {
            this.sessionInsert += insert;
            this.sessionEvents += 1;
            this.resetIdleTimer();
            this.throttledUpdate();
        }
    }

    private isAiLike(insert: number, deleteCount: number, segments: number, winInsert: number, winEvents: number): boolean {
        // Hard Negative (任一成立则直接否决)
        if (insert === 0 && deleteCount > 0) {
            // 纯删除
            return false;
        }
        if (deleteCount > insert * 4 && insert < 15) {
            // 删除占主导
            return false;
        }
        if (insert < 10 && segments === 1) {
            // 微小编辑
            return false;
        }

        // Strong Positive (任一成立)
        if (insert >= 40) {
            return true;
        }
        if (winInsert >= 50 && winEvents >= 3) {
            return true;
        }
        if (segments >= 6 && insert >= 25) {
            return true;
        }

        return false;
    }

    private getIdleTimeout(): number {
        // 根据会话大小动态调整超时
        if (this.sessionInsert >= 600) {
            return 45000;  // 大任务: 45秒
        } else if (this.sessionInsert >= 200) {
            return 30000;  // 中等任务: 30秒
        }
        return this.BASE_IDLE_TIMEOUT_MS;  // 小任务: 15秒
    }

    private resetIdleTimer(): void {
        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
        }

        const timeout = this.getIdleTimeout();
        log(`Setting idle timer: ${timeout} ms(sessionInsert = ${this.sessionInsert})`);

        this.idleTimer = setTimeout(() => {
            if (this.state !== 'ARMED' || !this.aiRunning) {
                return;
            }

            // 检查最短运行时间
            const runTime = Date.now() - this.taskStartTime;
            if (runTime < this.MIN_RUN_MS) {
                log(`Skipping complete, minRun not reached(${runTime}ms < ${this.MIN_RUN_MS}ms)`);
                this.resetIdleTimer();
                return;
            }

            log(`⏱️ Idle timeout reached, completing task(sessionInsert = ${this.sessionInsert}, sessionEvents = ${this.sessionEvents})`);
            this.completeTask();
            this.aiRunning = false;
            this.resetSession();
            // 保持 state = ARMED，继续后台监听
        }, timeout);
    }

    private throttledUpdateActiveFile(): void {
        if (this.activeFileUpdateTimer) {
            return;
        }
        this.activeFileUpdateTimer = setTimeout(() => {
            this.activeFileUpdateTimer = null;
            this.updateActiveFile();
        }, this.ACTIVE_FILE_THROTTLE_MS);
    }

    private throttledUpdate(): void {
        if (this.updateThrottleTimer) {
            return;
        }
        this.updateThrottleTimer = setTimeout(() => {
            this.updateThrottleTimer = null;
            this.sendUpdateNotification();
        }, this.UPDATE_THROTTLE_MS);
    }

    private async sendReport(isFocused: boolean): Promise<void> {
        // Skip reporting for empty windows
        this.activeFile = this.getActiveFileName();
        if (this.shouldSkipReporting()) {
            return;
        }

        let projectPath = '';
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            projectPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
        }

        const data: Record<string, any> = {
            task_id: this.taskId,
            name: `${this.getDisplayIdeName()} - ${this.windowTitle}`,
            ide: this.ideName,
            window_title: this.windowTitle,
            is_focused: isFocused,
            project_path: projectPath,
        };
        if (this.activeFile) {
            data.active_file = this.activeFile;
        }

        log(`Sending REPORT: is_focused=${isFocused}, task_id=${this.taskId}`);

        try {
            await this.sendRequest('/api/task/report', data);
            log(`✅ REPORT sent: ${this.taskId}`);
        } catch (err: any) {
            log(`❌ Failed to send REPORT: ${err}`);
        }
    }

    private async startTask(): Promise<void> {
        const data = {
            task_id: this.taskId,
            status: 'running',
        };

        log(`Starting task: ${this.taskId}`);

        try {
            await this.sendRequest('/api/task/update_state', data);
            log(`✅ Task started: ${this.taskId}`);
            vscode.window.showInformationMessage(`AI Task Started: ${this.windowTitle}`);
        } catch (err) {
            log(`❌ Failed to start task: ${err}`);
        }
    }

    private async completeTask(): Promise<void> {
        const data = {
            task_id: this.taskId,
            status: 'completed',
        };

        log(`Completing task: ${this.taskId} (session_insert=${this.sessionInsert}, session_events=${this.sessionEvents})`);

        try {
            await this.sendRequest('/api/task/update_state', data);
            log(`✅ Task completed: ${this.taskId}`);
            vscode.window.showInformationMessage(`AI Task Completed: ${this.windowTitle}`);
        } catch (err) {
            log(`❌ Failed to complete task: ${err}`);
        }
    }

    private async cancelTask(): Promise<void> {
        const data = {
            task_id: this.taskId,
        };

        log(`Cancelling task: ${this.taskId}`);

        try {
            await this.sendRequest('/api/task/delete', data);
            log(`✅ Task cancelled: ${this.taskId}`);
        } catch (err) {
            log(`❌ Failed to cancel task: ${err}`);
        }
    }

    private async updateActiveFile(): Promise<void> {
        // Active file updates are now handled via report
        log(`Active file updated locally: ${this.activeFile}`);
    }

    private async sendUpdateNotification(): Promise<void> {
        // Progress updates during AI activity - send via report to keep task alive
        if (this.shouldSkipReporting()) {
            return;
        }
        log(`Update notification: sessionInsert=${this.sessionInsert}, sessionEvents=${this.sessionEvents}`);
    }

    private sendRequest(endpoint: string, data: any): Promise<void> {
        return new Promise((resolve, reject) => {
            const postData = JSON.stringify(data);

            log(`Sending request to: ${endpoint} `);
            log(`Request body: ${postData} `);

            const http = require('http');

            const options = {
                hostname: '127.0.0.1',
                port: 31415,
                path: endpoint,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                },
                timeout: 5000
            };

            const req = http.request(options, (res: any) => {
                let responseData = '';
                res.on('data', (chunk: any) => {
                    responseData += chunk;
                });
                res.on('end', () => {
                    log(`Response: ${res.statusCode} - ${responseData} `);
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        this.isConnected = true;  // 标记为已连接
                        this.lastHeartbeatSuccess = Date.now();  // 更新最后成功时间
                        resolve();
                    } else {
                        // 4xx/5xx 错误也标记为未连接，让心跳重试
                        this.isConnected = false;
                        reject(new Error(`HTTP ${res.statusCode}: ${responseData} `));
                    }
                });
            });

            req.on('error', (err: Error) => {
                log(`Request error: ${err.message} `);
                this.isConnected = false;  // 标记为未连接
                reject(err);
            });

            req.on('timeout', () => {
                log('Request timeout');
                this.isConnected = false;  // 标记为未连接
                req.destroy();
                reject(new Error('Request timeout'));
            });

            req.write(postData);
            req.end();
        });
    }

    public dispose(): void {
        log('AIActivityDetector disposing...');
        this.clearSessionTimers();
        this.clearHeartbeatTimer();

        if (this.aiRunning) {
            // Note: completeTask is async but we can't await in dispose
            this.completeTask();
        }

        // Always cancel task on dispose to clean up, regardless of state
        // This ensures the old task is removed when window reloads
        // Use SYNCHRONOUS request to ensure it completes before process exits
        this.cancelTaskSync();

        this.disposables.forEach(d => d.dispose());
        if (outputChannel) {
            outputChannel.dispose();
        }
        log('AIActivityDetector disposed');
    }

    /**
     * Synchronously cancel task - used in dispose() to ensure cleanup completes
     * before the extension host process exits
     */
    private cancelTaskSync(): void {
        const data = JSON.stringify({ task_id: this.taskId });
        log(`Cancelling task (sync): ${this.taskId}`);

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

            // Write and end synchronously - the request will be sent
            // Even if we don't wait for response, the server will process it
            req.write(data);
            req.end();
            log(`✅ Task cancel request sent (sync): ${this.taskId}`);
        } catch (err: any) {
            log(`❌ Failed to cancel task (sync): ${err.message}`);
        }
    }
}
