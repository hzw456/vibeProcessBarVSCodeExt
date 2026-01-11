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
const windowReporter_1 = require("./windowReporter");
let outputChannel;
function log(message) {
    const timestamp = new Date().toISOString();
    const msg = `[${timestamp}] [AIDetector] ${message}`;
    console.log(msg);
    if (outputChannel) {
        outputChannel.appendLine(msg);
    }
}
class AIActivityDetector {
    constructor() {
        this.disposables = [];
        // 状态
        this.state = 'ACTIVE';
        this.aiRunning = false;
        // 会话统计
        this.sessionInsert = 0;
        this.sessionEvents = 0;
        this.taskStartTime = 0;
        // 滑动窗口: 最近 1200ms 的插入记录
        this.recentInserts = [];
        this.SLIDING_WINDOW_MS = 1200;
        // 超时配置
        this.idleTimer = null;
        this.BASE_IDLE_TIMEOUT_MS = 15000;
        this.MIN_RUN_MS = 5000;
        outputChannel = vscode.window.createOutputChannel('AI Status Transmission');
        outputChannel.show(true);
        (0, windowReporter_1.setOutputChannel)(outputChannel);
        this.windowReporter = new windowReporter_1.WindowReporter();
        this.initialize();
    }
    initialize() {
        log('Initializing...');
        // 监听窗口焦点变化
        this.windowReporter.onFocusChange((focused) => {
            this.handleFocusChange(focused);
        });
        // 监听文档变化
        this.disposables.push(vscode.workspace.onDidChangeTextDocument((event) => {
            this.handleDocumentChange(event);
        }));
        log('Initialized');
        vscode.window.showInformationMessage('AI Status Transmission: Detector initialized');
    }
    handleFocusChange(focused) {
        log(`Focus changed: ${focused}, state: ${this.state}, aiRunning: ${this.aiRunning}`);
        if (!focused) {
            // 窗口失去焦点 -> ARMED
            this.state = 'ARMED';
            this.aiRunning = false;
            this.resetSession();
            log('Entering ARMED state');
        }
        else {
            // 窗口获得焦点 -> ACTIVE
            this.state = 'ACTIVE';
            if (this.aiRunning) {
                this.completeTask();
                this.aiRunning = false;
                log('Task completed on focus');
            }
            this.clearIdleTimer();
            this.recentInserts = [];
            log('Entering ACTIVE state');
        }
    }
    handleDocumentChange(event) {
        // 仅在 ARMED 状态下检测
        if (this.state !== 'ARMED') {
            return;
        }
        // 只处理文件
        const scheme = event.document.uri.scheme;
        if (scheme !== 'file' && scheme !== 'untitled') {
            return;
        }
        // 更新活动文件
        const fileName = event.document.fileName.split('/').pop() ||
            event.document.fileName.split('\\').pop() || '';
        if (fileName) {
            this.windowReporter.updateActiveFile(fileName);
        }
        // 统计变更
        let insert = 0;
        let deleteCount = 0;
        const segments = event.contentChanges.length;
        for (const change of event.contentChanges) {
            insert += change.text.length;
            deleteCount += change.rangeLength;
        }
        if (insert === 0 && deleteCount === 0) {
            return;
        }
        const now = Date.now();
        // 维护滑动窗口
        this.recentInserts.push({ timestamp: now, insertChars: insert });
        this.recentInserts = this.recentInserts.filter(r => now - r.timestamp <= this.SLIDING_WINDOW_MS);
        const winInsert = this.recentInserts.reduce((sum, r) => sum + r.insertChars, 0);
        const winEvents = this.recentInserts.length;
        // AI 判定
        const aiLike = this.isAiLike(insert, deleteCount, segments, winInsert, winEvents);
        const relativePath = vscode.workspace.asRelativePath(event.document.fileName);
        log(`Change: +${insert} -${deleteCount} segs=${segments} win=${winInsert}/${winEvents} ai=${aiLike} file=${relativePath}`);
        if (aiLike && !this.aiRunning) {
            this.startTask();
        }
        if (this.aiRunning) {
            this.sessionInsert += insert;
            this.sessionEvents += 1;
            this.resetIdleTimer();
        }
    }
    isAiLike(insert, deleteCount, segments, winInsert, winEvents) {
        // 否决条件
        if (insert === 0 && deleteCount > 0)
            return false;
        if (deleteCount > insert * 4 && insert < 15)
            return false;
        if (insert < 10 && segments === 1)
            return false;
        // 肯定条件
        if (insert >= 40)
            return true;
        if (winInsert >= 50 && winEvents >= 3)
            return true;
        if (segments >= 6 && insert >= 25)
            return true;
        return false;
    }
    startTask() {
        this.aiRunning = true;
        this.sessionInsert = 0;
        this.sessionEvents = 0;
        this.taskStartTime = Date.now();
        log('🤖 AI activity detected, starting task');
        this.windowReporter.updateTaskState('running');
        vscode.window.showInformationMessage(`AI Task Started: ${this.windowReporter.getWindowTitle()}`);
        this.resetIdleTimer();
    }
    completeTask() {
        log(`⏱️ Completing task: insert=${this.sessionInsert}, events=${this.sessionEvents}`);
        this.windowReporter.updateTaskState('completed');
        vscode.window.showInformationMessage(`AI Task Completed: ${this.windowReporter.getWindowTitle()}`);
    }
    getIdleTimeout() {
        if (this.sessionInsert >= 600)
            return 45000;
        if (this.sessionInsert >= 200)
            return 30000;
        return this.BASE_IDLE_TIMEOUT_MS;
    }
    resetIdleTimer() {
        this.clearIdleTimer();
        const timeout = this.getIdleTimeout();
        log(`Idle timer: ${timeout}ms`);
        this.idleTimer = setTimeout(() => {
            if (this.state !== 'ARMED' || !this.aiRunning) {
                return;
            }
            const runTime = Date.now() - this.taskStartTime;
            if (runTime < this.MIN_RUN_MS) {
                log(`Min run not reached: ${runTime}ms < ${this.MIN_RUN_MS}ms`);
                this.resetIdleTimer();
                return;
            }
            this.completeTask();
            this.aiRunning = false;
            this.resetSession();
        }, timeout);
    }
    clearIdleTimer() {
        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
            this.idleTimer = null;
        }
    }
    resetSession() {
        this.sessionInsert = 0;
        this.sessionEvents = 0;
        this.recentInserts = [];
        this.clearIdleTimer();
    }
    dispose() {
        log('Disposing...');
        this.clearIdleTimer();
        if (this.aiRunning) {
            this.completeTask();
        }
        this.windowReporter.dispose();
        this.disposables.forEach(d => d.dispose());
        if (outputChannel) {
            outputChannel.dispose();
        }
        log('Disposed');
    }
}
exports.AIActivityDetector = AIActivityDetector;
//# sourceMappingURL=aiActivityDetector.js.map