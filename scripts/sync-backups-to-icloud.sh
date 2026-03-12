#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# VAGT Security — Sync Firestore backups from GCS to iCloud Drive
# ─────────────────────────────────────────────────────────────────────────────
#
# WHAT THIS DOES:
#   Downloads the Firestore exports that scheduledFirestoreBackup writes to
#   gs://vagt---services-backups/ and places them in your iCloud Drive.
#   iCloud then syncs them to all your Apple devices and backs them up.
#
# WHEN TO RUN:
#   • Once a week is enough (GCS keeps 30 days of exports anyway).
#   • Or set it up as a weekly launchd job (see bottom of this file).
#
# PREREQUISITES:
#   • gcloud CLI installed: brew install --cask google-cloud-sdk
#   • Logged in:            gcloud auth login
#   • Project set:          gcloud config set project vagt---services
#   • gsutil available:     comes with gcloud CLI
#
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

GCS_BUCKET="gs://vagt---services-backups"
ICLOUD_DIR="$HOME/Library/Mobile Documents/com~apple~CloudDocs/VAGT-Backups/Firestore"

# ── Ensure local directory exists ─────────────────────────────────────────────
mkdir -p "$ICLOUD_DIR"

echo "==> Syncing Firestore backups from GCS to iCloud Drive..."
echo "    Source : $GCS_BUCKET"
echo "    Dest   : $ICLOUD_DIR"
echo ""

# rsync from GCS to local iCloud folder
# -m  = parallel downloads (faster)
# -r  = recursive
# -d  = delete local files that no longer exist in GCS
#       (keeps your iCloud copy clean; GCS has already deleted >30 day exports)
gsutil -m rsync -r -d "$GCS_BUCKET" "$ICLOUD_DIR"

echo ""
echo "==> Done. Files are in:"
echo "    $ICLOUD_DIR"
echo ""
echo "    iCloud will sync them to all your Apple devices automatically."

# ─────────────────────────────────────────────────────────────────────────────
# TO RUN AUTOMATICALLY EVERY SUNDAY AT 10:00 AM (macOS launchd):
#
#   1. Save this plist to ~/Library/LaunchAgents/com.vagt.backup-sync.plist:
#
#      <?xml version="1.0" encoding="UTF-8"?>
#      <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
#        "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
#      <plist version="1.0">
#      <dict>
#        <key>Label</key>           <string>com.vagt.backup-sync</string>
#        <key>ProgramArguments</key>
#        <array>
#          <string>/bin/bash</string>
#          <string>/path/to/vagt-website-2026/scripts/sync-backups-to-icloud.sh</string>
#        </array>
#        <key>StartCalendarInterval</key>
#        <dict>
#          <key>Weekday</key> <integer>0</integer>
#          <key>Hour</key>    <integer>10</integer>
#          <key>Minute</key>  <integer>0</integer>
#        </dict>
#        <key>StandardOutPath</key> <string>/tmp/vagt-backup-sync.log</string>
#        <key>StandardErrorPath</key><string>/tmp/vagt-backup-sync.log</string>
#      </dict>
#      </plist>
#
#   2. Load it:
#      launchctl load ~/Library/LaunchAgents/com.vagt.backup-sync.plist
#
# ─────────────────────────────────────────────────────────────────────────────
