import { desc, eq, like, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { assessments, InsertAssessment } from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

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
