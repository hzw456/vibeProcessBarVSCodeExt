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
exports.ConfigurationManager = void 0;
const vscode = __importStar(require("vscode"));
class ConfigurationManager {
    constructor() {
        this.disposables = [];
    }
    getConfiguration() {
        const config = vscode.workspace.getConfiguration(ConfigurationManager.CONFIG_SECTION);
        return {
            endpoint: config.get('endpoint', 'http://localhost:31415'),
            apiKey: config.get('apiKey', ''),
            retryCount: config.get('retryCount', 3),
            retryDelay: config.get('retryDelay', 1000),
            enabled: config.get('enabled', true),
            timeout: config.get('timeout', 30000)
        };
    }
    getEndpoint() {
        const config = vscode.workspace.getConfiguration(ConfigurationManager.CONFIG_SECTION);
        return config.get('endpoint', 'http://localhost:31415');
    }
    getApiKey() {
        const config = vscode.workspace.getConfiguration(ConfigurationManager.CONFIG_SECTION);
        return config.get('apiKey', '');
    }
    getRetryCount() {
        const config = vscode.workspace.getConfiguration(ConfigurationManager.CONFIG_SECTION);
        return config.get('retryCount', 3);
    }
    getRetryDelay() {
        const config = vscode.workspace.getConfiguration(ConfigurationManager.CONFIG_SECTION);
        return config.get('retryDelay', 1000);
    }
    isEnabled() {
        const config = vscode.workspace.getConfiguration(ConfigurationManager.CONFIG_SECTION);
        return config.get('enabled', true);
    }
    getTimeout() {
        const config = vscode.workspace.getConfiguration(ConfigurationManager.CONFIG_SECTION);
        return config.get('timeout', 30000);
    }
    async updateConfiguration(updates) {
        const config = vscode.workspace.getConfiguration(ConfigurationManager.CONFIG_SECTION);
        for (const [key, value] of Object.entries(updates)) {
            if (value !== undefined) {
                await config.update(key, value, vscode.ConfigurationTarget.Global);
            }
        }
    }
    onConfigurationChanged(callback) {
        const disposable = vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration(ConfigurationManager.CONFIG_SECTION)) {
                callback(this.getConfiguration());
            }
        });
        this.disposables.push(disposable);
        return disposable;
    }
    validateConfiguration(config) {
        const errors = [];
        if (!config.endpoint) {
            errors.push('Endpoint URL is required');
        }
        else {
            try {
                new URL(config.endpoint);
            }
            catch {
                errors.push('Endpoint URL is not valid');
            }
        }
        if (config.retryCount < 0) {
            errors.push('Retry count must be non-negative');
        }
        if (config.retryDelay < 0) {
            errors.push('Retry delay must be non-negative');
        }
        if (config.timeout < 1000) {
            errors.push('Timeout should be at least 1000ms');
        }
        return errors;
    }
    dispose() {
        this.disposables.forEach(disposable => disposable.dispose());
        this.disposables = [];
    }
}
exports.ConfigurationManager = ConfigurationManager;
ConfigurationManager.CONFIG_SECTION = 'aiStatusTransmission';
//# sourceMappingURL=configurationManager.js.map