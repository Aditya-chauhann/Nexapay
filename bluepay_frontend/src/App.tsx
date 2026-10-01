import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { HealthProvider } from "@/contexts/HealthContext";
import { MaintenanceGate } from "@/components/shared/MaintenanceGate";
import { WithdrawalDisputeProvider } from "@/contexts/WithdrawalDisputeContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { GuestRoute } from "@/components/auth/GuestRoute";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Maintenance from "./pages/Maintenance";
import Login from "./pages/auth/Login";
import AdminLogin from "./pages/auth/AdminLogin";
import ChangePassword from "./pages/auth/ChangePassword";
import Register from "./pages/auth/Register";
// import VerifyEmail from "./pages/auth/VerifyEmail";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";

import UserLayout from "./components/layout/UserLayout";
import UserDashboard from "./pages/user/UserDashboard";
import UserDeposit from "./pages/user/UserDeposit";
import UserWithdraw from "./pages/user/UserWithdraw";
import UserTransactions from "./pages/user/UserTransactions";
import UserReferrals from "./pages/user/UserReferrals";
import UserProfile from "./pages/user/UserProfile";
import DistributionPortal from "./pages/user/DistributionPortal";
import InviteeTimeline from "./pages/user/InviteeTimeline";

import AdminLayout from "./components/layout/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminUserDetail from "./pages/admin/AdminUserDetail";
import AdminDeposits from "./pages/admin/AdminDeposits";
import AdminWithdrawals from "./pages/admin/AdminWithdrawals";
import AdminBankWithdrawals from "./pages/admin/AdminBankWithdrawals";
import AdminReferrals from "./pages/admin/AdminReferrals";
import AdminRoles from "./pages/admin/AdminRoles";
import AdminTags from "./pages/admin/AdminTags";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminWallets from "./pages/admin/AdminWallets";
import AdminSecurity from "./pages/admin/AdminSecurity";
import AdminLogs from "./pages/admin/AdminLogs";
import AdminAlerts from "./pages/admin/AdminAlerts";
import AdminTickets from "./pages/admin/AdminTickets";
import AdminReports from "./pages/admin/AdminReports";
import AdminAnnouncements from "./pages/admin/AdminAnnouncements";
import AdminBlogs from "./pages/admin/AdminBlogs";
import AdminIpActivities from "./pages/admin/AdminIpActivities";
import BlogList from "./pages/BlogList";
import BlogPost from "./pages/BlogPost";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import Terms from "./pages/Terms";
import CookiePolicy from "./pages/CookiePolicy";
import CookieConsentBanner from "./components/shared/CookieConsentBanner";

const CoreControlRedirect = () => {
  const location = useLocation();
  const newPath = location.pathname.replace(/^\/core-control\/dashboard/, "/admin");
  return <Navigate to={`${newPath}${location.search}`} replace />;
};

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
    <QueryClientProvider client={queryClient}>
      <HealthProvider>
      <AuthProvider>
      <WithdrawalDisputeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <CookieConsentBanner />
          <MaintenanceGate>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/blog" element={<BlogList />} />
            <Route path="/blog/:slug" element={<BlogPost />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/cookie-policy" element={<CookiePolicy />} />
            <Route path="/maintenance" element={<Maintenance />} />
            <Route path="/404" element={<NotFound />} />

            <Route
              path="/auth/login"
              element={
                <GuestRoute>
                  <Login />
                </GuestRoute>
              }
            />
            <Route
              path="/auth/register"
              element={
                <GuestRoute>
                  <Register />
                </GuestRoute>
              }
            />
            <Route
              path="/auth/forgot-password"
              element={
                <GuestRoute>
                  <ForgotPassword />
                </GuestRoute>
              }
            />
            <Route
              path="/auth/reset-password"
              element={
                <GuestRoute>
                  <ResetPassword />
                </GuestRoute>
              }
            />
            <Route
              path="/core-control/signin"
              element={
                <GuestRoute audience="admin">
                  <AdminLogin />
                </GuestRoute>
              }
            />
            <Route path="/auth/admin/login" element={<Navigate to="/core-control/signin" replace />} />
            <Route path="/admin/login" element={<Navigate to="/core-control/signin" replace />} />
            <Route path="/auth/staff-login" element={<Navigate to="/core-control/signin" replace />} />
            <Route path="/auth/change-password" element={<ChangePassword />} />
            {/* Email verification flow disabled for now. */}
            {/* <Route path="/auth/verify-email" element={<VerifyEmail />} /> */}
            <Route path="/auth/verify-email" element={<Navigate to="/auth/login" replace />} />

            <Route
              path="/user"
              element={
                <ProtectedRoute audience="user">
                  <UserLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<UserDashboard />} />
              <Route path="deposit" element={<UserDeposit />} />
              <Route path="withdraw" element={<UserWithdraw />} />
              <Route path="transactions" element={<UserTransactions />} />
              <Route path="referrals" element={<UserReferrals />} />
              <Route path="profile" element={<UserProfile />} />
              <Route path="distribution" element={<DistributionPortal />} />
              <Route path="distribution/:inviteeId" element={<InviteeTimeline />} />
            </Route>

            <Route
              path="/admin"
              element={
                <ProtectedRoute audience="admin">
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<AdminDashboard />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="users/:userId" element={<AdminUserDetail />} />
              <Route path="deposits" element={<AdminDeposits />} />
              <Route path="withdrawals" element={<AdminWithdrawals />} />
              <Route path="bank-activity" element={<AdminBankWithdrawals />} />
              <Route path="bank-withdrawals" element={<AdminBankWithdrawals />} />
              <Route path="distribution" element={<DistributionPortal />} />
              <Route path="distribution/:inviteeId" element={<InviteeTimeline />} />
              <Route path="referrals" element={<AdminReferrals />} />
              <Route path="wallets" element={<AdminWallets />} />
              <Route path="security" element={<AdminSecurity />} />
              <Route path="logs" element={<AdminLogs />} />
              <Route path="alerts" element={<AdminAlerts />} />
              <Route path="announcements" element={<AdminAnnouncements />} />
              <Route path="ip-activities" element={<AdminIpActivities />} />
              <Route path="blogs" element={<AdminBlogs />} />
              <Route path="roles" element={<AdminRoles />} />
              <Route path="tags" element={<AdminTags />} />
              <Route path="tickets" element={<AdminTickets />} />
              <Route path="reports" element={<AdminReports />} />
              <Route path="settings" element={<AdminSettings />} />
            </Route>

            {/* Core control route fallback & redirection to /admin */}
            <Route path="/core-control/dashboard" element={<Navigate to="/admin" replace />} />
            <Route path="/core-control/dashboard/*" element={<CoreControlRedirect />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
          </MaintenanceGate>
        </BrowserRouter>
      </TooltipProvider>
      </WithdrawalDisputeProvider>
      </AuthProvider>
      </HealthProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
