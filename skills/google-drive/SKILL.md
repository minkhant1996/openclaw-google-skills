---
name: google-drive
description: "Manage Google Drive - upload, download, share files, create folders"
metadata:
  {
    "openclaw":
      {
        "emoji": "📁",
        "requires": { "bins": ["gdrive"] }
      }
  }
---

# Google Drive Skill

Use the `gdrive` command for ALL file storage tasks.

## Commands

### List & Search
```bash
gdrive list                             # List files
gdrive list --folder <folderId>         # List folder
gdrive search "query"                   # Search files
gdrive info <fileId>                    # Get details
```

### Upload/Download
```bash
gdrive upload file.pdf --to <folderId>
gdrive download <fileId> --output local.pdf
gdrive mkdir "Folder Name"
```

### Organize
```bash
gdrive move <fileId> --to <folderId>
gdrive copy <fileId> --name "Copy"
gdrive rename <fileId> --name "New Name"
gdrive trash <fileId>
```

### Share
```bash
gdrive share <fileId> --email "user@email.com" --role writer
gdrive share <fileId> --anyone          # Make public
gdrive permissions <fileId>             # List access
```

### Storage
```bash
gdrive quota                            # Check storage
```

For full help: `gdrive help`
