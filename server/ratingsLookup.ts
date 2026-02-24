/**
 * Ratings Lookup Module
 *
 * Fetches publicly available critical ratings and commercial data for content titles.
 *
 * Sources:
 *   - OMDb API (film, TV series, video) — IMDB rating, Rotten Tomatoes, Metacritic, box office
 *   - Open Library Search API (books) — edition count, ratings, review count
 *   - LLM synthesis — combines user-provided accolades with fetched data into a valuation note
 */

import { invokeLLM } from "./_core/llm";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ContentKind = "film" | "video" | "written" | "audio" | "other";

export interface RatingsSource {
  platform: string;
  score: string;
  voteCount?: string;
  url?: string;
}

export interface AccoladesLookupResult {
  title: string;
  kind: ContentKind;
  year?: string;
  // Fetched external data
  externalRatings: RatingsSource[];
  boxOffice?: string;
  certifications?: string[];
  editionCount?: number;   // books
  // LLM synthesis
  valuationNote: string;   // plain-language note for the valuation
  rawData?: Record<string, unknown>;
  error?: string;
}

// ── OMDb lookup (film / TV / video) ──────────────────────────────────────────

interface OmdbRating {
  Source: string;
  Value: string;
}

interface OmdbResponse {
  Response: "True" | "False";
  Error?: string;
  Title?: string;
  Year?: string;
  Rated?: string;
  imdbRating?: string;
  imdbVotes?: string;
  imdbID?: string;
  Ratings?: OmdbRating[];
  BoxOffice?: string;
  Awards?: string;
  Metascore?: string;
  Genre?: string;
  Type?: string;
}

async function lookupOmdb(
  title: string,
  year: string | undefined,
  apiKey: string,
): Promise<{ ratings: RatingsSource[]; boxOffice?: string; awards?: string; raw: OmdbResponse | null }> {
  try {
    const params = new URLSearchParams({ t: title, apikey: apiKey, plot: "short" });
    if (year) params.set("y", year);
    const res = await fetch(`https://www.omdbapi.com/?${params.toString()}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { ratings: [], raw: null };
    const data = (await res.json()) as OmdbResponse;
    if (data.Response !== "True" || !data.Title) return { ratings: [], raw: data };

    const ratings: RatingsSource[] = [];

    // IMDB
    if (data.imdbRating && data.imdbRating !== "N/A") {
      ratings.push({
        platform: "IMDb",
        score: `${data.imdbRating}/10`,
        voteCount: data.imdbVotes !== "N/A" ? data.imdbVotes : undefined,
        url: data.imdbID ? `https://www.imdb.com/title/${data.imdbID}/` : undefined,
      });
    }

    // Rotten Tomatoes / Metacritic from Ratings array
    for (const r of data.Ratings ?? []) {
      if (r.Source === "Rotten Tomatoes") {
        ratings.push({ platform: "Rotten Tomatoes", score: r.Value });
      } else if (r.Source === "Metacritic") {
        ratings.push({ platform: "Metacritic", score: r.Value });
      }
    }

    return {
      ratings,
      boxOffice: data.BoxOffice !== "N/A" ? data.BoxOffice : undefined,
      awards: data.Awards !== "N/A" ? data.Awards : undefined,
      raw: data,
    };
  } catch {
    return { ratings: [], raw: null };
  }
}

// ── Open Library lookup (books) ───────────────────────────────────────────────

interface OLDoc {
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  edition_count?: number;
  ratings_average?: number;
  ratings_count?: number;
  want_to_read_count?: number;
  currently_reading_count?: number;
  already_read_count?: number;
}

interface OLSearchResponse {
  numFound: number;
  docs: OLDoc[];
}

