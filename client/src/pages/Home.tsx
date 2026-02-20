/**
 * Credtent Video Content Valuation — Conversational Chat + Live Form
 * Design: Split-screen — left chat assistant, right live form summary
 * The assistant asks questions one at a time; answers populate the form panel.
 * Palette: Credtent navy (#1B2057-ish) + orange, Sora font
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  CheckCircle2, ChevronRight, Send, Film, Settings2, Tag,
  BarChart3, Shield, Sparkles, Layers, BookOpen, Building2,
  RotateCcw,
} from "lucide-react";

// ─── Question Flow Definition ─────────────────────────────────────────────────

type AnswerType = "chips" | "chips-single" | "toggle" | "text" | "email" | "textarea";

interface Question {
  id: string;
  section: string;
  sectionIcon: React.ElementType;
  ask: string;
  hint?: string;
  type: AnswerType;
  options?: string[];
  optional?: boolean;
  showIf?: (answers: Answers) => boolean;
}

type Answers = Record<string, string | string[] | boolean>;

const QUESTIONS: Question[] = [
  // Company Info first — sets context
  {
    id: "companyName", section: "Company", sectionIcon: Building2,
    ask: "Let's start with your company. What's the name of the organization whose video content we're evaluating?",
    type: "text",
  },
  {
    id: "contactName", section: "Company", sectionIcon: Building2,
    ask: "Great. And who should Credtent follow up with? What's your name?",
    type: "text",
  },
  {
    id: "contactEmail", section: "Company", sectionIcon: Building2,
    ask: "What's the best email address for follow-up?",
    type: "email",
  },

  // Content Characteristics
  {
    id: "genres", section: "Content", sectionIcon: Film,
    ask: "What's the primary genre or subject matter of your video library? Select all that apply.",
    type: "chips",
    options: ["Sports", "Educational", "Documentary", "Corporate", "Entertainment", "News/Journalism", "Medical/Health", "Industrial", "Surveillance/Security", "User-Generated", "Nature/Wildlife", "Travel", "Lifestyle", "Other"],
  },
  {
    id: "clipDuration", section: "Content", sectionIcon: Film,
    ask: "What's the typical duration of individual clips or segments?",
    type: "chips-single",
    options: ["Under 30s", "30s–2min", "2–10min", "10–30min", "30min+", "Mixed"],
  },
  {
    id: "contentType", section: "Content", sectionIcon: Film,
    ask: "How would you describe the shot style of the content?",
    type: "chips",
    options: ["Static shots", "Dynamic movement", "Aerial/drone", "POV/first-person", "Time-lapse", "Slow motion", "Mixed"],
  },
  {
    id: "emotionalTone", section: "Content", sectionIcon: Film,
    ask: "What's the general emotional tone of the videos?",
    type: "chips",
    options: ["Neutral", "Positive/Upbeat", "Negative/Tense", "Instructional", "Emotional", "Dramatic", "Comedic"],
  },
  {
    id: "hasHumanSubjects", section: "Content", sectionIcon: Film,
    ask: "Does the content feature human subjects — people, faces, or activities?",
    type: "toggle",
  },
  {
    id: "demographicDiversity", section: "Content", sectionIcon: Film,
    ask: "What kinds of demographic diversity are represented in the human subjects?",
    type: "chips",
    options: ["Age diversity", "Gender diversity", "Ethnic diversity", "Geographic diversity", "Activity diversity", "Environment diversity"],
    showIf: (a) => a.hasHumanSubjects === true,
  },

  // B-Roll
  {
    id: "hasBRoll", section: "B-Roll", sectionIcon: Layers,
    ask: "Does your library include B-roll footage — cutaways, establishing shots, or supplementary clips?",
    type: "toggle",
  },
  {
    id: "bRollTypes", section: "B-Roll", sectionIcon: Layers,
    ask: "What types of B-roll are included? Select all that apply.",
    type: "chips",
    options: ["Establishing shots", "Cutaway footage", "Reaction shots", "Environmental/location", "Product/object close-ups", "Action sequences", "Crowd/event footage", "Nature/landscape", "Urban/architectural", "Abstract/artistic"],
    showIf: (a) => a.hasBRoll === true,
  },
  {
    id: "bRollVolume", section: "B-Roll", sectionIcon: Layers,
    ask: "Roughly what proportion of the total library is B-roll?",
    type: "chips-single",
    options: ["Under 10%", "10–25%", "25–50%", "50–75%", "75%+", "Unsure"],
    showIf: (a) => a.hasBRoll === true,
  },

  // Technical
  {
    id: "formats", section: "Technical", sectionIcon: Settings2,
    ask: "What video formats or codecs are used in the library?",
    type: "chips",
    options: ["MP4", "MOV", "AVI", "MXF", "ProRes", "RAW", "Other"],
  },
  {
    id: "resolution", section: "Technical", sectionIcon: Settings2,
    ask: "What resolutions does the content include?",
    type: "chips",
    options: ["SD (480p)", "HD (720p)", "Full HD (1080p)", "2K", "4K", "6K+", "Mixed"],
  },
  {
    id: "frameRate", section: "Technical", sectionIcon: Settings2,
    ask: "What's the primary frame rate?",
    type: "chips-single",
    options: ["24fps", "25fps", "30fps", "60fps", "120fps+", "Variable", "Unknown"],
  },
  {
    id: "compressionLevel", section: "Technical", sectionIcon: Settings2,
    ask: "How compressed is the footage overall?",
    type: "chips-single",
    options: ["Raw/Uncompressed", "Lightly compressed", "Standard compressed", "Highly compressed", "Mixed"],
  },
  {
    id: "audioType", section: "Technical", sectionIcon: Settings2,
    ask: "What type of audio is present in the videos?",
    type: "chips",
    options: ["Speech/Dialogue", "Music", "Ambient sound", "Sound effects", "No audio", "Mixed"],
  },
  {
    id: "technicalIssues", section: "Technical", sectionIcon: Settings2,
    ask: "Are there any known technical issues or artifacts in the footage?",
    type: "chips",
    options: ["Motion blur", "Poor lighting", "Camera shake", "Watermarks/logos", "Compression artifacts", "Noise/grain", "None known"],
  },

  // Metadata
  {
    id: "metadataTypes", section: "Metadata", sectionIcon: Tag,
    ask: "What metadata is currently associated with each video file?",
    type: "chips",
    options: ["Date/time", "Location/GPS", "Keywords/tags", "Descriptions", "Captions", "Transcripts", "Speaker IDs", "Event labels", "None"],
  },
  {
    id: "metadataStructure", section: "Metadata", sectionIcon: Tag,
    ask: "How is that metadata structured?",
    type: "chips-single",
    options: ["Structured (JSON/XML)", "Semi-structured", "Free text", "Mixed", "None"],
  },
  {
    id: "annotationLevel", section: "Metadata", sectionIcon: Tag,
    ask: "How detailed are the existing annotations or tags?",
    type: "chips-single",
    options: ["None", "Basic tags only", "Object detection boxes", "Semantic segmentation", "Activity labels", "Sentiment labels", "Comprehensive"],
  },
  {
    id: "metadataSource", section: "Metadata", sectionIcon: Tag,
    ask: "How was the metadata generated?",
    type: "chips",
    options: ["Manual/human", "Semi-automated", "Fully automated", "Mixed"],
  },
  {
    id: "hasTemporalAnnotation", section: "Metadata", sectionIcon: Tag,
    ask: "Are there temporal annotations — start/end timestamps for specific events or actions within clips?",
    type: "toggle",
  },

  // Volume
  {
    id: "totalHours", section: "Volume", sectionIcon: BarChart3,
    ask: "What's the total volume of video content available?",
    type: "chips-single",
    options: ["Under 10h", "10–100h", "100–500h", "500–1,000h", "1,000–5,000h", "5,000h+", "Unknown"],
  },
  {
    id: "contentFrequency", section: "Volume", sectionIcon: BarChart3,
    ask: "How frequently is new content generated or added?",
    type: "chips-single",
    options: ["One-time archive", "Monthly", "Weekly", "Daily", "Real-time/continuous"],
  },
  {
    id: "sourceVariety", section: "Volume", sectionIcon: BarChart3,
    ask: "How varied are the recording sources and conditions?",
    type: "chips",
    options: ["Multiple cameras", "Different angles", "Varying lighting", "Indoor & outdoor", "Multiple locations", "Multiple operators", "Single source"],
  },

  // Legal
  {
    id: "ownershipType", section: "Legal & Rights", sectionIcon: Shield,
    ask: "Who owns the intellectual property rights to this video content?",
    type: "chips-single",
    options: ["Fully owned", "Partially owned", "Licensed from others", "Mixed/unclear"],
  },
  {
    id: "hasThirdPartyIP", section: "Legal & Rights", sectionIcon: Shield,
    ask: "Is there any third-party IP embedded in the videos — background music, logos, or branded products?",
    type: "toggle",
  },
  {
    id: "hasPII", section: "Legal & Rights", sectionIcon: Shield,
    ask: "Does the content contain personally identifiable information (PII) — faces, license plates, or private locations?",
    type: "toggle",
  },
  {
    id: "piiManagement", section: "Legal & Rights", sectionIcon: Shield,
    ask: "How is that PII currently managed?",
    type: "chips",
    options: ["Faces blurred/anonymized", "License plates removed", "Consent obtained", "Private locations excluded", "Not yet addressed"],
    showIf: (a) => a.hasPII === true,
  },
  {
    id: "licensingIntent", section: "Legal & Rights", sectionIcon: Shield,
    ask: "Is your organization open to licensing this content for AI training purposes?",
    type: "chips-single",
    options: ["Yes, open to licensing", "Maybe, need more info", "No, not at this time"],
  },
  {
    id: "licensingModel", section: "Legal & Rights", sectionIcon: Shield,
    ask: "What licensing structures would you consider?",
    type: "chips",
    options: ["Non-exclusive", "Exclusive", "Perpetual", "Term-limited", "Revenue share", "Flat fee", "Open to discussion"],
    showIf: (a) => a.licensingIntent === "Yes, open to licensing",
  },

  // Uniqueness
  {
    id: "exclusivity", section: "Uniqueness", sectionIcon: Sparkles,
    ask: "How exclusive is this content — is similar footage widely available elsewhere?",
    type: "chips-single",
    options: ["Fully proprietary", "Mostly proprietary", "Some similar content exists", "Widely available elsewhere"],
  },
  {
    id: "uniquenessFactors", section: "Uniqueness", sectionIcon: Sparkles,
    ask: "What makes this content particularly valuable or hard to replicate?",
    type: "chips",
    options: ["Historical footage", "Rare events", "Specialized equipment", "Unique access/location", "Domain expertise", "Long-term archive", "High production quality", "Niche subject matter"],
  },

  // Usage
  {
    id: "originalPurpose", section: "Usage & Context", sectionIcon: BookOpen,
    ask: "What was the original purpose for which this content was created?",
    type: "chips",
    options: ["Broadcast/media", "Corporate communications", "Training/education", "Marketing", "Research", "Security/surveillance", "Personal/consumer", "Event documentation", "Other"],
  },
  {
    id: "previousAIUse", section: "Usage & Context", sectionIcon: BookOpen,
    ask: "Has this content been used in any previous AI or machine learning projects?",
    type: "toggle",
  },
  {
    id: "hasBenchmarks", section: "Usage & Context", sectionIcon: BookOpen,
    ask: "Are there any existing benchmarks or performance metrics associated with this content?",
    type: "toggle",
  },

  // Final
  {
    id: "notes", section: "Company", sectionIcon: Building2,
    ask: "Almost done! Is there anything else Credtent should know about your video library — context, restrictions, or special considerations?",
    hint: "This is optional — feel free to skip.",
    type: "textarea",
    optional: true,
  },
];

// ─── Section config ───────────────────────────────────────────────────────────

const SECTION_ORDER = ["Company", "Content", "B-Roll", "Technical", "Metadata", "Volume", "Legal & Rights", "Uniqueness", "Usage & Context"];

const SECTION_ICONS: Record<string, React.ElementType> = {
  Company: Building2,
  Content: Film,
  "B-Roll": Layers,
  Technical: Settings2,
  Metadata: Tag,
  Volume: BarChart3,
  "Legal & Rights": Shield,
  Uniqueness: Sparkles,
  "Usage & Context": BookOpen,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAnswer(q: Question, val: string | string[] | boolean | undefined): string {
  if (val === undefined || val === null || val === "") return "";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (Array.isArray(val)) return val.join(", ");
  return String(val);
}

function getVisibleQuestions(answers: Answers): Question[] {
  return QUESTIONS.filter((q) => !q.showIf || q.showIf(answers));
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
    if (!multi) {
      onSelect([opt]);
      return;
    }
    if (selected.includes(opt)) {
      onSelect(selected.filter((s) => s !== opt));
    } else {
      onSelect([...selected, opt]);
    }
  };
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => toggle(opt)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-all duration-150 ${
            selected.includes(opt)
              ? "bg-[oklch(0.22_0.08_264)] border-[oklch(0.22_0.08_264)] text-white"
              : "bg-white border-gray-200 text-gray-600 hover:border-[oklch(0.22_0.08_264)] hover:text-[oklch(0.22_0.08_264)]"
          }`}
        >
          {selected.includes(opt) && <CheckCircle2 className="w-3.5 h-3.5" />}
          {opt}
        </button>
      ))}
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
          <button
            key={label}
            type="button"
            onClick={() => onChange(isYes)}
            className={`px-5 py-2 rounded-full border text-sm font-semibold transition-all duration-150 ${
              active
                ? "bg-[oklch(0.22_0.08_264)] border-[oklch(0.22_0.08_264)] text-white"
                : "bg-white border-gray-200 text-gray-500 hover:border-gray-400"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Chat Bubble ──────────────────────────────────────────────────────────────

function AssistantBubble({ text, isNew }: { text: string; isNew?: boolean }) {
  return (
    <div className={`flex gap-3 items-start ${isNew ? "animate-in fade-in slide-in-from-bottom-2 duration-300" : ""}`}>
      <div className="w-8 h-8 rounded-full bg-[oklch(0.22_0.08_264)] flex items-center justify-center flex-shrink-0 mt-0.5">
        <svg width="16" height="16" viewBox="0 0 40 40" fill="none">
          <path d="M20 3L5 9V20C5 28.5 11.5 36.4 20 38C28.5 36.4 35 28.5 35 20V9L20 3Z" fill="oklch(0.68 0.19 41)" />
          <text x="20" y="26" textAnchor="middle" fill="white" fontSize="16" fontWeight="bold" fontFamily="Sora,sans-serif">C</text>
        </svg>
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

// ─── Form Summary Panel ───────────────────────────────────────────────────────

function FormPanel({ answers, visibleQuestions }: { answers: Answers; visibleQuestions: Question[] }) {
  const answeredBySection: Record<string, { q: Question; val: string }[]> = {};

  SECTION_ORDER.forEach((s) => { answeredBySection[s] = []; });

  visibleQuestions.forEach((q) => {
    const val = answers[q.id];
    const formatted = formatAnswer(q, val);
    if (formatted && formatted !== "false") {
      if (!answeredBySection[q.section]) answeredBySection[q.section] = [];
      answeredBySection[q.section].push({ q, val: formatted });
    }
  });

  const totalAnswered = visibleQuestions.filter((q) => {
    const v = answers[q.id];
    return v !== undefined && v !== "" && v !== false && !(Array.isArray(v) && v.length === 0);
  }).length;

  const pct = Math.round((totalAnswered / visibleQuestions.length) * 100);

  return (
    <div className="h-full flex flex-col">
      {/* Panel header */}
      <div className="px-5 py-4 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold text-[oklch(0.22_0.08_264)]">Content Profile</h2>
          <span className="text-xs text-gray-400">{pct}% complete</span>
        </div>
        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-[oklch(0.68_0.19_41)] rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Sections */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {SECTION_ORDER.map((section) => {
          const Icon = SECTION_ICONS[section];
          const items = answeredBySection[section] || [];
          if (items.length === 0) return null;
          return (
            <div key={section} className="animate-in fade-in duration-300">
              <div className="flex items-center gap-1.5 mb-2">
                <Icon className="w-3.5 h-3.5 text-[oklch(0.68_0.19_41)]" />
                <p className="text-xs font-semibold text-[oklch(0.22_0.08_264)] uppercase tracking-wider">{section}</p>
              </div>
              <div className="space-y-1.5 pl-5">
                {items.map(({ q, val }) => (
                  <div key={q.id} className="flex gap-2 items-start">
                    <CheckCircle2 className="w-3 h-3 text-green-400 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs text-gray-400 leading-tight truncate">{q.id.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}</p>
                      <p className="text-xs font-medium text-gray-700 leading-snug">{val}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {totalAnswered === 0 && (
          <div className="text-center py-10">
            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-3">
              <Film className="w-5 h-5 text-gray-300" />
            </div>
            <p className="text-xs text-gray-400">Your answers will appear here as you respond.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Home() {
  const [answers, setAnswers] = useState<Answers>({});
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [chatHistory, setChatHistory] = useState<{ role: "assistant" | "user"; text: string }[]>([]);
  const [inputText, setInputText] = useState("");
  const [pendingChips, setPendingChips] = useState<string[]>([]);
  const [pendingToggle, setPendingToggle] = useState<boolean | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  const visibleQuestions = getVisibleQuestions(answers);
  const currentQ = visibleQuestions[currentQIndex];

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, isTyping]);

  // Ask first question on mount
  useEffect(() => {
    if (chatHistory.length === 0 && visibleQuestions.length > 0) {
      setTimeout(() => {
        setChatHistory([
          { role: "assistant", text: "Hi! I'm the Credtent content assessment assistant. I'll ask you a series of questions about your video library, and we'll build your content profile together. It only takes a few minutes." },
        ]);
        setTimeout(() => {
          setChatHistory((prev) => [...prev, { role: "assistant", text: visibleQuestions[0].ask }]);
        }, 800);
      }, 300);
    }
  }, []);

  const advanceToNext = useCallback((newAnswers: Answers, fromIndex: number) => {
    const updated = getVisibleQuestions(newAnswers);
    const next = updated[fromIndex + 1];
    if (!next) {
      setSubmitted(true);
      setChatHistory((prev) => [
        ...prev,
        { role: "assistant", text: "That's everything! Your content profile is complete. Credtent will review your responses and follow up with a valuation estimate. Thank you!" },
      ]);
      return;
    }
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      setChatHistory((prev) => [...prev, { role: "assistant", text: next.ask }]);
      setCurrentQIndex(fromIndex + 1);
      setPendingChips([]);
      setPendingToggle(null);
    }, 600);
  }, []);

  const submitAnswer = useCallback((q: Question, value: string | string[] | boolean) => {
    const newAnswers = { ...answers, [q.id]: value };
    setAnswers(newAnswers);

    const display = formatAnswer(q, value);
    if (display && display !== "false") {
      setChatHistory((prev) => [...prev, { role: "user", text: display }]);
    } else if (typeof value === "boolean" && !value) {
      setChatHistory((prev) => [...prev, { role: "user", text: "No" }]);
    }

    const newVisible = getVisibleQuestions(newAnswers);
    const newIndex = newVisible.findIndex((vq) => vq.id === q.id);
    advanceToNext(newAnswers, newIndex);
  }, [answers, advanceToNext]);

  const handleSend = () => {
    if (!currentQ || submitted) return;

    if (currentQ.type === "chips" || currentQ.type === "chips-single") {
      if (pendingChips.length === 0 && !currentQ.optional) return;
      submitAnswer(currentQ, pendingChips);
    } else if (currentQ.type === "toggle") {
      if (pendingToggle === null) return;
      submitAnswer(currentQ, pendingToggle);
    } else {
      const val = inputText.trim();
      if (!val && !currentQ.optional) return;
      submitAnswer(currentQ, val);
      setInputText("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSkip = () => {
    if (!currentQ?.optional) return;
    const newAnswers = { ...answers };
    const newVisible = getVisibleQuestions(newAnswers);
    const idx = newVisible.findIndex((vq) => vq.id === currentQ.id);
    setChatHistory((prev) => [...prev, { role: "user", text: "Skipped" }]);
    advanceToNext(newAnswers, idx);
  };

  const handleReset = () => {
    setAnswers({});
    setCurrentQIndex(0);
    setChatHistory([]);
    setPendingChips([]);
    setPendingToggle(null);
    setInputText("");
    setSubmitted(false);
    setTimeout(() => {
      setChatHistory([
        { role: "assistant", text: "Hi! I'm the Credtent content assessment assistant. I'll ask you a series of questions about your video library, and we'll build your content profile together. It only takes a few minutes." },
      ]);
      setTimeout(() => {
        const vq = getVisibleQuestions({});
        setChatHistory((prev) => [...prev, { role: "assistant", text: vq[0].ask }]);
      }, 800);
    }, 300);
  };

  const canSend = () => {
    if (!currentQ || submitted) return false;
    if (currentQ.optional) return true;
    if (currentQ.type === "chips" || currentQ.type === "chips-single") return pendingChips.length > 0;
    if (currentQ.type === "toggle") return pendingToggle !== null;
    return inputText.trim().length > 0;
  };

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
          <span className="text-white/60 text-sm hidden sm:inline">Video Content Valuation</span>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="flex items-center gap-1.5 text-white/50 hover:text-white/80 text-xs transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Start over</span>
        </button>
      </header>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat Panel */}
        <div className="flex flex-col flex-1 min-w-0 border-r border-gray-200">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-4">
            {chatHistory.map((msg, i) =>
              msg.role === "assistant"
                ? <AssistantBubble key={i} text={msg.text} isNew={i === chatHistory.length - 1} />
                : <UserBubble key={i} text={msg.text} />
            )}
            {isTyping && (
              <div className="flex gap-3 items-start animate-in fade-in duration-200">
                <div className="w-8 h-8 rounded-full bg-[oklch(0.22_0.08_264)] flex items-center justify-center flex-shrink-0">
                  <svg width="16" height="16" viewBox="0 0 40 40" fill="none">
                    <path d="M20 3L5 9V20C5 28.5 11.5 36.4 20 38C28.5 36.4 35 28.5 35 20V9L20 3Z" fill="oklch(0.68 0.19 41)" />
                    <text x="20" y="26" textAnchor="middle" fill="white" fontSize="16" fontWeight="bold" fontFamily="Sora,sans-serif">C</text>
                  </svg>
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
          {!submitted && currentQ && (
            <div className="flex-shrink-0 border-t border-gray-100 bg-white px-4 sm:px-6 py-4">
              {/* Chip input */}
              {(currentQ.type === "chips" || currentQ.type === "chips-single") && (
                <div className="mb-3">
                  <ChipSelector
                    options={currentQ.options || []}
                    selected={pendingChips}
                    multi={currentQ.type === "chips"}
                    onSelect={setPendingChips}
                  />
                </div>
              )}

              {/* Toggle input */}
              {currentQ.type === "toggle" && (
                <div className="mb-3">
                  <Toggle
                    value={pendingToggle ?? false}
                    onChange={(v) => setPendingToggle(v)}
                  />
                </div>
              )}

              {/* Text / email input */}
              {(currentQ.type === "text" || currentQ.type === "email") && (
                <div className="flex gap-2 mb-3">
                  <input
                    ref={inputRef as React.RefObject<HTMLInputElement>}
                    type={currentQ.type}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={currentQ.hint || "Type your answer…"}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[oklch(0.22_0.08_264)] focus:border-transparent transition"
                    autoFocus
                  />
                </div>
              )}

              {/* Textarea */}
              {currentQ.type === "textarea" && (
                <div className="mb-3">
                  <textarea
                    ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={currentQ.hint || "Type your answer…"}
                    rows={3}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[oklch(0.22_0.08_264)] focus:border-transparent transition resize-none"
                    autoFocus
                  />
                </div>
              )}

              {/* Send row */}
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-gray-400">
                  {currentQIndex + 1} of {visibleQuestions.length} questions
                  {currentQ.type === "chips" && pendingChips.length === 0 && (
                    <span className="ml-1 text-gray-300">— select at least one</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {currentQ.optional && (
                    <button
                      type="button"
                      onClick={handleSkip}
                      className="text-xs text-gray-400 hover:text-gray-600 transition-colors px-3 py-1.5"
                    >
                      Skip
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={!canSend()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[oklch(0.68_0.19_41)] hover:bg-[oklch(0.62_0.19_41)] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all duration-150 active:scale-95"
                  >
                    {currentQ.type === "chips" || currentQ.type === "chips-single" ? "Confirm" : "Send"}
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {submitted && (
            <div className="flex-shrink-0 border-t border-gray-100 bg-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-sm font-semibold">Assessment complete</span>
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2 transition-colors"
              >
                Start a new assessment
              </button>
            </div>
          )}
        </div>

        {/* Form Summary Panel — hidden on mobile */}
        <aside className="hidden md:flex flex-col w-80 lg:w-96 flex-shrink-0 bg-white overflow-hidden">
          <FormPanel answers={answers} visibleQuestions={visibleQuestions} />
        </aside>
      </div>
    </div>
  );
}
