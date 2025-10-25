import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { useAuthContext } from '@/contexts/AuthContext';
import { useEffect } from 'react';
import BottomNavBar from './BottomNavBar';
import { ThemeToggle } from './ThemeToggle';
import { Bell } from 'lucide-react';
import { useUnreadNotifications } from '@/hooks/useUnreadNotifications';

const MainLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, loading, profile } = useAuthContext();
  const { count: unreadCount } = useUnreadNotifications();

  useEffect(() => {
    if (!loading) {
      if (!session) {
        navigate('/login');
      } else {
        const isAdmin = profile?.role === 'admin';
        const pathname = location.pathname;

        // Redirect non-admins away from admin pages
        if (pathname.startsWith('/admin') && !isAdmin) {
          navigate('/dashboard');
        }
        
        // Redirect admins away from user-only pages
        if (isAdmin && (pathname === '/contribute' || pathname === '/loan-request' || pathname === '/loan-rules')) {
          navigate('/dashboard');
        }
      }
    }
  }, [session, loading, navigate, profile, location.pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-muted/40">
      <header className="flex h-14 items-center gap-4 border-b bg-background px-4 lg:h-[60px] lg:px-6 sticky top-0 z-40">
        <div className="w-full flex-1 flex items-center gap-2">
          
          <span className="text-lg font-semibold">Veritas Ledger</span>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="icon" className="relative">
            <Link to="/notifications">
              <Bell className="h-5 w-5" />
              {unreadCount && unreadCount > 0 && (
                <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
              <span className="sr-only">Notifications</span>
            </Link>
          </Button>
          <ThemeToggle />
          <Button onClick={handleLogout} variant="outline">Logout</Button>
        </div>
      </header>
      <main className="flex-1 p-4 sm:p-6 pb-28">
        <Outlet />
      </main>
      <BottomNavBar />
    </div>
  );
};

export default MainLayout;