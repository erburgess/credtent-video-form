import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  createAssessment,
  getAssessmentById,
  listAssessments,
  updateAssessmentStatus,
  countAssessments,
} from "./db";
import { analyzeWebsite } from "./websiteCrawler";
import { lookupAccolades } from "./ratingsLookup";
import { valuateContent } from "./valuateContent";
import { notifyOwner } from "./_core/notification";

// Admin-only guard
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ── Website analysis ────────────────────────────────────────────────────────
  website: router({
    /**
     * Crawl a website URL and return a content inventory.
     * Public — no login required.
     */
    analyze: publicProcedure
      .input(z.object({ url: z.string().min(3) }))
      .mutation(async ({ input }) => {
        return analyzeWebsite(input.url);
      }),
  }),

  // ── Accolades & ratings lookup ──────────────────────────────────────────────
  accolades: router({
    /**
     * Look up external ratings (IMDB, Rotten Tomatoes, Open Library) for a content title.
     * Public — no login required.
     */
    lookup: publicProcedure
      .input(
        z.object({
          title: z.string().min(1),
          kind: z.enum(["film", "video", "written", "audio", "other"]),
          year: z.string().optional(),
          author: z.string().optional(),
          userAccolades: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const omdbApiKey = process.env.OMDB_API_KEY ?? "";
        return lookupAccolades({ ...input, omdbApiKey });
      }),
  }),

  // ── Content valuation ─────────────────────────────────────────────────────
  valuation: router({
    /**
     * Synthesize all collected signals into a preliminary licensing value range.
     * Uses the LLM to produce a structured estimate with value drivers and confidence.
     * Public — no login required.
     */
    estimate: publicProcedure
      .input(
        z.object({
          companyAnswers: z.record(z.string(), z.unknown()),
          contentEntries: z.array(
            z.object({
              type: z.string(),
              customLabel: z.string().optional(),
              answers: z.record(z.string(), z.unknown()),
            })
          ),
          accoladesResults: z.record(
            z.string(),
            z.object({
              title: z.string(),
              kind: z.string(),
              externalRatings: z.array(
                z.object({
                  platform: z.string(),
                  score: z.string(),
                  voteCount: z.string().optional(),
                })
              ).optional(),
              boxOffice: z.string().optional(),
              certifications: z.array(z.string()).optional(),
              editionCount: z.number().optional(),
              valuationNote: z.string().optional(),
            })
          ).optional(),
          websiteInventory: z.object({
            siteName: z.string().optional(),
            counts: z.record(z.string(), z.number()).optional(),
            signals: z.array(z.string()).optional(),
            crawledPages: z.number().optional(),
          }).optional(),
        })
      )
      .mutation(async ({ input }) => {
        return valuateContent(input);
      }),
  }),

  // ── Assessment procedures ────────────────────────────────────────────────────
  assessments: router({
    /**
     * Submit a completed content valuation assessment.
     * Public — no login required so any respondent can submit.
     */
    submit: publicProcedure
      .input(
        z.object({
          companyAnswers: z.record(z.string(), z.unknown()),
          contentEntries: z.array(
            z.object({
              type: z.string(),
              answers: z.record(z.string(), z.unknown()),
              customLabel: z.string().optional(),
            })
          ),
          completedTypes: z.array(z.string()),
          notes: z.string().optional(),
          submissionEmail: z.email().optional(),
          valuationEstimate: z.object({
            rangeLow: z.string(),
            rangeMid: z.string(),
            rangeHigh: z.string(),
            rangeUnit: z.string(),
            confidence: z.enum(["high", "medium", "low"]),
            headline: z.string(),
            rationale: z.string(),
            valueDrivers: z.array(z.object({
              factor: z.string(),
              impact: z.enum(["high", "medium", "low"]),
              description: z.string(),
            })),
            caveats: z.string().optional(),
            disclaimer: z.string(),
          }).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const companyName = String(input.companyAnswers.companyName ?? "");
        const contactName = String(input.companyAnswers.contactName ?? "");
        const contactEmail = String(input.companyAnswers.contactEmail ?? "");

        const id = await createAssessment({
          companyName: companyName || null,
          contactName: contactName || null,
          contactEmail: contactEmail || null,
          submissionEmail: input.submissionEmail ?? contactEmail ?? null,
          companyAnswers: input.companyAnswers,
          contentEntries: input.contentEntries,
          contentTypes: input.completedTypes.join(", "),
          notes: input.notes ?? null,
          valuationEstimate: input.valuationEstimate ?? null,
          status: "submitted",
        });

        // Notify owner
        await notifyOwner({
          title: `New content valuation: ${companyName || "Unknown company"}`,
          content: `${contactName} (${contactEmail}) submitted a content profile covering: ${input.completedTypes.join(", ")}. Assessment ID: ${id}`,
        });

        return { success: true, id };
      }),

    /**
     * Admin: list all assessments with optional search and pagination.
     */
    list: adminProcedure
      .input(
        z.object({
          limit: z.number().min(1).max(200).default(50),
          offset: z.number().min(0).default(0),
          search: z.string().optional(),
        })
      )
      .query(async ({ input }) => {
        const rows = await listAssessments(input);
        const total = await countAssessments();
        return { rows, total };
      }),

    /**
     * Admin: get a single assessment by ID.
     */
    get: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const row = await getAssessmentById(input.id);
        if (!row) throw new TRPCError({ code: "NOT_FOUND" });
        return row;
      }),

    /**
     * Admin: update the status of an assessment.
     */
    updateStatus: adminProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(["submitted", "reviewed", "in_progress", "archived"]),
        })
      )
      .mutation(async ({ input }) => {
        await updateAssessmentStatus(input.id, input.status);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
