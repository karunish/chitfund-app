import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { Download, Share2, CheckCircle, Trash2, Send } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Loan = {
  id: number;
  created_at: string;
  user_email: string;
  amount: number;
  status: 'pending' | 'approved' | 'in-process' | 'rejected' | 'closed';
  processed_at: string | null;
  due_date: string | null;
  guarantor_name: string | null;
  reason: string | null;
  user: {
    first_name: string | null;
    last_name: string | null;
  } | null;
};

const fetchAllLoans = async (statusFilter: string): Promise<Loan[]> => {
  const { data, error } = await supabase.functions.invoke('admin-get-all-loans', {
    body: { statusFilter },
  });
  if (error) throw new Error(error.message);
  if (data.error) throw new Error(data.error);
  return data.loans;
};

const disburseLoan = async (loanId: number) => {
  const { error, data } = await supabase.functions.invoke('admin-disburse-loan', {
    body: { loanId },
  });
  if (error) throw new Error(error.message);
  if (data.error) throw new Error(data.error);
};

const closeLoan = async (loanId: number) => {
  const { error, data } = await supabase.functions.invoke('admin-close-loan', {
    body: { loanId },
  });
  if (error) throw new Error(error.message);
  if (data.error) throw new Error(data.error);
};

const deleteLoan = async (loanId: number) => {
  const { error, data } = await supabase.functions.invoke('admin-delete-loan-request', {
    body: { loanRequestId: loanId },
  });
  if (error) throw new Error(error.message);
  if (data.error) throw new Error(data.error);
};

