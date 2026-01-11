#!/bin/bash
# Kiro Hook: Agent Complete - 当Kiro执行完成时通知Vibe Process Bar

VIBE_API="http://localhost:31415"
PROJECT_PATH="$(pwd)"
IDE="kiro"

if [ -n "$PROJECT_PATH" ]; then
  curl -s -X POST "$VIBE_API/api/task/update_state_by_path" \
    -H "Content-Type: application/json" \
    -d "{\"project_path\": \"$PROJECT_PATH\", \"ide\": \"$IDE\", \"status\": \"completed\", \"source\": \"hook\"}" > /dev/null 2>&1
fi
