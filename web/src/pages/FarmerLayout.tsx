import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../state/auth";
import { Icon } from "../components/Visuals";
import BrandLogo from "../components/BrandLogo";
import MobileFabMenu from "../components/MobileFabMenu";

const navItems = [
  { label: "Overview", path: "/dashboard", subtitle: "Home", icon: "overview" as const },
  { label: "Farm Workspace", path: "/dashboard/farm", subtitle: "Portfolio, create & manage", icon: "farm" as const },
  { label: "Market Hub", path: "/dashboard/market", subtitle: "Listings & services", icon: "market" as const },
  { label: "Services", path: "/dashboard/services", subtitle: "AGRIK subscriptions", icon: "services" as const },
  { label: "Subscriptions", path: "/dashboard/subscriptions", subtitle: "Plans & billing", icon: "subscriptions" as const },
  { label: "Ask GRIK", path: "/dashboard/brain", subtitle: "Chat, photos & voice", icon: "brain" as const },
  { label: "Farmer Brain", path: "/dashboard/brain/insights", subtitle: "Farm signals & insights", icon: "activity" as const },
  { label: "History", path: "/dashboard/history", subtitle: "Timeline & activity", icon: "history" as const },
  { label: "Settings", path: "/dashboard/settings", subtitle: "Location & alerts", icon: "settings" as const },
];

const SIDEBAR_COLLAPSED_KEY = "agrik_farmer_sidebar_collapsed";

export default function FarmerLayout() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true");
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  const current = useMemo(() => {
    const matches = navItems.filter((item) =>
      item.path === "/dashboard" ? location.pathname === "/dashboard" : location.pathname.startsWith(item.path)
    );
    // Prefer the most specific (longest) path match, since some nav paths are prefixes of others (e.g. /dashboard/brain vs /dashboard/brain/insights).
    return matches.sort((a, b) => b.path.length - a.path.length)[0] || navItems[0];
  }, [location.pathname]);

  return (
    <div className={`farmer-shell ${menuOpen ? "menu-open" : ""} ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <div className="farmer-backdrop" onClick={() => setMenuOpen(false)} aria-hidden="true" />
      <aside className="farmer-sidebar">
        <div className="farmer-sidebar-head">
          <div className="farmer-brand">
            <BrandLogo subtitle="Farmer Portal" compact />
          </div>
          <button
            className={`farmer-sidebar-toggle ${sidebarCollapsed ? "is-collapsed" : ""}`}
            type="button"
            onClick={() => setSidebarCollapsed((prev) => !prev)}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Icon name="chevron" size={15} />
          </button>
        </div>
        <nav className="farmer-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/dashboard" || item.path === "/dashboard/brain"}
              className={({ isActive }) => `farmer-link ${isActive ? "active" : ""}`}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <span className="farmer-link-main">
                <span className="nav-icon">
                  <Icon name={item.icon} size={16} />
                </span>
                <span className="farmer-link-label">{item.label}</span>
              </span>
              <span className="farmer-link-sub">{item.subtitle}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <section className="farmer-main">
        <header className="farmer-topbar">
          <div className="dashboard-topbar-main">
            <button className="farmer-menu-toggle" type="button" onClick={() => setMenuOpen((prev) => !prev)}>
              Menu
            </button>
            <div className="dashboard-topbar-copy">
              <div className="label">{current.subtitle}</div>
              <div className="farmer-topbar-heading">{current.label}</div>
            </div>
          </div>
          <div className="farmer-topbar-actions">
            <div className="farmer-quick-links">
              <NavLink to="/dashboard/brain" className="btn ghost tiny">
                Ask GRIK
              </NavLink>
              <NavLink to="/dashboard/market" className="btn ghost tiny">
                Market
              </NavLink>
            </div>
            <div className="farmer-account-pill">
              <div className="farmer-account-name">{user?.full_name || user?.phone || "Farmer"}</div>
              <div className="farmer-account-role">{user?.role?.replace(/_/g, " ") ?? "farmer"}</div>
            </div>
            <button className="btn ghost small" type="button" onClick={logout}>
              Sign out
            </button>
          </div>
        </header>
        <main className="farmer-content">
          <Outlet />
        </main>
        <MobileFabMenu
          title="Actions"
          actions={[
            { label: "Ask GRIK", to: "/dashboard/brain", icon: "brain" },
            { label: "Open market", to: "/dashboard/market", icon: "market" },
            { label: "Farm workspace", to: "/dashboard/farm", icon: "farm" },
            { label: "History", to: "/dashboard/history", icon: "history" },
            { label: "Sign out", icon: "shield", onClick: logout },
          ]}
        />
      </section>
    </div>
  );
}