const LoanManagementPage = () => {
  const [statusFilter, setStatusFilter] = useState('all');
  const [loanToClose, setLoanToClose] = useState<Loan | null>(null);
  const [loanToDelete, setLoanToDelete] = useState<Loan | null>(null);
  const [loanToDisburse, setLoanToDisburse] = useState<Loan | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const queryClient = useQueryClient();

  const { data: loans, isLoading } = useQuery({
    queryKey: ['all-loans', statusFilter],
    queryFn: () => fetchAllLoans(statusFilter),
  });

  const totalInLoans = useMemo(() => {
    if (!loans) return 0;
    return loans
      .filter(loan => loan.status === 'in-process')
      .reduce((acc, loan) => acc + loan.amount, 0);
  }, [loans]);

  const disburseLoanMutation = useMutation({
    mutationFn: disburseLoan,
    onSuccess: () => {
      showSuccess('Loan disbursed successfully!');
      queryClient.invalidateQueries({ queryKey: ['all-loans', statusFilter] });
      queryClient.invalidateQueries({ queryKey: ['main-balance'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setLoanToDisburse(null);
    },
    onError: (error: Error) => {
      showError(`Failed to disburse loan: ${error.message}`);
    },
  });

  const closeLoanMutation = useMutation({
    mutationFn: closeLoan,
    onSuccess: () => {
      showSuccess('Loan marked as closed!');
      queryClient.invalidateQueries({ queryKey: ['all-loans', statusFilter] });
      setLoanToClose(null);
    },
    onError: (error: Error) => {
      showError(`Failed to close loan: ${error.message}`);
    },
  });

  const deleteLoanMutation = useMutation({
    mutationFn: deleteLoan,
    onSuccess: () => {
      showSuccess('Loan record deleted successfully!');
      queryClient.invalidateQueries({ queryKey: ['all-loans', statusFilter] });
      setLoanToDelete(null);
    },
    onError: (error: Error) => {
      showError(`Failed to delete loan: ${error.message}`);
    },
  });

  const handleConfirmDisburse = () => {
    if (loanToDisburse) {
      disburseLoanMutation.mutate(loanToDisburse.id);
    }
  };

  const handleConfirmClose = () => {
    if (loanToClose) {
      closeLoanMutation.mutate(loanToClose.id);
    }
  };

  const handleConfirmDelete = () => {
    if (loanToDelete) {
      deleteLoanMutation.mutate(loanToDelete.id);
    }
  };

  const getStatusBadgeVariant = (status: Loan['status']): "secondary" | "default" | "destructive" | "outline" => {
    switch (status) {
      case 'in-process': return 'default';
      case 'approved': return 'outline';
      case 'closed': return 'secondary';
      case 'rejected': return 'destructive';
      default: return 'secondary';
    }
  };

  const getStatusText = (status: Loan['status']) => {
    if (status === 'approved') return 'Pending Transfer';
    if (status === 'in-process') return 'In Process';
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  const handleExport = async () => {
    setIsExporting(true);
    const toastId = showLoading('Exporting all loans...');
    try {
      const { data, error } = await supabase.functions.invoke('export-all-loans');
      if (error) throw error;
      if (typeof data === 'string') {
        const fileName = `all_loans_export_${new Date().toISOString().split('T')[0]}.csv`;
        if (Capacitor.isNativePlatform()) {
          const result = await Filesystem.writeFile({ path: fileName, data, directory: Directory.Cache, encoding: Encoding.UTF8 });
          await Share.share({ title: 'All Loans Export', url: result.uri });
        } else {
          const blob = new Blob([data], { type: 'text/csv' });
          const link = document.createElement('a');
          link.href = window.URL.createObjectURL(blob);
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
        dismissToast(toastId);
        showSuccess('Export successful!');
      } else {
        throw new Error('Invalid export data received.');
      }
    } catch (error: any) {
      if (error.message !== "Share canceled") showError(`Export failed: ${error.message}`);
    } finally {
      setIsExporting(false);
      dismissToast(toastId);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Loan Management</h2>
          <p className="text-muted-foreground">View, manage, and export all loan records.</p>
        </div>
        <Button onClick={handleExport} disabled={isExporting}>
          {Capacitor.isNativePlatform() ? <Share2 className="mr-2 h-4 w-4" /> : <Download className="mr-2 h-4 w-4" />}
          {isExporting ? 'Exporting...' : 'Export All Loans'}
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Total Amount in Loans</CardTitle>
            <CardDescription>This is the total sum of all loans currently "In Process".</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">${totalInLoans.toLocaleString('en-IN')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Number of Loans</CardTitle>
            <CardDescription>Total loans matching the current filter.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{isLoading ? <Skeleton className="h-9 w-16" /> : loans?.length ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Pending Transfer</TabsTrigger>
          <TabsTrigger value="in-process">In Process</TabsTrigger>
          <TabsTrigger value="closed">Closed</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Issue Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Guarantor</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={8}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                  ))
                ) : loans && loans.length > 0 ? (
                  loans.map((loan) => (
                    <TableRow key={loan.id}>
                      <TableCell className="font-medium">{`${loan.user?.first_name || ''} ${loan.user?.last_name || ''}`.trim() || loan.user_email}</TableCell>
                      <TableCell>${loan.amount.toLocaleString('en-IN')}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{loan.reason || 'N/A'}</TableCell>
                      <TableCell><Badge variant={getStatusBadgeVariant(loan.status)} className="capitalize">{getStatusText(loan.status)}</Badge></TableCell>
                      <TableCell>{format(new Date(loan.created_at), 'PPP')}</TableCell>
                      <TableCell>{loan.due_date ? format(new Date(loan.due_date), 'PPP') : 'N/A'}</TableCell>
                      <TableCell>{loan.guarantor_name || 'N/A'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end items-center">
                          {loan.status === 'approved' && (
                            <Button variant="outline" size="sm" onClick={() => setLoanToDisburse(loan)}>
                              <Send className="h-4 w-4 mr-2" />
                              Disburse
                            </Button>
                          )}
                          {loan.status === 'in-process' && (
                            <Button variant="outline" size="sm" onClick={() => setLoanToClose(loan)}>
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Close
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="ml-2 text-muted-foreground hover:text-destructive" onClick={() => setLoanToDelete(loan)}>
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Delete Loan</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={8} className="h-24 text-center">No loans found for this filter.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!loanToDisburse} onOpenChange={(open) => !open && setLoanToDisburse(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disburse Loan?</AlertDialogTitle>
            <AlertDialogDescription>
              This confirms that funds have been transferred. This will update the user's outstanding balance and create transaction logs. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDisburse} disabled={disburseLoanMutation.isPending}>
              {disburseLoanMutation.isPending ? 'Processing...' : 'Confirm Disbursement'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!loanToClose} onOpenChange={(open) => !open && setLoanToClose(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark Loan as Closed?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to mark this loan as closed? This indicates the loan has been fully repaid. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmClose} disabled={closeLoanMutation.isPending}>
              {closeLoanMutation.isPending ? 'Closing...' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!loanToDelete} onOpenChange={(open) => !open && setLoanToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the loan record. Note: This does NOT reverse any financial transactions associated with it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} disabled={deleteLoanMutation.isPending}>
              {deleteLoanMutation.isPending ? 'Deleting...' : 'Confirm Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default LoanManagementPage;