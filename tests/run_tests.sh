#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
#  VAGT Website — Full Test Suite Runner
#  Usage: bash tests/run_tests.sh [--verbose]
#
#  Runs all Python test modules in order and prints a final summary.
#  Exit code: 0 = all pass, 1 = one or more failures.
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║          VAGT Website — Automated Test Suite             ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "  Root: $ROOT"
echo "  Python: $(python3 --version 2>&1)"
echo "  Date:   $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

PASS=0
FAIL=0
FAILED_MODULES=()

run_test() {
  local module="$1"
  local label="$2"

  echo "▶  Running: $label"
  if python3 "tests/$module" ; then
    PASS=$((PASS + 1))
  else
    FAIL=$((FAIL + 1))
    FAILED_MODULES+=("$label")
  fi
}

run_test "test_assets.py"    "Asset Existence"
run_test "test_structure.py" "HTML Structure & Meta"
run_test "test_links.py"     "Internal Link Integrity"
run_test "test_security.py"  "Security Checks"
run_test "test_content.py"   "Content & Navigation"
run_test "test_sitemap.py"   "Sitemap & robots.txt"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║                    FINAL SUMMARY                         ║"
echo "╠══════════════════════════════════════════════════════════╣"
printf  "║  Test modules passed: %-4d                              ║\n" "$PASS"
printf  "║  Test modules failed: %-4d                              ║\n" "$FAIL"
echo "╚══════════════════════════════════════════════════════════╝"

if [ ${#FAILED_MODULES[@]} -gt 0 ]; then
  echo ""
  echo "  Failed modules:"
  for m in "${FAILED_MODULES[@]}"; do
    echo "    ✗  $m"
  done
  echo ""
  exit 1
else
  echo ""
  echo "  All test modules passed."
  echo ""
  exit 0
fi
