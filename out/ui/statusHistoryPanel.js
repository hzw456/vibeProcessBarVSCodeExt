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
exports.StatusHistoryPanel = void 0;
const vscode = __importStar(require("vscode"));
class StatusHistoryPanel {
    constructor(context, statusManager) {
        this.context = context;
        this.statusManager = statusManager;
        this.disposables = [];
    }
    async show() {
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.One);
            return;
        }
        this.panel = vscode.window.createWebviewPanel(StatusHistoryPanel.viewType, 'AI Status History', vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true
        });
        this.panel.onDidDispose(() => {
            this.panel = undefined;
        });
        this.panel.webview.html = this.getHtml(this.panel.webview);
        this.updateContent();
        // Refresh content when status changes
        this.statusManager.on('statusChanged', () => {
            this.updateContent();
        });
    }
    updateContent() {
        if (this.panel) {
            this.panel.webview.postMessage({
                type: 'updateHistory',
                data: this.statusManager.getStatusHistory()
            });
        }
    }
    getHtml(webview) {
        const nonce = this.getNonce();
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'history.js'));
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Status History</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .title {
            font-size: 18px;
            font-weight: 600;
            margin: 0;
        }
        .actions {
            display: flex;
            gap: 10px;
        }
        .btn {
            padding: 6px 12px;
            border: 1px solid var(--vscode-button-border);
            border-radius: 4px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            cursor: pointer;
            font-size: 12px;
        }
        .btn:hover {
            background: var(--vscode-button-hoverBackground);
        }
        .btn.danger {
            background: var(--vscode-button-dangerBackground);
            border-color: var(--vscode-button-dangerBorder);
        }
        .btn.danger:hover {
            background: var(--vscode-button-dangerHoverBackground);
        }
        .status-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .status-item {
            padding: 12px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            background: var(--vscode-editor-background);
        }
        .status-header {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 8px;
        }
        .status-icon {
            font-size: 16px;
            width: 20px;
            text-align: center;
        }
        .status-state {
            font-weight: 600;
            font-size: 14px;
        }
        .status-time {
            margin-left: auto;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
        .status-message {
            font-size: 13px;
            margin: 4px 0;
            color: var(--vscode-editor-foreground);
        }
        .status-details {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            font-style: italic;
        }
        .empty-state {
            text-align: center;
            padding: 40px 20px;
            color: var(--vscode-descriptionForeground);
        }
        .empty-state-icon {
            font-size: 48px;
            margin-bottom: 16px;
            opacity: 0.5;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1 class="title">AI Status History</h1>
        <div class="actions">
            <button class="btn" onclick="refreshHistory()">Refresh</button>
            <button class="btn danger" onclick="clearHistory()">Clear All</button>
        </div>
    </div>
    <div id="status-list" class="status-list">
        <div class="empty-state">
            <div class="empty-state-icon">📊</div>
            <p>No status history available</p>
            <p>Start using AI status commands to see history here</p>
        </div>
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        
        let statuses = [];

        function refreshHistory() {
            vscode.postMessage({ type: 'refreshHistory' });
        }

        function clearHistory() {
            if (confirm('Are you sure you want to clear all status history?')) {
                vscode.postMessage({ type: 'clearHistory' });
            }
        }

        function renderStatuses() {
            const container = document.getElementById('status-list');
            
            if (statuses.length === 0) {
                container.innerHTML = \`
                    <div class="empty-state">
                        <div class="empty-state-icon">📊</div>
                        <p>No status history available</p>
                        <p>Start using AI status commands to see history here</p>
                    </div>
                \`;
                return;
            }

            container.innerHTML = statuses.map(status => {
                const icon = getStatusIcon(status.state);
                const state = getStatusDisplayName(status.state);
                const time = new Date(status.timestamp).toLocaleString();
                const message = status.message || '';
                const details = status.details ? JSON.stringify(status.details, null, 2) : '';

                return \`
                    <div class="status-item">
                        <div class="status-header">
                            <div class="status-icon">\${icon}</div>
                            <div class="status-state">\${state}</div>
                            <div class="status-time">\${time}</div>
                        </div>
                        \${message ? \`<div class="status-message">\${message}</div>\` : ''}
                        \${details ? \`<div class="status-details">\${details}</div>\` : ''}
                    </div>
                \`;
            }).join('');
        }

        function getStatusIcon(state) {
            const icons = {
                'started': '🚀',
                'completed': '✅',
                'user_intervention_required': '⚠️',
                'error': '❌',
                'custom': '📝'
            };
            return icons[state] || '📊';
        }

        function getStatusDisplayName(state) {
            const names = {
                'started': 'Started',
                'completed': 'Completed',
                'user_intervention_required': 'User Intervention Required',
                'error': 'Error',
                'custom': 'Custom'
            };
            return names[state] || state;
        }

        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.type) {
                case 'updateHistory':
                    statuses = message.data;
                    renderStatuses();
                    break;
            }
        });

        // Initial render
        renderStatuses();
    </script>
</body>
</html>`;
    }
    getNonce() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < 32; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
    dispose() {
        if (this.panel) {
            this.panel.dispose();
            this.panel = undefined;
        }
        this.disposables.forEach(disposable => disposable.dispose());
        this.disposables = [];
    }
}
exports.StatusHistoryPanel = StatusHistoryPanel;
StatusHistoryPanel.viewType = 'aiStatusTransmission.history';
//# sourceMappingURL=statusHistoryPanel.js.map