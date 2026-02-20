/**
 * Credtent PDF Form Generator
 * Produces a branded, fillable-style PDF questionnaire for each content type.
 * Uses PDFKit — runs server-side only.
 */

import PDFDocument from "pdfkit";

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const NAVY  = "#1a2744";   // oklch(0.22 0.08 264) approx
const ORANGE = "#d97706";  // oklch(0.68 0.19 41) approx
const LIGHT_GRAY = "#f5f6f8";
const MID_GRAY   = "#9ca3af";
const DARK_GRAY  = "#374151";
const WHITE = "#ffffff";

// ─── Content type definitions ─────────────────────────────────────────────────

export type ContentTypeKey =
  | "video" | "written" | "audio" | "images"
  | "social" | "design" | "games" | "film" | "other";

interface FormSection {
  title: string;
  questions: FormQuestion[];
}

interface FormQuestion {
  label: string;
  type: "text" | "multiline" | "checkbox-list" | "radio-list";
  options?: string[];
  hint?: string;
}

const CONTENT_TYPE_FORMS: Record<ContentTypeKey, { label: string; subtitle: string; sections: FormSection[] }> = {
  video: {
    label: "Video Content",
    subtitle: "Corporate, educational, documentary, B-roll, television, streaming",
    sections: [
      {
        title: "Organization",
        questions: [
          { label: "Company / Organization Name", type: "text" },
          { label: "Contact Name", type: "text" },
          { label: "Contact Email", type: "text" },
        ],
      },
      {
        title: "Content Category",
        questions: [
          {
            label: "How would you categorize this video content? (Select all that apply)",
            type: "checkbox-list",
            options: ["Television series / episodes", "Streaming originals", "Live broadcast recordings", "Documentary", "Film / cinema", "Corporate / brand", "Educational / training", "News / journalism", "Sports", "User-generated", "Raw / unedited footage", "Other"],
          },
          { label: "Show, series, or program name and format (if applicable)", type: "multiline", hint: "e.g. The Ed Sullivan Show — weekly variety show, CBS, 1948–1971" },
        ],
      },
      {
        title: "Genre & Era",
        questions: [
          {
            label: "Genres / subject matter (select all that apply)",
            type: "checkbox-list",
            options: ["Variety / entertainment", "Drama", "Comedy", "Talk show / interview", "Reality / unscripted", "Music performance", "Sports", "News / current affairs", "Documentary", "Educational", "Children's", "Sci-fi / fantasy", "Action / thriller", "Nature / wildlife", "Lifestyle / travel", "Medical / health", "Industrial", "Other"],
          },
          {
            label: "Era(s) the content spans",
            type: "checkbox-list",
            options: ["Pre-1960s", "1960s–1970s", "1970s–1980s", "1980s–1990s", "1990s–2000s", "2000s–2010s", "2010s–present", "Mixed eras"],
          },
        ],
      },
      {
        title: "Volume & Technical",
        questions: [
          { label: "Approximate total volume (hours, clips, episodes)", type: "text", hint: "e.g. 1,200 hours across 700 episodes" },
          {
            label: "Typical clip / episode duration",
            type: "radio-list",
            options: ["Under 30s", "30s–2 min", "2–10 min", "10–30 min", "30–60 min", "60 min+", "Mixed"],
          },
          {
            label: "Resolutions available",
            type: "checkbox-list",
            options: ["SD (480p or below)", "HD (720p)", "Full HD (1080p)", "2K", "4K", "6K+", "Mixed", "Not sure"],
          },
          {
            label: "Video formats / codecs",
            type: "checkbox-list",
            options: ["MP4", "MOV", "AVI", "MXF", "ProRes", "RAW camera files", "Broadcast tape digitized", "Other", "Not sure"],
          },
        ],
      },
      {
        title: "People & Diversity",
        questions: [
          { label: "Does the content feature notable or famous individuals?", type: "radio-list", options: ["Yes", "No", "Not sure"] },
          { label: "Notable individuals featured (performers, hosts, athletes, historical figures)", type: "multiline", hint: "e.g. The Beatles, Elvis Presley, Bob Hope, Ella Fitzgerald" },
          { label: "Does the content feature human subjects?", type: "radio-list", options: ["Yes", "No"] },
          {
            label: "Demographic diversity represented (if applicable)",
            type: "checkbox-list",
            options: ["Age diversity", "Gender diversity", "Ethnic / racial diversity", "Geographic diversity", "Occupational diversity", "Not applicable"],
          },
        ],
      },
      {
        title: "B-Roll & Metadata",
        questions: [
          { label: "Does the library include B-roll footage?", type: "radio-list", options: ["Yes", "No"] },
          {
            label: "Types of B-roll included (if applicable)",
            type: "checkbox-list",
            options: ["Establishing shots", "Cutaway footage", "Reaction shots", "Environmental / location", "Audience / crowd footage", "Backstage / behind-the-scenes", "Product close-ups", "Action sequences", "Nature / landscape", "Urban / architectural", "Not applicable"],
          },
          {
            label: "Existing metadata / annotation level",
            type: "radio-list",
            options: ["None", "Basic tags / titles only", "Transcripts / captions", "Scene / shot-level labels", "Object / face detection labels", "Full semantic annotation", "Not sure"],
          },
        ],
      },
      {
        title: "Broadcast Rights",
        questions: [
          { label: "Was this content originally broadcast under a network or distributor license?", type: "radio-list", options: ["Yes", "No", "Not sure"] },
          {
            label: "Broadcast rights status (if originally licensed to a network/distributor)",
            type: "radio-list",
            options: ["Rights fully reverted to us", "Rights partially reverted", "Rights still held by network / distributor", "Rights status unclear", "Never licensed to a network", "Not sure"],
          },
          { label: "Original network or distributor name (e.g. CBS, NBC, HBO)", type: "text" },
          { label: "Approximate year rights reverted (if applicable)", type: "text" },
        ],
      },
      {
        title: "Digitization Status",
        questions: [
          {
            label: "Current digitization status",
            type: "radio-list",
            options: ["Fully digitized", "Mostly digitized", "Partially digitized", "Not yet digitized (physical media only)", "Mixed — some digital, some physical", "Not sure"],
          },
          {
            label: "Physical media formats (for undigitized content)",
            type: "checkbox-list",
            options: ["16mm film", "35mm film", "2-inch videotape", "1-inch videotape", "Betacam / Betamax", "VHS", "U-matic", "LaserDisc", "Other tape format", "Not applicable"],
          },
          {
            label: "Digitization output quality (for digitized content)",
            type: "radio-list",
            options: ["SD (480p or below)", "HD (720p)", "Full HD (1080p)", "2K scan", "4K scan", "Mixed quality", "Not sure", "Not applicable"],
          },
          { label: "Digitization notes (vendor, timeline, condition of source material)", type: "multiline" },
        ],
      },
      {
        title: "Rights & Licensing",
        questions: [
          { label: "Who owns the intellectual property rights?", type: "radio-list", options: ["Fully owned by us", "Partially owned", "Licensed from others", "Mixed / unclear", "Not sure"] },
          { label: "Does the content contain embedded third-party IP (licensed music, logos, trademarks)?", type: "radio-list", options: ["Yes", "No", "Not sure"] },
          { label: "Historical / cultural significance", type: "radio-list", options: ["Yes — significant historical record", "Yes — culturally important", "Somewhat", "No", "Not sure"] },
          { label: "Open to licensing for AI training?", type: "radio-list", options: ["Yes", "Maybe — need more info", "No, not at this time"] },
          { label: "Additional notes or context", type: "multiline" },
        ],
      },
    ],
  },

  written: {
    label: "Written Works",
    subtitle: "Books, articles, blogs, journalism, scripts, research papers",
    sections: [
      {
        title: "Organization",
        questions: [
          { label: "Company / Organization Name", type: "text" },
          { label: "Contact Name", type: "text" },
          { label: "Contact Email", type: "text" },
        ],
      },
      {
        title: "Content Types & Genres",
        questions: [
          { label: "Types of written content (select all that apply)", type: "checkbox-list", options: ["Books / novels", "Academic papers", "Journalism / news articles", "Blog posts", "Scripts / screenplays", "Technical documentation", "Marketing copy", "Social posts", "Newsletters", "Other"] },
          { label: "Subject domains / genres", type: "checkbox-list", options: ["Fiction", "Non-fiction", "Science / technology", "Business / finance", "Health / medicine", "Law / policy", "Arts / culture", "Sports", "Politics", "General interest", "Mixed"] },
          { label: "Languages", type: "checkbox-list", options: ["English only", "Multiple languages", "Non-English primary", "Multilingual / parallel"] },
        ],
      },
      {
        title: "Volume & Format",
        questions: [
          { label: "Approximate total volume", type: "text", hint: "e.g. 50 million words, 100,000 articles, 500 books" },
          { label: "Originality", type: "radio-list", options: ["Highly original / creative", "Mostly original", "Mix of original and curated", "Primarily curated / aggregated"] },
          { label: "File formats", type: "checkbox-list", options: ["Plain text (.txt)", "Markdown", "HTML / web", "PDF", "Word / DOCX", "EPUB", "Structured (JSON / XML)", "Mixed"] },
          { label: "Existing metadata", type: "checkbox-list", options: ["Author attribution", "Publication dates", "Topic / category tags", "Named entity labels", "Sentiment labels", "Reading level", "None"] },
        ],
      },
      {
        title: "Rights & Licensing",
        questions: [
          { label: "Who owns the intellectual property rights?", type: "radio-list", options: ["Fully owned by us", "Partially owned", "Licensed from others", "Mixed / unclear", "Not sure"] },
          { label: "Open to licensing for AI training?", type: "radio-list", options: ["Yes", "Maybe — need more info", "No, not at this time"] },
          { label: "Additional notes or context", type: "multiline" },
        ],
      },
    ],
  },

  audio: {
    label: "Audio & Podcasts",
    subtitle: "Podcasts, music, speech, interviews, sound libraries, radio",
    sections: [
      { title: "Organization", questions: [{ label: "Company / Organization Name", type: "text" }, { label: "Contact Name", type: "text" }, { label: "Contact Email", type: "text" }] },
      { title: "Content Types", questions: [
        { label: "Types of audio content", type: "checkbox-list", options: ["Podcasts", "Music / songs", "Speech / narration", "Interviews", "Lectures / educational", "Sound effects / Foley", "Ambient / environmental", "Radio broadcasts", "Audiobooks", "Other"] },
        { label: "Languages / dialects", type: "checkbox-list", options: ["English only", "Multiple languages", "Regional dialects", "Non-English primary", "Multilingual"] },
      ]},
      { title: "Quality & Volume", questions: [
        { label: "Approximate total volume", type: "text", hint: "e.g. 5,000 hours, 20,000 episodes" },
        { label: "Typical audio quality", type: "radio-list", options: ["Studio quality (lossless)", "High quality (320kbps+)", "Standard quality", "Variable / mixed", "Low quality / archival"] },
        { label: "Transcripts available?", type: "radio-list", options: ["Full transcripts", "Partial transcripts", "Auto-generated only", "None"] },
        { label: "File formats", type: "checkbox-list", options: ["MP3", "WAV", "FLAC", "AAC", "OGG", "Mixed"] },
        { label: "Speaker / performer diversity", type: "checkbox-list", options: ["Age diversity", "Gender diversity", "Accent / dialect diversity", "Ethnic diversity", "Professional diversity"] },
      ]},
      { title: "Rights & Licensing", questions: [
        { label: "Who owns the intellectual property rights?", type: "radio-list", options: ["Fully owned by us", "Partially owned", "Licensed from others", "Mixed / unclear", "Not sure"] },
        { label: "Open to licensing for AI training?", type: "radio-list", options: ["Yes", "Maybe — need more info", "No, not at this time"] },
        { label: "Additional notes or context", type: "multiline" },
      ]},
    ],
  },

  images: {
    label: "Images & Photography",
    subtitle: "Photos, illustrations, stock imagery, fine art, archival images",
    sections: [
      { title: "Organization", questions: [{ label: "Company / Organization Name", type: "text" }, { label: "Contact Name", type: "text" }, { label: "Contact Email", type: "text" }] },
      { title: "Collection Details", questions: [
        { label: "Types of images", type: "checkbox-list", options: ["Photography", "Illustrations", "Graphic design", "Infographics", "Screenshots", "Medical / scientific imagery", "Satellite / aerial", "Archival / historical", "Art / fine art", "Product images", "Other"] },
        { label: "Primary subjects", type: "checkbox-list", options: ["People / portraits", "Nature / landscapes", "Urban / architecture", "Objects / products", "Events / scenes", "Abstract", "Animals", "Food", "Sports / action", "Mixed"] },
        { label: "Approximate total volume", type: "text", hint: "e.g. 2 million images" },
        { label: "Typical resolution", type: "radio-list", options: ["Low res (under 1MP)", "Medium (1–5MP)", "High (5–20MP)", "Very high (20MP+)", "Mixed"] },
        { label: "File formats", type: "checkbox-list", options: ["JPEG", "PNG", "TIFF", "RAW", "WebP", "SVG", "Mixed"] },
        { label: "Existing annotations / metadata", type: "checkbox-list", options: ["Captions / descriptions", "Object detection labels", "Segmentation masks", "Keyword tags", "EXIF / location data", "None"] },
        { label: "Do images feature identifiable human subjects?", type: "radio-list", options: ["Yes", "No", "Some"] },
      ]},
      { title: "Rights & Licensing", questions: [
        { label: "Who owns the intellectual property rights?", type: "radio-list", options: ["Fully owned by us", "Partially owned", "Licensed from others", "Mixed / unclear", "Not sure"] },
        { label: "Open to licensing for AI training?", type: "radio-list", options: ["Yes", "Maybe — need more info", "No, not at this time"] },
        { label: "Additional notes or context", type: "multiline" },
      ]},
    ],
  },

  social: {
    label: "Social Media Content",
    subtitle: "Posts, threads, reels, stories, UGC archives",
    sections: [
      { title: "Organization", questions: [{ label: "Company / Organization Name", type: "text" }, { label: "Contact Name", type: "text" }, { label: "Contact Email", type: "text" }] },
      { title: "Platform & Content", questions: [
        { label: "Platforms", type: "checkbox-list", options: ["Twitter / X", "Facebook", "Instagram", "LinkedIn", "TikTok", "YouTube", "Reddit", "Threads", "Pinterest", "Other"] },
        { label: "Content types in archive", type: "checkbox-list", options: ["Text posts", "Images", "Short-form video", "Long-form video", "Stories / ephemeral", "Comments / replies", "Threads", "Live streams", "Mixed"] },
        { label: "Does the archive include engagement data (likes, shares, reach)?", type: "radio-list", options: ["Yes", "No", "Partial"] },
        { label: "Time period covered", type: "radio-list", options: ["Under 1 year", "1–3 years", "3–5 years", "5–10 years", "10+ years"] },
        { label: "Account types", type: "checkbox-list", options: ["Brand / corporate accounts", "Individual creators", "News / media accounts", "Community / group pages", "Mixed"] },
        { label: "Approximate total volume", type: "text", hint: "e.g. 500,000 posts, 10 million impressions" },
      ]},
      { title: "Rights & Licensing", questions: [
        { label: "Who owns the intellectual property rights?", type: "radio-list", options: ["Fully owned by us", "Partially owned", "Licensed from others", "Mixed / unclear", "Not sure"] },
        { label: "Open to licensing for AI training?", type: "radio-list", options: ["Yes", "Maybe — need more info", "No, not at this time"] },
        { label: "Additional notes or context", type: "multiline" },
      ]},
    ],
  },

  design: {
    label: "Design & Illustration",
    subtitle: "Graphic design, logos, UI assets, vector art, motion graphics",
    sections: [
      { title: "Organization", questions: [{ label: "Company / Organization Name", type: "text" }, { label: "Contact Name", type: "text" }, { label: "Contact Email", type: "text" }] },
      { title: "Asset Details", questions: [
        { label: "Types of design assets", type: "checkbox-list", options: ["Logo / brand identity", "UI / UX designs", "Icons / symbols", "Typography / fonts", "Patterns / textures", "Packaging design", "Motion graphics", "3D models / renders", "Vector illustrations", "Other"] },
        { label: "Design style", type: "checkbox-list", options: ["Minimalist", "Bold / expressive", "Corporate / professional", "Playful / illustrative", "Technical / diagrammatic", "Mixed styles"] },
        { label: "File formats", type: "checkbox-list", options: ["SVG", "AI (Adobe Illustrator)", "PSD (Photoshop)", "Figma", "Sketch", "PNG / JPEG exports", "Mixed"] },
        { label: "Existing metadata / annotations", type: "checkbox-list", options: ["Style / category tags", "Color palette data", "Usage context", "Brand guidelines", "None"] },
        { label: "Approximate total volume", type: "text", hint: "e.g. 50,000 assets" },
      ]},
      { title: "Rights & Licensing", questions: [
        { label: "Who owns the intellectual property rights?", type: "radio-list", options: ["Fully owned by us", "Partially owned", "Licensed from others", "Mixed / unclear", "Not sure"] },
        { label: "Open to licensing for AI training?", type: "radio-list", options: ["Yes", "Maybe — need more info", "No, not at this time"] },
        { label: "Additional notes or context", type: "multiline" },
      ]},
    ],
  },

  games: {
    label: "Games & Interactive",
    subtitle: "Video games, interactive media, game assets, VR/AR",
    sections: [
      { title: "Organization", questions: [{ label: "Company / Organization Name", type: "text" }, { label: "Contact Name", type: "text" }, { label: "Contact Email", type: "text" }] },
      { title: "Content Details", questions: [
        { label: "Types of game / interactive content", type: "checkbox-list", options: ["Full video games", "Game assets (art / audio / code)", "Interactive simulations", "VR / AR experiences", "Game scripts / dialogue", "Gameplay footage", "Level designs", "Other"] },
        { label: "Target platforms", type: "checkbox-list", options: ["PC / desktop", "Console", "Mobile", "Web browser", "VR / AR headsets", "Mixed"] },
        { label: "Genres", type: "checkbox-list", options: ["Action / adventure", "Strategy", "Simulation", "RPG", "Sports", "Puzzle", "Educational", "Casual", "Other"] },
        { label: "Specific asset types available", type: "checkbox-list", options: ["3D models", "2D sprites / art", "Audio / music", "Code / scripts", "Level data", "Character animations", "Dialogue / narrative"] },
        { label: "Approximate total volume", type: "text", hint: "e.g. 20 titles, 500GB of assets" },
      ]},
      { title: "Rights & Licensing", questions: [
        { label: "Who owns the intellectual property rights?", type: "radio-list", options: ["Fully owned by us", "Partially owned", "Licensed from others", "Mixed / unclear", "Not sure"] },
        { label: "Open to licensing for AI training?", type: "radio-list", options: ["Yes", "Maybe — need more info", "No, not at this time"] },
        { label: "Additional notes or context", type: "multiline" },
      ]},
    ],
  },

  film: {
    label: "Film & Cinema",
    subtitle: "Feature films, shorts, documentaries, screenplays, production assets",
    sections: [
      { title: "Organization", questions: [{ label: "Company / Organization Name", type: "text" }, { label: "Contact Name", type: "text" }, { label: "Contact Email", type: "text" }] },
      { title: "Content Details", questions: [
        { label: "Types of film content", type: "checkbox-list", options: ["Feature films", "Short films", "Documentaries", "Screenplays / scripts", "Production stills", "Behind-the-scenes footage", "Trailers / promos", "Animation", "Other"] },
        { label: "Genres", type: "checkbox-list", options: ["Drama", "Comedy", "Action / thriller", "Horror", "Sci-fi / fantasy", "Documentary", "Animation", "Experimental", "Mixed"] },
        { label: "Era(s) the content spans", type: "checkbox-list", options: ["Pre-1960s", "1960s–1980s", "1980s–2000s", "2000s–2015", "2015–present", "Mixed eras"] },
        { label: "Does the content feature notable directors, actors, or historical figures?", type: "radio-list", options: ["Yes", "No", "Not sure"] },
        { label: "Notable individuals featured", type: "multiline", hint: "e.g. Orson Welles, Katharine Hepburn, Stanley Kubrick" },
        { label: "Subtitles / closed captions available?", type: "radio-list", options: ["Full subtitles (multiple languages)", "English only", "Partial", "None", "Not sure"] },
        { label: "Rights status", type: "radio-list", options: ["Fully owned / produced in-house", "Acquired with full rights", "Acquired with limited rights", "Mixed / unclear", "Not sure"] },
        { label: "Approximate total volume", type: "text", hint: "e.g. 300 feature films, 1,200 hours" },
      ]},
      { title: "Rights & Licensing", questions: [
        { label: "Open to licensing for AI training?", type: "radio-list", options: ["Yes", "Maybe — need more info", "No, not at this time"] },
        { label: "Additional notes or context", type: "multiline" },
      ]},
    ],
  },

  other: {
    label: "Other / Custom Content",
    subtitle: "Describe a content type not covered by the categories above",
    sections: [
      { title: "Organization", questions: [{ label: "Company / Organization Name", type: "text" }, { label: "Contact Name", type: "text" }, { label: "Contact Email", type: "text" }] },
      { title: "Content Description", questions: [
        { label: "Content type name / short description", type: "text", hint: "e.g. 3D models, scientific datasets, code repositories" },
        { label: "Format or medium", type: "checkbox-list", options: ["Text / documents", "Images", "Video", "Audio", "3D / spatial", "Structured data", "Code", "Mixed", "Other"] },
        { label: "Domain or industry", type: "checkbox-list", options: ["Science / research", "Technology", "Healthcare", "Education", "Finance", "Legal", "Government", "Arts / culture", "Sports", "Other"] },
        { label: "Approximate total volume", type: "text", hint: "e.g. 10,000 files, 500GB, 2 million records" },
        { label: "What makes this content unique or valuable for AI training?", type: "multiline" },
      ]},
      { title: "Rights & Licensing", questions: [
        { label: "Who owns the intellectual property rights?", type: "radio-list", options: ["Fully owned by us", "Partially owned", "Licensed from others", "Mixed / unclear", "Not sure"] },
        { label: "Open to licensing for AI training?", type: "radio-list", options: ["Yes", "Maybe — need more info", "No, not at this time"] },
        { label: "Additional notes or context", type: "multiline" },
      ]},
    ],
  },
};

