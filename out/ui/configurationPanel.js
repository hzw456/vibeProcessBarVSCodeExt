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
exports.ConfigurationPanel = void 0;
const vscode = __importStar(require("vscode"));
class ConfigurationPanel {
    constructor(context, configManager) {
        this.context = context;
        this.configManager = configManager;
        this.disposables = [];
    }
    async show() {
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.One);
            return;
        }
        this.panel = vscode.window.createWebviewPanel(ConfigurationPanel.viewType, 'AI Status Transmission Configuration', vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true
        });
        this.panel.onDidDispose(() => {
            this.panel = undefined;
        });
        this.panel.webview.html = this.getHtml(this.panel.webview);
        this.updateContent();
        // Listen for messages from the webview
        const disposable = this.panel.webview.onDidReceiveMessage(message => {
            switch (message.type) {
                case 'saveConfiguration':
                    this.saveConfiguration(message.data);
                    return;
                case 'testEndpoint':
                    this.testEndpoint(message.endpoint);
                    return;
                case 'resetConfiguration':
                    this.resetConfiguration();
                    return;
            }
        }, undefined, this.context.subscriptions);
        this.disposables.push(disposable);
    }
    updateContent() {
        if (this.panel) {
            const config = this.configManager.getConfiguration();
            this.panel.webview.postMessage({
                type: 'updateConfiguration',
                data: config
            });
        }
    }
    async saveConfiguration(config) {
        try {
            await this.configManager.updateConfiguration(config);
            vscode.window.showInformationMessage('Configuration saved successfully');
            this.updateContent();
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to save configuration: ${error}`);
        }
    }
    async testEndpoint(endpoint) {
        try {
            const errors = this.configManager.validateConfiguration({ endpoint, retryCount: 3, retryDelay: 1000, enabled: true, timeout: 30000 });
            if (errors.length === 0) {
                vscode.window.showInformationMessage('Vibe Process Bar API endpoint is valid');
            }
            else {
                vscode.window.showErrorMessage(`Configuration errors: ${errors.join(', ')}`);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to validate endpoint: ${error}`);
        }
    }
    async resetConfiguration() {
        const result = await vscode.window.showWarningMessage('Are you sure you want to reset all configuration to default values?', { modal: true }, 'Reset', 'Cancel');
        if (result === 'Reset') {
            await this.configManager.updateConfiguration({
                endpoint: 'http://localhost:31415',
                apiKey: '',
                retryCount: 3,
                retryDelay: 1000,
                enabled: true,
                timeout: 30000
            });
            vscode.window.showInformationMessage('Configuration reset to Vibe Process Bar defaults');
            this.updateContent();
        }
    }
    getHtml(webview) {
        const nonce = this.getNonce();
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vibe Process Bar Configuration</title>
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
        .btn.primary {
            background: var(--vscode-button-primaryBackground);
            border-color: var(--vscode-button-primaryBorder);
        }
        .btn.primary:hover {
            background: var(--vscode-button-primaryHoverBackground);
        }
        .btn.danger {
            background: var(--vscode-button-dangerBackground);
            border-color: var(--vscode-button-dangerBorder);
        }
        .btn.danger:hover {
            background: var(--vscode-button-dangerHoverBackground);
        }
        .form-group {
            margin-bottom: 20px;
        }
        .label {
            display: block;
            font-size: 14px;
            font-weight: 500;
            margin-bottom: 6px;
            color: var(--vscode-foreground);
        }
        .input, .textarea, .select {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-size: 14px;
            box-sizing: border-box;
        }
        .textarea {
            resize: vertical;
            min-height: 80px;
        }
        .input:focus, .textarea:focus, .select:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
        }
        .checkbox-group {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .checkbox {
            width: 16px;
            height: 16px;
        }
        .section {
            margin-bottom: 30px;
            padding: 20px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            background: var(--vscode-editor-background);
        }
        .section-title {
            font-size: 16px;
            font-weight: 600;
            margin: 0 0 16px 0;
            color: var(--vscode-foreground);
        }
        .description {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-top: 4px;
        }
        .form-row {
            display: flex;
            gap: 16px;
        }
        .form-col {
            flex: 1;
        }
        .test-result {
            margin-top: 8px;
            padding: 8px;
            border-radius: 4px;
            font-size: 12px;
        }
        .test-result.success {
            background: var(--vscode-button-successBackground);
            color: var(--vscode-button-successForeground);
        }
        .test-result.error {
            background: var(--vscode-button-dangerBackground);
            color: var(--vscode-button-dangerForeground);
        }
        .info-box {
            background: var(--vscode-button-background);
            border: 1px solid var(--vscode-button-border);
            padding: 12px;
            border-radius: 6px;
            margin-bottom: 16px;
        }
        .info-title {
            font-weight: 600;
            margin-bottom: 8px;
        }
        .api-example {
            font-family: 'Courier New', monospace;
            background: var(--vscode-editor-background);
            padding: 8px;
            border-radius: 4px;
            font-size: 12px;
            margin-top: 8px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1 class="title">Vibe Process Bar Configuration</h1>
        <div class="actions">
            <button class="btn" onclick="resetConfiguration()">Reset to Defaults</button>
            <button class="btn primary" onclick="saveConfiguration()">Save Configuration</button>
        </div>
    </div>

    <div class="info-box">
        <div class="info-title">🚀 Vibe Process Bar Integration</div>
        <p>This extension integrates with Vibe Process Bar to display AI programming status in a floating window.</p>
        <p><strong>Default Endpoint:</strong> http://localhost:31415</p>
    </div>

    <div class="section">
        <h2 class="section-title">Vibe Process Bar API</h2>
        <div class="form-group">
            <label class="label" for="endpoint">API Base URL</label>
            <input type="url" id="endpoint" class="input" placeholder="http://localhost:31415">
            <div class="description">Vibe Process Bar API base URL (should end with :31415)</div>
            <button class="btn" onclick="testEndpoint()" style="margin-top: 8px;">Test API Connection</button>
            <div id="endpoint-test-result"></div>
        </div>
        
        <div class="form-group">
            <label class="label" for="apiKey">API Key (Optional)</label>
            <input type="password" id="apiKey" class="input" placeholder="Enter your API key">
            <div class="description">API key for authentication (will be sent as Bearer token)</div>
        </div>
    </div>

    <div class="section">
        <h2 class="section-title">Transmission Settings</h2>
        <div class="form-row">
            <div class="form-col">
                <div class="form-group">
                    <label class="label" for="retryCount">Retry Count</label>
                    <input type="number" id="retryCount" class="input" min="0" max="10" placeholder="3">
                    <div class="description">Number of retry attempts for failed transmissions</div>
                </div>
            </div>
            <div class="form-col">
                <div class="form-group">
                    <label class="label" for="retryDelay">Retry Delay (ms)</label>
                    <input type="number" id="retryDelay" class="input" min="100" step="100" placeholder="1000">
                    <div class="description">Delay between retry attempts in milliseconds</div>
                </div>
            </div>
        </div>
        
        <div class="form-group">
            <label class="label" for="timeout">Request Timeout (ms)</label>
            <input type="number" id="timeout" class="input" min="1000" step="1000" placeholder="30000">
            <div class="description">HTTP request timeout in milliseconds</div>
        </div>
    </div>

    <div class="section">
        <h2 class="section-title">General Settings</h2>
        <div class="form-group">
            <div class="checkbox-group">
                <input type="checkbox" id="enabled" class="checkbox">
                <label class="label" for="enabled">Enable Vibe Process Bar Integration</label>
            </div>
            <div class="description">When disabled, status information will not be sent to Vibe Process Bar</div>
        </div>
    </div>

    <div class="section">
        <h2 class="section-title">API Endpoints Used</h2>
        <div class="api-example">
            <strong>POST</strong> /api/task/start - Start new task<br>
            <strong>POST</strong> /api/task/progress - Update task progress<br>
            <strong>POST</strong> /api/task/token - Update token count<br>
            <strong>POST</strong> /api/task/complete - Complete task<br>
            <strong>POST</strong> /api/task/error - Set error status
        </div>
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        let currentConfig = {};

        function saveConfiguration() {
            const config = {
                endpoint: document.getElementById('endpoint').value,
                apiKey: document.getElementById('apiKey').value,
                retryCount: parseInt(document.getElementById('retryCount').value) || 3,
                retryDelay: parseInt(document.getElementById('retryDelay').value) || 1000,
                timeout: parseInt(document.getElementById('timeout').value) || 30000,
                enabled: document.getElementById('enabled').checked
            };
            
            vscode.postMessage({
                type: 'saveConfiguration',
                data: config
            });
        }

        function testEndpoint() {
            const endpoint = document.getElementById('endpoint').value;
            if (!endpoint) {
                showTestResult('Please enter an API URL', false);
                return;
            }
            
            vscode.postMessage({
                type: 'testEndpoint',
                endpoint: endpoint
            });
        }

        function resetConfiguration() {
            vscode.postMessage({
                type: 'resetConfiguration'
            });
        }

        function showTestResult(message, success) {
            const resultDiv = document.getElementById('endpoint-test-result');
            resultDiv.innerHTML = \`<div class="test-result \${success ? 'success' : 'error'}">\${message}</div>\`;
            setTimeout(() => {
                resultDiv.innerHTML = '';
            }, 5000);
        }

        function updateForm(config) {
            currentConfig = config;
            document.getElementById('endpoint').value = config.endpoint || '';
            document.getElementById('apiKey').value = config.apiKey || '';
            document.getElementById('retryCount').value = config.retryCount || 3;
            document.getElementById('retryDelay').value = config.retryDelay || 1000;
            document.getElementById('timeout').value = config.timeout || 30000;
            document.getElementById('enabled').checked = config.enabled !== false;
        }

        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.type) {
                case 'updateConfiguration':
                    updateForm(message.data);
                    break;
            }
        });
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
exports.ConfigurationPanel = ConfigurationPanel;
ConfigurationPanel.viewType = 'aiStatusTransmission.config';
//# sourceMappingURL=configurationPanel.js.map