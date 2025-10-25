import { useEffect } from 'react';
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
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { showSuccess, showError } from '@/utils/toast';
import { DatePicker } from '../ui/datepicker';
import { ResponsiveSelect } from '../ui/ResponsiveSelect';

const formSchema = z.object({
  amount: z.coerce.number().positive('Amount must be a positive number.'),
  reason: z.string().optional(),
  guarantor_id: z.string().uuid('Please select a guarantor.'),
  status: z.enum(['pending', 'approved', 'in-process', 'rejected', 'closed']),
  created_at: z.date({ required_error: "Issue date is required." }),
  due_date: z.date().nullable().optional(),
});

type FormValues = z.infer<typeof formSchema>;

type LoanRequest = {
  id: number;
  amount: number;
  reason: string | null;
  status: 'pending' | 'in-process' | 'rejected' | 'closed' | 'approved';
  created_at: string;
  due_date: string | null;
  guarantor_id: string | null;
};

type UserProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

const fetchAllUsers = async (): Promise<UserProfile[]> => {
  const { data, error } = await supabase.from('profiles').select('id, first_name, last_name');
  if (error) throw new Error('Failed to fetch users');
  return data;
};

const updateLoan = async ({ loanId, updates }: { loanId: number, updates: Partial<FormValues> & { guarantor_name?: string } }) => {
  const { error, data } = await supabase.functions.invoke('admin-update-loan', {
    body: { loanId, updates },
  });

  if (error) throw new Error(error.message);
  if (data.error) throw new Error(data.error);
};

type EditLoanDialogProps = {
  loan: LoanRequest;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

const statusOptions = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'in-process', label: 'In Process' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'closed', label: 'Closed' },
];

const EditLoanDialog = ({ loan, isOpen, onOpenChange }: EditLoanDialogProps) => {
  const queryClient = useQueryClient();
  const { data: users, isLoading: isLoadingUsers } = useQuery({
    queryKey: ['all-users-for-tx'],
    queryFn: fetchAllUsers,
  });

  const userOptions = users?.map(user => ({
    value: user.id,
    label: `${user.first_name || ''} ${user.last_name || ''}`.trim()
  })) || [];

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    if (loan) {
      form.reset({
        amount: loan.amount,
        reason: loan.reason || '',
        guarantor_id: loan.guarantor_id || '',
        status: loan.status,
        created_at: new Date(loan.created_at),
        due_date: loan.due_date ? new Date(loan.due_date) : undefined,
      });
    }
  }, [loan, form]);

  const mutation = useMutation({
    mutationFn: updateLoan,
    onSuccess: () => {
      showSuccess('Loan updated successfully!');
      queryClient.invalidateQueries({ queryKey: ['loanHistory', loan.id] });
      onOpenChange(false);
    },
    onError: (error) => {
      showError(`Failed to update loan: ${error.message}`);
    },
  });

  const onSubmit = (values: FormValues) => {
    const selectedGuarantor = users?.find(u => u.id === values.guarantor_id);
    const guarantor_name = `${selectedGuarantor?.first_name || ''} ${selectedGuarantor?.last_name || ''}`.trim();
    
    const updatePayload = {
      ...values,
      guarantor_name,
    };
    
    mutation.mutate({ loanId: loan.id, updates: updatePayload });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Loan Request</DialogTitle>
          <DialogDescription>
            Modify the details for this loan. Note: Changing the amount will not auto-adjust balances.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount ($)</FormLabel>
                  <FormControl><Input type="number" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="guarantor_id"
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
                name="created_at"
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
                name="due_date"
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
                  <FormControl><Textarea placeholder="Reason for loan" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default EditLoanDialog;