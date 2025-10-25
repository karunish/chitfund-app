import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreHorizontal } from 'lucide-react';
import { format } from 'date-fns';
import { showError } from '@/utils/toast';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

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

type FetchUsersResponse = {
  users: MergedUser[];
  total: number;
};

const USERS_PER_PAGE = 30;

const fetchUsers = async (page: number): Promise<FetchUsersResponse> => {
  const { data, error } = await supabase.functions.invoke('admin-get-users', {
    body: { page, perPage: USERS_PER_PAGE },
  });
  if (error) throw new Error(error.message);
  if (data.error) throw new Error(data.error);
  return data;
};

type UserTableProps = {
  searchTerm: string;
  onEditUser: (user: MergedUser) => void;
  onViewLoanHistory: (user: MergedUser) => void;
  onViewTransactions: (user: MergedUser) => void;
  onDeleteUser: (user: MergedUser) => void;
  onSetPassword: (user: MergedUser) => void;
  currentPage: number;
  setCurrentPage: (page: number) => void;
};

const UserTable = ({ searchTerm, onEditUser, onViewLoanHistory, onViewTransactions, onDeleteUser, onSetPassword, currentPage, setCurrentPage }: UserTableProps) => {
  const { data, isLoading, error } = useQuery<FetchUsersResponse, Error>({
    queryKey: ['admin-users', currentPage],
    queryFn: () => fetchUsers(currentPage),
    placeholderData: keepPreviousData,
  });

  const filteredUsers = data?.users.filter(user => {
    const fullName = `${user.first_name || ''} ${user.last_name || ''}`.toLowerCase();
    const refName = (user.reference_name || '').toLowerCase();
    const search = searchTerm.toLowerCase();
    return fullName.includes(search) || refName.includes(search);
  });

  const totalPages = data ? Math.ceil(data.total / USERS_PER_PAGE) : 0;

  if (error) {
    showError(`Failed to load users: ${error.message}`);
    return <div className="text-red-500 p-4 border border-red-500 rounded-md">Error: ${error.message}</div>;
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Reference Name</TableHead>
            <TableHead>Role</TableHead>
            <TableHead className="text-right">Outstanding Amt.</TableHead>
            <TableHead>Joined On</TableHead>
            <TableHead><span className="sr-only">Actions</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && !data ? (
            Array.from({ length: 10 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={7}><Skeleton className="h-5 w-full" /></TableCell>
              </TableRow>
            ))
          ) : filteredUsers && filteredUsers.length > 0 ? (
            filteredUsers.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{`${user.first_name || ''} ${user.last_name || ''}`.trim() || 'N/A'}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>{user.reference_name || 'N/A'}</TableCell>
                <TableCell><Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>{user.role}</Badge></TableCell>
                <TableCell className="text-right">${Number(user.outstanding_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                <TableCell>{format(new Date(user.created_at), 'PPP')}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><span className="sr-only">Open menu</span><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem onSelect={() => onEditUser(user)}>Edit Profile</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => onSetPassword(user)}>Set Password</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => onViewTransactions(user)}>View Transactions</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => onViewLoanHistory(user)}>View Loan History</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => onDeleteUser(user)} className="text-red-600">Delete User</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow><TableCell colSpan={7} className="h-24 text-center">No users found.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
      <div className="flex items-center justify-between p-4 border-t">
        <div className="text-sm text-muted-foreground">
          Page {currentPage} of {totalPages}
        </div>
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e) => { e.preventDefault(); if (currentPage > 1) setCurrentPage(currentPage - 1); }}
                aria-disabled={currentPage === 1}
                className={currentPage === 1 ? 'pointer-events-none opacity-50' : undefined}
              />
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(e) => { e.preventDefault(); if (currentPage < totalPages) setCurrentPage(currentPage + 1); }}
                aria-disabled={currentPage >= totalPages}
                className={currentPage >= totalPages ? 'pointer-events-none opacity-50' : undefined}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
};

export default UserTable;