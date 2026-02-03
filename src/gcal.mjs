#!/usr/bin/env node
import { google } from "googleapis";
import fs from "fs";
import path from "path";

const HOME = process.env.HOME;
const CREDS_PATH = path.join(HOME, ".openclaw/credentials/google-oauth-client.json");
const TOKEN_PATH = path.join(HOME, ".openclaw/credentials/google-token.json");

// Default timezone for display
const DEFAULT_TZ = "Asia/Bangkok";

function getAuth() {
  const creds = JSON.parse(fs.readFileSync(CREDS_PATH));
  const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH));
  const { client_id, client_secret } = creds.installed || creds.web;
  const auth = new google.auth.OAuth2(client_id, client_secret);
  auth.setCredentials(tokens);
  return auth;
}

const auth = getAuth();
const calendar = google.calendar({ version: "v3", auth });

function parseDuration(input) {
  const match = input.match(/(\d+)\s*(h|hr|hour|m|min)?/i);
  if (!match) return 60;
  const value = parseInt(match[1]);
  const unit = match[2]?.toLowerCase() || "h";
  return unit.startsWith("m") ? value : value * 60;
}

function parseDateTime(input) {
  const now = new Date();
  let date = new Date(input);

  if (isNaN(date.getTime())) {
    const lower = input.toLowerCase().replace(/\s+/g, ' ').trim();
    date = new Date(now);

    // Handle relative days
    if (lower.includes("today")) {
      // date is already now
    } else if (lower.includes("tomorrow") || lower.includes("tmr") || lower.includes("tmrw")) {
      date.setDate(date.getDate() + 1);
    } else if (lower.includes("next week")) {
      date.setDate(date.getDate() + 7);
    } else {
      // Check for day names
      const days = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
      for (let i = 0; i < days.length; i++) {
        if (lower.includes(days[i])) {
          const diff = (i - now.getDay() + 7) % 7 || 7;
          date.setDate(date.getDate() + diff);
          break;
        }
      }
    }

    // Parse time - handle formats like "9am", "9:00 AM", "14:00", "2pm", "9:00 am tomorrow"
    const timeMatch = input.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm|AM|PM)?/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const mins = parseInt(timeMatch[2] || "0");
      const ampm = timeMatch[3]?.toLowerCase();

      // Handle 12-hour format
      if (ampm === "pm" && hours < 12) hours += 12;
      if (ampm === "am" && hours === 12) hours = 0;

      // If no am/pm and hours <= 7, assume PM for business hours
      if (!ampm && hours >= 1 && hours <= 7) hours += 12;

      date.setHours(hours, mins, 0, 0);
    } else {
      // Default to 9am if no time specified
      date.setHours(9, 0, 0, 0);
    }
  }
  return date;
}

function formatEvent(event, tz = DEFAULT_TZ) {
  const start = event.start?.dateTime || event.start?.date;
  const end = event.end?.dateTime || event.end?.date;
  const startDate = new Date(start);
  const endDate = new Date(end);

  const dateStr = startDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: tz });
  const timeStr = event.start?.dateTime
    ? startDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz }) + " - " + endDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz })
    : "All day";

  return {
    id: event.id,
    title: event.summary || "(No title)",
    date: dateStr,
    time: timeStr,
    location: event.location || "",
    attendees: event.attendees?.map(a => a.email).join(", ") || "",
    description: event.description || "",
    link: event.htmlLink
  };
}

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

