# Google Drive Skill (gdrive)

Use the `gdrive` command for ALL file storage and management tasks.

## When to Use
Use this skill when user mentions: drive, files, folders, upload, download, storage, share file

## Common Commands

### List & Search
```bash
gdrive list                             # List files in root
gdrive list --folder <folderId>         # List files in folder
gdrive list --type folder               # List only folders
gdrive list --type image                # List only images
gdrive search "report"                  # Search by name
gdrive info <fileId>                    # Get file details
```

### Create & Upload
```bash
gdrive mkdir "New Folder"               # Create folder
gdrive mkdir "Subfolder" --in <parentId>
gdrive upload file.pdf                  # Upload file
gdrive upload file.pdf --to <folderId>  # Upload to specific folder
gdrive upload file.pdf --name "New Name.pdf"
```

### Download
```bash
gdrive download <fileId>                # Download file
gdrive download <fileId> --output local.pdf
```

### Organize
```bash
gdrive move <fileId> --to <folderId>    # Move file
gdrive copy <fileId> --name "Copy"      # Copy file
gdrive rename <fileId> --name "New Name"
gdrive delete <fileId>                  # Move to trash
```

### Share
```bash
gdrive share <fileId> --email "user@email.com" --role writer
gdrive share <fileId> --anyone          # Make public
gdrive permissions <fileId>             # List who has access
gdrive unshare <fileId> --email "user@email.com"
```

### Trash
```bash
gdrive trash <fileId>                   # Move to trash
gdrive untrash <fileId>                 # Restore
gdrive list-trash                       # View trash
gdrive empty-trash --confirm            # Empty trash
```

### Storage
```bash
gdrive quota                            # Check storage usage
```

## File Types (for --type filter)
- `folder` - Folders only
- `doc` - Google Docs
- `sheet` - Google Sheets
- `slide` - Google Slides
- `pdf` - PDF files
- `image` - Images
- `video` - Videos
- `audio` - Audio files

## Examples

Organize files:
```bash
gdrive mkdir "Projects"
gdrive mkdir "2026" --in <projectsFolderId>
gdrive upload report.pdf --to <2026FolderId>
gdrive share <fileId> --email "team@company.com" --role writer
```
