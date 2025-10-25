import { useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowDownLeft, ArrowUpRight, Trash2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { useAuthContext } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
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
import { showSuccess, showError } from '@/utils/toast';
import { ResponsiveSelect } from '@/components/ui/ResponsiveSelect';

type Transaction = {
  id: number;
  created_at: string;
  type: 'deposit' | 'withdrawal';
  amount: number;
  user_full_name: string;
  description: string | null;
};

const TransactionList = ({ transactions, isAdmin, onDelete }: { transactions: Transaction[], isAdmin: boolean, onDelete: (id: number) => void }) => {
  if (transactions.length === 0) {
    return <p className="text-muted-foreground text-center py-8">No transactions found for this month.</p>;
  }

  return (
    <div className="space-y-4">
      {transactions.map((tx) => (
        <div key={tx.id} className="flex items-center">
          <div className={`flex h-8 w-8 items-center justify-center rounded-full ${tx.type === 'deposit' ? 'bg-green-100 dark:bg-green-900' : 'bg-red-100 dark:bg-red-900'}`}>
            {tx.type === 'deposit' ? (
              <ArrowDownLeft className="h-4 w-4 text-green-600 dark:text-green-400" />
            ) : (
              <ArrowUpRight className="h-4 w-4 text-red-600 dark:text-red-400" />
            )}
          </div>
          <div className="ml-4 flex-1 space-y-1">
            <p className="text-sm font-medium leading-none">{tx.user_full_name}</p>
            <p className="text-sm text-muted-foreground">{tx.description || (tx.type === 'deposit' ? 'Deposit' : 'Withdrawal')}</p>
          </div>
          <div className="text-right">
            <div className={`font-medium ${tx.type === 'deposit' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {tx.type === 'deposit' ? '+' : '-'}${Number(tx.amount).toLocaleString('en-IN')}
            </div>
            <p className="text-xs text-muted-foreground">{format(new Date(tx.created_at), 'MMM d, yyyy')}</p>
          </div>
          {isAdmin && (
            <Button variant="ghost" size="icon" className="ml-2 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => onDelete(tx.id)}>
              <Trash2 className="h-4 w-4" />
              <span className="sr-only">Delete Transaction</span>
            </Button>
          )}
        </div>
      ))}
    </div>
  );
};

const TransactionsPage = () => {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [transactionToDelete, setTransactionToDelete] = useState<number | null>(null);
  const { user, profile } = useAuthContext();
  const queryClient = useQueryClient();
  const isAdmin = profile?.role === 'admin';

  const monthOptions = useMemo(() => {
    const options = [];
    const today = new Date();
    for (let i = 0; i < 12; i++) {
      const date = subMonths(today, i);
      options.push({
        value: format(date, 'yyyy-MM'),
        label: format(date, 'MMMM yyyy'),
      });
    }
    return options;
  }, []);

  const { data: transactions = [], isLoading: loading } = useQuery<Transaction[]>({
    queryKey: ['transactions', selectedMonth, user?.id, isAdmin],
    queryFn: async () => {
      if (!user) return [];

      const selectedDate = new Date(selectedMonth + '-01T00:00:00Z');
      const startDate = startOfMonth(selectedDate).toISOString();
      const endDate = endOfMonth(selectedDate).toISOString();

      let query = supabase
        .from('transactions')
        .select('*')
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (isAdmin) {
        query = query.is('user_id', null);
      } else {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error("Error fetching transactions:", error);
        throw new Error(error.message);
      }
      return data as Transaction[];
    },
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: async (transactionId: number) => {
      const { error, data } = await supabase.functions.invoke('admin-delete-transaction', {
        body: { transactionId },
      });
      if (error) throw new Error(error.message);
      if (data.error) throw new Error(data.error);
    },
    onSuccess: () => {
      showSuccess('Transaction deleted successfully!');
      queryClient.invalidateQueries({ queryKey: ['transactions', selectedMonth, user?.id, isAdmin] });
      setTransactionToDelete(null);
    },
    onError: (error: Error) => {
      showError(`Failed to delete transaction: ${error.message}`);
      setTransactionToDelete(null);
    },
  });

  const handleDeleteClick = (id: number) => {
    setTransactionToDelete(id);
  };

  const confirmDelete = () => {
    if (transactionToDelete) {
      deleteMutation.mutate(transactionToDelete);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold">{isAdmin ? 'Public Transaction Log' : 'My Transaction History'}</h2>
        <ResponsiveSelect
          options={monthOptions}
          value={selectedMonth}
          onChange={setSelectedMonth}
          className="w-full sm:w-[200px]"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{isAdmin ? 'Public Transactions' : 'My Transactions'} for {format(new Date(selectedMonth + '-01T00:00:00Z'), 'MMMM yyyy')}</CardTitle>
          <CardDescription>
            {isAdmin ? 'A log of all public deposits and loan disbursements.' : 'A log of your personal deposits and loan activity.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" />
            </div>
          ) : (
            <TransactionList transactions={transactions} isAdmin={isAdmin} onDelete={handleDeleteClick} />
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!transactionToDelete} onOpenChange={(open) => !open && setTransactionToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the transaction log entry.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTransactionToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TransactionsPage;