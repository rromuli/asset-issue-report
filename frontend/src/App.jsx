import { useEffect, useRef, useState } from "react";
import MyAssets from "./MyAssets";
import MyReports from "./MyReports";
import AssetIssueReportForm from "./AssetIssueReportForm";
import AdminDashboard from "./AdminDashboard";
import AllReports from "./AllReports";
import AllAssets from "./AllAssets";
import OperationsHistory from "./OperationsHistory";
import AssetInventory from "./AssetInventory";
import OnboardingChecklist from "./OnboardingChecklist";
import EmployeeLogin from "./EmployeeLogin";
import gjirafaLogo from "./assets/gjirafa-logo.svg";
import { supabase } from "./supabaseClient";
import { apiUrl, IS_BACKEND_CONFIGURED } from "./apiBaseUrl";

const FALLBACK_ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || "rron.s@gjirafa.com")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);
const AUTH_MODE = (import.meta.env.VITE_AUTH_MODE || "auto").toLowerCase();
const USE_BACKEND_AUTH =
  AUTH_MODE === "backend" || (AUTH_MODE === "auto" && IS_BACKEND_CONFIGURED);
function isAllowedEmail(email = "") {
  return email.toLowerCase().endsWith("@gjirafa.com");
}

function normalizeBackendSession(payload) {
  if (!payload?.user?.email) return null;
  const user = payload.user;
  return {
    user: {
      id: user.id || null,
      email: user.email,
      user_metadata: {
        full_name:
          [user.given_name, user.family_name].filter(Boolean).join(" ").trim() ||
          user.name ||
          user.email,
      },
    },
  };
}

