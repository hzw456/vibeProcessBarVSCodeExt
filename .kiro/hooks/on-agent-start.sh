#!/bin/bash
# Kiro Hook: Agent Start - 当Kiro开始执行时通知Vibe Process Bar

TASK_ID="kiro_$(date +%s)_$$"

curl -s -X POST "http://localhost:31415/api/task/start" \
  -H "Content-Type: application/json" \
  -d "{
    \"task_id\": \"${TASK_ID}\",
    \"name\": \"Kiro AI Task\",
    \"ide\": \"kiro\",
    \"window_title\": \"Kiro - AI Assistant\"
  }" > /dev/null 2>&1

# 保存task_id供后续使用
echo "$TASK_ID" > /tmp/kiro_current_task_id
