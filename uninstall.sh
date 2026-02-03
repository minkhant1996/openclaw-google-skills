#!/bin/bash
set -e

echo "========================================"
echo "  OpenClaw Google Skills Uninstaller"
echo "========================================"
echo ""

read -p "Remove all OpenClaw Google Skills? (y/N) " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
  echo "Cancelled."
  exit 0
fi

echo "Removing skills..."

# Remove skill directories
rm -rf "$HOME/openclaw/skills/google-calendar"
rm -rf "$HOME/openclaw/skills/google-sheets"
rm -rf "$HOME/openclaw/skills/google-docs"
rm -rf "$HOME/openclaw/skills/google-slides"
rm -rf "$HOME/openclaw/skills/gmail"

rm -rf "$HOME/.openclaw/skills/google-calendar"
rm -rf "$HOME/.openclaw/skills/google-sheets"
rm -rf "$HOME/.openclaw/skills/google-docs"
rm -rf "$HOME/.openclaw/skills/google-slides"
rm -rf "$HOME/.openclaw/skills/gmail"

rm -rf "$HOME/.openclaw/workspace/skills/google-calendar"
rm -rf "$HOME/.openclaw/workspace/skills/google-sheets"
rm -rf "$HOME/.openclaw/workspace/skills/google-docs"
rm -rf "$HOME/.openclaw/workspace/skills/google-slides"
rm -rf "$HOME/.openclaw/workspace/skills/gmail"

# Remove CLI commands
rm -f "$HOME/bin/gcal"
rm -f "$HOME/bin/gsheet"
rm -f "$HOME/bin/gdocs"
rm -f "$HOME/bin/gslides"
rm -f "$HOME/bin/gmail"

echo ""
echo "Uninstalled successfully!"
echo ""
echo "Note: OAuth credentials in ~/.openclaw/credentials/ were NOT removed."
echo "Remove manually if needed:"
echo "  rm ~/.openclaw/credentials/google-*.json"
