import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import ConnectionStatus from "./ConnectionStatus";
import { type ScrapingSession, type AndroidConnection, type SystemPrompt } from "@shared/schema";
import { Play, Pause, Save, Instagram } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SidebarProps {
  androidConnection: AndroidConnection | null;
  activeSession: ScrapingSession | null;
  onSessionUpdate: (session: ScrapingSession | null) => void;
}

export default function Sidebar({ androidConnection: connection, activeSession, onSessionUpdate }: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState("поиск работы");
  const [videoCount, setVideoCount] = useState(10);
  const [editingPrompts, setEditingPrompts] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: prompts = [] } = useQuery<SystemPrompt[]>({
    queryKey: ["/api/prompts"],
  });

  const analysisPrompt = prompts.find(p => p.type === "analysis" && p.isActive);
  const commentPrompt = prompts.find(p => p.type === "comment" && p.isActive);

  const startScrapingMutation = useMutation({
    mutationFn: async (data: { searchQuery: string; videoCount: number }) => {
      const response = await fetch('/api/sessions/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to start');
      return response.json();
    },
    onSuccess: (session) => {
      onSessionUpdate(session);
      toast({ title: "Scraping started" });
    },
    onError: () => {
      toast({ title: "Failed to start", variant: "destructive" });
    },
  });

  const stopScrapingMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await fetch(`/api/sessions/${sessionId}/stop`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to stop');
      return response.json();
    },
    onSuccess: () => {
      onSessionUpdate(null);
      toast({ title: "Scraping stopped" });
    },
  });

  const updatePromptMutation = useMutation({
    mutationFn: async ({ id, prompt }: { id: string; prompt: string }) => {
      const response = await fetch(`/api/prompts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      if (!response.ok) throw new Error('Failed to update');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prompts"] });
      setEditingPrompts(false);
      toast({ title: "Prompts saved" });
    },
  });

  const handleStartScraping = () => {
    if (!searchQuery.trim()) {
      toast({ title: "Enter search query", variant: "destructive" });
      return;
    }

    if (connection?.status !== 'connected') {
      toast({ title: "Connect to Android first", variant: "destructive" });
      return;
    }

    startScrapingMutation.mutate({ searchQuery, videoCount });
  };

  const handleSavePrompts = () => {
    const analysisTextarea = document.getElementById('analysis-prompt') as HTMLTextAreaElement;
    const commentTextarea = document.getElementById('comment-prompt') as HTMLTextAreaElement;

    if (analysisPrompt && analysisTextarea) {
      updatePromptMutation.mutate({ id: analysisPrompt.id, prompt: analysisTextarea.value });
    }

    if (commentPrompt && commentTextarea) {
      updatePromptMutation.mutate({ id: commentPrompt.id, prompt: commentTextarea.value });
    }
  };

  const isScrapingActive = activeSession?.status === 'running';

  return (
    <div className="w-80 bg-white shadow-lg border-r flex flex-col">
      {/* Header */}
      <div className="p-4 border-b flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-500 rounded-lg flex items-center justify-center">
          <Instagram className="text-white text-xl" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">IG Analyzer</h1>
          <p className="text-xs text-muted-foreground">Reels Comment Bot</p>
        </div>
      </div>

      {/* Connection */}
      <ConnectionStatus connection={connection} />

      {/* Scraping Controls */}
      <div className="p-4 border-b space-y-3">
        <div>
          <Label htmlFor="search" className="text-xs">Search Query</Label>
          <Input
            id="search"
            placeholder="поиск работы"
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            disabled={isScrapingActive}
            className="mt-1 h-9"
          />
        </div>
        
        <div>
          <Label htmlFor="count" className="text-xs">Video Count</Label>
          <Input
            id="count"
            type="number"
            min="1"
            max="50"
            value={videoCount}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVideoCount(parseInt(e.target.value) || 10)}
            disabled={isScrapingActive}
            className="mt-1 h-9"
          />
        </div>
        
        <div className="flex gap-2">
          <Button
            onClick={handleStartScraping}
            disabled={isScrapingActive || startScrapingMutation.isPending}
            size="sm"
            className="flex-1"
          >
            <Play className="h-3 w-3 mr-1" />
            Start
          </Button>
          <Button
            onClick={() => activeSession && stopScrapingMutation.mutate(activeSession.id)}
            disabled={!isScrapingActive || stopScrapingMutation.isPending}
            variant="secondary"
            size="sm"
            className="flex-1"
          >
            <Pause className="h-3 w-3 mr-1" />
            Stop
          </Button>
        </div>
      </div>

      {/* Prompts */}
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium">System Prompts</h3>
          <Button
            onClick={() => editingPrompts ? handleSavePrompts() : setEditingPrompts(true)}
            variant="ghost"
            size="sm"
            className="h-7"
          >
            <Save className="h-3 w-3 mr-1" />
            {editingPrompts ? 'Save' : 'Edit'}
          </Button>
        </div>
        
        <div className="space-y-3">
          <div>
            <Label htmlFor="analysis-prompt" className="text-xs">Analysis Prompt</Label>
            <Textarea
              id="analysis-prompt"
              defaultValue={analysisPrompt?.prompt || ''}
              disabled={!editingPrompts}
              className="mt-1 h-20 text-xs resize-none"
              placeholder="Enter analysis prompt..."
            />
          </div>
          
          <div>
            <Label htmlFor="comment-prompt" className="text-xs">Comment Prompt</Label>
            <Textarea
              id="comment-prompt"
              defaultValue={commentPrompt?.prompt || ''}
              disabled={!editingPrompts}
              className="mt-1 h-20 text-xs resize-none"
              placeholder="Enter comment prompt..."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
