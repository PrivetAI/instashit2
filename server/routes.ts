// server/routes.ts
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
    const { host = 'android', port = 4723 } = req.body;

    // Run connection in background
    connectToAndroid(host, port);

    // Respond immediately
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
          host: connection.host || 'android',
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
          host: connection.host || 'android',
          port: connection.port || 4723
        }
      });

      res.json(connection);
    } catch (error) {
      res.status(500).json({ message: 'Failed to disconnect from Android' });
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

  // Health check endpoint
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
      const success = await androidService.postComment(video.url, video.generatedComment);

      const updatedVideo = await storage.updateVideo(id, {
        status: success ? 'posted' : 'error',
        postedComment: success ? video.generatedComment : null,
        errorMessage: success ? null : 'Failed to post comment or comments disabled',
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
              approvedCount: (session.approvedCount || 0) + (success ? 1 : 0),
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
  // Snapshot management routes
  app.post('/api/android/snapshot/create', async (req, res) => {
    try {
      if (!androidService.isReady()) {
        return res.status(400).json({ message: 'Android not connected' });
      }

      // Execute snapshot creation in container
      const { exec } = require('child_process');
      const command = `docker exec android_emulator sh -c "tar -czf /snapshots/emulator.tar.gz /root/.android/avd /data/data/com.instagram.android"`;
      //@ts-ignore
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error(`Snapshot error: ${error}`);
          return res.status(500).json({ message: 'Failed to create snapshot', error: stderr });
        }

        log('Snapshot created successfully');
        res.json({ message: 'Snapshot created successfully', path: './snapshots/emulator.tar.gz' });
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to create snapshot' });
    }
  });

  app.get('/api/android/snapshot/status', async (req, res) => {
    try {
      const fs = require('fs');
      const path = require('path');
      const snapshotPath = path.join(process.cwd(), 'snapshots', 'emulator.tar.gz');

      if (fs.existsSync(snapshotPath)) {
        const stats = fs.statSync(snapshotPath);
        res.json({
          exists: true,
          size: `${(stats.size / 1024 / 1024).toFixed(2)} MB`,
          created: stats.mtime,
        });
      } else {
        res.json({ exists: false });
      }
    } catch (error) {
      res.status(500).json({ message: 'Failed to check snapshot status' });
    }
  });

  app.delete('/api/android/snapshot', async (req, res) => {
    try {
      const fs = require('fs');
      const path = require('path');
      const snapshotPath = path.join(process.cwd(), 'snapshots', 'emulator.tar.gz');

      if (fs.existsSync(snapshotPath)) {
        fs.unlinkSync(snapshotPath);
        res.json({ message: 'Snapshot deleted successfully' });
      } else {
        res.status(404).json({ message: 'No snapshot found' });
      }
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete snapshot' });
    }
  });

  return httpServer;
}


// Background scraping process for Instagram Reels
async function startScrapingProcess(sessionId: string, searchQuery: string, videoCount: number) {
  try {
    log(`Starting scraping session ${sessionId} for query: "${searchQuery}", target: ${videoCount} reels`);

    // Ensure Instagram is running
    await androidService.ensureInstagramRunning(); // Just ensures app is open

    // Search for reels
    await androidService.searchReels(searchQuery);

    // Scrape reels
    const reels = await androidService.scrapeReels(videoCount);
    log(`Found ${reels.length} reels to process`);

    // Process each reel
    for (let i = 0; i < reels.length; i++) {
      if (currentScrapingSession !== sessionId) {
        log('Scraping session stopped by user');
        break;
      }

      const reel = reels[i];

      try {
        // Create video record
        const video = await storage.createVideo({
          sessionId: sessionId, // Add this line
          url: reel.id, // Using reel ID as identifier
          title: reel.title || 'No title',
          thumbnail: reel.thumbnail,
          likes: parseInt(reel.likes.replace(/[^0-9KMB.]/g, '')) || 0,
          comments: parseInt(reel.comments.replace(/[^0-9KMB.]/g, '')) || 0,
          shares: parseInt(reel.shares.replace(/[^0-9KMB.]/g, '')) || 0,
          status: 'analyzing',
        });

        broadcastToClients({
          type: 'video_updated',
          data: video
        });

        // Get comments for this reel
        const comments = await androidService.getReelComments(reel.id, 50);
        log(`Collected ${comments.length} comments for reel ${i + 1}`);

        // Get prompts
        const analysisPrompt = await storage.getActivePrompt('analysis');
        const commentPrompt = await storage.getActivePrompt('comment');

        if (!analysisPrompt || !commentPrompt) {
          throw new Error('System prompts not configured');
        }

        // Analyze with OpenAI
        const analysis = await analyzeReel({
          title: reel.title,
          comments,
          likes: parseInt(reel.likes.replace(/[^0-9]/g, '')) || 0,
          commentCount: parseInt(reel.comments.replace(/[^0-9]/g, '')) || 0,
          shares: parseInt(reel.shares.replace(/[^0-9]/g, '')) || 0,
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

        // Move to next reel (already handled in scrapeReels)

      } catch (error) {
        log(`Error processing reel ${i + 1}: ${error}`);

        // Create video with error status
        const video = await storage.createVideo({
          url: reel.id,
          title: reel.title || 'No title',
          thumbnail: reel.thumbnail,
          likes: parseInt(reel.likes.replace(/[^0-9KMB.]/g, '')) || 0,
          comments: parseInt(reel.comments.replace(/[^0-9KMB.]/g, '')) || 0,
          shares: parseInt(reel.shares.replace(/[^0-9KMB.]/g, '')) || 0,
          status: 'error',
          errorMessage: error instanceof Error ? error.message : 'Analysis failed',
        });

        broadcastToClients({
          type: 'video_updated',
          data: video
        });

        // Update error count
        await storage.updateScrapingSession(sessionId, {
          errorCount: (await storage.getScrapingSession(sessionId))?.errorCount || 0 + 1,
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