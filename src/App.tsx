import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import LoginPage from "./pages/LoginPage";
import SignUpPage from "./pages/SignUpPage";
import DashboardPage from "./pages/DashboardPage";
import MainLayout from "./components/MainLayout";
import TransactionsPage from "./pages/TransactionsPage";
import LoanRequestPage from "./pages/LoanRequestPage";
import ProfilePage from "./pages/ProfilePage";
import { ThemeProvider } from "./components/ThemeProvider";
import SplashScreen from "./pages/SplashScreen";
import { AuthProvider } from "./contexts/AuthContext";
import AdminPage from "./pages/AdminPage";
import UserManagementPage from "./pages/admin/UserManagementPage";
import LoanRulesPage from "./pages/LoanRulesPage";
import ContributePage from "./pages/ContributePage";
import UserTransactionsPage from "./pages/admin/UserTransactionsPage";
import LoanManagementPage from "./pages/admin/LoanManagementPage";
import NotificationsPage from "./pages/NotificationsPage";

const queryClient = new QueryClient();

const App = () => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000); // Show splash screen for 2 seconds

    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
      <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
        <SplashScreen />
      </ThemeProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
          <AuthProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignUpPage />} />
                <Route path="/" element={<Index />} />
                
                {/* Protected Routes with MainLayout */}
                <Route element={<MainLayout />}>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/transactions" element={<TransactionsPage />} />
                  <Route path="/contribute" element={<ContributePage />} />
                  <Route path="/loan-request" element={<LoanRequestPage />} />
                  <Route path="/loan-rules" element={<LoanRulesPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/notifications" element={<NotificationsPage />} />
                  <Route path="/admin" element={<AdminPage />} />
                  <Route path="/admin/users" element={<UserManagementPage />} />
                  <Route path="/admin/users/:userId/transactions" element={<UserTransactionsPage />} />
                  <Route path="/admin/loans" element={<LoanManagementPage />} />
                </Route>

                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </AuthProvider>
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;