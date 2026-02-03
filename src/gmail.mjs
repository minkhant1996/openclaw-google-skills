#!/usr/bin/env node
import { google } from "googleapis";
import fs from "fs";
import path from "path";

const HOME = process.env.HOME;
const CREDS_PATH = path.join(HOME, ".openclaw/credentials/google-oauth-client.json");
const TOKEN_PATH = path.join(HOME, ".openclaw/credentials/google-token.json");

function getAuth() {
  const creds = JSON.parse(fs.readFileSync(CREDS_PATH));
  const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH));
  const { client_id, client_secret } = creds.installed || creds.web;
  const auth = new google.auth.OAuth2(client_id, client_secret);
  auth.setCredentials(tokens);
  return auth;
}

const auth = getAuth();
const gmail = google.gmail({ version: "v1", auth });

function parseFlags(args) {
  const result = { _: [] };
  let i = 0;
  while (i < args.length) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith("--")) {
        result[key] = next;
        i += 2;
      } else {
        result[key] = true;
        i++;
      }
    } else {
      result._.push(args[i]);
      i++;
    }
  }
  return result;
}

function decodeBase64(data) {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
}

function encodeBase64(data) {
  return Buffer.from(data).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function getHeader(headers, name) {
  const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
  return header ? header.value : "";
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Bangkok"
  });
}

