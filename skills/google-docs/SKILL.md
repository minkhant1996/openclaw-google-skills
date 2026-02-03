---
name: google-docs
description: "Manage Google Docs - create documents, read/write content, formatting, export"
metadata:
  {
    "openclaw":
      {
        "emoji": "📝",
        "requires": { "bins": ["gdocs"] }
      }
  }
---

# Google Docs Skill

Use the `gdocs` command for ALL document-related tasks.

## Commands

### List & Create
```bash
gdocs list                              # List documents
gdocs create "Title"                    # Create new
gdocs read <id>                         # Read content
gdocs search "query"                    # Search docs
```

### Edit
```bash
gdocs append <id> --text "Text"         # Add text
gdocs insert <id> --text "Text" --index 1
gdocs replace <id> --find "old" --replace "new"
```

### Structure
```bash
gdocs heading <id> --text "Title" --level 1
gdocs bullets <id> --items "Item1,Item2,Item3"
gdocs table <id> --rows 3 --cols 3
```

### Export
```bash
gdocs export <id> --format pdf --output file.pdf
gdocs export <id> --format docx --output file.docx
```

For full help: `gdocs help`
