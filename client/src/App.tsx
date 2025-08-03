import { useState, useEffect } from "react";
import { type Video, type ScrapingSession, type AndroidConnection, type SystemPrompt } from "@shared/schema";

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
  const [searchQuery, setSearchQuery] = useState("поиск работы");
  const [videoCount, setVideoCount] = useState(10);
  const [ws, setWs] = useState<WebSocket | null>(null);
  // new functionality const [snapshot, setSnapshot] = useState<any>(null);


  // Initialize WebSocket
  useEffect(() => {
    const socket = new WebSocket('/ws');
    
    socket.onmessage = (event) => { 
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'video_updated':
          setVideos(prev => {
            const exists = prev.find(v => v.id === data.data.id);
            if (exists) {
              return prev.map(v => v.id === data.data.id ? data.data : v);
            }
            return [data.data, ...prev];
          });
          break;
        case 'session_updated':
          setSession(data.data);
          break;
        case 'connection_status':
          setConnection(prev => ({
            id: prev?.id || '1',
            status: data.data.status,
            host: data.data.host,
            port: data.data.port,
            errorMessage: data.data.error || null,
            lastConnected: null,
            createdAt: prev?.createdAt || new Date(),
            updatedAt: new Date(),
          }));
          break;
      }
    };
    
    setWs(socket);
    return () => socket.close();
  }, []);

  // Load initial data
  useEffect(() => {
    fetch('/api/videos').then(r => r.json()).then(setVideos);
    fetch('/api/sessions').then(r => r.json()).then(setSession);
    fetch('/api/android/status').then(r => r.json()).then(setConnection);
    fetch('/api/prompts').then(r => r.json()).then(setPrompts);
  }, []);

  const connect = async () => {
    try {
      await fetch('/api/android/connect', { method: 'POST' });
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
      const res = await fetch('/api/sessions/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ searchQuery, videoCount }),
      });
      const data = await res.json();
      setSession(data);
    } catch (error) {
      alert('Failed to start scraping');
    }
  };

  const stopScraping = async () => {
    if (!session) return;
    
    try {
      await fetch(`/api/sessions/${session.id}/stop`, { method: 'POST' });
      setSession(null);
    } catch (error) {
      alert('Failed to stop');
    }
  };

  const approveVideo = async (video: Video) => {
    if (!confirm(`Post comment: "${video.generatedComment}"?`)) return;
    
    try {
      await fetch(`/api/videos/${video.id}/approve`, { method: 'POST' });
    } catch (error) {
      alert('Failed to approve');
    }
  };

  const rejectVideo = async (video: Video) => {
    try {
      await fetch(`/api/videos/${video.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Rejected by user' }),
      });
    } catch (error) {
      alert('Failed to reject');
    }
  };

  const updatePrompt = async (id: string, prompt: string) => {
    try {
      await fetch(`/api/prompts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      alert('Prompt saved');
      fetch('/api/prompts').then(r => r.json()).then(setPrompts);
    } catch (error) {
      alert('Failed to save prompt');
    }
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

          <div>
            <div className="label">Prompts</div>
            {prompts.map(prompt => (
              <div key={prompt.id} className="mb-10">
                <div style={{ fontSize: '12px', marginBottom: '5px' }}>
                  {prompt.type}:
                </div>
                <textarea
                  className="textarea"
                  defaultValue={prompt.prompt}
                  onBlur={e => updatePrompt(prompt.id, e.target.value)}
                />
              </div>
            ))}
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