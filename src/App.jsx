import { useEffect, useState } from "react";
import MyAssets from "./MyAssets";
import AssetIssueReportForm from "./AssetIssueReportForm";
import AdminDashboard from "./AdminDashboard";
import AdminLogin from "./AdminLogin";
import AllReports from "./AllReports";
import EmployeeLogin from "./EmployeeLogin";
import { supabase } from "./supabaseClient";

const FALLBACK_ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || "rron.s@gjirafa.com")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

export default function App() {
  const [activeTab, setActiveTab] = useState("assets");
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminRole, setAdminRole] = useState(null);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedView = params.get("view");

    if (requestedView === "admin") {
      setActiveTab("admin");
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
    });

    return () => subscription.unsubscribe();
  }, []);

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
    window.history.replaceState({}, "", "/");
  }

  function openIssuesTab() {
    setActiveTab("issues");
    setShowAdminLogin(false);
    window.history.replaceState({}, "", "/?view=issues");
  }

  function openAdminTab() {
    if (!session) {
      setShowAdminLogin(true);
      return;
    }

    if (!isAdmin) {
      setActiveTab("assets");
      return;
    }

    setActiveTab("admin");
    window.history.replaceState({}, "", "/?view=admin");
  }

  function openAllReportsTab() {
    if (!session) {
      setShowAdminLogin(true);
      return;
    }

    if (!isAdmin) {
      setActiveTab("assets");
      return;
    }

    setActiveTab("all_reports");
    window.history.replaceState({}, "", "/?view=all_reports");
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setActiveTab("assets");
    setIsAdmin(false);
    setAdminRole(null);
    setSelectedAsset(null);
    setShowAdminLogin(false);
    window.history.replaceState({}, "", "/");
  }

  function handleReportIssueFromAsset(asset) {
    setSelectedAsset(asset);
    setActiveTab("issues");
    setShowAdminLogin(false);
    window.history.replaceState({}, "", "/?view=issues");
  }

  function renderMainContent() {
    if (!session) {
      return <EmployeeLogin onAdminLogin={() => setShowAdminLogin(true)} />;
    }

    if (activeTab === "assets") {
      return <MyAssets session={session} onReportIssue={handleReportIssueFromAsset} />;
    }

    if (activeTab === "issues") {
      return <AssetIssueReportForm selectedAsset={selectedAsset} />;
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.08),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.06),_transparent_22%),#f6f7fb] text-zinc-900">
      <header className="sticky top-0 z-40 border-b border-zinc-200/70 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-gradient-to-br from-zinc-950 to-zinc-700 text-base font-bold tracking-[0.18em] text-white shadow-[0_10px_24px_rgba(0,0,0,0.18)]">
                GJ
              </div>

              <div>
                <h1 className="text-lg font-bold tracking-tight text-zinc-900 sm:text-xl">
                  Gjirafa Internal IT Operations
                </h1>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {session ? (
                <div className="inline-flex rounded-[20px] border border-zinc-200/80 bg-white/70 p-1 shadow-[0_8px_20px_rgba(0,0,0,0.05)]">
                  <button
                    onClick={openAssetsTab}
                    className={`rounded-2xl px-5 py-3 text-sm font-medium transition ${
                      activeTab === "assets"
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-zinc-700 hover:bg-white"
                    }`}
                  >
                    My Assets
                  </button>

                  <button
                    onClick={openIssuesTab}
                    className={`rounded-2xl px-5 py-3 text-sm font-medium transition ${
                      activeTab === "issues"
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-zinc-700 hover:bg-white"
                    }`}
                  >
                    Issue Reports
                  </button>

                  {isAdmin ? (
                    <button
                      onClick={openAllReportsTab}
                      className={`rounded-2xl px-5 py-3 text-sm font-medium transition ${
                        activeTab === "all_reports"
                          ? "bg-blue-600 text-white shadow-sm"
                          : "text-zinc-700 hover:bg-white"
                      }`}
                    >
                      All Reports
                    </button>
                  ) : null}

                  {isAdmin ? (
                    <button
                      onClick={openAdminTab}
                      className={`rounded-2xl px-5 py-3 text-sm font-medium transition ${
                        activeTab === "admin"
                          ? "bg-blue-600 text-white shadow-sm"
                          : "text-zinc-700 hover:bg-white"
                      }`}
                    >
                      Admin Dashboard
                    </button>
                  ) : null}
                </div>
              ) : null}

              <div className="flex items-center gap-3">
                {session ? (
                  <>
                    <div className="hidden rounded-[20px] border border-zinc-200/80 bg-white px-4 py-3 text-sm text-zinc-600 shadow-[0_6px_18px_rgba(0,0,0,0.04)] sm:block">
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
                      className="rounded-2xl border border-zinc-300 bg-white px-5 py-3 text-sm font-medium text-zinc-700 transition hover:-translate-y-0.5 hover:bg-zinc-50"
                    >
                      Logout
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </header>

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
