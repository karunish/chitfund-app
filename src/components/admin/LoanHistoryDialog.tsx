import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { Download, Share2, Trash2, Pencil } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
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
import EditLoanDialog from './EditLoanDialog';

type MergedUser = {
  id: string;
  email: string;
};

type LoanRequest = {
  id: number;
  created_at: string;
  amount: number;
  reason: string | null;
  status: 'pending' | 'in-process' | 'rejected' | 'closed' | 'approved';
  processed_at: string | null;
  due_date: string | null;
  guarantor_id: string | null;
};

const fetchLoanHistory = async (userId: string): Promise<LoanRequest[]> => {
  const { data, error } = await supabase
    .from('loan_requests')
    .select('id, created_at, amount, reason, status, processed_at, due_date, guarantor_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data;
};

const deleteLoanRequest = async (loanRequestId: number) => {
  const { error, data } = await supabase.functions.invoke('admin-delete-loan-request', {
    body: { loanRequestId },
  });
  if (error) throw new Error(error.message);
  if (data.error) throw new Error(data.error);
};

type LoanHistoryDialogProps = {
  user: MergedUser;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

const LoanHistoryDialog = ({ user, isOpen, onOpenChange }: LoanHistoryDialogProps) => {
  const [isExporting, setIsExporting] = useState(false);
  const [requestToDelete, setRequestToDelete] = useState<LoanRequest | null>(null);
  const [editingLoan, setEditingLoan] = useState<LoanRequest | null>(null);
  const queryClient = useQueryClient();

  const { data: loanHistory, isLoading } = useQuery({
    queryKey: ['loanHistory', user.id],
    queryFn: () => fetchLoanHistory(user.id),
    enabled: isOpen,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteLoanRequest,
    onSuccess: () => {
      showSuccess('Loan request deleted successfully!');
      queryClient.invalidateQueries({ queryKey: ['loanHistory', user.id] });
      setRequestToDelete(null);
    },
    onError: (error: Error) => {
      showError(`Failed to delete request: ${error.message}`);
      setRequestToDelete(null);
    },
  });

  const getStatusBadgeVariant = (status: LoanRequest['status']): "secondary" | "default" | "destructive" => {
    switch (status) {
      case 'in-process':
      case 'approved':
        return 'default';
      case 'closed':
        return 'secondary';
      case 'rejected':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getStatusText = (status: LoanRequest['status']) => {
    if (status === 'in-process' || status === 'approved') return 'In Process';
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  const handleExport = async () => {
    setIsExporting(true);
    const toastId = showLoading('Exporting loan history...');

    try {
      const { data, error } = await supabase.functions.invoke('export-user-loan-history', {
        body: { userId: user.id },
      });

      if (error) throw error;

      if (typeof data === 'string') {
        const fileName = `loan_history_${user.id}_${new Date().toISOString().split('T')[0]}.csv`;

        if (Capacitor.isNativePlatform()) {
          const result = await Filesystem.writeFile({
            path: fileName,
            data: data,
            directory: Directory.Cache,
            encoding: Encoding.UTF8,
          });
          await Share.share({ title: 'Loan History Export', url: result.uri });
        } else {
          const blob = new Blob([data], { type: 'text/csv' });
          const link = document.createElement('a');
          link.href = window.URL.createObjectURL(blob);
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(link.href);
        }
        dismissToast(toastId);
        showSuccess('Export successful!');
      } else {
        throw new Error('Invalid export data received.');
      }
    } catch (error: any) {
      dismissToast(toastId);
      if (error.message !== "Share canceled") {
        showError(`Export failed: ${error.message}`);
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteClick = (request: LoanRequest) => {
    setRequestToDelete(request);
  };

  const confirmDelete = () => {
    if (requestToDelete) {
      deleteMutation.mutate(requestToDelete.id);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Loan Request History</DialogTitle>
            <DialogDescription>Showing all loan requests for {user.email}.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto pr-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Issue Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5}><Skeleton className="h-8 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : loanHistory && loanHistory.length > 0 ? (
                  loanHistory.map((req) => (
                    <TableRow key={req.id}>
                      <TableCell>{format(new Date(req.created_at), 'PPP')}</TableCell>
                      <TableCell>{req.due_date ? format(new Date(req.due_date), 'PPP') : 'N/A'}</TableCell>
                      <TableCell>${req.amount.toLocaleString('en-IN')}</TableCell>
                      <TableCell><Badge variant={getStatusBadgeVariant(req.status)}>{getStatusText(req.status)}</Badge></TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary" onClick={() => setEditingLoan(req)}>
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">Edit</span>
                        </Button>
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => handleDeleteClick(req)}>
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center h-24">No loan history found.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button onClick={handleExport} disabled={isExporting || !loanHistory || loanHistory.length === 0}>
              {Capacitor.isNativePlatform() ? <Share2 className="mr-2 h-4 w-4" /> : <Download className="mr-2 h-4 w-4" />}
              {isExporting ? 'Exporting...' : 'Export as CSV'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editingLoan && (
        <EditLoanDialog
          loan={editingLoan}
          isOpen={!!editingLoan}
          onOpenChange={(open) => !open && setEditingLoan(null)}
        />
      )}

      <AlertDialog open={!!requestToDelete} onOpenChange={(open) => !open && setRequestToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the loan request for <span className="font-semibold">${requestToDelete?.amount.toLocaleString('en-IN')}</span> made on <span className="font-semibold">{requestToDelete ? format(new Date(requestToDelete.created_at), 'PPP') : ''}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRequestToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default LoanHistoryDialog;