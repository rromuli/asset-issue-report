import { supabase } from "./supabaseClient";

export default function EmployeeLogin({ onAdminLogin }) {
  async function handleOIDCLogin() {
    const provider = import.meta.env.VITE_OIDC_PROVIDER;
    const redirectTo = `${window.location.origin}/`;

    if (!provider) {
      alert("Missing VITE_OIDC_PROVIDER in .env.local");
      return;
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
      },
    });

    if (error) {
      alert("OIDC sign-in failed: " + error.message);
    }
  }

  const providerLabel = import.meta.env.VITE_OIDC_PROVIDER || "custom:company-google";
  const knownAuthority = import.meta.env.VITE_OIDC_KNOWN_AUTHORITY || "";

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.08),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.06),_transparent_22%),#f6f7fb] px-4 py-10 text-zinc-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-md rounded-[28px] border border-zinc-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(0,0,0,0.06)] sm:p-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
          GJIRAFA INTERNAL IT OPERATIONS
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900">
          Employee Login
        </h1>

        <button
          onClick={handleOIDCLogin}
          className="mt-6 w-full rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-700"
        >
          Continue with Company Login
        </button>

        <button
          onClick={() => onAdminLogin?.()}
          className="mt-3 w-full rounded-2xl border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:-translate-y-0.5 hover:bg-zinc-50"
        >
          Admin Login
        </button>

        <div className="mt-5 rounded-2xl bg-zinc-50 px-4 py-3 text-xs text-zinc-600">
          Provider: <span className="font-medium">{providerLabel}</span>
          {knownAuthority ? (
            <div className="mt-1 break-all">Authority: {knownAuthority}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
