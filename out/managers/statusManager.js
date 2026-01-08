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
exports.StatusManager = void 0;
const vscode = __importStar(require("vscode"));
const httpClient_1 = require("../utils/httpClient");
const statusCache_1 = require("../utils/statusCache");
const aiExtensionMonitor_1 = require("./aiExtensionMonitor");
const events_1 = require("events");
class StatusManager extends events_1.EventEmitter {
    constructor(context, configManager) {
        super();
        this.currentStatus = null;
        this.statusHistory = [];
        this.disposables = [];
        // Vibe Process Bar specific tracking
        this.currentTaskId = null;
        this.currentTaskProgress = 0;
        this.currentTaskTokens = 0;
        this.context = context;
        this.configManager = configManager;
        this.httpClient = new httpClient_1.HTTPClient();
        this.statusCache = new statusCache_1.StatusCache(context);
        this.aiMonitor = new aiExtensionMonitor_1.AIExtensionMonitor();
        // Load cached status history
        this.loadStatusHistory();
        // 设置AI监听器事件处理
        this.setupAIMonitorListeners();
    }
    /**
     * 设置AI扩展监听器的事件处理
     */
    setupAIMonitorListeners() {
        this.aiMonitor.on('aiActivity', async (event) => {
            console.log(`StatusManager: Received AI activity - ${event.type} from ${event.extensionName}`);
            await this.handleAIActivityEvent(event);
        });
    }
    /**
     * 处理AI活动事件，自动发送HTTP请求
     */
    async handleAIActivityEvent(event) {
        if (!this.configManager.isEnabled()) {
            return;
        }
        const stateMap = {
            'started': 'started',
            'progress': 'custom',
            'completed': 'completed',
            'error': 'error',
            'user_intervention': 'user_intervention_required'
        };
        const state = stateMap[event.type];
        const message = event.message || `${event.extensionName}: ${event.type}`;
        await this.setStatus(state, message, {
            extensionId: event.extensionId,
            extensionName: event.extensionName,
            progress: event.progress
        });
    }
    /**
     * 启动AI扩展监听
     */
    startAIMonitoring() {
        this.aiMonitor.startMonitoring();
        console.log('StatusManager: AI monitoring started');
    }
    /**
     * 停止AI扩展监听
     */
    stopAIMonitoring() {
        this.aiMonitor.stopMonitoring();
        console.log('StatusManager: AI monitoring stopped');
    }
    /**
     * 获取AI监听器实例
     */
    getAIMonitor() {
        return this.aiMonitor;
    }
    async setStatus(state, message, details, metadata) {
        const status = {
            id: this.generateId(),
            state,
            timestamp: new Date(),
            message,
            details,
            userId: this.getUserId(),
            sessionId: this.getSessionId(),
            metadata
        };
        // Update current status
        this.currentStatus = status;
        this.statusHistory.push(status);
        // Save to history
        this.saveStatusHistory();
        // Emit event
        this.emit('statusChanged', { type: 'status_changed', status });
        // Transmit status if enabled
        if (this.configManager.isEnabled()) {
            return await this.transmitStatus(status);
        }
        else {
            return {
                success: true,
                statusCode: 0,
                error: undefined,
                timestamp: new Date(),
                retryCount: 0
            };
        }
    }
    getCurrentStatus() {
        return this.currentStatus;
    }
    getStatusHistory() {
        return [...this.statusHistory];
    }
    async clearHistory() {
        this.statusHistory = [];
        this.currentStatus = null;
        this.currentTaskId = null;
        this.currentTaskProgress = 0;
        this.currentTaskTokens = 0;
        await this.statusCache.clear();
        this.saveStatusHistory();
    }
    async transmitCurrentStatus() {
        if (this.currentStatus && this.configManager.isEnabled()) {
            return await this.transmitStatus(this.currentStatus);
        }
        return null;
    }
    async transmitStatus(status) {
        let result;
        try {
            switch (status.state) {
                case 'started':
                    result = await this.handleStartTask(status);
                    break;
                case 'completed':
                    result = await this.handleCompleteTask(status);
                    break;
                case 'error':
                    result = await this.handleErrorTask(status);
                    break;
                case 'user_intervention_required':
                    result = await this.handleUserIntervention(status);
                    break;
                case 'custom':
                    result = await this.handleCustomStatus(status);
                    break;
                default:
                    result = {
                        success: false,
                        statusCode: 0,
                        error: `Unknown status state: ${status.state}`,
                        timestamp: new Date(),
                        retryCount: 0
                    };
            }
        }
        catch (error) {
            result = {
                success: false,
                statusCode: 0,
                error: error instanceof Error ? error.message : 'Unknown transmission error',
                timestamp: new Date(),
                retryCount: 0
            };
        }
        // Emit transmission event
        this.emit('statusChanged', {
            type: result.success ? 'transmission_success' : 'transmission_error',
            status,
            result,
            error: result.error ? new Error(result.error) : undefined
        });
        // Cache failed transmissions
        if (!result.success) {
            await this.statusCache.add(status);
        }
        return result;
    }
    async handleStartTask(status) {
        const config = this.configManager.getConfiguration();
        const taskId = this.generateTaskId();
        this.currentTaskId = taskId;
        this.currentTaskProgress = 0;
        this.currentTaskTokens = 0;
        const startTaskData = {
            task_id: taskId,
            name: status.message || 'AI Programming Task',
            ide: 'vscode',
            window_title: this.getCurrentWindowTitle()
        };
        const response = await this.httpClient.post(`${config.endpoint}/api/task/start`, startTaskData, {
            'Content-Type': 'application/json',
            ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` })
        }, config.timeout);
        return {
            success: response.success,
            statusCode: response.statusCode,
            error: response.error,
            timestamp: new Date(),
            retryCount: response.retryCount
        };
    }
    async handleCompleteTask(status) {
        if (!this.currentTaskId) {
            return {
                success: false,
                statusCode: 0,
                error: 'No active task to complete',
                timestamp: new Date(),
                retryCount: 0
            };
        }
        const config = this.configManager.getConfiguration();
        const completeTaskData = {
            task_id: this.currentTaskId,
            total_tokens: this.currentTaskTokens
        };
        const response = await this.httpClient.post(`${config.endpoint}/api/task/complete`, completeTaskData, {
            'Content-Type': 'application/json',
            ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` })
        }, config.timeout);
        // Clear current task after completion
        this.currentTaskId = null;
        return {
            success: response.success,
            statusCode: response.statusCode,
            error: response.error,
            timestamp: new Date(),
            retryCount: response.retryCount
        };
    }
    async handleErrorTask(status) {
        if (!this.currentTaskId) {
            return {
                success: false,
                statusCode: 0,
                error: 'No active task to set error status',
                timestamp: new Date(),
                retryCount: 0
            };
        }
        const config = this.configManager.getConfiguration();
        const errorData = {
            task_id: this.currentTaskId,
            message: status.message || 'Task encountered an error'
        };
        const response = await this.httpClient.post(`${config.endpoint}/api/task/error`, errorData, {
            'Content-Type': 'application/json',
            ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` })
        }, config.timeout);
        // Clear current task after error
        this.currentTaskId = null;
        return {
            success: response.success,
            statusCode: response.statusCode,
            error: response.error,
            timestamp: new Date(),
            retryCount: response.retryCount
        };
    }
    async handleUserIntervention(status) {
        // For user intervention, we can pause the task and set progress to a specific value
        if (!this.currentTaskId) {
            return {
                success: false,
                statusCode: 0,
                error: 'No active task for user intervention',
                timestamp: new Date(),
                retryCount: 0
            };
        }
        const config = this.configManager.getConfiguration();
        // Update progress to indicate waiting state
        const progressData = {
            task_id: this.currentTaskId,
            progress: Math.max(0, this.currentTaskProgress - 10) // Slightly reduce progress
        };
        const response = await this.httpClient.post(`${config.endpoint}/api/task/progress`, progressData, {
            'Content-Type': 'application/json',
            ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` })
        }, config.timeout);
        return {
            success: response.success,
            statusCode: response.statusCode,
            error: response.error,
            timestamp: new Date(),
            retryCount: response.retryCount
        };
    }
    async handleCustomStatus(status) {
        // For custom status, update progress based on message or metadata
        if (!this.currentTaskId) {
            // If no current task, start one
            return await this.handleStartTask(status);
        }
        const config = this.configManager.getConfiguration();
        // Try to extract progress from message (e.g., "Progress: 75%")
        const progressMatch = status.message?.match(/(\d+)%/);
        let progress = this.currentTaskProgress;
        if (progressMatch) {
            progress = parseInt(progressMatch[1]);
            this.currentTaskProgress = progress;
        }
        const progressData = {
            task_id: this.currentTaskId,
            progress: Math.min(100, Math.max(0, progress))
        };
        const response = await this.httpClient.post(`${config.endpoint}/api/task/progress`, progressData, {
            'Content-Type': 'application/json',
            ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` })
        }, config.timeout);
        return {
            success: response.success,
            statusCode: response.statusCode,
            error: response.error,
            timestamp: new Date(),
            retryCount: response.retryCount
        };
    }
    async processCachedStatuses() {
        const cachedStatuses = await this.statusCache.getAll();
        for (const status of cachedStatuses) {
            const result = await this.transmitStatus(status);
            if (result.success) {
                await this.statusCache.remove(status.id);
            }
        }
    }
    async updateProgress(progress) {
        if (!this.currentTaskId) {
            return {
                success: false,
                statusCode: 0,
                error: 'No active task to update progress',
                timestamp: new Date(),
                retryCount: 0
            };
        }
        this.currentTaskProgress = Math.min(100, Math.max(0, progress));
        const config = this.configManager.getConfiguration();
        const progressData = {
            task_id: this.currentTaskId,
            progress: this.currentTaskProgress
        };
        const response = await this.httpClient.post(`${config.endpoint}/api/task/progress`, progressData, {
            'Content-Type': 'application/json',
            ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` })
        }, config.timeout);
        return {
            success: response.success,
            statusCode: response.statusCode,
            error: response.error,
            timestamp: new Date(),
            retryCount: response.retryCount
        };
    }
    async updateTokens(tokens, increment = true) {
        if (!this.currentTaskId) {
            return {
                success: false,
                statusCode: 0,
                error: 'No active task to update tokens',
                timestamp: new Date(),
                retryCount: 0
            };
        }
        if (increment) {
            this.currentTaskTokens += tokens;
        }
        else {
            this.currentTaskTokens = tokens;
        }
        const config = this.configManager.getConfiguration();
        const tokenData = {
            task_id: this.currentTaskId,
            tokens: this.currentTaskTokens,
            increment
        };
        const response = await this.httpClient.post(`${config.endpoint}/api/task/token`, tokenData, {
            'Content-Type': 'application/json',
            ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` })
        }, config.timeout);
        return {
            success: response.success,
            statusCode: response.statusCode,
            error: response.error,
            timestamp: new Date(),
            retryCount: response.retryCount
        };
    }
    registerEventListeners() {
        // Listen for configuration changes
        this.disposables.push(this.configManager.onConfigurationChanged(async (config) => {
            if (config.enabled) {
                await this.processCachedStatuses();
            }
        }));
        // Listen for VS Code events
        this.disposables.push(vscode.workspace.onDidSaveTextDocument(async (document) => {
            if (document.languageId === 'typescript' || document.languageId === 'javascript') {
                await this.updateTokens(100, true); // Increment token count on file save
            }
        }));
        this.disposables.push(vscode.window.onDidChangeTextEditorSelection(async (event) => {
            if (event.textEditor.document.languageId === 'typescript' ||
                event.textEditor.document.languageId === 'javascript') {
                // Could trigger status updates based on AI interaction
            }
        }));
    }
    loadStatusHistory() {
        const cached = this.context.globalState.get('statusHistory', []);
        this.statusHistory = cached.map(status => ({
            ...status,
            timestamp: new Date(status.timestamp)
        }));
    }
    saveStatusHistory() {
        // Keep only last 100 statuses to prevent storage bloat
        const limitedHistory = this.statusHistory.slice(-100);
        this.context.globalState.update('statusHistory', limitedHistory);
    }
    generateId() {
        return `status_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    generateTaskId() {
        return `task_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    }
    getUserId() {
        return this.context.globalState.get('userId', 'anonymous');
    }
    getSessionId() {
        return this.context.globalState.get('sessionId', this.generateId());
    }
    getCurrentWindowTitle() {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            const document = activeEditor.document;
            const fileName = document.fileName.split('/').pop() || 'Untitled';
            return `${fileName} - Visual Studio Code`;
        }
        return 'Visual Studio Code';
    }
    dispose() {
        this.aiMonitor.dispose();
        this.disposables.forEach(disposable => disposable.dispose());
        this.removeAllListeners();
    }
}
exports.StatusManager = StatusManager;
//# sourceMappingURL=statusManager.js.map