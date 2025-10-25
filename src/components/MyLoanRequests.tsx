import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthContext } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

type LoanRequestWithProcessor = {
  id: number;
  amount: number;
  reason: string;
  status: 'pending' | 'in-process' | 'rejected' | 'closed' | 'approved';
  created_at: string;
  processed_at: string | null;
  rejection_reason: string | null;
  guarantor_name: string | null;
  guarantor_2_name: string | null;
  processor: {
    first_name: string;
    last_name: string;
  } | null;
};

const MyLoanRequests = () => {
  const { user } = useAuthContext();
  const [requests, setRequests] = useState<LoanRequestWithProcessor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRequests = async () => {
      if (!user) return;
      setLoading(true);
      const { data, error } = await supabase
        .from('loan_requests')
        .select(`
          id,
          amount,
          reason,
          status,
          created_at,
          processed_at,
          rejection_reason,
          guarantor_name,
          guarantor_2_name,
          processor:profiles!processed_by ( first_name, last_name )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Error fetching loan requests:", error);
      } else {
        setRequests(data as any);
      }
      setLoading(false);
    };

    fetchRequests();
  }, [user]);

  const getStatusBadgeVariant = (status: LoanRequestWithProcessor['status']): "secondary" | "default" | "destructive" | "outline" => {
    switch (status) {
      case 'in-process':
        return 'default';
      case 'approved':
        return 'outline';
      case 'closed':
        return 'secondary';
      case 'rejected':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getStatusText = (status: LoanRequestWithProcessor['status']) => {
    if (status === 'approved') return 'Approved';
    if (status === 'in-process') return 'In Process';
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>My Loan Requests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Loan Requests</CardTitle>
      </CardHeader>
      <CardContent>
        {requests.length === 0 ? (
          <p className="text-muted-foreground">You have not made any loan requests yet.</p>
        ) : (
          <div className="space-y-4">
            {requests.map((req) => (
              <div key={req.id} className="p-4 border rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex-grow">
                  <p className="text-lg font-bold">${req.amount.toLocaleString('en-IN')}</p>
                  <p className="text-sm text-muted-foreground">Guarantor(s): {req.guarantor_name || 'None'}{req.guarantor_2_name ? `, ${req.guarantor_2_name}` : ''}</p>
                  <p className="text-sm text-muted-foreground mt-1">Reason: {req.reason}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Requested on {format(new Date(req.created_at), 'PPP')}
                  </p>
                  {req.status !== 'pending' && req.processed_at && (
                     <p className="text-xs text-muted-foreground">
                       Processed on {format(new Date(req.processed_at), 'PPP')} by {`${req.processor?.first_name || ''} ${req.processor?.last_name || ''}`.trim() || 'Admin'}
                     </p>
                  )}
                  {req.status === 'rejected' && req.rejection_reason && (
                    <p className="text-sm text-destructive mt-2">
                      <span className="font-semibold">Reason:</span> {req.rejection_reason}
                    </p>
                  )}
                </div>
                <Badge variant={getStatusBadgeVariant(req.status)} className="capitalize self-start sm:self-center">{getStatusText(req.status)}</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MyLoanRequests;