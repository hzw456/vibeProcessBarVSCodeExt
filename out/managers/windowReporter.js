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
exports.WindowReporter = void 0;
exports.setOutputChannel = setOutputChannel;
const vscode = __importStar(require("vscode"));
const crypto = __importStar(require("crypto"));
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
let outputChannel = null;
function log(message) {
    const timestamp = new Date().toISOString();
    const msg = `[${timestamp}] [WindowReporter] ${message}`;
    console.log(msg);
    if (outputChannel) {
        outputChannel.appendLine(msg);
    }
}
function setOutputChannel(channel) {
    outputChannel = channel;
}
class WindowReporter {
    constructor() {
        this.disposables = [];
        this.ideName = 'vscode';
        this.windowTitle = 'Unknown';
        this.activeFile = '';
        // 焦点状态
        this.isFocused = true;
        // 心跳
        this.heartbeatTimer = null;
        this.HEARTBEAT_INTERVAL_MS = 3000;
        this.isConnected = false;
        this.lastHeartbeatSuccess = 0;
        // 焦点变化回调
        this.onFocusChangeCallback = null;
        this.taskId = crypto.randomUUID();
        this.initialize();
    }
    initialize() {
        const appName = vscode.env.appName || 'VS Code';
        this.ideName = this.detectIdeName(appName);
        this.windowTitle = this.getWindowTitle();
        this.activeFile = this.getActiveFileName();
        log(`Initializing...`);
        log(`IDE: ${appName} -> ${this.ideName}`);
        log(`Window: ${this.windowTitle}`);
        log(`Task ID: ${this.taskId}`);
        // 监听窗口焦点变化
        this.disposables.push(vscode.window.onDidChangeWindowState((state) => {
            this.handleWindowStateChange(state.focused);
        }));
        // 监听活动编辑器变化
        this.disposables.push(vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (editor) {
                this.activeFile = this.getActiveFileName();
            }
        }));
        // 启动心跳
        this.startHeartbeat();
        this.sendReport();
        log('Initialized');
    }
    handleWindowStateChange(focused) {
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
    getTaskId() {
        return this.taskId;
    }
    getIdeName() {
        return this.ideName;
    }
    getWindowTitle() {
        if (vscode.workspace.name)
            return vscode.workspace.name;
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
    getIsFocused() {
        return this.isFocused;
    }
    onFocusChange(callback) {
        this.onFocusChangeCallback = callback;
    }
    updateActiveFile(fileName) {
        this.activeFile = fileName;
    }
    // ========== API 调用 ==========
    async updateTaskState(status) {
        const data = {
            task_id: this.taskId,
            status,
        };
        log(`Updating state: ${status}`);
        try {
            await this.sendRequest('/api/task/update_state', data);
            log(`✅ State updated: ${status}`);
        }
        catch (err) {
            log(`❌ Failed to update state: ${err}`);
        }
    }
    // ========== 私有方法 ==========
    detectIdeName(appName) {
        const lower = appName.toLowerCase();
        if (lower.includes('antigravity'))
            return 'antigravity';
        if (lower.includes('kiro'))
            return 'kiro';
        if (lower.includes('cursor'))
            return 'cursor';
        if (lower.includes('windsurf'))
            return 'windsurf';
        if (lower.includes('codebuddy cn') || lower.includes('codebuddycn'))
            return 'codebuddycn';
        if (lower.includes('codebuddy') || lower.includes('code buddy'))
            return 'codebuddy';
        if (lower.includes('trae'))
            return 'trae';
        if (lower.includes('code - insiders'))
            return 'vscode-insiders';
        if (lower.includes('visual studio code') || lower.includes('vs code'))
            return 'vscode';
        if (lower.includes('vscodium'))
            return 'vscodium';
        return appName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'unknown';
    }
    getDisplayIdeName() {
        const map = {
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
    shouldSkipReporting() {
        const hasActiveFile = !!this.activeFile?.trim();
        const hasValidTitle = !!this.windowTitle?.trim() && this.windowTitle !== 'Untitled';
        const hasProjectPath = !!vscode.workspace.workspaceFolders?.length;
        if (!hasActiveFile && !hasValidTitle && !hasProjectPath) {
            log('Skipping report: empty window');
            return true;
        }
        return false;
    }
    startHeartbeat() {
        this.heartbeatTimer = setInterval(() => {
            const now = Date.now();
            const timeSinceLastSuccess = now - this.lastHeartbeatSuccess;
            if (timeSinceLastSuccess > 3500) {
                this.isConnected = false;
            }
            this.sendReport();
        }, this.HEARTBEAT_INTERVAL_MS);
    }
    async sendReport() {
        this.activeFile = this.getActiveFileName();
        this.windowTitle = this.getWindowTitle();
        if (this.shouldSkipReporting()) {
            return;
        }
        let projectPath = '';
        if (vscode.workspace.workspaceFolders?.length) {
            projectPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
        }
        const data = {
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
        }
        catch (err) {
            // 静默失败，心跳会重试
        }
    }
    sendRequest(endpoint, data) {
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
            }, (res) => {
                let responseData = '';
                res.on('data', (chunk) => responseData += chunk);
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve();
                    }
                    else {
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
    deleteTaskSync() {
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
        }
        catch (err) {
            log(`❌ Failed to delete task: ${err.message}`);
        }
    }
    dispose() {
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
exports.WindowReporter = WindowReporter;
//# sourceMappingURL=windowReporter.js.map