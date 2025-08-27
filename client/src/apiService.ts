import { type Video, type ScrapingSession, type AndroidConnection, type SystemPrompt } from "@shared/schema";

export interface ApiCallbacks {
  onVideoUpdated: (video: Video) => void;
  onSessionUpdated: (session: ScrapingSession) => void;
  onConnectionStatus: (status: any) => void;
}

class ApiService {
  private ws: WebSocket | null = null;

  private async safeJsonParse(response: Response) {
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  initWebSocket(callbacks: ApiCallbacks) {
    this.ws = new WebSocket('/ws');
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      switch (data.type) {
        case 'video_updated': callbacks.onVideoUpdated(data.data); break;
        case 'session_updated': callbacks.onSessionUpdated(data.data); break;
        case 'connection_status': callbacks.onConnectionStatus(data.data); break;
      }
    };
    return this.ws;
  }

  closeWebSocket() {
    this.ws?.close();
    this.ws = null;
  }

  async getVideos(): Promise<Video[]> {
    try {
      const response = await fetch('/api/videos');
      return response.ok ? await this.safeJsonParse(response) || [] : [];
    } catch { return []; }
  }

  async getSessions(): Promise<ScrapingSession | null> {
    try {
      const response = await fetch('/api/sessions');
      return response.ok ? await this.safeJsonParse(response) : null;
    } catch { return null; }
  }

  async getAndroidStatus(): Promise<AndroidConnection | null> {
    try {
      const response = await fetch('/api/android/status');
      return response.ok ? await this.safeJsonParse(response) : null;
    } catch { return null; }
  }

  async getPrompts(): Promise<SystemPrompt[]> {
    try {
      const response = await fetch('/api/prompts');
      return response.ok ? await this.safeJsonParse(response) || [] : [];
    } catch { return []; }
  }

  async connectAndroid(): Promise<void> {
    const response = await fetch('/api/android/connect', { method: 'POST' });
    if (!response.ok) throw new Error('Failed to connect');
  }

  async startScraping(searchQuery: string, videoCount: number): Promise<ScrapingSession> {
    const response = await fetch('/api/sessions/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ searchQuery, videoCount }),
    });
    if (!response.ok) throw new Error('Failed to start scraping');
    return await this.safeJsonParse(response);
  }

  async stopScraping(sessionId: string): Promise<void> {
    const response = await fetch(`/api/sessions/${sessionId}/stop`, { method: 'POST' });
    if (!response.ok) throw new Error('Failed to stop scraping');
  }

  async approveVideo(videoId: string): Promise<void> {
    const response = await fetch(`/api/videos/${videoId}/approve`, { method: 'POST' });
    if (!response.ok) throw new Error('Failed to approve video');
  }

  async rejectVideo(videoId: string, reason: string = 'Rejected by user'): Promise<void> {
    const response = await fetch(`/api/videos/${videoId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    if (!response.ok) throw new Error('Failed to reject video');
  }

  async updatePrompt(promptId: string, prompt: string): Promise<void> {
    const response = await fetch(`/api/prompts/${promptId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    if (!response.ok) throw new Error('Failed to update prompt');
  }
}

export const apiService = new ApiService();