import { Link, useLocation } from "react-router-dom";
import { Home, List, Handshake, User, ShieldCheck, UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthContext } from "@/contexts/AuthContext";
import { useMemo } from "react";

const adminNavItem = { href: "/admin", icon: ShieldCheck, label: "Admin" };

const BottomNavBar = () => {
  const location = useLocation();
  const { profile } = useAuthContext();

  const navItems = useMemo(() => {
    if (profile?.role === 'admin') {
      // Admins see Home, Log, Profile, and Admin panel
      return [
        { href: "/dashboard", icon: Home, label: "Home" },
        { href: "/transactions", icon: List, label: "Log" },
        { href: "/profile", icon: User, label: "Profile" },
        adminNavItem,
      ];
    }
    // Regular users see the standard set of items
    return [
      { href: "/dashboard", icon: Home, label: "Home" },
      { href: "/transactions", icon: List, label: "Log" },
      { href: "/contribute", icon: UploadCloud, label: "Contribute" },
      { href: "/loan-request", icon: Handshake, label: "Loan" },
      { href: "/profile", icon: User, label: "Profile" },
    ];
  }, [profile]);
  
  const gridColsClass = navItems.length === 4 ? 'grid-cols-4' : 'grid-cols-5';

  return (
    <div className="fixed bottom-0 left-0 z-50 w-full h-16 bg-background border-t border-border">
      <div className={cn("grid h-full max-w-lg mx-auto font-medium", gridColsClass)}>
        {navItems.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className={cn(
              "inline-flex flex-col items-center justify-center px-5 hover:bg-muted transition-colors",
              location.pathname === item.href ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            )}
          >
            <item.icon className="w-5 h-5 mb-1" />
            <span className="text-xs">{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default BottomNavBar;