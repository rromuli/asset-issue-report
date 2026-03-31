import { useEffect, useRef, useState } from "react";
import MyAssets from "./MyAssets";
import AssetIssueReportForm from "./AssetIssueReportForm";
import AdminDashboard from "./AdminDashboard";
import AdminLogin from "./AdminLogin";
import AllReports from "./AllReports";
import AllAssets from "./AllAssets";
import OperationsHistory from "./OperationsHistory";
import EmployeeLogin from "./EmployeeLogin";
import gjirafaLogo from "./assets/gjirafa-logo.svg";
import { supabase } from "./supabaseClient";

const FALLBACK_ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || "rron.s@gjirafa.com")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

function isAllowedEmail(email = "") {
  return email.toLowerCase().endsWith("@gjirafa.com");
}

export default function App() {
  const [activeTab, setActiveTab] = useState("assets");
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminRole, setAdminRole] = useState(null);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [authNotice, setAuthNotice] = useState("");
  const adminMenuRef = useRef(null);

  useEffect(() => {
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
    } else if (requestedView === "issues") {
      setActiveTab("issues");
    } else {
      setActiveTab("assets");
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
      if (nextSession?.user?.email) {
        setAuthNotice("");
      }
    });

    return () => subscription.unsubscribe();
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
    async function enforceAllowedDomain() {
      if (!session?.user?.email) return;
      if (isAllowedEmail(session.user.email)) return;

      setAuthNotice("Access denied. Only @gjirafa.com accounts are allowed.");
      await supabase.auth.signOut();
      setShowAdminLogin(false);
      setActiveTab("assets");
      setIsAdmin(false);
      setAdminRole(null);
      setSelectedAsset(null);
      window.history.replaceState({}, "", "/");
    }

    enforceAllowedDomain();
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

    checkAdminAccess();
  }, [session]);

  function openAssetsTab() {
    setActiveTab("assets");
    setShowAdminLogin(false);
    setAdminMenuOpen(false);
    window.history.replaceState({}, "", "/");
  }

  function openIssuesTab() {
    setActiveTab("issues");
    setShowAdminLogin(false);
    setAdminMenuOpen(false);
    window.history.replaceState({}, "", "/?view=issues");
  }

  function openAdminTab() {
    if (!session) {
      setShowAdminLogin(true);
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
      setShowAdminLogin(true);
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
      setShowAdminLogin(true);
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
      setShowAdminLogin(true);
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

  async function handleLogout() {
    await supabase.auth.signOut();
    setActiveTab("assets");
    setIsAdmin(false);
    setAdminRole(null);
    setSelectedAsset(null);
    setShowAdminLogin(false);
    setAdminMenuOpen(false);
    window.history.replaceState({}, "", "/");
  }

  function handleReportIssueFromAsset(asset) {
    setSelectedAsset(asset);
    setActiveTab("issues");
    setShowAdminLogin(false);
    setAdminMenuOpen(false);
    window.history.replaceState({}, "", "/?view=issues");
  }

  function renderMainContent() {
    if (!session) {
      return <EmployeeLogin onAdminLogin={() => setShowAdminLogin(true)} externalNotice={authNotice} />;
    }

    if (activeTab === "assets") {
      return <MyAssets session={session} onReportIssue={handleReportIssueFromAsset} />;
    }

    if (activeTab === "issues") {
      return <AssetIssueReportForm selectedAsset={selectedAsset} session={session} />;
    }

    if (activeTab === "all_reports") {
      if (checkingAdmin) {
        return (
          <div className="px-4 py-10 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-4xl rounded-[32px] border border-zinc-200/80 bg-white px-6 py-6 text-zinc-700 shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
              Checking admin access...
            </div>
          </div>
        );
      }

      if (!isAdmin) {
        return (
          <div className="px-4 py-10 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-4xl rounded-[32px] border border-red-200 bg-red-50 px-6 py-6 text-red-800 shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
              <h2 className="text-lg font-semibold">Access denied</h2>
              <p className="mt-2 text-sm leading-7">
                Your account is signed in, but it does not currently have permission to
                access all reports.
              </p>
            </div>
          </div>
        );
      }

      return <AllReports />;
    }

    if (activeTab === "all_assets") {
      if (checkingAdmin) {
        return (
          <div className="px-4 py-10 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-4xl rounded-[32px] border border-zinc-200/80 bg-white px-6 py-6 text-zinc-700 shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
              Checking admin access...
            </div>
          </div>
        );
      }

      if (!isAdmin) {
        return (
          <div className="px-4 py-10 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-4xl rounded-[32px] border border-red-200 bg-red-50 px-6 py-6 text-red-800 shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
              <h2 className="text-lg font-semibold">Access denied</h2>
              <p className="mt-2 text-sm leading-7">
                Your account is signed in, but it does not currently have permission to
                access all employee assets.
              </p>
            </div>
          </div>
        );
      }

      return <AllAssets />;
    }

    if (activeTab === "history") {
      if (checkingAdmin) {
        return (
          <div className="px-4 py-10 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-4xl rounded-[32px] border border-zinc-200/80 bg-white px-6 py-6 text-zinc-700 shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
              Checking admin access...
            </div>
          </div>
        );
      }

      if (!isAdmin) {
        return (
          <div className="px-4 py-10 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-4xl rounded-[32px] border border-red-200 bg-red-50 px-6 py-6 text-red-800 shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
              <h2 className="text-lg font-semibold">Access denied</h2>
              <p className="mt-2 text-sm leading-7">
                Your account is signed in, but it does not currently have permission to
                access history.
              </p>
            </div>
          </div>
        );
      }

      return <OperationsHistory />;
    }

    if (activeTab === "admin") {
      if (checkingAdmin) {
        return (
          <div className="px-4 py-10 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-4xl rounded-[32px] border border-zinc-200/80 bg-white px-6 py-6 text-zinc-700 shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
              Checking admin access...
            </div>
          </div>
        );
      }

      if (!isAdmin) {
        return (
          <div className="px-4 py-10 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-4xl rounded-[32px] border border-red-200 bg-red-50 px-6 py-6 text-red-800 shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
              <h2 className="text-lg font-semibold">Access denied</h2>
              <p className="mt-2 text-sm leading-7">
                Your account is signed in, but it does not currently have permission to
                access the administrative dashboard.
              </p>
            </div>
          </div>
        );
      }

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
              <div className="flex items-center gap-3 sm:gap-4">
                <img
                  src={gjirafaLogo}
                  alt="Gjirafa"
                  className="h-14 w-auto shrink-0 object-contain sm:h-16 md:h-20"
                />

                <div>
                  <h1 className="text-lg font-bold tracking-tight text-zinc-900 sm:text-xl">
                    Asset Managmet System
                  </h1>
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
                    Internal IT Operations
                  </p>
                </div>
              </div>

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
                        Issue Reports
                      </button>

                      {isAdmin ? (
                        <div className="relative">
                          <button
                            onClick={() => setAdminMenuOpen((open) => !open)}
                            className={`rounded-2xl px-5 py-3 text-sm font-medium transition ${
                              ["all_assets", "all_reports", "admin", "history"].includes(activeTab)
                                ? "bg-white text-zinc-900 shadow-[0_2px_10px_rgba(0,0,0,0.08)]"
                                : "text-zinc-700 hover:bg-white/80"
                            }`}
                          >
                            Admin
                          </button>

                          {adminMenuOpen ? (
                            <div className="absolute left-0 top-[calc(100%+8px)] z-50 hidden w-52 rounded-2xl border border-zinc-200 bg-white p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.12)] sm:block">
                              <button
                                onClick={openAllAssetsTab}
                                className={`block w-full rounded-xl px-3 py-2.5 text-left text-sm transition ${
                                  activeTab === "all_assets"
                                    ? "bg-zinc-100 text-zinc-900"
                                    : "text-zinc-700 hover:bg-zinc-50"
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
                                  activeTab === "admin"
                                    ? "bg-zinc-100 text-zinc-900"
                                    : "text-zinc-700 hover:bg-zinc-50"
                                }`}
                              >
                                Admin Dashboard
                              </button>
                              <button
                                onClick={openHistoryTab}
                                className={`mt-1 block w-full rounded-xl px-3 py-2.5 text-left text-sm transition ${
                                  activeTab === "history"
                                    ? "bg-zinc-100 text-zinc-900"
                                    : "text-zinc-700 hover:bg-zinc-50"
                                }`}
                              >
                                History
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {isAdmin && adminMenuOpen ? (
                    <div className="mt-2 rounded-2xl border border-zinc-200 bg-white p-1.5 shadow-[0_10px_24px_rgba(0,0,0,0.08)] sm:hidden">
                      <button
                        onClick={openAllAssetsTab}
                        className={`block w-full rounded-xl px-3 py-2.5 text-left text-sm transition ${
                          activeTab === "all_assets"
                            ? "bg-zinc-100 text-zinc-900"
                            : "text-zinc-700 hover:bg-zinc-50"
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
                          activeTab === "admin"
                            ? "bg-zinc-100 text-zinc-900"
                            : "text-zinc-700 hover:bg-zinc-50"
                        }`}
                      >
                        Admin Dashboard
                      </button>
                      <button
                        onClick={openHistoryTab}
                        className={`mt-1 block w-full rounded-xl px-3 py-2.5 text-left text-sm transition ${
                          activeTab === "history"
                            ? "bg-zinc-100 text-zinc-900"
                            : "text-zinc-700 hover:bg-zinc-50"
                        }`}
                      >
                        History
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center gap-3">
                  <div className="hidden max-w-[320px] truncate rounded-[16px] border border-zinc-200/80 bg-white/90 px-4 py-2.5 text-sm text-zinc-600 shadow-[0_6px_18px_rgba(0,0,0,0.04)] sm:block">
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 align-middle" />{" "}
                    Signed in as{" "}
                    <span className="font-medium text-zinc-900">
                      {session.user.email}
                    </span>
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

      {showAdminLogin ? (
        <AdminLogin
          onClose={() => setShowAdminLogin(false)}
          onSuccess={() => {
            setShowAdminLogin(false);
            setActiveTab("admin");
            window.history.replaceState({}, "", "/?view=admin");
          }}
        />
      ) : null}
    </div>
  );
}
