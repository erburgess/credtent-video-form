/**
 * Credtent Universal Content Valuation — Multi-Type Conversational Chat
 * Design: Split-screen — left chat assistant, right live content profile
 * Flow: Company info → content type selection → per-type questions → loop for more types
 * Supports: Video, Written (Books/Articles/Blogs), Audio/Podcasts, Images/Photography,
 *           Social Media, Design/Illustration, Video Games/Interactive, Film/Cinema
 * Palette: Credtent navy + orange, Sora font
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  CheckCircle2, Send, Film, FileText, Mic, Image, Share2,
  Palette, Gamepad2, Clapperboard, Building2, RotateCcw, Plus,
  ChevronRight, HelpCircle,
} from "lucide-react";

// ─── Content Types ────────────────────────────────────────────────────────────

export type ContentType =
  | "video"
  | "written"
  | "audio"
  | "images"
  | "social"
  | "design"
  | "games"
  | "film"
  | "other";

const CONTENT_TYPE_META: Record<ContentType, { label: string; icon: React.ElementType; color: string; description: string; customLabel?: string }> = {
  video:   { label: "Video Content",         icon: Film,        color: "oklch(0.55 0.15 264)", description: "Corporate, educational, documentary, B-roll, raw footage" },
  written: { label: "Written Works",         icon: FileText,    color: "oklch(0.55 0.18 145)", description: "Books, articles, blogs, journalism, scripts, research" },
  audio:   { label: "Audio & Podcasts",      icon: Mic,         color: "oklch(0.60 0.18 30)",  description: "Podcasts, music, speech, interviews, sound libraries" },
  images:  { label: "Images & Photography",  icon: Image,       color: "oklch(0.55 0.16 200)", description: "Photos, illustrations, stock imagery, art" },
  social:  { label: "Social Media Content",  icon: Share2,      color: "oklch(0.60 0.18 310)", description: "Posts, threads, reels, stories, UGC archives" },
  design:  { label: "Design & Illustration", icon: Palette,     color: "oklch(0.58 0.18 60)",  description: "Graphic design, logos, UI assets, vector art" },
  games:   { label: "Games & Interactive",   icon: Gamepad2,    color: "oklch(0.52 0.18 280)", description: "Video games, interactive media, game assets" },
  film:    { label: "Film & Cinema",         icon: Clapperboard,color: "oklch(0.45 0.12 264)", description: "Feature films, shorts, screenplays, production assets" },
  other:   { label: "Other / Custom",          icon: HelpCircle,  color: "oklch(0.52 0.08 264)", description: "Describe a content type not listed above" },
};

const ALL_CONTENT_TYPES = Object.keys(CONTENT_TYPE_META) as ContentType[];

// ─── Question Definitions ─────────────────────────────────────────────────────

type AnswerType = "chips" | "chips-single" | "toggle" | "text" | "email" | "textarea" | "number";

interface Question {
  id: string;
  ask: string;
  hint?: string;
  type: AnswerType;
  options?: string[];
  optional?: boolean;
  showIf?: (answers: TypeAnswers) => boolean;
}

type TypeAnswers = Record<string, string | string[] | boolean | number>;

// ── Shared questions for all content types ────────────────────────────────────

const SHARED_QUESTIONS: Question[] = [
  {
    id: "ownershipType",
    ask: "Who owns the intellectual property rights to this content?",
    type: "chips-single",
    options: ["Fully owned by us", "Partially owned", "Licensed from others", "Mixed/unclear"],
  },
  {
    id: "hasThirdPartyIP",
    ask: "Does the content contain any embedded third-party IP — licensed music, logos, trademarks, or other copyrighted elements?",
    type: "toggle",
  },
  {
    id: "hasPII",
    ask: "Does the content contain personally identifiable information (PII) — faces, names, contact details, or private data?",
    type: "toggle",
  },
  {
    id: "piiManagement",
    ask: "How is that PII currently managed?",
    type: "chips",
    options: ["Anonymized/blurred", "Consent obtained", "Private data excluded", "Not yet addressed"],
    showIf: (a) => a.hasPII === true,
  },
  {
    id: "exclusivity",
    ask: "How exclusive is this content — is similar content widely available elsewhere?",
    type: "chips-single",
    options: ["Fully proprietary", "Mostly proprietary", "Some similar exists", "Widely available"],
  },
  {
    id: "totalVolume",
    ask: "What's the approximate total volume of this content?",
    type: "text",
    hint: "e.g. '500 hours', '10,000 articles', '2 million images'",
  },
  {
    id: "licensingIntent",
    ask: "Is your organization open to licensing this content for AI training?",
    type: "chips-single",
    options: ["Yes, open to licensing", "Maybe, need more info", "No, not at this time"],
  },
  {
    id: "licensingModel",
    ask: "What licensing structures would you consider?",
    type: "chips",
    options: ["Non-exclusive", "Exclusive", "Perpetual", "Term-limited", "Revenue share", "Flat fee", "Open to discussion"],
    showIf: (a) => a.licensingIntent === "Yes, open to licensing",
  },
  {
    id: "previousAIUse",
    ask: "Has this content been used in any previous AI or machine learning projects?",
    type: "toggle",
  },
];

// ── Video-specific questions ──────────────────────────────────────────────────

const VIDEO_QUESTIONS: Question[] = [
  {
    id: "genres",
    ask: "What's the primary genre or subject matter of the video library? Select all that apply.",
    type: "chips",
    options: ["Sports", "Educational", "Documentary", "Corporate", "Entertainment", "News/Journalism", "Medical/Health", "Industrial", "Surveillance/Security", "User-Generated", "Nature/Wildlife", "Travel", "Lifestyle", "Other"],
  },
  {
    id: "clipDuration",
    ask: "What's the typical duration of individual clips?",
    type: "chips-single",
    options: ["Under 30s", "30s–2min", "2–10min", "10–30min", "30min+", "Mixed"],
  },
  {
    id: "hasBRoll",
    ask: "Does the library include B-roll footage — cutaways, establishing shots, or supplementary clips?",
    type: "toggle",
  },
  {
    id: "bRollTypes",
    ask: "What types of B-roll are included?",
    type: "chips",
    options: ["Establishing shots", "Cutaway footage", "Reaction shots", "Environmental/location", "Product close-ups", "Action sequences", "Crowd/event footage", "Nature/landscape", "Urban/architectural"],
    showIf: (a) => a.hasBRoll === true,
  },
  {
    id: "resolution",
    ask: "What resolutions does the content include?",
    type: "chips",
    options: ["SD (480p)", "HD (720p)", "Full HD (1080p)", "2K", "4K", "6K+", "Mixed"],
  },
  {
    id: "formats",
    ask: "What video formats or codecs are used?",
    type: "chips",
    options: ["MP4", "MOV", "AVI", "MXF", "ProRes", "RAW", "Other"],
  },
  {
    id: "hasHumanSubjects",
    ask: "Does the content feature human subjects — people, faces, or activities?",
    type: "toggle",
  },
  {
    id: "demographicDiversity",
    ask: "What demographic diversity is represented?",
    type: "chips",
    options: ["Age diversity", "Gender diversity", "Ethnic diversity", "Geographic diversity", "Activity diversity"],
    showIf: (a) => a.hasHumanSubjects === true,
  },
  {
    id: "metadataLevel",
    ask: "What level of metadata or annotation exists for the videos?",
    type: "chips-single",
    options: ["None", "Basic tags/titles", "Transcripts/captions", "Object detection labels", "Full semantic annotation"],
  },
  {
    id: "technicalIssues",
    ask: "Are there any known technical issues in the footage?",
    type: "chips",
    options: ["Motion blur", "Poor lighting", "Camera shake", "Watermarks", "Compression artifacts", "None known"],
  },
];

// ── Written content questions ─────────────────────────────────────────────────

const WRITTEN_QUESTIONS: Question[] = [
  {
    id: "writtenFormats",
    ask: "What types of written content do you have? Select all that apply.",
    type: "chips",
    options: ["Books/novels", "Academic papers", "Journalism/news articles", "Blog posts", "Scripts/screenplays", "Technical documentation", "Marketing copy", "Social posts", "Newsletters", "Other"],
  },
  {
    id: "writtenGenres",
    ask: "What genres or subject domains does the writing cover?",
    type: "chips",
    options: ["Fiction", "Non-fiction", "Science/technology", "Business/finance", "Health/medicine", "Law/policy", "Arts/culture", "Sports", "Politics", "General interest", "Mixed"],
  },
  {
    id: "writtenLanguages",
    ask: "What languages is the content written in?",
    type: "chips",
    options: ["English only", "Multiple languages", "Non-English primary", "Multilingual/parallel"],
  },
  {
    id: "writtenWordCount",
    ask: "What's the approximate total word count or number of pieces?",
    type: "text",
    hint: "e.g. '50 million words', '100,000 articles', '500 books'",
  },
  {
    id: "writtenOriginality",
    ask: "How would you characterize the originality of the writing?",
    type: "chips-single",
    options: ["Highly original/creative", "Mostly original", "Mix of original and curated", "Primarily curated/aggregated"],
  },
  {
    id: "writtenMetadata",
    ask: "What metadata exists for the written content?",
    type: "chips",
    options: ["Author attribution", "Publication dates", "Topic/category tags", "Named entity labels", "Sentiment labels", "Reading level", "None"],
  },
  {
    id: "writtenFormat",
    ask: "What file formats are the documents in?",
    type: "chips",
    options: ["Plain text (.txt)", "Markdown", "HTML/web", "PDF", "Word/DOCX", "EPUB", "Structured (JSON/XML)", "Mixed"],
  },
];

// ── Audio questions ───────────────────────────────────────────────────────────

const AUDIO_QUESTIONS: Question[] = [
  {
    id: "audioFormats",
    ask: "What types of audio content do you have?",
    type: "chips",
    options: ["Podcasts", "Music/songs", "Speech/narration", "Interviews", "Lectures/educational", "Sound effects/Foley", "Ambient/environmental", "Radio broadcasts", "Audiobooks", "Other"],
  },
  {
    id: "audioLanguages",
    ask: "What languages or dialects are represented in the audio?",
    type: "chips",
    options: ["English only", "Multiple languages", "Regional dialects", "Non-English primary", "Multilingual"],
  },
  {
    id: "audioQuality",
    ask: "What's the typical audio quality?",
    type: "chips-single",
    options: ["Studio quality (lossless)", "High quality (320kbps+)", "Standard quality", "Variable/mixed", "Low quality/archival"],
  },
  {
    id: "audioTranscripts",
    ask: "Do transcripts or captions exist for the audio?",
    type: "chips-single",
    options: ["Full transcripts", "Partial transcripts", "Auto-generated only", "None"],
  },
  {
    id: "audioSpeakerDiversity",
    ask: "How diverse are the speakers or performers represented?",
    type: "chips",
    options: ["Age diversity", "Gender diversity", "Accent/dialect diversity", "Ethnic diversity", "Professional diversity"],
  },
  {
    id: "audioFileFormat",
    ask: "What file formats are the audio files in?",
    type: "chips",
    options: ["MP3", "WAV", "FLAC", "AAC", "OGG", "Mixed"],
  },
];

// ── Image questions ───────────────────────────────────────────────────────────

const IMAGE_QUESTIONS: Question[] = [
  {
    id: "imageTypes",
    ask: "What types of images does the collection include?",
    type: "chips",
    options: ["Photography", "Illustrations", "Graphic design", "Infographics", "Screenshots", "Medical/scientific imagery", "Satellite/aerial", "Archival/historical", "Art/fine art", "Product images", "Other"],
  },
  {
    id: "imageSubjects",
    ask: "What are the primary subjects of the images?",
    type: "chips",
    options: ["People/portraits", "Nature/landscapes", "Urban/architecture", "Objects/products", "Events/scenes", "Abstract", "Animals", "Food", "Sports/action", "Mixed"],
  },
  {
    id: "imageResolution",
    ask: "What's the typical image resolution?",
    type: "chips-single",
    options: ["Low res (under 1MP)", "Medium (1–5MP)", "High (5–20MP)", "Very high (20MP+)", "Mixed"],
  },
  {
    id: "imageAnnotations",
    ask: "What annotations or metadata exist for the images?",
    type: "chips",
    options: ["Captions/descriptions", "Object detection labels", "Segmentation masks", "Keyword tags", "EXIF/location data", "None"],
  },
  {
    id: "imageFileFormats",
    ask: "What file formats are the images in?",
    type: "chips",
    options: ["JPEG", "PNG", "TIFF", "RAW", "WebP", "SVG", "Mixed"],
  },
  {
    id: "imageHumanSubjects",
    ask: "Do the images feature identifiable human subjects?",
    type: "toggle",
  },
];

// ── Social media questions ────────────────────────────────────────────────────

const SOCIAL_QUESTIONS: Question[] = [
  {
    id: "socialPlatforms",
    ask: "Which platforms does the social content come from?",
    type: "chips",
    options: ["Twitter/X", "Facebook", "Instagram", "LinkedIn", "TikTok", "YouTube", "Reddit", "Threads", "Pinterest", "Other"],
  },
  {
    id: "socialContentTypes",
    ask: "What types of social content are in the archive?",
    type: "chips",
    options: ["Text posts", "Images", "Short-form video", "Long-form video", "Stories/ephemeral", "Comments/replies", "Threads", "Live streams", "Mixed"],
  },
  {
    id: "socialEngagementData",
    ask: "Does the archive include engagement data — likes, shares, comments, reach?",
    type: "toggle",
  },
  {
    id: "socialTimespan",
    ask: "What time period does the social archive cover?",
    type: "chips-single",
    options: ["Under 1 year", "1–3 years", "3–5 years", "5–10 years", "10+ years"],
  },
  {
    id: "socialAccountType",
    ask: "What type of accounts does this content come from?",
    type: "chips",
    options: ["Brand/corporate accounts", "Individual creators", "News/media accounts", "Community/group pages", "Mixed"],
  },
];

// ── Design questions ──────────────────────────────────────────────────────────

const DESIGN_QUESTIONS: Question[] = [
  {
    id: "designTypes",
    ask: "What types of design assets are in the collection?",
    type: "chips",
    options: ["Logo/brand identity", "UI/UX designs", "Icons/symbols", "Typography/fonts", "Patterns/textures", "Packaging design", "Motion graphics", "3D models/renders", "Vector illustrations", "Other"],
  },
  {
    id: "designStyle",
    ask: "How would you describe the design style?",
    type: "chips",
    options: ["Minimalist", "Bold/expressive", "Corporate/professional", "Playful/illustrative", "Technical/diagrammatic", "Mixed styles"],
  },
  {
    id: "designFileFormats",
    ask: "What file formats are the design assets in?",
    type: "chips",
    options: ["SVG", "AI (Adobe Illustrator)", "PSD (Photoshop)", "Figma", "Sketch", "PNG/JPEG exports", "Mixed"],
  },
  {
    id: "designAnnotations",
    ask: "What metadata or annotations exist for the design assets?",
    type: "chips",
    options: ["Style/category tags", "Color palette data", "Usage context", "Brand guidelines", "None"],
  },
];

// ── Other/Custom content questions ──────────────────────────────────────────

const OTHER_QUESTIONS: Question[] = [
  {
    id: "otherContentDescription",
    ask: "How would you describe this content? Give it a name or short description.",
    type: "text",
    hint: "e.g. '3D models', 'scientific datasets', 'code repositories'",
  },
  {
    id: "otherContentFormat",
    ask: "What format or medium is this content in?",
    type: "chips",
    options: ["Text/documents", "Images", "Video", "Audio", "3D/spatial", "Structured data", "Code", "Mixed", "Other"],
  },
  {
    id: "otherContentDomain",
    ask: "What domain or industry does this content relate to?",
    type: "chips",
    options: ["Science/research", "Technology", "Healthcare", "Education", "Finance", "Legal", "Government", "Arts/culture", "Sports", "Other"],
  },
  {
    id: "otherContentVolume",
    ask: "What's the approximate volume of this content?",
    type: "text",
    hint: "e.g. '10,000 files', '500GB', '2 million records'",
  },
  {
    id: "otherContentUniqueness",
    ask: "What makes this content unique or valuable for AI training?",
    type: "textarea",
    optional: true,
    hint: "e.g. rare subject matter, specialized expertise, unique annotations…",
  },
];

// ── Games/Interactive questions ───────────────────────────────────────────────

const GAMES_QUESTIONS: Question[] = [
  {
    id: "gamesTypes",
    ask: "What types of game or interactive content do you have?",
    type: "chips",
    options: ["Full video games", "Game assets (art/audio/code)", "Interactive simulations", "VR/AR experiences", "Game scripts/dialogue", "Gameplay footage", "Level designs", "Other"],
  },
  {
    id: "gamesPlatforms",
    ask: "What platforms are the games or assets designed for?",
    type: "chips",
    options: ["PC/desktop", "Console", "Mobile", "Web browser", "VR/AR headsets", "Mixed"],
  },
  {
    id: "gamesGenres",
    ask: "What genres do the games cover?",
    type: "chips",
    options: ["Action/adventure", "Strategy", "Simulation", "RPG", "Sports", "Puzzle", "Educational", "Casual", "Other"],
  },
  {
    id: "gamesAssetTypes",
    ask: "What specific asset types are available?",
    type: "chips",
    options: ["3D models", "2D sprites/art", "Audio/music", "Code/scripts", "Level data", "Character animations", "Dialogue/narrative"],
  },
];

// ── Film/Cinema questions ─────────────────────────────────────────────────────

const FILM_QUESTIONS: Question[] = [
  {
    id: "filmTypes",
    ask: "What types of film content do you have?",
    type: "chips",
    options: ["Feature films", "Short films", "Documentaries", "Screenplays/scripts", "Production stills", "Behind-the-scenes footage", "Trailers/promos", "Animation", "Other"],
  },
  {
    id: "filmGenres",
    ask: "What genres does the film content cover?",
    type: "chips",
    options: ["Drama", "Comedy", "Action/thriller", "Horror", "Sci-fi/fantasy", "Documentary", "Animation", "Experimental", "Mixed"],
  },
  {
    id: "filmEra",
    ask: "What era does the film content span?",
    type: "chips",
    options: ["Pre-1960s", "1960s–1980s", "1980s–2000s", "2000s–2015", "2015–present", "Mixed eras"],
  },
  {
    id: "filmSubtitles",
    ask: "Are subtitles or closed captions available?",
    type: "chips-single",
    options: ["Full subtitles (multiple languages)", "English only", "Partial", "None"],
  },
  {
    id: "filmRights",
    ask: "What is the rights status of the film content?",
    type: "chips-single",
    options: ["Fully owned/produced in-house", "Acquired with full rights", "Acquired with limited rights", "Mixed/unclear"],
  },
];

// ── Map content type to questions ─────────────────────────────────────────────

const TYPE_QUESTIONS: Record<ContentType, Question[]> = {
  video:   VIDEO_QUESTIONS,
  written: WRITTEN_QUESTIONS,
  audio:   AUDIO_QUESTIONS,
  images:  IMAGE_QUESTIONS,
  social:  SOCIAL_QUESTIONS,
  design:  DESIGN_QUESTIONS,
  games:   GAMES_QUESTIONS,
  film:    FILM_QUESTIONS,
  other:   OTHER_QUESTIONS,
};

// ─── Company questions ────────────────────────────────────────────────────────

const COMPANY_QUESTIONS: Question[] = [
  {
    id: "companyName",
    ask: "Let's start with your organization. What's the company name?",
    type: "text",
  },
  {
    id: "contactName",
    ask: "Great. Who should Credtent follow up with? What's your name?",
    type: "text",
  },
  {
    id: "contactEmail",
    ask: "And the best email address for follow-up?",
    type: "email",
  },
];

// ─── State Types ──────────────────────────────────────────────────────────────

type Phase =
  | { stage: "company"; qIndex: number }
  | { stage: "type-select" }
  | { stage: "type-questions"; type: ContentType; qIndex: number; sharedIndex: number; inShared: boolean }
  | { stage: "more-types" }
  | { stage: "notes" }
  | { stage: "done" };

interface ContentEntry {
  type: ContentType;
  answers: TypeAnswers;
  customLabel?: string;
}

interface AppState {
  companyAnswers: TypeAnswers;
  contentEntries: ContentEntry[];
  completedTypes: ContentType[];
  phase: Phase;
  notes: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatVal(val: string | string[] | boolean | number | undefined): string {
  if (val === undefined || val === null || val === "") return "";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (Array.isArray(val)) return val.length ? val.join(", ") : "";
  return String(val);
}

function getVisibleQuestions(questions: Question[], answers: TypeAnswers): Question[] {
  return questions.filter((q) => !q.showIf || q.showIf(answers));
}

// ─── Chip Selector ────────────────────────────────────────────────────────────

function ChipSelector({
  options, selected, multi, onSelect,
}: {
  options: string[];
  selected: string[];
  multi: boolean;
  onSelect: (val: string[]) => void;
}) {
  const toggle = (opt: string) => {
    if (!multi) { onSelect([opt]); return; }
    onSelect(selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt]);
  };
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {options.map((opt) => (
        <button key={opt} type="button" onClick={() => toggle(opt)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-all duration-150 ${
            selected.includes(opt)
              ? "bg-[oklch(0.22_0.08_264)] border-[oklch(0.22_0.08_264)] text-white"
              : "bg-white border-gray-200 text-gray-600 hover:border-[oklch(0.22_0.08_264)] hover:text-[oklch(0.22_0.08_264)]"
          }`}>
          {selected.includes(opt) && <CheckCircle2 className="w-3.5 h-3.5" />}
          {opt}
        </button>
      ))}
    </div>
  );
}

// ─── Content Type Selector ────────────────────────────────────────────────────

function ContentTypeSelector({
  selected, completed, onSelect,
}: {
  selected: string[];
  completed: ContentType[];
  onSelect: (val: string[]) => void;
}) {
  const toggle = (ct: ContentType) => {
    if (completed.includes(ct)) return;
    onSelect(selected.includes(ct) ? selected.filter((s) => s !== ct) : [...selected, ct]);
  };
  // Separate 'other' from the main grid so it spans full width at the bottom
  const mainTypes = ALL_CONTENT_TYPES.filter((ct) => ct !== "other");
  return (
    <div className="mt-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {mainTypes.map((ct) => {
          const meta = CONTENT_TYPE_META[ct];
          const Icon = meta.icon;
          const isSelected = selected.includes(ct);
          const isDone = completed.includes(ct);
          return (
            <button key={ct} type="button" onClick={() => toggle(ct)} disabled={isDone}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all duration-150 ${
                isDone
                  ? "bg-green-50 border-green-200 opacity-70 cursor-default"
                  : isSelected
                  ? "bg-[oklch(0.22_0.08_264)] border-[oklch(0.22_0.08_264)] text-white"
                  : "bg-white border-gray-200 text-gray-700 hover:border-[oklch(0.22_0.08_264)]"
              }`}>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                isDone ? "bg-green-100" : isSelected ? "bg-white/20" : "bg-gray-50"
              }`}>
                {isDone
                  ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                  : <Icon className="w-4 h-4" style={{ color: isDone || isSelected ? undefined : meta.color }} />
                }
              </div>
              <div className="min-w-0">
                <p className={`text-xs font-semibold truncate ${isSelected ? "text-white" : isDone ? "text-green-700" : "text-gray-800"}`}>
                  {meta.label}
                </p>
                {isDone && <p className="text-xs text-green-500">Complete</p>}
              </div>
            </button>
          );
        })}
      </div>
      {/* Other / Custom — full-width dashed tile */}
      {(() => {
        const ct: ContentType = "other";
        const meta = CONTENT_TYPE_META[ct];
        const Icon = meta.icon;
        const isSelected = selected.includes(ct);
        const isDone = completed.includes(ct);
        return (
          <button type="button" onClick={() => toggle(ct)} disabled={isDone}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 border-dashed text-left transition-all duration-150 ${
              isDone
                ? "bg-green-50 border-green-200 opacity-70 cursor-default"
                : isSelected
                ? "bg-[oklch(0.22_0.08_264)] border-[oklch(0.22_0.08_264)] text-white"
                : "bg-white border-gray-200 text-gray-500 hover:border-[oklch(0.52_0.08_264)] hover:text-[oklch(0.52_0.08_264)]"
            }`}>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
              isDone ? "bg-green-100" : isSelected ? "bg-white/20" : "bg-gray-50"
            }`}>
              {isDone
                ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                : <Icon className="w-4 h-4" style={{ color: isSelected ? "white" : meta.color }} />
              }
            </div>
            <div className="min-w-0">
              <p className={`text-xs font-semibold ${isSelected ? "text-white" : isDone ? "text-green-700" : "text-gray-600"}`}>
                {meta.label}
              </p>
              {!isDone && !isSelected && (
                <p className="text-xs text-gray-400 truncate">{meta.description}</p>
              )}
              {isDone && <p className="text-xs text-green-500">Complete</p>}
            </div>
          </button>
        );
      })()}
    </div>
  );
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex gap-3 mt-3">
      {["Yes", "No"].map((label) => {
        const isYes = label === "Yes";
        const active = value === isYes;
        return (
          <button key={label} type="button" onClick={() => onChange(isYes)}
            className={`px-5 py-2 rounded-full border text-sm font-semibold transition-all duration-150 ${
              active
                ? "bg-[oklch(0.22_0.08_264)] border-[oklch(0.22_0.08_264)] text-white"
                : "bg-white border-gray-200 text-gray-500 hover:border-gray-400"
            }`}>
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Chat Bubbles ─────────────────────────────────────────────────────────────

function CredtentLogo({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <path d="M20 3L5 9V20C5 28.5 11.5 36.4 20 38C28.5 36.4 35 28.5 35 20V9L20 3Z" fill="oklch(0.68 0.19 41)" />
      <text x="20" y="26" textAnchor="middle" fill="white" fontSize="16" fontWeight="bold" fontFamily="Sora,sans-serif">C</text>
    </svg>
  );
}

function AssistantBubble({ text, isNew }: { text: string; isNew?: boolean }) {
  return (
    <div className={`flex gap-3 items-start ${isNew ? "animate-in fade-in slide-in-from-bottom-2 duration-300" : ""}`}>
      <div className="w-8 h-8 rounded-full bg-[oklch(0.22_0.08_264)] flex items-center justify-center flex-shrink-0 mt-0.5">
        <CredtentLogo size={16} />
      </div>
      <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 max-w-sm shadow-sm">
        <p className="text-sm text-gray-800 leading-relaxed">{text}</p>
      </div>
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="bg-[oklch(0.22_0.08_264)] text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-sm">
        <p className="text-sm leading-relaxed">{text}</p>
      </div>
    </div>
  );
}

function SectionBadge({ type }: { type: ContentType }) {
  const meta = CONTENT_TYPE_META[type];
  const Icon = meta.icon;
  return (
    <div className="flex items-center gap-2 mt-3 mb-1">
      <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: meta.color + "22" }}>
        <Icon className="w-3.5 h-3.5" style={{ color: meta.color }} />
      </div>
      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: meta.color }}>{meta.label}</span>
    </div>
  );
}

