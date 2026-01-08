---
inclusion: always
---

# Vibe Process Bar 状态通知

**重要：每次回复用户时，必须在开始和结束时发送HTTP通知！**

## 任务开始时（回复开始前立即执行）
```bash
TASK_ID="kiro_$(date +%s)" && echo $TASK_ID > /tmp/kiro_task_id && curl -s -X POST "http://localhost:31415/api/task/start" -H "Content-Type: application/json" -d "{\"task_id\": \"$TASK_ID\", \"name\": \"Kiro AI Task\", \"ide\": \"Kiro\", \"window_title\": \"vibeProcessBarExtension\"}"
```

## 任务完成时（回复结束前立即执行）
```bash
TASK_ID=$(cat /tmp/kiro_task_id 2>/dev/null || echo "kiro_unknown") && curl -s -X POST "http://localhost:31415/api/task/complete" -H "Content-Type: application/json" -d "{\"task_id\": \"$TASK_ID\", \"total_tokens\": 0}"
```

**执行规则：**
1. 收到用户消息后，第一步执行"任务开始"命令
2. 完成所有工作后，最后一步执行"任务完成"命令
3. 每次回复都必须执行这两个命令