const commands = {
  async list(args) {
    const days = parseInt(args[0]) || 7;
    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    const res = await calendar.events.list({
      calendarId: "primary",
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 50
    });

    const events = res.data.items || [];
    if (events.length === 0) {
      console.log("No events in the next " + days + " days.");
      return;
    }

    console.log("\nEvents (next " + days + " days):\n");
    events.forEach(e => {
      const f = formatEvent(e);
      console.log("* " + f.date + " | " + f.time);
      console.log("  " + f.title + (f.location ? " @ " + f.location : ""));
      if (f.attendees) console.log("  Attendees: " + f.attendees);
      console.log("  ID: " + f.id + "\n");
    });
  },

  async today() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const res = await calendar.events.list({
      calendarId: "primary",
      timeMin: now.toISOString(),
      timeMax: tomorrow.toISOString(),
      singleEvents: true,
      orderBy: "startTime"
    });

    const events = res.data.items || [];
    if (events.length === 0) {
      console.log("No events today.");
      return;
    }

    console.log("\nToday's Events:\n");
    events.forEach(e => {
      const f = formatEvent(e);
      console.log("* " + f.time + " - " + f.title);
    });
  },

  async tomorrow() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);

    const res = await calendar.events.list({
      calendarId: "primary",
      timeMin: tomorrow.toISOString(),
      timeMax: dayAfter.toISOString(),
      singleEvents: true,
      orderBy: "startTime"
    });

    const events = res.data.items || [];
    if (events.length === 0) {
      console.log("No events tomorrow.");
      return;
    }

    console.log("\nTomorrow's Events:\n");
    events.forEach(e => {
      const f = formatEvent(e);
      console.log("* " + f.time + " - " + f.title);
    });
  },

  async week() {
    return this.list(["7"]);
  },

  async create(args) {
    const flags = parseFlags(args);
    // Support both positional and --title flag
    const title = flags.title || flags.name || flags._[0] || "New Event";

    // Support --time, --start, --when aliases
    const startInput = flags.start || flags.time || flags.when || flags.at || "tomorrow 9am";

    // Default timezone to Bangkok
    let timeZone = flags.timezone || flags.tz || "Asia/Bangkok";

    // Handle ISO string with timezone offset - extract local time
    let startDateTime;
    let endDateTime;

    const isoMatch = startInput.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}(?::\d{2})?)([+-]\d{2}:\d{2})?/);
    if (isoMatch) {
      // ISO format: use the date and time as-is (the time is already in the target timezone)
      const timeStr = isoMatch[2].length === 5 ? isoMatch[2] + ":00" : isoMatch[2];
      startDateTime = isoMatch[1] + "T" + timeStr;

      // Calculate end time
      const durationMins = flags.duration ? parseDuration(flags.duration) : 60;
      const [h, m] = timeStr.split(":").map(Number);
      const endMins = h * 60 + m + durationMins;
      const endH = Math.floor(endMins / 60) % 24;
      const endM = endMins % 60;
      endDateTime = isoMatch[1] + "T" + String(endH).padStart(2,"0") + ":" + String(endM).padStart(2,"0") + ":00";
    } else {
      // Natural language - parse it
      const startTime = parseDateTime(startInput);
      let endTime;

      if (flags.end) {
        endTime = parseDateTime(flags.end);
      } else if (flags.duration) {
        const durationMins = parseDuration(flags.duration);
        endTime = new Date(startTime.getTime() + durationMins * 60 * 1000);
      } else {
        endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
      }

      // Format as local time string (not UTC)
      const pad = (n) => String(n).padStart(2, "0");
      const formatLocal = (d) => {
        return d.getFullYear() + "-" + pad(d.getMonth()+1) + "-" + pad(d.getDate()) +
               "T" + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":00";
      };
      startDateTime = formatLocal(startTime);
      endDateTime = formatLocal(endTime);
    }

    const event = {
      summary: title,
      start: { dateTime: startDateTime, timeZone: timeZone },
      end: { dateTime: endDateTime, timeZone: timeZone }
    };

    if (flags.location || flags.place || flags.where) {
      event.location = flags.location || flags.place || flags.where;
    }
    if (flags.description || flags.desc || flags.notes) {
      event.description = flags.description || flags.desc || flags.notes;
    }
    // Support --attendees, --guests, --invite aliases
    const attendeeList = flags.attendees || flags.guests || flags.invite || flags.invites;
    if (attendeeList) {
      event.attendees = attendeeList.split(",").map(email => ({ email: email.trim() }));
    }

    if (flags.repeat) {
      const freq = flags.repeat.toUpperCase();
      const count = flags.count || 10;
      event.recurrence = ["RRULE:FREQ=" + freq + ";COUNT=" + count];
    }

    if (flags.reminder || flags["email-reminder"]) {
      const overrides = [];
      if (flags.reminder) {
        overrides.push({ method: "popup", minutes: parseInt(flags.reminder) });
      }
      if (flags["email-reminder"]) {
        overrides.push({ method: "email", minutes: parseInt(flags["email-reminder"]) });
      }
      event.reminders = { useDefault: false, overrides };
    }

    const res = await calendar.events.insert({
      calendarId: "primary",
      resource: event,
      sendUpdates: flags.notify ? "all" : "none"
    });

    console.log("\nEvent created: " + res.data.summary);
    console.log("  When: " + startDateTime + " (" + timeZone + ")");
    console.log("  Link: " + res.data.htmlLink);
    console.log("  ID: " + res.data.id);
  },

  async quick(args) {
    const text = args.join(" ");
    const res = await calendar.events.quickAdd({
      calendarId: "primary",
      text
    });

    console.log("\nEvent created: " + res.data.summary);
    console.log("  Link: " + res.data.htmlLink);
    console.log("  ID: " + res.data.id);
  },

  async update(args) {
    const flags = parseFlags(args);
    const eventId = flags._[0];

    if (!eventId) {
      console.log("Usage: gcal update <eventId> --title 'New Title' --start 'new time'");
      return;
    }

    const existing = await calendar.events.get({ calendarId: "primary", eventId });
    const event = existing.data;

    if (flags.title) event.summary = flags.title;
    if (flags.location) event.location = flags.location;
    if (flags.description) event.description = flags.description;

    if (flags.start) {
      const newStart = parseDateTime(flags.start);
      const duration = new Date(event.end.dateTime) - new Date(event.start.dateTime);
      event.start.dateTime = newStart.toISOString();
      event.end.dateTime = new Date(newStart.getTime() + duration).toISOString();
    }

    if (flags.attendees) {
      const newAttendees = flags.attendees.split(",").map(email => ({ email: email.trim() }));
      event.attendees = [...(event.attendees || []), ...newAttendees];
    }

    const res = await calendar.events.update({
      calendarId: "primary",
      eventId,
      resource: event,
      sendUpdates: flags.notify ? "all" : "none"
    });

    console.log("\nEvent updated: " + res.data.summary);
  },

  async move(args) {
    const flags = parseFlags(args);
    const eventId = flags._[0];

    if (!eventId || !flags.start) {
      console.log("Usage: gcal move <eventId> --start 'new time'");
      return;
    }

    return this.update([eventId, "--start", flags.start]);
  },

  async delete(args) {
    const flags = parseFlags(args);
    const eventId = flags._[0];

    if (!eventId) {
      console.log("Usage: gcal delete <eventId>");
      return;
    }

    await calendar.events.delete({
      calendarId: "primary",
      eventId,
      sendUpdates: flags.notify ? "all" : "none"
    });

    console.log("\nEvent deleted.");
  },

  async cancel(args) {
    const flags = parseFlags(args);
    return this.delete([flags._[0], "--notify"]);
  },

  async busy(args) {
    const date = args[0] ? parseDateTime(args[0]) : new Date();
    date.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    const res = await calendar.freebusy.query({
      resource: {
        timeMin: date.toISOString(),
        timeMax: endDate.toISOString(),
        items: [{ id: "primary" }]
      }
    });

    const busy = res.data.calendars?.primary?.busy || [];

    if (busy.length === 0) {
      console.log("\nNo busy times - you're free all day!");
      return;
    }

    console.log("\nBusy times (" + DEFAULT_TZ + "):\n");
    busy.forEach(b => {
      const start = new Date(b.start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: DEFAULT_TZ });
      const end = new Date(b.end).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: DEFAULT_TZ });
      console.log("  " + start + " - " + end);
    });
  },

  async free(args) {
    const date = args[0] ? parseDateTime(args[0]) : new Date();
    date.setHours(9, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(18, 0, 0, 0);

    const res = await calendar.freebusy.query({
      resource: {
        timeMin: date.toISOString(),
        timeMax: endDate.toISOString(),
        items: [{ id: "primary" }]
      }
    });

    const busy = res.data.calendars?.primary?.busy || [];
    const freeSlots = [];
    let current = new Date(date);

    for (const b of busy) {
      const busyStart = new Date(b.start);
      if (current < busyStart) {
        freeSlots.push({ start: new Date(current), end: busyStart });
      }
      current = new Date(b.end);
    }

    if (current < endDate) {
      freeSlots.push({ start: current, end: endDate });
    }

    if (freeSlots.length === 0) {
      console.log("\nNo free slots available.");
      return;
    }

    console.log("\nFree slots (" + DEFAULT_TZ + "):\n");
    freeSlots.forEach(s => {
      const start = s.start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: DEFAULT_TZ });
      const end = s.end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: DEFAULT_TZ });
      console.log("  " + start + " - " + end);
    });
  },

  async freebusy(args) {
    const flags = parseFlags(args);
    const email = flags._[0];
    const date = flags.date ? parseDateTime(flags.date) : new Date();
    date.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() + 1);

    if (!email) {
      console.log("Usage: gcal freebusy <email> --date 'date'");
      return;
    }

    const res = await calendar.freebusy.query({
      resource: {
        timeMin: date.toISOString(),
        timeMax: endDate.toISOString(),
        items: [{ id: email }]
      }
    });

    const busy = res.data.calendars?.[email]?.busy || [];
    const errors = res.data.calendars?.[email]?.errors;

    if (errors) {
      console.log("\nCannot check " + email + ": " + errors[0]?.reason);
      return;
    }

    if (busy.length === 0) {
      console.log("\n" + email + " is free all day!");
      return;
    }

    console.log("\n" + email + " busy times (" + DEFAULT_TZ + "):\n");
    busy.forEach(b => {
      const start = new Date(b.start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: DEFAULT_TZ });
      const end = new Date(b.end).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: DEFAULT_TZ });
      console.log("  " + start + " - " + end);
    });
  },

  async calendars() {
    const res = await calendar.calendarList.list();
    const cals = res.data.items || [];

    console.log("\nYour Calendars:\n");
    cals.forEach(c => {
      const primary = c.primary ? " (primary)" : "";
      const access = c.accessRole ? " [" + c.accessRole + "]" : "";
      console.log("* " + c.summary + primary + access);
      console.log("  ID: " + c.id + "\n");
    });
  },

  // Create a new calendar
  async "create-calendar"(args) {
    const flags = parseFlags(args);
    const name = flags._[0];

    if (!name) {
      console.log("Usage: gcal create-calendar 'Calendar Name' [--description 'desc'] [--timezone 'tz']");
      return;
    }

    const calendarData = {
      summary: name,
      timeZone: flags.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
    };

    if (flags.description) calendarData.description = flags.description;

    const res = await calendar.calendars.insert({ resource: calendarData });

    console.log("\nCalendar created: " + res.data.summary);
    console.log("  ID: " + res.data.id);
  },

  // Delete a calendar
  async "delete-calendar"(args) {
    const calendarId = args[0];

    if (!calendarId) {
      console.log("Usage: gcal delete-calendar <calendarId>");
      console.log("Note: Cannot delete primary calendar");
      return;
    }

    if (calendarId === "primary") {
      console.log("Error: Cannot delete primary calendar");
      return;
    }

    await calendar.calendars.delete({ calendarId });
    console.log("\nCalendar deleted.");
  },

  // Share a calendar
  async share(args) {
    const flags = parseFlags(args);
    const calendarId = flags._[0] || "primary";
    const email = flags.email;
    const role = flags.role || "reader"; // reader, writer, owner

    if (!email) {
      console.log("Usage: gcal share <calendarId> --email 'user@email.com' [--role reader|writer|owner]");
      console.log("Roles: reader (see events), writer (edit events), owner (full control)");
      return;
    }

    const acl = {
      role: role,
      scope: {
        type: "user",
        value: email
      }
    };

    const res = await calendar.acl.insert({
      calendarId,
      resource: acl
    });

    console.log("\nCalendar shared with " + email + " as " + role);
  },

  // List calendar permissions
  async permissions(args) {
    const calendarId = args[0] || "primary";

    const res = await calendar.acl.list({ calendarId });
    const rules = res.data.items || [];

    console.log("\nCalendar Permissions:\n");
    rules.forEach(r => {
      const scope = r.scope.type === "default" ? "Anyone" : r.scope.value;
      console.log("* " + scope + " - " + r.role);
    });
  },

  // Remove calendar sharing
  async unshare(args) {
    const flags = parseFlags(args);
    const calendarId = flags._[0] || "primary";
    const email = flags.email;

    if (!email) {
      console.log("Usage: gcal unshare <calendarId> --email 'user@email.com'");
      return;
    }

    const ruleId = "user:" + email;
    await calendar.acl.delete({ calendarId, ruleId });

    console.log("\nRemoved " + email + " from calendar.");
  },

  // Update a single instance of recurring event
  async "update-instance"(args) {
    const flags = parseFlags(args);
    const recurringEventId = flags._[0];
    const instanceDate = flags.instance; // Date of the instance to modify

    if (!recurringEventId || !instanceDate) {
      console.log("Usage: gcal update-instance <recurringEventId> --instance '2024-01-15' [--title 'New'] [--start 'time']");
      return;
    }

    // Get instances of the recurring event
    const instances = await calendar.events.instances({
      calendarId: "primary",
      eventId: recurringEventId
    });

    const targetDate = new Date(instanceDate);
    targetDate.setHours(0, 0, 0, 0);

    // Find the instance on the specified date
    const instance = instances.data.items?.find(e => {
      const eventDate = new Date(e.start.dateTime || e.start.date);
      eventDate.setHours(0, 0, 0, 0);
      return eventDate.getTime() === targetDate.getTime();
    });

    if (!instance) {
      console.log("No instance found on " + instanceDate);
      return;
    }

    // Update the instance
    if (flags.title) instance.summary = flags.title;
    if (flags.location) instance.location = flags.location;
    if (flags.description) instance.description = flags.description;

    if (flags.start) {
      const newStart = parseDateTime(flags.start);
      const duration = new Date(instance.end.dateTime) - new Date(instance.start.dateTime);
      instance.start.dateTime = newStart.toISOString();
      instance.end.dateTime = new Date(newStart.getTime() + duration).toISOString();
    }

    const res = await calendar.events.update({
      calendarId: "primary",
      eventId: instance.id,
      resource: instance
    });

    console.log("\nInstance updated: " + res.data.summary);
    console.log("  Date: " + new Date(res.data.start.dateTime).toLocaleDateString("en-US", { timeZone: DEFAULT_TZ }));
  },

  // List instances of a recurring event
  async instances(args) {
    const eventId = args[0];

    if (!eventId) {
      console.log("Usage: gcal instances <recurringEventId>");
      return;
    }

    const res = await calendar.events.instances({
      calendarId: "primary",
      eventId,
      maxResults: 10
    });

    const items = res.data.items || [];

    if (items.length === 0) {
      console.log("No instances found.");
      return;
    }

    console.log("\nRecurring Event Instances:\n");
    items.forEach(e => {
      const f = formatEvent(e);
      console.log("* " + f.date + " | " + f.time + " - " + f.title);
      console.log("  Instance ID: " + e.id + "\n");
    });
  },

  async get(args) {
    const eventId = args[0];
    if (!eventId) {
      console.log("Usage: gcal get <eventId>");
      return;
    }

    const res = await calendar.events.get({ calendarId: "primary", eventId });
    const f = formatEvent(res.data);

    console.log("\n" + f.title);
    console.log("  Date: " + f.date);
    console.log("  Time: " + f.time);
    if (f.location) console.log("  Location: " + f.location);
    if (f.attendees) console.log("  Attendees: " + f.attendees);
    if (f.description) console.log("  Description: " + f.description);
    console.log("  Link: " + f.link);
  },

  async help() {
    console.log(`
Google Calendar CLI

EVENTS:
  gcal list [days]              List events for next N days
  gcal today                    Today's events
  gcal tomorrow                 Tomorrow's events
  gcal week                     This week's events
  gcal get <eventId>            Get event details

  gcal create "Title" --start "time" [options]
    --end "time"                End time
    --duration 1h               Duration (30m, 2h, etc)
    --location "place"          Location
    --description "text"        Description
    --attendees "a@b.com,..."   Invite attendees
    --repeat DAILY|WEEKLY|MONTHLY
    --count N                   Repeat count
    --reminder 15               Popup reminder (minutes before)
    --email-reminder 60         Email reminder (minutes before)
    --notify                    Send email invites to attendees

  gcal quick "text"             Quick add with natural language
  gcal update <id> [options]    Update event
  gcal move <id> --start "time" Move event to new time
  gcal delete <id>              Delete event
  gcal cancel <id>              Delete and notify attendees

RECURRING EVENTS:
  gcal create "Title" --repeat DAILY|WEEKLY|MONTHLY --count 10
  gcal instances <eventId>      List instances of recurring event
  gcal update-instance <eventId> --instance "2024-01-15" [options]
                                Modify single occurrence

AVAILABILITY:
  gcal busy [date]              Show busy times
  gcal free [date]              Show free slots (9am-6pm)
  gcal freebusy <email> --date  Check someone's availability

CALENDARS:
  gcal calendars                List all calendars
  gcal create-calendar "Name"   Create new calendar
    --description "desc"        Calendar description
    --timezone "tz"             Timezone (default: local)
  gcal delete-calendar <id>     Delete a calendar

SHARING:
  gcal share <calId> --email "user@email.com" --role reader|writer|owner
  gcal unshare <calId> --email "user@email.com"
  gcal permissions [calId]      List calendar permissions
`);
  }
};

// Command aliases
commands.add = commands.create;
commands.new = commands.create;
commands.schedule = commands.create;
commands.meeting = commands.create;
commands.event = commands.create;
commands.rm = commands.delete;
commands.remove = commands.delete;
commands.ls = commands.list;
commands.show = commands.list;
commands.availability = commands.free;
commands.check = commands.list;

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
  console.log("Run 'gcal help' for usage.");
}
