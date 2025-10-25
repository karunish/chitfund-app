import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthContext } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { useMemo } from 'react';
import { getMonth, getYear, format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';

type Transaction = {
  created_at: string;
  type: 'deposit' | 'withdrawal';
  amount: number;
};

const fetchUserContributions = async (userId: string): Promise<Transaction[]> => {
  const { data, error } = await supabase
    .from('transactions')
    .select('created_at, type, amount')
    .eq('user_id', userId)
    .eq('type', 'deposit');

  if (error) {
    console.error("Error fetching user contributions:", error);
    throw new Error(error.message);
  }
  return data;
};

const ContributionCalendar = () => {
  const { user } = useAuthContext();
  const { data: transactions, isLoading } = useQuery({
    queryKey: ['user-contributions', user?.id],
    queryFn: () => fetchUserContributions(user!.id),
    enabled: !!user,
  });

  const { monthlyTotals, yearlyTotals } = useMemo(() => {
    if (!transactions) return { monthlyTotals: {}, yearlyTotals: {} };

    const totals: Record<number, Record<number, number>> = {};
    const yearTotals: Record<number, number> = {};

    for (const tx of transactions) {
      const date = new Date(tx.created_at);
      const year = getYear(date);
      const month = getMonth(date);
      const amount = tx.amount;

      if (!totals[year]) totals[year] = {};
      if (!totals[year][month]) totals[year][month] = 0;
      if (!yearTotals[year]) yearTotals[year] = 0;

      totals[year][month] += amount;
      yearTotals[year] += amount;
    }

    return { monthlyTotals: totals, yearlyTotals: yearTotals };
  }, [transactions]);

  const yearsToDisplay = Object.keys(yearlyTotals).length > 0 
    ? Object.keys(yearlyTotals).map(Number).sort((a, b) => b - a)
    : [new Date().getFullYear()];

  if (isLoading) {
    return <Skeleton className="h-40 w-full mt-2" />;
  }

  return (
    <div className="space-y-6 mt-2">
      {yearsToDisplay.map(year => (
        <div key={year}>
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-semibold text-base">{year}</h4>
            {yearlyTotals[year] > 0 && (
              <Badge variant="secondary">
                Total: ${yearlyTotals[year].toLocaleString('en-IN')}
              </Badge>
            )}
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-2">
            {Array.from({ length: 12 }).map((_, i) => {
              const monthName = format(new Date(year, i), 'MMM');
              const contributionAmount = monthlyTotals[year]?.[i];
              const hasContributed = contributionAmount && contributionAmount > 0;

              const monthCell = (
                <div
                  className={`p-2 text-center rounded-md text-xs font-medium transition-colors ${
                    hasContributed
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 cursor-pointer hover:bg-green-200 dark:hover:bg-green-800'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {monthName}
                </div>
              );

              if (hasContributed) {
                return (
                  <Popover key={i}>
                    <PopoverTrigger asChild>{monthCell}</PopoverTrigger>
                    <PopoverContent className="w-auto text-sm p-3">
                      <p>
                        Contribution for <span className="font-bold">{format(new Date(year, i), 'MMMM yyyy')}</span>:
                      </p>
                      <p className="text-lg font-bold text-center mt-1">
                        ${contributionAmount.toLocaleString('en-IN')}
                      </p>
                    </PopoverContent>
                  </Popover>
                );
              }

              return <div key={i}>{monthCell}</div>;
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ContributionCalendar;