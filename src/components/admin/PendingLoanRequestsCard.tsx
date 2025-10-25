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
import RejectLoanDialog from '@/components/admin/RejectLoanDialog';
import { Trash2 } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';

type LoanRequest = {
  id: number;
  amount: number;
  reason: string;
  status: string;
  created_at: string;
  guarantor_name: string | null;
  user: {
    first_name: string | null;
    last_name: string | null;
  } | null;
};

const fetchLoanRequests = async (): Promise<LoanRequest[]> => {
    const { data: requests, error: requestsError } = await supabase
      .from('loan_requests')
      .select('id, amount, reason, status, created_at, guarantor_name, user_id')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (requestsError) {
      showError('Failed to fetch loan requests.');
      return [];
    }
    if (!requests || requests.length === 0) {
      return [];
    }
    const userIds = [...new Set(requests.map((req) => req.user_id))];
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .in('id', userIds);
    if (profilesError) {
      showError('Failed to fetch user names for requests.');
      return requests.map(req => ({ ...req, user: null })) as any;
    }
    const profilesMap = new Map(profiles.map((p) => [p.id, p]));
    const mergedRequests = requests.map((req) => ({
      ...req,
      user: profilesMap.get(req.user_id) || null,
    }));
    return mergedRequests as any[];
};

const PendingLoanRequestsCard = () => {
    const queryClient = useQueryClient();
    const [loanRequests, setLoanRequests] = useState<LoanRequest[]>([]);
    const [loadingRequests, setLoadingRequests] = useState(true);
    const [requestToDelete, setRequestToDelete] = useState<LoanRequest | null>(null);
    const [rejectingLoan, setRejectingLoan] = useState<LoanRequest | null>(null);

    const loadRequests = async () => {
        setLoadingRequests(true);
        const requests = await fetchLoanRequests();
        setLoanRequests(requests);
        setLoadingRequests(false);
    };

    useEffect(() => {
        loadRequests();
    }, []);

    const processLoanMutation = useMutation({
        mutationFn: async ({ id, status, notes }: { id: number, status: 'approved' | 'rejected', notes?: string }) => {
            const toastId = showLoading('Updating request...');
            const { error, data } = await supabase.functions.invoke('process-loan-request', {
                body: { loanId: id, status, rejection_reason: notes },
            });
            dismissToast(toastId);
            if (error) throw error;
            if (data.error) throw new Error(data.error);
        },
        onSuccess: (_, variables) => {
            showSuccess(`Request has been ${variables.status}.`);
            loadRequests();
            queryClient.invalidateQueries({ queryKey: ['main-balance'] });
        },
        onError: (error: Error) => {
            showError(`Failed to update request: ${error.message}`);
        },
    });

    const deleteLoanMutation = useMutation({
        mutationFn: async (loanRequestId: number) => {
            const { error, data } = await supabase.functions.invoke('admin-delete-loan-request', {
                body: { loanRequestId },
            });
            if (error) throw new Error(error.message);
            if (data.error) throw new Error(data.error);
        },
        onSuccess: () => {
            showSuccess('Loan request deleted successfully!');
            loadRequests();
            setRequestToDelete(null);
        },
        onError: (error: Error) => {
            showError(`Failed to delete request: ${error.message}`);
        },
    });

    const handleRejectSubmit = (notes: string) => {
        if (!rejectingLoan) return;
        processLoanMutation.mutate({ id: rejectingLoan.id, status: 'rejected', notes });
        setRejectingLoan(null);
    };

    const confirmDelete = () => {
        if (requestToDelete) {
            deleteLoanMutation.mutate(requestToDelete.id);
        }
    };

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>Pending Loan Requests</CardTitle>
                    <CardDescription>Review and process new loan requests from members.</CardDescription>
                </CardHeader>
                <CardContent>
                    {loadingRequests ? (
                        <div className="space-y-4">
                            <Skeleton className="h-20 w-full" />
                            <Skeleton className="h-20 w-full" />
                        </div>
                    ) : loanRequests.length > 0 ? (
                        <div className="space-y-4">
                            {loanRequests.map((req) => (
                                <div key={req.id} className="p-4 border rounded-lg">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-semibold">{`${req.user?.first_name || ''} ${req.user?.last_name || ''}`.trim() || 'Unknown User'}</p>
                                            <p className="text-sm text-muted-foreground">Reason: {req.reason}</p>
                                            <p className="text-sm text-muted-foreground">Guarantor: {req.guarantor_name || 'N/A'}</p>
                                        </div>
                                        <p className="text-lg font-bold">${req.amount.toLocaleString('en-IN')}</p>
                                    </div>
                                    <div className="flex gap-2 mt-4">
                                        <Button size="sm" onClick={() => processLoanMutation.mutate({ id: req.id, status: 'approved' })}>Approve</Button>
                                        <Button size="sm" variant="destructive" onClick={() => setRejectingLoan(req)}>Reject</Button>
                                        <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => setRequestToDelete(req)}><Trash2 className="h-4 w-4 mr-1" />Delete</Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center text-muted-foreground py-8">
                            <p>No pending loan requests to review.</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {rejectingLoan && <RejectLoanDialog isOpen={!!rejectingLoan} onOpenChange={(open) => !open && setRejectingLoan(null)} onSubmit={handleRejectSubmit} />}
            <AlertDialog open={!!requestToDelete} onOpenChange={(open) => !open && setRequestToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>This will permanently delete the pending loan request for <span className="font-semibold">{`${requestToDelete?.user?.first_name || ''} ${requestToDelete?.user?.last_name || ''}`.trim() || 'Unknown User'}</span> of <span className="font-semibold">${requestToDelete?.amount.toLocaleString('en-IN')}</span>. This action cannot be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setRequestToDelete(null)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} disabled={deleteLoanMutation.isPending}>{deleteLoanMutation.isPending ? 'Deleting...' : 'Confirm Delete'}</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};

export default PendingLoanRequestsCard;