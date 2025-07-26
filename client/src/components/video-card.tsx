import { type Video } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Check, X, Clock, AlertCircle, ExternalLink, RotateCcw } from "lucide-react";

interface VideoCardProps {
  video: Video;
  onApprove: (video: Video) => void;
  onReject: (video: Video) => void;
}

export default function VideoCard({ video, onApprove, onReject }: VideoCardProps) {
  const getStatusIcon = () => {
    switch (video.status) {
      case 'analyzing':
        return <div className="w-3 h-3 bg-primary rounded-full animate-pulse" />;
      case 'pending':
        return <div className="w-3 h-3 bg-warning rounded-full animate-pulse" />;
      case 'posted':
        return <div className="w-3 h-3 bg-success rounded-full" />;
      case 'rejected':
        return <div className="w-3 h-3 bg-error rounded-full" />;
      case 'error':
        return <div className="w-3 h-3 bg-error rounded-full" />;
      default:
        return <div className="w-3 h-3 bg-gray-400 rounded-full" />;
    }
  };

  const getStatusText = () => {
    switch (video.status) {
      case 'analyzing':
        return 'Analyzing';
      case 'pending':
        return 'Processing';
      case 'posted':
        return 'Posted';
      case 'rejected':
        return 'Rejected';
      case 'error':
        return 'Error';
      case 'queued':
        return 'Queued';
      default:
        return 'Unknown';
    }
  };

  const getRelevanceDisplay = () => {
    if (video.relevanceScore) {
      const score = video.relevanceScore;
      const colorClass = score >= 8 ? 'text-success bg-success/10' : 
                        score >= 6 ? 'text-warning bg-warning/10' : 
                        'text-error bg-error/10';
      return (
        <div className={`px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>
          {score}/10
        </div>
      );
    }
    return (
      <div className="bg-gray-100 text-gray-400 px-2 py-1 rounded-full text-xs font-medium animate-pulse">
        ---
      </div>
    );
  };

  const cardOpacity = video.status === 'rejected' || video.status === 'queued' ? 'opacity-75' : '';

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow ${cardOpacity}`}>
      <div className="relative">
        {video.thumbnail ? (
          <img 
            src={video.thumbnail} 
            alt="Instagram reel thumbnail" 
            className="w-full h-32 object-cover"
          />
        ) : (
          <div className="w-full h-32 bg-gray-200 flex items-center justify-center">
            <div className="text-gray-400">No thumbnail</div>
          </div>
        )}
        
        <div className="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-xs font-medium">
          <span className="mr-1">▶</span>
          {video.likes ? `${(video.likes / 1000).toFixed(1)}K` : '0'}
        </div>
        
        <div className="absolute bottom-2 left-2">
          <div className="flex items-center space-x-1">
            {getStatusIcon()}
            <span className="text-xs text-white font-medium bg-black/70 px-2 py-1 rounded">
              {getStatusText()}
            </span>
          </div>
        </div>
      </div>
      
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-medium text-gray-900 text-sm line-clamp-2 flex-1">
            {video.title}
          </h3>
          <div className="ml-2 flex-shrink-0">
            {getRelevanceDisplay()}
          </div>
        </div>
        
        <div className="space-y-2 mb-3">
          <div className="flex items-center text-xs text-gray-500">
            <span className="mr-1">❤️</span>
            <span>{video.likes?.toLocaleString() || '0'}</span>
            <span className="ml-3 mr-1">💬</span>
            <span>{video.comments?.toLocaleString() || '0'}</span>
            <span className="ml-3 mr-1">📤</span>
            <span>{video.shares?.toLocaleString() || '0'}</span>
          </div>
          
          {/* Status-specific content */}
          {video.status === 'pending' && video.generatedComment && (
            <div className="bg-gray-50 p-2 rounded text-xs">
              <div className="font-medium text-gray-700 mb-1">Generated Comment:</div>
              <div className="text-gray-600">{video.generatedComment}</div>
            </div>
          )}
          
          {video.status === 'posted' && video.postedComment && (
            <div className="bg-success/5 border border-success/20 p-2 rounded text-xs">
              <div className="font-medium text-success mb-1">✓ Comment Posted:</div>
              <div className="text-gray-600">{video.postedComment}</div>
            </div>
          )}
          
          {video.status === 'rejected' && (
            <div className="bg-error/5 border border-error/20 p-2 rounded text-xs">
              <div className="font-medium text-error mb-1">✗ Rejected:</div>
              <div className="text-gray-600">{video.errorMessage || 'Rejected by user'}</div>
            </div>
          )}
          
          {video.status === 'error' && (
            <div className="bg-error/5 border border-error/20 p-2 rounded text-xs">
              <div className="font-medium text-error mb-1">⚠️ Analysis Failed:</div>
              <div className="text-gray-600">{video.errorMessage || 'Unknown error occurred'}</div>
            </div>
          )}
          
          {video.status === 'analyzing' && (
            <div className="bg-primary/5 border border-primary/20 p-2 rounded text-xs">
              <div className="font-medium text-primary mb-1">🔄 Analyzing content...</div>
              <div className="text-gray-600">Extracting comments, analyzing sentiment, generating response...</div>
              <div className="mt-2 w-full bg-gray-200 rounded-full h-1">
                <div className="bg-primary h-1 rounded-full animate-pulse" style={{ width: '65%' }}></div>
              </div>
            </div>
          )}
          
          {video.status === 'queued' && (
            <div className="bg-gray-50 border border-gray-200 p-2 rounded text-xs">
              <div className="font-medium text-gray-500 mb-1">⏳ Waiting in queue...</div>
              <div className="text-gray-400">Analysis will begin shortly</div>
            </div>
          )}
        </div>
        
        {/* Action buttons */}
        <div className="flex space-x-2">
          {video.status === 'pending' && (
            <>
              <Button
                onClick={() => onApprove(video)}
                size="sm"
                className="flex-1 bg-success hover:bg-green-600 text-white"
              >
                <Check className="h-4 w-4 mr-1" />
                Approve
              </Button>
              <Button
                onClick={() => onReject(video)}
                size="sm"
                variant="destructive"
                className="flex-1"
              >
                <X className="h-4 w-4 mr-1" />
                Reject
              </Button>
            </>
          )}
          
          {video.status === 'analyzing' && (
            <Button disabled size="sm" className="flex-1 bg-gray-100 text-gray-400 cursor-not-allowed">
              <Clock className="h-4 w-4 mr-1" />
              Analyzing...
            </Button>
          )}
          
          {video.status === 'queued' && (
            <Button disabled size="sm" className="flex-1 bg-gray-100 text-gray-400 cursor-not-allowed">
              <Clock className="h-4 w-4 mr-1" />
              Queued
            </Button>
          )}
          
          {video.status === 'posted' && (
            <div className="flex items-center justify-between text-xs text-gray-500 w-full">
              <span>Posted {new Date(video.updatedAt!).toLocaleTimeString()}</span>
              <Button variant="ghost" size="sm" asChild>
                <a href={video.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  View
                </a>
              </Button>
            </div>
          )}
          
          {video.status === 'rejected' && (
            <div className="flex items-center justify-between text-xs text-gray-500 w-full">
              <span>Skipped {new Date(video.updatedAt!).toLocaleTimeString()}</span>
              <Button variant="ghost" size="sm" className="text-gray-400 hover:text-gray-600">
                <RotateCcw className="h-3 w-3 mr-1" />
                Retry
              </Button>
            </div>
          )}
          
          {video.status === 'error' && (
            <div className="flex space-x-2 w-full">
              <Button size="sm" className="flex-1 bg-primary hover:bg-blue-700">
                <RotateCcw className="h-4 w-4 mr-1" />
                Retry
              </Button>
              <Button size="sm" variant="secondary" className="flex-1">
                <X className="h-4 w-4 mr-1" />
                Skip
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
