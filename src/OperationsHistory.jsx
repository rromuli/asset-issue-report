import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

export default function OperationsHistory() {
  const [logs, setLogs] = useState([]);
  const [openLogId, setOpenLogId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchHistory();
  }, []);

  async function fetchHistory() {
    setLoading(true);
    setError("");

    const [
      { data: issuesData, error: issuesError },
      { data: returnsData, error: returnsError },
    ] = await Promise.all([
      supabase
        .from("asset_issue_reports")
        .select(
          "id, full_name, employee_id, department, asset_type, make_model, issue_category, severity, status, approval_status, technical_assessment, approver_notes, repairability_status, replacement_required, sent_for_approval_at, approved_at, approved_by, created_at"
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("asset_return_requests")
        .select(
          "id, asset_id, employee_name, employee_email, asset_name, asset_type, asset_tag, serial_number, status, requested_at, confirmed_at, confirmed_by, notes"
        )
        .order("requested_at", { ascending: false }),
    ]);

    if (issuesError) {
      setError(issuesError.message);
      setLoading(false);
      return;
    }

    if (returnsError) {
      console.error("asset_return_requests load error:", returnsError.message);
    }

    const issueLogs = (issuesData || []).map((row) => {
      const latestAt = row.approved_at || row.sent_for_approval_at || row.created_at;
      return {
        id: `issue-${row.id}`,
        kind: "issue",
        timestamp: latestAt,
        title: `Issue #${row.id} - ${row.full_name} (${row.employee_id})`,
        subtitle: `${row.asset_type || "-"} | ${row.issue_category || "-"} | ${row.severity || "-"}`,
        status: row.status || "submitted",
        approvalStatus: row.approval_status || "not_requested",
        searchText: [
          row.full_name,
          row.employee_id,
          row.department,
          row.asset_type,
          row.make_model,
          row.issue_category,
          row.severity,
          row.status,
          row.approval_status,
          row.approved_by,
        ]
          .join(" ")
          .toLowerCase(),
        details: {
          submitted: row.created_at,
          sentForApproval: row.sent_for_approval_at,
          approvedAt: row.approved_at,
          approvedBy: row.approved_by,
          technicalAssessment: row.technical_assessment,
          approverNotes: row.approver_notes,
          repairability: row.repairability_status,
          replacementRequired: row.replacement_required,
        },
      };
    });

    const returnLogs = (returnsData || []).map((row) => {
      const latestAt = row.confirmed_at || row.requested_at;
      return {
        id: `return-${row.id}`,
        kind: "return",
        timestamp: latestAt,
        title: `Return #${row.id} - ${row.employee_name || row.employee_email}`,
        subtitle: `${row.asset_name || "-"} | ${row.asset_type || "-"} | Tag: ${row.asset_tag || "-"}`,
        status: row.status || "pending",
        approvalStatus: null,
        searchText: [
          row.employee_name,
          row.employee_email,
          row.asset_name,
          row.asset_type,
          row.asset_tag,
          row.serial_number,
          row.status,
          row.confirmed_by,
        ]
          .join(" ")
          .toLowerCase(),
        details: {
          requestedAt: row.requested_at,
          confirmedAt: row.confirmed_at,
          confirmedBy: row.confirmed_by,
          employeeEmail: row.employee_email,
          serialNumber: row.serial_number,
          notes: row.notes,
        },
      };
    });

    const mergedLogs = [...issueLogs, ...returnLogs].sort((a, b) => {
      const aTime = new Date(a.timestamp || 0).getTime();
      const bTime = new Date(b.timestamp || 0).getTime();
      return bTime - aTime;
    });

    setLogs(mergedLogs);
    setLoading(false);
  }

  const filteredLogs = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return logs;
    return logs.filter((log) => log.searchText.includes(term));
  }, [logs, searchTerm]);

  if (loading) {
    return (
      <div className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-4">
          <div className="h-20 animate-pulse rounded-[24px] border border-zinc-200/80 bg-white" />
          <div className="h-[520px] animate-pulse rounded-[24px] border border-zinc-200/80 bg-white" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-[24px] border border-red-200 bg-red-50 px-6 py-5 text-red-700 shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
          <h2 className="font-semibold">Could not load history</h2>
          <p className="mt-2 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 py-3 sm:px-5 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-3">
        <section className="rounded-[20px] border border-zinc-200/80 bg-white p-3.5 shadow-[0_10px_30px_rgba(0,0,0,0.06)] sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                Admin View
              </p>
              <h2 className="mt-1 text-lg font-bold tracking-tight text-zinc-900 sm:text-xl">
                Unified Activity Logs
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                Issue reports and asset returns combined in one timeline.
              </p>
            </div>
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search employee, asset, status..."
              className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 sm:w-80"
            />
          </div>
        </section>

        <section className="rounded-[20px] border border-zinc-200/80 bg-white p-3.5 shadow-[0_10px_30px_rgba(0,0,0,0.06)] sm:p-4">
          <div className="mb-2.5 flex items-center justify-between">
            <h3 className="text-base font-semibold text-zinc-900">All Logs</h3>
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
              {filteredLogs.length}
            </span>
          </div>

          <div className="space-y-2.5">
            {filteredLogs.length === 0 ? (
              <div className="rounded-[18px] bg-zinc-50 p-4 text-sm text-zinc-600">
                No logs found.
              </div>
            ) : (
              filteredLogs.map((log) => {
                const isOpen = openLogId === log.id;
                return (
                  <div key={log.id} className="rounded-[14px] border border-zinc-200/80 bg-zinc-50/70">
                    <button
                      type="button"
                      onClick={() => setOpenLogId((current) => (current === log.id ? null : log.id))}
                      className="w-full p-3 text-left transition hover:bg-zinc-100/70"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-zinc-900">{log.title}</p>
                        <div className="flex items-center gap-2">
                          <Badge tone={log.kind === "issue" ? "blue" : "amber"}>
                            {log.kind === "issue" ? "Issue" : "Return"}
                          </Badge>
                          <Badge tone={statusTone(log.status)}>{labelize(log.status)}</Badge>
                          {log.approvalStatus ? (
                            <Badge tone={approvalTone(log.approvalStatus)}>
                              {labelize(log.approvalStatus)}
                            </Badge>
                          ) : null}
                          <span className="text-xs text-zinc-500">{isOpen ? "Hide" : "Details"}</span>
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-zinc-700 sm:text-sm">{log.subtitle}</p>
                      <p className="mt-1 text-xs text-zinc-500">
                        Latest activity: {formatDate(log.timestamp)}
                      </p>
                    </button>

                    <div
                      className={`grid border-t border-zinc-200/80 transition-[grid-template-rows,opacity] duration-300 ease-out ${
                        isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                      }`}
                    >
                      <div className="overflow-hidden">
                        {log.kind === "issue" ? (
                          <IssueDetails details={log.details} />
                        ) : (
                          <ReturnDetails details={log.details} />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function IssueDetails({ details }) {
  return (
    <div className="px-3 pb-3 pt-2">
      <div className="grid grid-cols-1 gap-1 text-xs text-zinc-600 sm:grid-cols-2">
        <p>Submitted: {formatDate(details.submitted)}</p>
        <p>Sent for approval: {formatDate(details.sentForApproval)}</p>
        <p>Approved at: {formatDate(details.approvedAt)}</p>
        <p>Approved by: {details.approvedBy || "-"}</p>
      </div>
      <div className="mt-2 rounded-xl bg-white p-2.5 text-xs text-zinc-700">
        <p>
          <span className="font-semibold">Technical assessment:</span>{" "}
          {details.technicalAssessment || "Not provided"}
        </p>
        <p className="mt-1">
          <span className="font-semibold">Approver notes:</span>{" "}
          {details.approverNotes || "Not provided"}
        </p>
        <p className="mt-1">
          <span className="font-semibold">Repairability:</span>{" "}
          {labelize(details.repairability || "unknown")} |{" "}
          <span className="font-semibold">Replacement required:</span>{" "}
          {details.replacementRequired ? "Yes" : "No"}
        </p>
      </div>
    </div>
  );
}

function ReturnDetails({ details }) {
  return (
    <div className="px-3 pb-3 pt-2">
      <div className="grid grid-cols-1 gap-1 text-xs text-zinc-600 sm:grid-cols-2">
        <p>Requested: {formatDate(details.requestedAt)}</p>
        <p>Confirmed: {formatDate(details.confirmedAt)}</p>
        <p>Confirmed by: {details.confirmedBy || "-"}</p>
        <p>Employee: {details.employeeEmail || "-"}</p>
        <p>Serial number: {details.serialNumber || "-"}</p>
      </div>
      <div className="mt-2 rounded-xl bg-white p-2.5 text-xs text-zinc-700">
        <span className="font-semibold">Notes:</span> {details.notes || "Not provided"}
      </div>
    </div>
  );
}

function Badge({ children, tone = "zinc" }) {
  const styles = {
    zinc: "bg-zinc-100 text-zinc-700 ring-zinc-200",
    blue: "bg-blue-50 text-blue-700 ring-blue-200",
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    red: "bg-red-50 text-red-700 ring-red-200",
    violet: "bg-violet-50 text-violet-700 ring-violet-200",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${
        styles[tone] || styles.zinc
      }`}
    >
      {children}
    </span>
  );
}

function statusTone(status) {
  if (status === "resolved" || status === "confirmed") return "green";
  if (status === "in_progress") return "blue";
  if (status === "submitted" || status === "pending") return "amber";
  if (status === "rejected") return "red";
  return "zinc";
}

function approvalTone(status) {
  if (status === "approved") return "green";
  if (status === "pending") return "violet";
  if (status === "rejected") return "red";
  return "zinc";
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function labelize(value) {
  return value ? value.replaceAll("_", " ") : "-";
}
