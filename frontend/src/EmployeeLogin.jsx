import { useState } from "react";
import gjirafaLogo from "./assets/gjirafa-logo.svg";

const OIDC_BUTTON_LABEL = "Continue with Company Login";
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

function apiUrl(path) {
  return `${API_BASE_URL}${path}`;
}

export default function EmployeeLogin({ externalNotice = "" }) {
  const [notice, setNotice] = useState(null);
  const [adminPopupOpen, setAdminPopupOpen] = useState(false);

  async function handleLogin() {
    try {
      const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = apiUrl(`/api/auth/login?returnTo=${returnTo}`);
    } catch (error) {
      setNotice({
        tone: "error",
        message: "Company sign-in failed: " + error.message,
      });
    }
  }

  function handleAdminLogin() {
    const returnTo = encodeURIComponent("/?view=admin");
    window.location.href = apiUrl(`/api/auth/login?returnTo=${returnTo}`);
  }

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
          onClick={handleLogin}
          className="mt-7 w-full rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-3.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(37,99,235,0.35)] transition hover:-translate-y-0.5 hover:from-blue-700 hover:to-blue-800"
        >
          {OIDC_BUTTON_LABEL}
        </button>

        <button
          onClick={() => setAdminPopupOpen(true)}
          className="mt-3 w-full rounded-2xl border border-zinc-300 bg-white px-5 py-3.5 text-sm font-semibold text-zinc-700 transition hover:-translate-y-0.5 hover:border-zinc-400 hover:bg-zinc-50"
        >
          Admin Login
        </button>

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

        {externalNotice ? (
          <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {externalNotice}
          </div>
        ) : null}
      </div>

      {adminPopupOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] border border-zinc-200/80 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.25)] sm:p-7">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
              Administrator Login
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900">Admin Access</h2>
            <p className="mt-2 text-sm text-zinc-600">
              Continue with company sign-in to open the admin dashboard.
            </p>

            <button
              onClick={handleAdminLogin}
              className="mt-6 w-full rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-3.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(37,99,235,0.35)] transition hover:-translate-y-0.5 hover:from-blue-700 hover:to-blue-800"
            >
              Continue as Admin
            </button>

            <button
              onClick={() => setAdminPopupOpen(false)}
              className="mt-2 w-full rounded-2xl border border-zinc-300 bg-white px-5 py-3.5 text-sm font-semibold text-zinc-700 transition hover:-translate-y-0.5 hover:border-zinc-400 hover:bg-zinc-50"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
