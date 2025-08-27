import { useState, useEffect } from "react";
import { type Video, type ScrapingSession, type AndroidConnection, type SystemPrompt } from "@shared/schema";
import { apiService } from "./apiService";

// Simple styles
const styles = `
  body { font-family: Arial, sans-serif; margin: 0; background: #f5f5f5; }
  .container { display: flex; height: 100vh; }
  .sidebar { width: 300px; background: white; border-right: 1px solid #ddd; padding: 20px; overflow-y: auto; }
  .main { flex: 1; padding: 20px; overflow-y: auto; }
  .header { margin-bottom: 20px; }
  .card { background: white; border: 1px solid #ddd; padding: 15px; margin-bottom: 10px; }
  .btn { padding: 8px 16px; border: 1px solid #ddd; background: white; cursor: pointer; margin-right: 5px; }
  .btn:hover { background: #f0f0f0; }
  .btn-primary { background: #007bff; color: white; border-color: #007bff; }
  .btn-danger { background: #dc3545; color: white; border-color: #dc3545; }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .input, .textarea { width: 100%; padding: 8px; border: 1px solid #ddd; margin-bottom: 10px; }
  .textarea { min-height: 80px; resize: vertical; }
  .status { padding: 4px 8px; border-radius: 3px; font-size: 12px; }
  .status-connected { background: #28a745; color: white; }
  .status-disconnected { background: #6c757d; color: white; }
  .status-error { background: #dc3545; color: white; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 15px; }
  .label { font-weight: bold; margin-bottom: 5px; }
  .mb-10 { margin-bottom: 10px; }
  .mb-20 { margin-bottom: 20px; }
`;