function extractBody(payload) {
  if (payload.body?.data) {
    return decodeBase64(payload.body.data);
  }

  if (payload.parts) {
    // Prefer text/plain, fallback to text/html
    const textPart = payload.parts.find(p => p.mimeType === "text/plain");
    if (textPart?.body?.data) {
      return decodeBase64(textPart.body.data);
    }

    const htmlPart = payload.parts.find(p => p.mimeType === "text/html");
    if (htmlPart?.body?.data) {
      // Strip HTML tags for display
      return decodeBase64(htmlPart.body.data)
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    // Check nested parts (multipart/alternative inside multipart/mixed)
    for (const part of payload.parts) {
      if (part.parts) {
        const nested = extractBody(part);
        if (nested) return nested;
      }
    }
  }

  return "";
}

const commands = {
  // ==================== LIST/INBOX ====================
  async inbox(args) {
    const flags = parseFlags(args);
    const maxResults = parseInt(flags.limit || flags.n) || 10;
    const query = flags.query || flags.q || "in:inbox";

    const res = await gmail.users.messages.list({
      userId: "me",
      maxResults,
      q: query
    });

    const messages = res.data.messages || [];
    if (messages.length === 0) {
      console.log("No messages found.");
      return;
    }

    console.log("\nInbox (" + messages.length + " messages):\n");

    for (const msg of messages) {
      const detail = await gmail.users.messages.get({
        userId: "me",
        id: msg.id,
        format: "metadata",
        metadataHeaders: ["From", "Subject", "Date"]
      });

      const headers = detail.data.payload.headers;
      const from = getHeader(headers, "From").replace(/<[^>]+>/, "").trim();
      const subject = getHeader(headers, "Subject") || "(No subject)";
      const date = formatDate(getHeader(headers, "Date"));
      const unread = detail.data.labelIds?.includes("UNREAD") ? "*" : " ";

      console.log(unread + " " + date);
      console.log("  From: " + from.substring(0, 40));
      console.log("  " + subject.substring(0, 60));
      console.log("  ID: " + msg.id + "\n");
    }
  },

  async unread(args) {
    const flags = parseFlags(args);
    flags.query = "is:unread " + (flags.query || "");
    return this.inbox([...args, "--query", flags.query]);
  },

  async starred(args) {
    return this.inbox([...args, "--query", "is:starred"]);
  },

  async sent(args) {
    return this.inbox([...args, "--query", "in:sent"]);
  },

  async drafts(args) {
    const flags = parseFlags(args);
    const maxResults = parseInt(flags.limit) || 10;

    const res = await gmail.users.drafts.list({
      userId: "me",
      maxResults
    });

    const drafts = res.data.drafts || [];
    if (drafts.length === 0) {
      console.log("No drafts found.");
      return;
    }

    console.log("\nDrafts (" + drafts.length + "):\n");

    for (const draft of drafts) {
      const detail = await gmail.users.drafts.get({
        userId: "me",
        id: draft.id,
        format: "metadata",
        metadataHeaders: ["To", "Subject"]
      });

      const headers = detail.data.message.payload.headers;
      const to = getHeader(headers, "To") || "(No recipient)";
      const subject = getHeader(headers, "Subject") || "(No subject)";

      console.log("* " + subject.substring(0, 50));
      console.log("  To: " + to.substring(0, 40));
      console.log("  ID: " + draft.id + "\n");
    }
  },

  // ==================== READ MESSAGE ====================
  async read(args) {
    const flags = parseFlags(args);
    const messageId = flags._[0];

    if (!messageId) {
      console.log("Usage: gmail read <messageId>");
      return;
    }

    const res = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full"
    });

    const msg = res.data;
    const headers = msg.payload.headers;

    console.log("\n" + "=".repeat(60));
    console.log("From: " + getHeader(headers, "From"));
    console.log("To: " + getHeader(headers, "To"));
    const cc = getHeader(headers, "Cc");
    if (cc) console.log("Cc: " + cc);
    console.log("Date: " + getHeader(headers, "Date"));
    console.log("Subject: " + getHeader(headers, "Subject"));
    console.log("=".repeat(60) + "\n");

    const body = extractBody(msg.payload);
    console.log(body.substring(0, 3000));

    if (body.length > 3000) {
      console.log("\n... (truncated, " + body.length + " chars total)");
    }

    // List attachments
    const attachments = [];
    function findAttachments(parts) {
      if (!parts) return;
      for (const part of parts) {
        if (part.filename && part.body?.attachmentId) {
          attachments.push({ name: part.filename, id: part.body.attachmentId, size: part.body.size });
        }
        if (part.parts) findAttachments(part.parts);
      }
    }
    findAttachments(msg.payload.parts);

    if (attachments.length > 0) {
      console.log("\nAttachments:");
      attachments.forEach(a => {
        console.log("  * " + a.name + " (" + Math.round(a.size / 1024) + " KB)");
      });
    }

    // Mark as read
    if (!flags["no-mark"]) {
      await gmail.users.messages.modify({
        userId: "me",
        id: messageId,
        resource: { removeLabelIds: ["UNREAD"] }
      });
    }
  },

  // ==================== SEARCH ====================
  async search(args) {
    const flags = parseFlags(args);
    const query = flags._[0] || flags.query || flags.q;

    if (!query) {
      console.log("Usage: gmail search 'search terms'");
      console.log("Examples:");
      console.log("  gmail search 'from:someone@email.com'");
      console.log("  gmail search 'subject:invoice'");
      console.log("  gmail search 'has:attachment'");
      console.log("  gmail search 'after:2026/01/01 before:2026/02/01'");
      return;
    }

    return this.inbox(["--query", query, "--limit", flags.limit || "20"]);
  },

  // ==================== SEND EMAIL ====================
  async send(args) {
    const flags = parseFlags(args);
    const to = flags.to || flags._[0];
    const subject = flags.subject || flags.s || "(No subject)";
    const body = flags.body || flags.message || flags.m || flags._[1] || "";
    const cc = flags.cc;
    const bcc = flags.bcc;

    if (!to) {
      console.log("Usage: gmail send --to 'email@example.com' --subject 'Subject' --body 'Message'");
      return;
    }

    let rawMessage = `To: ${to}\r\n`;
    if (cc) rawMessage += `Cc: ${cc}\r\n`;
    if (bcc) rawMessage += `Bcc: ${bcc}\r\n`;
    rawMessage += `Subject: ${subject}\r\n`;
    rawMessage += `Content-Type: text/plain; charset=utf-8\r\n\r\n`;
    rawMessage += body;

    const res = await gmail.users.messages.send({
      userId: "me",
      resource: { raw: encodeBase64(rawMessage) }
    });

    console.log("\nEmail sent successfully!");
    console.log("  To: " + to);
    console.log("  Subject: " + subject);
    console.log("  Message ID: " + res.data.id);
  },

  // ==================== REPLY ====================
  async reply(args) {
    const flags = parseFlags(args);
    const messageId = flags._[0];
    const body = flags.body || flags.message || flags.m || flags._[1];

    if (!messageId || !body) {
      console.log("Usage: gmail reply <messageId> --body 'Your reply message'");
      return;
    }

    // Get original message
    const original = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "metadata",
      metadataHeaders: ["From", "To", "Subject", "Message-ID"]
    });

    const headers = original.data.payload.headers;
    const from = getHeader(headers, "From");
    const subject = getHeader(headers, "Subject");
    const messageIdHeader = getHeader(headers, "Message-ID");
    const threadId = original.data.threadId;

    // Extract email from "Name <email>" format
    const emailMatch = from.match(/<([^>]+)>/) || [null, from];
    const replyTo = emailMatch[1];

    const replySubject = subject.startsWith("Re:") ? subject : "Re: " + subject;

    let rawMessage = `To: ${replyTo}\r\n`;
    rawMessage += `Subject: ${replySubject}\r\n`;
    rawMessage += `In-Reply-To: ${messageIdHeader}\r\n`;
    rawMessage += `References: ${messageIdHeader}\r\n`;
    rawMessage += `Content-Type: text/plain; charset=utf-8\r\n\r\n`;
    rawMessage += body;

    const res = await gmail.users.messages.send({
      userId: "me",
      resource: {
        raw: encodeBase64(rawMessage),
        threadId
      }
    });

    console.log("\nReply sent!");
    console.log("  To: " + replyTo);
    console.log("  Subject: " + replySubject);
  },

  // ==================== FORWARD ====================
  async forward(args) {
    const flags = parseFlags(args);
    const messageId = flags._[0];
    const to = flags.to || flags._[1];
    const note = flags.note || flags.body || "";

    if (!messageId || !to) {
      console.log("Usage: gmail forward <messageId> --to 'email@example.com' [--note 'Your note']");
      return;
    }

    // Get original message
    const original = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full"
    });

    const headers = original.data.payload.headers;
    const origFrom = getHeader(headers, "From");
    const origDate = getHeader(headers, "Date");
    const origSubject = getHeader(headers, "Subject");
    const origBody = extractBody(original.data.payload);

    const fwdSubject = origSubject.startsWith("Fwd:") ? origSubject : "Fwd: " + origSubject;

    let body = note ? note + "\r\n\r\n" : "";
    body += "---------- Forwarded message ---------\r\n";
    body += "From: " + origFrom + "\r\n";
    body += "Date: " + origDate + "\r\n";
    body += "Subject: " + origSubject + "\r\n\r\n";
    body += origBody;

    let rawMessage = `To: ${to}\r\n`;
    rawMessage += `Subject: ${fwdSubject}\r\n`;
    rawMessage += `Content-Type: text/plain; charset=utf-8\r\n\r\n`;
    rawMessage += body;

    const res = await gmail.users.messages.send({
      userId: "me",
      resource: { raw: encodeBase64(rawMessage) }
    });

    console.log("\nMessage forwarded!");
    console.log("  To: " + to);
    console.log("  Subject: " + fwdSubject);
  },

  // ==================== CREATE DRAFT ====================
  async draft(args) {
    const flags = parseFlags(args);
    const to = flags.to || flags._[0];
    const subject = flags.subject || flags.s || "(No subject)";
    const body = flags.body || flags.message || flags.m || "";

    if (!to) {
      console.log("Usage: gmail draft --to 'email@example.com' --subject 'Subject' --body 'Message'");
      return;
    }

    let rawMessage = `To: ${to}\r\n`;
    rawMessage += `Subject: ${subject}\r\n`;
    rawMessage += `Content-Type: text/plain; charset=utf-8\r\n\r\n`;
    rawMessage += body;

    const res = await gmail.users.drafts.create({
      userId: "me",
      resource: {
        message: { raw: encodeBase64(rawMessage) }
      }
    });

    console.log("\nDraft created!");
    console.log("  To: " + to);
    console.log("  Subject: " + subject);
    console.log("  Draft ID: " + res.data.id);
  },

  // ==================== LABELS ====================
  async labels() {
    const res = await gmail.users.labels.list({ userId: "me" });
    const labels = res.data.labels || [];

    console.log("\nLabels:\n");

    const system = labels.filter(l => l.type === "system");
    const user = labels.filter(l => l.type === "user");

    console.log("System Labels:");
    system.forEach(l => console.log("  * " + l.name));

    if (user.length > 0) {
      console.log("\nCustom Labels:");
      user.forEach(l => console.log("  * " + l.name + " (ID: " + l.id + ")"));
    }
  },

  async label(args) {
    const flags = parseFlags(args);
    const messageId = flags._[0];
    const addLabels = flags.add ? flags.add.split(",") : [];
    const removeLabels = flags.remove ? flags.remove.split(",") : [];

    if (!messageId || (addLabels.length === 0 && removeLabels.length === 0)) {
      console.log("Usage: gmail label <messageId> --add 'Label1,Label2' --remove 'Label3'");
      return;
    }

    await gmail.users.messages.modify({
      userId: "me",
      id: messageId,
      resource: {
        addLabelIds: addLabels,
        removeLabelIds: removeLabels
      }
    });

    console.log("\nLabels updated for message " + messageId);
    if (addLabels.length) console.log("  Added: " + addLabels.join(", "));
    if (removeLabels.length) console.log("  Removed: " + removeLabels.join(", "));
  },

  // ==================== STAR/UNSTAR ====================
  async star(args) {
    const messageId = args[0];
    if (!messageId) {
      console.log("Usage: gmail star <messageId>");
      return;
    }

    await gmail.users.messages.modify({
      userId: "me",
      id: messageId,
      resource: { addLabelIds: ["STARRED"] }
    });

    console.log("\nMessage starred.");
  },

  async unstar(args) {
    const messageId = args[0];
    if (!messageId) {
      console.log("Usage: gmail unstar <messageId>");
      return;
    }

    await gmail.users.messages.modify({
      userId: "me",
      id: messageId,
      resource: { removeLabelIds: ["STARRED"] }
    });

    console.log("\nMessage unstarred.");
  },

  // ==================== ARCHIVE ====================
  async archive(args) {
    const messageId = args[0];
    if (!messageId) {
      console.log("Usage: gmail archive <messageId>");
      return;
    }

    await gmail.users.messages.modify({
      userId: "me",
      id: messageId,
      resource: { removeLabelIds: ["INBOX"] }
    });

    console.log("\nMessage archived.");
  },

  // ==================== TRASH/DELETE ====================
  async trash(args) {
    const messageId = args[0];
    if (!messageId) {
      console.log("Usage: gmail trash <messageId>");
      return;
    }

    await gmail.users.messages.trash({
      userId: "me",
      id: messageId
    });

    console.log("\nMessage moved to trash.");
  },

  async delete(args) {
    const flags = parseFlags(args);
    const messageId = flags._[0];

    if (!messageId) {
      console.log("Usage: gmail delete <messageId> --confirm");
      console.log("Warning: This permanently deletes the message!");
      return;
    }

    if (!flags.confirm) {
      console.log("Add --confirm to permanently delete this message.");
      return;
    }

    await gmail.users.messages.delete({
      userId: "me",
      id: messageId
    });

    console.log("\nMessage permanently deleted.");
  },

  // ==================== MARK READ/UNREAD ====================
  async "mark-read"(args) {
    const messageId = args[0];
    if (!messageId) {
      console.log("Usage: gmail mark-read <messageId>");
      return;
    }

    await gmail.users.messages.modify({
      userId: "me",
      id: messageId,
      resource: { removeLabelIds: ["UNREAD"] }
    });

    console.log("\nMessage marked as read.");
  },

  async "mark-unread"(args) {
    const messageId = args[0];
    if (!messageId) {
      console.log("Usage: gmail mark-unread <messageId>");
      return;
    }

    await gmail.users.messages.modify({
      userId: "me",
      id: messageId,
      resource: { addLabelIds: ["UNREAD"] }
    });

    console.log("\nMessage marked as unread.");
  },

  // ==================== PROFILE ====================
  async profile() {
    const res = await gmail.users.getProfile({ userId: "me" });

    console.log("\nGmail Profile:");
    console.log("  Email: " + res.data.emailAddress);
    console.log("  Total Messages: " + res.data.messagesTotal);
    console.log("  Threads: " + res.data.threadsTotal);
  },

  // ==================== HELP ====================
  async help() {
    console.log(`
Gmail CLI

INBOX & MESSAGES:
  gmail inbox [--limit 10]              List inbox messages
  gmail unread                          List unread messages
  gmail starred                         List starred messages
  gmail sent                            List sent messages
  gmail drafts                          List drafts

  gmail read <messageId>                Read a message
  gmail search 'query'                  Search messages

COMPOSE & REPLY:
  gmail send --to 'email' --subject 'subj' --body 'message'
    [--cc 'email'] [--bcc 'email']

  gmail reply <messageId> --body 'reply message'
  gmail forward <messageId> --to 'email' [--note 'your note']
  gmail draft --to 'email' --subject 'subj' --body 'message'

ORGANIZE:
  gmail star <messageId>                Star a message
  gmail unstar <messageId>              Remove star
  gmail archive <messageId>             Archive (remove from inbox)
  gmail trash <messageId>               Move to trash
  gmail delete <messageId> --confirm    Permanently delete

  gmail mark-read <messageId>           Mark as read
  gmail mark-unread <messageId>         Mark as unread

  gmail labels                          List all labels
  gmail label <messageId> --add 'Label1' --remove 'Label2'

OTHER:
  gmail profile                         Show account info

SEARCH OPERATORS:
  from:sender@email.com                 From specific sender
  to:recipient@email.com                To specific recipient
  subject:keyword                       Subject contains
  has:attachment                        Has attachments
  is:unread, is:starred                 By status
  after:2026/01/01 before:2026/02/01    Date range
  label:LabelName                       By label
  filename:pdf                          Attachment type
`);
  }
};

// Aliases
commands.list = commands.inbox;
commands.ls = commands.inbox;
commands.mail = commands.inbox;
commands.compose = commands.send;
commands.new = commands.send;

const [cmd, ...args] = process.argv.slice(2);

if (!cmd || cmd === "help" || cmd === "--help") {
  commands.help();
} else if (commands[cmd]) {
  commands[cmd](args).catch(e => {
    console.error("Error:", e.message);
    process.exit(1);
  });
} else {
  console.log("Unknown command: " + cmd);
  console.log("Run 'gmail help' for usage.");
}
