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
const sheets = google.sheets({ version: "v4", auth });
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

function extractSpreadsheetId(input) {
  // Handle full URL or just ID
  const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : input;
}

function parseValues(input) {
  // Parse comma-separated or JSON array
  if (input.startsWith("[")) {
    return JSON.parse(input);
  }
  return input.split(",").map(v => v.trim());
}

function formatCellValue(value) {
  if (value === null || value === undefined) return "";
  return String(value);
}

const commands = {
  // ==================== LIST SPREADSHEETS ====================
  async list(args) {
    const flags = parseFlags(args);
    const limit = parseInt(flags.limit) || 20;

    const res = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.spreadsheet'",
      pageSize: limit,
      fields: "files(id, name, modifiedTime, webViewLink)",
      orderBy: "modifiedTime desc"
    });

    const files = res.data.files || [];
    if (files.length === 0) {
      console.log("No spreadsheets found.");
      return;
    }

    console.log("\nYour Spreadsheets:\n");
    files.forEach(f => {
      const modified = new Date(f.modifiedTime).toLocaleDateString();
      console.log("* " + f.name);
      console.log("  ID: " + f.id);
      console.log("  Modified: " + modified);
      console.log("  Link: " + f.webViewLink + "\n");
    });
  },

  // ==================== CREATE SPREADSHEET ====================
  async create(args) {
    const flags = parseFlags(args);
    const title = flags._[0] || flags.title || "New Spreadsheet";
    const sheetNames = flags.sheets ? flags.sheets.split(",") : ["Sheet1"];

    const resource = {
      properties: { title },
      sheets: sheetNames.map(name => ({
        properties: { title: name.trim() }
      }))
    };

    const res = await sheets.spreadsheets.create({ resource });

    console.log("\nSpreadsheet created: " + res.data.properties.title);
    console.log("  ID: " + res.data.spreadsheetId);
    console.log("  Link: " + res.data.spreadsheetUrl);
    console.log("  Sheets: " + res.data.sheets.map(s => s.properties.title).join(", "));
  },

  // ==================== GET SPREADSHEET INFO ====================
  async info(args) {
    const spreadsheetId = extractSpreadsheetId(args[0]);
    if (!spreadsheetId) {
      console.log("Usage: gsheet info <spreadsheetId>");
      return;
    }

    const res = await sheets.spreadsheets.get({ spreadsheetId });
    const data = res.data;

    console.log("\n" + data.properties.title);
    console.log("  ID: " + data.spreadsheetId);
    console.log("  URL: " + data.spreadsheetUrl);
    console.log("  Locale: " + data.properties.locale);
    console.log("  Timezone: " + data.properties.timeZone);
    console.log("\nSheets:");
    data.sheets.forEach(s => {
      const props = s.properties;
      console.log("  * " + props.title + " (ID: " + props.sheetId + ")");
      console.log("    Rows: " + props.gridProperties.rowCount + ", Cols: " + props.gridProperties.columnCount);
    });
  },

  // ==================== READ DATA ====================
  async read(args) {
    const flags = parseFlags(args);
    const spreadsheetId = extractSpreadsheetId(flags._[0]);
    const range = flags.range || flags._[1] || "A1:Z100";

    if (!spreadsheetId) {
      console.log("Usage: gsheet read <spreadsheetId> --range 'Sheet1!A1:D10'");
      return;
    }

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
      valueRenderOption: flags.formula ? "FORMULA" : "FORMATTED_VALUE"
    });

    const rows = res.data.values || [];
    if (rows.length === 0) {
      console.log("No data found in range: " + range);
      return;
    }

    console.log("\nData from " + range + ":\n");

    if (flags.json) {
      console.log(JSON.stringify(rows, null, 2));
    } else if (flags.csv) {
      rows.forEach(row => console.log(row.map(c => formatCellValue(c)).join(",")));
    } else {
      // Table format
      const colWidths = [];
      rows.forEach(row => {
        row.forEach((cell, i) => {
          const len = formatCellValue(cell).length;
          colWidths[i] = Math.max(colWidths[i] || 0, len, 3);
        });
      });

      rows.forEach((row, rowIdx) => {
        const formatted = row.map((cell, i) =>
          formatCellValue(cell).padEnd(colWidths[i])
        ).join(" | ");
        console.log(formatted);
        if (rowIdx === 0 && flags.header) {
          console.log(colWidths.map(w => "-".repeat(w)).join("-+-"));
        }
      });
    }

    console.log("\n(" + rows.length + " rows)");
  },

  // ==================== WRITE DATA ====================
  async write(args) {
    const flags = parseFlags(args);
    const spreadsheetId = extractSpreadsheetId(flags._[0]);
    const range = flags.range || flags._[1];
    const value = flags.value || flags.values || flags._[2];

    if (!spreadsheetId || !range) {
      console.log("Usage: gsheet write <spreadsheetId> --range 'A1' --value 'Hello'");
      console.log("       gsheet write <spreadsheetId> --range 'A1:C1' --values 'a,b,c'");
      console.log("       gsheet write <spreadsheetId> --range 'A1:B2' --values '[[1,2],[3,4]]'");
      return;
    }

    let values;
    if (value.startsWith("[[")) {
      values = JSON.parse(value);
    } else if (value.startsWith("[")) {
      values = [JSON.parse(value)];
    } else if (value.includes(",")) {
      values = [value.split(",").map(v => v.trim())];
    } else {
      values = [[value]];
    }

    const res = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: flags.raw ? "RAW" : "USER_ENTERED",
      resource: { values }
    });

    console.log("\nUpdated " + res.data.updatedCells + " cells in " + res.data.updatedRange);
  },

  // ==================== APPEND ROWS ====================
  async append(args) {
    const flags = parseFlags(args);
    const spreadsheetId = extractSpreadsheetId(flags._[0]);
    const range = flags.range || flags.sheet || "Sheet1";
    const valuesInput = flags.values || flags._[1];

    if (!spreadsheetId || !valuesInput) {
      console.log("Usage: gsheet append <spreadsheetId> --values 'col1,col2,col3'");
      console.log("       gsheet append <spreadsheetId> --values '[[row1],[row2]]' --range 'Sheet1'");
      return;
    }

    let values;
    if (valuesInput.startsWith("[[")) {
      values = JSON.parse(valuesInput);
    } else if (valuesInput.startsWith("[")) {
      values = [JSON.parse(valuesInput)];
    } else {
      values = [valuesInput.split(",").map(v => v.trim())];
    }

    const res = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: flags.raw ? "RAW" : "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      resource: { values }
    });

    console.log("\nAppended " + values.length + " row(s) to " + res.data.updates.updatedRange);
  },

  // ==================== CLEAR DATA ====================
  async clear(args) {
    const flags = parseFlags(args);
    const spreadsheetId = extractSpreadsheetId(flags._[0]);
    const range = flags.range || flags._[1];

    if (!spreadsheetId || !range) {
      console.log("Usage: gsheet clear <spreadsheetId> --range 'A1:D10'");
      return;
    }

    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range
    });

    console.log("\nCleared range: " + range);
  },

  // ==================== ADD SHEET (TAB) ====================
  async "add-sheet"(args) {
    const flags = parseFlags(args);
    const spreadsheetId = extractSpreadsheetId(flags._[0]);
    const title = flags.title || flags.name || flags._[1] || "New Sheet";

    if (!spreadsheetId) {
      console.log("Usage: gsheet add-sheet <spreadsheetId> --title 'Sheet Name'");
      return;
    }

    const res = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [{
          addSheet: {
            properties: { title }
          }
        }]
      }
    });

    const newSheet = res.data.replies[0].addSheet.properties;
    console.log("\nSheet added: " + newSheet.title + " (ID: " + newSheet.sheetId + ")");
  },

  // ==================== DELETE SHEET (TAB) ====================
  async "delete-sheet"(args) {
    const flags = parseFlags(args);
    const spreadsheetId = extractSpreadsheetId(flags._[0]);
    const sheetId = parseInt(flags.id || flags._[1]);

    if (!spreadsheetId || isNaN(sheetId)) {
      console.log("Usage: gsheet delete-sheet <spreadsheetId> --id <sheetId>");
      console.log("Use 'gsheet info <id>' to find sheet IDs");
      return;
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [{
          deleteSheet: { sheetId }
        }]
      }
    });

    console.log("\nSheet deleted (ID: " + sheetId + ")");
  },

  // ==================== RENAME SHEET ====================
  async "rename-sheet"(args) {
    const flags = parseFlags(args);
    const spreadsheetId = extractSpreadsheetId(flags._[0]);
    const sheetId = parseInt(flags.id || flags._[1]);
    const newTitle = flags.title || flags.name || flags._[2];

    if (!spreadsheetId || isNaN(sheetId) || !newTitle) {
      console.log("Usage: gsheet rename-sheet <spreadsheetId> --id <sheetId> --title 'New Name'");
      return;
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [{
          updateSheetProperties: {
            properties: { sheetId, title: newTitle },
            fields: "title"
          }
        }]
      }
    });

    console.log("\nSheet renamed to: " + newTitle);
  },

  // ==================== COPY SHEET ====================
  async "copy-sheet"(args) {
    const flags = parseFlags(args);
    const spreadsheetId = extractSpreadsheetId(flags._[0]);
    const sheetId = parseInt(flags.id || flags._[1]);
    const destSpreadsheetId = flags.to ? extractSpreadsheetId(flags.to) : spreadsheetId;

    if (!spreadsheetId || isNaN(sheetId)) {
      console.log("Usage: gsheet copy-sheet <spreadsheetId> --id <sheetId> [--to <destSpreadsheetId>]");
      return;
    }

    const res = await sheets.spreadsheets.sheets.copyTo({
      spreadsheetId,
      sheetId,
      resource: { destinationSpreadsheetId: destSpreadsheetId }
    });

    console.log("\nSheet copied: " + res.data.title + " (ID: " + res.data.sheetId + ")");
  },

  // ==================== FORMAT CELLS ====================
  async format(args) {
    const flags = parseFlags(args);
    const spreadsheetId = extractSpreadsheetId(flags._[0]);
    const range = flags.range || flags._[1];

    if (!spreadsheetId || !range) {
      console.log("Usage: gsheet format <spreadsheetId> --range 'A1:B5' [options]");
      console.log("Options:");
      console.log("  --bold          Make text bold");
      console.log("  --italic        Make text italic");
      console.log("  --underline     Underline text");
      console.log("  --size 12       Font size");
      console.log("  --color red     Text color (red, blue, green, or hex #RRGGBB)");
      console.log("  --bg yellow     Background color");
      console.log("  --align center  Horizontal align (left, center, right)");
      console.log("  --valign middle Vertical align (top, middle, bottom)");
      console.log("  --wrap          Enable text wrapping");
      console.log("  --number '$#,##0.00' Number format");
      return;
    }

    // Parse range to get sheet and cell coordinates
    const [sheetName, cellRange] = range.includes("!") ? range.split("!") : ["Sheet1", range];

    // Get sheet ID
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const sheet = spreadsheet.data.sheets.find(s =>
      s.properties.title.toLowerCase() === sheetName.toLowerCase()
    );

    if (!sheet) {
      console.log("Sheet not found: " + sheetName);
      return;
    }

    const sheetId = sheet.properties.sheetId;

    // Parse cell range (e.g., A1:B5)
    const rangeMatch = cellRange.match(/([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?/i);
    if (!rangeMatch) {
      console.log("Invalid range format: " + cellRange);
      return;
    }

    const colToIndex = (col) => {
      let index = 0;
      for (let i = 0; i < col.length; i++) {
        index = index * 26 + (col.charCodeAt(i) - 64);
      }
      return index - 1;
    };

    const startCol = colToIndex(rangeMatch[1].toUpperCase());
    const startRow = parseInt(rangeMatch[2]) - 1;
    const endCol = rangeMatch[3] ? colToIndex(rangeMatch[3].toUpperCase()) + 1 : startCol + 1;
    const endRow = rangeMatch[4] ? parseInt(rangeMatch[4]) : startRow + 1;

    // Build format request
    const cellFormat = { userEnteredFormat: {} };
    const fields = [];

    // Text format
    const textFormat = {};
    if (flags.bold) { textFormat.bold = true; fields.push("userEnteredFormat.textFormat.bold"); }
    if (flags.italic) { textFormat.italic = true; fields.push("userEnteredFormat.textFormat.italic"); }
    if (flags.underline) { textFormat.underline = true; fields.push("userEnteredFormat.textFormat.underline"); }
    if (flags.size) { textFormat.fontSize = parseInt(flags.size); fields.push("userEnteredFormat.textFormat.fontSize"); }

    if (flags.color) {
      textFormat.foregroundColor = parseColor(flags.color);
      fields.push("userEnteredFormat.textFormat.foregroundColor");
    }

    if (Object.keys(textFormat).length > 0) {
      cellFormat.userEnteredFormat.textFormat = textFormat;
    }

    // Background color
    if (flags.bg || flags.background) {
      cellFormat.userEnteredFormat.backgroundColor = parseColor(flags.bg || flags.background);
      fields.push("userEnteredFormat.backgroundColor");
    }

    // Alignment
    if (flags.align) {
      cellFormat.userEnteredFormat.horizontalAlignment = flags.align.toUpperCase();
      fields.push("userEnteredFormat.horizontalAlignment");
    }
    if (flags.valign) {
      cellFormat.userEnteredFormat.verticalAlignment = flags.valign.toUpperCase();
      fields.push("userEnteredFormat.verticalAlignment");
    }

    // Text wrapping
    if (flags.wrap) {
      cellFormat.userEnteredFormat.wrapStrategy = "WRAP";
      fields.push("userEnteredFormat.wrapStrategy");
    }

    // Number format
    if (flags.number || flags.format) {
      cellFormat.userEnteredFormat.numberFormat = {
        type: "NUMBER",
        pattern: flags.number || flags.format
      };
      fields.push("userEnteredFormat.numberFormat");
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [{
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: startRow,
              endRowIndex: endRow,
              startColumnIndex: startCol,
              endColumnIndex: endCol
            },
            cell: cellFormat,
            fields: fields.join(",")
          }
        }]
      }
    });

    console.log("\nFormatted range: " + range);
  },

  // ==================== MERGE CELLS ====================
  async merge(args) {
    const flags = parseFlags(args);
    const spreadsheetId = extractSpreadsheetId(flags._[0]);
    const range = flags.range || flags._[1];
    const mergeType = flags.type || "MERGE_ALL"; // MERGE_ALL, MERGE_COLUMNS, MERGE_ROWS

    if (!spreadsheetId || !range) {
      console.log("Usage: gsheet merge <spreadsheetId> --range 'A1:C3'");
      console.log("       --type MERGE_ALL|MERGE_COLUMNS|MERGE_ROWS");
      return;
    }

    const gridRange = await parseGridRange(spreadsheetId, range);

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [{
          mergeCells: {
            range: gridRange,
            mergeType
          }
        }]
      }
    });

    console.log("\nMerged cells: " + range);
  },

  // ==================== UNMERGE CELLS ====================
  async unmerge(args) {
    const flags = parseFlags(args);
    const spreadsheetId = extractSpreadsheetId(flags._[0]);
    const range = flags.range || flags._[1];

    if (!spreadsheetId || !range) {
      console.log("Usage: gsheet unmerge <spreadsheetId> --range 'A1:C3'");
      return;
    }

    const gridRange = await parseGridRange(spreadsheetId, range);

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [{
          unmergeCells: { range: gridRange }
        }]
      }
    });

    console.log("\nUnmerged cells: " + range);
  },

  // ==================== ADD CHART ====================
  async "add-chart"(args) {
    const flags = parseFlags(args);
    const spreadsheetId = extractSpreadsheetId(flags._[0]);
    const range = flags.range || flags._[1];
    const chartType = (flags.type || "COLUMN").toUpperCase();
    const title = flags.title || "Chart";

    if (!spreadsheetId || !range) {
      console.log("Usage: gsheet add-chart <spreadsheetId> --range 'A1:B10' --type column --title 'My Chart'");
      console.log("Types: COLUMN, BAR, LINE, AREA, PIE, SCATTER");
      return;
    }

    const gridRange = await parseGridRange(spreadsheetId, range);

    const chartSpec = {
      title,
      basicChart: {
        chartType,
        legendPosition: "BOTTOM_LEGEND",
        axis: [
          { position: "BOTTOM_AXIS" },
          { position: "LEFT_AXIS" }
        ],
        domains: [{
          domain: { sourceRange: { sources: [gridRange] } }
        }],
        series: [{
          series: { sourceRange: { sources: [gridRange] } },
          targetAxis: "LEFT_AXIS"
        }]
      }
    };

    if (chartType === "PIE") {
      delete chartSpec.basicChart;
      chartSpec.pieChart = {
        legendPosition: "RIGHT_LEGEND",
        domain: { sourceRange: { sources: [gridRange] } },
        series: { sourceRange: { sources: [gridRange] } }
      };
    }

    const res = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [{
          addChart: {
            chart: {
              spec: chartSpec,
              position: {
                overlayPosition: {
                  anchorCell: {
                    sheetId: gridRange.sheetId,
                    rowIndex: 0,
                    columnIndex: gridRange.endColumnIndex + 1
                  }
                }
              }
            }
          }
        }]
      }
    });

    console.log("\nChart created: " + title);
  },

  // ==================== ADD FILTER ====================
  async filter(args) {
    const flags = parseFlags(args);
    const spreadsheetId = extractSpreadsheetId(flags._[0]);
    const range = flags.range || flags._[1];

    if (!spreadsheetId || !range) {
      console.log("Usage: gsheet filter <spreadsheetId> --range 'A1:D100'");
      return;
    }

    const gridRange = await parseGridRange(spreadsheetId, range);

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [{
          setBasicFilter: {
            filter: { range: gridRange }
          }
        }]
      }
    });

    console.log("\nFilter added to range: " + range);
  },

  // ==================== SORT DATA ====================
  async sort(args) {
    const flags = parseFlags(args);
    const spreadsheetId = extractSpreadsheetId(flags._[0]);
    const range = flags.range || flags._[1];
    const column = parseInt(flags.column || flags.col || "0");
    const order = (flags.order || "asc").toLowerCase() === "desc" ? "DESCENDING" : "ASCENDING";

    if (!spreadsheetId || !range) {
      console.log("Usage: gsheet sort <spreadsheetId> --range 'A1:D100' --column 0 --order asc");
      return;
    }

    const gridRange = await parseGridRange(spreadsheetId, range);

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [{
          sortRange: {
            range: gridRange,
            sortSpecs: [{
              dimensionIndex: column,
              sortOrder: order
            }]
          }
        }]
      }
    });

    console.log("\nSorted by column " + column + " (" + order.toLowerCase() + ")");
  },

  // ==================== DATA VALIDATION (DROPDOWN) ====================
  async dropdown(args) {
    const flags = parseFlags(args);
    const spreadsheetId = extractSpreadsheetId(flags._[0]);
    const range = flags.range || flags._[1];
    const values = flags.values || flags._[2];

    if (!spreadsheetId || !range || !values) {
      console.log("Usage: gsheet dropdown <spreadsheetId> --range 'A1:A10' --values 'Option1,Option2,Option3'");
      return;
    }

    const gridRange = await parseGridRange(spreadsheetId, range);
    const options = values.split(",").map(v => ({ userEnteredValue: v.trim() }));

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [{
          setDataValidation: {
            range: gridRange,
            rule: {
              condition: {
                type: "ONE_OF_LIST",
                values: options
              },
              showCustomUi: true,
              strict: true
            }
          }
        }]
      }
    });

    console.log("\nDropdown added to range: " + range);
  },

  // ==================== CONDITIONAL FORMATTING ====================
  async "conditional-format"(args) {
    const flags = parseFlags(args);
    const spreadsheetId = extractSpreadsheetId(flags._[0]);
    const range = flags.range || flags._[1];
    const condition = flags.condition || "greater_than";
    const value = flags.value;
    const color = flags.color || "green";

    if (!spreadsheetId || !range) {
      console.log("Usage: gsheet conditional-format <spreadsheetId> --range 'A1:A10' --condition greater_than --value 100 --color green");
      console.log("Conditions: greater_than, less_than, equal, not_empty, text_contains");
      return;
    }

    const gridRange = await parseGridRange(spreadsheetId, range);

    const conditionTypes = {
      "greater_than": "NUMBER_GREATER",
      "less_than": "NUMBER_LESS",
      "equal": "NUMBER_EQ",
      "not_empty": "NOT_BLANK",
      "text_contains": "TEXT_CONTAINS"
    };

    const booleanCondition = {
      type: conditionTypes[condition] || "NUMBER_GREATER"
    };

    if (value !== undefined) {
      booleanCondition.values = [{ userEnteredValue: value }];
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [{
          addConditionalFormatRule: {
            rule: {
              ranges: [gridRange],
              booleanRule: {
                condition: booleanCondition,
                format: {
                  backgroundColor: parseColor(color)
                }
              }
            },
            index: 0
          }
        }]
      }
    });

    console.log("\nConditional formatting added to: " + range);
  },

  // ==================== PROTECT RANGE ====================
  async protect(args) {
    const flags = parseFlags(args);
    const spreadsheetId = extractSpreadsheetId(flags._[0]);
    const range = flags.range || flags._[1];
    const description = flags.description || flags.desc || "Protected range";

    if (!spreadsheetId || !range) {
      console.log("Usage: gsheet protect <spreadsheetId> --range 'A1:D10' --description 'Do not edit'");
      return;
    }

    const gridRange = await parseGridRange(spreadsheetId, range);

    const res = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [{
          addProtectedRange: {
            protectedRange: {
              range: gridRange,
              description,
              warningOnly: flags.warning ? true : false
            }
          }
        }]
      }
    });

    console.log("\nProtected range: " + range);
  },

  // ==================== NAMED RANGE ====================
  async "named-range"(args) {
    const flags = parseFlags(args);
    const spreadsheetId = extractSpreadsheetId(flags._[0]);
    const name = flags.name || flags._[1];
    const range = flags.range || flags._[2];

    if (!spreadsheetId || !name || !range) {
      console.log("Usage: gsheet named-range <spreadsheetId> --name 'SalesData' --range 'Sheet1!A1:D100'");
      return;
    }

    const gridRange = await parseGridRange(spreadsheetId, range);

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [{
          addNamedRange: {
            namedRange: {
              name,
              range: gridRange
            }
          }
        }]
      }
    });

    console.log("\nNamed range created: " + name + " -> " + range);
  },

  // ==================== FIND AND REPLACE ====================
  async "find-replace"(args) {
    const flags = parseFlags(args);
    const spreadsheetId = extractSpreadsheetId(flags._[0]);
    const find = flags.find || flags._[1];
    const replace = flags.replace || flags._[2] || "";

    if (!spreadsheetId || !find) {
      console.log("Usage: gsheet find-replace <spreadsheetId> --find 'old' --replace 'new'");
      return;
    }

    const res = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [{
          findReplace: {
            find,
            replacement: replace,
            allSheets: true,
            matchCase: flags.case ? true : false,
            matchEntireCell: flags.exact ? true : false
          }
        }]
      }
    });

    const result = res.data.replies[0].findReplace;
    console.log("\nReplaced " + result.occurrencesChanged + " occurrences in " + result.sheetsChanged + " sheet(s)");
  },

  // ==================== EXPORT TO CSV ====================
  async export(args) {
    const flags = parseFlags(args);
    const spreadsheetId = extractSpreadsheetId(flags._[0]);
    const range = flags.range || "Sheet1";
    const output = flags.output || flags.o || "output.csv";

    if (!spreadsheetId) {
      console.log("Usage: gsheet export <spreadsheetId> --range 'Sheet1!A1:D100' --output data.csv");
      return;
    }

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range
    });

    const rows = res.data.values || [];
    const csv = rows.map(row =>
      row.map(cell => {
        const val = formatCellValue(cell);
        return val.includes(",") || val.includes('"') || val.includes("\n")
          ? '"' + val.replace(/"/g, '""') + '"'
          : val;
      }).join(",")
    ).join("\n");

    fs.writeFileSync(output, csv);
    console.log("\nExported " + rows.length + " rows to " + output);
  },

  // ==================== IMPORT FROM CSV ====================
  async import(args) {
    const flags = parseFlags(args);
    const spreadsheetId = extractSpreadsheetId(flags._[0]);
    const file = flags.file || flags._[1];
    const range = flags.range || "Sheet1!A1";

    if (!spreadsheetId || !file) {
      console.log("Usage: gsheet import <spreadsheetId> --file data.csv --range 'Sheet1!A1'");
      return;
    }

    const content = fs.readFileSync(file, "utf-8");
    const rows = content.split("\n").map(line => {
      const values = [];
      let current = "";
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === "," && !inQuotes) {
          values.push(current);
          current = "";
        } else {
          current += char;
        }
      }
      values.push(current);
      return values;
    }).filter(row => row.length > 0 && row.some(cell => cell.trim()));

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      resource: { values: rows }
    });

    console.log("\nImported " + rows.length + " rows from " + file);
  },

  // ==================== SHARE SPREADSHEET ====================
  async share(args) {
    const flags = parseFlags(args);
    const spreadsheetId = extractSpreadsheetId(flags._[0]);
    const email = flags.email || flags._[1];
    const role = flags.role || "reader"; // reader, writer, commenter

    if (!spreadsheetId || !email) {
      console.log("Usage: gsheet share <spreadsheetId> --email 'user@example.com' --role reader|writer|commenter");
      return;
    }

    await drive.permissions.create({
      fileId: spreadsheetId,
      resource: {
        type: "user",
        role: role === "commenter" ? "commenter" : role,
        emailAddress: email
      },
      sendNotificationEmail: flags.notify ? true : false
    });

    console.log("\nShared with " + email + " as " + role);
  },

  // ==================== HELP ====================
  async help() {
    console.log(`
Google Sheets CLI

SPREADSHEETS:
  gsheet list [--limit 20]                    List your spreadsheets
  gsheet create "Title" [--sheets "S1,S2"]    Create new spreadsheet
  gsheet info <id>                            Get spreadsheet details

READ/WRITE:
  gsheet read <id> --range "A1:D10"           Read data
    --json                                    Output as JSON
    --csv                                     Output as CSV
    --formula                                 Show formulas
    --header                                  Treat first row as header

  gsheet write <id> --range "A1" --value "x"  Write single value
  gsheet write <id> --range "A1:C1" --values "a,b,c"  Write row
  gsheet write <id> --range "A1:B2" --values "[[1,2],[3,4]]"  Write grid

  gsheet append <id> --values "a,b,c"         Append row to sheet
  gsheet clear <id> --range "A1:D10"          Clear range

SHEETS (TABS):
  gsheet add-sheet <id> --title "Name"        Add new sheet
  gsheet delete-sheet <id> --id <sheetId>     Delete sheet
  gsheet rename-sheet <id> --id <sheetId> --title "New"
  gsheet copy-sheet <id> --id <sheetId> [--to <destId>]

FORMATTING:
  gsheet format <id> --range "A1:B5" [options]
    --bold, --italic, --underline
    --size 14, --color red, --bg yellow
    --align center, --valign middle
    --wrap, --number "$#,##0.00"

  gsheet merge <id> --range "A1:C1"           Merge cells
  gsheet unmerge <id> --range "A1:C1"         Unmerge cells

DATA TOOLS:
  gsheet filter <id> --range "A1:D100"        Add filter
  gsheet sort <id> --range "A1:D100" --column 0 --order asc
  gsheet dropdown <id> --range "A1:A10" --values "Yes,No,Maybe"
  gsheet conditional-format <id> --range "A1:A10" --condition greater_than --value 100 --color green
  gsheet find-replace <id> --find "old" --replace "new"

CHARTS:
  gsheet add-chart <id> --range "A1:B10" --type column --title "Sales"
    Types: COLUMN, BAR, LINE, AREA, PIE, SCATTER

ADVANCED:
  gsheet protect <id> --range "A1:D10" [--warning]
  gsheet named-range <id> --name "Data" --range "A1:D100"

IMPORT/EXPORT:
  gsheet export <id> --range "Sheet1" --output data.csv
  gsheet import <id> --file data.csv --range "Sheet1!A1"

SHARING:
  gsheet share <id> --email "user@example.com" --role reader|writer|commenter
`);
  }
};

