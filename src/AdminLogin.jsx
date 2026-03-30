import { useState } from "react";
import { supabase } from "./supabaseClient";
import amsGjirafaLogo from "./assets/gjirafa-logo.svg";

export default function AdminLogin({ onClose, onSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    onSuccess();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 px-4 backdrop-blur-md">
      <div className="w-full max-w-md rounded-[30px] border border-zinc-200/90 bg-white p-6 shadow-[0_30px_80px_rgba(15,23,42,0.25)] ring-1 ring-white sm:p-7">
        <img
          src={amsGjirafaLogo}
          alt="AMS GJIRAFA"
          className="h-10 w-auto object-contain"
        />

        <div className="flex items-start justify-between gap-4">
          <div className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
              Administrator Login
            </p>
            <h3 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900">
              Sign in
            </h3>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-600 transition hover:border-zinc-400 hover:bg-zinc-50"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <div>
            <label className="mb-2 block text-sm font-semibold text-zinc-900">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border border-zinc-300 bg-zinc-50/40 px-4 py-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              placeholder="admin@company.com"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-zinc-900">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border border-zinc-300 bg-zinc-50/40 px-4 py-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              placeholder="Enter password"
              required
            />
          </div>

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
              <div className="font-semibold">Sign-in failed</div>
              <p className="mt-1">{error}</p>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(37,99,235,0.35)] transition hover:from-blue-700 hover:to-blue-800 disabled:cursor-not-allowed disabled:from-blue-400 disabled:to-blue-400"
          >
            {loading ? "Signing in..." : "Open Admin Dashboard"}
          </button>
        </form>

        <div className="mt-5 rounded-2xl border border-zinc-200/80 bg-zinc-50 px-4 py-3 text-xs text-zinc-600">
          Restricted to approved internal administrators.
        </div>
      </div>
    </div>
  );
}
