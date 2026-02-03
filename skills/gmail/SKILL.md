---
name: gmail
description: "Manage Gmail - read inbox, send emails, reply, forward, organize messages"
metadata:
  {
    "openclaw":
      {
        "emoji": "📧",
        "requires": { "bins": ["gmail"] }
      }
  }
---

# Gmail Skill

Use the `gmail` command for ALL email-related tasks.

## Commands

### Read
```bash
gmail inbox                             # List inbox
gmail unread                            # Unread only
gmail starred                           # Starred emails
gmail read <messageId>                  # Read email
gmail search "from:someone@email.com"   # Search
```

### Send
```bash
gmail send --to "email" --subject "subj" --body "message"
gmail send --to "email" --subject "Hi" --body "msg" --cc "other@email.com"
```

### Reply & Forward
```bash
gmail reply <messageId> --body "Thanks!"
gmail forward <messageId> --to "email" --note "FYI"
gmail draft --to "email" --subject "Draft" --body "..."
```

### Organize
```bash
gmail star <messageId>
gmail unstar <messageId>
gmail archive <messageId>
gmail trash <messageId>
gmail mark-read <messageId>
gmail labels
```

For full help: `gmail help`
