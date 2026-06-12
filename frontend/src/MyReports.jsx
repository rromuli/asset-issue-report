import { useEffect, useState } from "react";
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

export default function MyReports({ session }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  const employeeId = session?.user?.email?.split("@")[0] || "";

  useEffect(() => {
    if (!employeeId) {
      setLoading(false);
      return;
    }
    fetchReports();
  }, [employeeId]);

  async function fetchReports() {
    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from("asset_issue_reports")
      .select(
        "id, asset_type, make_model, issue_category, severity, status, approval_status, description, technical_assessment, approver_notes, repairability_status, replacement_required, created_at, approved_at"
      )
      .eq("employee_id", employeeId)
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setReports(data || []);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl space-y-4">
          <div className="h-20 animate-pulse rounded-[24px] border border-zinc-200/80 bg-white" />
          <div className="h-64 animate-pulse rounded-[24px] border border-zinc-200/80 bg-white" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl rounded-[24px] border border-red-200 bg-red-50 px-6 py-5 text-red-700 shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
          <h2 className="font-semibold">Could not load your reports</h2>
          <p className="mt-2 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.08),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.06),_transparent_22%),#f6f7fb] px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-4">
        <section className="rounded-[24px] border border-zinc-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                Employee Portal
              </p>
              <h1 className="mt-1 text-xl font-bold tracking-tight text-zinc-900">
                My Reports
              </h1>
              <p className="mt-1 text-sm text-zinc-600">
                Track the status of all issue reports you have submitted.
              </p>
            </div>
            <div className="shrink-0 rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
              {reports.length} report{reports.length === 1 ? "" : "s"}
            </div>
          </div>
        </section>

        {reports.length === 0 ? (
          <section className="rounded-[24px] border border-zinc-200/80 bg-white p-10 text-center shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
            <p className="text-sm text-zinc-500">
              You have not submitted any issue reports yet.
            </p>
          </section>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => {
              const isExpanded = expandedId === report.id;
              const statusKey = report.status || "submitted";
              const approvalKey = report.approval_status || "not_requested";

              return (
                <section
                  key={report.id}
                  className="overflow-hidden rounded-[24px] border border-zinc-200/80 bg-white shadow-[0_6px_18px_rgba(0,0,0,0.05)]"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : report.id)}
                    className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-zinc-900">Report #{report.id}</span>
                        <span className="text-sm text-zinc-500">
                          {report.asset_type || "-"} — {report.issue_category || "-"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-zinc-400">
                        Submitted {report.created_at ? new Date(report.created_at).toLocaleDateString() : ""}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <Badge className={SEVERITY_STYLES[report.severity] || SEVERITY_STYLES.Low}>
                        {report.severity || "-"}
                      </Badge>
                      <Badge className={STATUS_STYLES[statusKey] || STATUS_STYLES.submitted}>
                        {labelize(statusKey)}
                      </Badge>
                      {approvalKey !== "not_requested" ? (
                        <Badge className={APPROVAL_STYLES[approvalKey] || APPROVAL_STYLES.not_requested}>
                          {labelize(approvalKey)}
                        </Badge>
                      ) : null}
                      <span className="text-xs text-zinc-400">{isExpanded ? "▲" : "▼"}</span>
                    </div>
                  </button>

                  {isExpanded ? (
                    <div className="space-y-4 border-t border-zinc-200/70 px-5 py-4">
                      {report.status === "resolved" ? (
                        <div className="rounded-[18px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                          Your issue has been resolved.
                          {report.approved_at
                            ? ` Completed on ${new Date(report.approved_at).toLocaleDateString()}.`
                            : ""}
                        </div>
                      ) : null}

                      {approvalKey === "rejected" ? (
                        <div className="rounded-[18px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                          Replacement request was not approved. See approver notes below.
                        </div>
                      ) : null}

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <DetailRow label="Asset type" value={report.asset_type || "-"} />
                        <DetailRow label="Make / Model" value={report.make_model || "-"} />
                        <DetailRow label="Issue category" value={report.issue_category || "-"} />
                        <DetailRow label="Repairability" value={labelize(report.repairability_status || "not assessed")} />
                        <DetailRow
                          label="Replacement required"
                          value={report.replacement_required ? "Yes" : "No"}
                        />
                        <DetailRow label="Approval" value={labelize(approvalKey)} />
                      </div>

                      <TextBlock label="Your description" text={report.description || "-"} />

                      <TextBlock
                        label="IT technical assessment"
                        text={report.technical_assessment || "Not yet added by IT."}
                      />

                      {report.approver_notes ? (
                        <TextBlock label="Approver notes" text={report.approver_notes} />
                      ) : null}
                    </div>
                  ) : null}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Badge({ className = "", children }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${className}`}
    >
      {children}
    </span>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="rounded-[18px] bg-zinc-50 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-zinc-900">{value}</p>
    </div>
  );
}

function TextBlock({ label, text }) {
  return (
    <div className="rounded-[18px] border border-zinc-200/80 bg-white p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-700">{text}</p>
    </div>
  );
}

function labelize(value) {
  return String(value).replaceAll("_", " ");
}
