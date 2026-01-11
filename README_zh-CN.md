# Vibe Process Bar VS Code Extension

<p align="center">
  <strong>智能检测 AI 编程活动，自动同步到 Vibe Process Bar</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/VS%20Code-1.74%2B-blue" alt="VS Code Version">
  <img src="https://img.shields.io/badge/Node.js-16%2B-green" alt="Node.js Version">
  <img src="https://img.shields.io/badge/license-MIT-orange" alt="License">
</p>

---

## 这是什么？

这是 [Vibe Process Bar](https://github.com/hzw456/vibeProcessBar) 的官方 VS Code 扩展。

当你在 VS Code 中使用 AI 编程助手（如 GitHub Copilot、Cline 等）时，扩展会自动检测 AI 活动并将状态同步到 Vibe Process Bar 悬浮窗口，让你随时了解 AI 的工作进度。

---

## ✨ 核心功能

### 🖥️ 基础核心能力

扩展的核心功能是管理窗口，聚焦检测和心跳上报。

### 🤖 AI 活动检测

扩展通过一些维度分析识别 AI 编程活动，但这个检测可能不准确


### 📡 自动状态同步

- 任务开始时自动发送 `start` 通知
- 任务完成时自动发送 `complete` 通知
- 包含任务 ID、IDE 信息、窗口标题等元数据

---

## 🚀 安装

### 方式一：GitHub Release

1. 访问 [Releases](https://github.com/hzw456/vibeProcessBarVSCodeExt/releases) 页面下载最新版本的 `.vsix` 文件
2. 在 VS Code 扩展面板中点击 "..." 菜单
3. 选择 "从 VSIX 安装..."

### 方式二：从 VSIX 安装

```bash
# 克隆项目
git clone https://github.com/hzw456/vibeProcessBarVSCodeExt.git
cd vibeProcessBarVSCodeExt

# 安装依赖并编译
npm install
npm run compile

# 打包 VSIX
npm run package

# 在 VS Code 中安装
# 扩展面板 → ··· → 从 VSIX 安装
```

---

## ⚙️ 配置

打开 VS Code 设置（`Cmd/Ctrl + ,`），搜索 **"Vibe Process Bar"**：

| 配置项 | 默认值 | 说明 |
|:---|:---|:---|
| `vibeProcessBar.endpoint` | `http://localhost:31415` | Vibe Process Bar API 地址 |
| `vibeProcessBar.charThreshold` | `200` | 字符变化阈值 |
| `vibeProcessBar.idleTimeout` | `5000` | 空闲超时时间（毫秒） |

---

## 📖 使用方法

### 自动模式（推荐）

安装后无需任何操作，扩展会自动：

1. **监控窗口焦点** — 切换窗口时进入待命状态
2. **检测 AI 活动** — 识别快速代码生成特征
3. **同步状态** — 自动通知 Vibe Process Bar

### 手动命令

按 `Cmd/Ctrl + Shift + P` 打开命令面板：

| 命令 | 功能 |
|:---|:---|
| `Vibe Process Bar: Start` | 查看启动状态 |
| `Vibe Process Bar: Check Status` | 查看当前检测器状态 |

---

## 🔗 相关项目

- [Vibe Process Bar](https://github.com/hzw456/vibeProcessBar) — 主应用程序

---

## 📄 许可证

MIT License © 2024

---

<p align="center">
  <strong>让 AI 编程助手的工作状态一目了然 ✨</strong>
</p>
