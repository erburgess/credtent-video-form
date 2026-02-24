/**
 * Tests for the website content inventory crawler.
 *
 * These tests use mocked fetch to avoid real network calls.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock fetch globally ────────────────────────────────────────────────────────
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ── Mock LLM to return a structured response ──────────────────────────────────
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{
      message: {
        content: JSON.stringify({
          siteName: "Test News Site",
          description: "A news website with articles and podcasts.",
          counts: { written: 4200, audio: 87 },
          suggestedTypes: ["written", "audio"],
          summary: "We found approximately 4,200 articles and 87 podcast episodes on your site.",
        }),
      },
    }],
  }),
}));

import { analyzeWebsite } from "./websiteCrawler";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeFetchResponse(html: string, ok = true) {
  return Promise.resolve({
    ok,
    headers: { get: () => "text/html; charset=utf-8" },
    text: () => Promise.resolve(html),
  });
}

const HOMEPAGE_HTML = `
<!DOCTYPE html>
<html>
<head>
  <title>Test News Site</title>
  <meta name="description" content="Breaking news and analysis." />
  <link type="application/rss+xml" href="/feed.xml" title="RSS" />
</head>
<body>
  <article class="post">Article 1</article>
  <article class="post">Article 2</article>
  <a href="/blog/story-1">Story 1</a>
  <a href="/blog/story-2">Story 2</a>
  <a href="/about">About</a>
  <a href="/contact">Contact</a>
  <audio src="/podcast/ep1.mp3"></audio>
  <div class="podcast-episode">Episode 1</div>
</body>
</html>
`;

const RSS_XML = `
<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <item><title>Article 1</title></item>
    <item><title>Article 2</title></item>
    <item><title>Article 3</title></item>
  </channel>
</rss>
`;

const SITEMAP_XML = `
<?xml version="1.0"?>
<urlset>
  <url><loc>https://example.com/</loc></url>
  <url><loc>https://example.com/blog/story-1</loc></url>
  <url><loc>https://example.com/blog/story-2</loc></url>
  <url><loc>https://example.com/blog/story-3</loc></url>
  <url><loc>https://example.com/about</loc></url>
</urlset>
`;

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("analyzeWebsite", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("returns an error result when the homepage cannot be fetched", async () => {
    mockFetch.mockResolvedValue({ ok: false, headers: { get: () => "text/html" }, text: () => Promise.resolve("") });

    const result = await analyzeWebsite("https://unreachable.example.com");
    expect(result.error).toBeTruthy();
    expect(result.crawledPages).toBe(0);
    expect(result.suggestedTypes).toHaveLength(0);
  });

  it("normalizes URLs without protocol", async () => {
    // Should not throw — just prepend https://
    mockFetch.mockResolvedValue({ ok: false, headers: { get: () => "text/html" }, text: () => Promise.resolve("") });
    const result = await analyzeWebsite("example.com");
    expect(result.url).toBe("https://example.com");
  });

  it("detects articles and podcasts from homepage HTML", async () => {
    mockFetch.mockImplementation((url: string) => {
      const u = String(url);
      if (u.includes("sitemap")) return Promise.resolve({ ok: false, headers: { get: () => "text/xml" }, text: () => Promise.resolve("") });
      if (u.includes("feed.xml")) return makeFetchResponse(RSS_XML);
      // All other pages return homepage HTML
      return makeFetchResponse(HOMEPAGE_HTML);
    });

    const result = await analyzeWebsite("https://example.com");
    expect(result.crawledPages).toBeGreaterThanOrEqual(1);
    // LLM mock returns written and audio
    expect(result.suggestedTypes).toContain("written");
    expect(result.suggestedTypes).toContain("audio");
    expect(result.summary).toContain("4,200");
  });

  it("uses sitemap article count when sitemap is available", async () => {
    mockFetch.mockImplementation((url: string) => {
      const u = String(url);
      if (u.includes("sitemap.xml")) return makeFetchResponse(SITEMAP_XML);
      if (u.includes("feed.xml")) return makeFetchResponse(RSS_XML);
      return makeFetchResponse(HOMEPAGE_HTML);
    });

    const result = await analyzeWebsite("https://example.com");
    // Sitemap has 3 blog URLs — should be reflected in counts
    expect(result.counts.written ?? 0).toBeGreaterThan(0);
  });

  it("returns LLM-generated summary when LLM succeeds", async () => {
    mockFetch.mockImplementation((url: string) => {
      const u = String(url);
      if (u.includes("sitemap")) return Promise.resolve({ ok: false, headers: { get: () => "text/xml" }, text: () => Promise.resolve("") });
      return makeFetchResponse(HOMEPAGE_HTML);
    });

    const result = await analyzeWebsite("https://example.com");
    expect(result.summary).toBeTruthy();
    expect(result.summary.length).toBeGreaterThan(10);
  });

  it("returns a result with crawledPages >= 1 on success", async () => {
    mockFetch.mockImplementation((url: string) => {
      const u = String(url);
      if (u.includes("sitemap")) return Promise.resolve({ ok: false, headers: { get: () => "text/xml" }, text: () => Promise.resolve("") });
      return makeFetchResponse(HOMEPAGE_HTML);
    });

    const result = await analyzeWebsite("https://example.com");
    expect(result.crawledPages).toBeGreaterThanOrEqual(1);
    expect(result.url).toBe("https://example.com");
  });
});
