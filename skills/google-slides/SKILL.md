# Google Slides Skill (gslides)

Use the `gslides` command for ALL presentation-related tasks.

## When to Use
Use this skill when user mentions: presentation, slides, powerpoint, ppt, slideshow, deck

## Common Commands

### List & Create
```bash
gslides list                            # List presentations
gslides create "My Presentation"        # Create new
gslides info <id>                       # Get details
```

### Manage Slides
```bash
gslides add-slide <id> --layout TITLE_AND_BODY
gslides delete-slide <id> --slide <slideId>
gslides duplicate-slide <id> --slide <slideId>
gslides move-slide <id> --slide <slideId> --index 0
gslides set-title <id> --slide <slideId> --title "Slide Title"
gslides set-background <id> --slide <slideId> --color blue
```

### Add Content
```bash
# Add text box
gslides add-text <id> --slide <slideId> --text "Hello World"
gslides add-text <id> --slide <slideId> --text "Big Title" --size 36 --bold

# Add image
gslides add-image <id> --slide <slideId> --url "https://example.com/image.png"

# Add shape
gslides add-shape <id> --slide <slideId> --type RECTANGLE --fill red

# Add table
gslides add-table <id> --slide <slideId> --rows 4 --cols 3
```

### Export & Share
```bash
gslides export <id> --format pdf --output slides.pdf
gslides export <id> --format pptx --output slides.pptx
gslides copy <id> --title "Presentation Copy"
gslides share <id> --email "user@email.com" --role writer
```

## Slide Layouts
- `BLANK` - Empty slide
- `TITLE` - Title slide
- `TITLE_AND_BODY` - Title with content
- `TITLE_AND_TWO_COLUMNS` - Two column layout
- `SECTION_HEADER` - Section divider
- `MAIN_POINT` - Single main point
- `BIG_NUMBER` - Large number display

## Shape Types
- `RECTANGLE`, `ROUND_RECTANGLE`
- `ELLIPSE` (circle/oval)
- `TRIANGLE`
- `ARROW_*` (various arrows)
- `STAR_*` (various stars)

## Examples

Create a presentation:
```bash
gslides create "Q4 Report"
gslides add-slide <id> --layout TITLE
gslides set-title <id> --slide <slideId> --title "Q4 2026 Results"
gslides add-slide <id> --layout TITLE_AND_BODY
gslides add-text <id> --slide <slideId2> --text "Revenue: $1.2M" --size 24 --bold
gslides add-image <id> --slide <slideId2> --url "https://..." --x 1 --y 3
```
