import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

type LoanTier = {
  amount: number;
  eligibilityMonths: number;
  fine: number;
  repaymentInfo: string;
};

const fetchLoanTiers = async (): Promise<LoanTier[]> => {
  const { data, error } = await supabase
    .from('loan_tiers')
    .select('amount, eligibility_months, fine, repayment_info')
    .order('amount', { ascending: true });
  if (error) throw new Error(error.message);
  return data.map(tier => ({
    amount: tier.amount,
    eligibilityMonths: tier.eligibility_months,
    fine: tier.fine,
    repaymentInfo: tier.repayment_info,
  }));
};

const LoanRulesPage = () => {
  const { data: loanTiers, isLoading } = useQuery<LoanTier[]>({
    queryKey: ['loanTiers'],
    queryFn: fetchLoanTiers,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="icon" className="h-7 w-7">
          <Link to="/loan-request">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back</span>
          </Link>
        </Button>
        <h2 className="text-2xl font-bold">Loan Rules & Eligibility</h2>
      </div>
      <p className="text-muted-foreground">
        Here are the detailed rules for loan eligibility, fines, and repayment periods. Eligibility is based on the number of months you have been a contributing member.
      </p>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-48 w-full" />)
        ) : (
          loanTiers?.map((tier) => (
            <Card key={tier.amount}>
              <CardHeader>
                <CardTitle>Loan of ${tier.amount.toLocaleString('en-IN')}</CardTitle>
                <CardDescription>Eligible after {tier.eligibilityMonths} months</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fine:</span>
                  <span className="font-medium">${tier.fine.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Total Repayment:</span>
                  <span>${(tier.amount + tier.fine).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Repayment Period:</span>
                  <span className="font-medium">{tier.repaymentInfo}</span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default LoanRulesPage;