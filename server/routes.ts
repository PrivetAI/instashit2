import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage.js";
import { instagramScraper } from "./services/puppeteer.js";
import { analyzeReel, generateComment } from "./services/openai.js";
import { insertVideoSchema, insertScrapingSessionSchema, insertSystemPromptSchema, type WebSocketEvent } from "@shared/schema.js";

let currentScrapingSession: string | null = null;
const connectedClients = new Set<WebSocket>();

function broadcastToClients(event: WebSocketEvent) {
  connectedClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(event));
    }
  });
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // WebSocket setup
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  wss.on('connection', (ws) => {
    connectedClients.add(ws);
    console.log('WebSocket client connected');
    
    ws.on('close', () => {
      connectedClients.delete(ws);
      console.log('WebSocket client disconnected');
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      connectedClients.delete(ws);
    });
  });

  // Chrome connection routes
  app.get('/api/chrome/status', async (req, res) => {
    try {
      const connection = await storage.getChromeConnection();
      res.json(connection);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get connection status' });
    }
  });

  app.post('/api/chrome/connect', async (req, res) => {
    try {
      const { port = 9222 } = req.body;
      const success = await instagramScraper.connect(port);
      
      const connection = await storage.updateChromeConnection({
        status: success ? 'connected' : 'error',
        port,
        lastConnected: success ? new Date() : null,
        errorMessage: success ? null : 'Failed to connect to Chrome debugging port',
      });

      broadcastToClients({
        type: 'connection_status',
        data: { status: connection.status, port: connection.port || 9222, error: connection.errorMessage || undefined }
      });

      res.json(connection);
    } catch (error) {
      res.status(500).json({ message: 'Failed to connect to Chrome' });
    }
  });

  app.post('/api/chrome/disconnect', async (req, res) => {
    try {
      await instagramScraper.disconnect();
      const connection = await storage.updateChromeConnection({
        status: 'disconnected',
      });

      broadcastToClients({
        type: 'connection_status',
        data: { status: connection.status, port: connection.port || 9222 }
      });

      res.json(connection);
    } catch (error) {
      res.status(500).json({ message: 'Failed to disconnect from Chrome' });
    }
  });

  // Scraping session routes
  app.get('/api/sessions', async (req, res) => {
    try {
      const activeSession = await storage.getActiveScrapingSession();
      res.json(activeSession);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get active session' });
    }
  });

  app.post('/api/sessions/start', async (req, res) => {
    try {
      const validatedData = insertScrapingSessionSchema.parse(req.body);
      
      // Stop any existing session
      if (currentScrapingSession) {
        await storage.updateScrapingSession(currentScrapingSession, { status: 'completed' });
      }

      const session = await storage.createScrapingSession({
        ...validatedData,
        status: 'running',
      });

      currentScrapingSession = session.id;

      // Start scraping process in background
      startScrapingProcess(session.id, validatedData.searchQuery, validatedData.videoCount);

      broadcastToClients({
        type: 'session_updated',
        data: session
      });

      res.json(session);
    } catch (error) {
      res.status(400).json({ message: 'Invalid session data' });
    }
  });

  app.post('/api/sessions/:id/stop', async (req, res) => {
    try {
      const { id } = req.params;
      const session = await storage.updateScrapingSession(id, { status: 'completed' });
      
      if (currentScrapingSession === id) {
        currentScrapingSession = null;
      }

      if (session) {
        broadcastToClients({
          type: 'session_updated',
          data: session
        });
      }

      res.json(session);
    } catch (error) {
      res.status(500).json({ message: 'Failed to stop session' });
    }
  });

  // Health check endpoint для Docker
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Video routes
  app.get('/api/videos', async (req, res) => {
    try {
      const videos = await storage.getVideos();
      res.json(videos);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get videos' });
    }
  });

  app.patch('/api/videos/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const video = await storage.updateVideo(id, req.body);
      
      if (video) {
        broadcastToClients({
          type: 'video_updated',
          data: video
        });
      }

      res.json(video);
    } catch (error) {
      res.status(500).json({ message: 'Failed to update video' });
    }
  });

  app.post('/api/videos/:id/approve', async (req, res) => {
    try {
      const { id } = req.params;
      const video = await storage.getVideo(id);
      
      if (!video || !video.generatedComment) {
        return res.status(404).json({ message: 'Video not found or no comment generated' });
      }

      // Post comment to Instagram
      const success = await instagramScraper.postComment(video.url, video.generatedComment);
      
      const updatedVideo = await storage.updateVideo(id, {
        status: success ? 'posted' : 'error',
        postedComment: success ? video.generatedComment : null,
        errorMessage: success ? null : 'Failed to post comment',
      });

      if (updatedVideo) {
        broadcastToClients({
          type: 'video_updated',
          data: updatedVideo
        });

        // Update session stats
        if (currentScrapingSession) {
          const session = await storage.getScrapingSession(currentScrapingSession);
          if (session) {
            await storage.updateScrapingSession(currentScrapingSession, {
              approvedCount: (session.approvedCount || 0) + 1,
            });
          }
        }
      }

      res.json(updatedVideo);
    } catch (error) {
      res.status(500).json({ message: 'Failed to approve video' });
    }
  });

  app.post('/api/videos/:id/reject', async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      
      const updatedVideo = await storage.updateVideo(id, {
        status: 'rejected',
        errorMessage: reason || 'Rejected by user',
      });

      if (updatedVideo) {
        broadcastToClients({
          type: 'video_updated',
          data: updatedVideo
        });

        // Update session stats
        if (currentScrapingSession) {
          const session = await storage.getScrapingSession(currentScrapingSession);
          if (session) {
            await storage.updateScrapingSession(currentScrapingSession, {
              rejectedCount: (session.rejectedCount || 0) + 1,
            });
          }
        }
      }

      res.json(updatedVideo);
    } catch (error) {
      res.status(500).json({ message: 'Failed to reject video' });
    }
  });

  // System prompts routes
  app.get('/api/prompts', async (req, res) => {
    try {
      const prompts = await storage.getSystemPrompts();
      res.json(prompts);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get prompts' });
    }
  });

  app.patch('/api/prompts/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const prompt = await storage.updateSystemPrompt(id, req.body);
      res.json(prompt);
    } catch (error) {
      res.status(500).json({ message: 'Failed to update prompt' });
    }
  });

  return httpServer;
}

