---
name: google-calendar
description: "Manage Google Calendar - create meetings, list events, invite attendees, set reminders"
metadata:
  {
    "openclaw":
      {
        "emoji": "📅",
        "requires": { "bins": ["gcal"] }
      }
  }
---

# Google Calendar Skill

Use the `gcal` command to manage Google Calendar.

## IMPORTANT: Command Format

When creating events, ALWAYS use named flags. The title MUST use `--title` flag.

### Create Event - REQUIRED FORMAT:
```
gcal create --title "EVENT TITLE" --start "TIME" [OPTIONS]
```

### Available Flags:
- `--title "text"` - Event title (REQUIRED)
- `--start "time"` - Start time (e.g., "tomorrow 9am", "Monday 2pm", "2026-02-03T14:00")
- `--duration 1h` - Duration (e.g., "30m", "1h", "2h")
- `--description "text"` - Event description/notes
- `--attendees "email"` - Invite attendees (comma-separated for multiple)
- `--guests "email"` - Alias for --attendees  
- `--reminder 30` - Popup reminder (minutes before)
- `--email-reminder 60` - Email reminder (minutes before)
- `--location "place"` - Event location
- `--repeat DAILY|WEEKLY|MONTHLY` - Make recurring
- `--count 10` - Number of recurrences
- `--notify` - Send email invites to attendees

## Examples

### Create a simple meeting:
```
gcal create --title "Team Standup" --start "tomorrow 9am"
```

### Create meeting with all details:
```
gcal create --title "Project Review" --start "tomorrow 2pm" --duration 1h --attendees "john@example.com" --description "Discuss Q1 progress" --reminder 30 --notify
```

### Create meeting with multiple attendees:
```
gcal create --title "All Hands" --start "Monday 10am" --attendees "alice@co.com,bob@co.com,carol@co.com" --notify
```

### Create recurring meeting:
```
gcal create --title "Weekly Sync" --start "Monday 9am" --repeat WEEKLY --count 10
```

## List Events

```
gcal list 7       # Next 7 days
gcal today        # Today only
gcal tomorrow     # Tomorrow only
gcal week         # This week
```

## Modify Events

```
gcal update <eventId> --title "New Title"
gcal update <eventId> --start "new time"
gcal move <eventId> --start "tomorrow 3pm"
gcal delete <eventId>
gcal cancel <eventId>    # Delete and notify attendees
```

## Check Availability

```
gcal busy                           # Show busy times today
gcal free                           # Show free slots today
gcal freebusy user@email.com        # Check if someone is free
```

## Calendar Management

```
gcal calendars                      # List all calendars
gcal create-calendar "Work"         # Create new calendar
gcal delete-calendar <calId>        # Delete calendar
gcal share primary --email user@email.com --role writer
```

## Time Format Examples

These time formats are supported:
- "tomorrow 9am"
- "Monday 2pm" 
- "next week 10am"
- "2026-02-03T14:00:00"
- "February 5 3pm"

## Command Aliases

- `gcal add` = `gcal create`
- `gcal schedule` = `gcal create`
- `gcal meeting` = `gcal create`
- `gcal rm` = `gcal delete`
- `gcal ls` = `gcal list`

