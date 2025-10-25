import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { showSuccess, showError } from '@/utils/toast';
import { format, subMonths } from 'date-fns';
import { Separator } from '@/components/ui/separator';
import { CardDescription } from '../ui/card';
import { DatePicker } from '../ui/datepicker';
import { ResponsiveSelect } from '../ui/ResponsiveSelect';

const formSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  role: z.enum(['user', 'admin']),
  outstanding_amount: z.coerce.number().min(0, 'Amount must be non-negative'),
  membership_start_date: z.date().nullable().optional(),
});

type FormValues = z.infer<typeof formSchema>;

type MergedUser = {
  id: string;
  email: string;
  created_at: string;
  first_name: string | null;
  last_name: string | null;
  role: 'admin' | 'user';
  outstanding_amount: number;
  reference_name: string | null;
  membership_start_date: string | null;
};

const updateUser = async ({ userId, updates }: { userId: string, updates: FormValues }) => {
  const { error, data } = await supabase.functions.invoke('admin-update-user', {
    body: { userId, updates },
  });

  if (error) throw new Error(error.message);
  if (data.error) throw new Error(data.error);
};

type EditUserDialogProps = {
  user: MergedUser;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

const roleOptions = [
  { value: 'user', label: 'User' },
  { value: 'admin', label: 'Admin' },
];

const EditUserDialog = ({ user, isOpen, onOpenChange }: EditUserDialogProps) => {
  const queryClient = useQueryClient();
  const [historicalAmount, setHistoricalAmount] = useState('');

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      role: user.role,
      outstanding_amount: user.outstanding_amount || 0,
      membership_start_date: user.membership_start_date ? new Date(user.membership_start_date) : undefined,
    },
  });

  useEffect(() => {
    form.reset({
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      role: user.role,
      outstanding_amount: user.outstanding_amount || 0,
      membership_start_date: user.membership_start_date ? new Date(user.membership_start_date) : undefined,
    });
  }, [user, form]);

  const mutation = useMutation({
    mutationFn: updateUser,
    onSuccess: () => {
      showSuccess('User updated successfully!');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      onOpenChange(false);
    },
    onError: (error) => {
      showError(`Failed to update user: ${error.message}`);
    },
  });

  const onSubmit = (values: FormValues) => {
    mutation.mutate({ userId: user.id, updates: values });
  };

  const handleCalculateDate = () => {
    const amount = parseFloat(historicalAmount);
    if (isNaN(amount) || amount <= 0) {
      showError("Please enter a valid positive amount.");
      return;
    }
    const months = Math.floor(amount / 500);
    // The reference date is the first day of the last month of the period (Dec 2024).
    // We subtract (months - 1) to find the first day of the first month of contribution.
    // e.g., 12 months -> sub(Dec 1, 11) -> Jan 1.
    // e.g., 1 month -> sub(Dec 1, 0) -> Dec 1.
    const startDate = subMonths(new Date('2024-12-01'), months - 1);
    form.setValue('membership_start_date', startDate, { shouldValidate: true });
    showSuccess(`Calculated start date: ${format(startDate, 'PPP')}. Save changes to apply.`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Update the details for {user.email}.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="first_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="last_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="outstanding_amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Outstanding Amount ($)</FormLabel>
                  <FormControl><Input type="number" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <ResponsiveSelect
                    options={roleOptions}
                    value={field.value}
                    onChange={field.onChange}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Separator />

            <div className="space-y-2">
              <Label>Set Tenure from History</Label>
              <CardDescription>Calculate start date from total contributions made before 2025.</CardDescription>
              <div className="flex items-center gap-2 pt-2">
                <Input 
                  type="number" 
                  placeholder="e.g., 6000" 
                  value={historicalAmount}
                  onChange={(e) => setHistoricalAmount(e.target.value)}
                />
                <Button type="button" variant="secondary" onClick={handleCalculateDate}>Calculate</Button>
              </div>
            </div>

            <FormField
              control={form.control}
              name="membership_start_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Membership Start Date (Override)</FormLabel>
                  <DatePicker value={field.value} onChange={field.onChange} />
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

export default EditUserDialog;