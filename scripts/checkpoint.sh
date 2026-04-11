#!/bin/bash
# ============================================================================
# checkpoint.sh
# Create or list recoverable checkpoints before significant changes.
# ============================================================================

# Exit immediately if a command exits with a non-zero status.
# Also exit if any command in a pipeline fails.
set -euo pipefail

CHECKPOINT_DIR=".kimi/checkpoints"

usage() {
  echo "Usage:"
  echo "  $0 create \"[description]\"     Create a new checkpoint"
  echo "  $0 list                       List all checkpoints"
  echo "  $0 restore [name]             Restore from a checkpoint"
  exit 1
}

mkdir -p "$CHECKPOINT_DIR"

if [ $# -lt 1 ]; then
  usage
fi

COMMAND=$1

if [ "$COMMAND" = "create" ]; then
  DESC="${2:-checkpoint}"
  TIMESTAMP=$(date +%Y%m%d-%H%M%S)
  NAME="${TIMESTAMP}-${DESC// /-}"
  TARGET="$CHECKPOINT_DIR/$NAME"

  echo "Creating checkpoint: $NAME"
  mkdir -p "$TARGET"

  # Copy tracked files (excluding build artifacts and git internals)
  if [ -d .git ]; then
    # Pipefail ensures if git ls-files fails, the whole script exits.
    git ls-files | while read -r file; do
      if [ -f "$file" ]; then
        mkdir -p "$TARGET/$(dirname "$file")"
        cp "$file" "$TARGET/$file"
      fi
    done
  else
    # Fallback: copy key files manually (macOS-compatible)
    find . \
      -not -path './.git/*' \
      -not -path './node_modules/*' \
      -not -path './.kimi/checkpoints/*' \
      -not -path './dist/*' \
      -not -path './build/*' \
      -type f | while read -r file; do
        dest="$TARGET/$file"
        mkdir -p "$(dirname "$dest")"
        cp "$file" "$dest"
      done
  fi

  echo "$NAME" >> "$CHECKPOINT_DIR/.index"
  echo "✅ Checkpoint created: $NAME"
  exit 0

elif [ "$COMMAND" = "list" ]; then
  if [ ! -f "$CHECKPOINT_DIR/.index" ]; then
    echo "No checkpoints found."
    exit 0
  fi

  echo "Available checkpoints:"
  echo ""
  # tac reverses lines; fallback to tail -r for macOS if tac is unavailable.
  if command -v tac > /dev/null 2>&1; then
    tac "$CHECKPOINT_DIR/.index" | nl
  else
    tail -r "$CHECKPOINT_DIR/.index" | nl
  fi
  exit 0

elif [ "$COMMAND" = "restore" ]; then
  if [ -z "$2" ]; then
    echo "Error: checkpoint name required."
    usage
  fi

  NAME=$2
  TARGET="$CHECKPOINT_DIR/$NAME"

  if [ ! -d "$TARGET" ]; then
    echo "❌ Checkpoint not found: $NAME"
    exit 1
  fi

  echo "Restoring from checkpoint: $NAME"
  # Copy all files from the checkpoint back to the project root.
  # The trailing slash on TARGET ensures cp copies contents, not the directory itself.
  cp -r "$TARGET/"* .
  echo "✅ Restored from $NAME"
  exit 0

else
  usage
fi
