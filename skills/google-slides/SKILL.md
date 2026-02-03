---
name: google-slides
description: "Manage Google Slides - create presentations, add slides, text, images, shapes"
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

Use the `gslides` command for ALL presentation-related tasks.

## Commands

### List & Create
```bash
gslides list                            # List presentations
gslides create "Title"                  # Create new
gslides info <id>                       # Get details
```

### Slides
```bash
gslides add-slide <id> --layout TITLE_AND_BODY
gslides delete-slide <id> --slide <slideId>
gslides set-title <id> --slide <slideId> --title "Title"
gslides set-background <id> --slide <slideId> --color blue
```

### Content
```bash
gslides add-text <id> --slide <slideId> --text "Hello" --size 24
gslides add-image <id> --slide <slideId> --url "https://..."
gslides add-shape <id> --slide <slideId> --type RECTANGLE --fill red
gslides add-table <id> --slide <slideId> --rows 3 --cols 3
```

### Export
```bash
gslides export <id> --format pdf --output slides.pdf
```

For full help: `gslides help`
