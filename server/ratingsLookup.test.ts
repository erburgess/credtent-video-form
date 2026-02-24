/**
 * Tests for the ratingsLookup module.
 * Uses real OMDB API calls when OMDB_API_KEY is set; otherwise tests the
 * fallback/LLM-only path with a mock.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { config } from "dotenv";
config();

// We mock invokeLLM so tests don't require a live LLM in CI
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [
      {
        message: {
          content: JSON.stringify({
            externalRatings: [],
            boxOffice: null,
            certifications: ["Academy Award Winner"],
            editionCount: null,
            valuationNote:
              "This content has strong critical standing and significant award recognition, which meaningfully increases its value for AI training licensing.",
          }),
        },
      },
    ],
  }),
}));

import { lookupAccolades } from "./ratingsLookup";

const OMDB_KEY = process.env.OMDB_API_KEY ?? "";

describe("lookupAccolades", () => {
  it("returns a structured result with a valuationNote for a known film", async () => {
    const result = await lookupAccolades({
      title: "The Godfather",
      kind: "film",
      omdbApiKey: OMDB_KEY,
      userAccolades: "Won Academy Award for Best Picture",
    });

    expect(result).toBeDefined();
    expect(result.title).toBe("The Godfather");
    expect(result.kind).toBe("film");
    expect(typeof result.valuationNote).toBe("string");
    expect(result.valuationNote.length).toBeGreaterThan(10);
  }, 15000);

  it("returns external ratings from OMDB when key is available", async () => {
    if (!OMDB_KEY) return; // skip if no key

    const result = await lookupAccolades({
      title: "The Godfather",
      kind: "film",
      omdbApiKey: OMDB_KEY,
    });

    expect(result.externalRatings).toBeDefined();
    expect(Array.isArray(result.externalRatings)).toBe(true);
    // OMDB should return at least an IMDb rating
    const imdb = result.externalRatings.find((r) =>
      r.platform.toLowerCase().includes("imdb")
    );
    expect(imdb).toBeDefined();
    expect(imdb?.score).toBeTruthy();
  }, 15000);

  it("handles a written/book lookup gracefully", async () => {
    const result = await lookupAccolades({
      title: "To Kill a Mockingbird",
      kind: "written",
      author: "Harper Lee",
      omdbApiKey: OMDB_KEY,
    });

    expect(result).toBeDefined();
    expect(result.title).toBe("To Kill a Mockingbird");
    expect(typeof result.valuationNote).toBe("string");
  }, 15000);

  it("returns a result even when title is not found externally", async () => {
    const result = await lookupAccolades({
      title: "Completely Unknown Obscure Title XYZ123",
      kind: "other",
      omdbApiKey: OMDB_KEY,
    });

    expect(result).toBeDefined();
    expect(typeof result.valuationNote).toBe("string");
  }, 15000);
});
