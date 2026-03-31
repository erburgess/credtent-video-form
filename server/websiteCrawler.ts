/**
 * Website Content Inventory Crawler
 *
 * Fetches a website URL, crawls a sample of internal pages, and uses
 * heuristic + LLM-based analysis to detect and count content types
 * (written articles, audio/podcasts, video, images, etc.)
 */

import * as cheerio from "cheerio";
import { invokeLLM } from "./_core/llm";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ContentInventory {
  url: string;
  siteName: string;
  description: string;
  counts: Partial<Record<ContentCategory, number>>;
  signals: string[];          // human-readable signals found (e.g. "RSS feed detected")
  suggestedTypes: ContentCategory[];
  summary: string;            // LLM-generated plain-language summary
  crawledPages: number;
  error?: string;
}

export type ContentCategory =
  | "written"
  | "audio"
  | "video"
  | "images"
  | "social"
  | "design"
  | "games"
  | "film"
  | "other";

// ─── Fetch helpers ────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 10_000;
const MAX_PAGES_TO_CRAWL = 8;
const MAX_LINKS_TO_SAMPLE = 40;

async function fetchPage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CredtentBot/1.0; content-valuation-research)",
        "Accept": "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("html")) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function normalizeUrl(base: string, href: string): string | null {
  try {
    const u = new URL(href, base);
    // Only follow same-origin links
    const baseOrigin = new URL(base).origin;
    if (u.origin !== baseOrigin) return null;
    // Skip anchors, query-heavy URLs, and non-HTML resources
    if (u.hash && !u.pathname) return null;
    const ext = u.pathname.split(".").pop()?.toLowerCase() ?? "";
    const skipExts = ["pdf","jpg","jpeg","png","gif","svg","webp","mp3","mp4","zip","css","js","xml","json","ico","woff","woff2","ttf"];
    if (skipExts.includes(ext)) return null;
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

// ─── Heuristic signals ────────────────────────────────────────────────────────

interface PageSignals {
  hasArticles: boolean;
  hasPodcasts: boolean;
  hasVideo: boolean;
  hasImages: boolean;
  hasSocialEmbeds: boolean;
  hasGames: boolean;
  articleCount: number;
  podcastCount: number;
  videoCount: number;
  imageCount: number;
  rssFeeds: string[];
  podcastPlatforms: string[];
  videoEmbeds: string[];
  pageTitle: string;
  metaDescription: string;
  internalLinks: string[];
  textLength: number;
}

function analyzePageHtml(html: string, pageUrl: string): PageSignals {
  const $ = cheerio.load(html);

  // Remove nav/footer/script/style noise
  $("nav, footer, script, style, noscript, header").remove();

  const pageTitle = $("title").first().text().trim() || $("h1").first().text().trim();
  const metaDescription = $('meta[name="description"]').attr("content") ?? "";

  // Article signals
  const articleSelectors = [
    "article", ".post", ".blog-post", ".entry", ".news-item",
    '[class*="article"]', '[class*="post-"]', '[itemtype*="Article"]',
    ".story", ".content-item",
  ];
  let articleCount = 0;
  for (const sel of articleSelectors) {
    articleCount += $(sel).length;
  }
  // Also count <a> links that look like article links (contain /blog/, /news/, /article/, etc.)
  const articleLinkPatterns = /\/(blog|news|article|post|story|press|journal|magazine|report)\//i;
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    if (articleLinkPatterns.test(href)) articleCount++;
  });

  // Podcast signals
  const podcastPlatforms: string[] = [];
  const podcastPatterns = [
    { pattern: /spotify\.com\/show|spotify\.com\/episode/i, name: "Spotify" },
    { pattern: /podcasts\.apple\.com|itunes\.apple\.com/i, name: "Apple Podcasts" },
    { pattern: /anchor\.fm|buzzsprout\.com|libsyn\.com|podbean\.com|simplecast\.com/i, name: "Podcast host" },
    { pattern: /overcast\.fm|pocketcasts\.com/i, name: "Podcast app" },
    { pattern: /soundcloud\.com/i, name: "SoundCloud" },
  ];
  $("a[href], iframe[src], audio[src]").each((_, el) => {
    const url = $(el).attr("href") ?? $(el).attr("src") ?? "";
    for (const { pattern, name } of podcastPatterns) {
      if (pattern.test(url) && !podcastPlatforms.includes(name)) {
        podcastPlatforms.push(name);
      }
    }
  });
  let podcastCount = $("audio").length + $('[class*="podcast"]').length + $('[class*="episode"]').length;
  if (podcastPlatforms.length > 0) podcastCount = Math.max(podcastCount, 1);

  // Video signals
  const videoEmbeds: string[] = [];
  $("iframe[src], video").each((_, el) => {
    const src = $(el).attr("src") ?? "";
    if (/youtube\.com|youtu\.be|vimeo\.com|wistia\.com|loom\.com|brightcove\.com/i.test(src)) {
      videoEmbeds.push(src);
    }
  });
  const videoCount = $("video").length + videoEmbeds.length + $('[class*="video"]').length;

  // Image signals
  const imageCount = $("img[src]").length;

  // Social embeds
  const hasSocialEmbeds = $('iframe[src*="twitter"], iframe[src*="instagram"], blockquote.twitter-tweet, .instagram-media').length > 0;

  // RSS feeds
  const rssFeeds: string[] = [];
  $('link[type="application/rss+xml"], link[type="application/atom+xml"]').each((_, el) => {
    const href = $(el).attr("href");
    if (href) rssFeeds.push(normalizeUrl(pageUrl, href) ?? href);
  });

  // Internal links for crawling
  const internalLinks: string[] = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const normalized = normalizeUrl(pageUrl, href);
    if (normalized) internalLinks.push(normalized);
  });

  const textLength = $("body").text().replace(/\s+/g, " ").trim().length;

  return {
    hasArticles: articleCount > 0,
    hasPodcasts: podcastCount > 0 || podcastPlatforms.length > 0,
    hasVideo: videoCount > 0,
    hasImages: imageCount > 5,
    hasSocialEmbeds,
    hasGames: $('[class*="game"]').length > 0,
    articleCount,
    podcastCount,
    videoCount,
    imageCount,
    rssFeeds,
    podcastPlatforms,
    videoEmbeds,
    pageTitle,
    metaDescription,
    internalLinks,
    textLength,
  };
}

