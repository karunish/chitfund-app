import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';

type PaymentProof = {
  id: number;
  user_full_name: string;
  contribution_month: string;
  file_path: string;
};

type Props = {
  proof: PaymentProof;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

const ViewProofDialog = ({ proof, isOpen, onOpenChange }: Props) => {
  const { data: imageUrl } = supabase.storage
    .from('payment-proofs')
    .getPublicUrl(proof.file_path);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Review Payment Proof</DialogTitle>
          <DialogDescription>
            For {proof.user_full_name} - {format(new Date(proof.contribution_month), 'MMMM yyyy')}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          {imageUrl?.publicUrl ? (
            <img
              src={imageUrl.publicUrl}
              alt={`Payment proof for ${proof.user_full_name}`}
              className="rounded-lg w-full h-auto object-contain"
            />
          ) : (
            <p className="text-red-500">Could not load image.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ViewProofDialog;