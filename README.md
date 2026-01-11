# Vibe Process Bar VS Code Extension

<p align="center">
  <strong>Intelligently detect AI coding activity, automatically sync to Vibe Process Bar</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/VS%20Code-1.74%2B-blue" alt="VS Code Version">
  <img src="https://img.shields.io/badge/Node.js-16%2B-green" alt="Node.js Version">
  <img src="https://img.shields.io/badge/license-MIT-orange" alt="License">
</p>

---

## What is this?

This is the official VS Code extension for [Vibe Process Bar](https://github.com/hzw456/vibeProcessBar).

When you use AI coding assistants (like GitHub Copilot, Cline, etc.) in VS Code, this extension automatically detects AI activity and syncs the status to the Vibe Process Bar floating window, keeping you informed of the AI's progress.

---

## ✨ Core Features

### 🤖 Smart AI Activity Detection

The extension automatically identifies AI coding activity through multi-dimensional analysis:

| Detection Dimension | Trigger Condition |
|:---|:---|
| 📝 Character Change | ≥ 200 characters modified within 3s |
| 🔄 Change Frequency | At least 3 document changes within 3s |
| 📁 Multi-file Operation | ≥ 2 files modified within 5s |

**Fulfilling any two conditions triggers detection of AI activity.**

### 🎯 Smart Tri-state Switching

```
┌─────────┐    Focus Lost     ┌─────────┐     AI Activity     ┌─────────┐
│  IDLE   │ ────────────▶ │  ARMED  │ ─────────────────▶ │ RUNNING │
│         │               │         │                    │         │
└─────────┘               └─────────┘                    └─────────┘
     ▲                         │                              │
     │                         │ Focus Gained                 │ 5s Inactive
     │                         ▼                              │
     └─────────────────────────────────────────────────────────┘
```

### 📡 Auto Status Sync

- Automatically sends `start` notification when task begins
- Automatically sends `complete` notification when task ends
- Includes metadata like Task ID, IDE info, window title, etc.

---

## 🚀 Installation

### Method 1: VS Code Marketplace

1. Open VS Code
2. Press `Cmd/Ctrl + Shift + X` to open Extensions panel
3. Search for **"Vibe Process Bar"**
4. Click Install

### Method 2: Install from VSIX

```bash
# Clone the repository
git clone https://github.com/hzw456/vibeProcessBarVSCodeExt.git
cd vibeProcessBarVSCodeExt

# Install dependencies and compile
npm install
npm run compile

# Package VSIX
npm run package

# Install in VS Code
# Extensions panel → ··· → Install from VSIX
```

---

## ⚙️ Configuration

Open VS Code Settings (`Cmd/Ctrl + ,`), search for **"Vibe Process Bar"**:

| Setting | Default | Description |
|:---|:---|:---|
| `vibeProcessBar.endpoint` | `http://localhost:31415` | Vibe Process Bar API Endpoint |
| `vibeProcessBar.charThreshold` | `200` | Character change threshold |
| `vibeProcessBar.idleTimeout` | `5000` | Idle timeout (ms) |

---

## 📖 Usage

### Auto Mode (Recommended)

Once installed, no action is needed. The extension will automatically:

1. **Monitor Window Focus** — Enter Armed state when switching windows
2. **Detect AI Activity** — Identify rapid code generation patterns
3. **Sync Status** — Automatically notify Vibe Process Bar

### Manual Commands

Press `Cmd/Ctrl + Shift + P` to open Command Palette:

| Command | Function |
|:---|:---|
| `Vibe Process Bar: Start` | Check start status |
| `Vibe Process Bar: Check Status` | Check current detector status |

---

## 🔗 Related Projects

- [Vibe Process Bar](https://github.com/hzw456/vibeProcessBar) — Main Application

---

## 📄 License

MIT License © 2024

---

<p align="center">
  <strong>Visualize AI Coding Agent's Workflow at a Glance ✨</strong>
</p>
