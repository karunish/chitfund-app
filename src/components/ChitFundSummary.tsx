import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Skeleton } from "@/components/ui/skeleton";

type Transaction = {
  id: number;
  amount: number;
  type: 'deposit' | 'withdrawal';
  user_full_name: string;
  description: string | null;
};

const ChitFundSummary = () => {
  const [totalBalance, setTotalBalance] = useState<number | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);

  useEffect(() => {
    const fetchBalance = async () => {
      const { data, error } = await supabase
        .from('main_account')
        .select('balance')
        .single();
      
      if (error) {
        console.error("Error fetching balance:", error);
        setTotalBalance(0);
      } else {
        setTotalBalance(data.balance);
      }
    };

    const fetchRecentTransactions = async () => {
      setLoadingTransactions(true);
      const { data, error } = await supabase
        .from('transactions')
        .select('id, amount, type, user_full_name, description')
        .is('user_id', null) // Fetch only public logs
        .order('created_at', { ascending: false })
        .limit(3);

      if (error) {
        console.error("Error fetching recent transactions:", error);
        setRecentTransactions([]);
      } else {
        setRecentTransactions(data as Transaction[]);
      }
      setLoadingTransactions(false);
    };

    fetchBalance();
    fetchRecentTransactions();
  }, []);

  const getTransactionDescription = (tx: Transaction): string => {
    const desc = tx.description;
    if (desc === 'Loan') return 'Loan Disbursed';
    if (desc === 'Deposit') return 'Contribution';
    if (desc) return desc;
    return tx.type === 'deposit' ? 'Contribution' : 'Withdrawal';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Main Account Summary</CardTitle>
      </CardHeader>
      <CardContent>
        {totalBalance === null ? (
          <Skeleton className="h-10 w-48" />
        ) : (
          <div className="text-4xl font-bold">${totalBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          Total balance across all members
        </p>
        <Separator className="my-6" />
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground">Recent Transactions</h3>
          {loadingTransactions ? (
            <>
              <div className="flex items-center space-x-4">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-[150px]" />
                  <Skeleton className="h-4 w-[100px]" />
                </div>
                <Skeleton className="h-5 w-[50px] ml-auto" />
              </div>
              <div className="flex items-center space-x-4">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-[150px]" />
                  <Skeleton className="h-4 w-[100px]" />
                </div>
                <Skeleton className="h-5 w-[50px] ml-auto" />
              </div>
              <div className="flex items-center space-x-4">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-[150px]" />
                  <Skeleton className="h-4 w-[100px]" />
                </div>
                <Skeleton className="h-5 w-[50px] ml-auto" />
              </div>
            </>
          ) : recentTransactions.length > 0 ? (
            recentTransactions.map((tx) => (
              <div key={tx.id} className="flex items-center">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full ${tx.type === 'deposit' ? 'bg-green-100 dark:bg-green-900' : 'bg-red-100 dark:bg-red-900'}`}>
                  {tx.type === 'deposit' ? (
                    <ArrowDownLeft className="h-4 w-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <ArrowUpRight className="h-4 w-4 text-red-600 dark:text-red-400" />
                  )}
                </div>
                <div className="ml-4 space-y-1">
                  <p className="text-sm font-medium leading-none">{tx.user_full_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {getTransactionDescription(tx)}
                  </p>
                </div>
                <div className={`ml-auto font-medium ${tx.type === 'deposit' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {tx.type === 'deposit' ? '+' : '-'}${Number(tx.amount).toLocaleString('en-IN')}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center">No recent transactions found.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ChitFundSummary;