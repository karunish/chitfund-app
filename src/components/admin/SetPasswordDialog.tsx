import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation } from '@tanstack/react-query';
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { showSuccess, showError } from '@/utils/toast';

const formSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type FormValues = z.infer<typeof formSchema>;

type MergedUser = {
  id: string;
  email: string;
};

const setUserPassword = async ({ userId, password }: { userId: string, password: string }) => {
  const { error, data } = await supabase.functions.invoke('admin-set-user-password', {
    body: { userId, password },
  });

  if (error) throw new Error(error.message);
  if (data.error) throw new Error(data.error);
};

type SetPasswordDialogProps = {
  user: MergedUser;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

const SetPasswordDialog = ({ user, isOpen, onOpenChange }: SetPasswordDialogProps) => {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { password: '' },
  });

  const mutation = useMutation({
    mutationFn: setUserPassword,
    onSuccess: () => {
      showSuccess('User password updated successfully!');
      onOpenChange(false);
      form.reset();
    },
    onError: (error) => {
      showError(`Failed to update password: ${error.message}`);
    },
  });

  const onSubmit = (values: FormValues) => {
    mutation.mutate({ userId: user.id, password: values.password });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Set New Password</DialogTitle>
          <DialogDescription>
            Set a new password for {user.email}. The user will be able to log in with this new password immediately.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Password</FormLabel>
                  <FormControl>
                    <Input type="text" placeholder="Enter new password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Setting...' : 'Set Password'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default SetPasswordDialog;