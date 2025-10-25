import { useState } from "react";
import { useMutation, useQueryClient } from '@tanstack/react-query';
import UserTable from "@/components/admin/UserTable";
import { Button } from "@/components/ui/button";
import CreateUserDialog from "@/components/admin/CreateUserDialog";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import EditUserDialog from "@/components/admin/EditUserDialog";
import LoanHistoryDialog from "@/components/admin/LoanHistoryDialog";
import SetPasswordDialog from "@/components/admin/SetPasswordDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from '@/lib/supabase';
import { showSuccess, showError } from '@/utils/toast';
import { useNavigate } from "react-router-dom";

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

const deleteUser = async (userId: string) => {
  const { error, data } = await supabase.functions.invoke('admin-delete-user', {
    body: { userId },
  });
  if (error) throw new Error(error.message);
  if (data.error) throw new Error(data.error);
};

const UserManagementPage = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [editingUser, setEditingUser] = useState<MergedUser | null>(null);
  const [historyUser, setHistoryUser] = useState<MergedUser | null>(null);
  const [deletingUser, setDeletingUser] = useState<MergedUser | null>(null);
  const [passwordUser, setPasswordUser] = useState<MergedUser | null>(null);

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      showSuccess('User deleted successfully!');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setDeletingUser(null);
    },
    onError: (error: Error) => {
      showError(`Failed to delete user: ${error.message}`);
    },
  });

  const confirmDelete = () => {
    if (deletingUser) {
      deleteMutation.mutate(deletingUser.id);
    }
  };

  const handleViewTransactions = (user: MergedUser) => {
    navigate(`/admin/users/${user.id}/transactions`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">User Management</h2>
          <p className="text-muted-foreground">
            View, create, edit, and delete user profiles.
          </p>
        </div>
        <CreateUserDialog>
          <Button>Create New User</Button>
        </CreateUserDialog>
      </div>
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search by name or reference name..."
          className="pl-8 sm:w-1/3"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      <UserTable 
        searchTerm={searchTerm} 
        onEditUser={setEditingUser}
        onViewLoanHistory={setHistoryUser}
        onViewTransactions={handleViewTransactions}
        onDeleteUser={setDeletingUser}
        onSetPassword={setPasswordUser}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
      />

      {editingUser && (
        <EditUserDialog
          user={editingUser}
          isOpen={!!editingUser}
          onOpenChange={(open) => !open && setEditingUser(null)}
        />
      )}

      {historyUser && (
        <LoanHistoryDialog
          user={historyUser}
          isOpen={!!historyUser}
          onOpenChange={(open) => !open && setHistoryUser(null)}
        />
      )}

      {passwordUser && (
        <SetPasswordDialog
          user={passwordUser}
          isOpen={!!passwordUser}
          onOpenChange={(open) => !open && setPasswordUser(null)}
        />
      )}

      <AlertDialog open={!!deletingUser} onOpenChange={(open) => !open && setDeletingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the user account for <span className="font-semibold">{deletingUser?.email}</span> and remove their data from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UserManagementPage;