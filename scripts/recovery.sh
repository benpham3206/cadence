#!/bin/bash
# ============================================================================
# recovery.sh
# Post-crash state restoration workflow.
# Run this on startup if .recovery_needed flag is present.
# ============================================================================

# Exit immediately if a command exits with a non-zero status.
# Also exit if any command in a pipeline fails.
set -euo pipefail

RECOVERY_FLAG=".recovery_needed"
BACKUP_DIR=".kimi/session_backup"

echo "========================================"
echo "  Recovery Mode"
echo "========================================"
echo ""

if [ ! -f "$RECOVERY_FLAG" ]; then
  echo "✅ No recovery flag found. System is clean."
  exit 0
fi

echo "🚨 Recovery flag detected ($RECOVERY_FLAG)"

# Step 1: List available backups
if [ ! -d "$BACKUP_DIR" ] || [ -z "$(ls -A "$BACKUP_DIR" 2>/dev/null)" ]; then
  echo "⚠️  No session backups found in $BACKUP_DIR"
  echo "Clearing recovery flag. Please verify STATE.md and CONTEXT_LOG.md manually."
  rm -f "$RECOVERY_FLAG"
  exit 0
fi

LATEST_BACKUP=$(ls -1t "$BACKUP_DIR" | head -n 1)
echo "📦 Latest backup: $LATEST_BACKUP"

# Step 2: Inspect current state vs backup
echo ""
echo "Current state files:"
for file in STATE.md CONTEXT_LOG.md .kimi/context_log.tail; do
  if [ -f "$file" ]; then
    echo "  ✅ $file"
  else
    echo "  ❌ $file MISSING"
  fi
done

echo ""
echo "Backup contains:"
find "$BACKUP_DIR/$LATEST_BACKUP" -maxdepth 2 -type f | sed "s|$BACKUP_DIR/$LATEST_BACKUP/|  |" || true

# Step 3: Auto-restore or prompt
RESTORED=false
if [ "${RECOVERY_AUTO_RESTORE:-false}" = "true" ]; then
  echo ""
  echo "AUTO_RESTORE enabled. Restoring from $LATEST_BACKUP..."
  # Copy contents of checkpoint back to project root.
  cp -r "$BACKUP_DIR/$LATEST_BACKUP/"* .
  echo "✅ Restored from $LATEST_BACKUP"
  RESTORED=true
else
  echo ""
  echo "To restore automatically, set RECOVERY_AUTO_RESTORE=true"
  echo "Manual restore command:"
  echo "  cp -r $BACKUP_DIR/$LATEST_BACKUP/* ."
fi

# Step 4: Read STATE.md to identify interrupted tasks
echo ""
if [ -f "STATE.md" ]; then
  echo "📋 Interrupted tasks (from STATE.md):"
  grep -A 20 "## " STATE.md | head -n 30 || true
else
  echo "⚠️  STATE.md not found — cannot identify interrupted tasks"
fi

# Step 5: Clear flag (non-interactive safe)
echo ""
if [ "$RESTORED" = "true" ]; then
  CONFIRM="y"
else
  # In non-interactive environments, default to y without hanging.
  if [ ! -t 0 ]; then
    CONFIRM="y"
  else
    # read may fail on EOF; default to "y" if it does.
    read -r -p "Clear recovery flag? [Y/n] " CONFIRM 2>/dev/null || CONFIRM="y"
  fi
fi

if [ "$CONFIRM" = "y" ] || [ "$CONFIRM" = "Y" ] || [ -z "$CONFIRM" ]; then
  rm -f "$RECOVERY_FLAG"
  echo "✅ Recovery flag cleared"
fi

echo ""
echo "========================================"
echo "  Recovery complete"
echo "========================================"
echo ""
echo "Next steps:"
echo "  1. Review STATE.md for interrupted tasks"
echo "  2. Review CONTEXT_LOG.md tail pointer"
echo "  3. Resume work or report status to user"
echo ""

exit 0