export default function App() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [session, setSession] = useState<ScrapingSession | null>(null);
  const [connection, setConnection] = useState<AndroidConnection | null>(null);
  const [prompts, setPrompts] = useState<SystemPrompt[]>([]);
  const [promptValues, setPromptValues] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("поиск работы");
  const [videoCount, setVideoCount] = useState(10);

  // Initialize WebSocket
  useEffect(() => {
    const ws = apiService.initWebSocket({
      onVideoUpdated: (video) => {
        setVideos(prev => {
          const exists = prev.find(v => v.id === video.id);
          if (exists) {
            return prev.map(v => v.id === video.id ? video : v);
          }
          return [video, ...prev];
        });
      },
      onSessionUpdated: (sessionData) => {
        setSession(sessionData);
      },
      onConnectionStatus: (status) => {
        setConnection(prev => ({
          id: prev?.id || '1',
          status: status.status,
          host: status.host,
          port: status.port,
          errorMessage: status.error || null,
          lastConnected: null,
          createdAt: prev?.createdAt || new Date(),
          updatedAt: new Date(),
        }));
      }
    });
    
    return () => apiService.closeWebSocket();
  }, []);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [videosData, sessionData, connectionData, promptsData] = await Promise.all([
          apiService.getVideos(),
          apiService.getSessions(),
          apiService.getAndroidStatus(),
          apiService.getPrompts()
        ]);
        
        setVideos(videosData);
        setSession(sessionData);
        setConnection(connectionData);
        setPrompts(promptsData);
        
        // Initialize prompt values
        const initialPromptValues = promptsData.reduce((acc, prompt) => {
          acc[prompt.id] = prompt.prompt;
          return acc;
        }, {} as Record<string, string>);
        setPromptValues(initialPromptValues);
      } catch (error) {
        console.error('Failed to load initial data:', error);
      }
    };
    
    loadData();
  }, []);

  const connect = async () => {
    try {
      await apiService.connectAndroid();
    } catch (error) {
      alert('Failed to connect');
    }
  };

  const startScraping = async () => {
    if (connection?.status !== 'connected') {
      alert('Connect to Android first');
      return;
    }
    
    try {
      const sessionData = await apiService.startScraping(searchQuery, videoCount);
      setSession(sessionData);
    } catch (error) {
      alert('Failed to start scraping');
    }
  };

  const stopScraping = async () => {
    if (!session) return;
    
    try {
      await apiService.stopScraping(session.id);
      setSession(null);
    } catch (error) {
      alert('Failed to stop scraping');
    }
  };

  const approveVideo = async (video: Video) => {
    if (!confirm(`Post comment: "${video.generatedComment}"?`)) return;
    
    try {
      await apiService.approveVideo(video.id);
    } catch (error) {
      alert('Failed to approve video');
    }
  };

  const rejectVideo = async (video: Video) => {
    try {
      await apiService.rejectVideo(video.id);
    } catch (error) {
      alert('Failed to reject video');
    }
  };

  const updatePrompt = async (id: string) => {
    const prompt = promptValues[id];
    if (!prompt) return;
    
    try {
      await apiService.updatePrompt(id, prompt);
      alert('Prompt saved');
      const updatedPrompts = await apiService.getPrompts();
      setPrompts(updatedPrompts);
    } catch (error) {
      alert('Failed to save prompt');
    }
  };

  const handlePromptChange = (id: string, value: string) => {
    setPromptValues(prev => ({
      ...prev,
      [id]: value
    }));
  };

  return (
    <>
      <style>{styles}</style>
      <div className="container">
        <div className="sidebar">
          <h2>IG Analyzer</h2>
          
          <div className="mb-20">
            <div className="label">Connection</div>
            <div className="mb-10">
              Status: <span className={`status status-${connection?.status || 'disconnected'}`}>
                {connection?.status || 'disconnected'}
              </span>
            </div>
            <button className="btn btn-primary" onClick={connect} disabled={connection?.status === 'connected'}>
              Connect
            </button>
          </div>

          <div className="mb-20">
            <div className="label">Search Query</div>
            <input 
              className="input" 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)}
              disabled={session?.status === 'running'}
            />
            
            <div className="label">Video Count</div>
            <input 
              className="input" 
              type="number" 
              value={videoCount} 
              onChange={e => setVideoCount(Number(e.target.value))}
              disabled={session?.status === 'running'}
            />
            
            <button 
              className="btn btn-primary" 
              onClick={startScraping}
              disabled={session?.status === 'running'}
            >
              Start
            </button>
            <button 
              className="btn" 
              onClick={stopScraping}
              disabled={session?.status !== 'running'}
            >
              Stop
            </button>
          </div>

          <div className="mb-20">
            <div className="label">Prompts</div>
            {prompts.length > 0 ? (
              prompts.map(prompt => (
                <div key={prompt.id} className="mb-10">
                  <div style={{ fontSize: '12px', marginBottom: '5px' }}>
                    {prompt.type}:
                  </div>
                  <textarea
                    className="textarea"
                    value={promptValues[prompt.id] || ''}
                    onChange={e => handlePromptChange(prompt.id, e.target.value)}
                  />
                  <button 
                    className="btn btn-primary" 
                    onClick={() => updatePrompt(prompt.id)}
                    style={{ marginTop: '5px' }}
                  >
                    Save
                  </button>
                </div>
              ))
            ) : (
              <div style={{ fontSize: '12px', color: '#666', padding: '10px 0' }}>
                Loading prompts...
              </div>
            )}
          </div>
        </div>

        <div className="main">
          <div className="header">
            <h2>Videos</h2>
            {session && (
              <div>
                Processed: {session.processedCount || 0} / {session.videoCount} | 
                Approved: {session.approvedCount || 0} | 
                Rejected: {session.rejectedCount || 0}
              </div>
            )}
          </div>

          <div className="grid">
            {videos.map(video => (
              <div key={video.id} className="card">
                <div><strong>{video.title || 'No title'}</strong></div>
                <div style={{ fontSize: '12px', color: '#666', margin: '10px 0' }}>
                  ❤️ {video.likes} | 💬 {video.comments} | 📤 {video.shares}
                </div>
                
                {video.relevanceScore && (
                  <div>Score: {video.relevanceScore}/10</div>
                )}
                
                {video.status === 'pending' && video.generatedComment && (
                  <div style={{ background: '#f0f0f0', padding: '10px', margin: '10px 0' }}>
                    Comment: {video.generatedComment}
                  </div>
                )}
                
                {video.status === 'posted' && (
                  <div style={{ color: 'green' }}>✓ Posted</div>
                )}
                
                {video.status === 'error' && (
                  <div style={{ color: 'red' }}>Error: {video.errorMessage}</div>
                )}
                
                {video.status === 'pending' && (
                  <div style={{ marginTop: '10px' }}>
                    <button className="btn btn-primary" onClick={() => approveVideo(video)}>
                      Approve
                    </button>
                    <button className="btn btn-danger" onClick={() => rejectVideo(video)}>
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}