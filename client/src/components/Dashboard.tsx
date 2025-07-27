import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/sidebar";
import VideoCard from "@/components/video-card";
import ConfirmationModal from "@/components/ConfirmationModal";
import { useWebSocket } from "@/hooks/use-websocket";
import { type Video, type ScrapingSession, type AndroidConnection } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Play, Download } from "lucide-react";

export default function Dashboard() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [activeSession, setActiveSession] = useState<ScrapingSession | null>(null);
  const [androidConnection, setAndroidConnection] = useState<AndroidConnection | null>(null);
  const [confirmationVideo, setConfirmationVideo] = useState<Video | null>(null);

  // Fetch initial data
  const { data: initialVideos } = useQuery({
    queryKey: ["/api/videos"],
  });

  const { data: initialSession } = useQuery({
    queryKey: ["/api/sessions"],
  });

  const { data: initialConnection } = useQuery({
    queryKey: ["/api/android/status"],
  });

  // WebSocket for real-time updates
  useWebSocket('/ws', {
    onMessage: (event) => {
      switch (event.type) {
        case 'video_updated':
          setVideos(prev => {
            const existing = prev.find(v => v.id === event.data.id);
            if (existing) {
              return prev.map(v => v.id === event.data.id ? event.data : v);
            } else {
              return [event.data, ...prev];
            }
          });
          break;
        case 'session_updated':
          setActiveSession(event.data);
          break;
        case 'connection_status':
          setAndroidConnection(prev => prev ? {
            ...prev,
            status: event.data.status,
            host: event.data.host,
            port: event.data.port,
            errorMessage: event.data.error || null,
          } : null);
          break;
      }
    },
  });

  // Initialize state from queries
  useEffect(() => {
    if (initialVideos) setVideos(initialVideos as Video[]);
  }, [initialVideos]);

  useEffect(() => {
    if (initialSession) setActiveSession(initialSession as ScrapingSession);
  }, [initialSession]);

  useEffect(() => {
    if (initialConnection) setAndroidConnection(initialConnection as AndroidConnection);
  }, [initialConnection]);

  const handleApprove = (video: Video) => {
    setConfirmationVideo(video);
  };

  const handleReject = async (video: Video) => {
    try {
      await fetch(`/api/videos/${video.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Rejected by user' }),
      });
    } catch (error) {
      console.error('Failed to reject video:', error);
    }
  };

  const handleConfirmPost = async () => {
    if (!confirmationVideo) return;

    try {
      await fetch(`/api/videos/${confirmationVideo.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      setConfirmationVideo(null);
    } catch (error) {
      console.error('Failed to approve video:', error);
    }
  };

  const handleExport = () => {
    const data = {
      session: activeSession,
      videos: videos,
      exportedAt: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `instagram-analysis-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const stats = {
    processed: activeSession?.processedCount || 0,
    approved: activeSession?.approvedCount || 0,
    rejected: activeSession?.rejectedCount || 0,
    total: activeSession?.videoCount || 0,
    progress: activeSession?.videoCount ? 
      Math.round((activeSession.processedCount || 0) / activeSession.videoCount * 100) : 0
  };

  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar 
        connection={androidConnection}
        activeSession={activeSession}
        onSessionUpdate={setActiveSession}
      />

      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white shadow-sm border-b px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold">Analysis Panel</h2>
              {activeSession?.status === 'running' && (
                <Badge variant="default" className="animate-pulse">
                  Scraping Active
                </Badge>
              )}
            </div>
            
            <Button onClick={handleExport} variant="outline" size="sm">
              <Download className="h-3 w-3 mr-1" />
              Export
            </Button>
          </div>
          
          {/* Stats */}
          <div className="flex items-center gap-6 text-sm">
            <div>
              <span className="text-muted-foreground">Processed:</span>
              <span className="ml-1 font-medium">{stats.processed}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Approved:</span>
              <span className="ml-1 font-medium text-success">{stats.approved}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Rejected:</span>
              <span className="ml-1 font-medium text-destructive">{stats.rejected}</span>
            </div>
          </div>
          
          {/* Progress */}
          {stats.total > 0 && (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Progress</span>
                <span>{stats.progress}%</span>
              </div>
              <Progress value={stats.progress} className="h-2" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {videos.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
              {videos.map((video) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  onApprove={handleApprove}
                  onReject={handleReject}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">🎥</div>
              <h3 className="text-lg font-medium mb-2">No videos to analyze</h3>
              <p className="text-muted-foreground mb-6">
                Enter a search query and start scraping to analyze reels
              </p>
              <Button>
                <Play className="h-3 w-3 mr-1" />
                Start Scraping
              </Button>
            </div>
          )}
        </div>
      </div>

      <ConfirmationModal
        video={confirmationVideo}
        onConfirm={handleConfirmPost}
        onCancel={() => setConfirmationVideo(null)}
      />
    </div>
  );
}