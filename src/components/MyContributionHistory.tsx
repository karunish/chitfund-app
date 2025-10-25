import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthContext } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

type PaymentProof = {
  id: number;
  contribution_month: string;
  status: 'pending' | 'approved' | 'rejected';
  notes: string | null;
  created_at: string;
};

const fetchHistory = async (userId: string): Promise<PaymentProof[]> => {
  const { data, error } = await supabase
    .from('payment_proofs')
    .select('id, contribution_month, status, notes, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data;
};

const MyContributionHistory = () => {
  const { user } = useAuthContext();
  const { data: history, isLoading } = useQuery({
    queryKey: ['contribution-history', user?.id],
    queryFn: () => fetchHistory(user!.id),
    enabled: !!user,
  });

  const getStatusBadgeVariant = (status: 'pending' | 'approved' | 'rejected'): "secondary" | "default" | "destructive" => {
    switch (status) {
      case 'approved': return 'default';
      case 'rejected': return 'destructive';
      default: return 'secondary';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Submission History</CardTitle>
        <CardDescription>Track the status of your contribution proofs.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : history && history.length > 0 ? (
          <div className="space-y-4">
            {history.map(proof => (
              <div key={proof.id} className="p-4 border rounded-lg">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div>
                    <p className="font-semibold">
                      Contribution for {format(new Date(proof.contribution_month), 'MMMM yyyy')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Submitted on {format(new Date(proof.created_at), 'PPP')}
                    </p>
                  </div>
                  <Badge variant={getStatusBadgeVariant(proof.status)} className="capitalize self-start sm:self-center">
                    {proof.status}
                  </Badge>
                </div>
                {proof.status === 'rejected' && proof.notes && (
                  <p className="text-sm text-destructive mt-2">
                    <span className="font-semibold">Reason:</span> {proof.notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-4">You have no submission history.</p>
        )}
      </CardContent>
    </Card>
  );
};

export default MyContributionHistory;