import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  COOKIE_NAME,
  ONE_YEAR_MS,
  createSessionToken,
  verifyAdminCredentials,
} from "./_core/auth";
import { publicProcedure, adminProcedure, router } from "./_core/trpc";
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

function isSecureRequest(req: { headers: Record<string, unknown>; protocol?: string }) {
  if (req.protocol === "https") return true;
  const proto = req.headers["x-forwarded-proto"];
  if (typeof proto === "string") return proto.split(",").some(p => p.trim() === "https");
  return false;
}

export const appRouter = router({
  auth: router({
    /** Check current session */
    me: publicProcedure.query(({ ctx }) => {
      if (!ctx.session) return null;
      return { email: ctx.session.email, role: ctx.session.role };
    }),

    /** Admin login with email + password */
    login: publicProcedure
      .input(z.object({ email: z.string().min(1), password: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        if (!verifyAdminCredentials(input.email, input.password)) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid credentials" });
        }
        const token = await createSessionToken(input.email);
        ctx.res.cookie(COOKIE_NAME, token, {
          httpOnly: true,
          path: "/",
          sameSite: "lax",
          secure: isSecureRequest(ctx.req),
          maxAge: ONE_YEAR_MS,
        });
        return { success: true, email: input.email };
      }),

    /** Logout */
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(COOKIE_NAME, {
        httpOnly: true,
        path: "/",
        sameSite: "lax",
        secure: isSecureRequest(ctx.req),
      });
      return { success: true };
    }),
  }),

  // ── Website analysis ────────────────────────────────────────────────────────
  website: router({
    analyze: publicProcedure
      .input(z.object({ url: z.string().min(3) }))
      .mutation(async ({ input }) => {
        return analyzeWebsite(input.url);
      }),
  }),

  // ── Accolades & ratings lookup ──────────────────────────────────────────────
  accolades: router({
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

        console.log(`[Assessment] New submission: ${companyName || "Unknown"} (ID: ${id})`);

        return { success: true, id };
      }),

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

    get: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const row = await getAssessmentById(input.id);
        if (!row) throw new TRPCError({ code: "NOT_FOUND" });
        return row;
      }),

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
