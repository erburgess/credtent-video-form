import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock db helpers so tests don't need a real database
vi.mock("./db", () => ({
  createAssessment: vi.fn().mockResolvedValue(42),
  listAssessments: vi.fn().mockResolvedValue([]),
  getAssessmentById: vi.fn().mockResolvedValue(undefined),
  updateAssessmentStatus: vi.fn().mockResolvedValue(undefined),
  countAssessments: vi.fn().mockResolvedValue(0),
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
}));

// Mock notifyOwner so tests don't make HTTP calls
vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

function makePublicCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function makeAdminCtx(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "admin-user",
      email: "admin@credtent.org",
      name: "Admin",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function makeUserCtx(): TrpcContext {
  return {
    user: {
      id: 2,
      openId: "regular-user",
      email: "user@example.com",
      name: "Regular User",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

const sampleSubmission = {
  companyAnswers: {
    companyName: "SOFA Entertainment",
    contactName: "EB",
    contactEmail: "eb@sofa.com",
  },
  contentEntries: [
    {
      type: "video",
      answers: { videoCategory: ["Television series/episodes"], genres: ["Variety/entertainment"] },
    },
  ],
  completedTypes: ["video"],
  notes: "Ed Sullivan Show archive",
  submissionEmail: "eb@sofa.com",
};

describe("assessments.submit", () => {
  it("accepts a valid submission and returns success with an id", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    const result = await caller.assessments.submit(sampleSubmission);
    expect(result.success).toBe(true);
    expect(typeof result.id).toBe("number");
  });

  it("rejects an invalid email in submissionEmail", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    await expect(
      caller.assessments.submit({ ...sampleSubmission, submissionEmail: "not-an-email" })
    ).rejects.toThrow();
  });
});

describe("assessments.list (admin only)", () => {
  it("returns rows for admin users", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    const result = await caller.assessments.list({ limit: 10, offset: 0 });
    expect(Array.isArray(result.rows)).toBe(true);
  });

  it("throws FORBIDDEN for non-admin users", async () => {
    const caller = appRouter.createCaller(makeUserCtx());
    await expect(caller.assessments.list({ limit: 10, offset: 0 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("throws FORBIDDEN for unauthenticated users", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    await expect(caller.assessments.list({ limit: 10, offset: 0 })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});
