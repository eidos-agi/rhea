#!/bin/bash

# A script to run the Socratic Factory example.
# Note: Requires rhea-cli to be linked and model keys to be set.

REQ_PATH="examples/01-socratic-factory-cache/requirement.txt"
OUTPUT_DIR="examples/01-socratic-factory-cache/output"

if [ ! -f "$REQ_PATH" ]; then
  echo "❌ Error: requirement.txt not found at $REQ_PATH"
  exit 1
fi

echo "🚀 Starting Rhea Socratic Factory..."
echo "Requirement: High-Precision Persistent LRU Cache"
echo "------------------------------------------------"

# We run the code command. Note that Rhea will output the files to the console
# or to multiple files if the factory identifies them.
rhea-cli code "$(cat $REQ_PATH)"
