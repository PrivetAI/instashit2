import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import ConnectionStatus from "@/components/connection-status";
import { type ScrapingSession, type ChromeConnection, type SystemPrompt } from "@shared/schema";
import { Play, Pause, Edit, Instagram } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SidebarProps {
  chromeConnection: ChromeConnection | null;
  activeSession: ScrapingSession | null;
  onSessionUpdate: (session: ScrapingSession | null) => void;
}

export default function Sidebar({ chromeConnection, activeSession, onSessionUpdate }: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState("поиск работы");
  const [videoCount, setVideoCount] = useState(10);
  const [editingPrompts, setEditingPrompts] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch system prompts
  const { data: prompts = [] } = useQuery<SystemPrompt[]>({
    queryKey: ["/api/prompts"],
  });

  const analysisPrompt = prompts.find(p => p.type === "analysis" && p.isActive);
  const commentPrompt = prompts.find(p => p.type === "comment" && p.isActive);

  // Mutations
  const startScrapingMutation = useMutation({
    mutationFn: async (data: { searchQuery: string; videoCount: number }) => {
      const response = await fetch('/api/sessions/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to start scraping');
      return response.json();
    },
    onSuccess: (session) => {
      onSessionUpdate(session);
      toast({
        title: "Скрапинг запущен",
        description: `Начат анализ по запросу: ${searchQuery}`,
      });
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось запустить сессию скрапинга",
        variant: "destructive",
      });
    },
  });

  const stopScrapingMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await fetch(`/api/sessions/${sessionId}/stop`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to stop scraping');
      return response.json();
    },
    onSuccess: () => {
      onSessionUpdate(null);
      toast({
        title: "Скрапинг остановлен",
        description: "Сессия анализа была остановлена",
      });
    },
  });

  const updatePromptMutation = useMutation({
    mutationFn: async ({ id, prompt }: { id: string; prompt: string }) => {
      const response = await fetch(`/api/prompts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      if (!response.ok) throw new Error('Failed to update prompt');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prompts"] });
      setEditingPrompts(false);
      toast({
        title: "Промпты обновлены",
        description: "Системные промпты были сохранены",
      });
    },
  });

  const handleStartScraping = () => {
    if (!searchQuery.trim()) {
      toast({
        title: "Ошибка",
        description: "Пожалуйста, введите поисковый запрос",
        variant: "destructive",
      });
      return;
    }

    if (chromeConnection?.status !== 'connected') {
      toast({
        title: "Ошибка",
        description: "Chrome не подключен. Сначала подключитесь.",
        variant: "destructive",
      });
      return;
    }

    startScrapingMutation.mutate({ searchQuery, videoCount });
  };

  const handleStopScraping = () => {
    if (activeSession) {
      stopScrapingMutation.mutate(activeSession.id);
    }
  };

  const handleSavePrompts = () => {
    const analysisTextarea = document.getElementById('analysis-prompt') as HTMLTextAreaElement;
    const commentTextarea = document.getElementById('comment-prompt') as HTMLTextAreaElement;

    if (analysisPrompt && analysisTextarea) {
      updatePromptMutation.mutate({
        id: analysisPrompt.id,
        prompt: analysisTextarea.value,
      });
    }

    if (commentPrompt && commentTextarea) {
      updatePromptMutation.mutate({
        id: commentPrompt.id,
        prompt: commentTextarea.value,
      });
    }
  };

  const isScrapingActive = activeSession?.status === 'running';

  return (
    <div className="w-80 bg-white shadow-lg border-r border-gray-200 flex flex-col">
      {/* Sidebar Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 gradient-instagram rounded-lg flex items-center justify-center">
            <Instagram className="text-white text-xl" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">IG Analyzer</h1>
            <p className="text-sm text-gray-500">Reels Comment Bot</p>
          </div>
        </div>
      </div>

      {/* Chrome Connection Status */}
      <ConnectionStatus connection={chromeConnection} />

      {/* Scraping Controls */}
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Управление скрапингом</h3>
        <div className="space-y-3">
          <div>
            <Label htmlFor="search-query" className="text-xs font-medium text-gray-700">
              Поисковый запрос
            </Label>
            <Input
              id="search-query"
              type="text"
              placeholder="поиск работы, вакансии, трудоустройство"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={isScrapingActive}
              className="mt-1"
            />
          </div>
          
          <div>
            <Label htmlFor="video-count" className="text-xs font-medium text-gray-700">
              Количество видео
            </Label>
            <Input
              id="video-count"
              type="number"
              min="1"
              max="50"
              value={videoCount}
              onChange={(e) => setVideoCount(parseInt(e.target.value) || 10)}
              disabled={isScrapingActive}
              className="mt-1"
            />
          </div>
          
          <div className="flex space-x-2">
            <Button
              onClick={handleStartScraping}
              disabled={isScrapingActive || startScrapingMutation.isPending}
              className="flex-1 bg-primary hover:bg-blue-700"
              size="sm"
            >
              <Play className="h-4 w-4 mr-2" />
              Запуск
            </Button>
            <Button
              onClick={handleStopScraping}
              disabled={!isScrapingActive || stopScrapingMutation.isPending}
              variant="secondary"
              className="flex-1"
              size="sm"
            >
              <Pause className="h-4 w-4 mr-2" />
              Стоп
            </Button>
          </div>
        </div>
      </div>

      {/* System Prompts */}
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-900">Системные промпты</h3>
          <Button
            onClick={() => setEditingPrompts(!editingPrompts)}
            variant="ghost"
            size="sm"
            className="text-xs text-primary hover:text-blue-700"
          >
            <Edit className="h-3 w-3 mr-1" />
            {editingPrompts ? 'Отмена' : 'Редактировать'}
          </Button>
        </div>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="analysis-prompt" className="text-xs font-medium text-gray-700">
              Промпт для анализа
            </Label>
            <Textarea
              id="analysis-prompt"
              defaultValue={analysisPrompt?.prompt || ''}
              disabled={!editingPrompts}
              className="mt-1 h-24 text-xs resize-none"
              placeholder="Введите промпт для анализа..."
            />
          </div>
          
          <div>
            <Label htmlFor="comment-prompt" className="text-xs font-medium text-gray-700">
              Промпт для комментариев
            </Label>
            <Textarea
              id="comment-prompt"
              defaultValue={commentPrompt?.prompt || ''}
              disabled={!editingPrompts}
              className="mt-1 h-24 text-xs resize-none"
              placeholder="Введите промпт для генерации комментариев..."
            />
          </div>
          
          {editingPrompts && (
            <Button
              onClick={handleSavePrompts}
              disabled={updatePromptMutation.isPending}
              className="w-full"
              size="sm"
            >
              Сохранить промпты
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
