/**
 * Credtent Video Content Valuation Form
 * Design: Clean Assessment Dashboard — Sora font, navy/orange palette
 * Layout: Sticky left nav + scrollable form sections
 * UX: Chip selectors, toggles, sliders replace heavy text inputs
 */

import { useState, useEffect, useRef } from "react";
import { CheckCircle2, ChevronRight, Film, Settings2, Tag, BarChart3, Shield, Sparkles, Layers, BookOpen } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ChipGroupProps = {
  options: string[];
  selected: string[];
  onChange: (val: string[]) => void;
  multi?: boolean;
  color?: "navy" | "orange";
};

type ToggleProps = {
  value: boolean;
  onChange: (v: boolean) => void;
  label?: string;
};

type FormData = {
  // 1. Content Characteristics
  genres: string[];
  clipDuration: string;
  hasHumanSubjects: boolean;
  demographicDiversity: string[];
  contentType: string[];
  emotionalTone: string[];
  hasBRoll: boolean;
  bRollTypes: string[];
  bRollVolume: string;

  // 2. Technical Specs
  formats: string[];
  resolution: string[];
  frameRate: string;
  compressionLevel: string;
  audioType: string[];
  technicalIssues: string[];

  // 3. Metadata & Annotation
  metadataTypes: string[];
  metadataStructure: string;
  annotationLevel: string;
  hasTemporalAnnotation: boolean;
  metadataSource: string[];

  // 4. Volume & Diversity
  totalHours: string;
  contentFrequency: string;
  sourceVariety: string[];

  // 5. Legal & Rights
  ownershipType: string;
  hasThirdPartyIP: boolean;
  hasPII: boolean;
  piiManagement: string[];
  licensingIntent: string;
  licensingModel: string[];

  // 6. Uniqueness
  exclusivity: string;
  uniquenessFactors: string[];

  // 7. Usage & Context
  originalPurpose: string[];
  previousAIUse: boolean;
  hasBenchmarks: boolean;

  // Company info
  companyName: string;
  contactName: string;
  contactEmail: string;
  notes: string;
};

// ─── Chip Group ───────────────────────────────────────────────────────────────

