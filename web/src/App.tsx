import { lazy, Suspense, useMemo } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./state/auth";
import { useAdminAuth } from "./state/adminAuth";
import Landing from "./pages/Landing";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import AppLayout from "./pages/Layout";
import PwaInstallPrompt from "./components/PwaInstallPrompt";

const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminLayout = lazy(() => import("./pages/AdminLayout"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const AdminListings = lazy(() => import("./pages/AdminListings"));
const AdminPrices = lazy(() => import("./pages/AdminPrices"));
const AdminAlerts = lazy(() => import("./pages/AdminAlerts"));
const AdminServices = lazy(() => import("./pages/AdminServices"));
const AdminActivity = lazy(() => import("./pages/AdminActivity"));
const FarmerLayout = lazy(() => import("./pages/FarmerLayout"));
const FarmerOverview = lazy(() => import("./pages/FarmerOverview"));
const FarmerFarm = lazy(() => import("./pages/FarmerFarm"));
const FarmerFarmHome = lazy(() => import("./pages/FarmerFarmHome"));
const FarmerFarmCreate = lazy(() => import("./pages/FarmerFarmCreate"));
const FarmerFarmManage = lazy(() => import("./pages/FarmerFarmManage"));
const FarmerFarmSettings = lazy(() => import("./pages/FarmerFarmSettings"));
const FarmerMarketHub = lazy(() => import("./pages/FarmerMarketHub"));
const FarmerMarketOverview = lazy(() => import("./pages/FarmerMarketOverview"));
const FarmerMarketSell = lazy(() => import("./pages/FarmerMarketSell"));
const FarmerMarketListings = lazy(() => import("./pages/FarmerMarketListings"));
const FarmerMarketDiscover = lazy(() => import("./pages/FarmerMarketDiscover"));
const FarmerMarketProviders = lazy(() => import("./pages/FarmerMarketProviders"));
const FarmerServices = lazy(() => import("./pages/FarmerServices"));
const FarmerSubscriptions = lazy(() => import("./pages/FarmerSubscriptions"));
const FarmerBrain = lazy(() => import("./pages/FarmerBrain"));
const FarmerHistory = lazy(() => import("./pages/FarmerHistory"));
const BuyerLayout = lazy(() => import("./pages/BuyerLayout"));
const BuyerDashboard = lazy(() => import("./pages/BuyerDashboard"));
const BuyerMarketplace = lazy(() => import("./pages/BuyerMarketplace"));
const ProviderLayout = lazy(() => import("./pages/ProviderLayout"));
const ProviderDashboard = lazy(() => import("./pages/ProviderDashboard"));
const ProviderMarketplace = lazy(() => import("./pages/ProviderMarketplace"));
const ProviderLeads = lazy(() => import("./pages/ProviderLeads"));
const ProviderMarketing = lazy(() => import("./pages/ProviderMarketing"));
const PublicMarketplace = lazy(() => import("./pages/PublicMarketplace"));
const PublicListingDetails = lazy(() => import("./pages/PublicListingDetails"));

function RouteFallback() {
  return (
    <div className="app-shell">
      <main className="page">Loading...</main>
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();
  const { admin, loading: adminLoading } = useAdminAuth();
  const isAuthed = !!user;
  const isAdminAuthed = !!admin;
  const isAdminRoute = typeof window !== "undefined" && window.location.pathname.startsWith("/admin");
  const isProviderRole = user?.role === "service_provider" || user?.role === "input_supplier";
  const isBuyerRole = user?.role === "buyer" || user?.role === "offtaker";

  const defaultPath = useMemo(() => {
    if (!isAuthed) return "/";
    if (isProviderRole) return "/provider";
    if (isBuyerRole) return "/buyer";
    return "/dashboard";
  }, [isAuthed, isBuyerRole, isProviderRole]);

  if (loading || (isAdminRoute && adminLoading)) {
    return (
      <div className="app-shell">
        <main className="page">Loading session...</main>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <PwaInstallPrompt />
      <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/admin/login" element={isAdminAuthed ? <Navigate to="/admin" /> : <AdminLogin />} />
        <Route path="/admin" element={isAdminAuthed ? <AdminLayout /> : <Navigate to="/admin/login" />}>
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="listings" element={<AdminListings />} />
          <Route path="prices" element={<AdminPrices />} />
          <Route path="alerts" element={<AdminAlerts />} />
          <Route path="services" element={<AdminServices />} />
          <Route path="activity" element={<AdminActivity />} />
        </Route>
        <Route
          path="/dashboard"
          element={isAuthed ? (isBuyerRole || isProviderRole ? <Navigate to={defaultPath} /> : <FarmerLayout />) : <Navigate to="/auth" />}
        >
          <Route index element={<FarmerOverview />} />
          <Route path="farm" element={<FarmerFarm />}>
            <Route index element={<FarmerFarmHome />} />
            <Route path="create" element={<FarmerFarmCreate />} />
            <Route path="manage" element={<FarmerFarmManage />} />
            <Route path="settings" element={<FarmerFarmSettings />} />
          </Route>
          <Route path="market" element={<FarmerMarketHub />}>
            <Route index element={<FarmerMarketOverview />} />
            <Route path="sell" element={<FarmerMarketSell />} />
            <Route path="listings" element={<FarmerMarketListings />} />
            <Route path="discover" element={<FarmerMarketDiscover />} />
            <Route path="providers" element={<FarmerMarketProviders />} />
          </Route>
          <Route path="services" element={<FarmerServices />} />
          <Route path="subscriptions" element={<FarmerSubscriptions />} />
          <Route path="brain" element={<FarmerBrain />} />
          <Route path="history" element={<FarmerHistory />} />
        </Route>
        <Route path="/buyer" element={isAuthed && isBuyerRole ? <BuyerLayout /> : <Navigate to={defaultPath} />}>
          <Route index element={<BuyerDashboard />} />
          <Route path="market" element={<BuyerMarketplace />} />
        </Route>
        <Route path="/provider" element={isAuthed && isProviderRole ? <ProviderLayout /> : <Navigate to={defaultPath} />}>
          <Route index element={<ProviderDashboard />} />
          <Route path="services" element={<ProviderMarketplace />} />
          <Route path="leads" element={<ProviderLeads />} />
          <Route path="marketing" element={<ProviderMarketing />} />
          <Route path="market" element={<Navigate to="/provider/services" replace />} />
        </Route>
        <Route element={<AppLayout />}>
          <Route path="/" element={isAuthed ? <Navigate to={defaultPath} /> : <Landing />} />
          <Route path="/marketplace" element={<PublicMarketplace />} />
          <Route path="/marketplace/listings/:listingId" element={<PublicListingDetails />} />
          <Route path="/auth" element={isAuthed ? <Navigate to={defaultPath} /> : <LoginPage />} />
          <Route path="/auth/register" element={isAuthed ? <Navigate to={defaultPath} /> : <RegisterPage />} />
        </Route>
        <Route path="*" element={<Navigate to={defaultPath} />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
