import { useState } from "react";
import gjirafaLogo from "./assets/gjirafa-logo.svg";
import { supabase } from "./supabaseClient";

export default function EmployeeLogin({
  externalNotice = "",
  useBackendAuth = false,
}) {
  const [notice, setNotice] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handlePasswordLogin(event) {
    event.preventDefault();
    setNotice(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setNotice({
        tone: "error",
        message: "Sign-in failed: " + error.message,
      });
      setLoading(false);
      return;
    }

    setLoading(false);
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
          {useBackendAuth
            ? "Sign in with your company account to continue."
            : "Sign in with your Supabase account to continue."}
        </p>
        {useBackendAuth ? (
          <div className="mt-6 space-y-3">
            <button
              type="button"
              onClick={() => {
                window.location.href = "/api/auth/login?returnTo=%2F";
              }}
              className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-3.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(37,99,235,0.35)] transition hover:-translate-y-0.5 hover:from-blue-700 hover:to-blue-800"
            >
              Continue with Company Login
            </button>
          </div>
        ) : (
          <form onSubmit={handlePasswordLogin} className="mt-6 space-y-3">
            <div>
              <label className="mb-2 block text-sm font-semibold text-zinc-900">Email</label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-2xl border border-zinc-300 bg-zinc-50/40 px-4 py-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                placeholder="name@gjirafa.com"
                required
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-zinc-900">Password</label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-2xl border border-zinc-300 bg-zinc-50/40 px-4 py-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                placeholder="Enter password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-3.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(37,99,235,0.35)] transition hover:-translate-y-0.5 hover:from-blue-700 hover:to-blue-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        )}

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

    </div>
  );
}
