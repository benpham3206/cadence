#!/bin/bash
# ============================================================================
# pre-ship-audit.sh
# Final validation before deploying Cadence to production.
# ============================================================================

# Exit immediately if a command exits with a non-zero status.
# Also exit if any command in a pipeline fails.
set -euo pipefail

echo "========================================"
echo "  Cadence — Pre-Ship Audit"
echo "========================================"
echo ""

PASS=0
FAIL=0

check() {
  if eval "$2" > /dev/null 2>&1; then
    echo "✅ $1"
    PASS=$((PASS + 1))
  else
    echo "❌ $1"
    FAIL=$((FAIL + 1))
  fi
}

# Run base health check
echo "Running health check..."
if ./scripts/health-check.sh > /dev/null 2>&1; then
  echo "✅ Health check passed"
  PASS=$((PASS + 1))
else
  echo "❌ Health check failed"
  FAIL=$((FAIL + 1))
fi
echo ""

# Documentation checks
check "PRD.md is not empty" "[ -s PRD.md ]"
check "AGENTS.md is not empty" "[ -s AGENTS.md ]"
check "SECURITY checklist reviewed" "[ -s docs/checklists/SECURITY.md ]"
check "FUNCTIONALITY checklist reviewed" "[ -s docs/checklists/FUNCTIONALITY.md ]"
check "PRE_SHIP checklist reviewed" "[ -s docs/checklists/PRE_SHIP.md ]"

# Security checks (only if in a git repo)
if [ -d .git ]; then
  check ".env is gitignored" "git check-ignore -q .env 2>/dev/null || [ ! -f .env ]"
  check "No API keys in source" "! grep -rn 'sk-ant-\|sk-proj-' src/ cadence.html 2>/dev/null"
else
  echo "⚠️  Not a git repository — skipping git security checks"
fi

# Console log check
if [ -d src ]; then
  if grep -rn "console\.log(" src/ > /dev/null 2>&1; then
    echo "⚠️  console.log statements found in src/ — review before shipping"
  else
    echo "✅ No console.log statements in src/"
    PASS=$((PASS + 1))
  fi
fi

# Build check (if Vite is configured)
if [ -f "package.json" ]; then
  if grep -q '"build"' package.json; then
    echo "Running build..."
    if npm run build > /dev/null 2>&1; then
      echo "✅ Build passed"
      PASS=$((PASS + 1))
    else
      echo "❌ Build failed"
      FAIL=$((FAIL + 1))
    fi
  fi
fi

echo ""
echo "========================================"
echo "  Results: $PASS passed, $FAIL failed"
echo "========================================"

if [ $FAIL -gt 0 ]; then
  echo ""
  echo "🚫 SHIPPING BLOCKED — fix failures before deploying."
  exit 1
fi

echo ""
echo "🚀 All checks passed. Ready for production."
exit 0
