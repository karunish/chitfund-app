import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import BulkUserCreationResultDialog from './BulkUserCreationResultDialog';

type UserPayload = {
  firstName: string;
  lastName: string;
};

type SuccessResult = {
  name: string;
  email: string;
  password: string;
};

type FailureResult = {
  name: string;
  error: string;
};

type BulkCreationResult = {
  successes: SuccessResult[];
  failures: FailureResult[];
};

const bulkCreateUsers = async (users: UserPayload[]): Promise<BulkCreationResult> => {
  const { data, error } = await supabase.functions.invoke('admin-bulk-create-users', {
    body: { users },
  });

  if (error) throw new Error(error.message);
  if (data.error) throw new Error(data.error);
  return data;
};

const BulkCreateUsers = () => {
  const [names, setNames] = useState('');
  const [result, setResult] = useState<BulkCreationResult | null>(null);
  const [isResultOpen, setIsResultOpen] = useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: bulkCreateUsers,
    onSuccess: (data) => {
      dismissToast('bulk-create');
      showSuccess(`${data.successes.length} users created successfully.`);
      if (data.failures.length > 0) {
        showError(`${data.failures.length} users failed to create.`);
      }
      setResult(data);
      setIsResultOpen(true);
      setNames('');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error) => {
      dismissToast('bulk-create');
      showError(`An error occurred: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedNames = names
      .split('\n')
      .map(line => line.trim())
      .filter(line => line)
      .map(line => {
        const parts = line.split(/\s+/);
        const firstName = parts[0] || '';
        const lastName = parts.slice(1).join(' ') || '';
        return { firstName, lastName };
      })
      .filter(user => user.firstName && user.lastName);

    if (parsedNames.length === 0) {
      showError('Please enter at least one full name.');
      return;
    }

    showLoading('Creating users...');
    mutation.mutate(parsedNames);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Bulk User Creation</CardTitle>
          <CardDescription>
            Create multiple users at once. Enter one full name per line (e.g., "John Doe").
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="user-names">User Full Names</Label>
              <Textarea
                id="user-names"
                placeholder="John Doe&#10;Jane Smith&#10;Peter Jones"
                rows={5}
                value={names}
                onChange={(e) => setNames(e.target.value)}
                disabled={mutation.isPending}
              />
            </div>
            <Button type="submit" disabled={mutation.isPending || !names.trim()}>
              {mutation.isPending ? 'Creating...' : 'Create Users'}
            </Button>
          </form>
        </CardContent>
      </Card>
      {result && (
        <BulkUserCreationResultDialog
          result={result}
          isOpen={isResultOpen}
          onOpenChange={setIsResultOpen}
        />
      )}
    </>
  );
};

export default BulkCreateUsers;