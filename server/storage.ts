// server/storage.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { eq, desc, and } from 'drizzle-orm';
import { 
  videos,
  scrapingSessions,
  systemPrompts,
  androidConnection,
  type Video, 
  type InsertVideo, 
  type ScrapingSession, 
  type InsertScrapingSession,
  type SystemPrompt,
  type InsertSystemPrompt,
  type AndroidConnection,
  type InsertAndroidConnection
} from "@shared/schema";

const { Pool } = pg;

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/instagram_scraper'
});

const db = drizzle(pool);

export interface IStorage {
  // Video operations
  getVideo(id: string): Promise<Video | undefined>;
  getVideos(): Promise<Video[]>;
  getVideosBySession(sessionId: string): Promise<Video[]>;
  createVideo(video: InsertVideo): Promise<Video>;
  updateVideo(id: string, updates: Partial<Video>): Promise<Video | undefined>;
  deleteVideo(id: string): Promise<boolean>;

  // Scraping session operations
  getScrapingSession(id: string): Promise<ScrapingSession | undefined>;
  getActiveScrapingSession(): Promise<ScrapingSession | undefined>;
  createScrapingSession(session: InsertScrapingSession): Promise<ScrapingSession>;
  updateScrapingSession(id: string, updates: Partial<ScrapingSession>): Promise<ScrapingSession | undefined>;
  
  // System prompt operations
  getSystemPrompts(): Promise<SystemPrompt[]>;
  getActivePrompt(type: string): Promise<SystemPrompt | undefined>;
  createSystemPrompt(prompt: InsertSystemPrompt): Promise<SystemPrompt>;
  updateSystemPrompt(id: string, updates: Partial<SystemPrompt>): Promise<SystemPrompt | undefined>;

  // Android connection operations
  getAndroidConnection(): Promise<AndroidConnection | undefined>;
  updateAndroidConnection(updates: Partial<AndroidConnection>): Promise<AndroidConnection>;
  
  // Initialize default data
  initializeDefaults(): Promise<void>;
}

export class PostgresStorage implements IStorage {
  // Video operations
  async getVideo(id: string): Promise<Video | undefined> {
    const [video] = await db.select().from(videos).where(eq(videos.id, id));
    return video;
  }

  async getVideos(): Promise<Video[]> {
    return await db.select().from(videos).orderBy(desc(videos.createdAt));
  }

  async getVideosBySession(sessionId: string): Promise<Video[]> {
    return await db.select().from(videos)
      .where(eq(videos.sessionId, sessionId))
      .orderBy(desc(videos.createdAt));
  }

  async createVideo(video: InsertVideo): Promise<Video> {
    const [created] = await db.insert(videos).values(video).returning();
    return created;
  }

  async updateVideo(id: string, updates: Partial<Video>): Promise<Video | undefined> {
    const [updated] = await db.update(videos)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(videos.id, id))
      .returning();
    return updated;
  }

  async deleteVideo(id: string): Promise<boolean> {
    const result = await db.delete(videos).where(eq(videos.id, id));
    return true;
  }

  // Scraping session operations
  async getScrapingSession(id: string): Promise<ScrapingSession | undefined> {
    const [session] = await db.select().from(scrapingSessions).where(eq(scrapingSessions.id, id));
    return session;
  }

  async getActiveScrapingSession(): Promise<ScrapingSession | undefined> {
    const [session] = await db.select().from(scrapingSessions)
      .where(eq(scrapingSessions.status, 'running'))
      .orderBy(desc(scrapingSessions.createdAt));
    return session;
  }

  async createScrapingSession(session: InsertScrapingSession): Promise<ScrapingSession> {
    const [created] = await db.insert(scrapingSessions).values(session).returning();
    return created;
  }

  async updateScrapingSession(id: string, updates: Partial<ScrapingSession>): Promise<ScrapingSession | undefined> {
    const [updated] = await db.update(scrapingSessions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(scrapingSessions.id, id))
      .returning();
    return updated;
  }

  // System prompt operations
  async getSystemPrompts(): Promise<SystemPrompt[]> {
    return await db.select().from(systemPrompts).orderBy(systemPrompts.type);
  }

  async getActivePrompt(type: string): Promise<SystemPrompt | undefined> {
    const [prompt] = await db.select().from(systemPrompts)
      .where(and(eq(systemPrompts.type, type), eq(systemPrompts.isActive, true)));
    return prompt;
  }

  async createSystemPrompt(prompt: InsertSystemPrompt): Promise<SystemPrompt> {
    const [created] = await db.insert(systemPrompts).values(prompt).returning();
    return created;
  }

  async updateSystemPrompt(id: string, updates: Partial<SystemPrompt>): Promise<SystemPrompt | undefined> {
    const [updated] = await db.update(systemPrompts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(systemPrompts.id, id))
      .returning();
    return updated;
  }

  // Android connection operations
  async getAndroidConnection(): Promise<AndroidConnection | undefined> {
    const [connection] = await db.select().from(androidConnection).orderBy(desc(androidConnection.updatedAt));
    return connection;
  }

  async updateAndroidConnection(updates: Partial<AndroidConnection>): Promise<AndroidConnection> {
    // Get existing or create new
    let [existing] = await db.select().from(androidConnection);
    
    if (existing) {
      const [updated] = await db.update(androidConnection)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(androidConnection.id, existing.id))
        .returning();
        //@ts-ignore
      return updated;
    } else {
      const [created] = await db.insert(androidConnection)
        .values({
          status: 'disconnected',
          host: 'localhost',
          port: 4723,
          ...updates
        })
        .returning();
        //@ts-ignore
      return created;
    }
  }

  // Initialize default data
  async initializeDefaults(): Promise<void> {
    // Check if prompts exist
    const existingPrompts = await this.getSystemPrompts();
    
    if (existingPrompts.length === 0) {
      // Create default analysis prompt
      await this.createSystemPrompt({
        type: "analysis",
        prompt: "Проанализируй этот Instagram reel на релевантность к теме поиска работы в России. Оцени: подходит ли контент для рекламы сервиса автоответов на вакансии, есть ли в комментариях люди ищущие работу, качество аудитории. Оцени релевантность от 1 до 10 и объясни причины.",
        isActive: true,
      });

      // Create default comment prompt
      await this.createSystemPrompt({
        type: "comment",
        prompt: "Создай естественный комментарий для рекламы сервиса автоматических ответов на вакансии в России. Комментарий должен быть релевантным к контенту, не выглядеть как спам, быть дружелюбным и заинтересовывающим. Используй эмодзи умеренно. Длина до 100 символов.",
        isActive: true,
      });
    }

    // Initialize android connection if not exists
    const existingConnection = await this.getAndroidConnection();
    if (!existingConnection) {
      await this.updateAndroidConnection({
        status: 'disconnected',
        host: 'localhost',
        port: 4723,
      });
    }
  }
}

export const storage = new PostgresStorage();

// Initialize defaults on startup
storage.initializeDefaults().catch(console.error);