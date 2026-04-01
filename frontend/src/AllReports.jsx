import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const STATUS_STYLES = {
  submitted: "bg-amber-50 text-amber-700 ring-amber-200",
  in_progress: "bg-blue-50 text-blue-700 ring-blue-200",
  resolved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

const APPROVAL_STYLES = {
  not_requested: "bg-zinc-100 text-zinc-700 ring-zinc-200",
  pending: "bg-violet-50 text-violet-700 ring-violet-200",
  approved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  rejected: "bg-red-50 text-red-700 ring-red-200",
};

const SEVERITY_STYLES = {
  Low: "bg-zinc-100 text-zinc-700 ring-zinc-200",
  Medium: "bg-amber-50 text-amber-700 ring-amber-200",
  High: "bg-orange-50 text-orange-700 ring-orange-200",
};

export default function AllReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchReports();
  }, []);

  async function fetchReports() {
    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from("asset_issue_reports")
      .select(
        "id, full_name, department, asset_type, issue_category, severity, status, approval_status, created_at"
      )
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setReports(data || []);
    setLoading(false);
  }

  const filteredReports = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    if (!term) return reports;

    return reports.filter((report) => {
      return (
        (report.full_name || "").toLowerCase().includes(term) ||
        (report.department || "").toLowerCase().includes(term) ||
        (report.asset_type || "").toLowerCase().includes(term) ||
        (report.issue_category || "").toLowerCase().includes(term)
      );
    });
  }, [reports, searchTerm]);

  if (loading) {
    return (
      <div className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-4">
          <div className="h-20 animate-pulse rounded-[24px] border border-zinc-200/80 bg-white" />
          <div className="h-[420px] animate-pulse rounded-[24px] border border-zinc-200/80 bg-white" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-[24px] border border-red-200 bg-red-50 px-6 py-5 text-red-700 shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
          <h2 className="font-semibold">Could not load reports</h2>
          <p className="mt-2 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-4">
        <section className="rounded-[24px] border border-zinc-200/80 bg-white p-4 shadow-[0_10px_30px_rgba(0,0,0,0.06)] sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                Admin View
              </p>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-zinc-900">
                All Reports
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                Complete list of submitted reports across all statuses.
              </p>
            </div>
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search name, department, asset..."
              className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 sm:w-72"
            />
          </div>
        </section>

        <section className="overflow-hidden rounded-[24px] border border-zinc-200/80 bg-white shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-zinc-50/80 text-left text-zinc-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Employee</th>
                  <th className="px-5 py-3 font-semibold">Department</th>
                  <th className="px-5 py-3 font-semibold">Asset</th>
                  <th className="px-5 py-3 font-semibold">Severity</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Approval</th>
                  <th className="px-5 py-3 font-semibold">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {filteredReports.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-zinc-500">
                      No reports found.
                    </td>
                  </tr>
                ) : (
                  filteredReports.map((report) => (
                    <tr key={report.id} className="border-t border-zinc-200/70">
                      <td className="px-5 py-3 font-medium text-zinc-900">{report.full_name}</td>
                      <td className="px-5 py-3 text-zinc-700">{report.department || "-"}</td>
                      <td className="px-5 py-3 text-zinc-700">
                        {report.asset_type || "-"}
                        <div className="text-xs text-zinc-500">{report.issue_category || "-"}</div>
                      </td>
                      <td className="px-5 py-3">
                        <Badge className={SEVERITY_STYLES[report.severity] || SEVERITY_STYLES.Low}>
                          {report.severity || "-"}
                        </Badge>
                      </td>
                      <td className="px-5 py-3">
                        <Badge
                          className={
                            STATUS_STYLES[report.status || "submitted"] || STATUS_STYLES.submitted
                          }
                        >
                          {labelize(report.status || "submitted")}
                        </Badge>
                      </td>
                      <td className="px-5 py-3">
                        <Badge
                          className={
                            APPROVAL_STYLES[report.approval_status || "not_requested"] ||
                            APPROVAL_STYLES.not_requested
                          }
                        >
                          {labelize(report.approval_status || "not_requested")}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-zinc-700">
                        {report.created_at ? new Date(report.created_at).toLocaleString() : "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function Badge({ className = "", children }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${className}`}>
      {children}
    </span>
  );
}

function labelize(value) {
  return value.replaceAll("_", " ");
}
