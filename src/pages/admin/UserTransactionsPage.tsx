import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { showSuccess, showError } from '@/utils/toast';
import { ArrowLeft, Trash2 } from 'lucide-react';
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

type Transaction = {
  id: number;
  created_at: string;
  type: 'deposit' | 'withdrawal';
  amount: number;
  description: string | null;
};

type UserProfile = {
  first_name: string | null;
  last_name: string | null;
  email: string;
};

const fetchUserData = async (userId: string): Promise<{ profile: UserProfile, transactions: Transaction[] }> => {
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('first_name, last_name')
    .eq('id', userId)
    .single();
  if (profileError) throw new Error(`Failed to fetch profile: ${profileError.message}`);

  const { data: transactionsData, error: transactionsError } = await supabase
    .from('transactions')
    .select('id, created_at, type, amount, description')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (transactionsError) throw new Error(`Failed to fetch transactions: ${transactionsError.message}`);

  // This is a bit of a hack because we don't store email in profiles table.
  // In a real app, you might want to join with auth.users or store it.
  const { data: { user } } = await supabase.auth.admin.getUserById(userId);

  return { profile: { ...profileData, email: user?.email || 'N/A' }, transactions: transactionsData };
};

const reverseTransaction = async (transactionId: number) => {
  const { error, data } = await supabase.functions.invoke('admin-reverse-transaction', {
    body: { transactionId },
  });
  if (error) throw new Error(error.message);
  if (data.error) throw new Error(data.error);
};

const UserTransactionsPage = () => {
  const { userId } = useParams<{ userId: string }>();
  const queryClient = useQueryClient();
  const [transactionToReverse, setTransactionToReverse] = useState<Transaction | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['user-transactions-admin', userId],
    queryFn: () => fetchUserData(userId!),
    enabled: !!userId,
  });

  const mutation = useMutation({
    mutationFn: reverseTransaction,
    onSuccess: () => {
      showSuccess('Transaction reversed successfully!');
      queryClient.invalidateQueries({ queryKey: ['user-transactions-admin', userId] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] }); // To update outstanding amount
      queryClient.invalidateQueries({ queryKey: ['main-balance'] });
      setTransactionToReverse(null);
    },
    onError: (error: Error) => {
      showError(`Failed to reverse transaction: ${error.message}`);
    },
  });

  const handleReverseClick = (tx: Transaction) => {
    setTransactionToReverse(tx);
  };

  const confirmReverse = () => {
    if (transactionToReverse) {
      mutation.mutate(transactionToReverse.id);
    }
  };

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (error) {
    return <div className="text-red-500">Error: ${error.message}</div>;
  }

  const { profile, transactions } = data!;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="icon" className="h-7 w-7">
          <Link to="/admin/users">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back to Users</span>
          </Link>
        </Button>
        <div>
          <h2 className="text-2xl font-bold">Transaction History</h2>
          <p className="text-muted-foreground">
            For {`${profile.first_name || ''} ${profile.last_name || ''}`.trim()} ({profile.email})
          </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>All Transactions</CardTitle>
          <CardDescription>
            A complete log of this user's personal transactions. Reversing a transaction will also update all relevant balances.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length > 0 ? (
                transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>{format(new Date(tx.created_at), 'PPP')}</TableCell>
                    <TableCell className="capitalize">{tx.type}</TableCell>
                    <TableCell>{tx.description}</TableCell>
                    <TableCell className={`text-right font-medium ${tx.type === 'deposit' ? 'text-green-600' : 'text-red-600'}`}>
                      {tx.type === 'deposit' ? '+' : '-'}${tx.amount.toLocaleString('en-IN')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => handleReverseClick(tx)}>
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Reverse & Delete</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">No transactions found for this user.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={!!transactionToReverse} onOpenChange={(open) => !open && setTransactionToReverse(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the transaction and reverse its financial impact on all accounts. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReverse} disabled={mutation.isPending}>
              {mutation.isPending ? 'Reversing...' : 'Reverse & Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UserTransactionsPage;