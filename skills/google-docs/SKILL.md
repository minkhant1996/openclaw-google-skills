# Google Docs Skill (gdocs)

Use the `gdocs` command for ALL document-related tasks.

## When to Use
Use this skill when user mentions: document, doc, google doc, write document, create doc, word

## Common Commands

### List & Create
```bash
gdocs list                              # List your documents
gdocs create "My Document"              # Create new doc
gdocs create "Report" --content "Initial text here"
gdocs info <documentId>                 # Get doc details
```

### Read Documents
```bash
gdocs read <documentId>                 # Read content
gdocs search "keyword"                  # Search documents
```

### Edit Content
```bash
gdocs append <id> --text "Add this text at the end"
gdocs insert <id> --text "Insert here" --index 1
gdocs replace <id> --find "old text" --replace "new text"
```

### Add Structure
```bash
gdocs heading <id> --text "Section Title" --level 1
gdocs bullets <id> --items "Item 1,Item 2,Item 3"
gdocs bullets <id> --items "First,Second,Third" --numbered
gdocs table <id> --rows 3 --cols 4
```

### Formatting
```bash
gdocs format <id> --start 1 --end 20 --bold
gdocs format <id> --start 1 --end 20 --italic --color blue
gdocs format <id> --start 1 --end 50 --size 14 --font "Arial"
```

### Export & Share
```bash
gdocs export <id> --format pdf --output report.pdf
gdocs export <id> --format docx --output document.docx
gdocs copy <id> --title "Document Copy"
gdocs share <id> --email "user@email.com" --role writer
```

## Document ID
You can use either:
- Full URL: `https://docs.google.com/document/d/abc123xyz/edit`
- Just ID: `abc123xyz`

## Export Formats
- `pdf` - PDF document
- `docx` - Microsoft Word
- `txt` - Plain text
- `html` - HTML
- `rtf` - Rich Text Format
- `odt` - OpenDocument

## Examples

Create a report:
```bash
gdocs create "Monthly Report"
gdocs heading <id> --text "Summary" --level 1
gdocs append <id> --text "This month we achieved the following results:"
gdocs bullets <id> --items "Revenue up 15%,New customers: 50,Retention: 95%"
gdocs heading <id> --text "Details" --level 2
gdocs table <id> --rows 5 --cols 3
```
