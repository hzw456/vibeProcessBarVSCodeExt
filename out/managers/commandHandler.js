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
exports.CommandHandler = void 0;
const vscode = __importStar(require("vscode"));
class CommandHandler {
    constructor(context, statusManager, configManager, statusHistoryPanel, configurationPanel) {
        this.context = context;
        this.statusManager = statusManager;
        this.configManager = configManager;
        this.statusHistoryPanel = statusHistoryPanel;
        this.configurationPanel = configurationPanel;
        this.disposables = [];
    }
    registerCommands() {
        // AI Status commands
        this.disposables.push(vscode.commands.registerCommand('aiStatusTransmission.start', async () => {
            await this.handleStartStatus();
        }));
        this.disposables.push(vscode.commands.registerCommand('aiStatusTransmission.end', async () => {
            await this.handleEndStatus();
        }));
        this.disposables.push(vscode.commands.registerCommand('aiStatusTransmission.userIntervention', async () => {
            await this.handleUserInterventionStatus();
        }));
        this.disposables.push(vscode.commands.registerCommand('aiStatusTransmission.error', async () => {
            await this.handleErrorStatus();
        }));
        this.disposables.push(vscode.commands.registerCommand('aiStatusTransmission.custom', async () => {
            await this.handleCustomStatus();
        }));
        // UI commands
        this.disposables.push(vscode.commands.registerCommand('aiStatusTransmission.viewHistory', async () => {
            await this.handleViewHistory();
        }));
        this.disposables.push(vscode.commands.registerCommand('aiStatusTransmission.configure', async () => {
            await this.handleConfigure();
        }));
    }
    async handleStartStatus() {
        const message = await vscode.window.showInputBox({
            prompt: 'Enter a message for the start status (optional)',
            placeHolder: 'e.g., Started working on new feature'
        });
        const result = await this.statusManager.setStatus('started', message);
        if (result.success) {
            vscode.window.showInformationMessage(`AI Status: Started${message ? ` - ${message}` : ''}`);
        }
        else {
            vscode.window.showErrorMessage(`Failed to transmit status: ${result.error}`);
        }
    }
    async handleEndStatus() {
        const message = await vscode.window.showInputBox({
            prompt: 'Enter a message for the end status (optional)',
            placeHolder: 'e.g., Completed feature implementation'
        });
        const result = await this.statusManager.setStatus('completed', message);
        if (result.success) {
            vscode.window.showInformationMessage(`AI Status: Completed${message ? ` - ${message}` : ''}`);
        }
        else {
            vscode.window.showErrorMessage(`Failed to transmit status: ${result.error}`);
        }
    }
    async handleUserInterventionStatus() {
        const message = await vscode.window.showInputBox({
            prompt: 'Describe what user intervention is required',
            placeHolder: 'e.g., Need approval for code changes'
        });
        if (!message) {
            return;
        }
        const result = await this.statusManager.setStatus('user_intervention_required', message);
        if (result.success) {
            vscode.window.showWarningMessage(`AI Status: User Intervention Required - ${message}`);
        }
        else {
            vscode.window.showErrorMessage(`Failed to transmit status: ${result.error}`);
        }
    }
    async handleErrorStatus() {
        const message = await vscode.window.showInputBox({
            prompt: 'Describe the error that occurred',
            placeHolder: 'e.g., Compilation failed due to missing dependencies'
        });
        if (!message) {
            return;
        }
        const result = await this.statusManager.setStatus('error', message);
        if (result.success) {
            vscode.window.showErrorMessage(`AI Status: Error - ${message}`);
        }
        else {
            vscode.window.showErrorMessage(`Failed to transmit status: ${result.error}`);
        }
    }
    async handleCustomStatus() {
        const state = await vscode.window.showQuickPick(['custom'], {
            placeHolder: 'Select status type',
            canPickMany: false
        });
        if (!state) {
            return;
        }
        const message = await vscode.window.showInputBox({
            prompt: 'Enter custom status message',
            placeHolder: 'e.g., Reviewing code suggestions'
        });
        const details = await vscode.window.showInputBox({
            prompt: 'Enter additional details (optional)',
            placeHolder: 'e.g., File: src/components/User.tsx'
        });
        const result = await this.statusManager.setStatus('custom', message || 'Custom status', details ? { details } : undefined);
        if (result.success) {
            vscode.window.showInformationMessage(`AI Status: ${message || 'Custom status'} transmitted`);
        }
        else {
            vscode.window.showErrorMessage(`Failed to transmit status: ${result.error}`);
        }
    }
    async handleViewHistory() {
        await this.statusHistoryPanel.show();
    }
    async handleConfigure() {
        await this.configurationPanel.show();
    }
    dispose() {
        this.disposables.forEach(disposable => disposable.dispose());
        this.disposables = [];
    }
}
exports.CommandHandler = CommandHandler;
//# sourceMappingURL=commandHandler.js.map