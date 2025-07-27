import { 
  type Video, 
  type InsertVideo, 
  type ScrapingSession, 
  type InsertScrapingSession,
  type SystemPrompt,
  type InsertSystemPrompt,
  type AndroidConnection,
  type InsertAndroidConnection
} from "@shared/schema";
import { randomUUID } from "crypto";

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
}

export class MemStorage implements IStorage {
  private videos: Map<string, Video> = new Map();
  private scrapingSessions: Map<string, ScrapingSession> = new Map();
  private systemPrompts: Map<string, SystemPrompt> = new Map();
  private androidConnection: AndroidConnection | undefined;

  constructor() {
    // Initialize default system prompts
    this.initializeDefaults();
  }

  private initializeDefaults() {
    const analysisPrompt: SystemPrompt = {
      id: randomUUID(),
      type: "analysis",
      prompt: "Проанализируй этот Instagram reel на релевантность к теме поиска работы в России. Оцени: подходит ли контент для рекламы сервиса автоответов на вакансии, есть ли в комментариях люди ищущие работу, качество аудитории. Оцени релевантность от 1 до 10 и объясни причины.",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const commentPrompt: SystemPrompt = {
      id: randomUUID(),
      type: "comment",
      prompt: "Создай естественный комментарий для рекламы сервиса автоматических ответов на вакансии в России. Комментарий должен быть релевантным к контенту, не выглядеть как спам, быть дружелюбным и заинтересовывающим. Используй эмодзи умеренно. Длина до 100 символов.",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.systemPrompts.set(analysisPrompt.id, analysisPrompt);
    this.systemPrompts.set(commentPrompt.id, commentPrompt);

    // Initialize android connection
    this.androidConnection = {
      id: randomUUID(),
      status: "disconnected",
      host: "localhost",
      port: 4723,
      lastConnected: null,
      errorMessage: null,
      updatedAt: new Date(),
    };
  }

  // Video operations
  async getVideo(id: string): Promise<Video | undefined> {
    return this.videos.get(id);
  }

  async getVideos(): Promise<Video[]> {
    return Array.from(this.videos.values()).sort((a, b) => 
      new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
    );
  }

  async getVideosBySession(sessionId: string): Promise<Video[]> {
    return Array.from(this.videos.values())
      .filter(video => (video as any).sessionId === sessionId)
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  }

  async createVideo(insertVideo: InsertVideo): Promise<Video> {
    const id = randomUUID();
    const now = new Date();
    const video: Video = {
      ...insertVideo,
      id,
      thumbnail: insertVideo.thumbnail ?? null,
      likes: insertVideo.likes ?? null,
      comments: insertVideo.comments ?? null,
      shares: insertVideo.shares ?? null,
      relevanceScore: insertVideo.relevanceScore ?? null,
      generatedComment: insertVideo.generatedComment ?? null,
      postedComment: insertVideo.postedComment ?? null,
      errorMessage: insertVideo.errorMessage ?? null,
      extractedComments: insertVideo.extractedComments ?? null,
      analysisData: insertVideo.analysisData ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.videos.set(id, video);
    return video;
  }

  async updateVideo(id: string, updates: Partial<Video>): Promise<Video | undefined> {
    const video = this.videos.get(id);
    if (!video) return undefined;

    const updatedVideo: Video = {
      ...video,
      ...updates,
      updatedAt: new Date(),
    };
    this.videos.set(id, updatedVideo);
    return updatedVideo;
  }

  async deleteVideo(id: string): Promise<boolean> {
    return this.videos.delete(id);
  }

  // Scraping session operations
  async getScrapingSession(id: string): Promise<ScrapingSession | undefined> {
    return this.scrapingSessions.get(id);
  }

  async getActiveScrapingSession(): Promise<ScrapingSession | undefined> {
    return Array.from(this.scrapingSessions.values())
      .find(session => session.status === "running");
  }

  async createScrapingSession(insertSession: InsertScrapingSession): Promise<ScrapingSession> {
    const id = randomUUID();
    const now = new Date();
    const session: ScrapingSession = {
      ...insertSession,
      id,
      status: insertSession.status || 'idle',
      processedCount: insertSession.processedCount ?? null,
      approvedCount: insertSession.approvedCount ?? null, 
      rejectedCount: insertSession.rejectedCount ?? null,
      errorCount: insertSession.errorCount ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.scrapingSessions.set(id, session);
    return session;
  }

  async updateScrapingSession(id: string, updates: Partial<ScrapingSession>): Promise<ScrapingSession | undefined> {
    const session = this.scrapingSessions.get(id);
    if (!session) return undefined;

    const updatedSession: ScrapingSession = {
      ...session,
      ...updates,
      updatedAt: new Date(),
    };
    this.scrapingSessions.set(id, updatedSession);
    return updatedSession;
  }

  // System prompt operations
  async getSystemPrompts(): Promise<SystemPrompt[]> {
    return Array.from(this.systemPrompts.values());
  }

  async getActivePrompt(type: string): Promise<SystemPrompt | undefined> {
    return Array.from(this.systemPrompts.values())
      .find(prompt => prompt.type === type && prompt.isActive);
  }

  async createSystemPrompt(insertPrompt: InsertSystemPrompt): Promise<SystemPrompt> {
    const id = randomUUID();
    const now = new Date();
    const prompt: SystemPrompt = {
      ...insertPrompt,
      id,
      isActive: insertPrompt.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };
    this.systemPrompts.set(id, prompt);
    return prompt;
  }

  async updateSystemPrompt(id: string, updates: Partial<SystemPrompt>): Promise<SystemPrompt | undefined> {
    const prompt = this.systemPrompts.get(id);
    if (!prompt) return undefined;

    const updatedPrompt: SystemPrompt = {
      ...prompt,
      ...updates,
      updatedAt: new Date(),
    };
    this.systemPrompts.set(id, updatedPrompt);
    return updatedPrompt;
  }

  // Android connection operations
  async getAndroidConnection(): Promise<AndroidConnection | undefined> {
    return this.androidConnection;
  }

  async updateAndroidConnection(updates: Partial<AndroidConnection>): Promise<AndroidConnection> {
    if (!this.androidConnection) {
      this.androidConnection = {
        id: randomUUID(),
        status: "disconnected",
        host: "localhost",
        port: 4723,
        lastConnected: null,
        errorMessage: null,
        updatedAt: new Date(),
      };
    }

    this.androidConnection = {
      ...this.androidConnection,
      ...updates,
      updatedAt: new Date(),
    };
    return this.androidConnection;
  }
}

export const storage = new MemStorage();