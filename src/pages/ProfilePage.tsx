import { useAuthContext } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import ContributionCalendar from "@/components/ContributionCalendar";

const ProfilePage = () => {
  const { user, profile } = useAuthContext();

  const memberSince = profile?.membership_start_date 
    ? new Date(profile.membership_start_date) 
    : (user?.created_at ? new Date(user.created_at) : null);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">My Profile</h2>
      <Card>
        <CardHeader>
          <CardTitle>{`${profile?.first_name || ''} ${profile?.last_name || ''}`.trim()}</CardTitle>
          <CardDescription>
            {profile?.role === 'admin' 
              ? 'Administrator Account' 
              : `Member Since: ${memberSince ? format(memberSince, 'PPP') : 'N/A'}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Separator />
           <div>
            <h3 className="text-lg font-semibold">Account Information</h3>
            <div className="mt-2 space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium">{user?.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Reference Name</span>
                <span className="font-medium">{profile?.reference_name || 'N/A'}</span>
              </div>
            </div>
          </div>

          {profile?.role === 'user' && (
            <>
              <Separator />
              <div>
                <h3 className="text-lg font-semibold">Contribution History</h3>
                <ContributionCalendar />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfilePage;