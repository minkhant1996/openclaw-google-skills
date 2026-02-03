#!/bin/bash
set -e

REPO="https://raw.githubusercontent.com/minkhant1996/openclaw-google-skills/main"
SKILLS_DIR="$HOME/openclaw/skills"
OPENCLAW_SKILLS="$HOME/.openclaw/skills"
WORKSPACE_SKILLS="$HOME/.openclaw/workspace/skills"
BIN_DIR="$HOME/bin"

echo "========================================"
echo "  OpenClaw Google Skills Installer"
echo "========================================"
echo ""

# Create directories
echo "[1/5] Creating directories..."
mkdir -p "$SKILLS_DIR/google-calendar"
mkdir -p "$SKILLS_DIR/google-sheets"
mkdir -p "$SKILLS_DIR/gmail"
mkdir -p "$OPENCLAW_SKILLS/google-calendar"
mkdir -p "$OPENCLAW_SKILLS/google-sheets"
mkdir -p "$OPENCLAW_SKILLS/gmail"
mkdir -p "$WORKSPACE_SKILLS/google-calendar"
mkdir -p "$WORKSPACE_SKILLS/google-sheets"
mkdir -p "$WORKSPACE_SKILLS/gmail"
mkdir -p "$BIN_DIR"

# Download source files
echo "[2/5] Downloading skills..."
curl -sL "$REPO/src/gcal.mjs" -o "$SKILLS_DIR/google-calendar/gcal.mjs"
curl -sL "$REPO/src/gsheet.mjs" -o "$SKILLS_DIR/google-sheets/gsheet.mjs"
curl -sL "$REPO/src/gmail.mjs" -o "$SKILLS_DIR/gmail/gmail.mjs"

# Download SKILL.md files
curl -sL "$REPO/skills/google-calendar/SKILL.md" -o "$SKILLS_DIR/google-calendar/SKILL.md"
curl -sL "$REPO/skills/google-sheets/SKILL.md" -o "$SKILLS_DIR/google-sheets/SKILL.md"
curl -sL "$REPO/skills/gmail/SKILL.md" -o "$SKILLS_DIR/gmail/SKILL.md"

# Copy to openclaw directories
cp "$SKILLS_DIR/google-calendar/gcal.mjs" "$OPENCLAW_SKILLS/google-calendar/"
cp "$SKILLS_DIR/google-calendar/SKILL.md" "$OPENCLAW_SKILLS/google-calendar/"
cp "$SKILLS_DIR/google-sheets/gsheet.mjs" "$OPENCLAW_SKILLS/google-sheets/"
cp "$SKILLS_DIR/google-sheets/SKILL.md" "$OPENCLAW_SKILLS/google-sheets/"
cp "$SKILLS_DIR/gmail/gmail.mjs" "$OPENCLAW_SKILLS/gmail/"
cp "$SKILLS_DIR/gmail/SKILL.md" "$OPENCLAW_SKILLS/gmail/"

cp "$SKILLS_DIR/google-calendar/gcal.mjs" "$WORKSPACE_SKILLS/google-calendar/"
cp "$SKILLS_DIR/google-calendar/SKILL.md" "$WORKSPACE_SKILLS/google-calendar/"
cp "$SKILLS_DIR/google-sheets/gsheet.mjs" "$WORKSPACE_SKILLS/google-sheets/"
cp "$SKILLS_DIR/google-sheets/SKILL.md" "$WORKSPACE_SKILLS/google-sheets/"
cp "$SKILLS_DIR/gmail/gmail.mjs" "$WORKSPACE_SKILLS/gmail/"
cp "$SKILLS_DIR/gmail/SKILL.md" "$WORKSPACE_SKILLS/gmail/"

# Install npm dependencies
echo "[3/5] Installing dependencies..."
for skill_dir in "google-calendar" "google-sheets" "gmail"; do
  cd "$SKILLS_DIR/$skill_dir"
  if [ ! -f "package.json" ]; then
    npm init -y > /dev/null 2>&1
  fi
  npm install googleapis --silent > /dev/null 2>&1
done

# Create wrapper scripts
echo "[4/5] Creating CLI commands..."

cat > "$BIN_DIR/gcal" << 'EOF'
#!/bin/bash
cd ~/openclaw/skills/google-calendar
node gcal.mjs "$@"
EOF
chmod +x "$BIN_DIR/gcal"

cat > "$BIN_DIR/gsheet" << 'EOF'
#!/bin/bash
cd ~/openclaw/skills/google-sheets
node gsheet.mjs "$@"
EOF
chmod +x "$BIN_DIR/gsheet"

cat > "$BIN_DIR/gmail" << 'EOF'
#!/bin/bash
cd ~/openclaw/skills/gmail
node gmail.mjs "$@"
EOF
chmod +x "$BIN_DIR/gmail"

# Add to PATH if needed
if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
  echo "[5/5] Adding ~/bin to PATH..."
  echo 'export PATH="$HOME/bin:$PATH"' >> "$HOME/.bashrc"
  echo 'export PATH="$HOME/bin:$PATH"' >> "$HOME/.zshrc" 2>/dev/null || true
  export PATH="$HOME/bin:$PATH"
else
  echo "[5/5] PATH already configured"
fi

echo ""
echo "========================================"
echo "  Installation Complete!"
echo "========================================"
echo ""
echo "Commands available:"
echo "  gcal   - Google Calendar"
echo "  gsheet - Google Sheets"
echo "  gmail  - Gmail"
echo ""
echo "Run 'gcal help', 'gsheet help', or 'gmail help' for usage."
echo ""
echo "NOTE: You need to set up OAuth credentials first."
echo "Place your credentials in:"
echo "  ~/.openclaw/credentials/google-oauth-client.json"
echo "  ~/.openclaw/credentials/google-token.json"
echo ""
