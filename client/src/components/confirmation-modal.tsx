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
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-warning/10 rounded-full flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-warning" />
            </div>
            <DialogTitle>Confirm Comment Posting</DialogTitle>
          </div>
          <DialogDescription>
            Are you sure you want to post this comment to Instagram? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        
        <div className="bg-gray-50 p-3 rounded mb-4">
          <div className="text-sm font-medium text-gray-700 mb-1">Comment to post:</div>
          <div className="text-sm text-gray-600">"{video.generatedComment}"</div>
        </div>
        
        <div className="bg-blue-50 p-3 rounded mb-4">
          <div className="text-sm font-medium text-gray-700 mb-1">Video:</div>
          <div className="text-sm text-gray-600 line-clamp-2">{video.title}</div>
        </div>
        
        <DialogFooter className="flex space-x-3">
          <Button onClick={onCancel} variant="outline" className="flex-1">
            Cancel
          </Button>
          <Button onClick={onConfirm} className="flex-1 bg-success hover:bg-green-600">
            <Send className="h-4 w-4 mr-2" />
            Post Comment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