// Helper: Parse color name or hex to RGB object
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
    gray: { red: 0.5, green: 0.5, blue: 0.5 },
    grey: { red: 0.5, green: 0.5, blue: 0.5 }
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

// Helper: Parse range string to GridRange object
async function parseGridRange(spreadsheetId, range) {
  const [sheetName, cellRange] = range.includes("!") ? range.split("!") : ["Sheet1", range];

  // Get sheet ID
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = spreadsheet.data.sheets.find(s =>
    s.properties.title.toLowerCase() === sheetName.toLowerCase()
  );

  if (!sheet) {
    throw new Error("Sheet not found: " + sheetName);
  }

  const sheetId = sheet.properties.sheetId;

  // Parse cell range
  const rangeMatch = cellRange.match(/([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?/i);
  if (!rangeMatch) {
    throw new Error("Invalid range format: " + cellRange);
  }

  const colToIndex = (col) => {
    let index = 0;
    for (let i = 0; i < col.length; i++) {
      index = index * 26 + (col.charCodeAt(i) - 64);
    }
    return index - 1;
  };

  const startCol = colToIndex(rangeMatch[1].toUpperCase());
  const startRow = parseInt(rangeMatch[2]) - 1;
  const endCol = rangeMatch[3] ? colToIndex(rangeMatch[3].toUpperCase()) + 1 : startCol + 1;
  const endRow = rangeMatch[4] ? parseInt(rangeMatch[4]) : startRow + 1;

  return {
    sheetId,
    startRowIndex: startRow,
    endRowIndex: endRow,
    startColumnIndex: startCol,
    endColumnIndex: endCol
  };
}

// Command aliases
commands.ls = commands.list;
commands.get = commands.read;
commands.set = commands.write;
commands.add = commands.append;
commands.new = commands.create;

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
  console.log("Run 'gsheet help' for usage.");
}
