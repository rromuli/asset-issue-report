import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const STATUS_OPTIONS = ["submitted", "in_progress", "resolved"];
const REPAIRABILITY_OPTIONS = ["unknown", "repairable", "not_repairable"];

const STATUS_STYLES = {
  submitted: "bg-amber-50 text-amber-700 ring-amber-200",
  in_progress: "bg-blue-50 text-blue-700 ring-blue-200",
  resolved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

const SEVERITY_STYLES = {
  Low: "bg-zinc-100 text-zinc-700 ring-zinc-200",
  Medium: "bg-amber-50 text-amber-700 ring-amber-200",
  High: "bg-orange-50 text-orange-700 ring-orange-200",
};

const APPROVAL_STYLES = {
  not_requested: "bg-zinc-100 text-zinc-700 ring-zinc-200",
  pending: "bg-violet-50 text-violet-700 ring-violet-200",
  approved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  rejected: "bg-red-50 text-red-700 ring-red-200",
};

export default function AdminDashboard({ session, adminRole, progressOnly = false }) {
  const [reports, setReports] = useState([]);
  const [returnRequests, setReturnRequests] = useState([]);
  const [attachmentCounts, setAttachmentCounts] = useState({});
  const [selectedReport, setSelectedReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [approvalFilter, setApprovalFilter] = useState("all");
  const [quickFilter, setQuickFilter] = useState("all");
  const [updatingId, setUpdatingId] = useState(null);
  const [technicalAssessmentDraft, setTechnicalAssessmentDraft] = useState("");
  const [repairabilityDraft, setRepairabilityDraft] = useState("unknown");
  const [approverNotesDraft, setApproverNotesDraft] = useState("");
  const [procurementQuery, setProcurementQuery] = useState("");
  const [confirmAction, setConfirmAction] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    fetchReports();
  }, []);

  useEffect(() => {
    setTechnicalAssessmentDraft(selectedReport?.technical_assessment || "");
    setRepairabilityDraft(selectedReport?.repairability_status || "unknown");
    setApproverNotesDraft(selectedReport?.approver_notes || "");
    setProcurementQuery(
      [selectedReport?.make_model, selectedReport?.asset_type].filter(Boolean).join(" ")
    );
  }, [selectedReport]);

  async function fetchReports() {
    setLoading(true);
    setError("");

    const [
      { data, error },
      { data: attachmentRows, error: attachmentError },
      { data: returnRows, error: returnError },
    ] =
      await Promise.all([
        supabase
          .from("asset_issue_reports")
          .select(
            "id, full_name, employee_id, department, asset_type, serial_number, asset_tag, make_model, operating_system, issue_category, severity, description, status, approval_status, technical_assessment, approver_notes, repairability_status, replacement_required, sent_for_approval_at, approved_at, approved_by, created_at"
          )
          .order("created_at", { ascending: false }),
        supabase.from("asset_issue_attachments").select("report_id"),
        supabase
          .from("asset_return_requests")
          .select(
            "id, asset_id, employee_email, employee_name, asset_name, asset_type, asset_tag, serial_number, status, requested_at, confirmed_at, confirmed_by, notes"
          )
          .order("requested_at", { ascending: false }),
      ]);

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setReports(data || []);
    if (!attachmentError && attachmentRows) {
      const counts = attachmentRows.reduce((acc, row) => {
        acc[row.report_id] = (acc[row.report_id] || 0) + 1;
        return acc;
      }, {});
      setAttachmentCounts(counts);
    }
    if (returnError) {
      // Keep dashboard working even if this table isn't migrated in one environment yet.
      console.error("asset_return_requests load error:", returnError.message);
      setReturnRequests([]);
    } else {
      setReturnRequests(returnRows || []);
    }
    setLoading(false);
  }

  function showToast(message, tone = "info") {
    setToast({ message, tone });
    window.setTimeout(() => {
      setToast((current) => (current?.message === message ? null : current));
    }, 2600);
  }

  function syncUpdatedReport(updatedFields, reportId) {
    setReports((current) =>
      current.map((report) =>
        report.id === reportId ? { ...report, ...updatedFields } : report
      )
    );

    setSelectedReport((current) =>
      current?.id === reportId ? { ...current, ...updatedFields } : current
    );
  }

  async function updateStatus(reportId, newStatus) {
    if (adminRole !== "it") return;

    setUpdatingId(reportId);

    const { error } = await supabase
      .from("asset_issue_reports")
      .update({ status: newStatus })
      .eq("id", reportId);

    if (error) {
      showToast("Status update failed: " + error.message, "error");
      setUpdatingId(null);
      return;
    }

    syncUpdatedReport({ status: newStatus }, reportId);
    showToast("Status updated.", "success");
    setUpdatingId(null);
  }

  async function saveTechnicalReview() {
    if (!selectedReport || adminRole !== "it") return;

    setUpdatingId(selectedReport.id);

    const payload = {
      technical_assessment: technicalAssessmentDraft || null,
      repairability_status: repairabilityDraft,
      replacement_required: repairabilityDraft === "not_repairable",
    };

    const { error } = await supabase
      .from("asset_issue_reports")
      .update(payload)
      .eq("id", selectedReport.id);

    if (error) {
      showToast("Could not save technical review: " + error.message, "error");
      setUpdatingId(null);
      return;
    }

    syncUpdatedReport(payload, selectedReport.id);
    setUpdatingId(null);
    showToast("Technical review saved.", "success");
  }

  async function sendForApproval() {
  if (!selectedReport || adminRole !== "it") return;

  if (!technicalAssessmentDraft.trim()) {
    showToast("Please add the technical assessment before sending for approval.", "warning");
    return;
  }

  if (repairabilityDraft !== "not_repairable") {
    showToast("Set repairability status to not repairable before sending for approval.", "warning");
    return;
  }

  setUpdatingId(selectedReport.id);

  const payload = {
    technical_assessment: technicalAssessmentDraft,
    repairability_status: "not_repairable",
    replacement_required: true,
    approval_status: "pending",
    sent_for_approval_at: new Date().toISOString(),
    status: "in_progress",
  };

  const { error } = await supabase
    .from("asset_issue_reports")
    .update(payload)
    .eq("id", selectedReport.id);

  if (error) {
    showToast("Could not send for approval: " + error.message, "error");
    setUpdatingId(null);
    return;
  }

  const { error: approvalEmailError } = await supabase.functions.invoke(
    "send-approval-email",
    {
      body: {
        report_id: selectedReport.id,
        full_name: selectedReport.full_name,
        employee_id: selectedReport.employee_id,
        department: selectedReport.department,
        asset_type: selectedReport.asset_type,
        issue_category: selectedReport.issue_category,
        severity: selectedReport.severity,
        technical_assessment: technicalAssessmentDraft,
      },
    }
  );

  if (approvalEmailError) {
    console.error("Approval email error:", approvalEmailError.message);
  }

  syncUpdatedReport(payload, selectedReport.id);
  setUpdatingId(null);
  showToast("Report sent to approver.", "success");
}

  async function submitApprovalDecision(decision) {
  if (!selectedReport || adminRole !== "approver") return;

  setUpdatingId(selectedReport.id);

  const payload = {
    approval_status: decision,
    approver_notes: approverNotesDraft || null,
    approved_by: session?.user?.email || null,
    approved_at: new Date().toISOString(),
    status: decision === "approved" ? "resolved" : "in_progress",
  };

  const { error } = await supabase
    .from("asset_issue_reports")
    .update(payload)
    .eq("id", selectedReport.id);

  if (error) {
    showToast("Could not update approval: " + error.message, "error");
    setUpdatingId(null);
    return;
  }

  const { error: resultEmailError } = await supabase.functions.invoke(
    "send-approval-result-email",
    {
      body: {
        report_id: selectedReport.id,
        full_name: selectedReport.full_name,
        employee_id: selectedReport.employee_id,
        department: selectedReport.department,
        asset_type: selectedReport.asset_type,
        severity: selectedReport.severity,
        approval_status: decision,
        approver_notes: approverNotesDraft || null,
        approved_by: session?.user?.email || null,
      },
    }
  );

  if (resultEmailError) {
    console.error("Approval result email error:", resultEmailError.message);
  }

  syncUpdatedReport(payload, selectedReport.id);
  setUpdatingId(null);
  showToast(`Request ${decision}.`, "success");
}

  async function viewAttachments(reportId) {
    const { data, error } = await supabase
      .from("asset_issue_attachments")
      .select("*")
      .eq("report_id", reportId);

    if (error) {
      showToast("Error loading attachments: " + error.message, "error");
      return;
    }

    if (!data || data.length === 0) {
      showToast("No attachments for this report.", "info");
      return;
    }

    for (const file of data) {
      const { data: urlData, error: urlError } = await supabase.storage
        .from("attachments")
        .createSignedUrl(file.file_path, 60);

      if (urlError) {
        showToast("Could not open attachment: " + urlError.message, "error");
        continue;
      }

      if (urlData?.signedUrl) {
        window.open(urlData.signedUrl, "_blank");
      }
    }
  }

  function askConfirmation(action) {
    setConfirmAction(action);
  }

  function closeConfirmation() {
    setConfirmAction(null);
  }

  async function runConfirmedAction() {
    if (!confirmAction) return;

    if (confirmAction.type === "send_for_approval") {
      await sendForApproval();
    }

    if (confirmAction.type === "approve") {
      await submitApprovalDecision("approved");
    }

    if (confirmAction.type === "reject") {
      await submitApprovalDecision("rejected");
    }

    closeConfirmation();
  }

  const roleScopedReports = useMemo(() => {
    if (adminRole === "approver") {
      return reports.filter(
        (report) => (report.approval_status || "not_requested") === "pending"
      );
    }
    if (adminRole === "hr") {
      return reports;
    }
    if (progressOnly) {
      return reports.filter((report) => (report.status || "submitted") !== "resolved");
    }
    return reports;
  }, [reports, adminRole, progressOnly]);

  const filteredReports = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return roleScopedReports.filter((report) => {
      const matchesSearch =
        !term ||
        (report.full_name || "").toLowerCase().includes(term) ||
        (report.employee_id || "").toLowerCase().includes(term) ||
        (report.department || "").toLowerCase().includes(term) ||
        (report.asset_type || "").toLowerCase().includes(term) ||
        (report.issue_category || "").toLowerCase().includes(term);

      const matchesStatus =
        statusFilter === "all" || (report.status || "submitted") === statusFilter;

      const matchesSeverity =
        severityFilter === "all" || report.severity === severityFilter;

      const matchesApproval =
        approvalFilter === "all" ||
        (report.approval_status || "not_requested") === approvalFilter;

      const matchesQuickFilter =
        quickFilter === "all" ||
        (quickFilter === "high_severity" && report.severity === "High") ||
        (quickFilter === "pending_approval" &&
          (report.approval_status || "not_requested") === "pending") ||
        (quickFilter === "no_attachments" && !attachmentCounts[report.id]) ||
        (quickFilter === "my_queue" &&
          (adminRole === "approver"
            ? (report.approval_status || "not_requested") === "pending"
            : ["submitted", "in_progress"].includes(report.status || "submitted")));

      return (
        matchesSearch &&
        matchesStatus &&
        matchesSeverity &&
        matchesApproval &&
        matchesQuickFilter
      );
    });
  }, [
    roleScopedReports,
    searchTerm,
    statusFilter,
    severityFilter,
    approvalFilter,
    quickFilter,
    attachmentCounts,
    adminRole,
  ]);

  const metrics = useMemo(() => {
    const total = roleScopedReports.length;
    const submitted = roleScopedReports.filter(
      (r) => (r.status || "submitted") === "submitted"
    ).length;
    const inProgress = roleScopedReports.filter((r) => r.status === "in_progress").length;
    const pendingApproval = roleScopedReports.filter(
      (r) => (r.approval_status || "not_requested") === "pending"
    ).length;

    return { total, submitted, inProgress, pendingApproval };
  }, [roleScopedReports]);

  if (loading) {
    return (
      <div className="min-h-[70vh] bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.08),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.06),_transparent_22%),#f6f7fb] p-4 sm:p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="h-36 animate-pulse rounded-[32px] border border-zinc-200/80 bg-white" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="h-24 animate-pulse rounded-[28px] border border-zinc-200/80 bg-white" />
            ))}
          </div>
          <div className="h-[420px] animate-pulse rounded-[32px] border border-zinc-200/80 bg-white" />
        </div>
      </div>
    );
  }

  function openGjirafaSearch() {
    const query = procurementQuery.trim();
    if (!query) {
      showToast("Please enter what HR should search for.", "warning");
      return;
    }

    const slug = encodeURIComponent(query);
    const searchUrl = `https://gjirafa50.com/search?q=${slug}`;
    window.open(searchUrl, "_blank");
  }

  async function confirmReturnRequest(request) {
    if (adminRole !== "hr") return;

    const payload = {
      status: "confirmed",
      confirmed_at: new Date().toISOString(),
      confirmed_by: session?.user?.email || null,
    };

    const { error } = await supabase
      .from("asset_return_requests")
      .update(payload)
      .eq("id", request.id);

    if (error) {
      showToast("Could not confirm return: " + error.message, "error");
      return;
    }

    if (request.asset_id) {
      const { error: deleteError } = await supabase
        .from("employee_assets")
        .delete()
        .eq("id", request.asset_id);

      if (deleteError) {
        showToast(
          "Return confirmed, but asset removal failed: " + deleteError.message,
          "warning"
        );
      }
    }

    setReturnRequests((current) =>
      current.map((row) => (row.id === request.id ? { ...row, ...payload } : row))
    );
    showToast("Asset return confirmed by HR.", "success");
  }

  if (error) {
    return (
      <div className="min-h-[70vh] bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.08),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.06),_transparent_22%),#f6f7fb] p-6">
        <div className="mx-auto max-w-3xl rounded-[32px] border border-red-200 bg-red-50 p-6 text-red-700 shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
          <h2 className="font-semibold">Dashboard error</h2>
          <p className="mt-2 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.08),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.06),_transparent_22%),#f6f7fb] p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-4 sm:space-y-6">
        <section className="rounded-[28px] border border-zinc-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(0,0,0,0.06)] sm:rounded-[32px] sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                Internal IT Operations
              </p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 sm:text-5xl">
                Asset Issue Dashboard
              </h1>
              <div className="mt-4 flex flex-wrap gap-3">
                <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold uppercase text-zinc-700">
                  Role: {adminRole || "unknown"}
                </span>
                {adminRole === "it" && (
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase text-blue-700">
                    Technical review access
                  </span>
                )}
                {adminRole === "approver" && (
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase text-emerald-700">
                    Replacement approval access
                  </span>
                )}
                {adminRole === "hr" && (
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold uppercase text-amber-700">
                    HR read access
                  </span>
                )}
              </div>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-600 sm:text-base">
                {adminRole === "approver"
                  ? "Review technical conclusions from IT and approve or reject replacement requests for non-repairable assets."
                  : adminRole === "hr"
                  ? "Track employee asset issues, status, and approved replacements with a read-only operational view."
                  : "Review submissions, perform technical assessment, and escalate non-repairable assets for replacement approval."}
              </p>
            </div>

            <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 xl:w-auto xl:grid-cols-4">
              <FilterSelect
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: "all", label: "All statuses" },
                  { value: "submitted", label: "Submitted" },
                  { value: "in_progress", label: "In progress" },
                  { value: "resolved", label: "Resolved" },
                ]}
              />
              <FilterSelect
                value={severityFilter}
                onChange={setSeverityFilter}
                options={[
                  { value: "all", label: "All severities" },
                  { value: "Low", label: "Low" },
                  { value: "Medium", label: "Medium" },
                  { value: "High", label: "High" },
                ]}
              />
              <FilterSelect
                value={approvalFilter}
                onChange={setApprovalFilter}
                options={[
                  { value: "all", label: "All approvals" },
                  { value: "not_requested", label: "Not requested" },
                  { value: "pending", label: "Pending" },
                  { value: "approved", label: "Approved" },
                  { value: "rejected", label: "Rejected" },
                ]}
              />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search employee, department, asset..."
                className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 sm:col-span-2 xl:col-span-1"
              />
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Visible reports" value={metrics.total} tone="zinc" />
          <MetricCard label="New submissions" value={metrics.submitted} tone="amber" />
          <MetricCard label="In progress" value={metrics.inProgress} tone="blue" />
          <MetricCard label="Pending approval" value={metrics.pendingApproval} tone="violet" />
        </section>

        {adminRole === "hr" ? (
          <section className="overflow-hidden rounded-[28px] border border-zinc-200/80 bg-white shadow-[0_10px_30px_rgba(0,0,0,0.06)] sm:rounded-[32px]">
            <div className="border-b border-zinc-200/70 px-4 py-4 sm:px-6 sm:py-5">
              <h2 className="text-lg font-semibold text-zinc-900">
                Asset Return Confirmation Queue
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                Confirm employees who marked assets as returned.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[720px] text-sm">
                <thead className="bg-zinc-50/80 text-left text-zinc-500">
                  <tr>
                    <th className="px-4 py-3.5 font-semibold sm:px-6 sm:py-4">Employee</th>
                    <th className="px-4 py-3.5 font-semibold sm:px-6 sm:py-4">Asset</th>
                    <th className="px-4 py-3.5 font-semibold sm:px-6 sm:py-4">Requested</th>
                    <th className="px-4 py-3.5 font-semibold sm:px-6 sm:py-4">Status</th>
                    <th className="px-4 py-3.5 font-semibold sm:px-6 sm:py-4">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {returnRequests.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-zinc-500 sm:px-6">
                        No asset return requests yet.
                      </td>
                    </tr>
                  ) : (
                    returnRequests.map((request) => (
                      <tr key={request.id} className="border-t border-zinc-200/70">
                        <td className="px-4 py-3.5 sm:px-6 sm:py-4">
                          <div className="font-semibold text-zinc-900">
                            {request.employee_name || request.employee_email}
                          </div>
                          <div className="mt-1 text-xs text-zinc-500">{request.employee_email}</div>
                        </td>
                        <td className="px-4 py-3.5 text-zinc-700 sm:px-6 sm:py-4">
                          <div className="font-medium text-zinc-900">{request.asset_name}</div>
                          <div className="mt-1 text-xs text-zinc-500">
                            {request.asset_type || "-"} | Tag: {request.asset_tag || "-"} | SN:{" "}
                            {request.serial_number || "-"}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-zinc-700 sm:px-6 sm:py-4">
                          {request.requested_at ? formatDateTime(request.requested_at) : "-"}
                        </td>
                        <td className="px-4 py-3.5 sm:px-6 sm:py-4">
                          <Badge
                            className={
                              request.status === "confirmed"
                                ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                                : "bg-amber-50 text-amber-700 ring-amber-200"
                            }
                          >
                            {labelize(request.status || "pending")}
                          </Badge>
                        </td>
                        <td className="px-4 py-3.5 sm:px-6 sm:py-4">
                          {request.status === "confirmed" ? (
                            <span className="text-xs text-zinc-500">
                              Confirmed {request.confirmed_at ? formatDateTime(request.confirmed_at) : ""}
                            </span>
                          ) : (
                            <button
                              onClick={() => confirmReturnRequest(request)}
                              className="w-full rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-emerald-700 sm:w-auto"
                            >
                              Confirm Return
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        <section>
          <div className="overflow-hidden rounded-[28px] border border-zinc-200/80 bg-white shadow-[0_10px_30px_rgba(0,0,0,0.06)] sm:rounded-[32px]">
            <div className="flex flex-col gap-3 border-b border-zinc-200/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">Workflow queue</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  {filteredReports.length} visible report{filteredReports.length === 1 ? "" : "s"}
                </p>
              </div>
              <button
                onClick={fetchReports}
                className="w-full rounded-2xl border border-zinc-300 bg-white px-5 py-3 text-sm font-medium text-zinc-700 transition hover:-translate-y-0.5 hover:bg-zinc-50 sm:w-auto"
              >
                Refresh
              </button>
            </div>
            <div className="overflow-x-auto border-b border-zinc-200/70 px-4 py-4 sm:px-6">
              <div className="flex min-w-max gap-2">
              <QuickChip
                label="All"
                active={quickFilter === "all"}
                onClick={() => setQuickFilter("all")}
              />
              <QuickChip
                label="High Severity"
                active={quickFilter === "high_severity"}
                onClick={() => setQuickFilter("high_severity")}
              />
              <QuickChip
                label="Pending Approval"
                active={quickFilter === "pending_approval"}
                onClick={() => setQuickFilter("pending_approval")}
              />
              <QuickChip
                label="No Attachments"
                active={quickFilter === "no_attachments"}
                onClick={() => setQuickFilter("no_attachments")}
              />
              <QuickChip
                label="My Queue"
                active={quickFilter === "my_queue"}
                onClick={() => setQuickFilter("my_queue")}
              />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[740px] text-sm">
                <thead className="bg-zinc-50/80 text-left text-zinc-500">
                  <tr>
                    <th className="px-4 py-3.5 font-semibold sm:px-6 sm:py-4">Employee</th>
                    <th className="px-4 py-3.5 font-semibold sm:px-6 sm:py-4">Asset</th>
                    <th className="px-4 py-3.5 font-semibold sm:px-6 sm:py-4">Severity</th>
                    <th className="px-4 py-3.5 font-semibold sm:px-6 sm:py-4">Approval</th>
                    <th className="px-4 py-3.5 font-semibold sm:px-6 sm:py-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReports.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-14 text-center text-zinc-500 sm:px-6">
                        No reports match your current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredReports.map((report) => (
                      <tr
                        key={report.id}
                        className={`border-t border-zinc-200/70 align-top transition hover:bg-white ${
                          (report.approval_status || "not_requested") === "pending"
                            ? "bg-violet-50/40"
                            : ""
                        }`}
                      >
                        <td className="px-4 py-3.5 sm:px-6 sm:py-4">
                          <div className="font-semibold text-zinc-900">{report.full_name}</div>
                          <div className="mt-1 text-xs text-zinc-500">
                            {report.employee_id} - {report.department}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 sm:px-6 sm:py-4">
                          <div className="font-medium text-zinc-800">{report.asset_type}</div>
                          <div className="mt-1 text-xs text-zinc-500">
                            {report.issue_category}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 sm:px-6 sm:py-4">
                          <Badge className={SEVERITY_STYLES[report.severity] || SEVERITY_STYLES.Low}>
                            {report.severity}
                          </Badge>
                        </td>
                        <td className="px-4 py-3.5 sm:px-6 sm:py-4">
                          <div className="flex flex-col gap-2">
                            <Badge className={STATUS_STYLES[report.status || "submitted"] || STATUS_STYLES.submitted}>
                              {labelize(report.status || "submitted")}
                            </Badge>
                            <Badge
                              className={
                                APPROVAL_STYLES[report.approval_status || "not_requested"] ||
                                APPROVAL_STYLES.not_requested
                              }
                            >
                              {labelize(report.approval_status || "not_requested")}
                            </Badge>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 sm:px-6 sm:py-4">
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => setSelectedReport(report)}
                              className="rounded-2xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:-translate-y-0.5 hover:bg-zinc-50"
                            >
                              Details
                            </button>
                            <button
                              onClick={() => viewAttachments(report.id)}
                              className="rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-blue-700"
                            >
                              Files
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {selectedReport ? (
          <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-4 backdrop-blur-sm sm:items-center sm:py-8">
            <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[32px] border border-zinc-200/80 bg-white shadow-[0_20px_50px_rgba(0,0,0,0.18)]">
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200/70 bg-white/95 px-4 py-4 backdrop-blur-sm sm:px-6 sm:py-5">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900">Report details</h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Report #{selectedReport.id} - {selectedReport.employee_id}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedReport(null)}
                  className="rounded-2xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
                >
                  Close
                </button>
              </div>

              <div className="space-y-6 px-4 py-4 sm:px-6 sm:py-6">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-bold text-zinc-900">{selectedReport.full_name}</h3>
                    <Badge
                      className={
                        STATUS_STYLES[selectedReport.status || "submitted"] ||
                        STATUS_STYLES.submitted
                      }
                    >
                      {labelize(selectedReport.status || "submitted")}
                    </Badge>
                    <Badge
                      className={
                        APPROVAL_STYLES[selectedReport.approval_status || "not_requested"] ||
                        APPROVAL_STYLES.not_requested
                      }
                    >
                      {labelize(selectedReport.approval_status || "not_requested")}
                    </Badge>
                  </div>
                </div>

                <DetailGroup
                  items={[
                    ["Department", selectedReport.department],
                    ["Asset type", selectedReport.asset_type],
                    ["Serial number", selectedReport.serial_number],
                    ["Asset tag", selectedReport.asset_tag],
                    ["Make / Model", selectedReport.make_model],
                    ["Operating system", selectedReport.operating_system],
                    ["Issue category", selectedReport.issue_category],
                    ["Severity", selectedReport.severity],
                    ["Repairability", selectedReport.repairability_status || "unknown"],
                    ["Replacement required", selectedReport.replacement_required ? "Yes" : "No"],
                    ["Approval status", selectedReport.approval_status || "not_requested"],
                  ]}
                />
                <TimelinePanel report={selectedReport} />

                <TextPanel title="Description" text={selectedReport.description} />
                <TextPanel
                  title="Technical assessment"
                  text={
                    selectedReport.technical_assessment ||
                    "No technical assessment recorded yet."
                  }
                />
                <TextPanel
                  title="Approver notes"
                  text={selectedReport.approver_notes || "No approver notes recorded yet."}
                />

                {adminRole === "it" ? (
                  <div className="rounded-[28px] border border-blue-200 bg-blue-50/80 p-5 shadow-[0_6px_18px_rgba(0,0,0,0.04)]">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-700">
                      IT workflow controls
                    </p>
                    <div className="mt-4 space-y-4">
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-zinc-900">
                          Status
                        </label>
                        <select
                          value={selectedReport.status || "submitted"}
                          onChange={(e) => updateStatus(selectedReport.id, e.target.value)}
                          className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                        >
                          {STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                              {labelize(status)}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-semibold text-zinc-900">
                          Repairability status
                        </label>
                        <select
                          value={repairabilityDraft}
                          onChange={(e) => setRepairabilityDraft(e.target.value)}
                          className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                        >
                          {REPAIRABILITY_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {labelize(option)}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-semibold text-zinc-900">
                          Technical assessment
                        </label>
                        <textarea
                          rows={5}
                          value={technicalAssessmentDraft}
                          onChange={(e) => setTechnicalAssessmentDraft(e.target.value)}
                          placeholder="Document the condition of the asset, findings from diagnostics, and whether repair is possible."
                          className="w-full rounded-[24px] border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                        />
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <button
                          onClick={saveTechnicalReview}
                          disabled={updatingId === selectedReport.id}
                          className="rounded-2xl border border-zinc-300 bg-white px-5 py-3 text-sm font-medium text-zinc-700 transition hover:-translate-y-0.5 hover:bg-zinc-50 disabled:opacity-60"
                        >
                          Save technical review
                        </button>
                        <button
                          onClick={() =>
                            askConfirmation({
                              type: "send_for_approval",
                              title: "Send for approval?",
                              message:
                                "This will forward the report for replacement approval and mark the request as pending.",
                              confirmLabel: "Send request",
                              tone: "blue",
                            })
                          }
                          disabled={updatingId === selectedReport.id}
                          className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-700 disabled:opacity-60"
                        >
                          Send for approval
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {adminRole === "approver" ? (
                  <div className="rounded-[28px] border border-emerald-200 bg-emerald-50/80 p-5 shadow-[0_6px_18px_rgba(0,0,0,0.04)]">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">
                      Approver decision panel
                    </p>
                    <div className="mt-4 space-y-4">
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-zinc-900">
                          Approver notes
                        </label>
                        <textarea
                          rows={5}
                          value={approverNotesDraft}
                          onChange={(e) => setApproverNotesDraft(e.target.value)}
                          placeholder="Add your approval comments, replacement rationale, or rejection reason."
                          className="w-full rounded-[24px] border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                        />
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <button
                          onClick={() =>
                            askConfirmation({
                              type: "approve",
                              title: "Approve replacement?",
                              message:
                                "This will approve the replacement request and mark the approval workflow as completed.",
                              confirmLabel: "Approve",
                              tone: "green",
                            })
                          }
                          disabled={updatingId === selectedReport.id}
                          className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-emerald-700 disabled:opacity-60"
                        >
                          Approve replacement
                        </button>
                        <button
                          onClick={() =>
                            askConfirmation({
                              type: "reject",
                              title: "Reject request?",
                              message:
                                "This will reject the replacement request. Make sure your approver notes clearly explain the reason.",
                              confirmLabel: "Reject",
                              tone: "red",
                            })
                          }
                          disabled={updatingId === selectedReport.id}
                          className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-red-700 disabled:opacity-60"
                        >
                          Reject request
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {adminRole === "hr" ? (
                  <div className="space-y-4">
                    <div className="rounded-[28px] border border-amber-200 bg-amber-50/80 p-5 text-sm leading-7 text-amber-800 shadow-[0_6px_18px_rgba(0,0,0,0.04)]">
                      HR has read-only access in this workflow. This view is intended for
                      tracking employee impact, approved replacements, and operational
                      follow-up.
                    </div>

                    <div className="rounded-[28px] border border-blue-200 bg-blue-50/80 p-5 shadow-[0_6px_18px_rgba(0,0,0,0.04)]">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-700">
                        Procurement Search
                      </p>
                      <p className="mt-2 text-sm text-blue-900">
                        Search Gjirafa50 for replacement options.
                      </p>
                      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                        <input
                          value={procurementQuery}
                          onChange={(e) => setProcurementQuery(e.target.value)}
                          placeholder="e.g. Dell Latitude 5440, Lenovo ThinkPad..."
                          className="w-full rounded-2xl border border-blue-200 bg-white px-4 py-3 text-sm text-zinc-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                        />
                        <button
                          type="button"
                          onClick={openGjirafaSearch}
                          className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-blue-700"
                        >
                          Search Gjirafa50
                        </button>
                      </div>
                      {(selectedReport.approval_status || "not_requested") !== "approved" ? (
                        <p className="mt-2 text-xs text-blue-800/80">
                          Tip: use this after the request is approved.
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => viewAttachments(selectedReport.id)}
                    className="w-full rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-700 sm:w-auto"
                  >
                    Open attachments
                  </button>
                  <button
                    onClick={() => setSelectedReport(null)}
                    className="w-full rounded-2xl border border-zinc-300 bg-white px-5 py-3 text-sm font-medium text-zinc-700 transition hover:-translate-y-0.5 hover:bg-zinc-50 sm:w-auto"
                  >
                    Close details
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {confirmAction ? (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-6 backdrop-blur-sm sm:items-center sm:py-8">
            <div className="w-full max-w-md rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_20px_50px_rgba(0,0,0,0.18)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                Confirmation
              </p>
              <h3 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900">
                {confirmAction.title}
              </h3>
              <p className="mt-3 text-sm leading-7 text-zinc-600">
                {confirmAction.message}
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  onClick={closeConfirmation}
                  className="rounded-2xl border border-zinc-300 bg-white px-5 py-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
                >
                  Cancel
                </button>

                <button
                  onClick={runConfirmedAction}
                  className={`rounded-2xl px-5 py-3 text-sm font-semibold text-white transition ${
                    confirmAction.tone === "red"
                      ? "bg-red-600 hover:bg-red-700"
                      : confirmAction.tone === "green"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  {confirmAction.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {toast ? <Toast tone={toast.tone} message={toast.message} /> : null}
      </div>
    </div>
  );
}

function QuickChip({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? "bg-zinc-900 text-white"
          : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
      }`}
    >
      {label}
    </button>
  );
}

function MetricCard({ label, value, tone = "zinc" }) {
  const toneMap = {
    zinc: "bg-zinc-100 text-zinc-700",
    amber: "bg-amber-100 text-amber-700",
    blue: "bg-blue-100 text-blue-700",
    red: "bg-red-100 text-red-700",
    violet: "bg-violet-100 text-violet-700",
  };

  return (
    <div className="rounded-[28px] border border-zinc-200/80 bg-white p-5 shadow-[0_6px_18px_rgba(0,0,0,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-zinc-500">{label}</p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-zinc-900">{value}</p>
        </div>
        <div className={`rounded-2xl px-3 py-2 text-sm font-semibold ${toneMap[tone]}`}>
          {value}
        </div>
      </div>
    </div>
  );
}

function FilterSelect({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function Badge({ className = "", children }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${className}`}>
      {children}
    </span>
  );
}

function DetailGroup({ items }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-[24px] bg-zinc-50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            {label}
          </p>
          <p className="mt-2 text-sm font-medium text-zinc-900">{value || "-"}</p>
        </div>
      ))}
    </div>
  );
}

function TextPanel({ title, text }) {
  return (
    <div className="rounded-[24px] border border-zinc-200/80 bg-white p-4 shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
        {title}
      </p>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-zinc-700">{text}</p>
    </div>
  );
}

function TimelinePanel({ report }) {
  const stages = [
    {
      label: "Submitted",
      done: true,
      active: (report.status || "submitted") === "submitted",
      at: report.created_at,
    },
    {
      label: "In Progress",
      done: ["in_progress", "resolved"].includes(report.status || "submitted"),
      active: (report.status || "submitted") === "in_progress",
      at: report.status === "in_progress" ? report.sent_for_approval_at || report.created_at : null,
    },
    {
      label: "Pending Approval",
      done: ["pending", "approved", "rejected"].includes(
        report.approval_status || "not_requested"
      ),
      active: (report.approval_status || "not_requested") === "pending",
      at: report.sent_for_approval_at,
    },
    {
      label: "Resolved",
      done:
        report.status === "resolved" ||
        (report.approval_status || "not_requested") === "approved",
      active: report.status === "resolved",
      at: report.approved_at || (report.status === "resolved" ? report.sent_for_approval_at || report.created_at : null),
    },
  ];

  return (
    <div className="rounded-[24px] border border-zinc-200/80 bg-white p-4 shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
        Workflow Timeline
      </p>
      <div className="mt-4 space-y-3">
        {stages.map((stage) => (
          <div key={stage.label} className="flex items-start gap-3">
            <span
              className={`mt-0.5 h-2.5 w-2.5 rounded-full ${
                stage.done ? "bg-emerald-500" : stage.active ? "bg-blue-500" : "bg-zinc-300"
              }`}
            />
            <div>
              <p className="text-sm font-semibold text-zinc-900">{stage.label}</p>
              <p className="text-xs text-zinc-500">
                {stage.at ? formatDateTime(stage.at) : stage.done ? "Completed" : "Pending"}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Toast({ tone = "info", message }) {
  const toneMap = {
    info: "border-blue-200 bg-blue-50 text-blue-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    error: "border-red-200 bg-red-50 text-red-800",
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 sm:bottom-5 sm:left-auto sm:right-5 sm:max-w-sm">
      <div className={`rounded-2xl border px-4 py-3 text-sm shadow-lg ${toneMap[tone]}`}>
        {message}
      </div>
    </div>
  );
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function labelize(value) {
  return value.replaceAll("_", " ");
}
