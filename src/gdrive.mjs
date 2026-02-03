#!/usr/bin/env node
import { google } from "googleapis";
import fs from "fs";
import path from "path";
import { Readable } from "stream";

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

function extractFileId(input) {
  // Handle full URL or just ID
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9-_]+)/,
    /\/folders\/([a-zA-Z0-9-_]+)/,
    /id=([a-zA-Z0-9-_]+)/
  ];
  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) return match[1];
  }
  return input;
}

function formatSize(bytes) {
  if (!bytes) return "-";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) {
    bytes /= 1024;
    i++;
  }
  return bytes.toFixed(1) + " " + units[i];
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Bangkok"
  });
}

function getMimeIcon(mimeType) {
  if (!mimeType) return "📄";
  if (mimeType.includes("folder")) return "📁";
  if (mimeType.includes("document")) return "📝";
  if (mimeType.includes("spreadsheet")) return "📊";
  if (mimeType.includes("presentation")) return "📽️";
  if (mimeType.includes("image")) return "🖼️";
  if (mimeType.includes("video")) return "🎬";
  if (mimeType.includes("audio")) return "🎵";
  if (mimeType.includes("pdf")) return "📕";
  if (mimeType.includes("zip") || mimeType.includes("archive")) return "📦";
  return "📄";
}

