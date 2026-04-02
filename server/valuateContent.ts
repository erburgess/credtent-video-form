/**
 * valuateContent.ts
 *
 * Credtent Platform Valuation Engine
 *
 * Implements the Credtent Unified Valuation Formula to produce a baseline
 * AI training licensing value estimate. This is the "Platform Valuation" —
 * an algorithmic estimate that feeds into the human-reviewed Custom Valuation.
 *
 * Formula: Final Value = Base Price × (Score Multiplier + Category Multiplier
 *          + Content Type Multiplier + Creator/Org Multiplier + Educational Multiplier)
 *
 * The LLM applies this framework to the content owner's self-reported signals,
 * producing both an internal verbose report (for Credtent staff) and a
 * customer-facing summary.
 */

import { invokeLLM } from "./_core/llm";

// ─── Input / Output Types ─────────────────────────────────────────────────────

export interface ContentEntrySignals {
  type: string;
  customLabel?: string;
  answers: Record<string, unknown>;
}

export interface AccoladesSignals {
  title: string;
  kind: string;
  externalRatings?: Array<{ platform: string; score: string; voteCount?: string }>;
  boxOffice?: string;
  certifications?: string[];
  editionCount?: number;
  valuationNote?: string;
}

export interface WebsiteInventorySignals {
  siteName?: string;
  counts?: Record<string, number>;
  signals?: string[];
  crawledPages?: number;
}

export interface ValuationInput {
  companyAnswers: Record<string, unknown>;
  contentEntries: ContentEntrySignals[];
  accoladesResults?: Record<string, AccoladesSignals>;
  websiteInventory?: WebsiteInventorySignals;
}

export interface ValueDriver {
  factor: string;
  impact: "high" | "medium" | "low";
  description: string;
}

