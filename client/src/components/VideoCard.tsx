import { type Video } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Clock, ExternalLink, RotateCcw } from "lucide-react";

interface VideoCardProps {
  video: Video;
  onApprove: (video: Video) => void;
  onReject: (video: Video) => void;
}

export default function VideoCard({ video, onApprove, onReject }: VideoCardProps) {
  const getStatusBadge = () => {
    const statusConfig = {
      analyzing: { label: 'Analyzing', variant: 'default' as const },
      pending: { label: 'Pending', variant: 'secondary' as const },
      posted: { label: 'Posted', variant: 'success' as const },
      rejected: { label: 'Rejected', variant: 'destructive' as const },
      error: { label: 'Error', variant: 'destructive' as const },
      queued: { label: 'Queued', variant: 'outline' as const },
    };
    
    const config = statusConfig[video.status] || { label: 'Unknown', variant: 'outline' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getRelevanceColor = () => {
    if (!video.relevanceScore) return 'text-muted-foreground';
    return video.relevanceScore >= 8 ? 'text-success' : 
           video.relevanceScore >= 6 ? 'text-warning' : 
           'text-destructive';
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border overflow-hidden hover:shadow-md transition-shadow">
      {/* Thumbnail */}
      <div className="relative h-32 bg-gray-100">
        {video.thumbnail ? (
          <img src={video.thumbnail} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            No thumbnail
          </div>
        )}
        
        <div className="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
          ▶ {video.likes ? `${(video.likes / 1000).toFixed(1)}K` : '0'}
        </div>
        
        <div className="absolute bottom-2 left-2">
          {getStatusBadge()}
        </div>
      </div>
      
      <div className="p-3 space-y-2">
        {/* Title & Score */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-medium line-clamp-2 flex-1">{video.title}</h3>
          {video.relevanceScore && (
            <span className={`text-sm font-medium ${getRelevanceColor()}`}>
              {video.relevanceScore}/10
            </span>
          )}
        </div>
        
        {/* Stats */}
        <div className="flex gap-3 text-xs text-muted-foreground">
          <span>❤️ {video.likes?.toLocaleString() || '0'}</span>
          <span>💬 {video.comments?.toLocaleString() || '0'}</span>
          <span>📤 {video.shares?.toLocaleString() || '0'}</span>
        </div>
        
        {/* Status Content */}
        {video.status === 'pending' && video.generatedComment && (
          <div className="bg-gray-50 p-2 rounded text-xs">
            <div className="font-medium mb-1">Comment:</div>
            <div className="text-muted-foreground">{video.generatedComment}</div>
          </div>
        )}
        
        {video.status === 'posted' && video.postedComment && (
          <div className="bg-success/10 p-2 rounded text-xs">
            <div className="font-medium text-success mb-1">✓ Posted:</div>
            <div className="text-muted-foreground">{video.postedComment}</div>
          </div>
        )}
        
        {(video.status === 'error' || video.status === 'rejected') && video.errorMessage && (
          <div className="bg-destructive/10 p-2 rounded text-xs">
            <div className="font-medium text-destructive mb-1">
              {video.status === 'error' ? '⚠️ Error:' : '✗ Rejected:'}
            </div>
            <div className="text-muted-foreground">{video.errorMessage}</div>
          </div>
        )}
        
        {video.status === 'analyzing' && (
          <div className="bg-primary/10 p-2 rounded text-xs">
            <div className="text-primary mb-1">🔄 Analyzing content...</div>
            <div className="w-full bg-gray-200 rounded-full h-1">
              <div className="bg-primary h-1 rounded-full animate-pulse w-2/3"></div>
            </div>
          </div>
        )}
        
        {/* Actions */}
        <div className="pt-2">
          {video.status === 'pending' && (
            <div className="flex gap-2">
              <Button onClick={() => onApprove(video)} size="sm" className="flex-1">
                <Check className="h-3 w-3 mr-1" />
                Approve
              </Button>
              <Button onClick={() => onReject(video)} size="sm" variant="destructive" className="flex-1">
                <X className="h-3 w-3 mr-1" />
                Reject
              </Button>
            </div>
          )}
          
          {video.status === 'analyzing' && (
            <Button disabled size="sm" className="w-full">
              <Clock className="h-3 w-3 mr-1" />
              Analyzing...
            </Button>
          )}
          
          {video.status === 'posted' && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Posted {new Date(video.updatedAt!).toLocaleTimeString()}</span>
              <Button variant="ghost" size="sm" className="h-7" asChild>
                <a href={video.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            </div>
          )}
          
          {video.status === 'error' && (
            <Button size="sm" className="w-full">
              <RotateCcw className="h-3 w-3 mr-1" />
              Retry
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}