const commands = {
  // ==================== LIST FILES ====================
  async list(args) {
    const flags = parseFlags(args);
    const folderId = flags.folder || flags.in || "root";
    const limit = parseInt(flags.limit) || 20;

    let query = `'${folderId}' in parents and trashed = false`;

    if (flags.type) {
      const typeMap = {
        folder: "application/vnd.google-apps.folder",
        doc: "application/vnd.google-apps.document",
        sheet: "application/vnd.google-apps.spreadsheet",
        slide: "application/vnd.google-apps.presentation",
        pdf: "application/pdf",
        image: "image/",
        video: "video/",
        audio: "audio/"
      };
      const mimeType = typeMap[flags.type.toLowerCase()];
      if (mimeType) {
        if (mimeType.endsWith("/")) {
          query += ` and mimeType contains '${mimeType}'`;
        } else {
          query += ` and mimeType = '${mimeType}'`;
        }
      }
    }

    const res = await drive.files.list({
      q: query,
      pageSize: limit,
      fields: "files(id, name, mimeType, size, modifiedTime, parents)",
      orderBy: flags.sort || "folder,name"
    });

    const files = res.data.files || [];
    if (files.length === 0) {
      console.log("No files found.");
      return;
    }

    console.log("\nFiles" + (folderId !== "root" ? " in folder" : "") + ":\n");

    // Separate folders and files
    const folders = files.filter(f => f.mimeType === "application/vnd.google-apps.folder");
    const otherFiles = files.filter(f => f.mimeType !== "application/vnd.google-apps.folder");

    [...folders, ...otherFiles].forEach(f => {
      const icon = getMimeIcon(f.mimeType);
      const size = f.mimeType === "application/vnd.google-apps.folder" ? "" : formatSize(f.size);
      console.log(icon + " " + f.name + (size ? " (" + size + ")" : ""));
      console.log("   ID: " + f.id);
    });

    console.log("\n(" + files.length + " items)");
  },

  // ==================== SEARCH FILES ====================
  async search(args) {
    const flags = parseFlags(args);
    const query = flags._[0] || flags.query || flags.q;

    if (!query) {
      console.log("Usage: gdrive search 'filename or keyword'");
      return;
    }

    const limit = parseInt(flags.limit) || 20;
    let q = `name contains '${query}' and trashed = false`;

    const res = await drive.files.list({
      q,
      pageSize: limit,
      fields: "files(id, name, mimeType, size, modifiedTime, webViewLink)",
      orderBy: "modifiedTime desc"
    });

    const files = res.data.files || [];
    if (files.length === 0) {
      console.log("No files found matching: " + query);
      return;
    }

    console.log("\nSearch Results:\n");
    files.forEach(f => {
      const icon = getMimeIcon(f.mimeType);
      console.log(icon + " " + f.name);
      console.log("   ID: " + f.id);
      console.log("   Modified: " + formatDate(f.modifiedTime));
      if (f.webViewLink) console.log("   Link: " + f.webViewLink);
      console.log("");
    });
  },

  // ==================== GET FILE INFO ====================
  async info(args) {
    const fileId = extractFileId(args[0]);
    if (!fileId) {
      console.log("Usage: gdrive info <fileId>");
      return;
    }

    const res = await drive.files.get({
      fileId,
      fields: "id,name,mimeType,size,createdTime,modifiedTime,owners,parents,webViewLink,webContentLink,shared,sharingUser"
    });

    const f = res.data;
    const icon = getMimeIcon(f.mimeType);

    console.log("\n" + icon + " " + f.name);
    console.log("  ID: " + f.id);
    console.log("  Type: " + f.mimeType);
    console.log("  Size: " + formatSize(f.size));
    console.log("  Created: " + formatDate(f.createdTime));
    console.log("  Modified: " + formatDate(f.modifiedTime));
    if (f.owners) console.log("  Owner: " + f.owners.map(o => o.emailAddress).join(", "));
    console.log("  Shared: " + (f.shared ? "Yes" : "No"));
    if (f.webViewLink) console.log("  View: " + f.webViewLink);
    if (f.webContentLink) console.log("  Download: " + f.webContentLink);
  },

  // ==================== CREATE FOLDER ====================
  async mkdir(args) {
    const flags = parseFlags(args);
    const name = flags._[0] || flags.name;
    const parentId = flags.in || flags.parent || "root";

    if (!name) {
      console.log("Usage: gdrive mkdir 'Folder Name' [--in <parentFolderId>]");
      return;
    }

    const res = await drive.files.create({
      requestBody: {
        name,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentId]
      },
      fields: "id, name, webViewLink"
    });

    console.log("\nFolder created: " + res.data.name);
    console.log("  ID: " + res.data.id);
    console.log("  Link: " + res.data.webViewLink);
  },

  // ==================== UPLOAD FILE ====================
  async upload(args) {
    const flags = parseFlags(args);
    const filePath = flags._[0] || flags.file;
    const folderId = flags.to || flags.folder || "root";
    const fileName = flags.name || path.basename(filePath);

    if (!filePath) {
      console.log("Usage: gdrive upload <localFile> [--to <folderId>] [--name 'newName']");
      return;
    }

    if (!fs.existsSync(filePath)) {
      console.log("File not found: " + filePath);
      return;
    }

    const fileSize = fs.statSync(filePath).size;
    console.log("\nUploading: " + fileName + " (" + formatSize(fileSize) + ")...");

    const res = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId]
      },
      media: {
        body: fs.createReadStream(filePath)
      },
      fields: "id, name, webViewLink, webContentLink"
    });

    console.log("\nUploaded successfully!");
    console.log("  ID: " + res.data.id);
    console.log("  Link: " + res.data.webViewLink);
  },

  // ==================== DOWNLOAD FILE ====================
  async download(args) {
    const flags = parseFlags(args);
    const fileId = extractFileId(flags._[0]);
    const output = flags.output || flags.o;

    if (!fileId) {
      console.log("Usage: gdrive download <fileId> [--output <filename>]");
      return;
    }

    // Get file metadata first
    const meta = await drive.files.get({
      fileId,
      fields: "name, mimeType, size"
    });

    const fileName = output || meta.data.name;
    const isGoogleDoc = meta.data.mimeType.startsWith("application/vnd.google-apps");

    console.log("\nDownloading: " + meta.data.name + "...");

    if (isGoogleDoc) {
      // Export Google Docs/Sheets/Slides
      const exportMimes = {
        "application/vnd.google-apps.document": { mime: "application/pdf", ext: ".pdf" },
        "application/vnd.google-apps.spreadsheet": { mime: "text/csv", ext: ".csv" },
        "application/vnd.google-apps.presentation": { mime: "application/pdf", ext: ".pdf" }
      };

      const exportInfo = exportMimes[meta.data.mimeType];
      if (!exportInfo) {
        console.log("Cannot download this file type. Use the web interface.");
        return;
      }

      const res = await drive.files.export({
        fileId,
        mimeType: exportInfo.mime
      }, { responseType: "arraybuffer" });

      const outputFile = output || (meta.data.name + exportInfo.ext);
      fs.writeFileSync(outputFile, Buffer.from(res.data));
      console.log("Exported to: " + outputFile);
    } else {
      // Download regular file
      const res = await drive.files.get({
        fileId,
        alt: "media"
      }, { responseType: "arraybuffer" });

      fs.writeFileSync(fileName, Buffer.from(res.data));
      console.log("Downloaded to: " + fileName);
    }
  },

  // ==================== DELETE FILE ====================
  async delete(args) {
    const flags = parseFlags(args);
    const fileId = extractFileId(flags._[0]);

    if (!fileId) {
      console.log("Usage: gdrive delete <fileId> [--permanent]");
      return;
    }

    if (flags.permanent) {
      if (!flags.confirm) {
        console.log("Add --confirm to permanently delete this file.");
        return;
      }
      await drive.files.delete({ fileId });
      console.log("\nFile permanently deleted.");
    } else {
      await drive.files.update({
        fileId,
        requestBody: { trashed: true }
      });
      console.log("\nFile moved to trash.");
    }
  },

  // ==================== TRASH / UNTRASH ====================
  async trash(args) {
    const fileId = extractFileId(args[0]);
    if (!fileId) {
      console.log("Usage: gdrive trash <fileId>");
      return;
    }

    await drive.files.update({
      fileId,
      requestBody: { trashed: true }
    });
    console.log("\nFile moved to trash.");
  },

  async untrash(args) {
    const fileId = extractFileId(args[0]);
    if (!fileId) {
      console.log("Usage: gdrive untrash <fileId>");
      return;
    }

    await drive.files.update({
      fileId,
      requestBody: { trashed: false }
    });
    console.log("\nFile restored from trash.");
  },

  // ==================== MOVE FILE ====================
  async move(args) {
    const flags = parseFlags(args);
    const fileId = extractFileId(flags._[0]);
    const newParentId = flags.to || flags._[1];

    if (!fileId || !newParentId) {
      console.log("Usage: gdrive move <fileId> --to <folderId>");
      return;
    }

    // Get current parents
    const file = await drive.files.get({
      fileId,
      fields: "parents"
    });

    const previousParents = file.data.parents?.join(",") || "";

    await drive.files.update({
      fileId,
      addParents: newParentId,
      removeParents: previousParents,
      fields: "id, parents"
    });

    console.log("\nFile moved successfully.");
  },

  // ==================== COPY FILE ====================
  async copy(args) {
    const flags = parseFlags(args);
    const fileId = extractFileId(flags._[0]);
    const newName = flags.name || flags.title;
    const folderId = flags.to || flags.folder;

    if (!fileId) {
      console.log("Usage: gdrive copy <fileId> [--name 'Copy Name'] [--to <folderId>]");
      return;
    }

    const requestBody = {};
    if (newName) requestBody.name = newName;
    if (folderId) requestBody.parents = [folderId];

    const res = await drive.files.copy({
      fileId,
      requestBody,
      fields: "id, name, webViewLink"
    });

    console.log("\nFile copied!");
    console.log("  New ID: " + res.data.id);
    console.log("  Name: " + res.data.name);
    console.log("  Link: " + res.data.webViewLink);
  },

  // ==================== RENAME FILE ====================
  async rename(args) {
    const flags = parseFlags(args);
    const fileId = extractFileId(flags._[0]);
    const newName = flags.name || flags.to || flags._[1];

    if (!fileId || !newName) {
      console.log("Usage: gdrive rename <fileId> --name 'New Name'");
      return;
    }

    await drive.files.update({
      fileId,
      requestBody: { name: newName }
    });

    console.log("\nFile renamed to: " + newName);
  },

  // ==================== SHARE FILE ====================
  async share(args) {
    const flags = parseFlags(args);
    const fileId = extractFileId(flags._[0]);
    const email = flags.email || flags.with || flags._[1];
    const role = flags.role || "reader"; // reader, writer, commenter

    if (!fileId) {
      console.log("Usage: gdrive share <fileId> --email 'user@example.com' --role reader|writer|commenter");
      console.log("   or: gdrive share <fileId> --anyone [--role reader]  # Make public");
      return;
    }

    if (flags.anyone) {
      // Make publicly accessible
      await drive.permissions.create({
        fileId,
        requestBody: {
          type: "anyone",
          role: role
        }
      });

      const file = await drive.files.get({ fileId, fields: "webViewLink" });
      console.log("\nFile is now public!");
      console.log("  Link: " + file.data.webViewLink);
    } else if (email) {
      await drive.permissions.create({
        fileId,
        requestBody: {
          type: "user",
          role: role,
          emailAddress: email
        },
        sendNotificationEmail: flags.notify ? true : false
      });

      console.log("\nShared with " + email + " as " + role);
    } else {
      console.log("Specify --email or --anyone");
    }
  },

  // ==================== UNSHARE / REMOVE PERMISSION ====================
  async unshare(args) {
    const flags = parseFlags(args);
    const fileId = extractFileId(flags._[0]);
    const email = flags.email || flags._[1];

    if (!fileId) {
      console.log("Usage: gdrive unshare <fileId> --email 'user@example.com'");
      console.log("   or: gdrive unshare <fileId> --anyone");
      return;
    }

    // List permissions
    const perms = await drive.permissions.list({
      fileId,
      fields: "permissions(id, emailAddress, type, role)"
    });

    let permId;
    if (flags.anyone) {
      const perm = perms.data.permissions.find(p => p.type === "anyone");
      if (perm) permId = perm.id;
    } else if (email) {
      const perm = perms.data.permissions.find(p => p.emailAddress === email);
      if (perm) permId = perm.id;
    }

    if (!permId) {
      console.log("Permission not found.");
      return;
    }

    await drive.permissions.delete({ fileId, permissionId: permId });
    console.log("\nPermission removed.");
  },

  // ==================== LIST PERMISSIONS ====================
  async permissions(args) {
    const fileId = extractFileId(args[0]);
    if (!fileId) {
      console.log("Usage: gdrive permissions <fileId>");
      return;
    }

    const res = await drive.permissions.list({
      fileId,
      fields: "permissions(id, emailAddress, type, role, displayName)"
    });

    const perms = res.data.permissions || [];
    if (perms.length === 0) {
      console.log("No permissions found.");
      return;
    }

    console.log("\nPermissions:\n");
    perms.forEach(p => {
      const who = p.type === "anyone" ? "Anyone with link" :
                  p.displayName || p.emailAddress || p.type;
      console.log("* " + who + " - " + p.role);
    });
  },

  // ==================== STORAGE QUOTA ====================
  async quota() {
    const res = await drive.about.get({
      fields: "storageQuota, user"
    });

    const quota = res.data.storageQuota;
    const user = res.data.user;

    console.log("\nGoogle Drive Storage:");
    console.log("  User: " + user.emailAddress);
    console.log("  Used: " + formatSize(quota.usage));
    console.log("  In Drive: " + formatSize(quota.usageInDrive));
    console.log("  In Trash: " + formatSize(quota.usageInDriveTrash));
    if (quota.limit) {
      console.log("  Limit: " + formatSize(quota.limit));
      const percent = ((quota.usage / quota.limit) * 100).toFixed(1);
      console.log("  Usage: " + percent + "%");
    } else {
      console.log("  Limit: Unlimited");
    }
  },

  // ==================== EMPTY TRASH ====================
  async "empty-trash"(args) {
    const flags = parseFlags(args);

    if (!flags.confirm) {
      console.log("This will permanently delete all files in trash.");
      console.log("Add --confirm to proceed.");
      return;
    }

    await drive.files.emptyTrash();
    console.log("\nTrash emptied.");
  },

  // ==================== LIST TRASH ====================
  async "list-trash"(args) {
    const flags = parseFlags(args);
    const limit = parseInt(flags.limit) || 20;

    const res = await drive.files.list({
      q: "trashed = true",
      pageSize: limit,
      fields: "files(id, name, mimeType, trashedTime)",
      orderBy: "trashedTime desc"
    });

    const files = res.data.files || [];
    if (files.length === 0) {
      console.log("Trash is empty.");
      return;
    }

    console.log("\nTrashed Files:\n");
    files.forEach(f => {
      const icon = getMimeIcon(f.mimeType);
      console.log(icon + " " + f.name);
      console.log("   ID: " + f.id);
      console.log("   Trashed: " + formatDate(f.trashedTime));
    });
  },

  // ==================== HELP ====================
  async help() {
    console.log(`
Google Drive CLI

FILES & FOLDERS:
  gdrive list [--folder <id>] [--type folder|doc|sheet|image]
  gdrive search 'query'                 Search files by name
  gdrive info <fileId>                  Get file details

  gdrive mkdir 'Folder Name' [--in <parentId>]
  gdrive upload <file> [--to <folderId>] [--name 'newName']
  gdrive download <fileId> [--output <filename>]

  gdrive move <fileId> --to <folderId>
  gdrive copy <fileId> [--name 'name'] [--to <folderId>]
  gdrive rename <fileId> --name 'New Name'
  gdrive delete <fileId>                Move to trash
  gdrive delete <fileId> --permanent --confirm

TRASH:
  gdrive trash <fileId>                 Move to trash
  gdrive untrash <fileId>               Restore from trash
  gdrive list-trash                     List trashed files
  gdrive empty-trash --confirm          Empty trash

SHARING:
  gdrive share <fileId> --email 'user@example.com' --role reader|writer
  gdrive share <fileId> --anyone        Make public
  gdrive unshare <fileId> --email 'user@example.com'
  gdrive unshare <fileId> --anyone      Remove public access
  gdrive permissions <fileId>           List who has access

STORAGE:
  gdrive quota                          Check storage usage

FILE TYPES (for --type filter):
  folder, doc, sheet, slide, pdf, image, video, audio
`);
  }
};

// Aliases
commands.ls = commands.list;
commands.find = commands.search;
commands.get = commands.download;
commands.put = commands.upload;
commands.rm = commands.delete;
commands.mv = commands.move;
commands.cp = commands.copy;

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
  console.log("Run 'gdrive help' for usage.");
}
