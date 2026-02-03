# OpenClaw Google Skills

Google Workspace CLI tools for OpenClaw - Calendar, Sheets, Docs, and Gmail automation.

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

### Gmail (`gmail`)
- Read inbox, sent, starred, drafts
- Send emails with CC/BCC
- Reply and forward
- Search with Gmail operators
- Labels and organization
- Star, archive, trash messages

## Prerequisites

1. **Node.js 18+** installed
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

## Uninstall

```bash
bash <(curl -s https://raw.githubusercontent.com/minkhant1996/openclaw-google-skills/main/uninstall.sh)
```

## License

MIT

## Author

BrookAI Team