export default function App() {
  const [activeTab, setActiveTab] = useState("assets");
  const [session, setSession] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminRole, setAdminRole] = useState(null);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [authNotice, setAuthNotice] = useState("");
  const adminMenuRef = useRef(null);

  useEffect(() => {
    if (window.location.pathname === "/cb" && USE_BACKEND_AUTH) {
      if (!IS_BACKEND_CONFIGURED) {
        setAuthNotice(
          "Authentication callback failed: backend URL is not configured. Set VITE_API_BASE_URL for this deployment."
        );
      } else {
        window.location.replace(apiUrl(`/cb${window.location.search || ""}`));
      }
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const requestedView = params.get("view");

    if (requestedView === "admin") {
      setActiveTab("admin");
    } else if (requestedView === "history") {
      setActiveTab("history");
    } else if (requestedView === "all_assets") {
      setActiveTab("all_assets");
    } else if (requestedView === "all_reports") {
      setActiveTab("all_reports");
    } else if (requestedView === "inventory") {
      setActiveTab("inventory");
    } else if (requestedView === "issues") {
      setActiveTab("issues");
    } else if (requestedView === "my_reports") {
      setActiveTab("my_reports");
    } else if (requestedView === "onboarding") {
      setActiveTab("onboarding");
    } else {
      setActiveTab("assets");
    }

    if (USE_BACKEND_AUTH) {
      void refreshBackendSession();
      return;
    }

    let mounted = true;
    setCheckingSession(true);

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data?.session || null);
      setCheckingSession(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession || null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    function handleOutsideClick(event) {
      if (!adminMenuRef.current) return;
      if (!adminMenuRef.current.contains(event.target)) {
        setAdminMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    if (!session?.user?.email) return;
    if (isAllowedEmail(session.user.email)) return;

    setAuthNotice("Access denied. Only @gjirafa.com accounts are allowed.");
    handleLogout();
  }, [session]);

  useEffect(() => {
    async function checkAdminAccess() {
      setCheckingAdmin(true);

      if (!session?.user?.email) {
        setIsAdmin(false);
        setAdminRole(null);
        setCheckingAdmin(false);
        return;
      }

      const currentEmail = session.user.email.toLowerCase();

      const { data, error } = await supabase
        .from("admin_users")
        .select("email, role")
        .eq("email", currentEmail)
        .maybeSingle();

      if (error) {
        console.error(error);
        const isFallbackAdmin = FALLBACK_ADMIN_EMAILS.includes(currentEmail);
        setIsAdmin(isFallbackAdmin);
        setAdminRole(isFallbackAdmin ? "it" : null);
        setCheckingAdmin(false);
        return;
      }

      if (data) {
        setIsAdmin(true);
        setAdminRole(data.role || "it");
      } else {
        const isFallbackAdmin = FALLBACK_ADMIN_EMAILS.includes(currentEmail);
        setIsAdmin(isFallbackAdmin);
        setAdminRole(isFallbackAdmin ? "it" : null);
      }
      setCheckingAdmin(false);
    }

    void checkAdminAccess();
  }, [session]);

  async function refreshBackendSession() {
    if (!USE_BACKEND_AUTH) {
      setCheckingSession(false);
      return;
    }

    setCheckingSession(true);
    try {
      const response = await fetch(apiUrl("/api/me"), {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        setSession(null);
        setCheckingSession(false);
        return;
      }

      const payload = await response.json();
      const nextSession = normalizeBackendSession(payload);
      setSession(nextSession);
      if (nextSession?.user?.email) {
        setAuthNotice("");
      }
    } catch {
      setSession(null);
    } finally {
      setCheckingSession(false);
    }
  }

  function startBackendLogin(returnTo = "/") {
    if (!USE_BACKEND_AUTH) {
      return;
    }

    if (!IS_BACKEND_CONFIGURED) {
      setAuthNotice(
        "Authentication is not configured for backend mode in this deployment. Set VITE_API_BASE_URL to your backend URL."
      );
      return;
    }

    const target = encodeURIComponent(returnTo);
    window.location.href = apiUrl(`/api/auth/login?returnTo=${target}`);
  }

  function openAssetsTab() {
    setActiveTab("assets");
    setAdminMenuOpen(false);
    window.history.replaceState({}, "", "/");
  }

  function openIssuesTab() {
    setActiveTab("issues");
    setAdminMenuOpen(false);
    window.history.replaceState({}, "", "/?view=issues");
  }

  function openMyReportsTab() {
    setActiveTab("my_reports");
    setAdminMenuOpen(false);
    window.history.replaceState({}, "", "/?view=my_reports");
  }

  function openAdminTab() {
    if (!session) {
      startBackendLogin("/?view=admin");
      return;
    }

    if (!isAdmin) {
      setActiveTab("assets");
      setAuthNotice("You are signed in, but your account does not have admin access.");
      return;
    }

    setActiveTab("admin");
    setAdminMenuOpen(false);
    window.history.replaceState({}, "", "/?view=admin");
  }

  function openAllReportsTab() {
    if (!session) {
      startBackendLogin("/?view=all_reports");
      return;
    }

    if (!isAdmin) {
      setActiveTab("assets");
      setAuthNotice("You are signed in, but your account does not have admin access.");
      return;
    }

    setActiveTab("all_reports");
    setAdminMenuOpen(false);
    window.history.replaceState({}, "", "/?view=all_reports");
  }

  function openAllAssetsTab() {
    if (!session) {
      startBackendLogin("/?view=all_assets");
      return;
    }

    if (!isAdmin) {
      setActiveTab("assets");
      setAuthNotice("You are signed in, but your account does not have admin access.");
      return;
    }

    setActiveTab("all_assets");
    setAdminMenuOpen(false);
    window.history.replaceState({}, "", "/?view=all_assets");
  }

  function openHistoryTab() {
    if (!session) {
      startBackendLogin("/?view=history");
      return;
    }

    if (!isAdmin) {
      setActiveTab("assets");
      setAuthNotice("You are signed in, but your account does not have admin access.");
      return;
    }

    setActiveTab("history");
    setAdminMenuOpen(false);
    window.history.replaceState({}, "", "/?view=history");
  }

  function openInventoryTab() {
    if (!session) {
      startBackendLogin("/?view=inventory");
      return;
    }

    if (!isAdmin) {
      setActiveTab("assets");
      setAuthNotice("You are signed in, but your account does not have admin access.");
      return;
    }

    setActiveTab("inventory");
    setAdminMenuOpen(false);
    window.history.replaceState({}, "", "/?view=inventory");
  }

  function openOnboardingTab() {
    setActiveTab("onboarding");
    setAdminMenuOpen(false);
    window.history.replaceState({}, "", "/?view=onboarding");
  }

  function handleLogout() {
    if (!USE_BACKEND_AUTH) {
      supabase.auth.signOut();
      setSession(null);
      setActiveTab("assets");
      setIsAdmin(false);
      setAdminRole(null);
      setSelectedAsset(null);
      setAdminMenuOpen(false);
      window.history.replaceState({}, "", "/");
      return;
    }

    setActiveTab("assets");
    setIsAdmin(false);
    setAdminRole(null);
    setSelectedAsset(null);
    setAdminMenuOpen(false);
    window.history.replaceState({}, "", "/");
    window.location.href = apiUrl("/logout");
  }

  function handleReportIssueFromAsset(asset) {
    setSelectedAsset(asset);
    setActiveTab("issues");
    setAdminMenuOpen(false);
    window.history.replaceState({}, "", "/?view=issues");
  }

  function renderMainContent() {
    if (checkingSession) {
      return (
        <div className="px-4 py-10 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl rounded-[32px] border border-zinc-200/80 bg-white px-6 py-6 text-zinc-700 shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
            Checking session...
          </div>
        </div>
      );
    }

    if (!session) {
      return (
        <EmployeeLogin
          externalNotice={authNotice}
          useBackendAuth={USE_BACKEND_AUTH}
        />
      );
    }

    if (activeTab === "assets") {
      return <MyAssets session={session} onReportIssue={handleReportIssueFromAsset} />;
    }

    if (activeTab === "issues") {
      return <AssetIssueReportForm selectedAsset={selectedAsset} session={session} />;
    }

    if (activeTab === "my_reports") {
      return <MyReports session={session} />;
    }

    if (activeTab === "all_reports") {
      if (checkingAdmin) return <StatusCard text="Checking admin access..." />;
      if (!isAdmin) return <AccessDeniedCard text="access all reports." />;
      return <AllReports />;
    }

    if (activeTab === "all_assets") {
      if (checkingAdmin) return <StatusCard text="Checking admin access..." />;
      if (!isAdmin) return <AccessDeniedCard text="access all employee assets." />;
      return <AllAssets />;
    }

    if (activeTab === "history") {
      if (checkingAdmin) return <StatusCard text="Checking admin access..." />;
      if (!isAdmin) return <AccessDeniedCard text="access history." />;
      return <OperationsHistory />;
    }

    if (activeTab === "inventory") {
      if (checkingAdmin) return <StatusCard text="Checking admin access..." />;
      if (!isAdmin) return <AccessDeniedCard text="access inventory." />;
      return <AssetInventory adminRole={adminRole} />;
    }

    if (activeTab === "onboarding") {
      return (
        <OnboardingChecklist
          session={session}
          isAdmin={isAdmin}
          adminRole={adminRole}
        />
      );
    }

    if (activeTab === "admin") {
      if (checkingAdmin) return <StatusCard text="Checking admin access..." />;
      if (!isAdmin) return <AccessDeniedCard text="access the administrative dashboard." />;
      return <AdminDashboard session={session} adminRole={adminRole} progressOnly />;
    }

    return <MyAssets session={session} onReportIssue={handleReportIssueFromAsset} />;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.11),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.08),_transparent_25%),linear-gradient(to_bottom,#f9fafb,#f4f6fb)] text-zinc-900">
      {session ? (
        <header className="sticky top-0 z-40 border-b border-white/60 bg-white/75 shadow-[0_8px_30px_rgba(0,0,0,0.04)] backdrop-blur-2xl">
          <div className="mx-auto max-w-7xl px-4 py-2.5 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
              <button
                type="button"
                onClick={openAssetsTab}
                className="flex items-center gap-3 text-left sm:gap-4"
              >
                <img
                  src={gjirafaLogo}
                  alt="Gjirafa"
                  className="h-14 w-auto shrink-0 object-contain sm:h-16 md:h-20"
                />

                <div>
                  <h1 className="text-lg font-bold tracking-tight text-zinc-900 sm:text-xl">
                    Asset Management System
                  </h1>
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
                    Internal IT Operations
                  </p>
                </div>
              </button>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="w-full sm:w-auto" ref={adminMenuRef}>
                  <div className="overflow-x-auto pb-1 sm:overflow-visible sm:pb-0">
                    <div className="inline-flex min-w-max rounded-[18px] border border-zinc-200/90 bg-zinc-100/70 p-1 shadow-[0_10px_24px_rgba(0,0,0,0.06)]">
                      <button
                        onClick={openAssetsTab}
                        className={`rounded-2xl px-5 py-3 text-sm font-medium transition ${
                          activeTab === "assets"
                            ? "bg-white text-zinc-900 shadow-[0_2px_10px_rgba(0,0,0,0.08)]"
                            : "text-zinc-700 hover:bg-white/80"
                        }`}
                      >
                        My Assets
                      </button>

                      <button
                        onClick={openIssuesTab}
                        className={`rounded-2xl px-5 py-3 text-sm font-medium transition ${
                          activeTab === "issues"
                            ? "bg-white text-zinc-900 shadow-[0_2px_10px_rgba(0,0,0,0.08)]"
                            : "text-zinc-700 hover:bg-white/80"
                        }`}
                      >
                        Report an issue
                      </button>

                      <button
                        onClick={openMyReportsTab}
                        className={`rounded-2xl px-5 py-3 text-sm font-medium transition ${
                          activeTab === "my_reports"
                            ? "bg-white text-zinc-900 shadow-[0_2px_10px_rgba(0,0,0,0.08)]"
                            : "text-zinc-700 hover:bg-white/80"
                        }`}
                      >
                        My Reports
                      </button>

                      <button
                        onClick={openOnboardingTab}
                        className={`rounded-2xl px-5 py-3 text-sm font-medium transition ${
                          activeTab === "onboarding"
                            ? "bg-white text-zinc-900 shadow-[0_2px_10px_rgba(0,0,0,0.08)]"
                            : "text-zinc-700 hover:bg-white/80"
                        }`}
                      >
                        Onboarding
                      </button>

                      {isAdmin ? (
                        <div className="relative">
                          <button
                            onClick={() => setAdminMenuOpen((open) => !open)}
                            className={`rounded-2xl px-5 py-3 text-sm font-medium transition ${
                              ["all_assets", "all_reports", "admin", "history", "inventory", "onboarding"].includes(activeTab)
                                ? "bg-white text-zinc-900 shadow-[0_2px_10px_rgba(0,0,0,0.08)]"
                                : "text-zinc-700 hover:bg-white/80"
                            }`}
                          >
                            Admin
                          </button>

                          {adminMenuOpen ? (
                            <div className="absolute left-0 top-[calc(100%+8px)] z-50 hidden w-52 rounded-2xl border border-zinc-200 bg-white p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.12)] sm:block">
                              <AdminMenuItems
                                activeTab={activeTab}
                                openAllAssetsTab={openAllAssetsTab}
                                openAllReportsTab={openAllReportsTab}
                                openAdminTab={openAdminTab}
                                openHistoryTab={openHistoryTab}
                                openInventoryTab={openInventoryTab}
                                openOnboardingTab={openOnboardingTab}
                              />
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {isAdmin && adminMenuOpen ? (
                    <div className="mt-2 rounded-2xl border border-zinc-200 bg-white p-1.5 shadow-[0_10px_24px_rgba(0,0,0,0.08)] sm:hidden">
                      <AdminMenuItems
                        activeTab={activeTab}
                        openAllAssetsTab={openAllAssetsTab}
                        openAllReportsTab={openAllReportsTab}
                        openAdminTab={openAdminTab}
                        openHistoryTab={openHistoryTab}
                        openInventoryTab={openInventoryTab}
                        openOnboardingTab={openOnboardingTab}
                      />
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center gap-3">
                  <div className="hidden max-w-[320px] truncate rounded-[16px] border border-zinc-200/80 bg-white/90 px-4 py-2.5 text-sm text-zinc-600 shadow-[0_6px_18px_rgba(0,0,0,0.04)] sm:block">
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 align-middle" />{" "}
                    Signed in as{" "}
                    <span className="font-medium text-zinc-900">{session.user.email}</span>
                    {adminRole ? (
                      <>
                        {" "}
                        - <span className="uppercase">{adminRole}</span>
                      </>
                    ) : null}
                  </div>

                  <button
                    onClick={handleLogout}
                    className="rounded-2xl border border-zinc-300 bg-white px-5 py-3 text-sm font-medium text-zinc-700 transition hover:-translate-y-0.5 hover:border-zinc-400 hover:bg-zinc-50"
                  >
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>
      ) : null}

      <main>{renderMainContent()}</main>
    </div>
  );
}

function AdminMenuItems({
  activeTab,
  openAllAssetsTab,
  openAllReportsTab,
  openAdminTab,
  openHistoryTab,
  openInventoryTab,
  openOnboardingTab,
}) {
  return (
    <>
      <button
        onClick={openAllAssetsTab}
        className={`block w-full rounded-xl px-3 py-2.5 text-left text-sm transition ${
          activeTab === "all_assets" ? "bg-zinc-100 text-zinc-900" : "text-zinc-700 hover:bg-zinc-50"
        }`}
      >
        All Assets
      </button>
      <button
        onClick={openAllReportsTab}
        className={`mt-1 block w-full rounded-xl px-3 py-2.5 text-left text-sm transition ${
          activeTab === "all_reports"
            ? "bg-zinc-100 text-zinc-900"
            : "text-zinc-700 hover:bg-zinc-50"
        }`}
      >
        All Reports
      </button>
      <button
        onClick={openAdminTab}
        className={`mt-1 block w-full rounded-xl px-3 py-2.5 text-left text-sm transition ${
          activeTab === "admin" ? "bg-zinc-100 text-zinc-900" : "text-zinc-700 hover:bg-zinc-50"
        }`}
      >
        Admin Dashboard
      </button>
      <button
        onClick={openInventoryTab}
        className={`mt-1 block w-full rounded-xl px-3 py-2.5 text-left text-sm transition ${
          activeTab === "inventory" ? "bg-zinc-100 text-zinc-900" : "text-zinc-700 hover:bg-zinc-50"
        }`}
      >
        Inventory
      </button>
      <button
        onClick={openHistoryTab}
        className={`mt-1 block w-full rounded-xl px-3 py-2.5 text-left text-sm transition ${
          activeTab === "history" ? "bg-zinc-100 text-zinc-900" : "text-zinc-700 hover:bg-zinc-50"
        }`}
      >
        History
      </button>
      <button
        onClick={openOnboardingTab}
        className={`mt-1 block w-full rounded-xl px-3 py-2.5 text-left text-sm transition ${
          activeTab === "onboarding" ? "bg-zinc-100 text-zinc-900" : "text-zinc-700 hover:bg-zinc-50"
        }`}
      >
        Onboarding
      </button>
    </>
  );
}

function StatusCard({ text }) {
  return (
    <div className="px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl rounded-[32px] border border-zinc-200/80 bg-white px-6 py-6 text-zinc-700 shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
        {text}
      </div>
    </div>
  );
}

function AccessDeniedCard({ text }) {
  return (
    <div className="px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl rounded-[32px] border border-red-200 bg-red-50 px-6 py-6 text-red-800 shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
        <h2 className="text-lg font-semibold">Access denied</h2>
        <p className="mt-2 text-sm leading-7">
          Your account is signed in, but it does not currently have permission to {text}
        </p>
      </div>
    </div>
  );
}
