import * as vscode from 'vscode';
import { WindowReporter, setOutputChannel } from './windowReporter';

/**
 * AI 活动检测器
 * 
 * 职责：
 * - 监听文档变化，检测 AI 生成的代码
 * - 管理 AI 运行状态 (running/completed)
 * 
 * 状态机：
 * - ACTIVE: 窗口有焦点，不检测 AI 活动
 * - ARMED: 窗口失去焦点，开始检测 AI 活动
 */

type State = 'ACTIVE' | 'ARMED';

let outputChannel: vscode.OutputChannel;

function log(message: string) {
    const timestamp = new Date().toISOString();
    const msg = `[${timestamp}] [AIDetector] ${message}`;
    console.log(msg);
    if (outputChannel) {
        outputChannel.appendLine(msg);
    }
}

export class AIActivityDetector implements vscode.Disposable {
    private disposables: vscode.Disposable[] = [];
    private windowReporter: WindowReporter;

    // 状态
    private state: State = 'ACTIVE';
    private aiRunning: boolean = false;

    // 会话统计
    private sessionInsert: number = 0;
    private sessionEvents: number = 0;
    private taskStartTime: number = 0;

    // 滑动窗口: 最近 1200ms 的插入记录
    private recentInserts: Array<{ timestamp: number; insertChars: number }> = [];
    private readonly SLIDING_WINDOW_MS = 1200;

    // 超时配置
    private idleTimer: NodeJS.Timeout | null = null;
    private readonly BASE_IDLE_TIMEOUT_MS = 15000;
    private readonly MIN_RUN_MS = 5000;

    constructor() {
        outputChannel = vscode.window.createOutputChannel('AI Status Transmission');
        outputChannel.show(true);
        setOutputChannel(outputChannel);

        this.windowReporter = new WindowReporter();
        this.initialize();
    }

    private initialize(): void {
        log('Initializing...');

        // 监听窗口焦点变化
        this.windowReporter.onFocusChange((focused) => {
            this.handleFocusChange(focused);
        });

        // 监听文档变化
        this.disposables.push(
            vscode.workspace.onDidChangeTextDocument((event) => {
                this.handleDocumentChange(event);
            })
        );

        log('Initialized');
        vscode.window.showInformationMessage('AI Status Transmission: Detector initialized');
    }

    private handleFocusChange(focused: boolean): void {
        log(`Focus changed: ${focused}, state: ${this.state}, aiRunning: ${this.aiRunning}`);

        if (!focused) {
            // 窗口失去焦点 -> ARMED
            this.state = 'ARMED';
            this.aiRunning = false;
            this.resetSession();
            log('Entering ARMED state');
        } else {
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

    private handleDocumentChange(event: vscode.TextDocumentChangeEvent): void {
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

    private isAiLike(insert: number, deleteCount: number, segments: number, winInsert: number, winEvents: number): boolean {
        // 否决条件
        if (insert === 0 && deleteCount > 0) return false;
        if (deleteCount > insert * 4 && insert < 15) return false;
        if (insert < 10 && segments === 1) return false;

        // 肯定条件
        if (insert >= 40) return true;
        if (winInsert >= 50 && winEvents >= 3) return true;
        if (segments >= 6 && insert >= 25) return true;

        return false;
    }

    private startTask(): void {
        this.aiRunning = true;
        this.sessionInsert = 0;
        this.sessionEvents = 0;
        this.taskStartTime = Date.now();

        log('🤖 AI activity detected, starting task');
        this.windowReporter.updateTaskState('running');
        vscode.window.showInformationMessage(`AI Task Started: ${this.windowReporter.getWindowTitle()}`);

        this.resetIdleTimer();
    }

    private completeTask(): void {
        log(`⏱️ Completing task: insert=${this.sessionInsert}, events=${this.sessionEvents}`);
        this.windowReporter.updateTaskState('completed');
        vscode.window.showInformationMessage(`AI Task Completed: ${this.windowReporter.getWindowTitle()}`);
    }

    private getIdleTimeout(): number {
        if (this.sessionInsert >= 600) return 45000;
        if (this.sessionInsert >= 200) return 30000;
        return this.BASE_IDLE_TIMEOUT_MS;
    }

    private resetIdleTimer(): void {
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

    private clearIdleTimer(): void {
        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
            this.idleTimer = null;
        }
    }

    private resetSession(): void {
        this.sessionInsert = 0;
        this.sessionEvents = 0;
        this.recentInserts = [];
        this.clearIdleTimer();
    }

    public dispose(): void {
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
