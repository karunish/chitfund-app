import { useAuthContext } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import PendingLoanRequests from "./PendingLoanRequests";

type Transaction = {
  id: number;
  created_at: string;
  type: 'deposit' | 'withdrawal';
  amount: number;
  description: string | null;
};

const fetchUserTransactions = async (userId: string): Promise<Transaction[]> => {
  const { data, error } = await supabase
    .from('transactions')
    .select('id, created_at, type, amount, description')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(3);

  if (error) {
    console.error("Error fetching user transactions:", error);
    throw new Error(error.message);
  }
  return data;
};

const UserSummary = () => {
    const { user, profile } = useAuthContext();

    const { data: userTransactions, isLoading: isLoadingTransactions } = useQuery({
        queryKey: ['user-dashboard-transactions', user?.id],
        queryFn: () => fetchUserTransactions(user!.id),
        enabled: !!user,
    });

    const outstandingAmount = profile?.outstanding_amount ?? 0;

    return (
        <div className="grid gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>My Financial Overview</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Outstanding amount for the month</span>
                        <span className="text-2xl font-bold">${outstandingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Pending Loan Requests</CardTitle>
                    <CardDescription>Your loan requests that are awaiting approval.</CardDescription>
                </CardHeader>
                <CardContent>
                    <PendingLoanRequests />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>My Recent Transactions</CardTitle>
                    <CardDescription>Your last 3 personal transactions.</CardDescription>
                </CardHeader>
                <CardContent>
                {isLoadingTransactions ? (
                  <div className="space-y-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : userTransactions && userTransactions.length > 0 ? (
                  <ul className="space-y-4">
                    {userTransactions.map(tx => (
                      <li key={tx.id} className="flex justify-between items-center">
                        <div>
                          <p className="font-medium capitalize">{tx.description || tx.type}</p>
                          <p className="text-sm text-muted-foreground">{format(new Date(tx.created_at), 'PPP')}</p>
                        </div>
                        <span className={`font-medium ${tx.type === 'deposit' ? 'text-green-600' : 'text-red-600'}`}>
                          {tx.type === 'deposit' ? '+' : '-'}${tx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">You have no recent transactions.</p>
                )}
                </CardContent>
            </Card>
        </div>
    )
}

export default UserSummary;