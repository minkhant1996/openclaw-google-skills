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
const docs = google.docs({ version: "v1", auth });
const drive = google.drive({ version: "v3", auth });

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

function extractDocId(input) {
  // Handle full URL or just ID
  const match = input.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : input;
}

function extractText(content) {
  let text = "";
  if (content.content) {
    for (const element of content.content) {
      if (element.paragraph) {
        for (const elem of element.paragraph.elements || []) {
          if (elem.textRun) {
            text += elem.textRun.content;
          }
        }
      } else if (element.table) {
        for (const row of element.table.tableRows || []) {
          const cells = [];
          for (const cell of row.tableCells || []) {
            cells.push(extractText(cell).trim());
          }
          text += "| " + cells.join(" | ") + " |\n";
        }
        text += "\n";
      }
    }
  }
  return text;
}

const commands = {
  // ==================== LIST DOCUMENTS ====================
  async list(args) {
    const flags = parseFlags(args);
    const limit = parseInt(flags.limit) || 20;

    const res = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.document'",
      pageSize: limit,
      fields: "files(id, name, modifiedTime, webViewLink)",
      orderBy: "modifiedTime desc"
    });

    const files = res.data.files || [];
    if (files.length === 0) {
      console.log("No documents found.");
      return;
    }

    console.log("\nYour Documents:\n");
    files.forEach(f => {
      const modified = new Date(f.modifiedTime).toLocaleDateString();
      console.log("* " + f.name);
      console.log("  ID: " + f.id);
      console.log("  Modified: " + modified);
      console.log("  Link: " + f.webViewLink + "\n");
    });
  },

  // ==================== CREATE DOCUMENT ====================
  async create(args) {
    const flags = parseFlags(args);
    const title = flags._[0] || flags.title || "Untitled Document";

    const res = await docs.documents.create({
      requestBody: { title }
    });

    console.log("\nDocument created: " + res.data.title);
    console.log("  ID: " + res.data.documentId);
    console.log("  Link: https://docs.google.com/document/d/" + res.data.documentId + "/edit");

    // If initial content provided, add it
    if (flags.content || flags.body || flags.text) {
      const content = flags.content || flags.body || flags.text;
      await docs.documents.batchUpdate({
        documentId: res.data.documentId,
        requestBody: {
          requests: [{
            insertText: {
              location: { index: 1 },
              text: content
            }
          }]
        }
      });
      console.log("  Content added.");
    }
  },

  // ==================== GET DOCUMENT INFO ====================
  async info(args) {
    const documentId = extractDocId(args[0]);
    if (!documentId) {
      console.log("Usage: gdocs info <documentId>");
      return;
    }

    const res = await docs.documents.get({ documentId });
    const doc = res.data;

    console.log("\n" + doc.title);
    console.log("  ID: " + doc.documentId);
    console.log("  Link: https://docs.google.com/document/d/" + doc.documentId + "/edit");

    // Get file metadata for more info
    const file = await drive.files.get({
      fileId: documentId,
      fields: "createdTime,modifiedTime,owners,size"
    });

    console.log("  Created: " + new Date(file.data.createdTime).toLocaleString());
    console.log("  Modified: " + new Date(file.data.modifiedTime).toLocaleString());
    if (file.data.owners) {
      console.log("  Owner: " + file.data.owners.map(o => o.emailAddress).join(", "));
    }
  },

  // ==================== READ DOCUMENT ====================
  async read(args) {
    const flags = parseFlags(args);
    const documentId = extractDocId(flags._[0]);

    if (!documentId) {
      console.log("Usage: gdocs read <documentId>");
      return;
    }

    const res = await docs.documents.get({ documentId });
    const doc = res.data;

    console.log("\n" + "=".repeat(60));
    console.log(doc.title);
    console.log("=".repeat(60) + "\n");

    const text = extractText(doc.body);

    if (flags.raw) {
      console.log(JSON.stringify(doc.body, null, 2));
    } else {
      const maxLen = parseInt(flags.limit) || 5000;
      console.log(text.substring(0, maxLen));
      if (text.length > maxLen) {
        console.log("\n... (truncated, " + text.length + " chars total)");
      }
    }
  },

  // ==================== APPEND TEXT ====================
  async append(args) {
    const flags = parseFlags(args);
    const documentId = extractDocId(flags._[0]);
    const text = flags.text || flags.content || flags._[1];

    if (!documentId || !text) {
      console.log("Usage: gdocs append <documentId> --text 'Your text here'");
      return;
    }

    // Get document to find end index
    const doc = await docs.documents.get({ documentId });
    const endIndex = doc.data.body.content[doc.data.body.content.length - 1].endIndex - 1;

    await docs.documents.batchUpdate({
      documentId,
      requestBody: {
        requests: [{
          insertText: {
            location: { index: endIndex },
            text: "\n" + text
          }
        }]
      }
    });

    console.log("\nText appended to document.");
  },

  // ==================== INSERT TEXT ====================
  async insert(args) {
    const flags = parseFlags(args);
    const documentId = extractDocId(flags._[0]);
    const text = flags.text || flags.content || flags._[1];
    const index = parseInt(flags.index || flags.at) || 1;

    if (!documentId || !text) {
      console.log("Usage: gdocs insert <documentId> --text 'Text' --index 1");
      return;
    }

    await docs.documents.batchUpdate({
      documentId,
      requestBody: {
        requests: [{
          insertText: {
            location: { index },
            text
          }
        }]
      }
    });

    console.log("\nText inserted at index " + index);
  },

  // ==================== REPLACE TEXT ====================
  async replace(args) {
    const flags = parseFlags(args);
    const documentId = extractDocId(flags._[0]);
    const find = flags.find || flags._[1];
    const replaceText = flags.replace || flags.with || flags._[2] || "";

    if (!documentId || !find) {
      console.log("Usage: gdocs replace <documentId> --find 'old text' --replace 'new text'");
      return;
    }

    const res = await docs.documents.batchUpdate({
      documentId,
      requestBody: {
        requests: [{
          replaceAllText: {
            containsText: {
              text: find,
              matchCase: flags.case ? true : false
            },
            replaceText
          }
        }]
      }
    });

    const replaced = res.data.replies[0].replaceAllText.occurrencesChanged || 0;
    console.log("\nReplaced " + replaced + " occurrence(s).");
  },

  // ==================== ADD HEADING ====================
  async heading(args) {
    const flags = parseFlags(args);
    const documentId = extractDocId(flags._[0]);
    const text = flags.text || flags._[1];
    const level = parseInt(flags.level) || 1; // 1-6

    if (!documentId || !text) {
      console.log("Usage: gdocs heading <documentId> --text 'Heading' --level 1");
      return;
    }

    // Get end index
    const doc = await docs.documents.get({ documentId });
    const endIndex = doc.data.body.content[doc.data.body.content.length - 1].endIndex - 1;

    const headingType = "HEADING_" + Math.min(Math.max(level, 1), 6);

    await docs.documents.batchUpdate({
      documentId,
      requestBody: {
        requests: [
          {
            insertText: {
              location: { index: endIndex },
              text: "\n" + text + "\n"
            }
          },
          {
            updateParagraphStyle: {
              range: {
                startIndex: endIndex + 1,
                endIndex: endIndex + 1 + text.length
              },
              paragraphStyle: { namedStyleType: headingType },
              fields: "namedStyleType"
            }
          }
        ]
      }
    });

    console.log("\nHeading added (H" + level + ")");
  },

  // ==================== ADD BULLET LIST ====================
  async bullets(args) {
    const flags = parseFlags(args);
    const documentId = extractDocId(flags._[0]);
    const items = flags.items || flags._[1];

    if (!documentId || !items) {
      console.log("Usage: gdocs bullets <documentId> --items 'Item 1,Item 2,Item 3'");
      return;
    }

    const itemList = items.split(",").map(i => i.trim());

    // Get end index
    const doc = await docs.documents.get({ documentId });
    const endIndex = doc.data.body.content[doc.data.body.content.length - 1].endIndex - 1;

    const text = "\n" + itemList.join("\n") + "\n";

    await docs.documents.batchUpdate({
      documentId,
      requestBody: {
        requests: [
          {
            insertText: {
              location: { index: endIndex },
              text
            }
          },
          {
            createParagraphBullets: {
              range: {
                startIndex: endIndex + 1,
                endIndex: endIndex + text.length - 1
              },
              bulletPreset: flags.numbered ? "NUMBERED_DECIMAL_NESTED" : "BULLET_DISC_CIRCLE_SQUARE"
            }
          }
        ]
      }
    });

    console.log("\nBullet list added (" + itemList.length + " items)");
  },

  // ==================== ADD TABLE ====================
  async table(args) {
    const flags = parseFlags(args);
    const documentId = extractDocId(flags._[0]);
    const rows = parseInt(flags.rows) || 3;
    const cols = parseInt(flags.cols || flags.columns) || 3;

    if (!documentId) {
      console.log("Usage: gdocs table <documentId> --rows 3 --cols 3");
      return;
    }

    // Get end index
    const doc = await docs.documents.get({ documentId });
    const endIndex = doc.data.body.content[doc.data.body.content.length - 1].endIndex - 1;

    await docs.documents.batchUpdate({
      documentId,
      requestBody: {
        requests: [{
          insertTable: {
            location: { index: endIndex },
            rows,
            columns: cols
          }
        }]
      }
    });

    console.log("\nTable added (" + rows + "x" + cols + ")");
  },

  // ==================== FORMAT TEXT ====================
  async format(args) {
    const flags = parseFlags(args);
    const documentId = extractDocId(flags._[0]);
    const startIndex = parseInt(flags.start);
    const endIndex = parseInt(flags.end);

    if (!documentId || isNaN(startIndex) || isNaN(endIndex)) {
      console.log("Usage: gdocs format <documentId> --start 1 --end 10 [options]");
      console.log("Options:");
      console.log("  --bold          Make text bold");
      console.log("  --italic        Make text italic");
      console.log("  --underline     Underline text");
      console.log("  --strike        Strikethrough");
      console.log("  --size 14       Font size (pt)");
      console.log("  --color red     Text color");
      console.log("  --bg yellow     Background color");
      console.log("  --font 'Arial'  Font family");
      return;
    }

    const textStyle = {};
    const fields = [];

    if (flags.bold) { textStyle.bold = true; fields.push("bold"); }
    if (flags.italic) { textStyle.italic = true; fields.push("italic"); }
    if (flags.underline) { textStyle.underline = true; fields.push("underline"); }
    if (flags.strike) { textStyle.strikethrough = true; fields.push("strikethrough"); }

    if (flags.size) {
      textStyle.fontSize = { magnitude: parseInt(flags.size), unit: "PT" };
      fields.push("fontSize");
    }

    if (flags.font) {
      textStyle.weightedFontFamily = { fontFamily: flags.font };
      fields.push("weightedFontFamily");
    }

    if (flags.color) {
      textStyle.foregroundColor = { color: { rgbColor: parseColor(flags.color) } };
      fields.push("foregroundColor");
    }

    if (flags.bg || flags.background) {
      textStyle.backgroundColor = { color: { rgbColor: parseColor(flags.bg || flags.background) } };
      fields.push("backgroundColor");
    }

    await docs.documents.batchUpdate({
      documentId,
      requestBody: {
        requests: [{
          updateTextStyle: {
            range: { startIndex, endIndex },
            textStyle,
            fields: fields.join(",")
          }
        }]
      }
    });

    console.log("\nFormatting applied to range " + startIndex + "-" + endIndex);
  },

  // ==================== EXPORT DOCUMENT ====================
  async export(args) {
    const flags = parseFlags(args);
    const documentId = extractDocId(flags._[0]);
    const format = (flags.format || flags.as || "pdf").toLowerCase();
    const output = flags.output || flags.o || ("document." + format);

    if (!documentId) {
      console.log("Usage: gdocs export <documentId> --format pdf|docx|txt|html --output file.pdf");
      return;
    }

    const mimeTypes = {
      pdf: "application/pdf",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      txt: "text/plain",
      html: "text/html",
      rtf: "application/rtf",
      odt: "application/vnd.oasis.opendocument.text"
    };

    const mimeType = mimeTypes[format];
    if (!mimeType) {
      console.log("Supported formats: pdf, docx, txt, html, rtf, odt");
      return;
    }

    const res = await drive.files.export({
      fileId: documentId,
      mimeType
    }, { responseType: "arraybuffer" });

    fs.writeFileSync(output, Buffer.from(res.data));
    console.log("\nExported to: " + output);
  },

  // ==================== COPY DOCUMENT ====================
  async copy(args) {
    const flags = parseFlags(args);
    const documentId = extractDocId(flags._[0]);
    const newTitle = flags.title || flags.name || flags._[1];

    if (!documentId) {
      console.log("Usage: gdocs copy <documentId> --title 'New Document Name'");
      return;
    }

    const res = await drive.files.copy({
      fileId: documentId,
      requestBody: {
        name: newTitle
      }
    });

    console.log("\nDocument copied!");
    console.log("  New ID: " + res.data.id);
    console.log("  Link: https://docs.google.com/document/d/" + res.data.id + "/edit");
  },

  // ==================== DELETE DOCUMENT ====================
  async delete(args) {
    const flags = parseFlags(args);
    const documentId = extractDocId(flags._[0]);

    if (!documentId) {
      console.log("Usage: gdocs delete <documentId> --confirm");
      return;
    }

    if (!flags.confirm) {
      console.log("Add --confirm to delete this document.");
      return;
    }

    await drive.files.delete({ fileId: documentId });
    console.log("\nDocument deleted.");
  },

  // ==================== SHARE DOCUMENT ====================
  async share(args) {
    const flags = parseFlags(args);
    const documentId = extractDocId(flags._[0]);
    const email = flags.email || flags._[1];
    const role = flags.role || "reader"; // reader, writer, commenter

    if (!documentId || !email) {
      console.log("Usage: gdocs share <documentId> --email 'user@example.com' --role reader|writer|commenter");
      return;
    }

    await drive.permissions.create({
      fileId: documentId,
      requestBody: {
        type: "user",
        role: role === "commenter" ? "commenter" : role,
        emailAddress: email
      },
      sendNotificationEmail: flags.notify ? true : false
    });

    console.log("\nShared with " + email + " as " + role);
  },

  // ==================== SEARCH DOCUMENTS ====================
  async search(args) {
    const flags = parseFlags(args);
    const query = flags._[0] || flags.query || flags.q;

    if (!query) {
      console.log("Usage: gdocs search 'search terms'");
      return;
    }

    const res = await drive.files.list({
      q: `mimeType='application/vnd.google-apps.document' and fullText contains '${query}'`,
      pageSize: parseInt(flags.limit) || 10,
      fields: "files(id, name, modifiedTime, webViewLink)",
      orderBy: "modifiedTime desc"
    });

    const files = res.data.files || [];
    if (files.length === 0) {
      console.log("No documents found matching: " + query);
      return;
    }

    console.log("\nSearch Results:\n");
    files.forEach(f => {
      console.log("* " + f.name);
      console.log("  ID: " + f.id);
      console.log("  Link: " + f.webViewLink + "\n");
    });
  },

  // ==================== HELP ====================
  async help() {
    console.log(`
Google Docs CLI

DOCUMENTS:
  gdocs list [--limit 20]               List your documents
  gdocs create "Title"                  Create new document
    [--content "Initial text"]          With initial content
  gdocs info <id>                       Get document details
  gdocs read <id>                       Read document content
  gdocs search "query"                  Search documents

EDITING:
  gdocs append <id> --text "Text"       Append text to end
  gdocs insert <id> --text "Text" --index 1   Insert at position
  gdocs replace <id> --find "old" --replace "new"
  gdocs heading <id> --text "Title" --level 1
  gdocs bullets <id> --items "A,B,C" [--numbered]
  gdocs table <id> --rows 3 --cols 3

FORMATTING:
  gdocs format <id> --start 1 --end 10 [options]
    --bold, --italic, --underline, --strike
    --size 14, --color red, --bg yellow
    --font "Arial"

EXPORT:
  gdocs export <id> --format pdf --output file.pdf
    Formats: pdf, docx, txt, html, rtf, odt

MANAGE:
  gdocs copy <id> --title "Copy Name"
  gdocs delete <id> --confirm
  gdocs share <id> --email "user@email.com" --role writer
`);
  }
};

