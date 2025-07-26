import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/sidebar";
import VideoCard from "@/components/video-card";
import ConfirmationModal from "@/components/confirmation-modal";
import { useWebSocket } from "@/hooks/use-websocket";
import { type Video, type ScrapingSession, type ChromeConnection } from "@shared/schema";
import { Play, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [activeSession, setActiveSession] = useState<ScrapingSession | null>(null);
  const [chromeConnection, setChromeConnection] = useState<ChromeConnection | null>(null);
  const [confirmationVideo, setConfirmationVideo] = useState<Video | null>(null);

  // Fetch initial data
  const { data: initialVideos } = useQuery({
    queryKey: ["/api/videos"],
  });

  const { data: initialSession } = useQuery({
    queryKey: ["/api/sessions"],
  });

  const { data: initialConnection } = useQuery({
    queryKey: ["/api/chrome/status"],
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
          setChromeConnection(prev => prev ? {
            ...prev,
            status: event.data.status,
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
    if (initialConnection) setChromeConnection(initialConnection as ChromeConnection);
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

  const processedCount = activeSession?.processedCount || 0;
  const approvedCount = activeSession?.approvedCount || 0;
  const rejectedCount = activeSession?.rejectedCount || 0;
  const totalCount = activeSession?.videoCount || 0;
  const progressPercentage = totalCount > 0 ? Math.round((processedCount / totalCount) * 100) : 0;

  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar 
        chromeConnection={chromeConnection}
        activeSession={activeSession}
        onSessionUpdate={setActiveSession}
      />

      <div className="flex-1 flex flex-col">
        {/* Header Bar */}
        <div className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h2 className="text-xl font-semibold text-gray-900">Панель анализа</h2>
              {activeSession?.status === 'running' && (
                <div className="flex items-center space-x-2 bg-success/10 px-3 py-1 rounded-full">
                  <div className="w-2 h-2 bg-success rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium text-success">Скрапинг активен</span>
                </div>
              )}
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Progress Stats */}
              <div className="flex items-center space-x-6 text-sm">
                <div className="text-center">
                  <div className="font-semibold text-gray-900">{processedCount}</div>
                  <div className="text-gray-500">Обработано</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-success">{approvedCount}</div>
                  <div className="text-gray-500">Одобрено</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-error">{rejectedCount}</div>
                  <div className="text-gray-500">Отклонено</div>
                </div>
              </div>
              
              <Button onClick={handleExport} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Экспорт
              </Button>
            </div>
          </div>
          
          {/* Progress Bar */}
          {totalCount > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Прогресс</span>
                <span className="text-sm text-gray-600">{progressPercentage}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        {/* Video Cards Grid */}
        <div className="flex-1 p-6 overflow-y-auto">
          {videos.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
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
            /* Empty State */
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🎥</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Нет видео для анализа</h3>
              <p className="text-gray-500 mb-6">Введите поисковый запрос и запустите скрапинг для начала анализа.</p>
              <Button className="bg-primary hover:bg-blue-700">
                <Play className="h-4 w-4 mr-2" />
                Запустить скрапинг
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        video={confirmationVideo}
        onConfirm={handleConfirmPost}
        onCancel={() => setConfirmationVideo(null)}
      />
    </div>
  );
}
