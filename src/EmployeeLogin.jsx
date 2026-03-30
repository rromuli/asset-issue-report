import { useState } from "react";
import { supabase } from "./supabaseClient";
import gjirafaLogo from "./assets/gjirafa-logo.svg";

export default function EmployeeLogin({ onAdminLogin }) {
  const [notice, setNotice] = useState(null);

  async function handleOIDCLogin() {
    const provider = import.meta.env.VITE_OIDC_PROVIDER;
    const redirectTo = `${window.location.origin}/`;

    if (!provider) {
      setNotice({
        tone: "error",
        message: "Missing VITE_OIDC_PROVIDER in .env.local",
      });
      return;
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
      },
    });

    if (error) {
      setNotice({
        tone: "error",
        message: "OIDC sign-in failed: " + error.message,
      });
    }
  }

  const providerLabel = import.meta.env.VITE_OIDC_PROVIDER || "custom:company-google";
  const knownAuthority = import.meta.env.VITE_OIDC_KNOWN_AUTHORITY || "";

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.11),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.08),_transparent_25%),linear-gradient(to_bottom,#f9fafb,#f4f6fb)] px-4 py-12 text-zinc-900 sm:px-6 lg:px-8">
      <div className="mx-auto mb-5 flex w-full max-w-md justify-center">
        <img
          src={gjirafaLogo}
          alt="Gjirafa"
          className="-translate-x-3 h-auto w-[201px] max-w-full object-contain sm:w-[240px]"
        />
      </div>

      <div className="mx-auto max-w-md rounded-[30px] border border-zinc-200/80 bg-white/95 p-7 shadow-[0_20px_55px_rgba(15,23,42,0.12)] ring-1 ring-white sm:p-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
          Asset Managment System
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 sm:text-[28px]">
          Employee Login
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          Sign in to continue.
        </p>

        <button
          onClick={handleOIDCLogin}
          className="mt-7 w-full rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-3.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(37,99,235,0.35)] transition hover:-translate-y-0.5 hover:from-blue-700 hover:to-blue-800"
        >
          Continue with Google
        </button>

        <button
          onClick={() => onAdminLogin?.()}
          className="mt-3 w-full rounded-2xl border border-zinc-300 bg-white px-5 py-3.5 text-sm font-semibold text-zinc-700 transition hover:-translate-y-0.5 hover:border-zinc-400 hover:bg-zinc-50"
        >
          Admin Login
        </button>

        <div className="mt-5 rounded-2xl border border-zinc-200/80 bg-zinc-50 px-4 py-3 text-xs text-zinc-600">
          Provider: <span className="font-medium">{providerLabel}</span>
          {knownAuthority ? (
            <div className="mt-1 break-all">Authority: {knownAuthority}</div>
          ) : null}
        </div>
        {notice ? (
          <div
            className={`mt-3 rounded-2xl border px-4 py-3 text-sm ${
              notice.tone === "error"
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-blue-200 bg-blue-50 text-blue-800"
            }`}
          >
            {notice.message}
          </div>
        ) : null}
      </div>
    </div>
  );
}
