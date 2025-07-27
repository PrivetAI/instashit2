import { type Video } from "@shared/schema";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, Send } from "lucide-react";

interface ConfirmationModalProps {
  video: Video | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmationModal({ video, onConfirm, onCancel }: ConfirmationModalProps) {
  if (!video) return null;

  return (
    <Dialog open={!!video} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Confirm Comment Posting
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to post this comment? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-3 my-4">
          <div className="bg-gray-50 p-3 rounded">
            <div className="text-sm font-medium mb-1">Comment:</div>
            <div className="text-sm text-muted-foreground">"{video.generatedComment}"</div>
          </div>
          
          <div className="bg-blue-50 p-3 rounded">
            <div className="text-sm font-medium mb-1">Video:</div>
            <div className="text-sm text-muted-foreground line-clamp-2">{video.title}</div>
          </div>
        </div>
        
        <DialogFooter>
          <Button onClick={onCancel} variant="outline">
            Cancel
          </Button>
          <Button onClick={onConfirm}>
            <Send className="h-4 w-4 mr-2" />
            Post Comment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}