import type { Express } from "express";
import { createServer, type Server } from "http";
import { log } from "./vite";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { androidService } from "./services/android";
import { analyzeReel, generateComment } from "./services/openai";
import { insertVideoSchema, insertScrapingSessionSchema, insertSystemPromptSchema, type WebSocketEvent } from "@shared/schema";

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
    log('WebSocket client connected');
    
    ws.on('close', () => {
      connectedClients.delete(ws);
      log('WebSocket client disconnected');
    });
    
    ws.on('error', (error) => {
      log(`WebSocket error: ${error}`);
      connectedClients.delete(ws);
    });
  });

  // Android connection routes
  app.get('/api/android/status', async (req, res) => {
    try {
      const connection = await storage.getAndroidConnection();
      res.json(connection);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get connection status' });
    }
  });

  app.post('/api/android/connect', (req, res) => {
    const { host = 'localhost', port = 4723 } = req.body;

    // Don't await, run in background
    connectToAndroid(host, port);

    // Respond immediately to the client
    res.status(202).json({ message: 'Connection process started' });
  });

async function connectToAndroid(host: string, port: number) {
  broadcastToClients({
    type: 'connection_status',
    data: { status: 'connecting', host, port }
  });

  try {
    await androidService.connect();
    
    const connection = await storage.updateAndroidConnection({
      status: 'connected',
      host,
      port,
      lastConnected: new Date(),
      errorMessage: null,
    });

    broadcastToClients({
      type: 'connection_status',
      data: { 
        status: connection.status, 
        host: connection.host || 'localhost',
        port: connection.port || 4723, 
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await storage.updateAndroidConnection({
      status: 'error',
      errorMessage,
    });

    broadcastToClients({
      type: 'connection_status',
      data: { 
        status: 'error', 
        host,
        port, 
        error: errorMessage 
      }
    });
  }
}

  app.post('/api/android/disconnect', async (req, res) => {
    try {
      await androidService.disconnect();
      const connection = await storage.updateAndroidConnection({
        status: 'disconnected',
      });

      broadcastToClients({
        type: 'connection_status',
        data: { 
          status: connection.status, 
          host: connection.host || 'localhost',
          port: connection.port || 4723 
        }
      });

      res.json(connection);
    } catch (error) {
      res.status(500).json({ message: 'Failed to disconnect from Android' });
    }
  });

  app.post('/api/android/install-instagram', async (req, res) => {
    try {
      const { apkPath = '/apks/instagram.apk' } = req.body;
      
      if (!androidService.isReady()) {
        return res.status(400).json({ message: 'Not connected to Android emulator' });
      }

      await androidService.installInstagram();
      res.json({ message: 'Instagram installed successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Failed to install Instagram' });
    }
  });

  app.post('/api/android/launch-instagram', async (req, res) => {
    try {
      if (!androidService.isReady()) {
        return res.status(400).json({ message: 'Not connected to Android emulator' });
      }

      await androidService.login('user', 'pass');
      res.json({ message: 'Instagram launched successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Failed to launch Instagram' });
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
      
      // Check Android connection
      if (!androidService.isReady()) {
        return res.status(400).json({ message: 'Not connected to Android emulator' });
      }

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

      // Post comment to Instagram via Android
      const success = await androidService.postComment(video.url, video.generatedComment);
      
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
    log(`Starting scraping session ${sessionId} for search query: ${searchQuery}`);

    // Launch Instagram if needed
    await androidService.login('user', 'pass');

    // Search in Instagram
    await androidService.navigateToProfile(searchQuery);

    // Scrape search results
    const reels = await androidService.getProfileData();
    log(`Found ${reels.length} reels`);

    // Process each reel
    for (let i = 0; i < reels.length; i++) {
      if (currentScrapingSession !== sessionId) {
        log('Scraping session stopped');
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
        const comments: string[] = [];
        await androidService.scrollFeed();
        
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
        log(`Error processing reel ${i}: ${error}`);
        
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
    log(`Completed scraping session ${sessionId}`);

  } catch (error) {
    log(`Scraping process error: ${error}`);
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
