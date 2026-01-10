"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIActivityDetector = void 0;
const vscode = __importStar(require("vscode"));
const crypto = __importStar(require("crypto"));
let outputChannel;
function log(message) {
    const timestamp = new Date().toISOString();
    const msg = `[${timestamp}] ${message}`;
    console.log(msg);
    if (outputChannel) {
        outputChannel.appendLine(msg);
    }
}
class AIActivityDetector {
    constructor() {
        // 状态: ACTIVE (前台) 或 ARMED (后台)
        this.state = 'ACTIVE';
        this.disposables = [];
        // 基础信息
        this.windowTitle = 'Unknown';
        this.ideName = 'vscode';
        this.taskId = ''; // Use windowId as taskId
        this.activeFile = '';
        // AI 运行状态
        this.aiRunning = false;
        this.sessionInsert = 0;
        this.sessionEvents = 0;
        this.taskStartTime = 0;
        // 滑动窗口: 保存最近 1200ms 的 (timestamp, insertChars)
        this.recentInserts = [];
        this.SLIDING_WINDOW_MS = 1200;
        // 超时与计时器 - 增加超时时间以减少误报
        this.idleTimer = null;
        this.BASE_IDLE_TIMEOUT_MS = 15000; // 15秒基础空闲超时
        this.MIN_RUN_MS = 5000; // 最少运行5秒才能标记为完成
        // 节流
        this.updateThrottleTimer = null;
        this.UPDATE_THROTTLE_MS = 1000;
        this.activeFileUpdateTimer = null;
        this.ACTIVE_FILE_THROTTLE_MS = 500;
        // 心跳 - 每3秒上报状态（确保服务器重启后能快速重新连接）
        this.heartbeatTimer = null;
        this.HEARTBEAT_INTERVAL_MS = 3000;
        this.isConnected = false;
        this.lastHeartbeatSuccess = 0;
        outputChannel = vscode.window.createOutputChannel('AI Status Transmission');
        outputChannel.show(true);
        this.taskId = crypto.randomUUID(); // Use UUID as task ID
        log(`Generated task ID: ${this.taskId}`);
        this.initialize();
    }
    detectIdeName(appName) {
        const lowerName = appName.toLowerCase();
        if (lowerName.includes('antigravity'))
            return 'antigravity';
        if (lowerName.includes('kiro'))
            return 'kiro';
        if (lowerName.includes('cursor'))
            return 'cursor';
        if (lowerName.includes('windsurf'))
            return 'windsurf';
        // Check CN version first (more specific)
        if (lowerName.includes('codebuddy cn') || lowerName.includes('codebuddycn'))
            return 'codebuddycn';
        if (lowerName.includes('codebuddy') || lowerName.includes('code buddy'))
            return 'codebuddy';
        if (lowerName.includes('trae'))
            return 'trae';
        if (lowerName.includes('code - insiders'))
            return 'vscode-insiders';
        if (lowerName.includes('visual studio code') || lowerName.includes('vs code'))
            return 'vscode';
        if (lowerName.includes('vscodium'))
            return 'vscodium';
        return appName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'unknown';
    }
    getDisplayIdeName() {
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
    getWindowTitle() {
        if (vscode.workspace.name)
            return vscode.workspace.name;
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            return vscode.workspace.workspaceFolders[0].name;
        }
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            const doc = activeEditor.document;
            // Only use filename from actual files, not output channels
            const scheme = doc.uri.scheme;
            if (scheme !== 'file' && scheme !== 'untitled') {
                return 'Untitled'; // Don't use output channel names
            }
            if (doc.isUntitled) {
                const match = doc.uri.path.match(/Untitled-\d+/);
                if (match)
                    return match[0];
            }
            const fileName = doc.fileName.split('/').pop() || doc.fileName.split('\\').pop();
            if (fileName)
                return fileName;
        }
        return 'Untitled';
    }
    getActiveFileName() {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            const doc = activeEditor.document;
            // Only return filename for actual files, not output channels, logs, etc.
            const scheme = doc.uri.scheme;
            if (scheme !== 'file' && scheme !== 'untitled') {
                return ''; // Ignore output channels, extension outputs, etc.
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
    shouldSkipReporting() {
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
    initialize() {
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
        this.disposables.push(vscode.window.onDidChangeWindowState((windowState) => {
            log(`Window state changed: focused=${windowState.focused}`);
            this.handleWindowStateChange(windowState.focused);
        }));
        // 监听文档变化
        this.disposables.push(vscode.workspace.onDidChangeTextDocument((event) => {
            this.handleDocumentChange(event);
        }));
        // 监听活动编辑器变化
        this.disposables.push(vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (editor) {
                const oldFile = this.activeFile;
                this.activeFile = this.getActiveFileName();
                if (oldFile !== this.activeFile && this.state === 'ARMED') {
                    this.throttledUpdateActiveFile();
                }
            }
        }));
        log('AIActivityDetector initialized successfully');
        log(`Current state: ${this.state}`);
        vscode.window.showInformationMessage('AI Status Transmission: Detector initialized');
        // 启动心跳
        this.startHeartbeat();
        // 立即发送一次心跳以确保启动时注册
        this.sendHeartbeat();
    }
    handleWindowStateChange(focused) {
        log(`handleWindowStateChange: focused=${focused}, state = ${this.state}, aiRunning = ${this.aiRunning} `);
        if (!focused) {
            // 窗口失去焦点 -> ARMED
            this.state = 'ARMED';
            this.aiRunning = false;
            this.resetSession();
            this.sendArmedNotification();
            log('Window lost focus, entering ARMED state');
        }
        else {
            // 窗口获得焦点 -> ACTIVE
            this.state = 'ACTIVE';
            this.sendActiveNotification();
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
    resetSession() {
        this.sessionInsert = 0;
        this.sessionEvents = 0;
        this.recentInserts = [];
        this.clearSessionTimers();
    }
    clearSessionTimers() {
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
    clearHeartbeatTimer() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }
    // 心跳机制：每3秒上报状态，确保服务器重启后能快速重新连接
    startHeartbeat() {
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
    async sendHeartbeat() {
        // 根据当前状态发送对应的通知
        if (this.state === 'ACTIVE') {
            await this.sendActiveNotification();
        }
        else {
            await this.sendArmedNotification();
        }
    }
    handleDocumentChange(event) {
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
    isAiLike(insert, deleteCount, segments, winInsert, winEvents) {
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
    getIdleTimeout() {
        // 根据会话大小动态调整超时
        if (this.sessionInsert >= 600) {
            return 45000; // 大任务: 45秒
        }
        else if (this.sessionInsert >= 200) {
            return 30000; // 中等任务: 30秒
        }
        return this.BASE_IDLE_TIMEOUT_MS; // 小任务: 15秒
    }
    resetIdleTimer() {
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
    throttledUpdateActiveFile() {
        if (this.activeFileUpdateTimer) {
            return;
        }
        this.activeFileUpdateTimer = setTimeout(() => {
            this.activeFileUpdateTimer = null;
            this.updateActiveFile();
        }, this.ACTIVE_FILE_THROTTLE_MS);
    }
    throttledUpdate() {
        if (this.updateThrottleTimer) {
            return;
        }
        this.updateThrottleTimer = setTimeout(() => {
            this.updateThrottleTimer = null;
            this.sendUpdateNotification();
        }, this.UPDATE_THROTTLE_MS);
    }
    // === API Calls ===
    async sendArmedNotification() {
        // Skip reporting for empty windows (no file, no project, title is Untitled)
        this.activeFile = this.getActiveFileName();
        if (this.shouldSkipReporting()) {
            return;
        }
        let projectPath = '';
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            projectPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
        }
        const data = {
            task_id: this.taskId,
            name: `${this.getDisplayIdeName()} - ${this.windowTitle} `,
            ide: this.ideName,
            window_title: this.windowTitle,
            status: 'armed',
            project_path: projectPath,
        };
        if (this.activeFile) {
            data.active_file = this.activeFile;
        }
        log(`Sending ARMED notification: ${this.taskId}, active_file: ${this.activeFile} `);
        try {
            await this.sendRequest('/api/task/armed', data);
            log(`✅ ARMED notification sent: ${this.taskId} `);
        }
        catch (err) {
            log(`❌ Failed to send ARMED notification: ${err} `);
        }
    }
    async sendActiveNotification() {
        // Skip reporting for empty windows (no file, no project, title is Untitled)
        if (this.shouldSkipReporting()) {
            return;
        }
        let projectPath = '';
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            projectPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
        }
        const data = {
            task_id: this.taskId,
            name: `${this.getDisplayIdeName()} - ${this.windowTitle} `,
            ide: this.ideName,
            window_title: this.windowTitle,
            status: 'active', // Explicit status
            project_path: projectPath,
        };
        if (this.activeFile) {
            data.active_file = this.activeFile;
        }
        log(`Sending ACTIVE notification: ${this.taskId}, active_file: ${this.activeFile || '(none)'} `);
        try {
            // Use 'armed' endpoint or 'active' - if 'active' endpoint doesn't support full restoration on server side, 
            // we might want to use a unified endpoint or ensure server handles it.
            // Assuming server handles full payload on /active as well or we use /armed for everything essentially.
            // For now, let's stick to /active but send full data so server CAN use it if improved.
            // Wait, if 404, we want to auto-register. 
            // If the server implementation of /api/task/active requires the task to exist, these extra fields won't help unless the server is also updated.
            // However, based on typical patterns, passing full info allows upsert. 
            // If strictly needed, we could call /api/task/armed even for active state? 
            // The prompt implies "Task not found", so the SERVER is rejecting it.
            // Let's try sending full data to /api/task/active first.
            await this.sendRequest('/api/task/active', data);
            log(`✅ ACTIVE notification sent: ${this.taskId} `);
        }
        catch (err) {
            log(`❌ Failed to send ACTIVE notification: ${err} `);
            // If 404, maybe we should try to 'start' or 'arm' to register it?
            if (err.message && err.message.includes('404')) {
                log('⚠️ Task not found (404), attempting to re-register via ARMED...');
                await this.sendArmedNotification();
            }
        }
    }
    async startTask() {
        let projectPath = '';
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            projectPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
        }
        const data = {
            task_id: this.taskId,
            name: `${this.getDisplayIdeName()} - ${this.windowTitle} `,
            ide: this.ideName,
            window_title: this.windowTitle,
            project_path: projectPath,
        };
        if (this.activeFile) {
            data.active_file = this.activeFile;
        }
        log(`Starting task: ${this.taskId}, active_file: ${this.activeFile || '(none)'} `);
        try {
            await this.sendRequest('/api/task/start', data);
            log(`✅ Task started: ${this.taskId} `);
            vscode.window.showInformationMessage(`AI Task Started: ${this.windowTitle} `);
        }
        catch (err) {
            log(`❌ Failed to start task: ${err} `);
        }
    }
    async completeTask() {
        const data = {
            task_id: this.taskId,
            session_insert: this.sessionInsert,
            session_events: this.sessionEvents,
        };
        log(`Completing task: ${this.taskId} (session_insert = ${this.sessionInsert}, session_events = ${this.sessionEvents})`);
        try {
            await this.sendRequest('/api/task/complete', data);
            log(`✅ Task completed: ${this.taskId} `);
            vscode.window.showInformationMessage(`AI Task Completed: ${this.windowTitle} `);
        }
        catch (err) {
            log(`❌ Failed to complete task: ${err} `);
        }
    }
    async cancelTask() {
        const data = {
            task_id: this.taskId,
        };
        log(`Cancelling task: ${this.taskId} `);
        try {
            await this.sendRequest('/api/task/cancel', data);
            log(`✅ Task cancelled: ${this.taskId} `);
        }
        catch (err) {
            log(`❌ Failed to cancel task: ${err} `);
        }
    }
    async updateActiveFile() {
        if (!this.activeFile) {
            return;
        }
        const data = {
            task_id: this.taskId,
            active_file: this.activeFile,
        };
        log(`Updating active file: ${this.activeFile} `);
        try {
            await this.sendRequest('/api/task/update', data);
            log(`✅ Active file updated: ${this.activeFile} `);
        }
        catch (err) {
            log(`❌ Failed to update active file: ${err} `);
        }
    }
    async sendUpdateNotification() {
        // Skip reporting for empty windows (no file, no project, title is Untitled)
        if (this.shouldSkipReporting()) {
            return;
        }
        const data = {
            task_id: this.taskId,
            session_insert: this.sessionInsert,
            session_events: this.sessionEvents,
        };
        if (this.activeFile) {
            data.active_file = this.activeFile;
        }
        log(`Sending UPDATE: sessionInsert = ${this.sessionInsert}, sessionEvents = ${this.sessionEvents} `);
        try {
            await this.sendRequest('/api/task/update', data);
        }
        catch (err) {
            log(`❌ Failed to send update: ${err} `);
        }
    }
    sendRequest(endpoint, data) {
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
            const req = http.request(options, (res) => {
                let responseData = '';
                res.on('data', (chunk) => {
                    responseData += chunk;
                });
                res.on('end', () => {
                    log(`Response: ${res.statusCode} - ${responseData} `);
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        this.isConnected = true; // 标记为已连接
                        this.lastHeartbeatSuccess = Date.now(); // 更新最后成功时间
                        resolve();
                    }
                    else {
                        // 4xx/5xx 错误也标记为未连接，让心跳重试
                        this.isConnected = false;
                        reject(new Error(`HTTP ${res.statusCode}: ${responseData} `));
                    }
                });
            });
            req.on('error', (err) => {
                log(`Request error: ${err.message} `);
                this.isConnected = false; // 标记为未连接
                reject(err);
            });
            req.on('timeout', () => {
                log('Request timeout');
                this.isConnected = false; // 标记为未连接
                req.destroy();
                reject(new Error('Request timeout'));
            });
            req.write(postData);
            req.end();
        });
    }
    dispose() {
        log('AIActivityDetector disposing...');
        this.clearSessionTimers();
        this.clearHeartbeatTimer();
        if (this.aiRunning) {
            this.completeTask();
        }
        // Always cancel task on dispose to clean up, regardless of state
        // This ensures the old task is removed when window reloads
        this.cancelTask();
        this.disposables.forEach(d => d.dispose());
        if (outputChannel) {
            outputChannel.dispose();
        }
        log('AIActivityDetector disposed');
    }
}
exports.AIActivityDetector = AIActivityDetector;
//# sourceMappingURL=aiActivityDetector.js.map