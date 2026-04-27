#!/bin/bash

# Mock model reading from STDIN for Rhea's "Socratic Factory".

PROMPT=$(cat)

# Use case statement for robust matching
case "$PROMPT" in
  *"PLANNER ARCHITECT"*)
    echo "I propose a single task to create test.ts."
    ;;
  *"PLANNER AUDITOR"*)
    echo "The plan seems fine, but ensure the file path is correct."
    ;;
  *"PLANNER INTEGRATOR"*)
    echo '{ "tasks": [ { "id": "task-1", "file": "test.ts", "action": "create", "description": "Mock task", "requirement": "Implement a greet function", "context_files": [] } ] }'
    ;;
  *"ROLE: ARCHITECT"*)
    echo "export function greet(name: string) { return 'Hi'; }"
    ;;
  *"ROLE: AUDITOR"*)
    echo "The implementation is too simple. Use a template string."
    ;;
  *"ROLE: INTEGRATOR"*)
    echo 'export function greet(name: string) { return `Hello, ${name}!`; }'
    ;;
  *"REFINERY ARCHITECT"*)
    echo "The changes look consistent."
    ;;
  *"REFINERY AUDITOR"*)
    echo "No inconsistencies found."
    ;;
  *"REFINERY INTEGRATOR"*)
    echo "APPROVED"
    ;;
  *)
    echo "DEBUG: No match found in mock-model.sh. Prompt starts with: ${PROMPT:0:50}..." >&2
    echo "Mock response for unknown role in prompt."
    ;;
esac
