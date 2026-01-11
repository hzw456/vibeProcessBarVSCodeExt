import * as vscode from 'vscode';
import { AIActivityDetector } from './managers/aiActivityDetector';

let detector: AIActivityDetector | null = null;

export function activate(context: vscode.ExtensionContext) {
    console.log('Vibe Process Bar extension activated');

    // 创建AI活动检测器
    detector = new AIActivityDetector();
    context.subscriptions.push(detector);

    // 注册命令：手动开始任务
    context.subscriptions.push(
        vscode.commands.registerCommand('vibeProcessBar.start', () => {
            // Auto detection enabled, manual start not needed
        })
    );

    // 注册命令：查看状态
    context.subscriptions.push(
        vscode.commands.registerCommand('vibeProcessBar.status', () => {
            vscode.window.showInformationMessage('Vibe Process Bar: AI Activity Detector is running');
        })
    );
}

export function deactivate() {
    if (detector) {
        detector.dispose();
        detector = null;
    }
    console.log('Vibe Process Bar extension deactivated');
}
