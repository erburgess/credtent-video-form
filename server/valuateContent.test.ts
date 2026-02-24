/**
 * valuateContent.test.ts
 *
 * Tests for the content valuation module.
 * Uses mocked LLM responses to avoid live API calls.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { valuateContent, type ValuationInput } from "./valuateContent";

// ─── Mock the LLM helper ──────────────────────────────────────────────────────

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

import { invokeLLM } from "./_core/llm";
const mockInvokeLLM = vi.mocked(invokeLLM);

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_VALUATION_RESPONSE = {
  rangeLow: "$100,000",
  rangeMid: "$500,000",
  rangeHigh: "$1,500,000",
  rangeUnit: "per year",
  confidence: "medium" as const,
  headline: "A mid-sized written content library with moderate uniqueness and some critical recognition.",
  rationale: "The library covers 50,000 articles across multiple topics with good language diversity. The moderate exclusivity and some awards recognition support a mid-range estimate.",
  valueDrivers: [
    { factor: "Content Volume", impact: "high" as const, description: "50,000 articles represents a substantial training dataset." },
    { factor: "Language Diversity", impact: "medium" as const, description: "Content in 3 languages increases training utility." },
    { factor: "Awards Recognition", impact: "medium" as const, description: "Industry awards signal quality and credibility." },
  ],
  caveats: "Providing exact word counts and confirming full IP ownership would significantly improve confidence.",
  disclaimer: "This is a preliminary estimate for discussion purposes only and does not constitute a binding offer or legal advice.",
};

const BASE_INPUT: ValuationInput = {
  companyAnswers: {
    companyName: "Test Media Corp",
    contactName: "Jane Doe",
    contactEmail: "jane@testmedia.com",
  },
  contentEntries: [
    {
      type: "written",
      answers: {
        writtenFormats: ["Blog posts", "Journalism/news articles"],
        writtenWordCount: "50,000 articles",
        contentUniqueness: "Mostly proprietary",
        subjectMatters: "Technology, business, culture",
        languageCoverage: ["English only"],
      },
    },
  ],
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("valuateContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvokeLLM.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify(MOCK_VALUATION_RESPONSE),
          },
        },
      ],
    } as Awaited<ReturnType<typeof invokeLLM>>);
  });

  it("returns a structured valuation result for a basic written content input", async () => {
    const result = await valuateContent(BASE_INPUT);

    expect(result.rangeLow).toBe("$100,000");
    expect(result.rangeMid).toBe("$500,000");
    expect(result.rangeHigh).toBe("$1,500,000");
    expect(result.rangeUnit).toBe("per year");
    expect(result.confidence).toBe("medium");
    expect(result.headline).toBeTruthy();
    expect(result.rationale).toBeTruthy();
    expect(result.valueDrivers).toHaveLength(3);
    expect(result.disclaimer).toBeTruthy();
  });

  it("includes accolades signals in the LLM prompt", async () => {
    const inputWithAccolades: ValuationInput = {
      ...BASE_INPUT,
      accoladesResults: {
        written: {
          title: "The Great Novel",
          kind: "written",
          externalRatings: [
            { platform: "Goodreads", score: "4.5/5", voteCount: "12,000 ratings" },
          ],
          certifications: ["New York Times Bestseller"],
        },
      },
    };

    await valuateContent(inputWithAccolades);

    const callArgs = mockInvokeLLM.mock.calls[0][0];
    const userMessage = callArgs.messages.find((m) => m.role === "user");
    expect(userMessage?.content).toContain("The Great Novel");
    expect(userMessage?.content).toContain("Goodreads");
    expect(userMessage?.content).toContain("New York Times Bestseller");
  });

  it("includes website inventory signals in the LLM prompt", async () => {
    const inputWithWebsite: ValuationInput = {
      ...BASE_INPUT,
      websiteInventory: {
        siteName: "TestMedia.com",
        counts: { written: 4200, audio: 87 },
        signals: ["Has RSS feed", "Has sitemap"],
        crawledPages: 150,
      },
    };

    await valuateContent(inputWithWebsite);

    const callArgs = mockInvokeLLM.mock.calls[0][0];
    const userMessage = callArgs.messages.find((m) => m.role === "user");
    expect(userMessage?.content).toContain("TestMedia.com");
    expect(userMessage?.content).toContain("150");
  });

  it("handles multiple content types in the prompt", async () => {
    const multiTypeInput: ValuationInput = {
      ...BASE_INPUT,
      contentEntries: [
        { type: "written", answers: { writtenWordCount: "10,000 articles" } },
        { type: "video", answers: { totalVolume: "500 hours", resolution: ["4K"] } },
        { type: "audio", answers: { audioFormats: ["Podcasts"], audioQuality: "Studio quality (lossless)" } },
      ],
    };

    await valuateContent(multiTypeInput);

    const callArgs = mockInvokeLLM.mock.calls[0][0];
    const userMessage = callArgs.messages.find((m) => m.role === "user");
    expect(userMessage?.content).toContain("WRITTEN");
    expect(userMessage?.content).toContain("VIDEO");
    expect(userMessage?.content).toContain("AUDIO");
  });

  it("throws an error when the LLM returns no content", async () => {
    mockInvokeLLM.mockResolvedValue({
      choices: [{ message: { content: null } }],
    } as unknown as Awaited<ReturnType<typeof invokeLLM>>);

    await expect(valuateContent(BASE_INPUT)).rejects.toThrow("LLM returned no content for valuation");
  });

  it("uses json_schema response format in the LLM call", async () => {
    await valuateContent(BASE_INPUT);

    const callArgs = mockInvokeLLM.mock.calls[0][0];
    expect(callArgs.response_format?.type).toBe("json_schema");
    expect(callArgs.response_format?.json_schema?.name).toBe("valuation_result");
  });

  it("includes value drivers with correct structure", async () => {
    const result = await valuateContent(BASE_INPUT);

    for (const driver of result.valueDrivers) {
      expect(driver.factor).toBeTruthy();
      expect(["high", "medium", "low"]).toContain(driver.impact);
      expect(driver.description).toBeTruthy();
    }
  });

  it("handles empty accolades gracefully", async () => {
    const inputNoAccolades: ValuationInput = {
      ...BASE_INPUT,
      accoladesResults: {},
    };

    const result = await valuateContent(inputNoAccolades);
    expect(result.rangeMid).toBeTruthy();
  });
});
