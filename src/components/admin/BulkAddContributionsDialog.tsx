import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { showSuccess, showError } from '@/utils/toast';
import { differenceInCalendarMonths } from 'date-fns';
import { Label } from '@/components/ui/label';
import { ResponsiveSelect } from '../ui/ResponsiveSelect';

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 10 }, (_, i) => currentYear - i);
const months = Array.from({ length: 12 }, (_, i) => ({
  value: i, // 0-indexed for Date object
  label: new Date(0, i).toLocaleString('default', { month: 'long' }),
}));

const formSchema = z.object({
  userId: z.string().uuid('Please select a user.'),
  startYear: z.string(),
  startMonth: z.string(),
  endYear: z.string(),
  endMonth: z.string(),
}).refine(data => {
    const startDate = new Date(parseInt(data.startYear), parseInt(data.startMonth));
    const endDate = new Date(parseInt(data.endYear), parseInt(data.endMonth));
    return endDate >= startDate;
}, {
    message: "End date must be on or after start date.",
    path: ["endMonth"],
});

type FormValues = z.infer<typeof formSchema>;

type UserProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

const fetchUsers = async (): Promise<UserProfile[]> => {
  const { data, error } = await supabase.from('profiles').select('id, first_name, last_name').order('first_name', { ascending: true });
  if (error) throw new Error('Failed to fetch users');
  return data;
};

const bulkAddContributions = async (values: FormValues) => {
  const { error, data } = await supabase.functions.invoke('admin-bulk-add-contributions', {
    body: {
      userId: values.userId,
      startYear: parseInt(values.startYear),
      startMonth: parseInt(values.startMonth),
      endYear: parseInt(values.endYear),
      endMonth: parseInt(values.endMonth),
    },
  });

  if (error) throw new Error(error.message);
  if (data.error) throw new Error(data.error);
  return data;
};

type BulkAddContributionsDialogProps = {
  children: React.ReactNode;
};

const yearOptions = years.map(y => ({ value: String(y), label: String(y) }));
const monthOptions = months.map(m => ({ value: String(m.value), label: m.label }));

const BulkAddContributionsDialog = ({ children }: BulkAddContributionsDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: users, isLoading: isLoadingUsers } = useQuery({
    queryKey: ['all-users-for-tx'],
    queryFn: fetchUsers,
  });

  const userOptions = users?.map(user => ({
    value: user.id,
    label: `${user.first_name || ''} ${user.last_name || ''}`.trim()
  })) || [];

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
        startYear: String(currentYear),
        startMonth: String(new Date().getMonth()),
        endYear: String(currentYear),
        endMonth: String(new Date().getMonth()),
    }
  });

  const watchedValues = form.watch();

  const summary = useMemo(() => {
    const { startYear, startMonth, endYear, endMonth } = watchedValues;
    if (!startYear || !startMonth || !endYear || !endMonth) return null;

    try {
      const startDate = new Date(parseInt(startYear), parseInt(startMonth));
      const endDate = new Date(parseInt(endYear), parseInt(endMonth));

      if (endDate < startDate) return { months: 0, total: 0 };

      const numberOfMonths = differenceInCalendarMonths(endDate, startDate) + 1;
      const totalAmount = numberOfMonths * 500;

      return { months: numberOfMonths, total: totalAmount };
    } catch (e) {
      return null;
    }
  }, [watchedValues]);

  const mutation = useMutation({
    mutationFn: bulkAddContributions,
    onSuccess: (data) => {
      showSuccess(data.message);
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['main-balance'] });
      queryClient.invalidateQueries({ queryKey: ['user-contributions'] });
      queryClient.invalidateQueries({ queryKey: ['user-transactions'] });
      setIsOpen(false);
      form.reset();
    },
    onError: (error) => {
      showError(`Failed to add contributions: ${error.message}`);
    },
  });

  const onSubmit = (values: FormValues) => {
    mutation.mutate(values);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Bulk Add Contributions</DialogTitle>
          <DialogDescription>
            Manually add monthly contributions for a user over a period of time. Each contribution is $500.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="userId"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>User</FormLabel>
                  <ResponsiveSelect
                    options={userOptions}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder={isLoadingUsers ? "Loading users..." : "Select a user"}
                    disabled={isLoadingUsers}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <Label>Start Date</Label>
                <Label>End Date</Label>
                <div className="grid grid-cols-2 gap-2">
                    <FormField control={form.control} name="startMonth" render={({ field }) => (
                        <FormItem>
                            <ResponsiveSelect options={monthOptions} value={field.value} onChange={field.onChange} />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="startYear" render={({ field }) => (
                        <FormItem>
                            <ResponsiveSelect options={yearOptions} value={field.value} onChange={field.onChange} />
                        </FormItem>
                    )} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <FormField control={form.control} name="endMonth" render={({ field }) => (
                        <FormItem>
                            <ResponsiveSelect options={monthOptions} value={field.value} onChange={field.onChange} />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="endYear" render={({ field }) => (
                        <FormItem>
                            <ResponsiveSelect options={yearOptions} value={field.value} onChange={field.onChange} />
                        </FormItem>
                    )} />
                </div>
                <FormMessage className="col-span-2">{form.formState.errors.endMonth?.message}</FormMessage>
            </div>

            {summary && summary.months > 0 && (
                <div className="p-4 bg-muted rounded-md text-sm">
                    You are about to add <span className="font-bold">{summary.months}</span> monthly contributions, for a total of <span className="font-bold">${summary.total.toLocaleString('en-IN')}</span>.
                </div>
            )}

            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending || !summary || summary.months <= 0}>
                {mutation.isPending ? 'Adding...' : 'Add Contributions'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default BulkAddContributionsDialog;