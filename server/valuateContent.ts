/**
 * valuateContent.ts
 *
 * Uses the LLM to synthesize all collected signals from a completed content
 * assessment into a preliminary AI training licensing value range, a confidence
 * level, and a ranked breakdown of the key value drivers.
 *
 * The output is intentionally framed as a *preliminary estimate* — not a
 * binding offer — and uses plain language accessible to non-technical users.
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
  rangeLow: string;       // e.g. "$250,000"
  rangeMid: string;       // e.g. "$750,000"
  rangeHigh: string;      // e.g. "$2,000,000"
  rangeUnit: string;      // e.g. "per year" or "one-time"
  confidence: "high" | "medium" | "low";
  headline: string;       // One-sentence summary, plain language
  rationale: string;      // 2-3 sentence explanation for the range
  valueDrivers: ValueDriver[];
  caveats: string;        // What could change the estimate
  disclaimer: string;     // Standard disclaimer
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

function buildPrompt(input: ValuationInput): string {
  const company = summariseAnswers(input.companyAnswers);

  const contentSections = input.contentEntries.map((entry, i) => {
    const label = entry.customLabel || entry.type;
    return `--- Content Type ${i + 1}: ${label.toUpperCase()} ---\n${summariseAnswers(entry.answers)}`;
  }).join("\n\n");

  const accoladesSections = input.accoladesResults
    ? Object.entries(input.accoladesResults).map(([type, acc]) => {
        const ratings = acc.externalRatings?.map(r => `${r.platform}: ${r.score}${r.voteCount ? ` (${r.voteCount} votes)` : ""}`).join(", ") ?? "none";
        return `${type.toUpperCase()}: "${acc.title}" — Ratings: ${ratings}${acc.boxOffice ? ` | Box Office: ${acc.boxOffice}` : ""}${acc.certifications?.length ? ` | Certifications: ${acc.certifications.join(", ")}` : ""}`;
      }).join("\n")
    : "None provided";

  const websiteSection = input.websiteInventory
    ? `Site: ${input.websiteInventory.siteName ?? "unknown"} | Pages scanned: ${input.websiteInventory.crawledPages ?? 0} | Content counts: ${JSON.stringify(input.websiteInventory.counts ?? {})} | Signals: ${(input.websiteInventory.signals ?? []).join(", ")}`
    : "No website scan performed";

  return `You are an expert content licensing advisor specializing in AI training data markets. Your task is to produce a preliminary licensing value range for a content library based on the signals below.

CONTEXT:
The content owner is exploring licensing their content to AI companies for use in training large language models and other AI systems. The value is determined by factors including: volume, uniqueness/rarity, subject matter depth, quality signals (awards, ratings), exclusivity, diversity (languages, demographics), and the current market demand for that type of content.

IMPORTANT GUIDELINES:
- Express all values in USD
- Provide a range (low / mid / high) representing annual licensing fees OR a one-time acquisition price — choose whichever is more appropriate given the content type and volume
- Be realistic: most content libraries are worth $50,000–$5,000,000 per year for AI training; only truly exceptional, massive, or uniquely rare collections exceed this
- Use plain, friendly language — the recipient is a content owner, not a data scientist
- Be honest about uncertainty — if signals are sparse, say so and lower confidence accordingly
- Identify 3–6 specific value drivers ranked by impact (high/medium/low)
- Note what additional information would most change the estimate

COMPANY INFORMATION:
${company}

CONTENT LIBRARY SIGNALS:
${contentSections}

CRITICAL ACCOLADES & RATINGS:
${accoladesSections}

WEBSITE CONTENT SCAN:
${websiteSection}

Respond ONLY with valid JSON matching this exact schema (no markdown, no explanation outside the JSON):
{
  "rangeLow": "$X",
  "rangeMid": "$X",
  "rangeHigh": "$X",
  "rangeUnit": "per year" or "one-time",
  "confidence": "high" | "medium" | "low",
  "headline": "One sentence plain-language summary of the estimate",
  "rationale": "2-3 sentences explaining the range",
  "valueDrivers": [
    { "factor": "Factor name", "impact": "high" | "medium" | "low", "description": "1 sentence" }
  ],
  "caveats": "What information would most change this estimate",
  "disclaimer": "This is a preliminary estimate for discussion purposes only and does not constitute a binding offer or legal advice."
}`;
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export async function valuateContent(input: ValuationInput): Promise<ValuationResult> {
  const prompt = buildPrompt(input);

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: "You are an expert content licensing advisor. Always respond with valid JSON only — no markdown fences, no preamble.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "valuation_result",
        strict: true,
        schema: {
          type: "object",
          properties: {
            rangeLow:     { type: "string" },
            rangeMid:     { type: "string" },
            rangeHigh:    { type: "string" },
            rangeUnit:    { type: "string" },
            confidence:   { type: "string", enum: ["high", "medium", "low"] },
            headline:     { type: "string" },
            rationale:    { type: "string" },
            valueDrivers: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  factor:      { type: "string" },
                  impact:      { type: "string", enum: ["high", "medium", "low"] },
                  description: { type: "string" },
                },
                required: ["factor", "impact", "description"],
                additionalProperties: false,
              },
            },
            caveats:    { type: "string" },
            disclaimer: { type: "string" },
          },
          required: ["rangeLow", "rangeMid", "rangeHigh", "rangeUnit", "confidence", "headline", "rationale", "valueDrivers", "caveats", "disclaimer"],
          additionalProperties: false,
        },
      },
    },
  });

  const raw = response.choices?.[0]?.message?.content;
  if (!raw) throw new Error("LLM returned no content for valuation");

  const parsed: ValuationResult = typeof raw === "string" ? JSON.parse(raw) : raw;
  return parsed;
}
