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
import { Copy, ListChecks } from 'lucide-react';
import { Textarea } from '../ui/textarea';

type ContributionStatus = {
  fullName: string;
  status: 'paid' | 'pending';
};

const fetchContributionList = async (year: number, month: number): Promise<ContributionStatus[]> => {
  const { data, error } = await supabase.functions.invoke('admin-get-monthly-contributions', {
    body: { year, month }, // month is 0-indexed
  });
  if (error) throw new Error(error.message);
  if (data.error) throw new Error(data.error);
  return data.contributionList;
};

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
const months = Array.from({ length: 12 }, (_, i) => ({
  value: i, // 0-indexed for Date object and our function
  label: new Date(0, i).toLocaleString('default', { month: 'long' }),
}));

const yearOptions = years.map(y => ({ value: String(y), label: String(y) }));
const monthOptions = months.map(m => ({ value: String(m.value), label: m.label }));

const MonthlyContributionListDialog = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [selectedMonth, setSelectedMonth] = useState(String(new Date().getMonth()));

  const { data: contributionList, isLoading } = useQuery({
    queryKey: ['contributionList', selectedYear, selectedMonth],
    queryFn: () => fetchContributionList(parseInt(selectedYear), parseInt(selectedMonth)),
    enabled: isOpen, // Only fetch when the dialog is open
  });

  const formattedList = useMemo(() => {
    if (!contributionList) return '';

    const monthName = months.find(m => m.value === parseInt(selectedMonth))?.label;
    const header = `Monthly Contribution - ${monthName} ${selectedYear}\n`;

    const listItems = contributionList.map((item, index) => {
      const status = item.status === 'paid' ? '500' : '🚫';
      return `${index + 1}.\t${item.fullName} - ${status}`;
    }).join('\n');

    return header + listItems;
  }, [contributionList, selectedYear, selectedMonth]);

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
          <ListChecks className="mr-2 h-4 w-4" />
          Monthly Contribution List
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Monthly Contribution Status</DialogTitle>
          <DialogDescription>
            Generate a list of all members and their contribution status for a selected month.
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
              className="h-80 w-full font-mono text-xs"
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

export default MonthlyContributionListDialog;