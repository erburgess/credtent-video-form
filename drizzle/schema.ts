import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Stores every completed content valuation assessment submitted via the chat form.
 * companyAnswers, contentEntries, and notes are stored as JSON blobs.
 */
export const assessments = mysqlTable("assessments", {
  id: int("id").autoincrement().primaryKey(),
  /** Company name extracted from the form for quick filtering */
  companyName: varchar("companyName", { length: 255 }),
  /** Contact name */
  contactName: varchar("contactName", { length: 255 }),
  /** Contact / submission email */
  contactEmail: varchar("contactEmail", { length: 320 }),
  /** Email entered at the summary screen (may differ from contactEmail) */
  submissionEmail: varchar("submissionEmail", { length: 320 }),
  /** JSON blob of company-level answers */
  companyAnswers: json("companyAnswers"),
  /** JSON array of { type, answers, customLabel } objects */
  contentEntries: json("contentEntries"),
  /** Comma-separated list of content type keys for easy filtering */
  contentTypes: text("contentTypes"),
  /** Free-text notes from the final step */
  notes: text("notes"),
  /** JSON blob of the LLM-generated valuation estimate (low/mid/high range + value drivers) */
  valuationEstimate: json("valuationEstimate"),
  /** Submission status */
  status: mysqlEnum("status", ["submitted", "reviewed", "in_progress", "archived"]).default("submitted").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Assessment = typeof assessments.$inferSelect;
export type InsertAssessment = typeof assessments.$inferInsert;
