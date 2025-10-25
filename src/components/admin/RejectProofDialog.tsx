import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

type Props = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (notes: string) => void;
};

const RejectProofDialog = ({ isOpen, onOpenChange, onSubmit }: Props) => {
  const [notes, setNotes] = useState('');

  const handleSubmit = () => {
    if (notes.trim()) {
      onSubmit(notes);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject Submission</DialogTitle>
          <DialogDescription>
            Please provide a reason for rejecting this submission. The user will see this note.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Label htmlFor="rejection-notes">Rejection Reason</Label>
          <Textarea
            id="rejection-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g., Amount is incorrect, screenshot is blurry, etc."
            className="mt-2"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={!notes.trim()}>
            Confirm Rejection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RejectProofDialog;