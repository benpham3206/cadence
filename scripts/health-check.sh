#!/bin/bash
# ============================================================================
# health-check.sh
# Run this before any planning or implementation work on Cadence.
# ============================================================================

# Exit immediately if a command exits with a non-zero status.
# Also exit if any command in a pipeline fails.
set -euo pipefail

echo "========================================"
echo "  Cadence — Health Check"
echo "========================================"
echo ""

PASS=0
FAIL=0

# check: evaluates a condition and reports pass/fail.
check() {
  if eval "$2" > /dev/null 2>&1; then
    echo "✅ $1"
    PASS=$((PASS + 1))
  else
    echo "❌ $1"
    FAIL=$((FAIL + 1))
  fi
}

# Governance docs
check "AGENTS.md exists" "[ -f AGENTS.md ]"
check "PRD.md exists" "[ -f PRD.md ]"
check "CONTEXT_LOG.md exists" "[ -f CONTEXT_LOG.md ]"
check "STATE.md exists" "[ -f STATE.md ]"
check "LOGS.md exists" "[ -f LOGS.md ]"
check "MEMORY.md exists" "[ -f MEMORY.md ]"
check "ERRORS.md exists" "[ -f ERRORS.md ]"
check "INDEX.md exists" "[ -f INDEX.md ]"

# Process docs
check "docs/PROCESS.md exists" "[ -f docs/PROCESS.md ]"
check "docs/AGENT_REASONING.md exists" "[ -f docs/AGENT_REASONING.md ]"
check "docs/INTERFACES.md exists" "[ -f docs/INTERFACES.md ]"
check "docs/TESTING.md exists" "[ -f docs/TESTING.md ]"
check "docs/AGENT_STATES.md exists" "[ -f docs/AGENT_STATES.md ]"
check "docs/MENTAL_MODELS.md exists" "[ -f docs/MENTAL_MODELS.md ]"
check "docs/DESIGN_DOC.md exists" "[ -f docs/DESIGN_DOC.md ]"
check "docs/ANTI_TEST_GAMING.md exists" "[ -f docs/ANTI_TEST_GAMING.md ]"
check "docs/UI_UX.md exists" "[ -f docs/UI_UX.md ]"

# Checklists
check "docs/checklists/SECURITY.md exists" "[ -f docs/checklists/SECURITY.md ]"
check "docs/checklists/FUNCTIONALITY.md exists" "[ -f docs/checklists/FUNCTIONALITY.md ]"
check "docs/checklists/PRE_SHIP.md exists" "[ -f docs/checklists/PRE_SHIP.md ]"

# .kimi checks
check ".kimi/ directory exists" "[ -d .kimi ]"
check ".kimi/context_log.tail exists" "[ -f .kimi/context_log.tail ]"

# memory directory
check "memory/ directory exists" "[ -d memory ]"

# scripts
check "checkpoint.sh exists and executable" "[ -x scripts/checkpoint.sh ]"
check "recovery.sh exists and executable" "[ -x scripts/recovery.sh ]"

# Source code checks
check "cadence.html exists (monolith)" "[ -f cadence.html ]"
check "cadence.test.js exists" "[ -f cadence.test.js ]"
check "src/ directory exists" "[ -d src ]"

# Git checks (only if in a git repo)
if [ -d .git ]; then
  check ".gitignore exists" "[ -f .gitignore ]"
else
  echo "⚠️  Not a git repository — skipping git checks"
fi

# Run core logic tests
if [ -f "cadence.test.js" ]; then
  echo ""
  echo "Running core logic tests..."
  if node --test cadence.test.js 2>&1 | tail -1; then
    echo "✅ Core logic tests passing"
    PASS=$((PASS + 1))
  else
    echo "❌ Core logic tests failing"
    FAIL=$((FAIL + 1))
  fi
fi

echo ""
echo "========================================"
echo "  Results: $PASS passed, $FAIL failed"
echo "========================================"

if [ $FAIL -gt 0 ]; then
  exit 1
fi

exit 0
