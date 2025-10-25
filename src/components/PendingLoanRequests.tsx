import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthContext } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

type LoanRequest = {
  id: number;
  amount: number;
  reason: string;
  created_at: string;
};

const fetchPendingRequests = async (userId: string): Promise<LoanRequest[]> => {
  const { data, error } = await supabase
    .from('loan_requests')
    .select('id, amount, reason, created_at')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Error fetching pending loan requests:", error);
    throw new Error(error.message);
  }
  return data;
};

const PendingLoanRequests = () => {
  const { user } = useAuthContext();
  const { data: requests, isLoading } = useQuery({
    queryKey: ['pending-loan-requests', user?.id],
    queryFn: () => fetchPendingRequests(user!.id),
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (!requests || requests.length === 0) {
    return <p className="text-sm text-muted-foreground mt-2">You have no pending loan requests.</p>;
  }

  return (
    <div className="space-y-4 mt-2">
      {requests.map((req) => (
        <div key={req.id} className="p-4 border rounded-lg flex justify-between items-start gap-4">
          <div className="flex-grow">
            <p className="text-lg font-bold">${req.amount.toLocaleString('en-IN')}</p>
            <p className="text-sm text-muted-foreground">{req.reason}</p>
          </div>
          <div className="text-right text-sm text-muted-foreground shrink-0">
            <p className="font-medium">Applied on</p>
            <p>{format(new Date(req.created_at), 'PP p')}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default PendingLoanRequests;