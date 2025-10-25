import { useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { showSuccess, showError } from '@/utils/toast';
import { Textarea } from '../ui/textarea';
import { ResponsiveSelect } from '../ui/ResponsiveSelect';

const formSchema = z.object({
  userId: z.string().uuid('Please select a user.'),
  type: z.enum(['deposit', 'withdrawal']),
  amount: z.coerce.number().positive('Amount must be a positive number.'),
  description: z.string().optional(),
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

const createTransaction = async (values: FormValues & { userFullName: string }) => {
  const { error, data } = await supabase.functions.invoke('admin-create-transaction', {
    body: {
      userId: values.userId,
      type: values.type,
      amount: values.amount,
      description: values.description,
      userFullName: values.userFullName,
    },
  });

  if (error) throw new Error(error.message);
  if (data.error) throw new Error(data.error);
};

type CreateTransactionDialogProps = {
  children: React.ReactNode;
};

const typeOptions = [
  { value: 'deposit', label: 'Deposit (Payment)' },
  { value: 'withdrawal', label: 'Withdrawal (Loan)' },
];

const CreateTransactionDialog = ({ children }: CreateTransactionDialogProps) => {
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
  });

  const mutation = useMutation({
    mutationFn: createTransaction,
    onSuccess: () => {
      showSuccess('Transaction logged successfully!');
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['main-balance'] });
      setIsOpen(false);
      form.reset();
    },
    onError: (error) => {
      showError(`Failed to log transaction: ${error.message}`);
    },
  });

  const onSubmit = (values: FormValues) => {
    const selectedUser = users?.find(u => u.id === values.userId);
    const userFullName = `${selectedUser?.first_name || ''} ${selectedUser?.last_name || ''}`.trim();
    if (!userFullName) {
      showError("Could not find the full name for the selected user.");
      return;
    }
    mutation.mutate({ ...values, userFullName });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create Transaction Log</DialogTitle>
          <DialogDescription>
            Record a new transaction. This will update all relevant balances.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                    placeholder={isLoadingUsers ? "Loading users..." : "Select a user"}
                    disabled={isLoadingUsers}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Transaction Type</FormLabel>
                  <ResponsiveSelect
                    options={typeOptions}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Select a type"
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
                  <FormLabel>Amount ($)</FormLabel>
                  <FormControl><Input type="number" step="0.01" placeholder="500" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl><Textarea placeholder="e.g., Monthly contribution for July" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Logging...' : 'Log Transaction'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTransactionDialog;