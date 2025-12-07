#!/usr/bin/env bash
set -euo pipefail

echo "🔎 Checking for maintenance plan stash..."
if git stash list | grep -q "systemcraft-maintenance-file-stash"; then
  echo "✅ Found maintenance stash, popping it back onto the tree"
  git stash pop
else
  echo "ℹ️ No maintenance stash found, continuing without pop"
fi

echo "🦋 Running changeset version..."
pnpm changeset version