// ─── Profile Panel ────────────────────────────────────────────────────────────

function ProfilePanel({ state }: { state: AppState }) {
  const { companyAnswers, contentEntries } = state;
  const totalTypes = contentEntries.length;
  const totalQ = 3 + totalTypes * (8 + 6); // rough estimate
  const answered = Object.keys(companyAnswers).length + contentEntries.reduce((acc, e) => acc + Object.keys(e.answers).length, 0);
  const pct = Math.min(100, Math.round((answered / Math.max(totalQ, 10)) * 100));

  return (
    <div className="h-full flex flex-col">
      <div className="px-5 py-4 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold text-[oklch(0.22_0.08_264)]">Content Profile</h2>
          {totalTypes > 0 && (
            <span className="text-xs bg-[oklch(0.96_0.04_41)] text-[oklch(0.68_0.19_41)] px-2 py-0.5 rounded-full font-semibold">
              {totalTypes} type{totalTypes !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-[oklch(0.68_0.19_41)] rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* Company */}
        {Object.keys(companyAnswers).length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Building2 className="w-3.5 h-3.5 text-[oklch(0.68_0.19_41)]" />
              <p className="text-xs font-semibold text-[oklch(0.22_0.08_264)] uppercase tracking-wider">Organization</p>
            </div>
            <div className="space-y-1 pl-5">
              {Object.entries(companyAnswers).map(([k, v]) => {
                const f = formatVal(v); if (!f) return null;
                return (
                  <div key={k} className="flex gap-2 items-start">
                    <CheckCircle2 className="w-3 h-3 text-green-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-gray-700 font-medium">{f}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Content entries */}
        {contentEntries.map((entry, i) => {
          const meta = CONTENT_TYPE_META[entry.type];
          const Icon = meta.icon;
          const displayLabel = entry.customLabel || meta.label;
          const items = Object.entries(entry.answers).filter(([k, v]) => {
            if (k === "otherContentDescription") return false; // shown as the label already
            const f = formatVal(v); return f && f !== "false" && f !== "No";
          });
          return (
            <div key={i} className="animate-in fade-in duration-300">
              <div className="flex items-center gap-1.5 mb-2">
                <Icon className="w-3.5 h-3.5" style={{ color: meta.color }} />
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: meta.color }}>{displayLabel}</p>
              </div>
              <div className="space-y-1.5 pl-5">
                {items.map(([k, v]) => (
                  <div key={k} className="flex gap-2 items-start">
                    <CheckCircle2 className="w-3 h-3 text-green-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-gray-700 font-medium leading-snug">{formatVal(v)}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {contentEntries.length === 0 && Object.keys(companyAnswers).length === 0 && (
          <div className="text-center py-10">
            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-3">
              <Film className="w-5 h-5 text-gray-300" />
            </div>
            <p className="text-xs text-gray-400">Your content profile will appear here as you respond.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Home() {
  const [appState, setAppState] = useState<AppState>({
    companyAnswers: {},
    contentEntries: [],
    completedTypes: [],
    phase: { stage: "company", qIndex: 0 },
    notes: "",
  });

  const [chatHistory, setChatHistory] = useState<{ role: "assistant" | "user"; text: string; badge?: ContentType }[]>([]);
  const [inputText, setInputText] = useState("");
  const [pendingChips, setPendingChips] = useState<string[]>([]);
  const [pendingToggle, setPendingToggle] = useState<boolean | null>(null);
  const [pendingTypeSelect, setPendingTypeSelect] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Current type's working answers (for showIf logic)
  const currentTypeAnswers = useRef<TypeAnswers>({});

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, isTyping]);

  // Boot
  useEffect(() => {
    setTimeout(() => {
      setChatHistory([{ role: "assistant", text: "Hi! I'm the Credtent content assessment assistant. I'll help you build a complete content profile across all of your content types — so we can assess the full value of your library for AI training licensing." }]);
      setTimeout(() => {
        setChatHistory((p) => [...p, { role: "assistant", text: COMPANY_QUESTIONS[0].ask }]);
      }, 700);
    }, 300);
  }, []);

  const pushAssistant = useCallback((text: string, badge?: ContentType) => {
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      setChatHistory((p) => [...p, { role: "assistant", text, badge }]);
    }, 550);
  }, []);

  const pushUser = useCallback((text: string) => {
    setChatHistory((p) => [...p, { role: "user", text }]);
  }, []);

  // ── Advance logic ─────────────────────────────────────────────────────────

  const advancePhase = useCallback((state: AppState, userDisplay: string) => {
    const { phase } = state;

    if (phase.stage === "company") {
      const nextIdx = phase.qIndex + 1;
      if (nextIdx < COMPANY_QUESTIONS.length) {
        setAppState((s) => ({ ...s, phase: { stage: "company", qIndex: nextIdx } }));
        pushAssistant(COMPANY_QUESTIONS[nextIdx].ask);
      } else {
        // Move to type selection
        setAppState((s) => ({ ...s, phase: { stage: "type-select" } }));
        pushAssistant("Thanks! Now, what types of content does your organization have? Select all that apply — we'll go through each one in turn.");
        setPendingTypeSelect([]);
      }
      return;
    }

    if (phase.stage === "type-select") {
      // handled in handleConfirmTypes
      return;
    }

    if (phase.stage === "type-questions") {
      const { type, qIndex, sharedIndex, inShared } = phase;
      const typeQs = getVisibleQuestions(TYPE_QUESTIONS[type], currentTypeAnswers.current);
      const sharedQs = getVisibleQuestions(SHARED_QUESTIONS, currentTypeAnswers.current);

      if (!inShared) {
        const nextIdx = qIndex + 1;
        const nextTypeQ = typeQs[nextIdx];
        if (nextTypeQ) {
          setAppState((s) => ({ ...s, phase: { ...phase, qIndex: nextIdx } }));
          pushAssistant(nextTypeQ.ask, type);
        } else {
          // Move to shared questions
          if (sharedQs.length > 0) {
            setAppState((s) => ({ ...s, phase: { ...phase, inShared: true, sharedIndex: 0 } }));
            pushAssistant(sharedQs[0].ask, type);
          } else {
            finishType(state, type);
          }
        }
      } else {
        const nextSharedIdx = sharedIndex + 1;
        const nextSharedQ = sharedQs[nextSharedIdx];
        if (nextSharedQ) {
          setAppState((s) => ({ ...s, phase: { ...phase, sharedIndex: nextSharedIdx } }));
          pushAssistant(nextSharedQ.ask, type);
        } else {
          finishType(state, type);
        }
      }
      return;
    }

    if (phase.stage === "more-types") {
      // handled in handleMoreTypes
      return;
    }

    if (phase.stage === "notes") {
      setAppState((s) => ({ ...s, phase: { stage: "done" } }));
      pushAssistant("That's everything! Your content profile is complete. Credtent will review your responses and follow up with a valuation estimate. Thank you!");
    }
  }, [pushAssistant]);

  const finishType = useCallback((state: AppState, type: ContentType) => {
    const meta = CONTENT_TYPE_META[type];
    // For 'other', use the user's custom description as the label if available
    const customLabel = type === "other" && currentTypeAnswers.current.otherContentDescription
      ? String(currentTypeAnswers.current.otherContentDescription)
      : undefined;
    const newEntry: ContentEntry = { type, answers: { ...currentTypeAnswers.current }, customLabel };
    const newCompleted = [...state.completedTypes, type];
    currentTypeAnswers.current = {};

    setAppState((s) => ({
      ...s,
      contentEntries: [...s.contentEntries, newEntry],
      completedTypes: newCompleted,
      phase: { stage: "more-types" },
    }));

    const displayName = customLabel || meta.label;
    pushAssistant(`Great — I've captured your ${displayName} profile. Do you have any other types of content to add?`);
    setPendingTypeSelect([]);
  }, [pushAssistant]);

  // ── Answer submission ─────────────────────────────────────────────────────

  const submitAnswer = useCallback((value: string | string[] | boolean, displayText: string) => {
    const { phase } = appState;
    pushUser(displayText);

    if (phase.stage === "company") {
      const q = COMPANY_QUESTIONS[phase.qIndex];
      const newAnswers = { ...appState.companyAnswers, [q.id]: value };
      const newState = { ...appState, companyAnswers: newAnswers };
      setAppState(newState);
      advancePhase(newState, displayText);
    } else if (phase.stage === "type-questions") {
      const { type, qIndex, sharedIndex, inShared } = phase;
      const typeQs = getVisibleQuestions(TYPE_QUESTIONS[type], currentTypeAnswers.current);
      const sharedQs = getVisibleQuestions(SHARED_QUESTIONS, currentTypeAnswers.current);
      const q = inShared ? sharedQs[sharedIndex] : typeQs[qIndex];
      if (q) {
        currentTypeAnswers.current = { ...currentTypeAnswers.current, [q.id]: value };
      }
      advancePhase(appState, displayText);
    } else if (phase.stage === "notes") {
      const newState = { ...appState, notes: String(value) };
      setAppState(newState);
      advancePhase(newState, displayText);
    }

    setInputText("");
    setPendingChips([]);
    setPendingToggle(null);
  }, [appState, advancePhase, pushUser]);

  const handleConfirmTypes = useCallback(() => {
    if (pendingTypeSelect.length === 0) return;
    const types = pendingTypeSelect as ContentType[];
    const first = types[0];
    const meta = CONTENT_TYPE_META[first];
    const displayText = types.map((t) => CONTENT_TYPE_META[t].label).join(", ");
    pushUser(displayText);
    currentTypeAnswers.current = {};

    setAppState((s) => ({
      ...s,
      phase: { stage: "type-questions", type: first, qIndex: 0, sharedIndex: 0, inShared: false },
    }));

    const typeQs = getVisibleQuestions(TYPE_QUESTIONS[first], {});
    pushAssistant(`Let's start with your ${meta.label}. ${typeQs[0].ask}`, first);
    setPendingTypeSelect([]);
  }, [pendingTypeSelect, pushAssistant, pushUser]);

  const handleMoreTypes = useCallback((addMore: boolean) => {
    pushUser(addMore ? "Yes, I have more" : "No, that's everything");
    if (addMore) {
      setAppState((s) => ({ ...s, phase: { stage: "type-select" } }));
      pushAssistant("What other content types would you like to add?");
      setPendingTypeSelect([]);
    } else {
      setAppState((s) => ({ ...s, phase: { stage: "notes" } }));
      pushAssistant("Almost done! Is there anything else Credtent should know — any context, restrictions, or special considerations about your content library?");
    }
  }, [pushAssistant, pushUser]);

  const handleSend = useCallback(() => {
    const { phase } = appState;

    if (phase.stage === "type-select") {
      handleConfirmTypes();
      return;
    }

    if (phase.stage === "more-types") return;

    if (phase.stage === "company") {
      const q = COMPANY_QUESTIONS[phase.qIndex];
      if (!inputText.trim()) return;
      submitAnswer(inputText.trim(), inputText.trim());
      return;
    }

    if (phase.stage === "type-questions") {
      const { type, qIndex, sharedIndex, inShared } = phase;
      const typeQs = getVisibleQuestions(TYPE_QUESTIONS[type], currentTypeAnswers.current);
      const sharedQs = getVisibleQuestions(SHARED_QUESTIONS, currentTypeAnswers.current);
      const q = inShared ? sharedQs[sharedIndex] : typeQs[qIndex];
      if (!q) return;

      if (q.type === "chips" || q.type === "chips-single") {
        if (pendingChips.length === 0 && !q.optional) return;
        submitAnswer(pendingChips, pendingChips.join(", ") || "Skipped");
      } else if (q.type === "toggle") {
        if (pendingToggle === null) return;
        submitAnswer(pendingToggle, pendingToggle ? "Yes" : "No");
      } else {
        if (!inputText.trim() && !q.optional) return;
        submitAnswer(inputText.trim(), inputText.trim() || "Skipped");
      }
      return;
    }

    if (phase.stage === "notes") {
      submitAnswer(inputText.trim(), inputText.trim() || "No additional notes");
    }
  }, [appState, handleConfirmTypes, inputText, pendingChips, pendingToggle, submitAnswer]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleReset = () => {
    setAppState({ companyAnswers: {}, contentEntries: [], completedTypes: [], phase: { stage: "company", qIndex: 0 }, notes: "" });
    setChatHistory([]);
    setInputText(""); setPendingChips([]); setPendingToggle(null); setPendingTypeSelect([]);
    currentTypeAnswers.current = {};
    setTimeout(() => {
      setChatHistory([{ role: "assistant", text: "Hi! I'm the Credtent content assessment assistant. I'll help you build a complete content profile across all of your content types — so we can assess the full value of your library for AI training licensing." }]);
      setTimeout(() => setChatHistory((p) => [...p, { role: "assistant", text: COMPANY_QUESTIONS[0].ask }]), 700);
    }, 300);
  };

  // ── Current question for input rendering ──────────────────────────────────

  const getCurrentQuestion = (): Question | null => {
    const { phase } = appState;
    if (phase.stage === "company") return COMPANY_QUESTIONS[phase.qIndex];
    if (phase.stage === "type-questions") {
      const { type, qIndex, sharedIndex, inShared } = phase;
      const typeQs = getVisibleQuestions(TYPE_QUESTIONS[type], currentTypeAnswers.current);
      const sharedQs = getVisibleQuestions(SHARED_QUESTIONS, currentTypeAnswers.current);
      return inShared ? sharedQs[sharedIndex] : typeQs[qIndex];
    }
    if (phase.stage === "notes") return { id: "notes", ask: "", type: "textarea", optional: true };
    return null;
  };

  const currentQ = getCurrentQuestion();
  const { phase } = appState;
  const isDone = phase.stage === "done";

  const canSend = (): boolean => {
    if (isDone) return false;
    if (phase.stage === "type-select") return pendingTypeSelect.length > 0;
    if (phase.stage === "more-types") return false;
    if (!currentQ) return false;
    if (currentQ.optional) return true;
    if (currentQ.type === "chips" || currentQ.type === "chips-single") return pendingChips.length > 0;
    if (currentQ.type === "toggle") return pendingToggle !== null;
    return inputText.trim().length > 0;
  };

  const currentTypeBadge = phase.stage === "type-questions" ? phase.type : undefined;

  return (
    <div className="h-screen flex flex-col bg-[oklch(0.98_0.003_264)] overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 bg-[oklch(0.22_0.08_264)] h-14 flex items-center px-4 sm:px-6 justify-between z-10">
        <div className="flex items-center gap-2.5">
          <svg width="26" height="26" viewBox="0 0 40 40" fill="none">
            <path d="M20 3L5 9V20C5 28.5 11.5 36.4 20 38C28.5 36.4 35 28.5 35 20V9L20 3Z" fill="oklch(0.68 0.19 41)" />
            <text x="20" y="26" textAnchor="middle" fill="white" fontSize="16" fontWeight="bold" fontFamily="Sora,sans-serif">C</text>
          </svg>
          <span className="text-white font-bold text-base tracking-tight">Credtent</span>
          <span className="text-white/30 text-sm mx-1 hidden sm:inline">|</span>
          <span className="text-white/60 text-sm hidden sm:inline">Content Valuation</span>
        </div>
        <div className="flex items-center gap-3">
          {appState.completedTypes.length > 0 && (
            <div className="flex items-center gap-1.5">
              {appState.completedTypes.map((t) => {
                const meta = CONTENT_TYPE_META[t];
                const Icon = meta.icon;
                const entry = appState.contentEntries.find((e) => e.type === t);
                const title = entry?.customLabel || meta.label;
                return (
                  <div key={t} className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center" title={title}>
                    <Icon className="w-3.5 h-3.5 text-white/70" />
                  </div>
                );
              })}
            </div>
          )}
          <button type="button" onClick={handleReset} className="flex items-center gap-1.5 text-white/50 hover:text-white/80 text-xs transition-colors">
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Start over</span>
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat */}
        <div className="flex flex-col flex-1 min-w-0 border-r border-gray-200">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-4">
            {chatHistory.map((msg, i) => (
              <div key={i}>
                {msg.badge && i > 0 && chatHistory[i - 1]?.badge !== msg.badge && (
                  <SectionBadge type={msg.badge} />
                )}
                {msg.role === "assistant"
                  ? <AssistantBubble text={msg.text} isNew={i === chatHistory.length - 1} />
                  : <UserBubble text={msg.text} />
                }
              </div>
            ))}
            {isTyping && (
              <div className="flex gap-3 items-start animate-in fade-in duration-200">
                <div className="w-8 h-8 rounded-full bg-[oklch(0.22_0.08_264)] flex items-center justify-center flex-shrink-0">
                  <CredtentLogo size={16} />
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                  <div className="flex gap-1 items-center h-4">
                    <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input Area */}
          {!isDone && (
            <div className="flex-shrink-0 border-t border-gray-100 bg-white px-4 sm:px-6 py-4">
              {/* Type selector */}
              {phase.stage === "type-select" && (
                <div className="mb-3">
                  <ContentTypeSelector
                    selected={pendingTypeSelect}
                    completed={appState.completedTypes}
                    onSelect={setPendingTypeSelect}
                  />
                </div>
              )}

              {/* More types buttons */}
              {phase.stage === "more-types" && (
                <div className="flex gap-3 mb-3">
                  <button type="button" onClick={() => handleMoreTypes(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-[oklch(0.22_0.08_264)] text-[oklch(0.22_0.08_264)] text-sm font-semibold hover:bg-[oklch(0.94_0.02_264)] transition-colors">
                    <Plus className="w-4 h-4" /> Add another content type
                  </button>
                  <button type="button" onClick={() => handleMoreTypes(false)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[oklch(0.68_0.19_41)] text-white text-sm font-semibold hover:bg-[oklch(0.62_0.19_41)] transition-colors">
                    <CheckCircle2 className="w-4 h-4" /> That's everything
                  </button>
                </div>
              )}

              {/* Chip input */}
              {phase.stage !== "type-select" && phase.stage !== "more-types" && currentQ && (currentQ.type === "chips" || currentQ.type === "chips-single") && (
                <div className="mb-3">
                  <ChipSelector
                    options={currentQ.options || []}
                    selected={pendingChips}
                    multi={currentQ.type === "chips"}
                    onSelect={setPendingChips}
                  />
                </div>
              )}

              {/* Toggle */}
              {phase.stage !== "type-select" && phase.stage !== "more-types" && currentQ?.type === "toggle" && (
                <div className="mb-3">
                  <Toggle value={pendingToggle ?? false} onChange={setPendingToggle} />
                </div>
              )}

              {/* Text / email */}
              {phase.stage !== "type-select" && phase.stage !== "more-types" && currentQ && (currentQ.type === "text" || currentQ.type === "email") && (
                <div className="mb-3">
                  <input
                    type={currentQ.type}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={currentQ.hint || "Type your answer…"}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[oklch(0.22_0.08_264)] focus:border-transparent transition"
                    autoFocus
                  />
                </div>
              )}

              {/* Textarea */}
              {phase.stage !== "type-select" && phase.stage !== "more-types" && currentQ?.type === "textarea" && (
                <div className="mb-3">
                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Any additional context, restrictions, or notes…"
                    rows={3}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[oklch(0.22_0.08_264)] focus:border-transparent transition resize-none"
                    autoFocus
                  />
                </div>
              )}

              {/* Send row */}
              {phase.stage !== "more-types" && (
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs text-gray-400 flex items-center gap-2">
                    {currentTypeBadge && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-white text-xs font-medium" style={{ background: CONTENT_TYPE_META[currentTypeBadge].color }}>
                        {CONTENT_TYPE_META[currentTypeBadge].label}
                      </span>
                    )}
                    {phase.stage === "type-select" && pendingTypeSelect.length === 0 && (
                      <span className="text-gray-300">Select at least one type</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {currentQ?.optional && phase.stage !== "type-select" && (
                      <button type="button" onClick={() => submitAnswer("", "Skipped")} className="text-xs text-gray-400 hover:text-gray-600 transition-colors px-3 py-1.5">
                        Skip
                      </button>
                    )}
                    <button type="button" onClick={handleSend} disabled={!canSend()}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[oklch(0.68_0.19_41)] hover:bg-[oklch(0.62_0.19_41)] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all duration-150 active:scale-95">
                      {phase.stage === "type-select" ? "Start" : (currentQ?.type === "chips" || currentQ?.type === "chips-single") ? "Confirm" : "Send"}
                      {phase.stage === "type-select" ? <ChevronRight className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {isDone && (
            <div className="flex-shrink-0 border-t border-gray-100 bg-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-sm font-semibold">Assessment complete — {appState.completedTypes.length} content type{appState.completedTypes.length !== 1 ? "s" : ""} profiled</span>
              </div>
              <button type="button" onClick={handleReset} className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2 transition-colors">
                New assessment
              </button>
            </div>
          )}
        </div>

        {/* Profile Panel */}
        <aside className="hidden md:flex flex-col w-80 lg:w-96 flex-shrink-0 bg-white overflow-hidden">
          <ProfilePanel state={appState} />
        </aside>
      </div>
    </div>
  );
}
