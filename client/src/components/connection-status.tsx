import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { type ChromeConnection } from "@shared/schema";
import { RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ConnectionStatusProps {
  connection: ChromeConnection | null;
}

export default function ConnectionStatus({ connection }: ConnectionStatusProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const connectMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/chrome/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ port: 9222 }),
      });
      if (!response.ok) throw new Error('Failed to connect to Chrome');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chrome/status"] });
      toast({
        title: "Connected",
        description: "Successfully connected to Chrome debugging port",
      });
    },
    onError: () => {
      toast({
        title: "Connection Failed",
        description: "Could not connect to Chrome. Make sure Chrome is running with --remote-debugging-port=9222",
        variant: "destructive",
      });
    },
  });

  const isConnected = connection?.status === 'connected';
  const statusColor = isConnected ? 'bg-success' : 'bg-error';
  const statusText = isConnected ? 'Connected' : 'Disconnected';

  return (
    <div className="p-4 border-b border-gray-200">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">Chrome Connection</span>
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 ${statusColor} rounded-full ${isConnected ? 'animate-pulse' : ''}`}></div>
          <span className={`text-xs font-medium ${isConnected ? 'text-success' : 'text-error'}`}>
            {statusText}
          </span>
        </div>
      </div>
      
      <div className="text-xs text-gray-500 mb-2">
        Port: {connection?.port || 9222}
      </div>
      
      {connection?.errorMessage && (
        <div className="text-xs text-error mb-2">
          {connection.errorMessage}
        </div>
      )}
      
      <Button
        onClick={() => connectMutation.mutate()}
        disabled={connectMutation.isPending}
        variant="outline"
        size="sm"
        className="w-full"
      >
        <RefreshCw className={`h-4 w-4 mr-2 ${connectMutation.isPending ? 'animate-spin' : ''}`} />
        {connectMutation.isPending ? 'Connecting...' : 'Reconnect'}
      </Button>
    </div>
  );
}
