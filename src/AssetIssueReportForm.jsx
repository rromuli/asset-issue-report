import { useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

export default function AssetIssueReportForm() {
  const departments = [
    "IT",
    "HR",
    "Finance",
    "Operations",
    "Sales",
    "Marketing",
    "Customer Support",
    "Legal",
    "Procurement",
    "Other",
  ];

  const operatingSystems = [
    "Windows 11",
    "Windows 10",
    "macOS",
    "Linux",
    "Android",
    "iOS",
    "ChromeOS",
    "Not applicable",
  ];

  const issueCategories = [
    "Hardware damage",
    "Power / battery",
    "Performance issue",
    "Software issue",
    "Connectivity issue",
    "Peripheral issue",
    "Lost or stolen",
    "Access / login issue",
    "Other",
  ];

  const contactOptions = ["Email", "Phone", "Teams / Chat", "In person"];
  const assetTypes = ["Laptop", "Phone", "Mouse", "Keyboard", "Monitor", "Other"];
  const severities = ["Low", "Medium", "High", "Critical"];

  const initialForm = useMemo(
    () => ({
      fullName: "",
      employeeId: "",
      department: "",
      preferredContact: "",
      assetType: "",
      serialNumber: "",
      assetTag: "",
      makeModel: "",
      operatingSystem: "",
      issueCategory: "",
      severity: "",
      firstNoticedDate: "",
      description: "",
      stepsTaken: "",
      additionalNotes: "",
      attachments: [],
    }),
    []
  );

  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [savedReportId, setSavedReportId] = useState(null);

  const requiredFields = {
    fullName: "Full name",
    employeeId: "Employee ID",
    department: "Department",
    preferredContact: "Preferred contact",
    assetType: "Asset type",
    serialNumber: "Serial number",
    assetTag: "Asset tag / IT tag",
    makeModel: "Make / Model",
    operatingSystem: "Operating system",
    issueCategory: "Issue category",
    severity: "Severity",
    firstNoticedDate: "Date issue first noticed",
    description: "Description",
    stepsTaken: "Steps taken",
  };

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
    setSubmitted(false);
    setSubmitError("");
  }

  function validate() {
    const nextErrors = {};

    Object.entries(requiredFields).forEach(([field, label]) => {
      const value = form[field];
      if (!value || (typeof value === "string" && !value.trim())) {
        nextErrors[field] = `${label} is required.`;
      }
    });

    if (form.employeeId && !/^[A-Za-z0-9-]+$/.test(form.employeeId.trim())) {
      nextErrors.employeeId = "Employee ID should contain only letters, numbers, or hyphens.";
    }

    if (form.firstNoticedDate) {
      const selectedDate = new Date(form.firstNoticedDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selectedDate > today) {
        nextErrors.firstNoticedDate = "Date issue first noticed cannot be in the future.";
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!validate()) return;

    try {
      setSubmitting(true);
      setSubmitted(false);
      setSubmitError("");

      const { data: report, error: reportError } = await supabase
        .from("asset_issue_reports")
        .insert([
          {
            full_name: form.fullName,
            employee_id: form.employeeId,
            department: form.department,
            preferred_contact: form.preferredContact,
            asset_type: form.assetType,
            serial_number: form.serialNumber,
            asset_tag: form.assetTag,
            make_model: form.makeModel,
            operating_system: form.operatingSystem,
            issue_category: form.issueCategory,
            severity: form.severity,
            first_noticed_date: form.firstNoticedDate,
            description: form.description,
            steps_taken: form.stepsTaken,
            additional_notes: form.additionalNotes || null,
            status: "submitted",
          },
        ])
        .select()
        .single();

      if (reportError) {
        setSubmitError("Error saving report: " + reportError.message);
        return;
      }

      for (const file of form.attachments || []) {
        const uniqueFileName = `${Date.now()}-${file.name}`;
        const filePath = `${report.id}/${uniqueFileName}`;

        const { error: uploadError } = await supabase.storage
          .from("attachments")
          .upload(filePath, file);

        if (uploadError) {
          setSubmitError("File upload error: " + uploadError.message);
          return;
        }

        const { error: attachmentError } = await supabase
          .from("asset_issue_attachments")
          .insert([
            {
              report_id: report.id,
              file_name: file.name,
              file_path: filePath,
              file_size: file.size,
              mime_type: file.type,
            },
          ]);

        if (attachmentError) {
          setSubmitError("Attachment row error: " + attachmentError.message);
          return;
        }
      }

      const { error: emailError } = await supabase.functions.invoke("send-report-email", {
        body: {
          full_name: form.fullName,
          employee_id: form.employeeId,
          department: form.department,
          asset_type: form.assetType,
          issue_category: form.issueCategory,
          severity: form.severity,
          description: form.description,
          preferred_contact: form.preferredContact,
        },
      });

      if (emailError) {
        console.error("Email function error:", emailError.message);
      }

      setSavedReportId(report.id);
      setSubmitted(true);
      setForm(initialForm);
    } catch (err) {
      console.error(err);
      setSubmitError("Unexpected error: " + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleReset() {
    setForm(initialForm);
    setErrors({});
    setSubmitted(false);
    setSubmitError("");
    setSavedReportId(null);
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.08),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.06),_transparent_22%),#f6f7fb] px-4 py-8 text-zinc-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="overflow-hidden rounded-[32px] border border-zinc-200/80 bg-white shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
          <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="px-6 py-8 sm:px-8 sm:py-10">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                Internal IT Support
              </p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-900 sm:text-5xl">
                Asset Issue Report
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-600 sm:text-base">
                Report issues affecting company-issued laptops, phones, monitors,
                keyboards, mice, and other essential equipment so the IT team can act
                quickly and maintain operational continuity.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                <InfoTile title="Fast triage" text="Severity, category, and asset details help IT prioritize faster." />
                <InfoTile title="Traceable" text="Every report is saved, reviewed, and tracked in the dashboard." />
                <InfoTile title="Documented" text="Attach screenshots or PDFs to reduce follow-up and back-and-forth." />
              </div>
            </div>

            <div className="border-t border-zinc-200 bg-zinc-50/70 px-6 py-8 sm:px-8 lg:border-l lg:border-t-0">
              <div className="rounded-[28px] border border-zinc-200/80 bg-white p-6 shadow-[0_6px_18px_rgba(0,0,0,0.05)]">
                <h2 className="text-lg font-semibold text-zinc-900">Submission checklist</h2>
                <ul className="mt-4 space-y-3 text-sm leading-7 text-zinc-600">
                  <li>• Add the asset tag and serial number exactly as shown on the device.</li>
                  <li>• Choose the correct severity to help the support team prioritize response.</li>
                  <li>• Describe what happened and what troubleshooting has already been tried.</li>
                  <li>• Add screenshots or PDFs when useful for faster diagnosis.</li>
                </ul>

                <div className="mt-6 rounded-[24px] bg-blue-50 p-4 text-sm leading-7 text-blue-800">
                  Reports submitted here are delivered to the IT team, saved in the
                  dashboard, and can trigger email notification for review.
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[32px] border border-zinc-200/80 bg-white shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
          <form onSubmit={handleSubmit} onReset={handleReset} className="px-6 py-6 sm:px-8 sm:py-8">
            {submitted ? (
              <div className="mb-6 rounded-[24px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800 shadow-[0_6px_18px_rgba(0,0,0,0.04)]">
                <div className="font-semibold">Report submitted successfully.</div>
                <p className="mt-1 leading-7">
                  IT can now review the issue and follow up using your preferred contact method.
                  {savedReportId ? ` Reference ID: ${savedReportId}.` : ""}
                </p>
              </div>
            ) : null}

            {submitError ? (
              <div className="mb-6 rounded-[24px] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800 shadow-[0_6px_18px_rgba(0,0,0,0.04)]">
                <div className="font-semibold">Submission error</div>
                <p className="mt-1 leading-7">{submitError}</p>
              </div>
            ) : null}

            <SectionTitle
              title="Employee Information"
              subtitle="Provide the employee details needed to identify the request and respond quickly."
            />

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <Field label="Full name" required error={errors.fullName}>
                <Input
                  value={form.fullName}
                  onChange={(value) => updateField("fullName", value)}
                  placeholder="e.g. Ana Berisha"
                  error={errors.fullName}
                />
              </Field>

              <Field label="Employee ID" required error={errors.employeeId}>
                <Input
                  value={form.employeeId}
                  onChange={(value) => updateField("employeeId", value)}
                  placeholder="e.g. EMP-00421"
                  error={errors.employeeId}
                />
              </Field>

              <Field label="Department" required error={errors.department}>
                <Select
                  value={form.department}
                  onChange={(value) => updateField("department", value)}
                  defaultLabel="Select department"
                  options={departments}
                  error={errors.department}
                />
              </Field>

              <Field label="Preferred contact" required error={errors.preferredContact}>
                <Select
                  value={form.preferredContact}
                  onChange={(value) => updateField("preferredContact", value)}
                  defaultLabel="Select preferred contact"
                  options={contactOptions}
                  error={errors.preferredContact}
                />
              </Field>
            </div>

            <SectionTitle
              title="Asset Details"
              subtitle="Use exact device identifiers to avoid confusion and speed up diagnostics."
              className="mt-10"
            />

            <Field label="Asset type" required error={errors.assetType}>
              <ChoiceGrid
                options={assetTypes}
                name="assetType"
                value={form.assetType}
                onChange={(value) => updateField("assetType", value)}
                error={errors.assetType}
              />
            </Field>

            <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
              <Field
                label="Serial number (SN)"
                required
                hint="Found on a sticker on the device or in system settings."
                error={errors.serialNumber}
              >
                <Input
                  value={form.serialNumber}
                  onChange={(value) => updateField("serialNumber", value)}
                  placeholder="e.g. C02XG2JHJGH5"
                  error={errors.serialNumber}
                />
              </Field>

              <Field
                label="Asset tag / IT tag"
                required
                hint="Company-issued barcode label on the device."
                error={errors.assetTag}
              >
                <Input
                  value={form.assetTag}
                  onChange={(value) => updateField("assetTag", value)}
                  placeholder="e.g. IT-LAP-0042"
                  error={errors.assetTag}
                />
              </Field>

              <Field label="Make / Model" required error={errors.makeModel}>
                <Input
                  value={form.makeModel}
                  onChange={(value) => updateField("makeModel", value)}
                  placeholder="e.g. Apple MacBook Pro 14, Dell Latitude 5440"
                  error={errors.makeModel}
                />
              </Field>

              <Field label="Operating system" required error={errors.operatingSystem}>
                <Select
                  value={form.operatingSystem}
                  onChange={(value) => updateField("operatingSystem", value)}
                  defaultLabel="Select OS"
                  options={operatingSystems}
                  error={errors.operatingSystem}
                />
              </Field>
            </div>

            <SectionTitle
              title="Issue Details"
              subtitle="Describe the issue clearly so the IT team can act without unnecessary follow-up."
              className="mt-10"
            />

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <Field label="Issue category" required error={errors.issueCategory}>
                <Select
                  value={form.issueCategory}
                  onChange={(value) => updateField("issueCategory", value)}
                  defaultLabel="Select issue category"
                  options={issueCategories}
                  error={errors.issueCategory}
                />
              </Field>

              <Field label="Severity" required error={errors.severity}>
                <ChoiceGrid
                  options={severities}
                  name="severity"
                  value={form.severity}
                  onChange={(value) => updateField("severity", value)}
                  error={errors.severity}
                />
              </Field>

              <Field label="Date issue first noticed" required error={errors.firstNoticedDate}>
                <Input
                  type="date"
                  value={form.firstNoticedDate}
                  onChange={(value) => updateField("firstNoticedDate", value)}
                  error={errors.firstNoticedDate}
                />
              </Field>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-5">
              <Field label="Description" required error={errors.description}>
                <Textarea
                  value={form.description}
                  onChange={(value) => updateField("description", value)}
                  placeholder="Describe the issue in detail, including what happened and how it affects your work."
                  error={errors.description}
                />
              </Field>

              <Field label="Steps taken" required error={errors.stepsTaken}>
                <Textarea
                  value={form.stepsTaken}
                  onChange={(value) => updateField("stepsTaken", value)}
                  placeholder="List any troubleshooting steps already tried, such as restarting, reconnecting cables, or reinstalling software."
                  error={errors.stepsTaken}
                />
              </Field>

              <Field label="Additional notes">
                <Textarea
                  value={form.additionalNotes}
                  onChange={(value) => updateField("additionalNotes", value)}
                  placeholder="Add any extra context, preferred follow-up times, or anything else IT should know."
                />
              </Field>

              <Field label="Attachments" hint="Accepted file types: PNG, JPG, JPEG, PDF.">
                <FileUpload
                  files={form.attachments}
                  onChange={(files) => updateField("attachments", files)}
                />
              </Field>
            </div>

            <div className="mt-8 flex flex-col gap-3 border-t border-zinc-200/70 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-zinc-500">Fields marked with an asterisk are required.</p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="reset"
                  className="rounded-2xl border border-zinc-300 bg-white px-5 py-3 text-sm font-medium text-zinc-700 transition hover:-translate-y-0.5 hover:bg-zinc-50"
                >
                  Reset form
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
                >
                  {submitting ? "Submitting report..." : "Submit report"}
                </button>
              </div>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}

function InfoTile({ title, text }) {
  return (
    <div className="rounded-[24px] border border-zinc-200/80 bg-zinc-50 p-4 shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
      <p className="text-sm font-semibold text-zinc-900">{title}</p>
      <p className="mt-2 text-sm leading-7 text-zinc-600">{text}</p>
    </div>
  );
}

function SectionTitle({ title, subtitle, className = "" }) {
  return (
    <div className={className}>
      <h2 className="text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-600">
        {title}
      </h2>
      {subtitle ? <p className="mt-2 mb-5 text-sm leading-7 text-zinc-500">{subtitle}</p> : <div className="mb-5" />}
    </div>
  );
}

function Field({ label, required = false, children, hint, error }) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-semibold text-zinc-900">
        {label} {required ? <span className="text-orange-500">*</span> : null}
      </div>
      {children}
      {hint ? <p className="mt-2 text-xs leading-6 text-zinc-500">{hint}</p> : null}
      {error ? <p className="mt-2 text-xs font-medium text-red-600">{error}</p> : null}
    </label>
  );
}

