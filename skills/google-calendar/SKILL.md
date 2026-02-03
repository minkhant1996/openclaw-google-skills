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

Use the `gcal` command for ALL calendar-related tasks.

## Commands

### View Events
```bash
gcal list                               # Next 7 days
gcal today                              # Today's events
gcal tomorrow                           # Tomorrow's events
gcal get <eventId>                      # Event details
```

### Create Events
```bash
gcal create --title "Meeting" --start "tomorrow 2pm"
gcal create --title "Call" --start "Monday 10am" --duration 30m
gcal create --title "Sync" --start "Friday 3pm" --attendees "a@email.com,b@email.com"
```

### Manage Events
```bash
gcal update <eventId> --title "New Title"
gcal move <eventId> --start "tomorrow 4pm"
gcal delete <eventId>
```

### Availability
```bash
gcal busy today                         # Show busy times
gcal free tomorrow                      # Show free slots
```

For full help: `gcal help`
