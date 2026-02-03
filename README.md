# OpenClaw Google Skills

Google Workspace CLI tools for OpenClaw - Calendar, Sheets, Docs, Slides, Drive, and Gmail automation.

## Quick Install

```bash
bash <(curl -s https://raw.githubusercontent.com/minkhant1996/openclaw-google-skills/main/install.sh)
```

## Features

### Google Calendar (`gcal`)
- List, create, update, delete events
- Recurring events support
- Attendees and invites
- Reminders and notifications
- Free/busy availability check
- Multiple calendar management

### Google Sheets (`gsheet`)
- Create and manage spreadsheets
- Read/write cell data
- Formatting (bold, colors, number formats)
- Charts and graphs
- Data validation (dropdowns)
- Conditional formatting
- Import/export CSV
- Sharing and permissions

### Google Docs (`gdocs`)
- Create and manage documents
- Read document content
- Append, insert, replace text
- Add headings, bullet lists, tables
- Text formatting (bold, italic, colors)
- Export to PDF, DOCX, TXT, HTML
- Copy and share documents

### Google Slides (`gslides`)
- Create and manage presentations
- Add, delete, duplicate, move slides
- Add text boxes, images, shapes, tables
- Set slide titles and backgrounds
- Multiple slide layouts
- Export to PDF, PPTX
- Copy and share presentations

### Google Drive (`gdrive`)
- List, search, and manage files
- Create folders
- Upload and download files
- Move, copy, rename files
- Share files and folders
- Manage permissions
- Trash management
- Storage quota info

### Gmail (`gmail`)
- Read inbox, sent, starred, drafts
- Send emails with CC/BCC
- Reply and forward
- Search with Gmail operators
- Labels and organization
- Star, archive, trash messages

## Prerequisites

1. **Node.js 20+** installed
2. **Google Cloud Project** with APIs enabled:
   - Gmail API
   - Google Calendar API
   - Google Sheets API
   - Google Drive API

3. **OAuth 2.0 Credentials** configured

## Setup OAuth Credentials

