#!/bin/bash
# Kiro Hook: Agent Start - 当Kiro开始执行时通知Vibe Process Bar

VIBE_API="http://localhost:31415"
PROJECT_PATH="$(pwd)"
IDE="kiro"

if [ -n "$PROJECT_PATH" ]; then
  curl -s -X POST "$VIBE_API/api/task/update_state_by_path" \
    -H "Content-Type: application/json" \
    -d "{\"project_path\": \"$PROJECT_PATH\", \"ide\": \"$IDE\", \"status\": \"running\", \"source\": \"hook\"}" > /dev/null 2>&1
fi
