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
exports.AIExtensionMonitor = void 0;
const vscode = __importStar(require("vscode"));
const events_1 = require("events");
/**
 * 监听AI编程扩展（Cline、Kiro、Copilot等）的运行状态
 */
class AIExtensionMonitor extends events_1.EventEmitter {
    constructor() {
        super();
        this.disposables = [];
        this.extensionStates = new Map();
        this.outputChannelListeners = new Map();
        this.pollingInterval = null;
        // 已知的AI编程扩展
        this.AI_EXTENSIONS = [
            { id: 'saoudrizwan.claude-dev', name: 'Cline' },
            { id: 'anthropics.claude-dev', name: 'Claude Dev' },
            { id: 'kiro.kiro', name: 'Kiro' },
            { id: 'amazonwebservices.kiro', name: 'Kiro (AWS)' },
            { id: 'github.copilot', name: 'GitHub Copilot' },
            { id: 'github.copilot-chat', name: 'GitHub Copilot Chat' },
            { id: 'continue.continue', name: 'Continue' },
            { id: 'sourcegraph.cody-ai', name: 'Cody' },
            { id: 'cursor.cursor', name: 'Cursor' },
            { id: 'amodio.tgit-lens', name: 'GitLens AI' },
        ];
        // 用于检测AI活动的关键词
        this.ACTIVITY_KEYWORDS = {
            started: ['thinking', 'analyzing', 'processing', 'starting', 'generating', 'working on'],
            progress: ['writing', 'editing', 'modifying', 'updating', 'creating', 'implementing'],
            completed: ['done', 'completed', 'finished', 'applied', 'saved'],
            error: ['error', 'failed', 'exception', 'unable to'],
            user_intervention: ['waiting', 'approval', 'confirm', 'review', 'accept', 'reject']
        };
        this.isMonitoring = false;
        this.lastTerminalContent = new Map();
    }
    startMonitoring() {
        if (this.isMonitoring) {
            return;
        }
        this.isMonitoring = true;
        console.log('AI Extension Monitor: Starting monitoring...');
        // 监听终端创建和变化
        this.disposables.push(vscode.window.onDidOpenTerminal((terminal) => {
            this.checkTerminalForAI(terminal);
        }));
        this.disposables.push(vscode.window.onDidCloseTerminal((terminal) => {
            this.handleTerminalClosed(terminal);
        }));
        // 监听活动编辑器变化（AI可能在修改文件）
        this.disposables.push(vscode.window.onDidChangeActiveTextEditor((editor) => {
            this.checkForAIActivity('editor_change', editor);
        }));
        // 监听文档变化（检测AI写入）
        this.disposables.push(vscode.workspace.onDidChangeTextDocument((event) => {
            this.checkDocumentChangeForAI(event);
        }));
        // 监听文件保存
        this.disposables.push(vscode.workspace.onDidSaveTextDocument((document) => {
            this.checkForAIActivity('file_saved', document);
        }));
        // 监听扩展激活/停用
        this.disposables.push(vscode.extensions.onDidChange(() => {
            this.checkAIExtensionsStatus();
        }));
        // 监听VS Code窗口状态变化
        this.disposables.push(vscode.window.onDidChangeWindowState((state) => {
            if (state.focused) {
                this.checkAIExtensionsStatus();
            }
        }));
        // 监听输出通道（很多AI扩展会写入输出通道）
        this.startOutputChannelMonitoring();
        // 定期轮询检查AI扩展状态
        this.startPolling();
        // 初始检查
        this.checkAIExtensionsStatus();
        this.checkExistingTerminals();
    }
    stopMonitoring() {
        this.isMonitoring = false;
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
        console.log('AI Extension Monitor: Stopped monitoring');
    }
    startPolling() {
        // 每2秒检查一次AI扩展状态
        this.pollingInterval = setInterval(() => {
            this.checkAIExtensionsStatus();
            this.detectAIActivityFromContext();
        }, 2000);
    }
    startOutputChannelMonitoring() {
        // VS Code API 不直接支持监听输出通道内容
        // 但我们可以通过其他方式检测AI活动
    }
    checkAIExtensionsStatus() {
        for (const extInfo of this.AI_EXTENSIONS) {
            const extension = vscode.extensions.getExtension(extInfo.id);
            const currentState = this.extensionStates.get(extInfo.id);
            if (extension) {
                const isActive = extension.isActive;
                if (!currentState) {
                    // 新发现的扩展
                    this.extensionStates.set(extInfo.id, {
                        extensionId: extInfo.id,
                        extensionName: extInfo.name,
                        isRunning: isActive,
                        startTime: isActive ? new Date() : undefined
                    });
                    if (isActive) {
                        console.log(`AI Extension Monitor: Detected active extension - ${extInfo.name}`);
                    }
                }
                else if (currentState.isRunning !== isActive) {
                    // 状态变化
                    currentState.isRunning = isActive;
                    currentState.lastActivity = new Date();
                    if (isActive) {
                        currentState.startTime = new Date();
                        this.emitActivityEvent({
                            type: 'started',
                            extensionId: extInfo.id,
                            extensionName: extInfo.name,
                            message: `${extInfo.name} 已激活`,
                            timestamp: new Date()
                        });
                    }
                }
            }
        }
    }
    checkExistingTerminals() {
        vscode.window.terminals.forEach(terminal => {
            this.checkTerminalForAI(terminal);
        });
    }
    checkTerminalForAI(terminal) {
        const name = terminal.name.toLowerCase();
        // 检查终端名称是否与AI扩展相关
        const aiKeywords = ['cline', 'kiro', 'copilot', 'claude', 'ai', 'assistant', 'agent'];
        const isAITerminal = aiKeywords.some(keyword => name.includes(keyword));
        if (isAITerminal) {
            console.log(`AI Extension Monitor: Detected AI-related terminal - ${terminal.name}`);
            this.emitActivityEvent({
                type: 'started',
                extensionId: 'terminal',
                extensionName: terminal.name,
                message: `AI终端活动: ${terminal.name}`,
                timestamp: new Date()
            });
        }
    }
    handleTerminalClosed(terminal) {
        const name = terminal.name.toLowerCase();
        const aiKeywords = ['cline', 'kiro', 'copilot', 'claude', 'ai', 'assistant', 'agent'];
        const isAITerminal = aiKeywords.some(keyword => name.includes(keyword));
        if (isAITerminal) {
            this.emitActivityEvent({
                type: 'completed',
                extensionId: 'terminal',
                extensionName: terminal.name,
                message: `AI终端关闭: ${terminal.name}`,
                timestamp: new Date()
            });
        }
    }
    checkDocumentChangeForAI(event) {
        // 检测大量快速的文档变化（可能是AI在写入）
        const changes = event.contentChanges;
        if (changes.length === 0)
            return;
        // 计算变化的总字符数
        let totalChars = 0;
        for (const change of changes) {
            totalChars += change.text.length;
        }
        // 如果一次性写入大量内容，可能是AI在工作
        if (totalChars > 100) {
            const activeExtension = this.getActiveAIExtension();
            if (activeExtension) {
                activeExtension.lastActivity = new Date();
                this.emitActivityEvent({
                    type: 'progress',
                    extensionId: activeExtension.extensionId,
                    extensionName: activeExtension.extensionName,
                    message: `正在编辑: ${event.document.fileName.split('/').pop()}`,
                    timestamp: new Date()
                });
            }
        }
    }
    checkForAIActivity(eventType, context) {
        const activeExtension = this.getActiveAIExtension();
        if (activeExtension) {
            activeExtension.lastActivity = new Date();
        }
    }
    detectAIActivityFromContext() {
        // 检查是否有活跃的AI扩展
        const activeExtension = this.getActiveAIExtension();
        if (!activeExtension)
            return;
        // 检查最近的活动时间
        if (activeExtension.lastActivity) {
            const timeSinceLastActivity = Date.now() - activeExtension.lastActivity.getTime();
            // 如果超过30秒没有活动，可能已完成
            if (timeSinceLastActivity > 30000 && activeExtension.isRunning) {
                // 不自动标记为完成，因为AI可能只是在等待
            }
        }
    }
    getActiveAIExtension() {
        for (const [id, state] of this.extensionStates) {
            if (state.isRunning) {
                return state;
            }
        }
        return null;
    }
    emitActivityEvent(event) {
        console.log(`AI Extension Monitor: ${event.type} - ${event.extensionName}: ${event.message}`);
        this.emit('aiActivity', event);
    }
    getActiveExtensions() {
        return Array.from(this.extensionStates.values()).filter(state => state.isRunning);
    }
    getAllExtensionStates() {
        return Array.from(this.extensionStates.values());
    }
    /**
     * 手动触发状态更新（供其他模块调用）
     */
    notifyActivity(type, message) {
        const activeExtension = this.getActiveAIExtension();
        const extensionName = activeExtension?.extensionName || 'AI Assistant';
        const extensionId = activeExtension?.extensionId || 'unknown';
        this.emitActivityEvent({
            type,
            extensionId,
            extensionName,
            message,
            timestamp: new Date()
        });
    }
    dispose() {
        this.stopMonitoring();
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
        this.extensionStates.clear();
        this.removeAllListeners();
    }
}
exports.AIExtensionMonitor = AIExtensionMonitor;
//# sourceMappingURL=aiExtensionMonitor.js.map