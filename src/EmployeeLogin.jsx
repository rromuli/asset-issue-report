import { supabase } from "./supabaseClient";

export default function EmployeeLogin({ onPresentationAccess }) {
  async function handleOIDCLogin() {
    const provider = import.meta.env.VITE_OIDC_PROVIDER;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const knownAuthority = import.meta.env.VITE_OIDC_KNOWN_AUTHORITY;
    const redirectTo = `${window.location.origin}/`;

    if (!provider) {
      onPresentationAccess?.();
      return;
    }

    if (!supabaseAnonKey || supabaseAnonKey === "YOUR_SUPABASE_PUBLISHABLE_KEY") {
      onPresentationAccess?.();
      return;
    }

    if (!knownAuthority || knownAuthority.startsWith("YOUR_")) {
      onPresentationAccess?.();
      return;
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
      },
    });

    if (error) {
      onPresentationAccess?.();
    }
  }

  const providerLabel = import.meta.env.VITE_OIDC_PROVIDER || "custom:company-google";
  const knownAuthority =
    import.meta.env.VITE_OIDC_KNOWN_AUTHORITY || "YOUR_KNOWN_AUTHORITY_URL";

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.08),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.06),_transparent_22%),#f6f7fb] px-4 py-10 text-zinc-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl rounded-[32px] border border-zinc-200/80 bg-white shadow-[0_10px_30px_rgba(0,0,0,0.06)] overflow-hidden">
        <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="px-6 py-8 sm:px-8 sm:py-10">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
              GJIRAFA • Employee Asset Portal
            </p>

            <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-900 sm:text-5xl">
              Sign in to access your assets
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-600 sm:text-base">
              Employees will use company SSO to view their assigned assets, register asset
              condition, and submit issue reports linked to specific devices.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <InfoTile
                title="My Assets"
                text="View and manage assets registered under your name."
              />
              <InfoTile
                title="Issue Reports"
                text="Create issue reports linked to a specific asset."
              />
              <InfoTile
                title="Admin Workflow"
                text="Approved admins get access to review and approval tools."
              />
            </div>
          </div>

          <div className="border-t border-zinc-200 bg-zinc-50/70 px-6 py-8 sm:px-8 lg:border-l lg:border-t-0">
            <div className="rounded-[28px] border border-zinc-200/80 bg-white p-6 shadow-[0_6px_18px_rgba(0,0,0,0.05)]">
              <h2 className="text-xl font-bold text-zinc-900">
                Company SSO Login
              </h2>

              <p className="mt-3 text-sm leading-7 text-zinc-600">
                This login is prepared for a custom OpenID Connect provider and can be
                switched live after approval by adding the real provider details.
              </p>

              <div className="mt-5 rounded-[24px] bg-zinc-50 p-4 text-sm leading-7 text-zinc-700">
                <div>
                  <span className="font-semibold">Provider:</span> {providerLabel}
                </div>
                <div className="mt-1 break-all">
                  <span className="font-semibold">Known Authority:</span> {knownAuthority}
                </div>
              </div>

              <button
                onClick={handleOIDCLogin}
                className="mt-6 w-full rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-700"
              >
                Continue with Company Login
              </button>

              <div className="mt-6 rounded-[24px] bg-blue-50 p-4 text-sm leading-7 text-blue-800">
                After authentication, employees will land on <strong>My Assets</strong>.
                Users listed in <strong>admin_users</strong> will also see the{" "}
                <strong>Admin Dashboard</strong>.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoTile({ title, text }) {
  return (
    <div className="rounded-[24px] border border-zinc-200/80 bg-zinc-50 p-4 shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
      <p className="text-sm font-semibold text-zinc-900">{title}</p>
      <p className="mt-2 text-sm leading-7 text-zinc-600">{text}</p>
    </div>
  );
}
