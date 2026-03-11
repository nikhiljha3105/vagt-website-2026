#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# VAGT Security Services — One-command deploy script
# Usage: ./deploy.sh
# Run from the project root: /VAGT New Website Design/
# Requires: firebase CLI installed, logged in as nkjha3105@gmail.com
# ─────────────────────────────────────────────────────────────────────────────

set -e  # Stop immediately if any command fails

PROJECT="vagt---services"

echo ""
echo "═══════════════════════════════════════════"
echo "  VAGT Deploy — project: $PROJECT"
echo "═══════════════════════════════════════════"
echo ""

# 1. Install function dependencies
echo "▶ Installing Cloud Function dependencies..."
npm install --prefix firebase/functions --legacy-peer-deps --silent
echo "  ✓ Done"

# 2. Deploy Cloud Functions
echo "▶ Deploying Cloud Functions..."
firebase deploy --only functions --project $PROJECT
echo "  ✓ Done"

# 3. Deploy Firestore rules
echo "▶ Deploying Firestore rules..."
firebase deploy --only firestore:rules --project $PROJECT
echo "  ✓ Done"

# 4. Deploy Hosting (all portal + public HTML pages)
echo "▶ Deploying Hosting..."
firebase deploy --only hosting --project $PROJECT
echo "  ✓ Done"

echo ""
echo "═══════════════════════════════════════════"
echo "  ✅ Deploy complete!"
echo ""
echo "  Employee portal: https://vagt---services.web.app/pages/employee-portal.html"
echo "  Client portal:   https://vagt---services.web.app/pages/client-portal.html"
echo "  Admin portal:    https://vagt---services.web.app/pages/admin-portal.html"
echo "═══════════════════════════════════════════"
echo ""
