import { useState, useMemo, useEffect } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { showSuccess, showError } from '@/utils/toast';
import { addMonths } from 'date-fns';
import { Card, CardContent } from '../ui/card';
import { DatePicker } from '../ui/datepicker';
import { ResponsiveSelect } from '../ui/ResponsiveSelect';

type LoanTier = {
  amount: number;
  fine: number;
  repaymentInfo: string;
};

const formSchema = z.object({
  userId: z.string().uuid('Please select a user.'),
  amount: z.string().refine(val => !isNaN(parseFloat(val)), { message: "Please select a loan amount." }),
  reason: z.string().optional(),
  guarantorId: z.string().uuid('Please select a guarantor.'),
  status: z.enum(['pending', 'in-process', 'rejected', 'closed']),
  issueDate: z.date({ required_error: "Issue date is required." }),
  dueDate: z.date().nullable().optional(),
});

type FormValues = z.infer<typeof formSchema>;

type UserProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

const fetchUsers = async (): Promise<UserProfile[]> => {
  const { data, error } = await supabase.from('profiles').select('id, first_name, last_name');
  if (error) throw new Error('Failed to fetch users');
  return data;
};

const fetchLoanTiers = async (): Promise<LoanTier[]> => {
  const { data, error } = await supabase
    .from('loan_tiers')
    .select('amount, fine, repayment_info')
    .order('amount', { ascending: true });
  if (error) throw new Error(error.message);
  return data.map(tier => ({
    amount: tier.amount,
    fine: tier.fine,
    repaymentInfo: tier.repayment_info,
  }));
};

const createLoan = async (values: FormValues) => {
  const payload = {
    ...values,
    amount: parseFloat(values.amount),
  };
  const { error, data } = await supabase.functions.invoke('admin-create-loan', {
    body: payload,
  });

  if (error) throw new Error(error.message);
  if (data.error) throw new Error(data.error);
};

type CreateLoanDialogProps = {
  children: React.ReactNode;
};

const statusOptions = [
  { value: 'pending', label: 'Pending' },
  { value: 'in-process', label: 'In Process' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'closed', label: 'Closed' },
];

const CreateLoanDialog = ({ children }: CreateLoanDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: users, isLoading: isLoadingUsers } = useQuery({
    queryKey: ['all-users-for-tx'],
    queryFn: fetchUsers,
  });

  const { data: loanTiers, isLoading: isLoadingTiers } = useQuery<LoanTier[]>({
    queryKey: ['loanTiers'],
    queryFn: fetchLoanTiers,
  });

  const userOptions = users?.map(user => ({
    value: user.id,
    label: `${user.first_name || ''} ${user.last_name || ''}`.trim()
  })) || [];

  const loanTierOptions = loanTiers?.map(tier => ({
    value: String(tier.amount),
    label: `$${tier.amount.toLocaleString('en-IN')}`
  })) || [];

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  const watchedAmount = form.watch('amount');
  const watchedIssueDate = form.watch('issueDate');
  const { setValue } = form;

  const selectedLoanDetails = useMemo(() => {
    if (!watchedAmount || !loanTiers) return null;
    return loanTiers.find(tier => String(tier.amount) === watchedAmount);
  }, [watchedAmount, loanTiers]);

  useEffect(() => {
    if (watchedIssueDate && selectedLoanDetails?.repaymentInfo) {
      const repaymentString = selectedLoanDetails.repaymentInfo;
      const monthsMatch = repaymentString.match(/(\d+)\s+Months/);
      if (monthsMatch && monthsMatch[1]) {
        const monthsToAdd = parseInt(monthsMatch[1], 10);
        if (!isNaN(monthsToAdd)) {
          const newDueDate = addMonths(watchedIssueDate, monthsToAdd);
          setValue('dueDate', newDueDate, { shouldValidate: true });
        }
      }
    }
  }, [watchedIssueDate, selectedLoanDetails, setValue]);

  const mutation = useMutation({
    mutationFn: createLoan,
    onSuccess: () => {
      showSuccess('Loan created successfully!');
      queryClient.invalidateQueries({ queryKey: ['loanHistory'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['main-balance'] });
      setIsOpen(false);
      form.reset();
    },
    onError: (error) => {
      showError(`Failed to create loan: ${error.message}`);
    },
  });

  const onSubmit = (values: FormValues) => {
    mutation.mutate(values);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Historical Loan</DialogTitle>
          <DialogDescription>
            Manually enter a loan from your records. Approving it here will update balances.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="max-h-[60vh] overflow-y-auto pr-4 space-y-4">
              <FormField
                control={form.control}
                name="userId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>User</FormLabel>
                    <ResponsiveSelect
                      options={userOptions}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder={isLoadingUsers ? "Loading..." : "Select user"}
                      disabled={isLoadingUsers}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Loan Amount ($)</FormLabel>
                    <ResponsiveSelect
                      options={loanTierOptions}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder={isLoadingTiers ? "Loading tiers..." : "Select an amount"}
                      disabled={isLoadingTiers}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />

              {selectedLoanDetails && (
                <Card className="bg-muted/50">
                  <CardContent className="pt-4 text-sm space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fine:</span>
                      <span className="font-medium">${selectedLoanDetails.fine.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span>Total Repayment:</span>
                      <span>${(selectedLoanDetails.amount + selectedLoanDetails.fine).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Repayment Period:</span>
                      <span className="font-medium">{selectedLoanDetails.repaymentInfo}</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              <FormField
                control={form.control}
                name="guarantorId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Guarantor</FormLabel>
                    <ResponsiveSelect
                      options={userOptions}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder={isLoadingUsers ? "Loading..." : "Select guarantor"}
                      disabled={isLoadingUsers}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="issueDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Issue Date</FormLabel>
                      <DatePicker value={field.value} onChange={field.onChange} />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dueDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Due Date</FormLabel>
                      <DatePicker value={field.value} onChange={field.onChange} />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <ResponsiveSelect
                      options={statusOptions}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Select status"
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason</FormLabel>
                    <FormControl><Textarea placeholder="Reason for loan (optional)" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Creating...' : 'Create Loan'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateLoanDialog;