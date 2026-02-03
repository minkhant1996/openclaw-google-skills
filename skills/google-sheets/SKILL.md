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
```

### Charts
```bash
gsheet add-chart <id> --labels "B2:B5" --values "D2:D5" --type pie --title "Budget"
gsheet delete-charts <id>               # Remove all charts
```

Chart types: COLUMN, BAR, LINE, AREA, PIE, SCATTER

### Budget Summary
```bash
gsheet budget-summary <id>              # Auto-create income/expense/remaining summary
```

Creates a summary table and pie chart showing:
- Total Income
- Total Expenses
- Remaining Balance

### Share
```bash
gsheet share <id> --email "user@email.com" --role writer
```

For full help: `gsheet help`
