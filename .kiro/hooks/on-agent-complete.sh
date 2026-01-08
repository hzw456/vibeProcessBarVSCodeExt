#!/bin/bash
# Kiro Hook: Agent Complete - 当Kiro完成执行时通知Vibe Process Bar

TASK_ID=$(cat /tmp/kiro_current_task_id 2>/dev/null || echo "kiro_unknown")

curl -s -X POST "http://localhost:31415/api/task/complete" \
  -H "Content-Type: application/json" \
  -d "{
    \"task_id\": \"${TASK_ID}\",
    \"total_tokens\": 0
  }" > /dev/null 2>&1

rm -f /tmp/kiro_current_task_id
