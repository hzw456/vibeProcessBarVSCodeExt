import * as vscode from 'vscode';
import { WindowReporter, setOutputChannel } from './windowReporter';

/**
 * AI 活动检测器 (简化版)
 * 
 * 职责：
 * - 监听窗口焦点变化
 * - 管理任务状态 (armed/completed)
 * 
 * 状态机（简化版）：
 * - ACTIVE: 窗口有焦点
 * - ARMED: 窗口失去焦点
 * - completed: 窗口重新获得焦点
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

    constructor() {
        outputChannel = vscode.window.createOutputChannel('Vibe Process Bar');
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

        log('Initialized');
    }

    private handleFocusChange(focused: boolean): void {
        log(`Focus changed: ${focused}, state: ${this.state}`);

        if (!focused) {
            // 窗口失去焦点 -> ARMED
            this.state = 'ARMED';
            this.startTask();
            log('Entering ARMED state');
        } else {
            // 窗口获得焦点 -> completed
            this.state = 'ACTIVE';
            this.completeTask();
            log('Entering ACTIVE state, task completed');
        }
    }

    private startTask(): void {
        log('🔄 Starting task (armed)');
        this.windowReporter.updateTaskState('armed');
    }

    private completeTask(): void {
        log('✅ Completing task');
        this.windowReporter.updateTaskState('completed');
    }

    public dispose(): void {
        log('Disposing...');

        this.windowReporter.dispose();
        this.disposables.forEach(d => d.dispose());

        if (outputChannel) {
            outputChannel.dispose();
        }

        log('Disposed');
    }
}
