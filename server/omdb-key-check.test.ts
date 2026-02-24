/**
 * Quick smoke test to verify the OMDB_API_KEY is valid.
 * Makes a real network call to OMDb for a well-known title.
 * Skipped if OMDB_API_KEY is not set.
 */
import { describe, it, expect } from "vitest";
import { config } from "dotenv";
config();

const OMDB_KEY = process.env.OMDB_API_KEY ?? "";

describe.skipIf(!OMDB_KEY)("OMDB API key validation", () => {
  it("returns a valid result for a known title (The Godfather)", async () => {
    const res = await fetch(
      `https://www.omdbapi.com/?t=The+Godfather&apikey=${OMDB_KEY}`,
    );
    expect(res.ok).toBe(true);
    const data = (await res.json()) as { Response: string; imdbRating?: string; Title?: string };
    expect(data.Response).toBe("True");
    expect(data.Title).toContain("Godfather");
    expect(data.imdbRating).toBeTruthy();
  }, 10000);
});
