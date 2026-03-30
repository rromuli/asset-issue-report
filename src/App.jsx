import { useEffect, useState } from "react";
import MyAssets from "./MyAssets";
import AssetIssueReportForm from "./AssetIssueReportForm";
import AdminDashboard from "./AdminDashboard";
import AdminLogin from "./AdminLogin";
import { supabase } from "./supabaseClient";

export default function App() {
  const [activeTab, setActiveTab] = useState("assets");
  const [showLogin, setShowLogin] = useState(false);
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminRole, setAdminRole] = useState(null);
  const [checkingAdmin, setCheckingAdmin] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedView = params.get("view");

    if (requestedView === "admin") {
      setActiveTab("admin");
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

      const { data, error } = await supabase
        .from("admin_users")
        .select("email, role")
        .eq("email", session.user.email)
        .maybeSingle();

      if (error) {
        console.error(error);
        setIsAdmin(false);
        setAdminRole(null);
        setCheckingAdmin(false);
        return;
      }

      setIsAdmin(!!data);
      setAdminRole(data?.role || null);
      setCheckingAdmin(false);
    }

    checkAdminAccess();
  }, [session]);

  function openAssetsTab() {
    setActiveTab("assets");
    setShowLogin(false);
    window.history.replaceState({}, "", "/");
  }

  function openIssuesTab() {
    setActiveTab("issues");
    setShowLogin(false);
    window.history.replaceState({}, "", "/?view=issues");
  }

  function openAdminTab() {
    if (!session) {
      setShowLogin(true);
      return;
    }

    if (!isAdmin) {
      setActiveTab("assets");
      return;
    }

    setActiveTab("admin");
    window.history.replaceState({}, "", "/?view=admin");
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setActiveTab("assets");
    setIsAdmin(false);
    setAdminRole(null);
    setShowLogin(false);
    window.history.replaceState({}, "", "/");
  }

  function renderMainContent() {
    if (activeTab === "assets") {
      return <MyAssets session={session} />;
    }

    if (activeTab === "issues") {
      return <AssetIssueReportForm />;
    }

    if (activeTab === "admin") {
      if (!session) {
        return (
          <div className="px-4 py-10 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-4xl rounded-[32px] border border-amber-200 bg-amber-50 px-6 py-6 text-amber-900 shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
              <h2 className="text-lg font-semibold">Admin authentication required</h2>
              <p className="mt-2 text-sm leading-7 text-amber-800">
                Please sign in with an approved administrator account to access the
                dashboard.
              </p>
            </div>
          </div>
        );
      }

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

      return <AdminDashboard session={session} adminRole={adminRole} />;
    }

    return <MyAssets session={session} />;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.08),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.06),_transparent_22%),#f6f7fb] text-zinc-900">
      <header className="sticky top-0 z-40 border-b border-zinc-200/70 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-zinc-950 text-lg font-bold tracking-[0.18em] text-white shadow-[0_10px_24px_rgba(0,0,0,0.18)]">
                GJ
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                  GJIRAFA • Internal IT Operations
                </p>
                <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
                  Asset Lifecycle Portal
                </h1>
                <p className="mt-1 text-sm leading-7 text-zinc-600 sm:text-base">
                  Employee asset registration, issue reporting, and approval workflow.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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
                          • <span className="uppercase">{adminRole}</span>
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
                ) : (
                  <div className="hidden rounded-[20px] border border-zinc-200/80 bg-white px-4 py-3 text-sm text-zinc-600 shadow-[0_6px_18px_rgba(0,0,0,0.04)] sm:block">
                    Authentication will be connected later
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main>{renderMainContent()}</main>

      {showLogin ? (
        <AdminLogin
          onClose={() => setShowLogin(false)}
          onSuccess={() => {
            setShowLogin(false);
            setActiveTab("admin");
            window.history.replaceState({}, "", "/?view=admin");
          }}
        />
      ) : null}
    </div>
  );
}