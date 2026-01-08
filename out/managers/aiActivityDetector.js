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
        this.state = 'IDLE';
        this.disposables = [];
        this.windowTitle = 'Unknown';
        this.ideName = 'vscode';
        this.fixedTaskId = '';
        this.activeFile = ''; // 当前活动文件名，用于窗口匹配
        this.windowId = ''; // UUID，唯一标识每个插件实例
        // 防抖：避免频繁的焦点变化导致任务被取消
        this.focusDebounceTimer = null;
        this.FOCUS_DEBOUNCE_MS = 500; // 500ms 防抖
        // AI 活动检测参数
        this.AI_BATCH_THRESHOLD = 30; // 单次变更超过30字符视为AI活动
        this.IDLE_TIMEOUT_MS = 3000; // 3秒无活动则认为AI完成
        this.idleTimer = null;
        this.lastActivityTime = 0;
        this.totalCharsInSession = 0; // 本次会话累计字符数
        outputChannel = vscode.window.createOutputChannel('AI Status Transmission');
        outputChannel.show(true);
        // 生成唯一的窗口 ID (UUID)
        this.windowId = crypto.randomUUID();
        log(`Generated window ID: ${this.windowId}`);
        this.initialize();
    }
    /**
     * Detect the IDE type from vscode.env.appName
     * Returns a short identifier for the IDE
     */
    detectIdeName(appName) {
        const lowerName = appName.toLowerCase();
        if (lowerName.includes('antigravity')) {
            return 'antigravity';
        }
        else if (lowerName.includes('kiro')) {
            return 'kiro';
        }
        else if (lowerName.includes('cursor')) {
            return 'cursor';
        }
        else if (lowerName.includes('windsurf')) {
            return 'windsurf';
        }
        else if (lowerName.includes('code - insiders')) {
            return 'vscode-insiders';
        }
        else if (lowerName.includes('visual studio code') || lowerName.includes('vs code')) {
            return 'vscode';
        }
        else if (lowerName.includes('vscodium')) {
            return 'vscodium';
        }
        else {
            // Return a sanitized version of the app name
            return appName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'unknown';
        }
    }
    /**
     * Get display-friendly IDE name for UI
     */
    getDisplayIdeName() {
        switch (this.ideName) {
            case 'antigravity':
                return 'Antigravity';
            case 'kiro':
                return 'Kiro';
            case 'cursor':
                return 'Cursor';
            case 'windsurf':
                return 'Windsurf';
            case 'vscode':
                return 'VS Code';
            case 'vscode-insiders':
                return 'VS Code Insiders';
            case 'vscodium':
                return 'VSCodium';
            default:
                return vscode.env.appName || 'IDE';
        }
    }
    /**
     * Get window title that matches the actual IDE window title
     * Handles untitled windows and workspace folders
     */
    getWindowTitle() {
        // Priority 1: Use workspace name if available (most reliable for saved projects)
        if (vscode.workspace.name) {
            return vscode.workspace.name;
        }
        // Priority 2: Use first workspace folder name
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            return vscode.workspace.workspaceFolders[0].name;
        }
        // Priority 3: For untitled windows, use the active editor's file name
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            const doc = activeEditor.document;
            if (doc.isUntitled) {
                // Untitled documents have URIs like "untitled:Untitled-1"
                // Extract just the name part
                const match = doc.uri.path.match(/Untitled-\d+/);
                if (match) {
                    return match[0];
                }
            }
            // Use the file name for regular files
            const fileName = doc.fileName.split('/').pop() || doc.fileName.split('\\').pop();
            if (fileName) {
                return fileName;
            }
        }
        // Fallback: Use a generic name
        return 'Untitled';
    }
    /**
     * Get current active file name for window matching
     */
    getActiveFileName() {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            const doc = activeEditor.document;
            // Get just the filename without path
            const fileName = doc.fileName.split('/').pop() || doc.fileName.split('\\').pop();
            return fileName || '';
        }
        return '';
    }
    initialize() {
        // Detect IDE name from vscode.env.appName
        const appName = vscode.env.appName || 'VS Code';
        this.ideName = this.detectIdeName(appName);
        // Get window title that matches actual IDE window title
        let workspaceName = this.getWindowTitle();
        this.windowTitle = workspaceName;
        this.fixedTaskId = `${this.ideName}_${workspaceName.replace(/[^a-zA-Z0-9]/g, '_')}`;
        this.activeFile = this.getActiveFileName();
        log(`AIActivityDetector initializing...`);
        log(`Detected IDE: ${appName} -> ${this.ideName}`);
        log(`Window title: ${this.windowTitle}`);
        log(`Fixed task ID: ${this.fixedTaskId}`);
        log(`Active file: ${this.activeFile}`);
        // 监听窗口焦点变化
        this.disposables.push(vscode.window.onDidChangeWindowState((windowState) => {
            log(`Window state changed: focused=${windowState.focused}`);
            this.handleWindowStateChangeDebounced(windowState.focused);
        }));
        // 监听文档变化
        this.disposables.push(vscode.workspace.onDidChangeTextDocument((event) => {
            this.handleDocumentChange(event);
        }));
        // 监听活动编辑器变化（更新 activeFile）
        this.disposables.push(vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (editor) {
                const oldFile = this.activeFile;
                this.activeFile = this.getActiveFileName();
                if (oldFile !== this.activeFile) {
                    log(`Active file changed: ${oldFile} -> ${this.activeFile}`);
                    // 如果在 ARMED 或 RUNNING 状态，更新服务器
                    if (this.state === 'ARMED' || this.state === 'RUNNING') {
                        this.updateActiveFile();
                    }
                }
            }
        }));
        log('AIActivityDetector initialized successfully');
        log(`Current state: ${this.state}`);
        vscode.window.showInformationMessage('AI Status Transmission: Detector initialized');
    }
    handleWindowStateChangeDebounced(focused) {
        // 清除之前的防抖计时器
        if (this.focusDebounceTimer) {
            clearTimeout(this.focusDebounceTimer);
            this.focusDebounceTimer = null;
        }
        // 如果窗口失去焦点，立即处理（进入 ARMED）
        if (!focused) {
            this.handleWindowStateChange(focused);
            return;
        }
        // 如果窗口获得焦点，延迟处理（防止快速切换）
        this.focusDebounceTimer = setTimeout(() => {
            this.handleWindowStateChange(focused);
        }, this.FOCUS_DEBOUNCE_MS);
    }
    handleWindowStateChange(focused) {
        log(`handleWindowStateChange: focused=${focused}, currentState=${this.state}`);
        if (focused) {
            // 窗口获得焦点
            if (this.state === 'ARMED') {
                // 从 ARMED 到 ACTIVE，不取消任务，只是更新状态
                this.sendActiveNotification();
                this.setState('ACTIVE');
                log('Window regained focus from ARMED, now ACTIVE');
            }
            else if (this.state === 'RUNNING') {
                // 从 RUNNING 完成任务
                this.completeTask();
                this.setState('IDLE');
                log('Window regained focus from RUNNING, task completed');
            }
        }
        else {
            // 窗口失去焦点
            if (this.state === 'IDLE') {
                // 进入 ARMED 状态
                this.setState('ARMED');
                this.sendArmedNotification();
                log('Window lost focus, entering ARMED state');
            }
            else if (this.state === 'ACTIVE') {
                // 从 ACTIVE 回到 ARMED
                this.setState('ARMED');
                this.sendArmedNotification();
                log('Window lost focus from ACTIVE, back to ARMED');
            }
        }
    }
    handleDocumentChange(event) {
        if (event.document.uri.scheme !== 'file') {
            return;
        }
        let charCount = 0;
        for (const change of event.contentChanges) {
            charCount += change.text.length + change.rangeLength;
        }
        if (charCount === 0)
            return;
        // 更新当前活动文件
        const fileName = event.document.fileName.split('/').pop() || event.document.fileName.split('\\').pop() || '';
        if (fileName) {
            this.activeFile = fileName;
        }
        const relativePath = vscode.workspace.asRelativePath(event.document.fileName);
        const now = Date.now();
        this.lastActivityTime = now;
        // 检测大批量变更（AI 特征）
        const isLikelyAI = charCount >= this.AI_BATCH_THRESHOLD;
        if (isLikelyAI) {
            log(`🤖 AI-like change detected: ${charCount} chars in ${relativePath}`);
            this.totalCharsInSession += charCount;
            if (this.state !== 'RUNNING') {
                // 不在 RUNNING 状态，启动任务
                this.setState('RUNNING');
                this.startRunningTask();
                log('AI activity detected, transitioning to RUNNING');
            }
            // 重置空闲计时器
            this.resetIdleTimer();
        }
        else if (this.state === 'RUNNING') {
            // 小变更但已在运行状态，也重置计时器
            this.totalCharsInSession += charCount;
            this.resetIdleTimer();
        }
        else if (this.state === 'ARMED') {
            // 原有逻辑：在 ARMED 状态下任何变更都触发 RUNNING
            log(`Document change in ARMED state: ${charCount} chars in ${relativePath}`);
            this.totalCharsInSession = charCount;
            this.setState('RUNNING');
            this.startRunningTask();
            this.resetIdleTimer();
        }
    }
    resetIdleTimer() {
        // 清除之前的计时器
        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
        }
        // 设置新的空闲计时器
        this.idleTimer = setTimeout(() => {
            if (this.state === 'RUNNING') {
                log(`⏱️ Idle timeout reached, completing task (${this.totalCharsInSession} total chars)`);
                this.completeTask();
                this.setState('IDLE');
                this.totalCharsInSession = 0;
            }
        }, this.IDLE_TIMEOUT_MS);
    }
    setState(newState) {
        log(`State transition: ${this.state} -> ${newState}`);
        this.state = newState;
    }
    async sendArmedNotification() {
        // Get project path
        let projectPath = '';
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            projectPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
        }
        // 获取最新的活动文件
        this.activeFile = this.getActiveFileName();
        const data = {
            task_id: this.fixedTaskId,
            window_id: this.windowId, // UUID 用于精确匹配
            name: `${this.getDisplayIdeName()} - ${this.windowTitle}`,
            ide: this.ideName,
            window_title: this.windowTitle,
            status: 'armed',
            project_path: projectPath,
        };
        // 只有当 activeFile 非空时才发送，避免空字符串导致匹配失败
        if (this.activeFile) {
            data.active_file = this.activeFile;
        }
        log(`Sending ARMED notification: ${this.fixedTaskId}, active_file: ${this.activeFile}`);
        try {
            await this.sendRequest('/api/task/armed', data);
            log(`✅ ARMED notification sent: ${this.fixedTaskId}`);
        }
        catch (err) {
            log(`❌ Failed to send ARMED notification: ${err}`);
        }
    }
    async updateActiveFile() {
        // 如果 activeFile 为空，跳过更新
        if (!this.activeFile) {
            log(`Skipping active file update: no active file`);
            return;
        }
        const data = {
            task_id: this.fixedTaskId,
            window_id: this.windowId,
            active_file: this.activeFile
        };
        log(`Updating active file: ${this.activeFile}`);
        try {
            await this.sendRequest('/api/task/update', data);
            log(`✅ Active file updated: ${this.activeFile}`);
        }
        catch (err) {
            log(`❌ Failed to update active file: ${err}`);
        }
    }
    async startRunningTask() {
        // Get project path
        let projectPath = '';
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            projectPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
        }
        const data = {
            task_id: this.fixedTaskId,
            window_id: this.windowId,
            name: `${this.getDisplayIdeName()} - ${this.windowTitle}`,
            ide: this.ideName,
            window_title: this.windowTitle,
            project_path: projectPath,
        };
        // 只有当 activeFile 非空时才发送
        if (this.activeFile) {
            data.active_file = this.activeFile;
        }
        log(`Starting RUNNING task: ${this.fixedTaskId}, active_file: ${this.activeFile || '(none)'}`);
        try {
            await this.sendRequest('/api/task/start', data);
            log(`✅ RUNNING task started: ${this.fixedTaskId}`);
            vscode.window.showInformationMessage(`AI Task Running: ${this.windowTitle}`);
        }
        catch (err) {
            log(`❌ Failed to start RUNNING task: ${err}`);
        }
    }
    async completeTask() {
        const data = {
            task_id: this.fixedTaskId,
            window_id: this.windowId,
            total_tokens: 0
        };
        log(`Completing task: ${this.fixedTaskId}`);
        try {
            await this.sendRequest('/api/task/complete', data);
            log(`✅ Task completed: ${this.fixedTaskId}`);
            vscode.window.showInformationMessage(`AI Task Completed: ${this.windowTitle}`);
        }
        catch (err) {
            log(`❌ Failed to complete task: ${err}`);
        }
    }
    async cancelTask() {
        const data = {
            task_id: this.fixedTaskId,
            window_id: this.windowId
        };
        log(`Cancelling task: ${this.fixedTaskId}`);
        try {
            await this.sendRequest('/api/task/cancel', data);
            log(`✅ Task cancelled: ${this.fixedTaskId}`);
        }
        catch (err) {
            log(`❌ Failed to cancel task: ${err}`);
        }
    }
    async sendActiveNotification() {
        const data = {
            task_id: this.fixedTaskId,
            window_id: this.windowId,
        };
        // 只有当 activeFile 非空时才发送
        if (this.activeFile) {
            data.active_file = this.activeFile;
        }
        log(`Sending ACTIVE notification: ${this.fixedTaskId}, active_file: ${this.activeFile || '(none)'}`);
        try {
            await this.sendRequest('/api/task/active', data);
            log(`✅ ACTIVE notification sent: ${this.fixedTaskId}`);
        }
        catch (err) {
            log(`❌ Failed to send ACTIVE notification: ${err}`);
        }
    }
    sendRequest(endpoint, data) {
        return new Promise((resolve, reject) => {
            const postData = JSON.stringify(data);
            log(`Sending request to: ${endpoint}`);
            log(`Request body: ${postData}`);
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
                    log(`Response: ${res.statusCode} - ${responseData}`);
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve();
                    }
                    else {
                        reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
                    }
                });
            });
            req.on('error', (err) => {
                log(`Request error: ${err.message}`);
                reject(err);
            });
            req.on('timeout', () => {
                log('Request timeout');
                req.destroy();
                reject(new Error('Request timeout'));
            });
            req.write(postData);
            req.end();
        });
    }
    dispose() {
        log('AIActivityDetector disposing...');
        if (this.focusDebounceTimer) {
            clearTimeout(this.focusDebounceTimer);
        }
        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
        }
        if (this.state === 'RUNNING') {
            this.completeTask();
        }
        else if (this.state === 'ARMED' || this.state === 'ACTIVE') {
            this.cancelTask();
        }
        this.disposables.forEach(d => d.dispose());
        if (outputChannel) {
            outputChannel.dispose();
        }
        log('AIActivityDetector disposed');
    }
}
exports.AIActivityDetector = AIActivityDetector;
//# sourceMappingURL=aiActivityDetector.js.map