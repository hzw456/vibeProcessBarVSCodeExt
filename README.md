# Vibe Process Bar VS Code Extension

自动检测AI编程活动并通过HTTP协议通知Vibe Process Bar的VS Code扩展。

## 项目结构

本项目包含两个组件：

### 1. VS Code扩展 (`ai-status-transmission`)
自动检测VS Code中的AI编程活动并通知Vibe Process Bar。

### 2. Kiro监控脚本 (`kiro-monitor.js`)
独立的Node.js脚本，监控Kiro的日志文件，自动向Vibe Process Bar发送状态通知。

---

## 功能特性

### 🤖 智能AI活动检测（VS Code扩展）
- **窗口焦点检测**：监控VS Code窗口焦点变化
- **代码变化分析**：实时分析文档修改特征
- **智能状态机**：IDLE → ARMED → RUNNING 三状态转换

### 📝 Kiro日志监控（独立脚本）
- **自动日志检测**：监控Kiro的日志目录变化
- **AI活动识别**：检测kiroAgent、anthropic、claude等关键词
- **自动状态同步**：无需配置，自动同步Kiro活动状态

### 🔄 状态机工作流程
- **IDLE**：窗口有焦点，用户正常操作
- **ARMED**：窗口失去焦点，待触发状态
- **RUNNING**：检测到AI活动，任务运行中

### 🎯 AI活动识别条件（VS Code扩展）
扩展通过以下条件识别AI编程活动：
- **字符阈值**：3秒内累计修改字符数 ≥ 200
- **多次变化**：3秒内至少3次文档变化
- **多文件操作**：5秒内修改文件数 ≥ 2
- **满足条件**：满足任意两个条件即认定为AI活动

### 📡 HTTP状态传输
- 自动发送任务开始/完成状态到Vibe Process Bar
- 支持自定义API端点配置
- 包含任务ID、IDE信息、窗口标题等数据

---

## 安装

### VS Code扩展

#### 从源码安装
```bash
# 克隆项目
git clone https://github.com/hzw456/vibeProcessBarVSCodeExt.git
cd vibeProcessBarVSCodeExt

# 安装依赖
npm install

# 编译TypeScript
npm run compile

# 打包VSIX文件
npm run package
```

#### 开发环境
```bash
# 监听模式编译
npm run watch
```

### Kiro监控脚本

```bash
# 直接运行（需要先安装依赖）
node kiro-monitor.js

# 或添加执行权限后直接运行
chmod +x kiro-monitor.js
./kiro-monitor.js
```

---

## 配置

### VS Code扩展配置

扩展提供以下可配置选项：

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `aiStatusTransmission.endpoint` | string | `http://localhost:31415` | Vibe Process Bar API端点 |
| `aiStatusTransmission.charThreshold` | number | `200` | 字符变化阈值（识别AI活动） |
| `aiStatusTransmission.idleTimeout` | number | `5000` | 空闲超时时间（毫秒） |

### 配置方法
1. 打开VS Code设置 (`Cmd/Ctrl + ,`)
2. 搜索 "AI Status Transmission"
3. 修改相应的配置项

### Kiro监控脚本配置

脚本支持以下环境变量：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `VIBE_API` | `http://localhost:31415` | Vibe Process Bar API端点 |
| `POLL_INTERVAL` | `1000` | 日志检查间隔（毫秒） |

---

## 使用

### VS Code扩展

#### 自动模式（推荐）
扩展激活后自动运行，无需手动操作：
- 窗口失去焦点时进入ARMED状态
- 检测到AI活动特征时自动发送开始通知
- 5秒无活动后自动发送完成通知

#### 手动命令
通过命令面板执行以下操作：
- `AI Status: Start` - 查看开始状态信息
- `AI Status: Check Status` - 查看当前检测器状态

### Kiro监控脚本

```bash
# 启动监控
node kiro-monitor.js

# 后台运行
nohup node kiro-monitor.js > kiro-monitor.log 2>&1 &
```

监控脚本会自动：
1. 检测Kiro的最新日志目录
2. 监听exthost.log文件变化
3. 识别AI活动关键词（kiroAgent、anthropic、claude等）
4. 自动发送开始/完成任务通知

---

## API接口

扩展会自动调用Vibe Process Bar API：

### 开始任务
```json
POST /api/task/start
{
  "task_id": "kiro_1703774400000",
  "name": "Kiro AI Task",
  "ide": "Kiro",
  "window_title": "project-name"
}
```

### 完成任务
```json
POST /api/task/complete
{
  "task_id": "kiro_1703774400000",
  "total_tokens": 0
}
```

---

## 工作原理

### VS Code扩展检测流程
1. **焦点监控**：监听VS Code窗口焦点变化
2. **文档监听**：实时捕获文档内容变化
3. **特征分析**：分析变化模式识别AI活动
4. **状态转换**：根据检测结果更新状态机
5. **HTTP传输**：通过API通知Vibe Process Bar

### Kiro日志监控流程
1. **定位日志**：查找Kiro最新日志目录
2. **查找exthost**：定位exthost.log文件
3. **监控变化**：定期检查日志文件大小变化
4. **内容分析**：读取新增内容并检测AI关键词
5. **状态同步**：自动发送任务状态到Vibe Process Bar

### 窗口标题
VS Code扩展使用工作区文件夹名称作为窗口标题，用于任务标识。

---

## 兼容性

- **VS Code版本**：≥ 1.74.0
- **Node.js版本**：≥ 16.x
- **Kiro版本**：支持Kiro日志格式
- **操作系统**：跨平台支持（Windows、macOS、Linux）

---

## 故障排除

### 常见问题

**Q: VS Code扩展没有自动检测到AI活动？**
A: 检查配置项中的字符阈值和时间窗口设置，可能需要根据您的编程习惯调整。

**Q: HTTP请求失败？**
A: 确认Vibe Process Bar服务正在运行，检查endpoint配置是否正确。

**Q: VS Code扩展不激活？**
A: 确保VS Code版本≥1.74.0，检查扩展是否正确安装。

**Q: Kiro监控脚本找不到日志？**
A: 确认Kiro已启动并生成了日志文件，检查日志目录权限。

### 日志查看
- VS Code扩展：在VS Code开发者工具的控制台输出调试信息
- Kiro监控脚本：输出到标准输出，可重定向到日志文件

---

## 开发

### 项目结构
```
vibeProcessBarVSCodeExt/
├── src/
│   ├── extension.ts              # VS Code扩展入口文件
│   └── managers/
│       └── aiActivityDetector.ts # AI活动检测器
├── kiro-monitor.js               # Kiro日志监控脚本
├── package.json                  # 扩展配置
└── tsconfig.json                 # TypeScript配置
```

### 技术栈
- **TypeScript**：主要开发语言
- **VS Code Extension API**：扩展框架
- **Node.js HTTP**：API通信
- **VS Code事件系统**：监听和响应

---

## 许可证

MIT License

## 贡献

欢迎提交Issues和Pull Requests来改进这个扩展。
