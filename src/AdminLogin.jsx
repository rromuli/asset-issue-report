import { useState } from "react";
import { supabase } from "./supabaseClient";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm">
      <div className="w-full max-w-5xl overflow-hidden rounded-[30px] border border-zinc-200 bg-white shadow-2xl">
        <div className="grid gap-0 lg:grid-cols-[1fr_0.95fr]">
          <div className="bg-zinc-950 px-6 py-8 text-white sm:px-8 sm:py-10">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-400">
              Secure Access Portal
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Administrative Sign In
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-zinc-300 sm:text-base">
              Access the protected dashboard to review submitted asset reports,
              manage operational priorities, and update issue status for the IT team.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <FeatureCard
                title="Protected access"
                text="Only approved administrator accounts can open the dashboard."
              />
              <FeatureCard
                title="Operational visibility"
                text="Monitor submissions, severity levels, and progress in one place."
              />
              <FeatureCard
                title="Board-ready workflow"
                text="Present a secure and professional internal reporting system."
              />
            </div>
          </div>

          <div className="bg-white px-6 py-8 sm:px-8 sm:py-10">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
                  Administrator Login
                </p>
                <h3 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900">
                  Sign in to continue
                </h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  Use an approved administrator email and password to access the
                  dashboard.
                </p>
              </div>

              <button
                onClick={onClose}
                className="rounded-xl border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleLogin} className="mt-8 space-y-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-zinc-900">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-2xl border border-zinc-300 px-4 py-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
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
                  className="w-full rounded-2xl border border-zinc-300 px-4 py-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
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
                className="w-full rounded-2xl bg-blue-600 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
              >
                {loading ? "Signing in..." : "Open Admin Dashboard"}
              </button>
            </form>

            <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
              This area is restricted to approved internal administrators. If you need
              access, please contact the IT team.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ title, text }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mt-2 text-sm leading-6 text-zinc-300">{text}</p>
    </div>
  );
}
