import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthContext } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { Separator } from '@/components/ui/separator';
import MyContributionHistory from '@/components/MyContributionHistory';
import { ResponsiveSelect } from '@/components/ui/ResponsiveSelect';

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
const months = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: new Date(0, i).toLocaleString('default', { month: 'long' }),
}));

const yearOptions = years.map(y => ({ value: String(y), label: String(y) }));
const monthOptions = months.map(m => ({ value: m.value, label: m.label }));

const formSchema = z.object({
  year: z.string().min(1, 'Year is required'),
  month: z.string().min(1, 'Month is required'),
  proof: z.instanceof(File).refine(file => file.size > 0, 'A proof of payment is required.'),
});

type FormValues = z.infer<typeof formSchema>;

const ContributePage = () => {
  const { user } = useAuthContext();
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!user) throw new Error('User not authenticated');

      const formData = new FormData();
      formData.append('year', values.year);
      formData.append('month', values.month);
      formData.append('proof', values.proof);

      const { data, error } = await supabase.functions.invoke('submit-payment-proof', {
        body: formData,
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
    },
    onMutate: async () => {
      const toastId = showLoading('Submitting proof...');
      return { toastId };
    },
    onSuccess: (_, __, context) => {
      if (context?.toastId) dismissToast(context.toastId);
      showSuccess('Proof submitted successfully for review!');
      queryClient.invalidateQueries({ queryKey: ['contribution-history', user?.id] });
      form.reset();
      const fileInput = document.getElementById('proof-input') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }
    },
    onError: (error: Error, _, context) => {
      if (context?.toastId) dismissToast(context.toastId);
      showError(`Submission failed: ${error.message}`);
    },
  });

  const onSubmit = (values: FormValues) => {
    mutation.mutate(values);
  };

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Submit Contribution Proof</CardTitle>
          <CardDescription>
            Upload a screenshot of your payment for the monthly contribution.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="year"
                  render={({ field }) => (
                    <FormItem>
                      <Label>Year</Label>
                      <ResponsiveSelect
                        options={yearOptions}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Select year"
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="month"
                  render={({ field }) => (
                    <FormItem>
                      <Label>Month</Label>
                      <ResponsiveSelect
                        options={monthOptions}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Select month"
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="proof"
                render={({ field: { onChange, value, ...rest } }) => (
                  <FormItem>
                    <Label>Payment Screenshot</Label>
                    <FormControl>
                      <Input id="proof-input" type="file" accept="image/*" onChange={(e) => onChange(e.target.files?.[0])} {...rest} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={mutation.isPending}>
                {mutation.isPending ? 'Submitting...' : 'Submit for Review'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Separator />

      <MyContributionHistory />
    </div>
  );
};

export default ContributePage;