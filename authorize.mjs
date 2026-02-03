#!/usr/bin/env node
/**
 * OAuth Authorization Script
 * Run this once to generate google-token.json
 */

import { google } from "googleapis";
import http from "http";
import fs from "fs";
import path from "path";
import { exec } from "child_process";

const HOME = process.env.HOME;
const CREDS_DIR = path.join(HOME, ".openclaw/credentials");
const CREDS_PATH = path.join(CREDS_DIR, "google-oauth-client.json");
const TOKEN_PATH = path.join(CREDS_DIR, "google-token.json");

const SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly"
];

async function authorize() {
  // Check if credentials exist
  if (!fs.existsSync(CREDS_PATH)) {
    console.error("Error: OAuth client credentials not found!");
    console.error("");
    console.error("Please download your OAuth 2.0 Client ID from Google Cloud Console");
    console.error("and save it as:");
    console.error("  " + CREDS_PATH);
    console.error("");
    console.error("Steps:");
    console.error("1. Go to https://console.cloud.google.com");
    console.error("2. APIs & Services > Credentials");
    console.error("3. Create OAuth 2.0 Client ID (Desktop app)");
    console.error("4. Download JSON and save to the path above");
    process.exit(1);
  }

  // Check if already authorized
  if (fs.existsSync(TOKEN_PATH)) {
    console.log("Token already exists at: " + TOKEN_PATH);
    console.log("Delete it first if you want to re-authorize.");
    process.exit(0);
  }

  // Load credentials
  const creds = JSON.parse(fs.readFileSync(CREDS_PATH));
  const { client_id, client_secret, redirect_uris } = creds.installed || creds.web;

  // Use localhost for redirect
  const redirectUri = "http://localhost:3000/oauth2callback";

  const oauth2Client = new google.auth.OAuth2(client_id, client_secret, redirectUri);

  // Generate auth URL
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent"
  });

  console.log("Opening browser for authorization...");
  console.log("");
  console.log("If browser doesn't open, visit this URL:");
  console.log(authUrl);
  console.log("");

  // Open browser
  const openCmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  exec(`${openCmd} "${authUrl}"`);

  // Start local server to receive callback
  const server = http.createServer(async (req, res) => {
    if (req.url.startsWith("/oauth2callback")) {
      const url = new URL(req.url, "http://localhost:3000");
      const code = url.searchParams.get("code");

      if (code) {
        try {
          const { tokens } = await oauth2Client.getToken(code);

          // Save tokens
          fs.mkdirSync(CREDS_DIR, { recursive: true });
          fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));

          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(`
            <html>
              <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                <h1>Authorization Successful!</h1>
                <p>You can close this window and return to the terminal.</p>
              </body>
            </html>
          `);

          console.log("Authorization successful!");
          console.log("Token saved to: " + TOKEN_PATH);
          console.log("");
          console.log("You can now use: gcal, gsheet, gmail");

          server.close();
          process.exit(0);
        } catch (err) {
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end("Error: " + err.message);
          console.error("Error getting tokens:", err.message);
          server.close();
          process.exit(1);
        }
      } else {
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("No authorization code received");
      }
    }
  });

  server.listen(3000, () => {
    console.log("Waiting for authorization...");
  });
}

authorize().catch(console.error);