function ChipGroup({ options, selected, onChange, multi = true, color = "navy" }: ChipGroupProps) {
  const toggle = (opt: string) => {
    if (!multi) {
      onChange(selected[0] === opt ? [] : [opt]);
      return;
    }
    if (selected.includes(opt)) {
      onChange(selected.filter((s) => s !== opt));
    } else {
      onChange([...selected, opt]);
    }
  };
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => toggle(opt)}
          className={`chip-option ${selected.includes(opt) ? (color === "orange" ? "selected-orange" : "selected") : ""}`}
        >
          {selected.includes(opt) && <CheckCircle2 className="w-3.5 h-3.5" />}
          {opt}
        </button>
      ))}
    </div>
  );
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({ value, onChange, label }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className="flex items-center gap-3 group"
    >
      <div
        className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${value ? "bg-[oklch(0.22_0.08_264)]" : "bg-gray-200"}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${value ? "translate-x-5" : "translate-x-0"}`}
        />
      </div>
      {label && (
        <span className="text-sm font-medium text-gray-700">{label}</span>
      )}
    </button>
  );
}

// ─── Question Label ───────────────────────────────────────────────────────────

function QLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-1">
      <p className="text-sm font-semibold text-gray-800">{children}</p>
      {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({
  num,
  icon: Icon,
  title,
  subtitle,
  complete,
}: {
  num: number;
  icon: React.ElementType;
  title: string;
  subtitle: string;
  complete?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 mb-5 pb-4 border-b border-gray-100">
      <div className={`section-badge ${complete ? "complete" : ""}`}>
        {complete ? <CheckCircle2 className="w-4 h-4" /> : num}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-[oklch(0.68_0.19_41)]" />
          <h2 className="text-base font-bold text-[oklch(0.22_0.08_264)]">{title}</h2>
        </div>
        <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}

// ─── Text Input ───────────────────────────────────────────────────────────────

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full mt-2 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[oklch(0.22_0.08_264)] focus:border-transparent transition"
    />
  );
}

function TextArea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full mt-2 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[oklch(0.22_0.08_264)] focus:border-transparent transition resize-none"
    />
  );
}

// ─── Nav Item ─────────────────────────────────────────────────────────────────

function NavItem({
  num,
  label,
  active,
  complete,
  onClick,
}: {
  num: number;
  label: string;
  active: boolean;
  complete: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm transition-all duration-150 ${
        active
          ? "bg-white text-[oklch(0.22_0.08_264)] font-semibold shadow-sm"
          : "text-white/70 hover:text-white hover:bg-white/10"
      }`}
    >
      <span
        className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors ${
          complete
            ? "bg-green-400 text-white"
            : active
            ? "bg-[oklch(0.68_0.19_41)] text-white"
            : "bg-white/20 text-white/60"
        }`}
      >
        {complete ? <CheckCircle2 className="w-3 h-3" /> : num}
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const SECTIONS = [
  { id: "content", label: "Content" },
  { id: "broll", label: "B-Roll" },
  { id: "technical", label: "Technical" },
  { id: "metadata", label: "Metadata" },
  { id: "volume", label: "Volume" },
  { id: "legal", label: "Legal & Rights" },
  { id: "uniqueness", label: "Uniqueness" },
  { id: "usage", label: "Usage" },
  { id: "company", label: "Company Info" },
];

const GENRE_OPTIONS = [
  "Sports", "Educational", "Documentary", "Corporate", "Entertainment",
  "News/Journalism", "Medical/Health", "Industrial", "Surveillance/Security",
  "User-Generated", "Nature/Wildlife", "Travel", "Lifestyle", "Other",
];

const DURATION_OPTIONS = ["Under 30s", "30s–2min", "2–10min", "10–30min", "30min+", "Mixed"];

const DEMOGRAPHIC_OPTIONS = ["Age diversity", "Gender diversity", "Ethnic diversity", "Geographic diversity", "Activity diversity", "Environment diversity"];

const CONTENT_TYPE_OPTIONS = ["Static shots", "Dynamic movement", "Aerial/drone", "POV/first-person", "Time-lapse", "Slow motion", "Mixed"];

const TONE_OPTIONS = ["Neutral", "Positive/Upbeat", "Negative/Tense", "Instructional", "Emotional", "Dramatic", "Comedic"];

const BROLL_TYPE_OPTIONS = [
  "Establishing shots", "Cutaway footage", "Reaction shots", "Environmental/location",
  "Product/object close-ups", "Action sequences", "Crowd/event footage",
  "Nature/landscape", "Urban/architectural", "Abstract/artistic",
];

const BROLL_VOLUME_OPTIONS = ["Under 10%", "10–25%", "25–50%", "50–75%", "75%+", "Unsure"];

const FORMAT_OPTIONS = ["MP4", "MOV", "AVI", "MXF", "ProRes", "RAW", "Other"];

const RESOLUTION_OPTIONS = ["SD (480p)", "HD (720p)", "Full HD (1080p)", "2K", "4K", "6K+", "Mixed"];

const FPS_OPTIONS = ["24fps", "25fps", "30fps", "60fps", "120fps+", "Variable", "Unknown"];

const COMPRESSION_OPTIONS = ["Raw/Uncompressed", "Lightly compressed", "Standard compressed", "Highly compressed", "Mixed"];

const AUDIO_OPTIONS = ["Speech/Dialogue", "Music", "Ambient sound", "Sound effects", "No audio", "Mixed"];

const TECHNICAL_ISSUE_OPTIONS = ["Motion blur", "Poor lighting", "Camera shake", "Watermarks/logos", "Compression artifacts", "Noise/grain", "None known"];

const METADATA_TYPE_OPTIONS = ["Date/time", "Location/GPS", "Keywords/tags", "Descriptions", "Captions", "Transcripts", "Speaker IDs", "Event labels", "None"];

const METADATA_STRUCTURE_OPTIONS = ["Structured (JSON/XML)", "Semi-structured", "Free text", "Mixed", "None"];

const ANNOTATION_LEVEL_OPTIONS = ["None", "Basic tags only", "Object detection boxes", "Semantic segmentation", "Activity labels", "Sentiment labels", "Comprehensive"];

const METADATA_SOURCE_OPTIONS = ["Manual/human", "Semi-automated", "Fully automated", "Mixed"];

const TOTAL_HOURS_OPTIONS = ["Under 10h", "10–100h", "100–500h", "500–1,000h", "1,000–5,000h", "5,000h+", "Unknown"];

const FREQUENCY_OPTIONS = ["One-time archive", "Monthly", "Weekly", "Daily", "Real-time/continuous"];

const SOURCE_VARIETY_OPTIONS = ["Multiple cameras", "Different angles", "Varying lighting", "Indoor & outdoor", "Multiple locations", "Multiple operators", "Single source"];

const OWNERSHIP_OPTIONS = ["Fully owned", "Partially owned", "Licensed from others", "Mixed/unclear"];

const PII_MANAGEMENT_OPTIONS = ["Faces blurred/anonymized", "License plates removed", "Consent obtained", "Private locations excluded", "Not yet addressed"];

const LICENSING_INTENT_OPTIONS = ["Yes, open to licensing", "Maybe, need more info", "No, not at this time"];

const LICENSING_MODEL_OPTIONS = ["Non-exclusive", "Exclusive", "Perpetual", "Term-limited", "Revenue share", "Flat fee", "Open to discussion"];

const EXCLUSIVITY_OPTIONS = ["Fully proprietary", "Mostly proprietary", "Some similar content exists", "Widely available elsewhere"];

const UNIQUENESS_FACTOR_OPTIONS = [
  "Historical footage", "Rare events", "Specialized equipment", "Unique access/location",
  "Domain expertise", "Long-term archive", "High production quality", "Niche subject matter",
];

const ORIGINAL_PURPOSE_OPTIONS = [
  "Broadcast/media", "Corporate communications", "Training/education", "Marketing",
  "Research", "Security/surveillance", "Personal/consumer", "Event documentation", "Other",
];

export default function Home() {
  const [activeSection, setActiveSection] = useState("content");
  const [submitted, setSubmitted] = useState(false);
  const [completedSections, setCompletedSections] = useState<Set<string>>(new Set());
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [form, setForm] = useState<FormData>({
    genres: [],
    clipDuration: "",
    hasHumanSubjects: false,
    demographicDiversity: [],
    contentType: [],
    emotionalTone: [],
    hasBRoll: false,
    bRollTypes: [],
    bRollVolume: "",
    formats: [],
    resolution: [],
    frameRate: "",
    compressionLevel: "",
    audioType: [],
    technicalIssues: [],
    metadataTypes: [],
    metadataStructure: "",
    annotationLevel: "",
    hasTemporalAnnotation: false,
    metadataSource: [],
    totalHours: "",
    contentFrequency: "",
    sourceVariety: [],
    ownershipType: "",
    hasThirdPartyIP: false,
    hasPII: false,
    piiManagement: [],
    licensingIntent: "",
    licensingModel: [],
    exclusivity: "",
    uniquenessFactors: [],
    originalPurpose: [],
    previousAIUse: false,
    hasBenchmarks: false,
    companyName: "",
    contactName: "",
    contactEmail: "",
    notes: "",
  });

  const update = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // Scroll spy
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: "-30% 0px -60% 0px" }
    );
    Object.values(sectionRefs.current).forEach((el) => {
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Compute section completeness (simple heuristic)
  useEffect(() => {
    const completed = new Set<string>();
    if (form.genres.length > 0 && form.clipDuration) completed.add("content");
    if (form.hasBRoll && form.bRollTypes.length > 0) completed.add("broll");
    if (!form.hasBRoll) completed.add("broll");
    if (form.formats.length > 0 && form.resolution.length > 0) completed.add("technical");
    if (form.metadataTypes.length > 0) completed.add("metadata");
    if (form.totalHours) completed.add("volume");
    if (form.ownershipType && form.licensingIntent) completed.add("legal");
    if (form.exclusivity) completed.add("uniqueness");
    if (form.originalPurpose.length > 0) completed.add("usage");
    if (form.companyName && form.contactEmail) completed.add("company");
    setCompletedSections(completed);
  }, [form]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-[oklch(0.98_0.003_264)] flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white rounded-2xl shadow-lg p-10 text-center">
          <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-[oklch(0.22_0.08_264)] mb-2">Assessment Submitted</h2>
          <p className="text-gray-500 text-sm mb-6">
            Thank you, <strong>{form.contactName || form.companyName}</strong>. Credtent will review your video content profile and be in touch with a valuation estimate.
          </p>
          <div className="bg-[oklch(0.96_0.04_41)] rounded-lg px-4 py-3 text-sm text-[oklch(0.68_0.19_41)] font-medium mb-6">
            {completedSections.size} of {SECTIONS.length} sections completed
          </div>
          <button
            type="button"
            onClick={() => setSubmitted(false)}
            className="text-sm text-[oklch(0.22_0.08_264)] underline underline-offset-2"
          >
            Edit responses
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[oklch(0.98_0.003_264)]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[oklch(0.22_0.08_264)] border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {/* Credtent shield logo SVG */}
            <svg width="28" height="28" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 3L5 9V20C5 28.5 11.5 36.4 20 38C28.5 36.4 35 28.5 35 20V9L20 3Z" fill="oklch(0.68 0.19 41)" />
              <path d="M20 3L5 9V20C5 28.5 11.5 36.4 20 38C28.5 36.4 35 28.5 35 20V9L20 3Z" fill="url(#shieldGrad)" opacity="0.3" />
              <text x="20" y="26" textAnchor="middle" fill="white" fontSize="16" fontWeight="bold" fontFamily="Sora, sans-serif">C</text>
              <defs>
                <linearGradient id="shieldGrad" x1="20" y1="3" x2="20" y2="38" gradientUnits="userSpaceOnUse">
                  <stop stopColor="white" stopOpacity="0.3" />
                  <stop offset="1" stopColor="white" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
            <span className="text-white font-bold text-base tracking-tight">Credtent</span>
            <span className="hidden sm:inline text-white/30 text-sm mx-1">|</span>
            <span className="hidden sm:inline text-white/60 text-sm">Video Content Valuation</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-xs text-white/50 hidden sm:block">
              {completedSections.size}/{SECTIONS.length} sections
            </div>
            <div className="w-24 h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-[oklch(0.68_0.19_41)] rounded-full transition-all duration-500"
                style={{ width: `${(completedSections.size / SECTIONS.length) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex gap-8">
        {/* Sidebar Nav */}
        <aside className="hidden lg:flex flex-col w-52 flex-shrink-0">
          <div className="sticky top-20 bg-[oklch(0.22_0.08_264)] rounded-xl p-3 shadow-lg">
            <p className="text-white/40 text-xs uppercase tracking-widest px-3 mb-2 font-semibold">Sections</p>
            <nav className="flex flex-col gap-0.5">
              {SECTIONS.map((s, i) => (
                <NavItem
                  key={s.id}
                  num={i + 1}
                  label={s.label}
                  active={activeSection === s.id}
                  complete={completedSections.has(s.id)}
                  onClick={() => scrollTo(s.id)}
                />
              ))}
            </nav>
            <div className="mt-4 pt-3 border-t border-white/10 px-3">
              <p className="text-white/40 text-xs">
                {completedSections.size} of {SECTIONS.length} complete
              </p>
            </div>
          </div>
        </aside>

        {/* Form */}
        <main className="flex-1 min-w-0">
          {/* Intro */}
          <div className="mb-6">
            <h1 className="text-2xl font-extrabold text-[oklch(0.22_0.08_264)] leading-tight">
              Video Content <span className="text-[oklch(0.68_0.19_41)]">Valuation</span> Assessment
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Help Credtent understand your video library so we can assess its potential value for ethical AI training licensing.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* ── Section 1: Content Characteristics ── */}
            <div id="content" ref={(el) => { sectionRefs.current["content"] = el; }} className="form-section">
              <SectionHeader
                num={1}
                icon={Film}
                title="Content Characteristics"
                subtitle="What kind of video content do you have?"
                complete={completedSections.has("content")}
              />
              <div className="space-y-5">
                <div>
                  <QLabel>Primary genre(s) or subject matter</QLabel>
                  <ChipGroup options={GENRE_OPTIONS} selected={form.genres} onChange={(v) => update("genres", v)} />
                </div>
                <div>
                  <QLabel>Typical clip duration</QLabel>
                  <ChipGroup options={DURATION_OPTIONS} selected={form.clipDuration ? [form.clipDuration] : []} onChange={(v) => update("clipDuration", v[0] || "")} multi={false} />
                </div>
                <div>
                  <QLabel>Shot style</QLabel>
                  <ChipGroup options={CONTENT_TYPE_OPTIONS} selected={form.contentType} onChange={(v) => update("contentType", v)} />
                </div>
                <div>
                  <QLabel>Emotional tone</QLabel>
                  <ChipGroup options={TONE_OPTIONS} selected={form.emotionalTone} onChange={(v) => update("emotionalTone", v)} />
                </div>
                <div className="flex items-center justify-between py-2 border-t border-gray-100">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Features human subjects?</p>
                    <p className="text-xs text-gray-400">Faces, people, activities</p>
                  </div>
                  <Toggle value={form.hasHumanSubjects} onChange={(v) => update("hasHumanSubjects", v)} />
                </div>
                {form.hasHumanSubjects && (
                  <div>
                    <QLabel hint="Select all that apply">Demographic diversity represented</QLabel>
                    <ChipGroup options={DEMOGRAPHIC_OPTIONS} selected={form.demographicDiversity} onChange={(v) => update("demographicDiversity", v)} />
                  </div>
                )}
              </div>
            </div>

            {/* ── Section 2: B-Roll ── */}
            <div id="broll" ref={(el) => { sectionRefs.current["broll"] = el; }} className="form-section">
              <SectionHeader
                num={2}
                icon={Layers}
                title="B-Roll Content"
                subtitle="Supporting and supplementary footage details"
                complete={completedSections.has("broll")}
              />
              <div className="space-y-5">
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Does the library include B-roll footage?</p>
                    <p className="text-xs text-gray-400">Cutaways, establishing shots, supplementary clips</p>
                  </div>
                  <Toggle value={form.hasBRoll} onChange={(v) => update("hasBRoll", v)} />
                </div>
                {form.hasBRoll && (
                  <>
                    <div>
                      <QLabel>Types of B-roll included</QLabel>
                      <ChipGroup options={BROLL_TYPE_OPTIONS} selected={form.bRollTypes} onChange={(v) => update("bRollTypes", v)} />
                    </div>
                    <div>
                      <QLabel>Approximate proportion of total library that is B-roll</QLabel>
                      <ChipGroup options={BROLL_VOLUME_OPTIONS} selected={form.bRollVolume ? [form.bRollVolume] : []} onChange={(v) => update("bRollVolume", v[0] || "")} multi={false} color="orange" />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* ── Section 3: Technical Specs ── */}
            <div id="technical" ref={(el) => { sectionRefs.current["technical"] = el; }} className="form-section">
              <SectionHeader
                num={3}
                icon={Settings2}
                title="Technical Specifications"
                subtitle="File formats, resolution, and quality attributes"
                complete={completedSections.has("technical")}
              />
              <div className="space-y-5">
                <div>
                  <QLabel>Video formats / codecs</QLabel>
                  <ChipGroup options={FORMAT_OPTIONS} selected={form.formats} onChange={(v) => update("formats", v)} />
                </div>
                <div>
                  <QLabel>Resolution</QLabel>
                  <ChipGroup options={RESOLUTION_OPTIONS} selected={form.resolution} onChange={(v) => update("resolution", v)} />
                </div>
                <div>
                  <QLabel>Frame rate</QLabel>
                  <ChipGroup options={FPS_OPTIONS} selected={form.frameRate ? [form.frameRate] : []} onChange={(v) => update("frameRate", v[0] || "")} multi={false} />
                </div>
                <div>
                  <QLabel>Compression level</QLabel>
                  <ChipGroup options={COMPRESSION_OPTIONS} selected={form.compressionLevel ? [form.compressionLevel] : []} onChange={(v) => update("compressionLevel", v[0] || "")} multi={false} color="orange" />
                </div>
                <div>
                  <QLabel>Audio content</QLabel>
                  <ChipGroup options={AUDIO_OPTIONS} selected={form.audioType} onChange={(v) => update("audioType", v)} />
                </div>
                <div>
                  <QLabel hint="Select any known issues">Known technical issues or artifacts</QLabel>
                  <ChipGroup options={TECHNICAL_ISSUE_OPTIONS} selected={form.technicalIssues} onChange={(v) => update("technicalIssues", v)} />
                </div>
              </div>
            </div>

            {/* ── Section 4: Metadata & Annotation ── */}
            <div id="metadata" ref={(el) => { sectionRefs.current["metadata"] = el; }} className="form-section">
              <SectionHeader
                num={4}
                icon={Tag}
                title="Metadata & Annotation"
                subtitle="Existing labels, tags, and structured data"
                complete={completedSections.has("metadata")}
              />
              <div className="space-y-5">
                <div>
                  <QLabel>What metadata exists per video?</QLabel>
                  <ChipGroup options={METADATA_TYPE_OPTIONS} selected={form.metadataTypes} onChange={(v) => update("metadataTypes", v)} />
                </div>
                <div>
                  <QLabel>Metadata structure</QLabel>
                  <ChipGroup options={METADATA_STRUCTURE_OPTIONS} selected={form.metadataStructure ? [form.metadataStructure] : []} onChange={(v) => update("metadataStructure", v[0] || "")} multi={false} />
                </div>
                <div>
                  <QLabel>Annotation depth</QLabel>
                  <ChipGroup options={ANNOTATION_LEVEL_OPTIONS} selected={form.annotationLevel ? [form.annotationLevel] : []} onChange={(v) => update("annotationLevel", v[0] || "")} multi={false} color="orange" />
                </div>
                <div>
                  <QLabel>How was metadata generated?</QLabel>
                  <ChipGroup options={METADATA_SOURCE_OPTIONS} selected={form.metadataSource} onChange={(v) => update("metadataSource", v)} />
                </div>
                <div className="flex items-center justify-between py-2 border-t border-gray-100">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Temporal annotations available?</p>
                    <p className="text-xs text-gray-400">Start/end timestamps for events or actions</p>
                  </div>
                  <Toggle value={form.hasTemporalAnnotation} onChange={(v) => update("hasTemporalAnnotation", v)} />
                </div>
              </div>
            </div>

            {/* ── Section 5: Volume & Diversity ── */}
            <div id="volume" ref={(el) => { sectionRefs.current["volume"] = el; }} className="form-section">
              <SectionHeader
                num={5}
                icon={BarChart3}
                title="Volume & Diversity"
                subtitle="Scale and variety of your content library"
                complete={completedSections.has("volume")}
              />
              <div className="space-y-5">
                <div>
                  <QLabel>Total volume of video content</QLabel>
                  <ChipGroup options={TOTAL_HOURS_OPTIONS} selected={form.totalHours ? [form.totalHours] : []} onChange={(v) => update("totalHours", v[0] || "")} multi={false} color="orange" />
                </div>
                <div>
                  <QLabel>How frequently is new content added?</QLabel>
                  <ChipGroup options={FREQUENCY_OPTIONS} selected={form.contentFrequency ? [form.contentFrequency] : []} onChange={(v) => update("contentFrequency", v[0] || "")} multi={false} />
                </div>
                <div>
                  <QLabel hint="Select all that apply">Source and recording variety</QLabel>
                  <ChipGroup options={SOURCE_VARIETY_OPTIONS} selected={form.sourceVariety} onChange={(v) => update("sourceVariety", v)} />
                </div>
              </div>
            </div>

            {/* ── Section 6: Legal & Rights ── */}
            <div id="legal" ref={(el) => { sectionRefs.current["legal"] = el; }} className="form-section">
              <SectionHeader
                num={6}
                icon={Shield}
                title="Legal & Rights"
                subtitle="Ownership, privacy, and licensing considerations"
                complete={completedSections.has("legal")}
              />
              <div className="space-y-5">
                <div>
                  <QLabel>Ownership of intellectual property</QLabel>
                  <ChipGroup options={OWNERSHIP_OPTIONS} selected={form.ownershipType ? [form.ownershipType] : []} onChange={(v) => update("ownershipType", v[0] || "")} multi={false} />
                </div>
                <div className="flex items-center justify-between py-2 border-t border-gray-100">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Third-party IP embedded?</p>
                    <p className="text-xs text-gray-400">Background music, logos, branded products</p>
                  </div>
                  <Toggle value={form.hasThirdPartyIP} onChange={(v) => update("hasThirdPartyIP", v)} />
                </div>
                <div className="flex items-center justify-between py-2 border-t border-gray-100">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Personal identifiable information (PII) present?</p>
                    <p className="text-xs text-gray-400">Faces, license plates, private locations</p>
                  </div>
                  <Toggle value={form.hasPII} onChange={(v) => update("hasPII", v)} />
                </div>
                {form.hasPII && (
                  <div>
                    <QLabel>How is PII managed?</QLabel>
                    <ChipGroup options={PII_MANAGEMENT_OPTIONS} selected={form.piiManagement} onChange={(v) => update("piiManagement", v)} />
                  </div>
                )}
                <div>
                  <QLabel>Open to licensing for AI training?</QLabel>
                  <ChipGroup options={LICENSING_INTENT_OPTIONS} selected={form.licensingIntent ? [form.licensingIntent] : []} onChange={(v) => update("licensingIntent", v[0] || "")} multi={false} color="orange" />
                </div>
                {form.licensingIntent === "Yes, open to licensing" && (
                  <div>
                    <QLabel hint="Select preferred structures">Preferred licensing model</QLabel>
                    <ChipGroup options={LICENSING_MODEL_OPTIONS} selected={form.licensingModel} onChange={(v) => update("licensingModel", v)} />
                  </div>
                )}
              </div>
            </div>

            {/* ── Section 7: Uniqueness ── */}
            <div id="uniqueness" ref={(el) => { sectionRefs.current["uniqueness"] = el; }} className="form-section">
              <SectionHeader
                num={7}
                icon={Sparkles}
                title="Uniqueness & Proprietary Value"
                subtitle="What makes this content rare or hard to replicate?"
                complete={completedSections.has("uniqueness")}
              />
              <div className="space-y-5">
                <div>
                  <QLabel>How exclusive is this content?</QLabel>
                  <ChipGroup options={EXCLUSIVITY_OPTIONS} selected={form.exclusivity ? [form.exclusivity] : []} onChange={(v) => update("exclusivity", v[0] || "")} multi={false} color="orange" />
                </div>
                <div>
                  <QLabel hint="Select all that apply">Unique value factors</QLabel>
                  <ChipGroup options={UNIQUENESS_FACTOR_OPTIONS} selected={form.uniquenessFactors} onChange={(v) => update("uniquenessFactors", v)} />
                </div>
              </div>
            </div>

            {/* ── Section 8: Usage & Context ── */}
            <div id="usage" ref={(el) => { sectionRefs.current["usage"] = el; }} className="form-section">
              <SectionHeader
                num={8}
                icon={BookOpen}
                title="Usage & Context"
                subtitle="Original purpose and prior AI use"
                complete={completedSections.has("usage")}
              />
              <div className="space-y-5">
                <div>
                  <QLabel>Original purpose of the content</QLabel>
                  <ChipGroup options={ORIGINAL_PURPOSE_OPTIONS} selected={form.originalPurpose} onChange={(v) => update("originalPurpose", v)} />
                </div>
                <div className="flex items-center justify-between py-2 border-t border-gray-100">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Previously used in AI/ML projects?</p>
                    <p className="text-xs text-gray-400">Internal or external training use</p>
                  </div>
                  <Toggle value={form.previousAIUse} onChange={(v) => update("previousAIUse", v)} />
                </div>
                <div className="flex items-center justify-between py-2 border-t border-gray-100">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Existing benchmarks or performance metrics?</p>
                    <p className="text-xs text-gray-400">Evaluation datasets or test results</p>
                  </div>
                  <Toggle value={form.hasBenchmarks} onChange={(v) => update("hasBenchmarks", v)} />
                </div>
              </div>
            </div>

            {/* ── Section 9: Company Info ── */}
            <div id="company" ref={(el) => { sectionRefs.current["company"] = el; }} className="form-section">
              <SectionHeader
                num={9}
                icon={ChevronRight}
                title="Company Information"
                subtitle="Who should Credtent follow up with?"
                complete={completedSections.has("company")}
              />
              <div className="space-y-4">
                <div>
                  <QLabel>Company name</QLabel>
                  <TextInput value={form.companyName} onChange={(v) => update("companyName", v)} placeholder="Acme Media Corp" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <QLabel>Contact name</QLabel>
                    <TextInput value={form.contactName} onChange={(v) => update("contactName", v)} placeholder="Jane Smith" />
                  </div>
                  <div>
                    <QLabel>Contact email</QLabel>
                    <input
                      type="email"
                      value={form.contactEmail}
                      onChange={(e) => update("contactEmail", e.target.value)}
                      placeholder="jane@acmemedia.com"
                      className="w-full mt-2 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[oklch(0.22_0.08_264)] focus:border-transparent transition"
                    />
                  </div>
                </div>
                <div>
                  <QLabel hint="Optional">Additional notes or context</QLabel>
                  <TextArea value={form.notes} onChange={(v) => update("notes", v)} placeholder="Anything else Credtent should know about your video library..." rows={3} />
                </div>
              </div>
            </div>

            {/* Submit */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 pb-8">
              <p className="text-xs text-gray-400">
                {completedSections.size} of {SECTIONS.length} sections completed &mdash; you can submit at any time
              </p>
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-7 py-3 rounded-full bg-[oklch(0.68_0.19_41)] hover:bg-[oklch(0.62_0.19_41)] text-white font-semibold text-sm shadow-md transition-all duration-150 active:scale-95"
              >
                Submit Assessment
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}
