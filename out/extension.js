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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const aiActivityDetector_1 = require("./managers/aiActivityDetector");
let detector = null;
function activate(context) {
    console.log('AI Status Transmission extension activated');
    // 创建AI活动检测器
    detector = new aiActivityDetector_1.AIActivityDetector();
    context.subscriptions.push(detector);
    // 注册命令：手动开始任务
    context.subscriptions.push(vscode.commands.registerCommand('aiStatusTransmission.start', () => {
        vscode.window.showInformationMessage('AI Status: Manual start not needed - auto detection enabled');
    }));
    // 注册命令：查看状态
    context.subscriptions.push(vscode.commands.registerCommand('aiStatusTransmission.status', () => {
        vscode.window.showInformationMessage('AI Activity Detector is running');
    }));
    vscode.window.showInformationMessage('AI Status Transmission: Auto-detection enabled');
}
function deactivate() {
    if (detector) {
        detector.dispose();
        detector = null;
    }
    console.log('AI Status Transmission extension deactivated');
}
//# sourceMappingURL=extension.js.map