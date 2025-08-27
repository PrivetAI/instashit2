import { useState, useEffect } from "react";
import { type Video, type ScrapingSession, type AndroidConnection, type SystemPrompt } from "@shared/schema";
import { apiService } from "./apiService";

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
  .input, .textarea { width: 100%; padding: 8px; border: 1px solid #ddd; margin-bottom: 10px; box-sizing: border-box; }
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

  useEffect(() => {
    const ws = apiService.initWebSocket({
      onVideoUpdated: (video) => {
        setVideos(prev => {
          const exists = prev.find(v => v.id === video.id);
          return exists ? prev.map(v => v.id === video.id ? video : v) : [video, ...prev];
        });
      },
      onSessionUpdated: setSession,
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

  useEffect(() => {
    const loadData = async () => {
      const [videosData, sessionData, connectionData, promptsData] = await Promise.allSettled([
        apiService.getVideos(),
        apiService.getSessions(),
        apiService.getAndroidStatus(),
        apiService.getPrompts()
      ]);

      if (videosData.status === 'fulfilled') setVideos(videosData.value || []);
      if (sessionData.status === 'fulfilled') setSession(sessionData.value);
      if (connectionData.status === 'fulfilled') setConnection(connectionData.value);
      if (promptsData.status === 'fulfilled') {
        const prompts = promptsData.value || [];
        setPrompts(prompts);
        setPromptValues(prompts.reduce((acc, prompt) => {
          acc[prompt.id] = prompt.prompt || '';
          return acc;
        }, {} as Record<string, string>));
      }
    };
    loadData();
  }, []);

  const connect = () => apiService.connectAndroid().catch(() => alert('Failed to connect'));

  const startScraping = async () => {
    if (connection?.status !== 'connected') return alert('Connect to Android first');
    try {
      setSession(await apiService.startScraping(searchQuery, videoCount));
    } catch { alert('Failed to start scraping'); }
  };

  const stopScraping = () => session && apiService.stopScraping(session.id).catch(() => alert('Failed to stop scraping'));

  const approveVideo = (video: Video) => {
    if (confirm(`Post comment: "${video.generatedComment}"?`)) {
      apiService.approveVideo(video.id).catch(() => alert('Failed to approve video'));
    }
  };

  const rejectVideo = (video: Video) => apiService.rejectVideo(video.id).catch(() => alert('Failed to reject video'));

  const updatePrompt = async (id: string) => {
    const prompt = promptValues[id];
    if (!prompt?.trim()) return alert('Prompt cannot be empty');
    
    try {
      await apiService.updatePrompt(id, prompt);
      alert('Prompt saved successfully');
      const updatedPrompts = await apiService.getPrompts();
      setPrompts(updatedPrompts || []);
      setPromptValues((updatedPrompts || []).reduce((acc, p) => {
        acc[p.id] = p.prompt || '';
        return acc;
      }, {} as Record<string, string>));
    } catch { alert('Failed to save prompt'); }
  };

  const handlePromptChange = (id: string, value: string) => {
    setPromptValues(prev => ({ ...prev, [id]: value }));
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
            <div className="label">System Prompts</div>
            {prompts.length > 0 ? prompts.map(prompt => (
              <div key={prompt.id} className="mb-10">
                <div style={{ fontSize: '12px', marginBottom: '5px', textTransform: 'capitalize' }}>
                  {prompt.type} Prompt:
                </div>
                <textarea
                  className="textarea"
                  value={promptValues[prompt.id] || ''}
                  onChange={e => handlePromptChange(prompt.id, e.target.value)}
                  placeholder={`Enter ${prompt.type} prompt...`}
                />
                <button 
                  className="btn btn-primary" 
                  onClick={() => updatePrompt(prompt.id)}
                  style={{ marginTop: '5px' }}
                  disabled={!promptValues[prompt.id]?.trim()}
                >
                  Save {prompt.type}
                </button>
              </div>
            )) : (
              <div style={{ fontSize: '12px', color: '#666', padding: '10px 0' }}>
                No prompts found.
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
            {videos.length > 0 ? videos.map(video => (
              <div key={video.id} className="card">
                <div><strong>{video.title || 'No title'}</strong></div>
                <div style={{ fontSize: '12px', color: '#666', margin: '10px 0' }}>
                  ❤️ {video.likes} | 💬 {video.comments} | 📤 {video.shares}
                </div>
                
                {video.relevanceScore && <div>Score: {video.relevanceScore}/10</div>}
                
                {video.status === 'pending' && video.generatedComment && (
                  <div style={{ background: '#f0f0f0', padding: '10px', margin: '10px 0' }}>
                    Comment: {video.generatedComment}
                  </div>
                )}
                
                {video.status === 'posted' && <div style={{ color: 'green' }}>✓ Posted</div>}
                {video.status === 'error' && <div style={{ color: 'red' }}>Error: {video.errorMessage}</div>}
                
                {video.status === 'pending' && (
                  <div style={{ marginTop: '10px' }}>
                    <button className="btn btn-primary" onClick={() => approveVideo(video)}>Approve</button>
                    <button className="btn btn-danger" onClick={() => rejectVideo(video)}>Reject</button>
                  </div>
                )}
              </div>
            )) : (
              <div style={{ fontSize: '14px', color: '#666', padding: '20px 0' }}>
                No videos found. Start scraping to see results.
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}