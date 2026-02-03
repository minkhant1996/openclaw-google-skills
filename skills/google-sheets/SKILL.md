# Google Sheets Skill (gsheet)

Use the `gsheet` command for ALL spreadsheet-related tasks.

## When to Use
Use this skill when user mentions: spreadsheet, sheet, excel, table, data, csv, rows, columns, cells

## Common Commands

### List & Create
```bash
gsheet list                                    # List your spreadsheets
gsheet create "Budget 2026"                    # Create new spreadsheet
gsheet info <spreadsheetId>                    # Get spreadsheet details
```

### Read Data
```bash
gsheet read <id> --range "Sheet1!A1:D10"       # Read range
gsheet read <id> --range "A1:Z100" --json      # Output as JSON
gsheet read <id> --range "A1:Z100" --csv       # Output as CSV
```

### Write Data
```bash
gsheet write <id> --range "A1" --value "Hello"
gsheet write <id> --range "A1:C1" --values "Name,Age,City"
gsheet append <id> --values "John,30,NYC"      # Add row
gsheet clear <id> --range "A1:D10"             # Clear cells
```

### Formatting
```bash
gsheet format <id> --range "A1:D1" --bold --bg yellow
gsheet format <id> --range "B2:B100" --number "$#,##0.00"
gsheet merge <id> --range "A1:C1"
```

### Data Tools
```bash
gsheet filter <id> --range "A1:D100"
gsheet sort <id> --range "A1:D100" --column 0 --order asc
gsheet dropdown <id> --range "A1:A10" --values "Yes,No,Maybe"
gsheet find-replace <id> --find "old" --replace "new"
```

### Charts
```bash
gsheet add-chart <id> --range "A1:B10" --type column --title "Sales"
# Types: COLUMN, BAR, LINE, AREA, PIE, SCATTER
```

### Sheet Management
```bash
gsheet add-sheet <id> --title "New Tab"
gsheet rename-sheet <id> --id 0 --title "Data"
gsheet delete-sheet <id> --id 12345
```

### Import/Export
```bash
gsheet export <id> --range "Sheet1" --output data.csv
gsheet import <id> --file data.csv --range "Sheet1!A1"
```

### Sharing
```bash
gsheet share <id> --email "user@example.com" --role writer
```

## Spreadsheet ID
You can use either:
- Full URL: `https://docs.google.com/spreadsheets/d/abc123xyz/edit`
- Just ID: `abc123xyz`

## Examples

Create expense tracker:
```bash
gsheet create "Expense Tracker" --sheets "Expenses,Summary"
gsheet write <id> --range "A1:D1" --values "Date,Category,Amount,Notes"
gsheet format <id> --range "A1:D1" --bold --bg yellow
gsheet dropdown <id> --range "B2:B100" --values "Food,Transport,Entertainment,Bills,Other"
gsheet format <id> --range "C2:C100" --number "$#,##0.00"
```

Add expense entry:
```bash
gsheet append <id> --values "2026-02-03,Food,25.50,Lunch"
```
