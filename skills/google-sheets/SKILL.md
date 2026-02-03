---
name: google-sheets
description: "Manage Google Sheets - create spreadsheets, read/write data, formatting, charts"
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

Use the `gsheet` command for ALL spreadsheet-related tasks.

## Commands

### List & Create
```bash
gsheet list                              # List spreadsheets
gsheet create "Title"                    # Create new
gsheet info <id>                         # Get details
```

### Read/Write
```bash
gsheet read <id> --range "A1:D10"        # Read data
gsheet write <id> --range "A1" --value "Hello"
gsheet append <id> --values "col1,col2,col3"
```

### Format
```bash
gsheet format <id> --range "A1:D1" --bold --bg yellow
gsheet add-chart <id> --range "A1:B10" --type column
```

### Share
```bash
gsheet share <id> --email "user@email.com" --role writer
```

For full help: `gsheet help`
