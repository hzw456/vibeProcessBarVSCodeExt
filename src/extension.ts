import * as vscode from 'vscode';
import { AIActivityDetector } from './managers/aiActivityDetector';

let detector: AIActivityDetector | null = null;

export function activate(context: vscode.ExtensionContext) {
    console.log('AI Status Transmission extension activated');

    // 创建AI活动检测器
    detector = new AIActivityDetector();
    context.subscriptions.push(detector);

    // 注册命令：手动开始任务
    context.subscriptions.push(
        vscode.commands.registerCommand('aiStatusTransmission.start', () => {
            vscode.window.showInformationMessage('AI Status: Manual start not needed - auto detection enabled');
        })
    );

    // 注册命令：查看状态
    context.subscriptions.push(
        vscode.commands.registerCommand('aiStatusTransmission.status', () => {
            vscode.window.showInformationMessage('AI Activity Detector is running');
        })
    );

    vscode.window.showInformationMessage('AI Status Transmission: Auto-detection enabled');
}

export function deactivate() {
    if (detector) {
        detector.dispose();
        detector = null;
    }
    console.log('AI Status Transmission extension deactivated');
}
