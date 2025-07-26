import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const videos = pgTable("videos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  url: text("url").notNull(),
  title: text("title").notNull(),
  thumbnail: text("thumbnail"),
  likes: integer("likes").default(0),
  comments: integer("comments").default(0),
  shares: integer("shares").default(0),
  relevanceScore: integer("relevance_score"),
  status: text("status").notNull().default("queued"), // queued, analyzing, pending, approved, rejected, posted, error
  generatedComment: text("generated_comment"),
  postedComment: text("posted_comment"),
  errorMessage: text("error_message"),
  extractedComments: jsonb("extracted_comments"),
  analysisData: jsonb("analysis_data"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const scrapingSessions = pgTable("scraping_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  searchQuery: text("search_query").notNull(),
  videoCount: integer("video_count").notNull(),
  status: text("status").notNull().default("idle"), // idle, running, paused, completed, error
  processedCount: integer("processed_count").default(0),
  approvedCount: integer("approved_count").default(0),
  rejectedCount: integer("rejected_count").default(0),
  errorCount: integer("error_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const systemPrompts = pgTable("system_prompts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(), // analysis, comment
  prompt: text("prompt").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const chromeConnection = pgTable("chrome_connection", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  status: text("status").notNull().default("disconnected"), // connected, disconnected, error
  port: integer("port").default(9222),
  lastConnected: timestamp("last_connected"),
  errorMessage: text("error_message"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertVideoSchema = createInsertSchema(videos).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertScrapingSessionSchema = createInsertSchema(scrapingSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSystemPromptSchema = createInsertSchema(systemPrompts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertChromeConnectionSchema = createInsertSchema(chromeConnection).omit({
  id: true,
  updatedAt: true,
});

export type Video = typeof videos.$inferSelect;
export type InsertVideo = z.infer<typeof insertVideoSchema>;
export type ScrapingSession = typeof scrapingSessions.$inferSelect;
export type InsertScrapingSession = z.infer<typeof insertScrapingSessionSchema>;
export type SystemPrompt = typeof systemPrompts.$inferSelect;
export type InsertSystemPrompt = z.infer<typeof insertSystemPromptSchema>;
export type ChromeConnection = typeof chromeConnection.$inferSelect;
export type InsertChromeConnection = z.infer<typeof insertChromeConnectionSchema>;

// WebSocket event types
export type WebSocketEvent = 
  | { type: 'video_updated'; data: Video }
  | { type: 'session_updated'; data: ScrapingSession }
  | { type: 'connection_status'; data: { status: string; port: number; error?: string } }
  | { type: 'scraping_progress'; data: { processed: number; total: number; current?: Video } }
  | { type: 'error'; data: { message: string; details?: any } };