// Helper: Parse color name to RGB
function parseColor(color) {
  const colors = {
    red: { red: 1, green: 0, blue: 0 },
    green: { red: 0, green: 0.8, blue: 0 },
    blue: { red: 0, green: 0, blue: 1 },
    yellow: { red: 1, green: 1, blue: 0 },
    orange: { red: 1, green: 0.6, blue: 0 },
    purple: { red: 0.5, green: 0, blue: 0.5 },
    pink: { red: 1, green: 0.75, blue: 0.8 },
    white: { red: 1, green: 1, blue: 1 },
    black: { red: 0, green: 0, blue: 0 },
    gray: { red: 0.5, green: 0.5, blue: 0.5 }
  };

  if (colors[color.toLowerCase()]) {
    return colors[color.toLowerCase()];
  }

  // Parse hex color #RRGGBB
  if (color.startsWith("#")) {
    const hex = color.slice(1);
    return {
      red: parseInt(hex.slice(0, 2), 16) / 255,
      green: parseInt(hex.slice(2, 4), 16) / 255,
      blue: parseInt(hex.slice(4, 6), 16) / 255
    };
  }

  return colors.black;
}

// Aliases
commands.ls = commands.list;
commands.new = commands.create;
commands.get = commands.read;
commands.view = commands.read;
commands.add = commands.append;
commands.find = commands.search;

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
  console.log("Run 'gdocs help' for usage.");
}
