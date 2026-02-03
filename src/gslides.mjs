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
const slides = google.slides({ version: "v1", auth });
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

function extractPresentationId(input) {
  const match = input.match(/\/presentation\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : input;
}

// Convert inches to EMU (English Metric Units) - Google Slides uses EMU
function inchesToEmu(inches) {
  return Math.round(inches * 914400);
}

// Convert points to EMU
function pointsToEmu(points) {
  return Math.round(points * 12700);
}

const commands = {
  // ==================== LIST PRESENTATIONS ====================
  async list(args) {
    const flags = parseFlags(args);
    const limit = parseInt(flags.limit) || 20;

    const res = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.presentation'",
      pageSize: limit,
      fields: "files(id, name, modifiedTime, webViewLink)",
      orderBy: "modifiedTime desc"
    });

    const files = res.data.files || [];
    if (files.length === 0) {
      console.log("No presentations found.");
      return;
    }

    console.log("\nYour Presentations:\n");
    files.forEach(f => {
      const modified = new Date(f.modifiedTime).toLocaleDateString();
      console.log("* " + f.name);
      console.log("  ID: " + f.id);
      console.log("  Modified: " + modified);
      console.log("  Link: " + f.webViewLink + "\n");
    });
  },

  // ==================== CREATE PRESENTATION ====================
  async create(args) {
    const flags = parseFlags(args);
    const title = flags._[0] || flags.title || "Untitled Presentation";

    const res = await slides.presentations.create({
      requestBody: { title }
    });

    console.log("\nPresentation created: " + res.data.title);
    console.log("  ID: " + res.data.presentationId);
    console.log("  Link: https://docs.google.com/presentation/d/" + res.data.presentationId + "/edit");
    console.log("  Slides: " + res.data.slides.length);
  },

  // ==================== READ SLIDE CONTENT ====================
  async "read-slide"(args) {
    const flags = parseFlags(args);
    const presentationId = extractPresentationId(flags._[0]);
    const slideIndex = flags.slide || flags.index || flags._[1];

    if (!presentationId) {
      console.log("Usage: gslides read-slide <presentationId> [--slide 1]");
      console.log("       gslides read-slide <presentationId> --all");
      return;
    }

    const res = await slides.presentations.get({ presentationId });
    const pres = res.data;

    console.log("\n" + pres.title);
    console.log("=".repeat(50));

    const slidesToRead = flags.all
      ? pres.slides
      : slideIndex
        ? [pres.slides[parseInt(slideIndex) - 1]]
        : pres.slides;

    if (!slidesToRead || slidesToRead.length === 0) {
      console.log("No slides found.");
      return;
    }

    slidesToRead.forEach((slide, idx) => {
      const actualIndex = flags.all ? idx : (parseInt(slideIndex) - 1 || idx);
      console.log("\n--- Slide " + (actualIndex + 1) + " [" + slide.objectId + "] ---");

      if (!slide.pageElements || slide.pageElements.length === 0) {
        console.log("  (Empty slide)");
        return;
      }

      for (const element of slide.pageElements) {
        // Text boxes and shapes with text
        if (element.shape?.text?.textElements) {
          const placeholderType = element.shape?.placeholder?.type || "TEXT";
          const text = element.shape.text.textElements
            .filter(t => t.textRun?.content)
            .map(t => t.textRun.content)
            .join("")
            .trim();

          if (text) {
            console.log("\n  [" + placeholderType + "]");
            console.log("  " + text.replace(/\n/g, "\n  "));
          }
        }

        // Tables
        if (element.table) {
          console.log("\n  [TABLE " + element.table.rows + "x" + element.table.columns + "]");
          for (const row of element.table.tableRows || []) {
            const cells = row.tableCells?.map(cell => {
              const text = cell.text?.textElements
                ?.filter(t => t.textRun?.content)
                .map(t => t.textRun.content)
                .join("")
                .trim() || "";
              return text.substring(0, 20);
            }) || [];
            console.log("  | " + cells.join(" | ") + " |");
          }
        }

        // Images
        if (element.image) {
          console.log("\n  [IMAGE]");
          if (element.image.sourceUrl) {
            console.log("  URL: " + element.image.sourceUrl.substring(0, 60) + "...");
          }
        }
      }
    });

    console.log("\n" + "=".repeat(50));
    console.log("Total: " + pres.slides.length + " slides");
  },

  // ==================== READ ALL SLIDES (alias) ====================
  async read(args) {
    const flags = parseFlags(args);
    flags.all = true;
    return this["read-slide"]([...args, "--all"]);
  },

  // ==================== GET PRESENTATION INFO ====================
  async info(args) {
    const presentationId = extractPresentationId(args[0]);
    if (!presentationId) {
      console.log("Usage: gslides info <presentationId>");
      return;
    }

    const res = await slides.presentations.get({ presentationId });
    const pres = res.data;

    console.log("\n" + pres.title);
    console.log("  ID: " + pres.presentationId);
    console.log("  Link: https://docs.google.com/presentation/d/" + pres.presentationId + "/edit");
    console.log("  Slides: " + pres.slides.length);
    console.log("  Page Size: " + Math.round(pres.pageSize.width.magnitude / 914400) + '" x ' +
                Math.round(pres.pageSize.height.magnitude / 914400) + '"');

    console.log("\nSlide List:");
    pres.slides.forEach((slide, i) => {
      const title = getSlideTitle(slide);
      console.log("  " + (i + 1) + ". " + (title || "(No title)") + " [ID: " + slide.objectId + "]");
    });
  },

  // ==================== ADD SLIDE ====================
  async "add-slide"(args) {
    const flags = parseFlags(args);
    const presentationId = extractPresentationId(flags._[0]);
    const layout = flags.layout || "BLANK";
    const index = flags.index ? parseInt(flags.index) : undefined;

    if (!presentationId) {
      console.log("Usage: gslides add-slide <presentationId> [--layout TITLE|TITLE_AND_BODY|BLANK] [--index 0]");
      return;
    }

    const layoutMap = {
      "BLANK": "BLANK",
      "TITLE": "TITLE",
      "TITLE_ONLY": "TITLE_ONLY",
      "TITLE_AND_BODY": "TITLE_AND_BODY",
      "TITLE_AND_TWO_COLUMNS": "TITLE_AND_TWO_COLUMNS",
      "ONE_COLUMN_TEXT": "ONE_COLUMN_TEXT",
      "MAIN_POINT": "MAIN_POINT",
      "BIG_NUMBER": "BIG_NUMBER",
      "SECTION_HEADER": "SECTION_HEADER",
      "SECTION_TITLE_AND_DESCRIPTION": "SECTION_TITLE_AND_DESCRIPTION",
      "CAPTION_ONLY": "CAPTION_ONLY"
    };

    const predefinedLayout = layoutMap[layout.toUpperCase()] || "BLANK";

    const request = {
      createSlide: {
        slideLayoutReference: { predefinedLayout }
      }
    };

    if (index !== undefined) {
      request.createSlide.insertionIndex = index;
    }

    const res = await slides.presentations.batchUpdate({
      presentationId,
      requestBody: { requests: [request] }
    });

    const slideId = res.data.replies[0].createSlide.objectId;
    console.log("\nSlide added!");
    console.log("  Slide ID: " + slideId);
    console.log("  Layout: " + predefinedLayout);
  },

  // ==================== CREATE SLIDE WITH CONTENT ====================
  async "create-slide"(args) {
    const flags = parseFlags(args);
    const presentationId = extractPresentationId(flags._[0]);
    const title = flags.title || flags._[1];
    const body = flags.body || flags.content || flags._[2];
    const layout = (flags.layout || "TITLE_AND_BODY").toUpperCase();

    if (!presentationId) {
      console.log("Usage: gslides create-slide <presentationId> --title 'Title' --body 'Content'");
      console.log("Options:");
      console.log("  --layout TITLE|TITLE_AND_BODY|BLANK (default: TITLE_AND_BODY)");
      console.log("  --bullets    Format body as bullet points (split by newlines)");
      return;
    }

    // First, create the slide
    const createRes = await slides.presentations.batchUpdate({
      presentationId,
      requestBody: {
        requests: [{
          createSlide: {
            slideLayoutReference: { predefinedLayout: layout }
          }
        }]
      }
    });

    const slideId = createRes.data.replies[0].createSlide.objectId;
    console.log("Slide created: " + slideId);

    // Get the slide to find placeholders
    const pres = await slides.presentations.get({ presentationId });
    const slide = pres.data.slides.find(s => s.objectId === slideId);

    if (!slide) {
      console.log("Error: Could not find created slide");
      return;
    }

    const requests = [];

    // Find and fill title placeholder
    const titleElement = slide.pageElements?.find(el =>
      el.shape?.placeholder?.type === "TITLE" ||
      el.shape?.placeholder?.type === "CENTERED_TITLE"
    );

    if (titleElement && title) {
      // Check if placeholder has existing text
      const hasText = titleElement.shape?.text?.textElements?.some(
        t => t.textRun?.content?.trim()
      );

      // Only delete if there's existing text
      if (hasText) {
        requests.push({
          deleteText: {
            objectId: titleElement.objectId,
            textRange: { type: "ALL" }
          }
        });
      }
      // Insert new text
      requests.push({
        insertText: {
          objectId: titleElement.objectId,
          text: title.replace(/\\n/g, "\n"),
          insertionIndex: 0
        }
      });
    }

    // Find and fill body placeholder
    const bodyElement = slide.pageElements?.find(el =>
      el.shape?.placeholder?.type === "BODY" ||
      el.shape?.placeholder?.type === "SUBTITLE"
    );

    if (bodyElement && body) {
      // Convert literal \n to actual newlines
      let bodyText = body.replace(/\\n/g, "\n");

      // If bullets flag, format as bullet points
      if (flags.bullets) {
        const lines = bodyText.split("\n").filter(l => l.trim());
        bodyText = lines.map(l => "• " + l.trim()).join("\n");
      }

      // Check if placeholder has existing text
      const hasText = bodyElement.shape?.text?.textElements?.some(
        t => t.textRun?.content?.trim()
      );

      // Only delete if there's existing text
      if (hasText) {
        requests.push({
          deleteText: {
            objectId: bodyElement.objectId,
            textRange: { type: "ALL" }
          }
        });
      }
      // Insert new text
      requests.push({
        insertText: {
          objectId: bodyElement.objectId,
          text: bodyText,
          insertionIndex: 0
        }
      });
    }

    // If no placeholders but we have content, add text boxes
    if (!titleElement && title) {
      const titleBoxId = "title_" + Date.now();
      requests.push(
        {
          createShape: {
            objectId: titleBoxId,
            shapeType: "TEXT_BOX",
            elementProperties: {
              pageObjectId: slideId,
              size: {
                width: { magnitude: inchesToEmu(9), unit: "EMU" },
                height: { magnitude: inchesToEmu(1), unit: "EMU" }
              },
              transform: {
                scaleX: 1, scaleY: 1,
                translateX: inchesToEmu(0.5),
                translateY: inchesToEmu(0.5),
                unit: "EMU"
              }
            }
          }
        },
        {
          insertText: {
            objectId: titleBoxId,
            text: title,
            insertionIndex: 0
          }
        },
        {
          updateTextStyle: {
            objectId: titleBoxId,
            style: {
              fontSize: { magnitude: 36, unit: "PT" },
              bold: true
            },
            textRange: { type: "ALL" },
            fields: "fontSize,bold"
          }
        }
      );
    }

    if (!bodyElement && body) {
      const bodyBoxId = "body_" + Date.now();
      let bodyText = body.replace(/\\n/g, "\n");
      if (flags.bullets) {
        const lines = bodyText.split("\n").filter(l => l.trim());
        bodyText = lines.map(l => "• " + l.trim()).join("\n");
      }

      requests.push(
        {
          createShape: {
            objectId: bodyBoxId,
            shapeType: "TEXT_BOX",
            elementProperties: {
              pageObjectId: slideId,
              size: {
                width: { magnitude: inchesToEmu(9), unit: "EMU" },
                height: { magnitude: inchesToEmu(4), unit: "EMU" }
              },
              transform: {
                scaleX: 1, scaleY: 1,
                translateX: inchesToEmu(0.5),
                translateY: inchesToEmu(2),
                unit: "EMU"
              }
            }
          }
        },
        {
          insertText: {
            objectId: bodyBoxId,
            text: bodyText,
            insertionIndex: 0
          }
        },
        {
          updateTextStyle: {
            objectId: bodyBoxId,
            style: {
              fontSize: { magnitude: 18, unit: "PT" }
            },
            textRange: { type: "ALL" },
            fields: "fontSize"
          }
        }
      );
    }

    if (requests.length > 0) {
      await slides.presentations.batchUpdate({
        presentationId,
        requestBody: { requests }
      });
    }

    console.log("\n✅ Slide created with content!");
    console.log("  Slide ID: " + slideId);
    if (title) console.log("  Title: " + title);
    if (body) console.log("  Body: " + body.substring(0, 50) + (body.length > 50 ? "..." : ""));
  },

  // ==================== UPDATE/MODIFY EXISTING SLIDE ====================
  async "update-slide"(args) {
    const flags = parseFlags(args);
    const presentationId = extractPresentationId(flags._[0]);
    const slideId = flags.slide || flags._[1];
    const title = flags.title;
    const body = flags.body || flags.content;

    if (!presentationId || !slideId) {
      console.log("Usage: gslides update-slide <presentationId> --slide <slideId> --title 'New Title' --body 'New Content'");
      console.log("Options:");
      console.log("  --slide <id>   Slide ID to update (required)");
      console.log("  --title        New title text");
      console.log("  --body         New body text");
      console.log("  --bullets      Format body as bullet points");
      return;
    }

    // Get the slide
    const pres = await slides.presentations.get({ presentationId });
    const slide = pres.data.slides.find(s => s.objectId === slideId);

    if (!slide) {
      console.log("Error: Slide not found: " + slideId);
      return;
    }

    const requests = [];

    // Find and update title placeholder
    const titleElement = slide.pageElements?.find(el =>
      el.shape?.placeholder?.type === "TITLE" ||
      el.shape?.placeholder?.type === "CENTERED_TITLE"
    );

    if (titleElement && title) {
      // Check if placeholder has existing text
      const hasText = titleElement.shape?.text?.textElements?.some(
        t => t.textRun?.content?.trim()
      );

      if (hasText) {
        requests.push({
          deleteText: {
            objectId: titleElement.objectId,
            textRange: { type: "ALL" }
          }
        });
      }
      requests.push({
        insertText: {
          objectId: titleElement.objectId,
          text: title.replace(/\\n/g, "\n"),
          insertionIndex: 0
        }
      });
    }

    // Find and update body placeholder
    const bodyElement = slide.pageElements?.find(el =>
      el.shape?.placeholder?.type === "BODY" ||
      el.shape?.placeholder?.type === "SUBTITLE"
    );

    if (bodyElement && body) {
      let bodyText = body.replace(/\\n/g, "\n");

      if (flags.bullets) {
        const lines = bodyText.split("\n").filter(l => l.trim());
        bodyText = lines.map(l => "• " + l.trim()).join("\n");
      }

      const hasText = bodyElement.shape?.text?.textElements?.some(
        t => t.textRun?.content?.trim()
      );

      if (hasText) {
        requests.push({
          deleteText: {
            objectId: bodyElement.objectId,
            textRange: { type: "ALL" }
          }
        });
      }
      requests.push({
        insertText: {
          objectId: bodyElement.objectId,
          text: bodyText,
          insertionIndex: 0
        }
      });
    }

    if (requests.length === 0) {
      console.log("No updates specified. Use --title and/or --body.");
      return;
    }

    await slides.presentations.batchUpdate({
      presentationId,
      requestBody: { requests }
    });

    console.log("\n✅ Slide updated!");
    console.log("  Slide ID: " + slideId);
    if (title) console.log("  Title: " + title);
    if (body) console.log("  Body: " + body.substring(0, 50) + (body.length > 50 ? "..." : ""));
  },

  // ==================== DELETE SLIDE ====================
  async "delete-slide"(args) {
    const flags = parseFlags(args);
    const presentationId = extractPresentationId(flags._[0]);
    const slideId = flags.slide || flags.id || flags._[1];

    if (!presentationId || !slideId) {
      console.log("Usage: gslides delete-slide <presentationId> --slide <slideId>");
      return;
    }

    await slides.presentations.batchUpdate({
      presentationId,
      requestBody: {
        requests: [{
          deleteObject: { objectId: slideId }
        }]
      }
    });

    console.log("\nSlide deleted.");
  },

  // ==================== ADD TEXT BOX ====================
  async "add-text"(args) {
    const flags = parseFlags(args);
    const presentationId = extractPresentationId(flags._[0]);
    const slideId = flags.slide || flags._[1];
    const text = flags.text || flags._[2];

    if (!presentationId || !slideId || !text) {
      console.log("Usage: gslides add-text <presentationId> --slide <slideId> --text 'Your text'");
      console.log("Options:");
      console.log("  --x 1        X position in inches (default: 1)");
      console.log("  --y 1        Y position in inches (default: 1)");
      console.log("  --width 8    Width in inches (default: 8)");
      console.log("  --height 1   Height in inches (default: 1)");
      console.log("  --size 18    Font size in points");
      console.log("  --bold       Bold text");
      console.log("  --color red  Text color");
      return;
    }

    const x = parseFloat(flags.x) || 1;
    const y = parseFloat(flags.y) || 1;
    const width = parseFloat(flags.width) || 8;
    const height = parseFloat(flags.height) || 1;

    const elementId = "textbox_" + Date.now();

    const requests = [
      {
        createShape: {
          objectId: elementId,
          shapeType: "TEXT_BOX",
          elementProperties: {
            pageObjectId: slideId,
            size: {
              width: { magnitude: inchesToEmu(width), unit: "EMU" },
              height: { magnitude: inchesToEmu(height), unit: "EMU" }
            },
            transform: {
              scaleX: 1,
              scaleY: 1,
              translateX: inchesToEmu(x),
              translateY: inchesToEmu(y),
              unit: "EMU"
            }
          }
        }
      },
      {
        insertText: {
          objectId: elementId,
          text,
          insertionIndex: 0
        }
      }
    ];

    // Add formatting if specified
    if (flags.size || flags.bold || flags.color || flags.font) {
      const textStyle = {};
      const fields = [];

      if (flags.size) {
        textStyle.fontSize = { magnitude: parseInt(flags.size), unit: "PT" };
        fields.push("fontSize");
      }
      if (flags.bold) {
        textStyle.bold = true;
        fields.push("bold");
      }
      if (flags.color) {
        textStyle.foregroundColor = { opaqueColor: { rgbColor: parseColor(flags.color) } };
        fields.push("foregroundColor");
      }
      if (flags.font) {
        textStyle.fontFamily = flags.font;
        fields.push("fontFamily");
      }

      requests.push({
        updateTextStyle: {
          objectId: elementId,
          style: textStyle,
          textRange: { type: "ALL" },
          fields: fields.join(",")
        }
      });
    }

    await slides.presentations.batchUpdate({
      presentationId,
      requestBody: { requests }
    });

    console.log("\nText box added!");
    console.log("  Element ID: " + elementId);
  },

  // ==================== ADD IMAGE ====================
  async "add-image"(args) {
    const flags = parseFlags(args);
    const presentationId = extractPresentationId(flags._[0]);
    const slideId = flags.slide || flags._[1];
    const imageUrl = flags.url || flags.image || flags._[2];

    if (!presentationId || !slideId || !imageUrl) {
      console.log("Usage: gslides add-image <presentationId> --slide <slideId> --url 'https://...'");
      console.log("Options:");
      console.log("  --x 1        X position in inches");
      console.log("  --y 1        Y position in inches");
      console.log("  --width 4    Width in inches");
      console.log("  --height 3   Height in inches");
      return;
    }

    const x = parseFloat(flags.x) || 1;
    const y = parseFloat(flags.y) || 1;
    const width = parseFloat(flags.width) || 4;
    const height = parseFloat(flags.height) || 3;

    const elementId = "image_" + Date.now();

    await slides.presentations.batchUpdate({
      presentationId,
      requestBody: {
        requests: [{
          createImage: {
            objectId: elementId,
            url: imageUrl,
            elementProperties: {
              pageObjectId: slideId,
              size: {
                width: { magnitude: inchesToEmu(width), unit: "EMU" },
                height: { magnitude: inchesToEmu(height), unit: "EMU" }
              },
              transform: {
                scaleX: 1,
                scaleY: 1,
                translateX: inchesToEmu(x),
                translateY: inchesToEmu(y),
                unit: "EMU"
              }
            }
          }
        }]
      }
    });

    console.log("\nImage added!");
    console.log("  Element ID: " + elementId);
  },

  // ==================== ADD SHAPE ====================
  async "add-shape"(args) {
    const flags = parseFlags(args);
    const presentationId = extractPresentationId(flags._[0]);
    const slideId = flags.slide || flags._[1];
    const shapeType = (flags.type || flags.shape || "RECTANGLE").toUpperCase();

    if (!presentationId || !slideId) {
      console.log("Usage: gslides add-shape <presentationId> --slide <slideId> --type RECTANGLE");
      console.log("Shape types: RECTANGLE, ELLIPSE, ROUND_RECTANGLE, TRIANGLE, ARROW_*, STAR_*, etc.");
      console.log("Options:");
      console.log("  --x 1, --y 1, --width 2, --height 2");
      console.log("  --fill red       Fill color");
      console.log("  --outline blue   Outline color");
      return;
    }

    const x = parseFloat(flags.x) || 1;
    const y = parseFloat(flags.y) || 1;
    const width = parseFloat(flags.width) || 2;
    const height = parseFloat(flags.height) || 2;

    const elementId = "shape_" + Date.now();

    const requests = [{
      createShape: {
        objectId: elementId,
        shapeType,
        elementProperties: {
          pageObjectId: slideId,
          size: {
            width: { magnitude: inchesToEmu(width), unit: "EMU" },
            height: { magnitude: inchesToEmu(height), unit: "EMU" }
          },
          transform: {
            scaleX: 1,
            scaleY: 1,
            translateX: inchesToEmu(x),
            translateY: inchesToEmu(y),
            unit: "EMU"
          }
        }
      }
    }];

    if (flags.fill) {
      requests.push({
        updateShapeProperties: {
          objectId: elementId,
          shapeProperties: {
            shapeBackgroundFill: {
              solidFill: { color: { rgbColor: parseColor(flags.fill) } }
            }
          },
          fields: "shapeBackgroundFill.solidFill.color"
        }
      });
    }

    if (flags.outline) {
      requests.push({
        updateShapeProperties: {
          objectId: elementId,
          shapeProperties: {
            outline: {
              outlineFill: {
                solidFill: { color: { rgbColor: parseColor(flags.outline) } }
              }
            }
          },
          fields: "outline.outlineFill.solidFill.color"
        }
      });
    }

    await slides.presentations.batchUpdate({
      presentationId,
      requestBody: { requests }
    });

    console.log("\nShape added!");
    console.log("  Element ID: " + elementId);
    console.log("  Type: " + shapeType);
  },

  // ==================== ADD TABLE ====================
  async "add-table"(args) {
    const flags = parseFlags(args);
    const presentationId = extractPresentationId(flags._[0]);
    const slideId = flags.slide || flags._[1];
    const rows = parseInt(flags.rows) || 3;
    const cols = parseInt(flags.cols || flags.columns) || 3;

    if (!presentationId || !slideId) {
      console.log("Usage: gslides add-table <presentationId> --slide <slideId> --rows 3 --cols 3");
      return;
    }

    const elementId = "table_" + Date.now();

    await slides.presentations.batchUpdate({
      presentationId,
      requestBody: {
        requests: [{
          createTable: {
            objectId: elementId,
            elementProperties: {
              pageObjectId: slideId,
              size: {
                width: { magnitude: inchesToEmu(8), unit: "EMU" },
                height: { magnitude: inchesToEmu(rows * 0.5), unit: "EMU" }
              },
              transform: {
                scaleX: 1,
                scaleY: 1,
                translateX: inchesToEmu(1),
                translateY: inchesToEmu(2),
                unit: "EMU"
              }
            },
            rows,
            columns: cols
          }
        }]
      }
    });

    console.log("\nTable added!");
    console.log("  Element ID: " + elementId);
    console.log("  Size: " + rows + "x" + cols);
  },

  // ==================== SET SLIDE TITLE ====================
  async "set-title"(args) {
    const flags = parseFlags(args);
    const presentationId = extractPresentationId(flags._[0]);
    const slideId = flags.slide || flags._[1];
    const title = flags.title || flags.text || flags._[2];

    if (!presentationId || !slideId || !title) {
      console.log("Usage: gslides set-title <presentationId> --slide <slideId> --title 'Slide Title'");
      return;
    }

    // Get the slide to find title placeholder
    const pres = await slides.presentations.get({ presentationId });
    const slide = pres.data.slides.find(s => s.objectId === slideId);

    if (!slide) {
      console.log("Slide not found: " + slideId);
      return;
    }

    // Find title placeholder
    const titleElement = slide.pageElements?.find(el =>
      el.shape?.placeholder?.type === "TITLE" ||
      el.shape?.placeholder?.type === "CENTERED_TITLE"
    );

    if (titleElement) {
      // Update existing title
      await slides.presentations.batchUpdate({
        presentationId,
        requestBody: {
          requests: [
            {
              deleteText: {
                objectId: titleElement.objectId,
                textRange: { type: "ALL" }
              }
            },
            {
              insertText: {
                objectId: titleElement.objectId,
                text: title,
                insertionIndex: 0
              }
            }
          ]
        }
      });
    } else {
      // Create a text box as title
      await this["add-text"]([presentationId, "--slide", slideId, "--text", title,
                              "--x", "0.5", "--y", "0.5", "--width", "9", "--height", "1",
                              "--size", "36", "--bold"]);
      return;
    }

    console.log("\nSlide title set: " + title);
  },

  // ==================== DUPLICATE SLIDE ====================
  async "duplicate-slide"(args) {
    const flags = parseFlags(args);
    const presentationId = extractPresentationId(flags._[0]);
    const slideId = flags.slide || flags.id || flags._[1];

    if (!presentationId || !slideId) {
      console.log("Usage: gslides duplicate-slide <presentationId> --slide <slideId>");
      return;
    }

    const res = await slides.presentations.batchUpdate({
      presentationId,
      requestBody: {
        requests: [{
          duplicateObject: { objectId: slideId }
        }]
      }
    });

    const newSlideId = res.data.replies[0].duplicateObject.objectId;
    console.log("\nSlide duplicated!");
    console.log("  New Slide ID: " + newSlideId);
  },

  // ==================== MOVE SLIDE ====================
  async "move-slide"(args) {
    const flags = parseFlags(args);
    const presentationId = extractPresentationId(flags._[0]);
    const slideId = flags.slide || flags.id || flags._[1];
    const index = parseInt(flags.index || flags.to);

    if (!presentationId || !slideId || isNaN(index)) {
      console.log("Usage: gslides move-slide <presentationId> --slide <slideId> --index 0");
      return;
    }

    await slides.presentations.batchUpdate({
      presentationId,
      requestBody: {
        requests: [{
          updateSlidesPosition: {
            slideObjectIds: [slideId],
            insertionIndex: index
          }
        }]
      }
    });

    console.log("\nSlide moved to position " + index);
  },

  // ==================== SET BACKGROUND ====================
  async "set-background"(args) {
    const flags = parseFlags(args);
    const presentationId = extractPresentationId(flags._[0]);
    const slideId = flags.slide || flags._[1];
    const color = flags.color;
    const imageUrl = flags.image || flags.url;

    if (!presentationId || !slideId || (!color && !imageUrl)) {
      console.log("Usage: gslides set-background <presentationId> --slide <slideId> --color blue");
      console.log("   or: gslides set-background <presentationId> --slide <slideId> --image 'https://...'");
      return;
    }

    const request = {
      updatePageProperties: {
        objectId: slideId,
        pageProperties: { pageBackgroundFill: {} },
        fields: "pageBackgroundFill"
      }
    };

    if (color) {
      request.updatePageProperties.pageProperties.pageBackgroundFill = {
        solidFill: { color: { rgbColor: parseColor(color) } }
      };
    } else if (imageUrl) {
      request.updatePageProperties.pageProperties.pageBackgroundFill = {
        stretchedPictureFill: { contentUrl: imageUrl }
      };
    }

    await slides.presentations.batchUpdate({
      presentationId,
      requestBody: { requests: [request] }
    });

    console.log("\nBackground updated!");
  },

  // ==================== EXPORT PRESENTATION ====================
  async export(args) {
    const flags = parseFlags(args);
    const presentationId = extractPresentationId(flags._[0]);
    const format = (flags.format || flags.as || "pdf").toLowerCase();
    const output = flags.output || flags.o || ("presentation." + format);

    if (!presentationId) {
      console.log("Usage: gslides export <presentationId> --format pdf|pptx --output file.pdf");
      return;
    }

    const mimeTypes = {
      pdf: "application/pdf",
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      txt: "text/plain",
      png: "image/png",
      odp: "application/vnd.oasis.opendocument.presentation"
    };

    const mimeType = mimeTypes[format];
    if (!mimeType) {
      console.log("Supported formats: pdf, pptx, txt, odp");
      return;
    }

    const res = await drive.files.export({
      fileId: presentationId,
      mimeType
    }, { responseType: "arraybuffer" });

    fs.writeFileSync(output, Buffer.from(res.data));
    console.log("\nExported to: " + output);
  },

  // ==================== COPY PRESENTATION ====================
  async copy(args) {
    const flags = parseFlags(args);
    const presentationId = extractPresentationId(flags._[0]);
    const newTitle = flags.title || flags.name || flags._[1];

    if (!presentationId) {
      console.log("Usage: gslides copy <presentationId> --title 'New Presentation Name'");
      return;
    }

    const res = await drive.files.copy({
      fileId: presentationId,
      requestBody: { name: newTitle }
    });

    console.log("\nPresentation copied!");
    console.log("  New ID: " + res.data.id);
    console.log("  Link: https://docs.google.com/presentation/d/" + res.data.id + "/edit");
  },

  // ==================== DELETE PRESENTATION ====================
  async delete(args) {
    const flags = parseFlags(args);
    const presentationId = extractPresentationId(flags._[0]);

    if (!presentationId) {
      console.log("Usage: gslides delete <presentationId> --confirm");
      return;
    }

    if (!flags.confirm) {
      console.log("Add --confirm to delete this presentation.");
      return;
    }

    await drive.files.delete({ fileId: presentationId });
    console.log("\nPresentation deleted.");
  },

  // ==================== SHARE PRESENTATION ====================
  async share(args) {
    const flags = parseFlags(args);
    const presentationId = extractPresentationId(flags._[0]);
    const email = flags.email || flags._[1];
    const role = flags.role || "reader";

    if (!presentationId || !email) {
      console.log("Usage: gslides share <presentationId> --email 'user@example.com' --role reader|writer|commenter");
      return;
    }

    await drive.permissions.create({
      fileId: presentationId,
      requestBody: {
        type: "user",
        role: role === "commenter" ? "commenter" : role,
        emailAddress: email
      },
      sendNotificationEmail: flags.notify ? true : false
    });

    console.log("\nShared with " + email + " as " + role);
  },

  // ==================== SEARCH PRESENTATIONS ====================
  async search(args) {
    const flags = parseFlags(args);
    const query = flags._[0] || flags.query || flags.q;

    if (!query) {
      console.log("Usage: gslides search 'search terms'");
      return;
    }

    const res = await drive.files.list({
      q: `mimeType='application/vnd.google-apps.presentation' and fullText contains '${query}'`,
      pageSize: parseInt(flags.limit) || 10,
      fields: "files(id, name, modifiedTime, webViewLink)",
      orderBy: "modifiedTime desc"
    });

    const files = res.data.files || [];
    if (files.length === 0) {
      console.log("No presentations found matching: " + query);
      return;
    }

    console.log("\nSearch Results:\n");
    files.forEach(f => {
      console.log("* " + f.name);
      console.log("  ID: " + f.id);
      console.log("  Link: " + f.webViewLink + "\n");
    });
  },

  // ==================== CREATE FROM TEMPLATE ====================
  async "from-template"(args) {
    const flags = parseFlags(args);
    const templateId = extractPresentationId(flags._[0] || flags.template);
    const title = flags.title || flags.name || flags._[1] || "New Presentation";

    if (!templateId) {
      console.log("Usage: gslides from-template <templateId> --title 'New Presentation Name'");
      console.log("\nThis copies a template presentation and gives it a new name.");
      console.log("All slides, masters, layouts, and styling are preserved.");
      return;
    }

    // Copy the template
    const res = await drive.files.copy({
      fileId: templateId,
      requestBody: { name: title }
    });

    const newId = res.data.id;

    // Get info about the new presentation
    const pres = await slides.presentations.get({ presentationId: newId });

    console.log("\n✅ Created from template!");
    console.log("  Title: " + title);
    console.log("  ID: " + newId);
    console.log("  Link: https://docs.google.com/presentation/d/" + newId + "/edit");
    console.log("  Slides: " + pres.data.slides.length);
  },

  // ==================== LIST MASTERS AND LAYOUTS ====================
  async masters(args) {
    const flags = parseFlags(args);
    const presentationId = extractPresentationId(flags._[0]);

    if (!presentationId) {
      console.log("Usage: gslides masters <presentationId>");
      console.log("\nLists all master slides and their layouts.");
      return;
    }

    const res = await slides.presentations.get({ presentationId });
    const pres = res.data;

    console.log("\n" + pres.title);
    console.log("=".repeat(50));

    // List masters
    console.log("\nMASTER SLIDES:");
    for (const master of pres.masters || []) {
      console.log("\n  Master: " + master.objectId);

      // Get master background color
      if (master.pageProperties?.pageBackgroundFill?.solidFill) {
        const color = master.pageProperties.pageBackgroundFill.solidFill.color?.rgbColor;
        if (color) {
          console.log("    Background: rgb(" +
            Math.round((color.red || 0) * 255) + ", " +
            Math.round((color.green || 0) * 255) + ", " +
            Math.round((color.blue || 0) * 255) + ")");
        }
      }

      // List layouts for this master
      console.log("    Layouts:");
      for (const layout of pres.layouts || []) {
        if (layout.masterObjectId === master.objectId) {
          const layoutName = layout.layoutProperties?.displayName || layout.layoutProperties?.name || "Unnamed";
          console.log("      - " + layoutName + " [" + layout.objectId + "]");
        }
      }
    }

    // Theme colors
    console.log("\nTHEME COLORS:");
    const master = pres.masters?.[0];
    if (master?.pageProperties?.colorScheme?.colors) {
      for (const colorEntry of master.pageProperties.colorScheme.colors) {
        const rgb = colorEntry.color?.rgbColor;
        if (rgb) {
          const hex = "#" +
            Math.round((rgb.red || 0) * 255).toString(16).padStart(2, "0") +
            Math.round((rgb.green || 0) * 255).toString(16).padStart(2, "0") +
            Math.round((rgb.blue || 0) * 255).toString(16).padStart(2, "0");
          console.log("  " + (colorEntry.type || "COLOR") + ": " + hex.toUpperCase());
        }
      }
    }

    console.log("\n" + "=".repeat(50));
  },

  // ==================== APPLY LAYOUT TO SLIDE ====================
  async "apply-layout"(args) {
    const flags = parseFlags(args);
    const presentationId = extractPresentationId(flags._[0]);
    const slideId = flags.slide;
    const layoutId = flags.layout;

    if (!presentationId || !slideId || !layoutId) {
      console.log("Usage: gslides apply-layout <presentationId> --slide <slideId> --layout <layoutId>");
      console.log("\nChanges the layout of an existing slide.");
      console.log("Use 'gslides masters <id>' to see available layout IDs.");
      return;
    }

    await slides.presentations.batchUpdate({
      presentationId,
      requestBody: {
        requests: [{
          updateSlideProperties: {
            objectId: slideId,
            slideProperties: {
              layoutObjectId: layoutId
            },
            fields: "layoutObjectId"
          }
        }]
      }
    });

    console.log("\n✅ Layout applied!");
    console.log("  Slide: " + slideId);
    console.log("  Layout: " + layoutId);
  },

  // ==================== COPY SLIDE BETWEEN PRESENTATIONS ====================
  async "copy-slide"(args) {
    const flags = parseFlags(args);
    const sourceId = extractPresentationId(flags._[0] || flags.from);
    const slideId = flags.slide;
    const destId = extractPresentationId(flags.to || flags.dest);
    const insertIndex = flags.index !== undefined ? parseInt(flags.index) : undefined;

    if (!sourceId || !slideId || !destId) {
      console.log("Usage: gslides copy-slide <sourceId> --slide <slideId> --to <destId>");
      console.log("\nCopies a slide from one presentation to another.");
      console.log("Options:");
      console.log("  --index N    Insert at specific position (0-based)");
      return;
    }

    const request = {
      duplicateObject: {
        objectId: slideId,
        objectIds: {}
      }
    };

    // First duplicate within source, then we need different approach
    // Actually, Slides API doesn't support cross-presentation copy directly
    // We need to use a workaround: export slide elements and recreate

    // Better approach: use the Slides API's internal mechanism
    // by getting slide content and recreating it

    // Get source slide
    const sourcePres = await slides.presentations.get({ presentationId: sourceId });
    const sourceSlide = sourcePres.data.slides.find(s => s.objectId === slideId);

    if (!sourceSlide) {
      console.log("Error: Slide not found: " + slideId);
      return;
    }

    // Create a new slide in destination
    const createReq = {
      createSlide: {}
    };
    if (insertIndex !== undefined) {
      createReq.createSlide.insertionIndex = insertIndex;
    }

    const createRes = await slides.presentations.batchUpdate({
      presentationId: destId,
      requestBody: { requests: [createReq] }
    });

    const newSlideId = createRes.data.replies[0].createSlide.objectId;

    // Copy background if exists
    const requests = [];
    if (sourceSlide.pageProperties?.pageBackgroundFill) {
      requests.push({
        updatePageProperties: {
          objectId: newSlideId,
          pageProperties: {
            pageBackgroundFill: sourceSlide.pageProperties.pageBackgroundFill
          },
          fields: "pageBackgroundFill"
        }
      });
    }

    // Copy page elements (text boxes, shapes, images)
    for (const element of sourceSlide.pageElements || []) {
      const newElementId = "copied_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);

      if (element.shape) {
        // Copy shape/text box
        requests.push({
          createShape: {
            objectId: newElementId,
            shapeType: element.shape.shapeType || "TEXT_BOX",
            elementProperties: {
              pageObjectId: newSlideId,
              size: element.size,
              transform: element.transform
            }
          }
        });

        // Add text content if exists
        const textContent = element.shape.text?.textElements
          ?.filter(t => t.textRun?.content)
          .map(t => t.textRun.content)
          .join("") || "";

        if (textContent.trim()) {
          requests.push({
            insertText: {
              objectId: newElementId,
              text: textContent,
              insertionIndex: 0
            }
          });
        }
      } else if (element.image) {
        // Copy image
        if (element.image.sourceUrl) {
          requests.push({
            createImage: {
              objectId: newElementId,
              url: element.image.sourceUrl,
              elementProperties: {
                pageObjectId: newSlideId,
                size: element.size,
                transform: element.transform
              }
            }
          });
        }
      } else if (element.table) {
        // Copy table structure
        requests.push({
          createTable: {
            objectId: newElementId,
            elementProperties: {
              pageObjectId: newSlideId,
              size: element.size,
              transform: element.transform
            },
            rows: element.table.rows,
            columns: element.table.columns
          }
        });
      }
    }

    if (requests.length > 0) {
      try {
        await slides.presentations.batchUpdate({
          presentationId: destId,
          requestBody: { requests }
        });
      } catch (e) {
        console.log("Warning: Some elements could not be copied: " + e.message);
      }
    }

    console.log("\n✅ Slide copied!");
    console.log("  Source: " + sourceId + " slide " + slideId);
    console.log("  Destination: " + destId);
    console.log("  New Slide ID: " + newSlideId);
  },

  // ==================== LIST TEMPLATES (presentations tagged as template) ====================
  async templates(args) {
    const flags = parseFlags(args);
    const limit = parseInt(flags.limit) || 20;

    // Search for presentations with "template" in the name
    const res = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.presentation' and name contains 'template'",
      pageSize: limit,
      fields: "files(id, name, modifiedTime, webViewLink)",
      orderBy: "modifiedTime desc"
    });

    const files = res.data.files || [];
    if (files.length === 0) {
      console.log("No template presentations found.");
      console.log("Tip: Name your templates with 'template' in the title.");
      return;
    }

    console.log("\nYour Templates:\n");
    files.forEach(f => {
      console.log("* " + f.name);
      console.log("  ID: " + f.id);
      console.log("  Use: gslides from-template " + f.id + " --title 'New Title'");
      console.log("");
    });
  },

  // ==================== HELP ====================
  async help() {
    console.log(`
Google Slides CLI

PRESENTATIONS:
  gslides list [--limit 20]             List your presentations
  gslides create "Title"                Create new presentation
  gslides info <id>                     Get presentation details
  gslides read <id>                     Read all slide content
  gslides read-slide <id> --slide 1     Read specific slide
  gslides search "query"                Search presentations

TEMPLATES:
  gslides templates                     List template presentations
  gslides from-template <id> --title "Name"  Create from template
  gslides masters <id>                  List masters, layouts, theme colors
  gslides apply-layout <id> --slide <slideId> --layout <layoutId>
  gslides copy-slide <srcId> --slide <slideId> --to <destId>

SLIDES:
  gslides create-slide <id> --title "Title" --body "Content" [--bullets]
  gslides update-slide <id> --slide <slideId> --title "New Title" --body "New Body"
  gslides add-slide <id> [--layout TITLE|TITLE_AND_BODY|BLANK]
  gslides delete-slide <id> --slide <slideId>
  gslides duplicate-slide <id> --slide <slideId>
  gslides move-slide <id> --slide <slideId> --index 0
  gslides set-title <id> --slide <slideId> --title "Title"
  gslides set-background <id> --slide <slideId> --color blue
  gslides set-background <id> --slide <slideId> --image "https://..."

CONTENT:
  gslides add-text <id> --slide <slideId> --text "Hello"
    [--x 1] [--y 1] [--width 8] [--height 1]
    [--size 18] [--bold] [--color red] [--font "Arial"]

  gslides add-image <id> --slide <slideId> --url "https://..."
    [--x 1] [--y 1] [--width 4] [--height 3]

  gslides add-shape <id> --slide <slideId> --type RECTANGLE
    [--x 1] [--y 1] [--width 2] [--height 2]
    [--fill red] [--outline blue]
    Types: RECTANGLE, ELLIPSE, ROUND_RECTANGLE, TRIANGLE, etc.

  gslides add-table <id> --slide <slideId> --rows 3 --cols 3

EXPORT:
  gslides export <id> --format pdf --output slides.pdf
    Formats: pdf, pptx, odp

MANAGE:
  gslides copy <id> --title "Copy Name"
  gslides delete <id> --confirm
  gslides share <id> --email "user@email.com" --role writer

LAYOUTS:
  BLANK, TITLE, TITLE_ONLY, TITLE_AND_BODY, TITLE_AND_TWO_COLUMNS,
  SECTION_HEADER, MAIN_POINT, BIG_NUMBER, CAPTION_ONLY
`);
  }
};

// Helper: Get slide title from elements
function getSlideTitle(slide) {
  for (const element of slide.pageElements || []) {
    if (element.shape?.placeholder?.type === "TITLE" ||
        element.shape?.placeholder?.type === "CENTERED_TITLE") {
      const textContent = element.shape?.text?.textElements;
      if (textContent) {
        return textContent
          .filter(t => t.textRun)
          .map(t => t.textRun.content)
          .join("")
          .trim();
      }
    }
  }
  return null;
}

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
commands.get = commands.info;
commands.modify = commands["update-slide"];
commands["modify-slide"] = commands["update-slide"];
commands.update = commands["update-slide"];

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
  console.log("Run 'gslides help' for usage.");
}