// ─── RSS feed counter ─────────────────────────────────────────────────────────

async function countRssItems(feedUrl: string): Promise<number> {
  try {
    const html = await fetchPage(feedUrl);
    if (!html) return 0;
    // Quick count of <item> or <entry> tags
    const itemMatches = html.match(/<item[\s>]/gi) ?? [];
    const entryMatches = html.match(/<entry[\s>]/gi) ?? [];
    return itemMatches.length + entryMatches.length;
  } catch {
    return 0;
  }
}

// ─── Sitemap-based article counter ───────────────────────────────────────────

async function countSitemapUrls(baseUrl: string): Promise<{ total: number; articleUrls: number }> {
  const sitemapUrls = [
    `${baseUrl}/sitemap.xml`,
    `${baseUrl}/sitemap_index.xml`,
    `${baseUrl}/sitemap-index.xml`,
    `${baseUrl}/news-sitemap.xml`,
  ];

  for (const sitemapUrl of sitemapUrls) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8_000);
      const res = await fetch(sitemapUrl, {
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; CredtentBot/1.0)" },
      });
      clearTimeout(timer);
      if (!res.ok) continue;
      const xml = await res.text();
      const locMatches = xml.match(/<loc>/gi) ?? [];
      const total = locMatches.length;
      // Count URLs that look like article/post paths
      const articlePattern = /\/(blog|news|article|post|story|press|journal|magazine|report|podcast|episode)\//i;
      const articleUrls = (xml.match(/<loc>[^<]+<\/loc>/gi) ?? [])
        .filter(loc => articlePattern.test(loc)).length;
      if (total > 0) return { total, articleUrls };
    } catch {
      continue;
    }
  }
  return { total: 0, articleUrls: 0 };
}

// ─── Main crawler ─────────────────────────────────────────────────────────────