### 1. Create Google Cloud Project
- Go to [Google Cloud Console](https://console.cloud.google.com)
- Create a new project or select existing
- Enable the required APIs

### 2. Configure OAuth Consent Screen
- Go to APIs & Services > OAuth consent screen
- Select "External" user type
- Add your email as a test user

### 3. Create OAuth Credentials
- Go to APIs & Services > Credentials
- Create OAuth 2.0 Client ID (Desktop app)
- Download the JSON file

### 4. Place Credentials
```bash
mkdir -p ~/.openclaw/credentials
# Save your OAuth client JSON as:
~/.openclaw/credentials/google-oauth-client.json
```

### 5. Authorize (First Run)
Run the authorization script to generate tokens:
```bash
node authorize.mjs
```
This opens a browser for Google sign-in and saves tokens to:
```
~/.openclaw/credentials/google-token.json
```

## Usage

### Google Calendar
```bash
# List events
gcal list
gcal today
gcal tomorrow

# Create event
gcal create "Team Meeting" --start "tomorrow 2pm" --duration 1h
gcal create "Weekly Sync" --start "monday 10am" --repeat WEEKLY --attendees "team@example.com"

# Manage events
gcal update <eventId> --title "New Title"
gcal delete <eventId>

# Check availability
gcal free tomorrow
gcal busy today
```

### Google Sheets
```bash
# List spreadsheets
gsheet list

# Create spreadsheet
gsheet create "Budget 2026"

# Read/write data
gsheet read <id> --range "A1:D10"
gsheet write <id> --range "A1" --value "Hello"
gsheet append <id> --values "Name,Age,City"

# Formatting
gsheet format <id> --range "A1:D1" --bold --bg yellow

# Charts
gsheet add-chart <id> --range "A1:B10" --type column
```

### Google Docs
```bash
# List documents
gdocs list

# Create document
gdocs create "My Document"

# Read document
gdocs read <id>

# Edit content
gdocs append <id> --text "Add this text"
gdocs replace <id> --find "old" --replace "new"

# Add structure
gdocs heading <id> --text "Section Title" --level 1
gdocs bullets <id> --items "Item 1,Item 2,Item 3"
gdocs table <id> --rows 3 --cols 3

# Export
gdocs export <id> --format pdf --output document.pdf
```

### Google Slides
```bash
# List presentations
gslides list

# Create presentation
gslides create "My Presentation"

# Get info
gslides info <id>

# Add slides
gslides add-slide <id> --layout TITLE_AND_BODY

# Add content
gslides add-text <id> --slide <slideId> --text "Hello" --size 24 --bold
gslides add-image <id> --slide <slideId> --url "https://..."
gslides add-shape <id> --slide <slideId> --type RECTANGLE --fill blue
gslides add-table <id> --slide <slideId> --rows 3 --cols 3

# Set slide properties
gslides set-title <id> --slide <slideId> --title "Slide Title"
gslides set-background <id> --slide <slideId> --color blue

# Export
gslides export <id> --format pdf --output slides.pdf
```

### Google Drive
```bash
# List files
gdrive list
gdrive list --folder <folderId>
gdrive list --type image

# Search
gdrive search "report"

# Create folder
gdrive mkdir "New Folder"

# Upload/Download
gdrive upload file.pdf --to <folderId>
gdrive download <fileId> --output local.pdf

# Organize
gdrive move <fileId> --to <folderId>
gdrive copy <fileId> --name "Copy"
gdrive rename <fileId> --name "New Name"

# Share
gdrive share <fileId> --email "user@email.com" --role writer
gdrive share <fileId> --anyone

# Trash
gdrive trash <fileId>
gdrive untrash <fileId>

# Storage
gdrive quota
```

### Gmail
```bash
# Read emails
gmail inbox
gmail unread
gmail read <messageId>

# Send email
gmail send --to "user@example.com" --subject "Hello" --body "Message"

# Reply/Forward
gmail reply <messageId> --body "Thanks!"
gmail forward <messageId> --to "other@example.com"

# Organize
gmail star <messageId>
gmail archive <messageId>
gmail search "from:important@example.com"
```

## OpenClaw Agent Configuration

To ensure the OpenClaw agent uses these CLI tools instead of browser automation, configure the following:

### 1. Create TOOLS.md

Create `~/.openclaw/workspace/TOOLS.md` with instructions for the agent:

```markdown
# Tool Usage Guide

## IMPORTANT RULES

1. **NEVER use browser** for Google Slides, Sheets, Docs, Drive, Calendar, or Gmail
2. **ALWAYS use the CLI commands** (gslides, gsheet, gdocs, gdrive, gcal, gmail)
3. If a command fails, check `--help` for correct usage

## Available Commands

### Google Slides
- `gslides create "Presentation Name"` - Create new presentation
- `gslides create-slide <id> --title "Title" --body "Content"` - Add slide with content
- `gslides read <id>` - Read all slide content
- `gslides list` - List all presentations

### Google Sheets
- `gsheet create "Spreadsheet Name"` - Create new spreadsheet
- `gsheet read <id>` - Read data
- `gsheet write <id> --range "A1" --value "data"` - Write data
- `gsheet add-chart <id> --labels "A1:A10" --values "B1:B10"` - Add chart

### Google Docs
- `gdocs create "Document Name"` - Create new document
- `gdocs read <id>` - Read content
- `gdocs append <id> --text "content"` - Add content

### Gmail
- `gmail inbox` - Read inbox
- `gmail send --to "email" --subject "Subject" --body "Body"` - Send email
- `gmail subscriptions` - List email subscriptions

### Google Calendar
- `gcal list` - List events
- `gcal create "Event" --start "tomorrow 2pm"` - Create event

### Google Drive
- `gdrive list` - List files
- `gdrive upload file.pdf` - Upload file
```

### 2. Register Skills

Create skill files in `~/.openclaw/skills/` with proper YAML frontmatter:

**`~/.openclaw/skills/google-slides/SKILL.md`:**
```yaml
---
name: google-slides
description: "Manage Google Slides presentations using gslides CLI"
metadata:
  {
    "openclaw":
      {
        "emoji": "📽️",
        "requires": { "bins": ["gslides"] }
      }
  }
---

# Google Slides Skill

Use `gslides` CLI commands. NEVER use browser.

## Key Commands
- `gslides create "Name"` - Create presentation
- `gslides create-slide <id> --title "Title" --body "Content"` - Add slide with content
- `gslides read <id>` - Read slide content
```

**`~/.openclaw/skills/google-sheets/SKILL.md`:**
```yaml
---
name: google-sheets
description: "Manage Google Sheets using gsheet CLI"
metadata:
  {
    "openclaw":
      {
        "emoji": "📊",
        "requires": { "bins": ["gsheet"] }
      }
  }
---

# Google Sheets Skill

Use `gsheet` CLI commands. NEVER use browser.
```

### 3. Restart OpenClaw

After making configuration changes:
```bash
# Kill existing OpenClaw processes
pkill -f openclaw

# Start fresh
openclaw
```

## Uninstall

```bash
bash <(curl -s https://raw.githubusercontent.com/minkhant1996/openclaw-google-skills/main/uninstall.sh)
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Author

**Min Khant Soe**
