import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { showSuccess, showError, showLoading, dismissToast } from "@/utils/toast";
import { useAuthContext } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Separator } from "@/components/ui/separator";
import MyLoanRequests from "@/components/MyLoanRequests";
import { differenceInMonths } from 'date-fns';
import { Info, BookOpen } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ResponsiveSelect } from "@/components/ui/ResponsiveSelect";

type LoanTier = {
  amount: number;
  eligibilityMonths: number;
  fine: number;
  repaymentInfo: string;
};

type UserProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

const fetchLoanTiers = async (): Promise<LoanTier[]> => {
  const { data, error } = await supabase
    .from('loan_tiers')
    .select('amount, eligibility_months, fine, repayment_info')
    .order('amount', { ascending: true });
  if (error) throw new Error(error.message);
  return data.map(tier => ({
    amount: tier.amount,
    eligibilityMonths: tier.eligibility_months,
    fine: tier.fine,
    repaymentInfo: tier.repayment_info,
  }));
};

const fetchAllUsers = async (): Promise<UserProfile[]> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name');
  if (error) throw new Error(error.message);
  return data;
};

const LoanRequestPage = () => {
  const { user, profile } = useAuthContext();
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [guarantorId, setGuarantorId] = useState('');
  const [guarantor2Id, setGuarantor2Id] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data: loanTiers = [], isLoading: isLoadingTiers } = useQuery<LoanTier[]>({
    queryKey: ['loanTiers'],
    queryFn: fetchLoanTiers,
  });

  const { data: allUsers = [], isLoading: isLoadingUsers } = useQuery<UserProfile[]>({
    queryKey: ['allUsers'],
    queryFn: fetchAllUsers,
  });

  const selectedLoanAmount = useMemo(() => {
    if (!amount) return 0;
    return parseFloat(amount);
  }, [amount]);

  const guarantors = useMemo(() => {
    if (!user || !allUsers) return [];
    return allUsers.filter(u => u.id !== user.id);
  }, [allUsers, user]);

  const guarantorOptions = useMemo(() => {
    if (!guarantors) return [];
    return guarantors.map((g) => ({
      value: g.id,
      label: `${g.first_name || ''} ${g.last_name || ''}`.trim(),
    }));
  }, [guarantors]);

  const guarantor2Options = useMemo(() => {
    if (!guarantors || !guarantorId) return guarantorOptions;
    return guarantors.filter(g => g.id !== guarantorId).map((g) => ({
        value: g.id,
        label: `${g.first_name || ''} ${g.last_name || ''}`.trim(),
    }));
  }, [guarantors, guarantorId]);

  const tenureInMonths = useMemo(() => {
    const startDate = profile?.membership_start_date 
      ? new Date(profile.membership_start_date) 
      : (user?.created_at ? new Date(user.created_at) : null);
      
    if (!startDate) return 0;
    
    return differenceInMonths(new Date(), startDate);
  }, [user?.created_at, profile?.membership_start_date]);

  const eligibleLoans = useMemo(() => {
    if (!loanTiers) return [];
    return loanTiers.filter(tier => tenureInMonths >= tier.eligibilityMonths);
  }, [tenureInMonths, loanTiers]);

  const maxEligibleLoan = useMemo(() => {
    if (eligibleLoans.length === 0) return 0;
    return Math.max(...eligibleLoans.map(l => l.amount));
  }, [eligibleLoans]);

  const selectedLoanDetails = useMemo(() => {
    if (!amount || !loanTiers) return null;
    return loanTiers.find(tier => String(tier.amount) === amount);
  }, [amount, loanTiers]);

  const eligibleLoanOptions = useMemo(() => {
    if (!eligibleLoans) return [];
    return eligibleLoans.map((loan) => ({
      value: String(loan.amount),
      label: `$${loan.amount.toLocaleString('en-IN')}`,
    }));
  }, [eligibleLoans]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      showError("You must be logged in to make a request.");
      return;
    }
    if (!amount) {
      showError("Please select a loan amount.");
      return;
    }

    const loanAmount = parseFloat(amount);

    if (loanAmount === 100000) {
      if (!guarantorId || !guarantor2Id) {
        showError("Two guarantors are required for this loan amount.");
        return;
      }
      if (guarantorId === guarantor2Id) {
        showError("Please select two different guarantors.");
        return;
      }
    } else if (loanAmount !== 5000) {
      if (!guarantorId) {
        showError("A guarantor is required for this loan amount.");
        return;
      }
    }

    setSubmitting(true);
    const toastId = showLoading("Submitting request...");

    const selectedGuarantor = allUsers.find(u => u.id === guarantorId);
    const guarantorName = selectedGuarantor ? `${selectedGuarantor.first_name || ''} ${selectedGuarantor.last_name || ''}`.trim() : null;

    const selectedGuarantor2 = allUsers.find(u => u.id === guarantor2Id);
    const guarantor2Name = selectedGuarantor2 ? `${selectedGuarantor2.first_name || ''} ${selectedGuarantor2.last_name || ''}`.trim() : null;

    const { error } = await supabase.from('loan_requests').insert([
      {
        user_id: user.id,
        user_email: user.email,
        amount: loanAmount,
        reason: reason,
        guarantor_id: loanAmount !== 5000 ? guarantorId : null,
        guarantor_name: loanAmount !== 5000 ? guarantorName : null,
        guarantor_2_id: loanAmount === 100000 ? guarantor2Id : null,
        guarantor_2_name: loanAmount === 100000 ? guarantor2Name : null,
      },
    ]);

    dismissToast(toastId);
    if (error) {
      showError("Failed to submit loan request. " + error.message);
    } else {
      showSuccess("Loan request submitted successfully!");
      setAmount('');
      setReason('');
      setGuarantorId('');
      setGuarantor2Id('');
    }
    setSubmitting(false);
  };

  const isSubmitDisabled = () => {
    if (submitting || !amount) return true;
    if (selectedLoanAmount === 100000) return !guarantorId || !guarantor2Id;
    if (selectedLoanAmount !== 5000) return !guarantorId;
    return false;
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-4">Request a Loan</h2>
        
        <Alert className="mb-6">
          <Info className="h-4 w-4" />
          <AlertTitle>Your Loan Eligibility</AlertTitle>
          <AlertDescription>
            Based on your account tenure of {tenureInMonths} months, your maximum eligible loan amount is <span className="font-bold">${maxEligibleLoan.toLocaleString('en-IN')}</span>.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Loan Request Form</CardTitle>
            <CardDescription>Fill out the form below to request a loan.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingTiers ? <Skeleton className="h-48 w-full" /> : eligibleLoans.length > 0 ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Loan Amount ($)</Label>
                  <ResponsiveSelect
                    options={eligibleLoanOptions}
                    value={amount}
                    onChange={setAmount}
                    placeholder="Select an eligible loan amount"
                    disabled={submitting}
                  />
                </div>

                {selectedLoanDetails && (
                  <Card className="bg-muted/50">
                    <CardContent className="pt-4 text-sm space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Fine:</span>
                        <span className="font-medium">${selectedLoanDetails.fine.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between font-bold">
                        <span>Total Repayment:</span>
                        <span>${(selectedLoanDetails.amount + selectedLoanDetails.fine).toLocaleString('en-IN')}</span>
                      </div>
                       <div className="flex justify-between">
                        <span className="text-muted-foreground">Repayment Period:</span>
                        <span className="font-medium">{selectedLoanDetails.repaymentInfo}</span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {selectedLoanAmount > 0 && selectedLoanAmount !== 5000 && (
                  <>
                    <div className="space-y-2">
                      <Label>Guarantor {selectedLoanAmount === 100000 ? '1' : ''}</Label>
                      <ResponsiveSelect
                        options={guarantorOptions}
                        value={guarantorId}
                        onChange={(val) => {
                          setGuarantorId(val);
                          if (val === guarantor2Id) {
                            setGuarantor2Id('');
                          }
                        }}
                        placeholder={isLoadingUsers ? "Loading members..." : "Select a guarantor"}
                        disabled={submitting || isLoadingUsers}
                      />
                    </div>
                    {selectedLoanAmount === 100000 && (
                      <div className="space-y-2">
                        <Label>Guarantor 2</Label>
                        <ResponsiveSelect
                          options={guarantor2Options}
                          value={guarantor2Id}
                          onChange={setGuarantor2Id}
                          placeholder={isLoadingUsers ? "Loading..." : "Select a second guarantor"}
                          disabled={submitting || isLoadingUsers || !guarantorId}
                        />
                      </div>
                    )}
                  </>
                )}

                <div className="space-y-2">
                  <Label htmlFor="reason">Reason for Loan</Label>
                  <Textarea id="reason" placeholder="Please describe why you need this loan..." required value={reason} onChange={(e) => setReason(e.target.value)} disabled={submitting} />
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitDisabled()}>
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </Button>
              </form>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                <p>You are not yet eligible for any loans.</p>
                <p className="text-sm">You will be eligible for your first loan after 6 months of contributions.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      <Separator />

      <MyLoanRequests />

      <div className="text-center mt-6">
        <Button asChild variant="outline">
          <Link to="/loan-rules">
            <BookOpen className="mr-2 h-4 w-4" />
            View Loan Rules
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default LoanRequestPage;