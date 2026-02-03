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
gmail subscriptions                     # List all subscriptions
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
gmail mark-read <messageId>
gmail labels
```

### Delete (Protected)
```bash
gmail trash <messageId>                 # Social/Promo only
gmail delete <messageId> --confirm      # Permanent delete
gmail bulk-delete promotions --limit 50 --confirm
gmail bulk-delete social --limit 100 --confirm
```

**Protected emails** (cannot delete without --force):
- Important, Starred, Personal, Updates

**Allowed to delete freely:**
- Social, Promotions

### Safety & Config
```bash
gmail config                            # Show settings
gmail config set-signature 'Best,\nYour Name'  # Set signature
gmail config placeholders on            # Block [Your Name] etc.
```

**Safety Features:**
- Auto-detects placeholders like `[Your Name]`, `[EMAIL]`, `[Company]`
- Blocks sending until placeholders are replaced (use `--no-check` to override)
- Auto-appends your configured signature

For full help: `gmail help`