// ─── PDF Generator ────────────────────────────────────────────────────────────

export function generateContentFormPDF(contentType: ContentTypeKey): Promise<Buffer> {
  return new Promise((resolve, reject) => {
  const form = CONTENT_TYPE_FORMS[contentType];
  if (!form) { reject(new Error(`Unknown content type: ${contentType}`)); return; }

  const chunks: Buffer[] = [];
  const doc = new PDFDocument({
    size: "LETTER",
    margins: { top: 60, bottom: 60, left: 56, right: 56 },
    info: {
      Title: `Credtent Content Valuation — ${form.label}`,
      Author: "Credtent",
      Subject: "Content Valuation Questionnaire",
    },
  });

  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  doc.on("end", () => resolve(Buffer.concat(chunks)));
  doc.on("error", reject);

  const PAGE_WIDTH = doc.page.width - 56 - 56; // usable width
  const LEFT = 56;

  // ── Helper: draw the page header ──────────────────────────────────────────
  const drawHeader = (isFirstPage: boolean) => {
    // Navy banner
    doc.rect(0, 0, doc.page.width, isFirstPage ? 90 : 50).fill(NAVY);

    // Logo shield (simple SVG-style polygon approximation)
    const sx = 36, sy = 12, sw = 28, sh = 28;
    doc.save()
      .moveTo(sx + sw / 2, sy)
      .lineTo(sx, sy + sh * 0.22)
      .lineTo(sx, sy + sh * 0.62)
      .bezierCurveTo(sx, sy + sh * 0.85, sx + sw / 2, sy + sh, sx + sw / 2, sy + sh)
      .bezierCurveTo(sx + sw, sy + sh, sx + sw, sy + sh * 0.85, sx + sw, sy + sh * 0.62)
      .lineTo(sx + sw, sy + sh * 0.22)
      .closePath()
      .fill(ORANGE);
    doc.fillColor(WHITE).fontSize(14).font("Helvetica-Bold")
      .text("C", sx + sw / 2 - 4, sy + 8);

    // Wordmark
    doc.fillColor(WHITE).fontSize(16).font("Helvetica-Bold")
      .text("Credtent", sx + sw + 8, sy + 6);
    doc.fillColor("#ffffff88").fontSize(9).font("Helvetica")
      .text("Content Valuation", sx + sw + 8, sy + 24);

    if (isFirstPage) {
      // Form title block
      doc.fillColor(WHITE).fontSize(18).font("Helvetica-Bold")
        .text(form.label, LEFT, 58);
      doc.fillColor("#ffffffaa").fontSize(9).font("Helvetica")
        .text(form.subtitle, LEFT, 80);
    }

    doc.restore();
  };

  // ── Helper: draw the page footer ──────────────────────────────────────────
  const drawFooter = () => {
    const y = doc.page.height - 36;
    doc.rect(0, y, doc.page.width, 36).fill(LIGHT_GRAY);
    doc.fillColor(MID_GRAY).fontSize(7.5).font("Helvetica")
      .text("Credtent · Content Valuation Questionnaire · credtent.org", LEFT, y + 12, { align: "left" })
      .text(`${form.label}`, 0, y + 12, { align: "right", width: doc.page.width - 56 });
  };

  // ── Helper: draw a text field ──────────────────────────────────────────────
  const drawTextField = (label: string, hint?: string, multiline = false) => {
    const fieldHeight = multiline ? 56 : 22;
    const needed = 14 + 10 + fieldHeight + 12;
    if (doc.y + needed > doc.page.height - 80) {
      doc.addPage();
      drawHeader(false);
      drawFooter();
      doc.y = 68;
    }

    doc.fillColor(DARK_GRAY).fontSize(9).font("Helvetica-Bold")
      .text(label, LEFT, doc.y);
    if (hint) {
      doc.fillColor(MID_GRAY).fontSize(7.5).font("Helvetica-Oblique")
        .text(hint, LEFT, doc.y + 1);
    }
    const boxY = doc.y + (hint ? 12 : 10);
    doc.rect(LEFT, boxY, PAGE_WIDTH, fieldHeight)
      .strokeColor("#d1d5db").lineWidth(0.75).stroke();
    doc.y = boxY + fieldHeight + 10;
  };

  // ── Helper: draw a checkbox/radio list ────────────────────────────────────
  const drawOptionList = (label: string, options: string[], multi: boolean) => {
    const cols = 2;
    const colW = PAGE_WIDTH / cols;
    const rowH = 14;
    const rows = Math.ceil(options.length / cols);
    const needed = 14 + 10 + rows * rowH + 12;

    if (doc.y + needed > doc.page.height - 80) {
      doc.addPage();
      drawHeader(false);
      drawFooter();
      doc.y = 68;
    }

    doc.fillColor(DARK_GRAY).fontSize(9).font("Helvetica-Bold")
      .text(label, LEFT, doc.y);
    const startY = doc.y + 10;

    options.forEach((opt, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const x = LEFT + col * colW;
      const y = startY + row * rowH;

      // Box or circle
      if (multi) {
        doc.rect(x, y + 1, 8, 8).strokeColor("#9ca3af").lineWidth(0.75).stroke();
      } else {
        doc.circle(x + 4, y + 5, 4).strokeColor("#9ca3af").lineWidth(0.75).stroke();
      }
      doc.fillColor(DARK_GRAY).fontSize(8).font("Helvetica")
        .text(opt, x + 12, y + 1, { width: colW - 16, lineBreak: false });
    });

    doc.y = startY + rows * rowH + 10;
  };

  // ── Draw first page header ─────────────────────────────────────────────────
  drawHeader(true);
  drawFooter();
  doc.y = 108;

  // ── Instructions block ─────────────────────────────────────────────────────
  doc.rect(LEFT, doc.y, PAGE_WIDTH, 30).fill(LIGHT_GRAY);
  doc.fillColor(DARK_GRAY).fontSize(8).font("Helvetica")
    .text(
      "Please complete this form and return it to Credtent at info@credtent.org. " +
      "You may also complete this assessment online at credtent.org. " +
      "All information is treated as confidential and used solely for valuation purposes.",
      LEFT + 8, doc.y + 8, { width: PAGE_WIDTH - 16 }
    );
  doc.y += 38;

  // ── Render sections ────────────────────────────────────────────────────────
  for (const section of form.sections) {
    // Section header
    const sectionHeaderNeeded = 24 + 8;
    if (doc.y + sectionHeaderNeeded > doc.page.height - 80) {
      doc.addPage();
      drawHeader(false);
      drawFooter();
      doc.y = 68;
    }

    doc.rect(LEFT, doc.y, PAGE_WIDTH, 20).fill(NAVY);
    doc.fillColor(WHITE).fontSize(9).font("Helvetica-Bold")
      .text(section.title.toUpperCase(), LEFT + 8, doc.y + 6);
    doc.y += 28;

    for (const q of section.questions) {
      if (q.type === "text") {
        drawTextField(q.label, q.hint, false);
      } else if (q.type === "multiline") {
        drawTextField(q.label, q.hint, true);
      } else if (q.type === "checkbox-list") {
        drawOptionList(q.label, q.options ?? [], true);
      } else if (q.type === "radio-list") {
        drawOptionList(q.label, q.options ?? [], false);
      }
    }

    doc.y += 4; // section spacing
  }

  // ── Closing block ──────────────────────────────────────────────────────────
  const closingNeeded = 50;
  if (doc.y + closingNeeded > doc.page.height - 80) {
    doc.addPage();
    drawHeader(false);
    drawFooter();
    doc.y = 68;
  }
  doc.rect(LEFT, doc.y, PAGE_WIDTH, 40).fill(LIGHT_GRAY);
  doc.fillColor(DARK_GRAY).fontSize(8).font("Helvetica")
    .text(
      "Thank you for completing this form. Return completed forms to info@credtent.org or visit credtent.org to submit online. " +
      "A Credtent specialist will follow up within 5 business days with a preliminary valuation estimate.",
      LEFT + 8, doc.y + 8, { width: PAGE_WIDTH - 16 }
    );

  doc.end();
  }); // end Promise
}

export { CONTENT_TYPE_FORMS };
