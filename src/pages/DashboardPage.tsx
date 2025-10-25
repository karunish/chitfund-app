import { useAuthContext } from '@/contexts/AuthContext';
import ChitFundSummary from '@/components/ChitFundSummary';
import PendingProofsCard from '@/components/admin/PendingProofsCard';
import PendingLoanRequestsCard from '@/components/admin/PendingLoanRequestsCard';
import UserSummary from '@/components/UserSummary';

const DashboardPage = () => {
  const { profile } = useAuthContext();
  const isAdmin = profile?.role === 'admin';

  return (
    <>
      <div className="mb-6">
          <h2 className="text-2xl font-bold">Welcome, {profile?.first_name || 'Member'}!</h2>
          <p className="text-muted-foreground mt-1">
            {isAdmin 
              ? "Here's a summary of the main account and pending tasks."
              : "Here's a summary of your account."
            }
          </p>
      </div>
      
      {isAdmin ? (
        <div className="grid gap-6">
          <ChitFundSummary />
          <PendingProofsCard />
          <PendingLoanRequestsCard />
        </div>
      ) : (
        <UserSummary />
      )}
    </>
  );
};

export default DashboardPage;