function Input({ type = "text", placeholder = "", value, onChange, error }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className={`w-full rounded-2xl border bg-white px-4 py-3 text-sm outline-none transition placeholder:text-zinc-400 focus:ring-4 ${
        error
          ? "border-red-400 focus:border-red-500 focus:ring-red-100"
          : "border-zinc-300 focus:border-blue-500 focus:ring-blue-100"
      }`}
    />
  );
}

function Select({ defaultLabel, options, value, onChange, error }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`w-full rounded-2xl border bg-white px-4 py-3 text-sm outline-none transition focus:ring-4 ${
        error
          ? "border-red-400 focus:border-red-500 focus:ring-red-100"
          : "border-zinc-300 focus:border-blue-500 focus:ring-blue-100"
      }`}
    >
      <option value="">{defaultLabel}</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function Textarea({ placeholder, value, onChange, error }) {
  return (
    <textarea
      rows={5}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className={`w-full rounded-[24px] border bg-white px-4 py-3 text-sm outline-none transition placeholder:text-zinc-400 focus:ring-4 ${
        error
          ? "border-red-400 focus:border-red-500 focus:ring-red-100"
          : "border-zinc-300 focus:border-blue-500 focus:ring-blue-100"
      }`}
    />
  );
}

function ChoiceGrid({ options, name, value, onChange, error }) {
  return (
    <div className="flex flex-wrap gap-3">
      {options.map((option) => {
        const active = value === option;
        return (
          <label
            key={option}
            className={`inline-flex cursor-pointer items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition ${
              active
                ? "border-blue-500 bg-blue-50 text-blue-800"
                : error
                ? "border-red-300 bg-white text-zinc-800 hover:border-red-400"
                : "border-zinc-300 bg-white text-zinc-800 hover:border-blue-400 hover:bg-blue-50"
            }`}
          >
            <input
              type="radio"
              name={name}
              checked={active}
              onChange={() => onChange(option)}
              className="h-4 w-4"
            />
            <span>{option}</span>
          </label>
        );
      })}
    </div>
  );
}

function FileUpload({ files, onChange }) {
  return (
    <div className="rounded-[24px] border border-dashed border-zinc-300 bg-zinc-50 p-4 shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
      <input
        type="file"
        multiple
        accept=".png,.jpg,.jpeg,.pdf"
        onChange={(event) => onChange(Array.from(event.target.files || []))}
        className="block w-full text-sm text-zinc-700 file:mr-4 file:rounded-xl file:border-0 file:bg-blue-600 file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-700"
      />
      <p className="mt-2 text-xs leading-6 text-zinc-500">
        Attach photos, screenshots, or supporting documents if needed.
      </p>
      {files?.length ? (
        <ul className="mt-3 space-y-2 text-sm text-zinc-700">
          {files.map((file) => (
            <li key={`${file.name}-${file.size}`} className="rounded-2xl bg-white px-3 py-2.5">
              {file.name}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
