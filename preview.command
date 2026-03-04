#!/bin/bash
# VAGT Local Preview Server
# Double-click this file to start previewing the site locally

cd "$(dirname "$0")"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  VAGT Preview Server"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Opening: http://localhost:8080"
echo "  To stop: press Ctrl + C"
echo ""
echo "  Refresh your browser after any changes."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Open browser after a short delay
(sleep 1 && open "http://localhost:8080") &

# Start server
python3 -m http.server 8080