// Background scraping process
async function startScrapingProcess(sessionId: string, searchQuery: string, videoCount: number) {
  try {
    console.log(`Starting scraping session ${sessionId} for search query: ${searchQuery}`);

    // Navigate to Instagram and search
    const navigated = await instagramScraper.searchInstagram(searchQuery);
    if (!navigated) {
      await storage.updateScrapingSession(sessionId, { 
        status: 'error',
        errorCount: 1 
      });
      return;
    }

    // Scrape search results
    const reels = await instagramScraper.scrapeSearchResults(videoCount);
    console.log(`Found ${reels.length} reels`);

    // Process each reel
    for (let i = 0; i < reels.length; i++) {
      if (currentScrapingSession !== sessionId) {
        console.log('Scraping session stopped');
        break;
      }

      const reel = reels[i];
      
      try {
        // Create video record
        const video = await storage.createVideo({
          url: reel.url,
          title: reel.title,
          thumbnail: reel.thumbnail,
          likes: reel.likes,
          comments: reel.comments,
          shares: reel.shares,
          status: 'analyzing',
        });

        broadcastToClients({
          type: 'video_updated',
          data: video
        });

        // Scrape comments
        const comments = await instagramScraper.scrapeReelComments(reel.url);
        
        // Get analysis prompt
        const analysisPrompt = await storage.getActivePrompt('analysis');
        const commentPrompt = await storage.getActivePrompt('comment');

        if (!analysisPrompt || !commentPrompt) {
          throw new Error('System prompts not configured');
        }

        // Analyze with OpenAI
        const analysis = await analyzeReel({
          title: reel.title,
          comments,
          likes: reel.likes,
          commentCount: reel.comments,
          shares: reel.shares,
        }, analysisPrompt.prompt);

        // Generate comment
        const commentResult = await generateComment({
          title: reel.title,
          comments,
          topics: analysis.topics,
        }, commentPrompt.prompt);

        // Update video with analysis results
        const updatedVideo = await storage.updateVideo(video.id, {
          status: 'pending',
          relevanceScore: analysis.relevanceScore,
          generatedComment: commentResult.comment,
          extractedComments: comments,
          analysisData: analysis,
        });

        if (updatedVideo) {
          broadcastToClients({
            type: 'video_updated',
            data: updatedVideo
          });
        }

        // Update session progress
        await storage.updateScrapingSession(sessionId, {
          processedCount: i + 1,
        });

        broadcastToClients({
          type: 'scraping_progress',
          data: { processed: i + 1, total: reels.length, current: updatedVideo }
        });

      } catch (error) {
        console.error(`Error processing reel ${i}:`, error);
        
        // Update video with error
        const video = await storage.createVideo({
          url: reel.url,
          title: reel.title,
          thumbnail: reel.thumbnail,
          likes: reel.likes,
          comments: reel.comments,
          shares: reel.shares,
          status: 'error',
          errorMessage: error instanceof Error ? error.message : 'Analysis failed',
        });

        broadcastToClients({
          type: 'video_updated',
          data: video
        });
      }
    }

    // Complete session
    await storage.updateScrapingSession(sessionId, { 
      status: 'completed' 
    });
    
    currentScrapingSession = null;
    console.log(`Completed scraping session ${sessionId}`);

  } catch (error) {
    console.error('Scraping process error:', error);
    await storage.updateScrapingSession(sessionId, { 
      status: 'error',
      errorCount: 1 
    });
    currentScrapingSession = null;

    broadcastToClients({
      type: 'error',
      data: { message: 'Scraping process failed', details: error }
    });
  }
}
