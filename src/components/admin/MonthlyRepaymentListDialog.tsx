import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { showSuccess, showError } from '@/utils/toast';
import { ResponsiveSelect } from '../ui/ResponsiveSelect';
import { Skeleton } from '../ui/skeleton';
import { Copy, ClipboardList } from 'lucide-react';
import { Textarea } from '../ui/textarea';
import { format } from 'date-fns';

type Repayment = {
  userName: string;
  loanTakenDate: string;
  loanAmount: number;
  loanReturnDate: string;
  loanReturnAmount: number;
  guarantorName: string;
  status: 'in-process' | 'closed';
};

const fetchRepaymentList = async (year: number, month: number): Promise<Repayment[]> => {
  const { data, error } = await supabase.functions.invoke('admin-get-monthly-repayments', {
    body: { year, month }, // month is 0-indexed
  });
  if (error) throw new Error(error.message);
  if (data.error) throw new Error(data.error);
  return data.repaymentList;
};

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
const months = Array.from({ length: 12 }, (_, i) => ({
  value: i, // 0-indexed for Date object and our function
  label: new Date(0, i).toLocaleString('default', { month: 'long' }),
}));

const yearOptions = years.map(y => ({ value: String(y), label: String(y) }));
const monthOptions = months.map(m => ({ value: String(m.value), label: m.label }));

const MonthlyRepaymentListDialog = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [selectedMonth, setSelectedMonth] = useState(String(new Date().getMonth()));

  const { data: repaymentList, isLoading } = useQuery({
    queryKey: ['repaymentList', selectedYear, selectedMonth],
    queryFn: () => fetchRepaymentList(parseInt(selectedYear), parseInt(selectedMonth)),
    enabled: isOpen,
  });

  const formattedList = useMemo(() => {
    if (!repaymentList) return '';

    const monthName = months.find(m => m.value === parseInt(selectedMonth))?.label;
    const header = `${format(new Date(parseInt(selectedYear), parseInt(selectedMonth)), 'MMM-yyyy').toUpperCase()} MONTH LOAN REPAYMENT DETAILS:\n\n`;

    if (repaymentList.length === 0) {
      return `${header}No loan repayments due for this month.`;
    }

    const listItems = repaymentList.map(item => {
      const statusText = item.status === 'closed' 
        ? 'Loan Repayment Done ✅' 
        : 'Loan Repayment pending ❌';
      
      return [
        `Name: ${item.userName}`,
        `Loan Taken Date: ${format(new Date(item.loanTakenDate), 'dd/MM/yyyy')}`,
        `Loan Amount: ${item.loanAmount.toLocaleString('en-IN')}`,
        `Loan Return Date: ${format(new Date(item.loanReturnDate), 'dd/MM/yyyy')}`,
        `Loan Return Amount: ${item.loanReturnAmount.toLocaleString('en-IN')}`,
        `Guarantor: ${item.guarantorName}`,
        `Status: ${statusText}`
      ].join('\n');
    }).join('\n\n');

    return header + listItems;
  }, [repaymentList, selectedYear, selectedMonth]);

  const handleCopy = () => {
    if (!formattedList) {
      showError("Nothing to copy.");
      return;
    }
    navigator.clipboard.writeText(formattedList);
    showSuccess("List copied to clipboard!");
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <ClipboardList className="mr-2 h-4 w-4" />
          Monthly Repayment List
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Monthly Loan Repayment List</DialogTitle>
          <DialogDescription>
            Generate a list of all loans due for repayment in the selected month.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-4">
          <ResponsiveSelect
            options={monthOptions}
            value={selectedMonth}
            onChange={setSelectedMonth}
            placeholder="Select month"
          />
          <ResponsiveSelect
            options={yearOptions}
            value={selectedYear}
            onChange={setSelectedYear}
            placeholder="Select year"
          />
        </div>
        <div className="max-h-80 overflow-y-auto rounded-md border p-4">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/6" />
            </div>
          ) : (
            <Textarea
              readOnly
              value={formattedList}
              className="h-80 w-full font-mono text-xs whitespace-pre-wrap"
              placeholder="Select a month and year to generate the list."
            />
          )}
        </div>
        <div className="flex justify-end pt-4">
          <Button onClick={handleCopy} disabled={isLoading || !formattedList}>
            <Copy className="mr-2 h-4 w-4" />
            Copy List
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MonthlyRepaymentListDialog;