async function lookupOpenLibrary(
  title: string,
  author?: string,
): Promise<{ ratings: RatingsSource[]; editionCount?: number; raw: OLDoc | null }> {
  try {
    const q = author ? `${title} ${author}` : title;
    const params = new URLSearchParams({
      q,
      fields: "title,author_name,first_publish_year,edition_count,ratings_average,ratings_count",
      limit: "3",
    });
    const res = await fetch(`https://openlibrary.org/search.json?${params.toString()}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { ratings: [], raw: null };
    const data = (await res.json()) as OLSearchResponse;
    const doc = data.docs?.[0];
    if (!doc) return { ratings: [], raw: null };

    const ratings: RatingsSource[] = [];
    if (doc.ratings_average && doc.ratings_count && doc.ratings_count > 0) {
      ratings.push({
        platform: "Open Library",
        score: `${doc.ratings_average.toFixed(1)}/5`,
        voteCount: `${doc.ratings_count.toLocaleString()} ratings`,
        url: `https://openlibrary.org/search?q=${encodeURIComponent(title)}`,
      });
    }

    return { ratings, editionCount: doc.edition_count, raw: doc };
  } catch {
    return { ratings: [], raw: null };
  }
}

// ── LLM synthesis ─────────────────────────────────────────────────────────────

async function synthesizeValuationNote(
  title: string,
  kind: ContentKind,
  userAccolades: string,
  externalRatings: RatingsSource[],
  boxOffice?: string,
  awards?: string,
  editionCount?: number,
): Promise<string> {
  const ratingsSummary = externalRatings.length > 0
    ? externalRatings.map((r) => `${r.platform}: ${r.score}${r.voteCount ? ` (${r.voteCount})` : ""}`).join("; ")
    : "No external ratings found";

  const prompt = `You are a content valuation analyst. Write a concise 2–3 sentence valuation note about the commercial and critical standing of the following content, to be included in an AI training data licensing assessment. Be factual, professional, and focus on what the ratings and accolades signal about the content's quality and market value.

Title: "${title}"
Content type: ${kind}
User-provided accolades: ${userAccolades || "None provided"}
External ratings found: ${ratingsSummary}
${boxOffice ? `Box office: ${boxOffice}` : ""}
${awards ? `Awards/recognition: ${awards}` : ""}
${editionCount ? `Published editions: ${editionCount}` : ""}

Write only the valuation note, no preamble or labels.`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are a professional content valuation analyst specializing in AI training data licensing." },
        { role: "user", content: prompt },
      ],
    });
    const content = response.choices?.[0]?.message?.content;
    return typeof content === "string" ? content.trim() : "";
  } catch {
    return "";
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

export interface AccoladesLookupInput {
  title: string;
  kind: ContentKind;
  year?: string;
  author?: string;         // for books
  userAccolades?: string;  // free-text from the user
  omdbApiKey?: string;
}

export async function lookupAccolades(input: AccoladesLookupInput): Promise<AccoladesLookupResult> {
  const { title, kind, year, author, userAccolades = "", omdbApiKey = "" } = input;

  let externalRatings: RatingsSource[] = [];
  let boxOffice: string | undefined;
  let awards: string | undefined;
  let editionCount: number | undefined;
  let rawData: Record<string, unknown> = {};

  // Film / video / TV → OMDb
  if ((kind === "film" || kind === "video") && omdbApiKey) {
    const omdb = await lookupOmdb(title, year, omdbApiKey);
    externalRatings = omdb.ratings;
    boxOffice = omdb.boxOffice;
    awards = omdb.awards;
    if (omdb.raw) rawData.omdb = omdb.raw;
  }

  // Books → Open Library
  if (kind === "written") {
    const ol = await lookupOpenLibrary(title, author);
    externalRatings = [...externalRatings, ...ol.ratings];
    editionCount = ol.editionCount;
    if (ol.raw) rawData.openLibrary = ol.raw;
  }

  // Synthesize valuation note via LLM
  const valuationNote = await synthesizeValuationNote(
    title, kind, userAccolades, externalRatings, boxOffice, awards, editionCount,
  );

  return {
    title,
    kind,
    year,
    externalRatings,
    boxOffice,
    certifications: awards ? [awards] : undefined,
    editionCount,
    valuationNote,
    rawData: Object.keys(rawData).length > 0 ? rawData : undefined,
  };
}
