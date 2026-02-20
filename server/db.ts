import { desc, eq, like, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { assessments, InsertAssessment, InsertUser, users } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ── Assessment helpers ────────────────────────────────────────────────────────

export async function createAssessment(data: InsertAssessment): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(assessments).values(data);
  return (result as unknown as { insertId: number }).insertId;
}

export async function listAssessments(opts: { limit?: number; offset?: number; search?: string } = {}) {
  const db = await getDb();
  if (!db) return [];
  const { limit = 50, offset = 0, search } = opts;
  let query = db.select().from(assessments).$dynamic();
  if (search) {
    query = query.where(
      or(
        like(assessments.companyName, `%${search}%`),
        like(assessments.contactName, `%${search}%`),
        like(assessments.contactEmail, `%${search}%`),
        like(assessments.contentTypes, `%${search}%`)
      )
    );
  }
  return query.orderBy(desc(assessments.createdAt)).limit(limit).offset(offset);
}

export async function getAssessmentById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(assessments).where(eq(assessments.id, id)).limit(1);
  return result[0];
}

export async function updateAssessmentStatus(id: number, status: "submitted" | "reviewed" | "in_progress" | "archived") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(assessments).set({ status }).where(eq(assessments.id, id));
}

export async function countAssessments() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select().from(assessments);
  return result.length;
}