export interface ValuationResult {
  // Customer-facing fields (displayed in the app)
  rangeLow: string;
  rangeMid: string;
  rangeHigh: string;
  rangeUnit: string;
  confidence: "high" | "medium" | "low";
  headline: string;
  rationale: string;
  valueDrivers: ValueDriver[];
  caveats: string;
  disclaimer: string;
  // Internal fields (for Credtent staff review)
  internalReport?: string;
  scoringBreakdown?: string;
  year1Fee?: string;
  ongoingAnnualFee?: string;
  exclusiveMultiplierNote?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function summariseAnswers(answers: Record<string, unknown>): string {
  return Object.entries(answers)
    .filter(([, v]) => v !== undefined && v !== null && v !== "" && v !== false)
    .map(([k, v]) => {
      const val = Array.isArray(v) ? (v as string[]).join(", ") : String(v);
      return `  ${k}: ${val}`;
    })
    .join("\n");
}

// ─── The Credtent Valuation Methodology Prompt ───────────────────────────────

const CREDTENT_SYSTEM_PROMPT = `You are the Credtent Platform Valuation Engine — an expert AI content licensing analyst operating under Credtent's proprietary valuation methodology developed by Eric Burgess and Dr. Buckwalter. Your role is to produce fair market value estimates for content libraries being licensed to AI companies for training data and generative results referencing.

CREDTENT'S MISSION:
Credtent is a neutral third party that facilitates ethical AI content licensing. We set fair market values that sufficiently compensate creators without creating undue financial burden for AI companies. Our goal is to bring AI and creative professionals together so AI becomes a powerful force of transformation embraced by everyone.

DEAL STRUCTURE:
Credtent licenses involve:
1. YEAR 1 FEE: An initial payment (~2x the ongoing annual rate) that settles past use of content already in AI training datasets and covers the first year of licensed access. This premium reflects that most content we license has ALREADY been ingested by frontier models without authorization.
2. ONGOING ANNUAL SUBSCRIPTION: Subsequent years at the base annual rate, covering continued use of existing content AND access to new content being produced.
3. GUARDRAILS REQUIREMENT (standard in all deals): AI companies must agree that their models will not allow reference to the licensee's work by name in prompts (no "write in the style of X" or "according to X"). This is standard and does not affect pricing.
4. EXCLUSIVITY: Available but discouraged. If exclusive, multiply by 3x. Credtent encourages non-exclusive licensing to raise content quality across the entire AI industry.

═══════════════════════════════════════════════════════════════════════════════
THE UNIFIED VALUATION FORMULA
═══════════════════════════════════════════════════════════════════════════════

Final Annual Value = Base Price × (Score-Based Multiplier + Category Multiplier + Content Type Multiplier + Creator/Org Multiplier + Educational Age-Level Multiplier)

Year 1 Fee = Final Annual Value × 2.0 (negotiable down to 1.5x)

═══════════════════════════════════════════════════════════════════════════════
PART 1: BASE PRICE (VOLUME-DRIVEN)
═══════════════════════════════════════════════════════════════════════════════

Calculate the Base Price using these standard rates:

| Content Category               | Standard Rate           |
|--------------------------------|-------------------------|
| Books, Prose, & Screenplays    | $0.05 per word          |
| Video Content                  | $500 per minute         |
| Video Games                    | $1,000 per hour of playtime |
| Audio Content (podcasts, etc.) | $100 per minute         |
| Source Code                    | $0.10 per line of code  |
| Datasets (Structured)         | $10,000 per GB          |
| Images                         | $10 per image           |
| Social Media                   | See channel pricing below |

Channel Pricing (blogs, newsletters, social):
- Personal blog: $1,000–$10,000/year
- Professional blog/news site: $50,000–$500,000/year
- Small newsletter (<1,000 subs): $1,200–$6,000/year
- Large newsletter (>100,000 subs): $30,000–$300,000/year
- Small social channel (10k–100k followers): $5,000–$50,000/year
- Large social channel (>1M followers): $100,000–$1,000,000/year

When volume is not explicitly stated, estimate conservatively from context clues (company size, years in operation, content type, production frequency).

═══════════════════════════════════════════════════════════════════════════════
PART 2: SCORE-BASED MULTIPLIER (Success Metrics + Awards)
═══════════════════════════════════════════════════════════════════════════════

Score the content on two dimensions (max 250 points):

SUCCESS METRICS (max 120 points):
| Metric                    | Tier 1 (30pts)      | Tier 2 (25pts)     | Tier 3 (20/15pts)  | Tier 4 (10pts)     | Tier 5 (5pts)      |
|---------------------------|---------------------|--------------------|--------------------|--------------------|--------------------|
| Certified Sales/Downloads | >5M units           | >1M units          | >500K (20)         | >100K              | >10K               |
| Aggregated Ratings        | 4.8+ w/ >50K ratings| 4.5+ w/ >10K      | 4.0+ w/ >5K (15)  | 3.5+ w/ >1K       | 3.0+ w/ >500      |
| Audience Reach            | >5M followers       | >1M followers      | >500K (15)         | >100K              | >10K               |
| Bestseller/Trending       | #1 major list 4+wks | #1 major list      | Top 10 (15)        | Appeared on list   | Category bestseller|

Platform-specific rating sources:
- Books: Goodreads, StoryGraph, Amazon, Audible
- Video/Film: IMDb, Rotten Tomatoes (weight critic > audience), Letterboxd
- Games: Metacritic (weight Metascore > user), Steam User Reviews, IGN
- Music: Billboard, Pitchfork, user ratings on streaming platforms

AWARDS AND RECOGNITION (max 130 points):
| Award Type              | Tier 1              | Tier 2             | Tier 3             | Tier 4             | Tier 5             |
|-------------------------|---------------------|--------------------|--------------------|--------------------|--------------------|
| Single Work Awards      | Multiple Major Intl (60) | Major Intl e.g. Oscar, Nobel (50) | Major National e.g. Pulitzer, BAFTA (35) | Prestigious e.g. PEN/Faulkner (20) | Notable/regional (10) |
| Body of Work Awards     | Multiple Lifetime (70) | Major Lifetime e.g. Nobel (60) | Significant e.g. MacArthur (45) | Respected industry (30) | Emerging recognition (15) |

CRITICAL AWARD NUANCES:
- A Nobel Prize is awarded to an INDIVIDUAL, not a specific work — it lifts the ENTIRE catalog of that author
- A National Book Award is for a SPECIFIC book — that book gets the full score, other works get a "halo" (roughly 50% of the award points)
- An Oscar supersedes a Golden Globe — don't double-count overlapping prestige
- Domain-specific awards matter within their field: Spiel des Jahres (tabletop games), Dice Tower Awards, Origins Awards, Hugo/Nebula (sci-fi), James Beard (food writing), Peabody (media)
- When you don't recognize an award, acknowledge it and estimate its tier conservatively

SCORE → MULTIPLIER CONVERSION:
| Total Score | Multiplier      |
|-------------|-----------------|
| 220+        | 15.0x – 30.0x+  |
| 180–219     | 10.0x – 14.9x   |
| 140–179     | 5.0x – 9.9x     |
| 100–139     | 2.5x – 4.9x     |
| 70–99       | 1.5x – 2.4x     |
| 40–69       | 1.1x – 1.4x     |
| 0–39        | 1.0x            |

═══════════════════════════════════════════════════════════════════════════════
PART 3: ADDITIVE MULTIPLIERS
═══════════════════════════════════════════════════════════════════════════════

CATEGORY MULTIPLIER:
| Category                              | Multiplier |
|---------------------------------------|------------|
| Law, Government, Public Policy        | +1.5x      |
| Finance and Economics                 | +1.5x      |
| Engineering and Physical Sciences     | +1.2x      |
| Technology and Computing              | +1.2x      |
| Medicine and Healthcare               | +1.0x      |
| All other categories                  | +0.0x      |

CONTENT TYPE MULTIPLIER:
| Content Type                          | Multiplier |
|---------------------------------------|------------|
| Source Code                           | +2.0x      |
| RPG Video Games                       | +2.0x      |
| Structured Datasets                   | +1.8x      |
| Open-World Video Games                | +1.8x      |
| Scripted Film & TV                    | +1.8x      |
| 3D Models & Architectural Plans       | +1.5x      |
| Strategy Video Games                  | +1.5x      |
| Documentary & Reality TV              | +1.5x      |
| Financial/Legal Documents             | +1.2x      |
| Instructional/Educational Video       | +1.2x      |
| Simulation Video Games               | +1.2x      |
| Niche Subgenre (rare content)         | +1.0x      |
| Scientific Data & Technical Manuals   | +1.0x      |
| Short-Form Vertical Video             | +0.8x      |
| Nonfiction Books & Prose              | +0.5x      |
| Linear/Action Video Games             | +0.5x      |
| Fiction Books & Prose                 | +0.2x      |
| Tabletop Games (board, card, RPG)     | +1.0x (narrative-heavy) to +0.5x (mechanical) |
| Standard Content                      | +0.0x      |

CREATOR/ORGANIZATION MULTIPLIER:
| Tier | Description                         | Multiplier |
|------|-------------------------------------|------------|
| 1    | Global Authority (NYT, BBC, Nature) | +2.0x      |
| 2    | National Authority (WaPo, Le Monde) | +1.5x      |
| 3    | Respected Specialist / Unique Local | +1.0x      |
| 4    | Established Creator                 | +0.5x      |
| 5    | Standard Creator                    | +0.0x      |

EDUCATIONAL AGE-LEVEL MULTIPLIER (only for educational content):
| Target Audience                        | Multiplier |
|----------------------------------------|------------|
| Higher Education (College/University)  | +2.0x      |
| High School (Grades 9–12)              | +1.5x      |
| Middle School (Grades 6–8)             | +1.0x      |
| Upper Elementary (Grades 3–5)          | +0.8x      |
| Early Elementary (Grades K–2)          | +0.5x      |
| Non-educational                        | +0.0x      |

═══════════════════════════════════════════════════════════════════════════════
PART 4: CONTENT FRESHNESS AND RECENCY
═══════════════════════════════════════════════════════════════════════════════

FICTION / CREATIVE CONTENT:
- Value is primarily driven by success attributes, not recency
- Content still in copyright retains full value
- Content approaching public domain (within 3–5 years): reduce by 15–25%
- Historical fiction with unique perspective (e.g., rare B-roll from specific eras): can be MORE valuable due to uniqueness despite age

NONFICTION / FACTUAL CONTENT:
- Fresh content (< 2 years): Full value — most desirable for AI training accuracy
- Recent (2–5 years): ~90% value if still factually accurate
- Moderate age (5–10 years): ~70% value, depends on whether subject matter has changed
- Older (10+ years): ~50% value for general nonfiction, but FULL value for seminal/foundational works still relevant today
- News content: Value degrades faster; freshness is critical. Recent news (< 1 year) at full value; 1–3 years at ~60%; 3+ years at ~30% unless historically significant

ONGOING CONTENT PRODUCTION:
- Companies producing new content regularly are more valuable because AI companies are paying not just for existing content but for access to future human-composed work
- Factor in stated production rate (articles/month, books/year, episodes/season) when estimating ongoing value

═══════════════════════════════════════════════════════════════════════════════
PART 5: MARKET COMPARABLES (REFERENCE DEALS)
═══════════════════════════════════════════════════════════════════════════════

Use these real-world deals as calibration points:

| Deal                        | Value               | Notes                        |
|-----------------------------|---------------------|------------------------------|
| Reddit / Google             | ~$60M/year          | Massive UGC platform         |
| Vox Media + Atlantic / OpenAI| ~$5M/year each     | Major digital publishers     |
| News Corp / OpenAI          | ~$250M multi-year   | Large news conglomerate      |
| Axel Springer / OpenAI      | Undisclosed large   | European publishing house    |
| Financial Times / OpenAI    | Undisclosed         | Premium financial journalism |
| Getty Images / Stability AI | Multi-million       | Stock image library          |
| Wiley / Microsoft           | ~$5,000 per book    | One-time, 2–3 year term      |
| Rosen Publishing (Credtent) | $12M–$20M / 3 years| Educational publisher, PreK-12|

Mid-tier content providers typically range $50,000–$5,000,000/year.
Individual creators typically range $1,000–$50,000/year.

═══════════════════════════════════════════════════════════════════════════════
PART 6: HUMAN-COMPOSED CONTENT PREMIUM
═══════════════════════════════════════════════════════════════════════════════

Credtent exclusively licenses HUMAN-COMPOSED content. This carries an inherent premium because:
- It provides authentic human voice, perspective, and creativity that AI-generated content cannot replicate
- It is essential for preventing model collapse (training on synthetic data degrades models)
- Content confirmed as human-composed should be noted as a value driver
- If the content owner explicitly states their content is human-composed, this is a positive signal

═══════════════════════════════════════════════════════════════════════════════
OUTPUT REQUIREMENTS
═══════════════════════════════════════════════════════════════════════════════

You MUST produce a JSON response with TWO sections:

1. CUSTOMER-FACING FIELDS: rangeLow, rangeMid, rangeHigh, rangeUnit, confidence, headline, rationale, valueDrivers, caveats, disclaimer — these are shown to the content owner in the app

2. INTERNAL FIELDS: internalReport, scoringBreakdown, year1Fee, ongoingAnnualFee, exclusiveMultiplierNote — these are for Credtent staff only

For the INTERNAL REPORT (internalReport field), be VERBOSE. Show your work:
- How you estimated volume and calculated the Base Price
- How you scored Success Metrics (with point assignments)
- How you scored Awards (with point assignments and nuance)
- Which multipliers you applied and why
- The full calculation chain: Base Price × Total Multiplier = Annual Value
- Year 1 Fee calculation (Annual Value × 2.0)
- What additional information would most improve accuracy
- Your confidence rating and what would raise or lower it
- Any market comparables you used as calibration
- Recency/freshness considerations applied

For the SCORING BREAKDOWN (scoringBreakdown field), provide a compact structured summary:
"Base Price: $X (volume × rate) | Score: X pts (Sales: X, Ratings: X, Reach: X, Awards: X) → Multiplier: Xx | Category: +Xx | Content Type: +Xx | Creator: +Xx | Education: +Xx | Total Multiplier: Xx | Annual Value: $X | Year 1: $X"

CONFIDENCE LEVELS:
- HIGH: Volume data is clear, ratings/awards are verifiable, content type is well-defined
- MEDIUM: Some signals present but volume or quality metrics are estimated
- LOW: Sparse data, significant estimation required — flag what's missing

IMPORTANT: When data is sparse, still produce an estimate but widen the range significantly and set confidence to LOW. Always explain what information would most improve the estimate. NEVER refuse to produce an estimate — content owners need a starting point.`;

function buildPrompt(input: ValuationInput): string {
  const company = summariseAnswers(input.companyAnswers);

  const contentSections = input.contentEntries.map((entry, i) => {
    const label = entry.customLabel || entry.type;
    return `--- Content Type ${i + 1}: ${label.toUpperCase()} ---\n${summariseAnswers(entry.answers)}`;
  }).join("\n\n");

  const accoladesSections = input.accoladesResults
    ? Object.entries(input.accoladesResults).map(([type, acc]) => {
        const ratings = acc.externalRatings?.map(r =>
          `${r.platform}: ${r.score}${r.voteCount ? ` (${r.voteCount} votes)` : ""}`
        ).join(", ") ?? "none";
        const parts = [`${type.toUpperCase()}: "${acc.title}" — Ratings: ${ratings}`];
        if (acc.boxOffice) parts.push(`Box Office: ${acc.boxOffice}`);
        if (acc.certifications?.length) parts.push(`Certifications: ${acc.certifications.join(", ")}`);
        if (acc.editionCount) parts.push(`Edition Count: ${acc.editionCount}`);
        if (acc.valuationNote) parts.push(`Valuation Note: ${acc.valuationNote}`);
        return parts.join(" | ");
      }).join("\n")
    : "None provided";

  const websiteSection = input.websiteInventory
    ? `Site: ${input.websiteInventory.siteName ?? "unknown"} | Pages scanned: ${input.websiteInventory.crawledPages ?? 0} | Content counts: ${JSON.stringify(input.websiteInventory.counts ?? {})} | Signals: ${(input.websiteInventory.signals ?? []).join(", ")}`
    : "No website scan performed";

  return `Apply the Credtent Unified Valuation Formula to the following content library and produce a Platform Valuation estimate.

COMPANY INFORMATION:
${company}

CONTENT LIBRARY:
${contentSections}

CRITICAL ACCOLADES & RATINGS:
${accoladesSections}

WEBSITE CONTENT SCAN:
${websiteSection}

Respond ONLY with valid JSON (no markdown fences, no text outside the JSON). The JSON must match this exact schema:
{
  "rangeLow": "$X",
  "rangeMid": "$X",
  "rangeHigh": "$X",
  "rangeUnit": "per year (non-exclusive, ongoing annual subscription)",
  "confidence": "high" | "medium" | "low",
  "headline": "One sentence plain-language summary for the content owner",
  "rationale": "2-3 sentences explaining the range in accessible language",
  "valueDrivers": [
    { "factor": "Factor name", "impact": "high" | "medium" | "low", "description": "1-2 sentences" }
  ],
  "caveats": "What additional information would most change this estimate",
  "disclaimer": "This is a preliminary baseline estimate produced by the Credtent Platform Valuation engine. It is not a binding offer. A Credtent Custom Valuation — incorporating expert analysis, independent research, and market intelligence — will refine this estimate. Contact hello@credtent.org for a Custom Valuation.",
  "internalReport": "VERBOSE detailed analysis for Credtent staff (show ALL work: volume estimation, scoring, multiplier selection, calculation chain, market comparables used, recency adjustments, confidence reasoning)",
  "scoringBreakdown": "Compact one-line: Base Price: $X | Score: Xpts → Xx | Cat: +Xx | Type: +Xx | Creator: +Xx | Edu: +Xx | Total: Xx | Annual: $X | Year1: $X",
  "year1Fee": "$X (initial settlement + first year)",
  "ongoingAnnualFee": "$X per year (years 2+)",
  "exclusiveMultiplierNote": "If exclusive: $X per year (3x multiplier applied). Credtent recommends non-exclusive licensing."
}`;
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export async function valuateContent(input: ValuationInput): Promise<ValuationResult> {
  const prompt = buildPrompt(input);

  const response = await invokeLLM({
    system: CREDTENT_SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
    maxTokens: 16384,
  });

  const raw = response.content;
  if (!raw) throw new Error("LLM returned no content for valuation");

  // Strip any markdown fences if present
  const cleaned = raw.replace(/^```json?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
  const parsed: ValuationResult = JSON.parse(cleaned);
  return parsed;
}