export async function analyzeWebsite(rawUrl: string): Promise<ContentInventory> {
  // Normalize URL
  let url = rawUrl.trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
  }
  // Ensure trailing slash removed for consistency
  url = url.replace(/\/$/, "");

  const baseOrigin = (() => {
    try { return new URL(url).origin; } catch { return url; }
  })();

  // ── Step 1: Fetch homepage ────────────────────────────────────────────────
  const homepageHtml = await fetchPage(url);
  if (!homepageHtml) {
    return {
      url,
      siteName: url,
      description: "",
      counts: {},
      signals: [],
      suggestedTypes: [],
      summary: "We were unable to access that website. Please check the URL and try again.",
      crawledPages: 0,
      error: "Could not fetch the homepage. The site may be unavailable or blocking automated access.",
    };
  }

  const homeSignals = analyzePageHtml(homepageHtml, url);
  const siteName = homeSignals.pageTitle || url;

  // ── Step 2: Sitemap analysis ──────────────────────────────────────────────
  const sitemapData = await countSitemapUrls(baseOrigin);

  // ── Step 3: RSS feed counts ───────────────────────────────────────────────
  let rssFeedItemCount = 0;
  for (const feedUrl of homeSignals.rssFeeds.slice(0, 2)) {
    rssFeedItemCount += await countRssItems(feedUrl);
  }

  // ── Step 4: Crawl a sample of internal pages ──────────────────────────────
  const visited = new Set<string>([url]);
  const queue = Array.from(new Set(homeSignals.internalLinks)).slice(0, MAX_LINKS_TO_SAMPLE);
  const allSignals: PageSignals[] = [homeSignals];

  let crawledCount = 1;
  for (const link of queue) {
    if (crawledCount >= MAX_PAGES_TO_CRAWL) break;
    if (visited.has(link)) continue;
    visited.add(link);

    const html = await fetchPage(link);
    if (!html) continue;
    const signals = analyzePageHtml(html, link);
    allSignals.push(signals);
    crawledCount++;
  }

  // ── Step 5: Aggregate signals ─────────────────────────────────────────────
  const totalArticles = allSignals.reduce((s, p) => s + p.articleCount, 0);
  const totalPodcasts = allSignals.reduce((s, p) => s + p.podcastCount, 0);
  const totalVideos = allSignals.reduce((s, p) => s + p.videoCount, 0);
  const totalImages = allSignals.reduce((s, p) => s + p.imageCount, 0);
  const allRssFeeds = Array.from(new Set(allSignals.flatMap(p => p.rssFeeds)));
  const allPodcastPlatforms = Array.from(new Set(allSignals.flatMap(p => p.podcastPlatforms)));
  const allVideoEmbeds = Array.from(new Set(allSignals.flatMap(p => p.videoEmbeds)));
  const hasSocial = allSignals.some(p => p.hasSocialEmbeds);
  const hasGames = allSignals.some(p => p.hasGames);

  // Build human-readable signals list
  const detectedSignals: string[] = [];
  if (allRssFeeds.length > 0) detectedSignals.push(`RSS feed detected (${allRssFeeds.length} feed${allRssFeeds.length > 1 ? "s" : ""})`);
  if (allPodcastPlatforms.length > 0) detectedSignals.push(`Podcast platform links: ${allPodcastPlatforms.join(", ")}`);
  if (allVideoEmbeds.length > 0) detectedSignals.push(`Video embeds found (${allVideoEmbeds.length})`);
  if (sitemapData.total > 0) detectedSignals.push(`Sitemap found: ${sitemapData.total.toLocaleString()} URLs`);
  if (sitemapData.articleUrls > 0) detectedSignals.push(`${sitemapData.articleUrls.toLocaleString()} article/content URLs in sitemap`);
  if (rssFeedItemCount > 0) detectedSignals.push(`RSS feed contains ${rssFeedItemCount} items`);
  if (hasSocial) detectedSignals.push("Social media embeds detected");
  if (hasGames) detectedSignals.push("Interactive/game content detected");

  // ── Step 6: Build counts estimate ────────────────────────────────────────
  const counts: Partial<Record<ContentCategory, number>> = {};

  // Written content: prefer sitemap article count, then RSS count, then crawl estimate
  const writtenEstimate = sitemapData.articleUrls > 0
    ? sitemapData.articleUrls
    : rssFeedItemCount > 0
    ? rssFeedItemCount
    : totalArticles > 0
    ? Math.round((totalArticles / crawledCount) * (sitemapData.total || 50))
    : 0;
  if (writtenEstimate > 0) counts.written = writtenEstimate;

  // Audio/Podcast
  const audioEstimate = totalPodcasts > 0 ? Math.max(totalPodcasts, allPodcastPlatforms.length > 0 ? 10 : 0) : 0;
  if (audioEstimate > 0) counts.audio = audioEstimate;

  // Video
  const videoEstimate = totalVideos > 0 ? totalVideos : 0;
  if (videoEstimate > 0) counts.video = videoEstimate;

  // Images (only count if significant)
  if (totalImages > 20) counts.images = totalImages;

  if (hasSocial) counts.social = 1; // flag as present
  if (hasGames) counts.games = 1;

  // ── Step 7: LLM classification and summary ────────────────────────────────
  const crawlSummary = `
Website: ${url}
Site name: ${siteName}
Meta description: ${homeSignals.metaDescription}
Pages crawled: ${crawledCount}
Detected signals: ${detectedSignals.join("; ") || "none"}
Heuristic counts: articles=${totalArticles}, podcasts=${totalPodcasts}, videos=${totalVideos}, images=${totalImages}
Sitemap URLs: ${sitemapData.total}, article URLs: ${sitemapData.articleUrls}
RSS items: ${rssFeedItemCount}
Podcast platforms: ${allPodcastPlatforms.join(", ") || "none"}
Video embeds: ${allVideoEmbeds.length}
`.trim();

  let llmResult: {
    siteName: string;
    description: string;
    counts: Partial<Record<ContentCategory, number>>;
    suggestedTypes: ContentCategory[];
    summary: string;
  } = {
    siteName,
    description: homeSignals.metaDescription,
    counts,
    suggestedTypes: Object.keys(counts) as ContentCategory[],
    summary: "",
  };

  try {
    const llmResponse = await invokeLLM({
      system: `You are a content inventory analyst. Given crawl data about a website, produce a friendly, accurate summary of what content types are present and estimated counts. Be specific and concrete. If counts are uncertain, give a reasonable range. Always be encouraging and professional. The goal is to help the website owner understand what content they have that could be licensed for AI training. Always respond with valid JSON only — no markdown fences, no preamble.`,
      messages: [
        {
          role: "user",
          content: `Analyze this website crawl data and return a JSON object:\n\n${crawlSummary}\n\nReturn JSON with these fields:\n- siteName: string (clean site name)\n- description: string (1-sentence site description)\n- counts: object with keys from [written, audio, video, images, social, design, games, film, other] and integer values for estimated item counts (only include types that are clearly present)\n- suggestedTypes: array of content type keys that are clearly present\n- summary: string (2-3 friendly sentences explaining what was found, e.g. "We found approximately 4,200 articles, 87 podcast episodes, and 12 videos on your site. Your written content appears to be the primary asset...")`,
        },
      ],
    });

    const raw = llmResponse?.content;
    if (raw) {
      const cleaned = raw.replace(/^```json?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
      const parsed = JSON.parse(cleaned);
      llmResult = {
        siteName: parsed.siteName || siteName,
        description: parsed.description || homeSignals.metaDescription,
        counts: { ...counts, ...parsed.counts },
        suggestedTypes: parsed.suggestedTypes || Object.keys(counts) as ContentCategory[],
        summary: parsed.summary || "",
      };
    }
  } catch (err) {
    // LLM failed — fall back to heuristic summary
    const parts: string[] = [];
    if (counts.written) parts.push(`approximately ${counts.written.toLocaleString()} written articles or posts`);
    if (counts.audio) parts.push(`${counts.audio} podcast episodes`);
    if (counts.video) parts.push(`${counts.video} videos`);
    if (counts.images) parts.push(`${counts.images} images`);
    llmResult.summary = parts.length > 0
      ? `Based on our scan, we found ${parts.join(", ")} on your site.`
      : "We scanned your site but couldn't automatically detect specific content counts. You can still enter your content details manually below.";
  }

  return {
    url,
    siteName: llmResult.siteName,
    description: llmResult.description,
    counts: llmResult.counts,
    signals: detectedSignals,
    suggestedTypes: llmResult.suggestedTypes,
    summary: llmResult.summary,
    crawledPages: crawledCount,
  };
}
