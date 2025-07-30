import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { type AndroidConnection } from "@shared/schema";
import { RefreshCw, Smartphone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ConnectionStatusProps {
  connection: AndroidConnection | null;
}

export default function ConnectionStatus({ connection }: ConnectionStatusProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const connectMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/android/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host: 'android', port: 4723 }),
      });
      if (!response.ok) throw new Error('Failed to connect');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/android/status"] });
      toast({ title: "Connected to Android emulator" });
    },
    onError: () => {
      toast({
        title: "Connection Failed",
        description: "Could not connect to Android emulator",
        variant: "destructive",
      });
    },
  });

  const installInstagramMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/android/install-instagram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to install');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Instagram installed successfully" });
    },
    onError: () => {
      toast({
        title: "Installation Failed", 
        description: "Failed to install Instagram APK",
        variant: "destructive",
      });
    },
  });

  const isConnected = connection?.status === 'connected';

  return (
    <div className="space-y-3 p-4 border-b">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Smartphone className="h-4 w-4" />
          <span className="text-sm font-medium">Android Emulator</span>
        </div>
        <Badge variant={isConnected ? "success" : "secondary"}>
          {isConnected ? 'Connected' : 'Disconnected'}
        </Badge>
      </div>
      
      {connection?.errorMessage && (
        <p className="text-xs text-destructive">{connection.errorMessage}</p>
      )}
      
      <div className="flex gap-2">
        <Button
          onClick={() => connectMutation.mutate()}
          disabled={connectMutation.isPending || isConnected}
          size="sm"
          variant="outline"
          className="flex-1"
        >
          <RefreshCw className={`h-3 w-3 mr-1 ${connectMutation.isPending ? 'animate-spin' : ''}`} />
          {isConnected ? 'Connected' : 'Connect'}
        </Button>
        
        {isConnected && connection?.errorMessage?.includes('Instagram is not installed') && (
          <Button
            onClick={() => installInstagramMutation.mutate()}
            disabled={installInstagramMutation.isPending}
            size="sm"
            variant="default"
            className="flex-1"
          >
            Install Instagram
          </Button>
        )}
      </div>
    </div>
  );
}
