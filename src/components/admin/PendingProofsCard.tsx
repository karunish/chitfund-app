import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format } from 'date-fns';
import ViewProofDialog from '@/components/admin/ViewProofDialog';
import RejectProofDialog from '@/components/admin/RejectProofDialog';
import { Eye, Check, X, Trash2 } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';

type PaymentProof = {
  id: number;
  user_full_name: string;
  contribution_month: string;
  file_path: string;
  created_at: string;
};

const fetchPendingProofs = async (): Promise<PaymentProof[]> => {
    const { data, error } = await supabase
      .from('payment_proofs')
      .select('id, user_full_name, contribution_month, file_path, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    if (error) {
      showError('Failed to fetch pending proofs.');
      return [];
    }
    return data;
};

const PendingProofsCard = () => {
    const queryClient = useQueryClient();
    const [pendingProofs, setPendingProofs] = useState<PaymentProof[]>([]);
    const [loadingProofs, setLoadingProofs] = useState(true);
    const [viewingProof, setViewingProof] = useState<PaymentProof | null>(null);
    const [rejectingProof, setRejectingProof] = useState<PaymentProof | null>(null);
    const [deletingProof, setDeletingProof] = useState<PaymentProof | null>(null);

    const loadProofs = async () => {
        setLoadingProofs(true);
        const proofs = await fetchPendingProofs();
        setPendingProofs(proofs);
        setLoadingProofs(false);
    };

    useEffect(() => {
        loadProofs();
    }, []);

    const processProofMutation = useMutation({
        mutationFn: async ({ proofId, status, notes }: { proofId: number, status: 'approved' | 'rejected', notes?: string }) => {
          const { error, data } = await supabase.functions.invoke('process-payment-proof', {
            body: { proofId, status, notes },
          });
          if (error) throw error;
          if (data.error) throw new Error(data.error);
        },
        onMutate: async () => {
          const toastId = showLoading('Processing proof...');
          return { toastId };
        },
        onSuccess: (_, variables, context) => {
          if (context?.toastId) dismissToast(context.toastId);
          showSuccess(`Proof has been ${variables.status}.`);
          loadProofs();
          queryClient.invalidateQueries({ queryKey: ['main-balance'] });
        },
        onError: (error: Error, _, context) => {
          if (context?.toastId) dismissToast(context.toastId);
          showError(`Failed to process proof: ${error.message}`);
        },
    });

    const deleteProofMutation = useMutation({
        mutationFn: async (proofId: number) => {
          const { error, data } = await supabase.functions.invoke('admin-delete-payment-proof', {
            body: { proofId },
          });
          if (error) throw error;
          if (data.error) throw new Error(data.error);
        },
        onSuccess: () => {
          showSuccess('Proof deleted successfully.');
          loadProofs();
          setDeletingProof(null);
        },
        onError: (error: Error) => {
          showError(`Failed to delete proof: ${error.message}`);
        },
    });

    const handleApproveProof = (proofId: number) => {
        processProofMutation.mutate({ proofId, status: 'approved' });
    };

    const handleRejectProofSubmit = (notes: string) => {
        if (!rejectingProof) return;
        processProofMutation.mutate({ proofId: rejectingProof.id, status: 'rejected', notes });
        setRejectingProof(null);
    };

    const handleDeleteProofClick = (proof: PaymentProof) => {
        setDeletingProof(proof);
    };

    const confirmDeleteProof = () => {
        if (deletingProof) {
          deleteProofMutation.mutate(deletingProof.id);
        }
    };

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>Pending Contribution Review</CardTitle>
                    <CardDescription>Review and process new contribution proofs from members.</CardDescription>
                </CardHeader>
                <CardContent>
                    {loadingProofs ? (
                        <div className="space-y-4">
                            <Skeleton className="h-20 w-full" />
                            <Skeleton className="h-20 w-full" />
                        </div>
                    ) : pendingProofs.length > 0 ? (
                        <div className="space-y-4">
                            {pendingProofs.map(proof => (
                                <div key={proof.id} className="p-4 border rounded-lg">
                                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                                        <div>
                                            <p className="font-semibold">{proof.user_full_name}</p>
                                            <p className="text-sm">For: {format(new Date(proof.contribution_month), 'MMMM yyyy')}</p>
                                            <p className="text-xs text-muted-foreground">Submitted: {format(new Date(proof.created_at), 'PPP p')}</p>
                                        </div>
                                        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                                            <Button size="icon" variant="outline" onClick={() => setViewingProof(proof)}><Eye className="h-4 w-4" /></Button>
                                            <Button size="icon" variant="outline" className="text-green-600 hover:text-green-600 hover:bg-green-50" onClick={() => handleApproveProof(proof.id)}><Check className="h-4 w-4" /></Button>
                                            <Button size="icon" variant="outline" className="text-red-600 hover:text-red-600 hover:bg-red-50" onClick={() => setRejectingProof(proof)}><X className="h-4 w-4" /></Button>
                                            <Button size="icon" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => handleDeleteProofClick(proof)}><Trash2 className="h-4 w-4" /></Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center text-muted-foreground py-8">
                            <p>No pending contribution proofs to review.</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {viewingProof && <ViewProofDialog proof={viewingProof} isOpen={!!viewingProof} onOpenChange={(open) => !open && setViewingProof(null)} />}
            {rejectingProof && <RejectProofDialog isOpen={!!rejectingProof} onOpenChange={(open) => !open && setRejectingProof(null)} onSubmit={handleRejectProofSubmit} />}
            <AlertDialog open={!!deletingProof} onOpenChange={(open) => !open && setDeletingProof(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>This will permanently delete this submission. This is useful for spam or duplicate entries. The user will not be notified.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDeleteProof} disabled={deleteProofMutation.isPending}>{deleteProofMutation.isPending ? 'Deleting...' : 'Delete'}</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};

export default PendingProofsCard;