# Gmail Skill (gmail)

Use the `gmail` command for ALL email-related tasks.

## When to Use
Use this skill when user mentions: email, mail, inbox, send email, compose, message, reply

## Common Commands

### Read Emails
```bash
gmail inbox                              # List inbox (last 10)
gmail inbox --limit 20                   # List more
gmail unread                             # Unread emails only
gmail starred                            # Starred emails
gmail sent                               # Sent emails
gmail read <messageId>                   # Read specific email
gmail search "from:someone@email.com"    # Search
```

### Send Email
```bash
gmail send --to "user@email.com" --subject "Hello" --body "Message here"
gmail send --to "user@email.com" --subject "Hi" --body "Message" --cc "other@email.com"
```

### Reply & Forward
```bash
gmail reply <messageId> --body "Thanks for your email!"
gmail forward <messageId> --to "someone@email.com" --note "FYI"
```

### Organize
```bash
gmail star <messageId>                   # Star message
gmail archive <messageId>                # Archive
gmail trash <messageId>                  # Move to trash
gmail mark-read <messageId>              # Mark as read
gmail labels                             # List all labels
```

### Drafts
```bash
gmail draft --to "user@email.com" --subject "Draft" --body "..."
gmail drafts                             # List drafts
```

## Search Operators
- `from:sender@email.com` - From specific sender
- `to:recipient@email.com` - To specific recipient  
- `subject:keyword` - Subject contains
- `has:attachment` - Has attachments
- `is:unread` - Unread only
- `after:2026/01/01` - After date
- `label:Important` - By label
