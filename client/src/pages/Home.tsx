/**
 * Credtent Universal Content Valuation — Multi-Type Conversational Chat
 * Design: Split-screen — left chat assistant, right live content profile
 * Flow: Company info → content type selection → per-type questions → loop for more types
 * Supports: Video, Written (Books/Articles/Blogs), Audio/Podcasts, Images/Photography,
 *           Social Media, Design/Illustration, Video Games/Interactive, Film/Cinema
 * Palette: Credtent navy + orange, Sora font
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import {
  CheckCircle2, Send, Film, FileText, Mic, Image, Share2,
  Palette, Gamepad2, Clapperboard, Building2, RotateCcw, Plus,
  ChevronRight, HelpCircle, Mail, ArrowRight, Sparkles,
  Star, TrendingUp, Award, BarChart3, Download, ChevronDown,
  Globe, Loader2,
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
    options: ["Fully owned by us", "Partially owned", "Licensed from others", "Mixed/unclear", "Not sure"],
  },
  {
    id: "hasThirdPartyIP",
    ask: "Does the content contain any embedded third-party IP — licensed music, logos, trademarks, or other copyrighted elements?",
    type: "toggle",
  },
  {
    id: "thirdPartyIPDetail",
    ask: "What types of third-party IP are embedded?",
    type: "chips",
    optional: true,
    options: ["Licensed music", "Trademarks/logos", "Stock footage", "Archival material", "News clips", "Not sure"],
    showIf: (a) => a.hasThirdPartyIP === true,
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
    optional: true,
    options: ["Anonymized/blurred", "Consent obtained", "Private data excluded", "Not yet addressed", "Not applicable"],
    showIf: (a) => a.hasPII === true,
  },
  {
    id: "exclusivity",
    ask: "How exclusive is this content — is similar content widely available elsewhere?",
    type: "chips-single",
    options: ["Fully proprietary", "Mostly proprietary", "Some similar exists", "Widely available", "Not sure"],
  },
  {
    id: "totalVolume",
    ask: "What's the approximate total volume of this content?",
    type: "text",
    hint: "e.g. '500 hours', '10,000 articles', '2 million images'",
  },
  {
    id: "historicalSignificance",
    ask: "Does this content have historical, cultural, or archival significance?",
    type: "chips-single",
    optional: true,
    options: ["Yes — significant historical record", "Yes — culturally important", "Somewhat", "No", "Not sure"],
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
    optional: true,
    options: ["Non-exclusive", "Exclusive", "Perpetual", "Term-limited", "Revenue share", "Flat fee", "Open to discussion", "Not applicable"],
    showIf: (a) => a.licensingIntent === "Yes, open to licensing" || a.licensingIntent === "Maybe, need more info",
  },
  {
    id: "previousAIUse",
    ask: "Has this content been used in any previous AI or machine learning projects?",
    type: "toggle",
  },
  // ── Success & accolades ──────────────────────────────────────────────────────
  {
    id: "hasAwards",
    ask: "Has this content received any awards, nominations, or official recognition?",
    type: "toggle",
  },
  {
    id: "awardsDetail",
    ask: "Tell us about those awards or nominations — even a rough list is helpful.",
    type: "textarea",
    optional: true,
    hint: "e.g. 'Emmy Award for Outstanding Variety Series, 1956 & 1957; Peabody Award 1971'",
    showIf: (a) => a.hasAwards === true,
  },
  {
    id: "hasCriticalRatings",
    ask: "Is this content listed or reviewed on any public platforms — like IMDb, Rotten Tomatoes, Goodreads, Amazon, or similar sites?",
    type: "toggle",
  },
  {
    id: "criticalRatingsDetail",
    ask: "Which platforms, and roughly what scores or ratings does it have?",
    type: "textarea",
    optional: true,
    hint: "e.g. 'IMDb 8.4/10 (12,000 ratings); Rotten Tomatoes 94% audience score' — approximate is fine",
    showIf: (a) => a.hasCriticalRatings === true,
  },
  {
    id: "hasSalesFigures",
    ask: "Are there any certified or publicly known sales, viewership, or circulation figures for this content?",
    type: "toggle",
  },
  {
    id: "salesFiguresDetail",
    ask: "Share whatever figures you have — box office, album certifications, book sales, average viewership, subscriber counts, anything like that.",
    type: "textarea",
    optional: true,
    hint: "e.g. '4× Platinum certified album', '12 million viewers per episode average', '500,000 copies sold'",
    showIf: (a) => a.hasSalesFigures === true,
  },
  // ── Subject matter & uniqueness ──────────────────────────────────────────────
  {
    id: "subjectMatters",
    ask: "What topics, themes, or subject areas does this content cover? Think broadly — what would someone search for to find it?",
    type: "textarea",
    optional: true,
    hint: "e.g. 'Rock and roll history, celebrity interviews, American pop culture 1948–1971, live musical performances'",
  },
  {
    id: "contentUniqueness",
    ask: "In your own words, what makes this content special or hard to find anywhere else?",
    type: "textarea",
    optional: true,
    hint: "e.g. 'One-of-a-kind live performances that were never commercially released', 'The only archive of its kind from this era'",
  },
  {
    id: "audienceReach",
    ask: "Who is the primary audience for this content, and how large is that audience?",
    type: "chips",
    optional: true,
    options: ["General public / mass market", "Niche enthusiasts", "Academic / researchers", "Industry professionals", "Children / families", "International audience", "Not sure"],
  },
];

// ── Video-specific questions ──────────────────────────────────────────────────

const VIDEO_QUESTIONS: Question[] = [
  {
    id: "videoCategory",
    ask: "How would you broadly categorize this video content?",
    type: "chips",
    options: ["Television series/episodes", "Streaming originals", "Live broadcast recordings", "Documentary", "Film/cinema", "Corporate/brand", "Educational/training", "News/journalism", "Sports", "User-generated", "Raw/unedited footage", "Other"],
  },
  {
    id: "tvShowDetails",
    ask: "Is this content from a specific show, series, or broadcast program? If so, please name it and describe the format.",
    type: "textarea",
    optional: true,
    hint: "e.g. 'The Ed Sullivan Show — weekly variety show, CBS, 1948–1971' or 'N/A'",
    showIf: (a) => Array.isArray(a.videoCategory) && (a.videoCategory as string[]).some((c) =>
      ["Television series/episodes", "Streaming originals", "Live broadcast recordings"].includes(c)
    ),
  },
  {
    id: "genres",
    ask: "What genres or subject matter does the video library cover? Select all that apply.",
    type: "chips",
    options: ["Variety/entertainment", "Drama", "Comedy", "Talk show/interview", "Reality/unscripted", "Music performance", "Sports", "News/current affairs", "Documentary", "Educational", "Children's", "Sci-fi/fantasy", "Action/thriller", "Nature/wildlife", "Lifestyle/travel", "Medical/health", "Industrial", "Other"],
  },
  {
    id: "broadcastEra",
    ask: "What era does the content span?",
    type: "chips",
    options: ["Pre-1960s", "1960s–1970s", "1970s–1980s", "1980s–1990s", "1990s–2000s", "2000s–2010s", "2010s–present", "Mixed eras", "Not applicable"],
  },
  {
    id: "clipDuration",
    ask: "What's the typical duration of individual clips or episodes?",
    type: "chips-single",
    options: ["Under 30s", "30s–2min", "2–10min", "10–30min", "30–60min", "60min+", "Mixed", "Not applicable"],
  },
  {
    id: "hasNotablePeople",
    ask: "Does the content feature notable, famous, or historically significant individuals?",
    type: "toggle",
  },
  {
    id: "notablePeopleNames",
    ask: "Please list the notable individuals featured — performers, hosts, athletes, public figures, or historical persons.",
    type: "textarea",
    optional: true,
    hint: "e.g. 'The Beatles, Elvis Presley, Bob Hope, Ella Fitzgerald' — include as many as you can",
    showIf: (a) => a.hasNotablePeople === true,
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
    optional: true,
    options: ["Establishing shots", "Cutaway footage", "Reaction shots", "Environmental/location", "Audience/crowd footage", "Backstage/behind-the-scenes", "Product close-ups", "Action sequences", "Nature/landscape", "Urban/architectural", "Not applicable"],
    showIf: (a) => a.hasBRoll === true,
  },
  {
    id: "resolution",
    ask: "What resolutions does the content include?",
    type: "chips",
    options: ["SD (480p or below)", "HD (720p)", "Full HD (1080p)", "2K", "4K", "6K+", "Mixed", "Not sure"],
  },
  {
    id: "formats",
    ask: "What video formats or codecs are used?",
    type: "chips",
    optional: true,
    options: ["MP4", "MOV", "AVI", "MXF", "ProRes", "RAW camera files", "Broadcast tape digitized", "Other", "Not sure"],
  },
  {
    id: "hasHumanSubjects",
    ask: "Does the content feature human subjects — people, faces, or activities?",
    type: "toggle",
  },
  {
    id: "demographicDiversity",
    ask: "What demographic diversity is represented in the human subjects?",
    type: "chips",
    optional: true,
    options: ["Age diversity", "Gender diversity", "Ethnic/racial diversity", "Geographic diversity", "Occupational diversity", "Not applicable", "Not sure"],
    showIf: (a) => a.hasHumanSubjects === true,
  },
  {
    id: "metadataLevel",
    ask: "What level of metadata or annotation currently exists for the videos?",
    type: "chips-single",
    options: ["None", "Basic tags/titles only", "Transcripts/captions", "Scene/shot-level labels", "Object/face detection labels", "Full semantic annotation", "Not sure"],
  },
  {
    id: "technicalIssues",
    ask: "Are there any known technical issues in the footage?",
    type: "chips",
    optional: true,
    options: ["Motion blur", "Poor lighting", "Camera shake", "Watermarks/burn-ins", "Compression artifacts", "Film grain/damage", "Tape degradation", "None known", "Not sure"],
  },
  {
    id: "broadcastRightsOrigin",
    ask: "Was this content originally broadcast under a network or distributor license — e.g. a major TV network, cable channel, or streaming platform?",
    type: "toggle",
  },
  {
    id: "broadcastRightsDetail",
    ask: "Which network or distributor originally held the broadcast rights, and have those rights since reverted to you?",
    type: "chips",
    optional: true,
    hint: "e.g. 'CBS — rights reverted in 1990' or 'NBC — rights status unclear'",
    options: ["Rights fully reverted to us", "Rights partially reverted", "Rights still held by network/distributor", "Rights status unclear", "Never licensed to a network", "Not sure"],
    showIf: (a) => a.broadcastRightsOrigin === true,
  },
  {
    id: "digitizationStatus",
    ask: "What is the current digitization status of the content?",
    type: "chips-single",
    options: ["Fully digitized", "Mostly digitized", "Partially digitized", "Not yet digitized (physical media only)", "Mixed — some digital, some physical", "Not sure"],
  },
  {
    id: "physicalMediaTypes",
    ask: "What physical media formats does the undigitized content exist on?",
    type: "chips",
    optional: true,
    options: ["16mm film", "35mm film", "2-inch videotape", "1-inch videotape", "Betacam/Betamax", "VHS", "U-matic", "LaserDisc", "Other tape format", "Not applicable"],
    showIf: (a) => {
      const s = a.digitizationStatus as string;
      return s === "Not yet digitized (physical media only)" || s === "Partially digitized" || s === "Mixed — some digital, some physical";
    },
  },
  {
    id: "digitizationQuality",
    ask: "For content that has been digitized, what is the typical output quality?",
    type: "chips-single",
    optional: true,
    options: ["SD (480p or below)", "HD (720p)", "Full HD (1080p)", "2K scan", "4K scan", "Mixed quality", "Not sure", "Not applicable"],
    showIf: (a) => {
      const s = a.digitizationStatus as string;
      return s !== "Not yet digitized (physical media only)";
    },
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
    options: ["Drama", "Comedy", "Action/thriller", "Horror", "Sci-fi/fantasy", "Documentary", "Animation", "Experimental", "Mixed", "Not applicable"],
  },
  {
    id: "filmEra",
    ask: "What era does the film content span?",
    type: "chips",
    options: ["Pre-1960s", "1960s–1980s", "1980s–2000s", "2000s–2015", "2015–present", "Mixed eras"],
  },
  {
    id: "filmNotablePeople",
    ask: "Does the content feature notable directors, actors, or historically significant individuals?",
    type: "toggle",
  },
  {
    id: "filmNotablePeopleNames",
    ask: "Please list the notable individuals featured — directors, actors, producers, or other public figures.",
    type: "textarea",
    optional: true,
    hint: "e.g. 'Orson Welles, Katharine Hepburn, Stanley Kubrick'",
    showIf: (a) => a.filmNotablePeople === true,
  },
  {
    id: "filmSubtitles",
    ask: "Are subtitles or closed captions available?",
    type: "chips-single",
    options: ["Full subtitles (multiple languages)", "English only", "Partial", "None", "Not sure"],
  },
  {
    id: "filmRights",
    ask: "What is the rights status of the film content?",
    type: "chips-single",
    options: ["Fully owned/produced in-house", "Acquired with full rights", "Acquired with limited rights", "Mixed/unclear", "Not sure"],
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
  {
    id: "websiteUrl",
    ask: "Does your organization have a website? If so, what's the URL?",
    type: "text",
    optional: true,
    hint: "e.g. https://www.yourcompany.com — or leave blank if not applicable",
  },
  {
    id: "websiteIsMainContent",
    ask: "Is that website the main home for your content — meaning most of what you create lives there or is linked from there?",
    type: "chips-single",
    optional: true,
    options: ["Yes, most of our content is there", "Partially — some content is there", "No, our content lives elsewhere", "Not applicable"],
    showIf: (a) => !!a.websiteUrl && String(a.websiteUrl).trim().length > 3,
  },
];

// ─── State Types ──────────────────────────────────────────────────────────────

type Phase =
  | { stage: "company"; qIndex: number }
  | { stage: "website-scan" }  // scanning URL before type-select
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

interface ContentInventoryResult {
  url: string;
  siteName: string;
  description: string;
  counts: Partial<Record<ContentCategory, number>>;
  signals: string[];
  suggestedTypes: ContentCategory[];
  summary: string;
  crawledPages: number;
  error?: string;
}

type ContentCategory = "written" | "audio" | "video" | "images" | "social" | "design" | "games" | "film" | "other";

interface RatingsSource {
  platform: string;
  score: string;
  voteCount?: string;
  url?: string;
}

interface AccoladesResult {
  title: string;
  kind: string;
  externalRatings: RatingsSource[];
  boxOffice?: string;
  certifications?: string[];
  editionCount?: number;
  valuationNote: string;
  error?: string;
}

interface AppState {
  companyAnswers: TypeAnswers;
  contentEntries: ContentEntry[];
  completedTypes: ContentType[];
  phase: Phase;
  notes: string;
  websiteInventory?: ContentInventoryResult;
  accoladesResults: Record<string, AccoladesResult>; // keyed by contentType
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

// ─── Download Form Dropdown ─────────────────────────────────────────────────

const DOWNLOAD_OPTIONS: { type: string; label: string; icon: React.ElementType }[] = [
  { type: "video",   label: "Video Content",          icon: Film },
  { type: "written", label: "Written Works",           icon: FileText },
  { type: "audio",   label: "Audio & Podcasts",        icon: Mic },
  { type: "images",  label: "Images & Photography",   icon: Image },
  { type: "social",  label: "Social Media Content",   icon: Share2 },
  { type: "design",  label: "Design & Illustration",  icon: Palette },
  { type: "games",   label: "Games & Interactive",    icon: Gamepad2 },
  { type: "film",    label: "Film & Cinema",           icon: Clapperboard },
  { type: "other",   label: "Other / Custom",          icon: HelpCircle },
];

function DownloadFormDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleDownload = (type: string) => {
    setOpen(false);
    const a = document.createElement("a");
    a.href = `/api/forms/download/${type}`;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-white/70 hover:text-white text-xs font-medium transition-colors px-2 py-1.5 rounded-lg hover:bg-white/10"
      >
        <Download className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Download Form</span>
        <ChevronDown className={`w-3 h-3 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-56 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-3 py-2 border-b border-gray-50">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Download PDF Form</p>
          </div>
          {DOWNLOAD_OPTIONS.map(({ type, label, icon: Icon }) => (
            <button
              key={type}
              type="button"
              onClick={() => handleDownload(type)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm text-gray-700 hover:bg-[oklch(0.96_0.02_264)] hover:text-[oklch(0.22_0.08_264)] transition-colors"
            >
              <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Website Inventory Card ──────────────────────────────────────────────────

const CATEGORY_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  written: { label: "Written Articles", icon: FileText, color: "oklch(0.55 0.18 145)" },
  audio:   { label: "Audio / Podcasts", icon: Mic,      color: "oklch(0.60 0.18 30)" },
  video:   { label: "Video",            icon: Film,     color: "oklch(0.55 0.15 264)" },
  images:  { label: "Images",           icon: Image,    color: "oklch(0.55 0.16 200)" },
  social:  { label: "Social Content",   icon: Share2,   color: "oklch(0.60 0.18 310)" },
  design:  { label: "Design Assets",    icon: Palette,  color: "oklch(0.58 0.18 60)" },
  games:   { label: "Games / Interactive", icon: Gamepad2, color: "oklch(0.52 0.18 280)" },
  film:    { label: "Film / Cinema",    icon: Clapperboard, color: "oklch(0.45 0.12 264)" },
  other:   { label: "Other Content",    icon: HelpCircle, color: "oklch(0.52 0.08 264)" },
};

function WebsiteInventoryCard({ inventory }: { inventory: ContentInventoryResult }) {
  const entries = Object.entries(inventory.counts).filter(([, v]) => v && v > 0);
  return (
    <div className="flex gap-3 items-start animate-in fade-in slide-in-from-bottom-2 duration-400">
      <div className="w-8 h-8 rounded-full bg-[oklch(0.22_0.08_264)] flex items-center justify-center flex-shrink-0 mt-0.5">
        <CredtentLogo size={16} />
      </div>
      <div className="bg-white border border-[oklch(0.68_0.19_41)]/25 rounded-2xl rounded-tl-sm shadow-sm overflow-hidden max-w-sm w-full">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 bg-[oklch(0.68_0.19_41)]/8 border-b border-[oklch(0.68_0.19_41)]/15">
          <Globe className="w-4 h-4 text-[oklch(0.68_0.19_41)] flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-[oklch(0.22_0.08_264)] truncate">{inventory.siteName}</p>
            {inventory.description && (
              <p className="text-xs text-gray-400 truncate">{inventory.description}</p>
            )}
          </div>
        </div>
        {/* Content counts */}
        {entries.length > 0 && (
          <div className="px-4 py-3">
            <div className="flex items-center gap-1.5 mb-2">
              <BarChart3 className="w-3.5 h-3.5 text-gray-400" />
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Content detected</p>
            </div>
            <div className="space-y-1.5">
              {entries.map(([cat, count]) => {
                const meta = CATEGORY_META[cat] ?? CATEGORY_META.other;
                const Icon = meta.icon;
                return (
                  <div key={cat} className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: meta.color + "22" }}>
                      <Icon className="w-3.5 h-3.5" style={{ color: meta.color }} />
                    </div>
                    <span className="text-xs text-gray-700 font-medium flex-1">{meta.label}</span>
                    <span className="text-xs font-bold tabular-nums" style={{ color: meta.color }}>
                      {(count as number).toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {/* Footer */}
        <div className="px-4 py-2 bg-gray-50/50 border-t border-gray-100">
          <p className="text-xs text-gray-400">{inventory.crawledPages} page{inventory.crawledPages !== 1 ? "s" : ""} scanned</p>
        </div>
      </div>
    </div>
  );
}

// ─── Accolades Card ─────────────────────────────────────────────────────────

function AccoladesCard({ contentType, result }: { contentType: ContentType; result: AccoladesResult }) {
  const meta = CONTENT_TYPE_META[contentType];
  const Icon = meta.icon;
  const hasRatings = result.externalRatings && result.externalRatings.length > 0;

  return (
    <div className="flex gap-3 items-start animate-in fade-in slide-in-from-bottom-2 duration-400">
      <div className="w-8 h-8 rounded-full bg-[oklch(0.22_0.08_264)] flex items-center justify-center flex-shrink-0 mt-0.5">
        <CredtentLogo size={16} />
      </div>
      <div className="bg-white border border-[oklch(0.68_0.19_41)]/25 rounded-2xl rounded-tl-sm shadow-sm overflow-hidden max-w-sm w-full">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 bg-[oklch(0.68_0.19_41)]/8 border-b border-[oklch(0.68_0.19_41)]/15">
          <Icon className="w-4 h-4 text-[oklch(0.68_0.19_41)] flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-[oklch(0.22_0.08_264)] truncate">{result.title}</p>
            <p className="text-xs text-gray-400">{meta.label} — Critical &amp; Commercial Standing</p>
          </div>
        </div>

        {/* External ratings */}
        {hasRatings && (
          <div className="px-4 py-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Star className="w-3.5 h-3.5 text-[oklch(0.68_0.19_41)]" />
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">External Ratings</p>
            </div>
            <div className="space-y-1.5">
              {result.externalRatings.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-28 flex-shrink-0">{r.platform}</span>
                  <span className="text-xs font-bold text-[oklch(0.22_0.08_264)]">{r.score}</span>
                  {r.voteCount && <span className="text-xs text-gray-400">({r.voteCount})</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Box office / sales */}
        {result.boxOffice && (
          <div className="px-4 pb-3">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-gray-400" />
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Box Office / Sales</p>
            </div>
            <p className="text-xs font-bold text-[oklch(0.22_0.08_264)]">{result.boxOffice}</p>
          </div>
        )}

        {/* Certifications / awards */}
        {result.certifications && result.certifications.length > 0 && (
          <div className="px-4 pb-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Award className="w-3.5 h-3.5 text-[oklch(0.68_0.19_41)]" />
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Awards &amp; Certifications</p>
            </div>
            <div className="flex flex-wrap gap-1">
              {result.certifications.map((cert, i) => (
                <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[oklch(0.68_0.19_41)]/10 text-[oklch(0.45_0.15_41)]">
                  {cert}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Valuation note */}
        {result.valuationNote && (
          <div className="px-4 pb-3 border-t border-gray-100 pt-3">
            <p className="text-xs text-gray-600 leading-relaxed">{result.valuationNote}</p>
          </div>
        )}

        {result.error && (
          <div className="px-4 pb-3">
            <p className="text-xs text-gray-400 italic">{result.error}</p>
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
    accoladesResults: {},
  });

  const [chatHistory, setChatHistory] = useState<{ role: "assistant" | "user"; text: string; badge?: ContentType }[]>([]);
  const [inputText, setInputText] = useState("");
  const [pendingChips, setPendingChips] = useState<string[]>([]);
  const [pendingToggle, setPendingToggle] = useState<boolean | null>(null);
  const [pendingTypeSelect, setPendingTypeSelect] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [summaryEmail, setSummaryEmail] = useState("");
  const [summarySubmitted, setSummarySubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitMutation = trpc.assessments.submit.useMutation();
  const analyzeWebsiteMutation = trpc.website.analyze.useMutation();
  const accloladesLookupMutation = trpc.accolades.lookup.useMutation();
  const [pendingAccoladesType, setPendingAccoladesType] = useState<ContentType | null>(null);
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

  const startWebsiteScan = useCallback(async (state: AppState) => {
    const url = String(state.companyAnswers.websiteUrl ?? "").trim();
    const isMainContent = String(state.companyAnswers.websiteIsMainContent ?? "");
    const shouldScan = url.length > 3 && (
      isMainContent.includes("Yes") || isMainContent.includes("Partially")
    );

    if (!shouldScan) {
      // Skip scan, go straight to type selection
      setAppState((s) => ({ ...s, phase: { stage: "type-select" } }));
      pushAssistant("Thanks! Now, what types of content does your organization have? Select all that apply — we'll go through each one in turn.");
      setPendingTypeSelect([]);
      return;
    }

    // Enter scanning phase
    setAppState((s) => ({ ...s, phase: { stage: "website-scan" } }));
    pushAssistant(`Great — let me take a quick look at ${url} to get a sense of what content you have there. This usually takes about 15–20 seconds…`);

    try {
      const result = await analyzeWebsiteMutation.mutateAsync({ url });
      setAppState((s) => ({ ...s, websiteInventory: result as ContentInventoryResult, phase: { stage: "type-select" } }));

      if (result.error) {
        pushAssistant(`I wasn't able to fully scan that site, but no worries — you can still enter your content details manually. What types of content does your organization have?`);
      } else {
        // Build a friendly summary message
        const countParts: string[] = [];
        const c = result.counts as Partial<Record<string, number>>;
        if (c.written && c.written > 0) countParts.push(`${c.written.toLocaleString()} written articles or posts`);
        if (c.audio && c.audio > 0) countParts.push(`${c.audio.toLocaleString()} audio/podcast episodes`);
        if (c.video && c.video > 0) countParts.push(`${c.video.toLocaleString()} videos`);
        if (c.images && c.images > 0) countParts.push(`${c.images.toLocaleString()} images`);

        const summaryMsg = result.summary ||
          (countParts.length > 0
            ? `I found ${countParts.join(", ")} on your site.`
            : `I scanned your site and found some content. Let's go through the details below.`);

        pushAssistant(summaryMsg);
        setTimeout(() => {
          pushAssistant("Based on what I found, I've pre-selected the content types below — but feel free to adjust. Select all that apply and we'll go through each one.");
          setPendingTypeSelect(
            (result.suggestedTypes as string[]).filter((t) => ALL_CONTENT_TYPES.includes(t as ContentType)) as ContentType[]
          );
        }, 800);
        return;
      }
    } catch {
      setAppState((s) => ({ ...s, phase: { stage: "type-select" } }));
      pushAssistant(`I had trouble scanning that site, but that's okay — let's continue manually. What types of content does your organization have?`);
    }
    setPendingTypeSelect([]);
  }, [analyzeWebsiteMutation, pushAssistant]);

  const advancePhase = useCallback((state: AppState, userDisplay: string) => {
    const { phase } = state;

    if (phase.stage === "company") {
      const nextIdx = phase.qIndex + 1;
      // Find the next visible question (respecting showIf)
      let nextVisibleIdx = nextIdx;
      while (
        nextVisibleIdx < COMPANY_QUESTIONS.length &&
        COMPANY_QUESTIONS[nextVisibleIdx].showIf &&
        !COMPANY_QUESTIONS[nextVisibleIdx].showIf!(state.companyAnswers)
      ) {
        nextVisibleIdx++;
      }
      if (nextVisibleIdx < COMPANY_QUESTIONS.length) {
        setAppState((s) => ({ ...s, phase: { stage: "company", qIndex: nextVisibleIdx } }));
        pushAssistant(COMPANY_QUESTIONS[nextVisibleIdx].ask);
      } else {
        // All company questions done — trigger website scan if applicable
        startWebsiteScan(state);
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
    }
  }, [pushAssistant]);

  const finishType = useCallback((state: AppState, type: ContentType) => {
    const meta = CONTENT_TYPE_META[type];
    const customLabel = type === "other" && currentTypeAnswers.current.otherContentDescription
      ? String(currentTypeAnswers.current.otherContentDescription)
      : undefined;
    const answers = { ...currentTypeAnswers.current };
    const newEntry: ContentEntry = { type, answers, customLabel };
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

    // Trigger external ratings lookup if user indicated they have critical ratings
    const hasCriticalRatings = answers.hasCriticalRatings === true;
    const ratingsDetail = String(answers.criticalRatingsDetail ?? "").trim();
    const titleSource =
      String(answers.tvShowDetails ?? answers.writtenWordCount ?? "").trim() ||
      String(state.companyAnswers.companyName ?? "").trim();
    // Extract a title from the ratings detail or company name
    const titleMatch = ratingsDetail.match(/^([^,;(\n]+)/) || null;
    const lookupTitle = titleMatch ? titleMatch[1].trim() : titleSource;

    if (hasCriticalRatings && lookupTitle) {
      const kind: "film" | "video" | "written" | "audio" | "other" =
        type === "film" ? "film" :
        type === "video" ? "video" :
        type === "written" ? "written" :
        type === "audio" ? "audio" : "other";

      setPendingAccoladesType(type);
      accloladesLookupMutation.mutateAsync({
        title: lookupTitle,
        kind,
        userAccolades: [
          ratingsDetail,
          String(answers.awardsDetail ?? ""),
          String(answers.salesFiguresDetail ?? ""),
        ].filter(Boolean).join(" | "),
      }).then((result) => {
        setAppState((s) => ({
          ...s,
          accoladesResults: { ...s.accoladesResults, [type]: result },
        }));
        setPendingAccoladesType(null);
      }).catch(() => {
        setPendingAccoladesType(null);
      });
    }
  }, [pushAssistant, accloladesLookupMutation]);

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
    setAppState({ companyAnswers: {}, contentEntries: [], completedTypes: [], phase: { stage: "company", qIndex: 0 }, notes: "", websiteInventory: undefined, accoladesResults: {} });
    setChatHistory([]);
    setInputText(""); setPendingChips([]); setPendingToggle(null); setPendingTypeSelect([]);
    setSummaryEmail(""); setSummarySubmitted(false);
    currentTypeAnswers.current = {};
    setTimeout(() => {
      setChatHistory([{ role: "assistant", text: "Hi! I'm the Credtent content assessment assistant. I'll help you build a complete content profile across all of your content types — so we can assess the full value of your library for AI training licensing." }]);
      setTimeout(() => setChatHistory((p) => [...p, { role: "assistant", text: COMPANY_QUESTIONS[0].ask }]), 700);
    }, 300);
  };

  // ── Summary submit handler ─────────────────────────────────────────────────

  const handleSummarySubmit = useCallback(async () => {
    if (!summaryEmail.includes("@") || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await submitMutation.mutateAsync({
        companyAnswers: appState.companyAnswers as Record<string, unknown>,
        contentEntries: appState.contentEntries.map((e) => ({
          type: e.type,
          answers: e.answers as Record<string, unknown>,
          customLabel: e.customLabel,
        })),
        completedTypes: appState.completedTypes,
        notes: appState.notes || undefined,
        submissionEmail: summaryEmail,
      });
      setSummarySubmitted(true);
    } catch (err) {
      console.error("Failed to submit assessment", err);
      // Still mark as submitted locally so the user isn't blocked
      setSummarySubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  }, [summaryEmail, isSubmitting, submitMutation, appState]);

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

  // N/A is treated as a valid selection — always allows send
  const hasNASelected = pendingChips.includes("Not applicable") || pendingChips.includes("Not sure");

  const canSend = (): boolean => {
    if (isDone) return false;
    if (phase.stage === "website-scan") return false; // scanning in progress
    if (phase.stage === "type-select") return pendingTypeSelect.length > 0;
    if (phase.stage === "more-types") return false;
    if (!currentQ) return false;
    if (currentQ.optional) return true;
    if (currentQ.type === "chips" || currentQ.type === "chips-single") return pendingChips.length > 0 || hasNASelected;
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
          <DownloadFormDropdown />
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
            {/* Website scanning animation */}
            {phase.stage === "website-scan" && !isTyping && (
              <div className="flex gap-3 items-start animate-in fade-in duration-300">
                <div className="w-8 h-8 rounded-full bg-[oklch(0.22_0.08_264)] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CredtentLogo size={16} />
                </div>
                <div className="bg-white border border-[oklch(0.68_0.19_41)]/30 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm max-w-xs">
                  <div className="flex items-center gap-2.5 mb-2">
                    <Loader2 className="w-4 h-4 text-[oklch(0.68_0.19_41)] animate-spin flex-shrink-0" />
                    <p className="text-sm font-semibold text-[oklch(0.22_0.08_264)]">Scanning your website…</p>
                  </div>
                  <div className="space-y-1.5">
                    {["Fetching homepage", "Crawling content pages", "Checking sitemap & RSS feeds", "Classifying content types"].map((step, i) => (
                      <div key={step} className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[oklch(0.68_0.19_41)] animate-pulse flex-shrink-0" style={{ animationDelay: `${i * 300}ms` }} />
                        <span className="text-xs text-gray-500">{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {/* Website inventory card — shown once scan completes */}
            {appState.websiteInventory && phase.stage === "type-select" && !appState.websiteInventory.error && (
              <WebsiteInventoryCard inventory={appState.websiteInventory} />
            )}
            {/* Accolades lookup in progress */}
            {pendingAccoladesType && (
              <div className="flex gap-3 items-start animate-in fade-in duration-300">
                <div className="w-8 h-8 rounded-full bg-[oklch(0.22_0.08_264)] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CredtentLogo size={16} />
                </div>
                <div className="bg-white border border-[oklch(0.68_0.19_41)]/30 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm max-w-xs">
                  <div className="flex items-center gap-2.5">
                    <Loader2 className="w-4 h-4 text-[oklch(0.68_0.19_41)] animate-spin flex-shrink-0" />
                    <p className="text-sm font-semibold text-[oklch(0.22_0.08_264)]">Looking up ratings &amp; accolades…</p>
                  </div>
                  <p className="text-xs text-gray-400 mt-1 ml-6">Checking IMDb, Rotten Tomatoes, Open Library…</p>
                </div>
              </div>
            )}
            {/* Accolades results cards */}
            {Object.entries(appState.accoladesResults).map(([typeKey, result]) => (
              <AccoladesCard key={typeKey} contentType={typeKey as ContentType} result={result} />
            ))}
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

      {/* Summary overlay — slides up when done */}
      {isDone && (
        <div className="absolute inset-0 z-20 bg-[oklch(0.98_0.003_264)] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Summary header */}
          <header className="flex-shrink-0 bg-[oklch(0.22_0.08_264)] h-14 flex items-center px-4 sm:px-6 justify-between">
            <div className="flex items-center gap-2.5">
              <svg width="26" height="26" viewBox="0 0 40 40" fill="none">
                <path d="M20 3L5 9V20C5 28.5 11.5 36.4 20 38C28.5 36.4 35 28.5 35 20V9L20 3Z" fill="oklch(0.68 0.19 41)" />
                <text x="20" y="26" textAnchor="middle" fill="white" fontSize="16" fontWeight="bold" fontFamily="Sora,sans-serif">C</text>
              </svg>
              <span className="text-white font-bold text-base tracking-tight">Credtent</span>
              <span className="text-white/30 text-sm mx-1 hidden sm:inline">|</span>
              <span className="text-white/60 text-sm hidden sm:inline">Content Valuation</span>
            </div>
            <button type="button" onClick={handleReset} className="flex items-center gap-1.5 text-white/50 hover:text-white/80 text-xs transition-colors">
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New assessment</span>
            </button>
          </header>

          <div className="flex-1 overflow-y-auto">
            <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-8">

              {/* Hero confirmation */}
              <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-green-50 border-2 border-green-200 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-7 h-7 text-green-500" />
                </div>
                <h1 className="text-2xl font-bold text-[oklch(0.22_0.08_264)] mb-2">Your Content Profile is Complete</h1>
                <p className="text-sm text-gray-500 max-w-md mx-auto">
                  Here's a summary of what you've shared. Credtent will use this to prepare a valuation estimate for your content library.
                </p>
              </div>

              {/* Website inventory card on summary */}
              {appState.websiteInventory && !appState.websiteInventory.error && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-50 bg-gray-50/50">
                    <Globe className="w-4 h-4 text-[oklch(0.68_0.19_41)]" />
                    <span className="text-xs font-bold text-[oklch(0.22_0.08_264)] uppercase tracking-wider">Website Content Scan</span>
                    <span className="ml-auto text-xs text-gray-400">{appState.websiteInventory.crawledPages} pages scanned</span>
                  </div>
                  <div className="px-5 py-4">
                    <p className="text-xs font-semibold text-gray-700 mb-3">{appState.websiteInventory.siteName}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {Object.entries(appState.websiteInventory.counts)
                        .filter(([, v]) => v && (v as number) > 0)
                        .map(([cat, count]) => {
                          const meta = CATEGORY_META[cat] ?? CATEGORY_META.other;
                          const Icon = meta.icon;
                          return (
                            <div key={cat} className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: meta.color + "22" }}>
                                <Icon className="w-3.5 h-3.5" style={{ color: meta.color }} />
                              </div>
                              <div>
                                <p className="text-xs text-gray-400">{meta.label}</p>
                                <p className="text-sm font-bold tabular-nums" style={{ color: meta.color }}>{(count as number).toLocaleString()}</p>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>
              )}

              {/* Organization card */}
              {Object.keys(appState.companyAnswers).length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-50 bg-gray-50/50">
                    <Building2 className="w-4 h-4 text-[oklch(0.68_0.19_41)]" />
                    <span className="text-xs font-bold text-[oklch(0.22_0.08_264)] uppercase tracking-wider">Organization</span>
                  </div>
                  <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {Object.entries(appState.companyAnswers).map(([k, v]) => {
                      const f = formatVal(v); if (!f) return null;
                      const labels: Record<string, string> = { companyName: "Company", contactName: "Contact", contactEmail: "Email" };
                      return (
                        <div key={k}>
                          <p className="text-xs text-gray-400 mb-0.5">{labels[k] || k}</p>
                          <p className="text-sm font-semibold text-gray-800">{f}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Accolades & ratings section */}
              {Object.keys(appState.accoladesResults).length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-50 bg-[oklch(0.68_0.19_41)]/5">
                    <Award className="w-4 h-4 text-[oklch(0.68_0.19_41)]" />
                    <span className="text-xs font-bold text-[oklch(0.22_0.08_264)] uppercase tracking-wider">Critical &amp; Commercial Standing</span>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {Object.entries(appState.accoladesResults).map(([typeKey, result]) => {
                      const meta = CONTENT_TYPE_META[typeKey as ContentType];
                      const Icon = meta?.icon ?? Award;
                      return (
                        <div key={typeKey} className="px-5 py-4">
                          <div className="flex items-center gap-2 mb-3">
                            <Icon className="w-3.5 h-3.5" style={{ color: meta?.color }} />
                            <span className="text-xs font-bold text-gray-700">{result.title}</span>
                            <span className="text-xs text-gray-400 ml-1">— {meta?.label}</span>
                          </div>
                          {result.externalRatings && result.externalRatings.length > 0 && (
                            <div className="flex flex-wrap gap-3 mb-2">
                              {result.externalRatings.map((r, i) => (
                                <div key={i} className="flex items-center gap-1.5">
                                  <Star className="w-3 h-3 text-[oklch(0.68_0.19_41)]" />
                                  <span className="text-xs text-gray-500">{r.platform}:</span>
                                  <span className="text-xs font-bold text-[oklch(0.22_0.08_264)]">{r.score}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {result.boxOffice && (
                            <div className="flex items-center gap-1.5 mb-2">
                              <TrendingUp className="w-3 h-3 text-gray-400" />
                              <span className="text-xs text-gray-500">Box Office / Sales:</span>
                              <span className="text-xs font-bold text-[oklch(0.22_0.08_264)]">{result.boxOffice}</span>
                            </div>
                          )}
                          {result.certifications && result.certifications.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-2">
                              {result.certifications.map((cert, i) => (
                                <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[oklch(0.68_0.19_41)]/10 text-[oklch(0.45_0.15_41)]">
                                  {cert}
                                </span>
                              ))}
                            </div>
                          )}
                          {result.valuationNote && (
                            <p className="text-xs text-gray-500 italic leading-relaxed">{result.valuationNote}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Content type cards */}
              {appState.contentEntries.map((entry, i) => {
                const meta = CONTENT_TYPE_META[entry.type];
                const Icon = meta.icon;
                const displayLabel = entry.customLabel || meta.label;
                const items = Object.entries(entry.answers).filter(([k, v]) => {
                  if (k === "otherContentDescription") return false;
                  const f = formatVal(v); return f && f !== "false" && f !== "No";
                });
                return (
                  <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-2.5 px-5 py-3 border-b border-gray-50" style={{ background: meta.color + "0d" }}>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: meta.color + "22" }}>
                        <Icon className="w-4 h-4" style={{ color: meta.color }} />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-wider" style={{ color: meta.color }}>{displayLabel}</span>
                    </div>
                    <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                      {items.map(([k, v]) => {
                        const f = formatVal(v);
                        return (
                          <div key={k} className="flex gap-2 items-start">
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-gray-700 leading-snug">{f}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Notes */}
              {appState.notes && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Additional Notes</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{appState.notes}</p>
                </div>
              )}

              {/* Email capture */}
              <div className="bg-[oklch(0.22_0.08_264)] rounded-2xl px-6 py-6">
                {!summarySubmitted ? (
                  <>
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="w-4 h-4 text-[oklch(0.68_0.19_41)]" />
                      <h2 className="text-sm font-bold text-white">Get your valuation estimate</h2>
                    </div>
                    <p className="text-xs text-white/60 mb-4">
                      Enter your email and Credtent will follow up with a personalised content valuation based on your profile.
                    </p>
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                        <input
                          type="email"
                          value={summaryEmail}
                          onChange={(e) => setSummaryEmail(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter" && summaryEmail.includes("@") && !isSubmitting) handleSummarySubmit(); }}
                          placeholder="your@email.com"
                          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[oklch(0.68_0.19_41)] focus:border-transparent transition"
                        />
                      </div>
                      <button
                        type="button"
                        disabled={!summaryEmail.includes("@") || isSubmitting}
                        onClick={handleSummarySubmit}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[oklch(0.68_0.19_41)] hover:bg-[oklch(0.62_0.19_41)] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all active:scale-95 flex-shrink-0">
                        {isSubmitting ? "Saving…" : "Submit"} <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-3 py-1">
                    <div className="w-9 h-9 rounded-full bg-green-400/20 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="w-5 h-5 text-green-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">You're all set!</p>
                      <p className="text-xs text-white/60">We'll send your valuation estimate to <span className="text-white/80 font-medium">{summaryEmail}</span></p>
                    </div>
                  </div>
                )}
              </div>

              <div className="pb-8" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
