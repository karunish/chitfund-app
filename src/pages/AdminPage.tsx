import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { Separator } from '@/components/ui/separator';
import { Download, Share2, Users, PlusCircle, Coins, FilePlus, Handshake, PlayCircle } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { useNavigate } from 'react-router-dom';
import CreateTransactionDialog from '@/components/admin/CreateTransactionDialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import BulkCreateUsers from '@/components/admin/BulkCreateUsers';
import BulkAddContributionsDialog from '@/components/admin/BulkAddContributionsDialog';
import CreateLoanDialog from '@/components/admin/CreateLoanDialog';
import MonthlyContributionListDialog from '@/components/admin/MonthlyContributionListDialog';
import MonthlyRepaymentListDialog from '@/components/admin/MonthlyRepaymentListDialog';

const fetchMainBalance = async () => {
  const { data, error } = await supabase
    .from('main_account')
    .select('balance')
    .single();
  if (error) throw new Error('Failed to fetch main balance');
  return data.balance;
};

const AdminPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [newBalance, setNewBalance] = useState<string>('');
  const [isExportingTransactions, setIsExportingTransactions] = useState(false);
  const [isExportingUsers, setIsExportingUsers] = useState(false);

  const { data: mainBalance } = useQuery({
    queryKey: ['main-balance'],
    queryFn: fetchMainBalance,
  });

  useEffect(() => {
    if (mainBalance !== undefined) {
      setNewBalance(mainBalance.toString());
    }
  }, [mainBalance]);

  const runJobMutation = useMutation({
    mutationFn: async (functionName: 'monthly-dues' | 'notification-cron' | 'apply-late-fees') => {
      const toastId = showLoading(`Executing ${functionName}...`);
      const { error, data } = await supabase.functions.invoke(functionName);
      dismissToast(toastId);
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return { data, functionName };
    },
    onSuccess: ({ data, functionName }) => {
      showSuccess(`Job '${functionName}' executed successfully.`);
    },
    onError: (error: Error, functionName) => {
      showError(`Job '${functionName}' execution failed: ${error.message}`);
    },
  });

  const handleUpdateBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    const toastId = showLoading('Updating balance...');
    const numericBalance = parseFloat(newBalance);
    if (isNaN(numericBalance)) {
      dismissToast(toastId);
      showError('Please enter a valid number for the balance.');
      return;
    }
    const { error } = await supabase
      .from('main_account')
      .update({ balance: numericBalance })
      .eq('id', 1);
    dismissToast(toastId);
    if (error) {
      showError('Failed to update balance.');
    } else {
      showSuccess('Main account balance updated successfully.');
      queryClient.setQueryData(['main-balance'], numericBalance);
    }
  };

  const handleExport = async (functionName: 'export-transactions' | 'export-users') => {
    const isTransactions = functionName === 'export-transactions';
    if (isTransactions) setIsExportingTransactions(true);
    else setIsExportingUsers(true);
    const toastId = showLoading(`Exporting ${functionName.split('-')[1]}...`);
    try {
      const { data, error } = await supabase.functions.invoke(functionName);
      if (error) throw error;
      if (typeof data === 'string') {
        const fileName = `${functionName.split('-')[1]}_export_${new Date().toISOString().split('T')[0]}.csv`;
        if (Capacitor.isNativePlatform()) {
          const result = await Filesystem.writeFile({ path: fileName, data, directory: Directory.Cache, encoding: Encoding.UTF8 });
          await Share.share({ title: `Exported ${functionName.split('-')[1]}`, text: `Here is the data export for ${functionName.split('-')[1]}.`, url: result.uri, dialogTitle: 'Share Exported File' });
        } else {
          const blob = new Blob([data], { type: 'text/csv' });
          const downloadUrl = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.setAttribute('download', fileName);
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.URL.revokeObjectURL(downloadUrl);
          showSuccess('Export download started!');
        }
        dismissToast(toastId);
      } else {
        throw new Error(`Unexpected response type: ${typeof data}`);
      }
    } catch (error: any) {
      dismissToast(toastId);
      if (error.message !== "Share canceled") showError(`Export failed: ${error.message}`);
    } finally {
      if (isTransactions) setIsExportingTransactions(false);
      else setIsExportingUsers(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Admin Panel</h2>
      
      <Card>
        <CardHeader>
          <CardTitle>Manage Main Account</CardTitle>
          <CardDescription>Current Balance: ${(mainBalance ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdateBalance} className="flex items-end gap-4">
            <div className="flex-grow space-y-2">
              <Label htmlFor="balance">Update Balance</Label>
              <Input id="balance" type="number" value={newBalance} onChange={(e) => setNewBalance(e.target.value)} placeholder="Enter new balance" />
            </div>
            <Button type="submit">Update</Button>
          </form>
        </CardContent>
      </Card>

      <Separator />

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>User Management</CardTitle>
            <CardDescription>Create, view, and manage all user profiles.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/admin/users')} className="w-full">
              <Users className="mr-2 h-4 w-4" />
              Manage All Users
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Loan Management</CardTitle>
            <CardDescription>View and manage all historical loan records.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/admin/loans')} className="w-full">
              <Handshake className="mr-2 h-4 w-4" />
              Manage All Loans
            </Button>
          </CardContent>
        </Card>
      </div>

      <Separator />

      <BulkCreateUsers />
      <Separator />
      <Card>
        <CardHeader>
          <CardTitle>Historical Data Entry</CardTitle>
          <CardDescription>Manually enter historical contributions or loans from your records.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <BulkAddContributionsDialog><Button variant="secondary"><Coins className="mr-2 h-4 w-4" />Add Bulk Contributions</Button></BulkAddContributionsDialog>
          <CreateLoanDialog><Button variant="secondary"><FilePlus className="mr-2 h-4 w-4" />Create Historical Loan</Button></CreateLoanDialog>
        </CardContent>
      </Card>
      <Separator />
      <Card>
        <CardHeader>
          <CardTitle>Manual Transaction Log</CardTitle>
          <CardDescription>Manually record a deposit or loan disbursement for any user.</CardDescription>
        </CardHeader>
        <CardContent>
          <CreateTransactionDialog><Button><PlusCircle className="mr-2 h-4 w-4" />Create Log Entry</Button></CreateTransactionDialog>
        </CardContent>
      </Card>
      <Separator />
      <Card>
        <CardHeader>
          <CardTitle>Reporting</CardTitle>
          <CardDescription>Generate reports and download or share full data as CSV files.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Button className="w-full" onClick={() => handleExport('export-transactions')} disabled={isExportingTransactions}>
            {Capacitor.isNativePlatform() ? <Share2 className="mr-2 h-4 w-4" /> : <Download className="mr-2 h-4" />}
            {isExportingTransactions ? 'Exporting...' : 'Export Transactions'}
          </Button>
          <Button className="w-full" onClick={() => handleExport('export-users')} disabled={isExportingUsers}>
            {Capacitor.isNativePlatform() ? <Share2 className="mr-2 h-4 w-4" /> : <Download className="mr-2 h-4 w-4" />}
            {isExportingUsers ? 'Exporting...' : 'Export User Profiles'}
          </Button>
          <MonthlyContributionListDialog />
          <MonthlyRepaymentListDialog />
        </CardContent>
      </Card>
      <Separator />
      <Card>
        <CardHeader>
          <CardTitle>Cron Job Testing</CardTitle>
          <CardDescription>Manually run scheduled jobs to test them. These are temporary.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Button onClick={() => runJobMutation.mutate('monthly-dues')} disabled={runJobMutation.isPending && runJobMutation.variables === 'monthly-dues'}><PlayCircle className="mr-2 h-4 w-4" />{runJobMutation.isPending && runJobMutation.variables === 'monthly-dues' ? 'Running...' : 'Run Monthly Dues'}</Button>
          <Button onClick={() => runJobMutation.mutate('notification-cron')} disabled={runJobMutation.isPending && runJobMutation.variables === 'notification-cron'}><PlayCircle className="mr-2 h-4 w-4" />{runJobMutation.isPending && runJobMutation.variables === 'notification-cron' ? 'Running...' : 'Run Notifications'}</Button>
          <Button onClick={() => runJobMutation.mutate('apply-late-fees')} disabled={runJobMutation.isPending && runJobMutation.variables === 'apply-late-fees'}><PlayCircle className="mr-2 h-4 w-4" />{runJobMutation.isPending && runJobMutation.variables === 'apply-late-fees' ? 'Running...' : 'Run Late Fees'}</Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminPage;