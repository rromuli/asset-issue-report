import { Fragment, useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const INVENTORY_STATUS_OPTIONS = ["available", "defective", "assigned", "maintenance", "retired"];
const STATUS_BADGE_STYLES = {
  available: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  defective: "bg-red-50 text-red-700 ring-red-200",
  assigned: "bg-blue-50 text-blue-700 ring-blue-200",
  maintenance: "bg-amber-50 text-amber-700 ring-amber-200",
  retired: "bg-zinc-100 text-zinc-700 ring-zinc-200",
};

const INVENTORY_TABS = [
  { id: "available", label: "Available" },
  { id: "defective", label: "Defective" },
  { id: "all", label: "All Assets" },
];

const EMPTY_ASSIGN_FORM = {
  employeeEmail: "",
  employeeName: "",
  assetName: "",
};

export default function AssetInventory({ adminRole }) {
  const canRegisterInventoryAssets = adminRole === "it" || adminRole === "hr";
  const [inventoryAssets, setInventoryAssets] = useState([]);
  const [knownEmployees, setKnownEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeInventoryTab, setActiveInventoryTab] = useState("available");
  const [expandedAssetId, setExpandedAssetId] = useState(null);
  const [assignModalAsset, setAssignModalAsset] = useState(null);
  const [assignForm, setAssignForm] = useState(EMPTY_ASSIGN_FORM);
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [editModalAsset, setEditModalAsset] = useState(null);
  const [editForm, setEditForm] = useState({
    serialNumber: "",
    cpu: "",
    gpu: "",
    ram: "",
    storage: "",
    performanceNotes: "",
  });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [form, setForm] = useState({
    assetType: "",
    serialNumber: "",
    makeModel: "",
    cpu: "",
    gpu: "",
    ram: "",
    storage: "",
    performanceNotes: "",
    conditionNotes: "",
    status: "available",
  });

  useEffect(() => {
    void fetchInventoryAssets();
    void fetchKnownEmployees();
  }, []);

  async function fetchInventoryAssets() {
    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from("inventory_assets")
      .select(
        "id, asset_name, asset_type, serial_number, asset_tag, make_model, cpu, gpu, ram, storage, performance_notes, condition_notes, status, assigned_report_id, assigned_employee_name, assigned_employee_identifier, assigned_employee_email, assigned_employee_asset_id, assigned_at, created_at"
      )
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setInventoryAssets(data || []);
    setLoading(false);
  }

  async function fetchKnownEmployees() {
    const [employeeAssetsResult, returnRequestsResult] = await Promise.all([
      supabase
        .from("employee_assets")
        .select("employee_email, employee_name")
        .not("employee_email", "is", null),
      supabase
        .from("asset_return_requests")
        .select("employee_email, employee_name")
        .not("employee_email", "is", null),
    ]);

    const mergedRows = [
      ...(employeeAssetsResult.data || []),
      ...(returnRequestsResult.data || []),
    ];

    const deduped = new Map();
    for (const row of mergedRows) {
      const email = String(row.employee_email || "").trim().toLowerCase();
      if (!email) continue;
      const existing = deduped.get(email);
      const nextName = String(row.employee_name || "").trim();

      deduped.set(email, {
        email,
        name: nextName || existing?.name || email,
      });
    }

    setKnownEmployees(
      Array.from(deduped.values()).sort((a, b) => {
        const nameCompare = a.name.localeCompare(b.name);
        return nameCompare !== 0 ? nameCompare : a.email.localeCompare(b.email);
      })
    );
  }

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function updateAssignField(name, value) {
    setAssignForm((current) => ({ ...current, [name]: value }));
  }

  function updateEditField(name, value) {
    setEditForm((current) => ({ ...current, [name]: value }));
  }

  function handleEmployeeSelection(email) {
    const selectedEmployee = knownEmployees.find((employee) => employee.email === email);
    if (!selectedEmployee) {
      updateAssignField("employeeEmail", email);
      return;
    }

    setAssignForm((current) => ({
      ...current,
      employeeEmail: selectedEmployee.email,
      employeeName:
        current.employeeName.trim() && current.employeeEmail === selectedEmployee.email
          ? current.employeeName
          : selectedEmployee.name,
    }));
  }

  function showToast(message, tone = "info") {
    setToast({ message, tone });
    window.setTimeout(() => {
      setToast((current) => (current?.message === message ? null : current));
    }, 2600);
  }

  async function registerInventoryAsset(event) {
    event.preventDefault();

    if (!canRegisterInventoryAssets) {
      showToast("Only IT or HR can register inventory assets.", "warning");
      return;
    }

    if (!form.assetType.trim()) {
      showToast("Asset type is required.", "warning");
      return;
    }

    setSubmitting(true);
    setError("");

    const payload = {
      asset_name: form.assetType.trim(),
      asset_type: form.assetType.trim(),
      serial_number: form.serialNumber.trim() || null,
      asset_tag: generateInventoryTag(form.assetType),
      make_model: form.makeModel.trim() || null,
      cpu: form.cpu.trim() || null,
      gpu: form.gpu.trim() || null,
      ram: form.ram.trim() || null,
      storage: form.storage.trim() || null,
      performance_notes: form.performanceNotes.trim() || null,
      condition_notes: form.conditionNotes.trim() || null,
      status: form.status,
    };

    const { data: insertedAsset, error } = await supabase
      .from("inventory_assets")
      .insert([payload])
      .select(
        "id, asset_name, asset_type, serial_number, asset_tag, make_model, cpu, gpu, ram, storage, performance_notes, condition_notes, status, assigned_report_id, assigned_employee_name, assigned_employee_identifier, assigned_employee_email, assigned_employee_asset_id, assigned_at, created_at"
      )
      .single();

    if (error) {
      setError("Could not register asset: " + error.message);
      setSubmitting(false);
      return;
    }

    setForm({
      assetType: "",
      serialNumber: "",
      makeModel: "",
      cpu: "",
      gpu: "",
      ram: "",
      storage: "",
      performanceNotes: "",
      conditionNotes: "",
      status: "available",
    });

    if (insertedAsset) {
      printInventoryTag(insertedAsset);
    }

    showToast(`Inventory asset registered. Tag: ${payload.asset_tag}`, "success");
    setSubmitting(false);
    await fetchInventoryAssets();
  }

  function openAssignModal(asset) {
    if (adminRole !== "it") return;
    if ((asset.status || "available") !== "available") {
      showToast("Only available assets can be assigned.", "warning");
      return;
    }

    setAssignModalAsset(asset);
    setAssignForm({
      employeeEmail: "",
      employeeName: "",
      assetName: asset.asset_name || asset.asset_type || "",
    });
  }

  function closeAssignModal() {
    setAssignModalAsset(null);
    setAssignForm(EMPTY_ASSIGN_FORM);
    setAssignSubmitting(false);
  }

  function openEditModal(asset) {
    if (adminRole !== "it") return;
    setEditModalAsset(asset);
    setEditForm({
      serialNumber: asset.serial_number || "",
      cpu: asset.cpu || "",
      gpu: asset.gpu || "",
      ram: asset.ram || "",
      storage: asset.storage || "",
      performanceNotes: asset.performance_notes || "",
    });
  }

  function closeEditModal() {
    setEditModalAsset(null);
    setEditForm({
      serialNumber: "",
      cpu: "",
      gpu: "",
      ram: "",
      storage: "",
      performanceNotes: "",
    });
    setEditSubmitting(false);
  }

  async function submitAssignment(event) {
    event.preventDefault();

    if (adminRole !== "it" || !assignModalAsset) return;

    const employeeEmail = assignForm.employeeEmail.trim().toLowerCase();
    const employeeName = assignForm.employeeName.trim();
    const assetName =
      assignForm.assetName.trim() || assignModalAsset.asset_name || assignModalAsset.asset_type;

    if (!employeeEmail) {
      showToast("Employee email is required.", "warning");
      return;
    }

    if (!isValidEmail(employeeEmail)) {
      showToast("Enter a valid employee email address.", "warning");
      return;
    }

    if (!assetName) {
      showToast("Asset name is required.", "warning");
      return;
    }

    setAssignSubmitting(true);

    const assignedAtIso = new Date().toISOString();
    const employeeAssetPayload = {
      employee_email: employeeEmail,
      employee_name: employeeName || employeeEmail,
      asset_name: assetName,
      asset_type: assignModalAsset.asset_type || null,
      serial_number: assignModalAsset.serial_number || null,
      asset_tag: assignModalAsset.asset_tag || null,
      make_model: assignModalAsset.make_model || null,
      assigned_at: assignedAtIso,
      condition_notes: assignModalAsset.condition_notes || null,
      condition_photo_path: null,
    };

    const { data: employeeAssetRow, error: employeeAssetError } = await supabase
      .from("employee_assets")
      .insert([employeeAssetPayload])
      .select("id")
      .single();

    if (employeeAssetError || !employeeAssetRow?.id) {
      showToast(
        "Could not create employee asset assignment: " +
          (employeeAssetError?.message || "Unknown error"),
        "error"
      );
      setAssignSubmitting(false);
      return;
    }

    const inventoryPayload = {
      status: "assigned",
      assigned_report_id: null,
      assigned_employee_name: employeeName || employeeEmail,
      assigned_employee_identifier: employeeEmail,
      assigned_employee_email: employeeEmail,
      assigned_employee_asset_id: employeeAssetRow.id,
      assigned_at: assignedAtIso,
    };

    const { error: inventoryError } = await supabase
      .from("inventory_assets")
      .update(inventoryPayload)
      .eq("id", assignModalAsset.id);

    if (inventoryError) {
      await supabase.from("employee_assets").delete().eq("id", employeeAssetRow.id);
      showToast("Could not update inventory assignment: " + inventoryError.message, "error");
      setAssignSubmitting(false);
      return;
    }

    setInventoryAssets((current) =>
      current.map((asset) =>
        asset.id === assignModalAsset.id
          ? { ...asset, ...inventoryPayload, asset_name: assetName }
          : asset
      )
    );

    showToast(`Asset assigned to ${employeeEmail}.`, "success");
    closeAssignModal();
  }

  async function saveSerialNumber(event) {
    event.preventDefault();

    if (adminRole !== "it" || !editModalAsset) return;

    setEditSubmitting(true);
    const payload = {
      serial_number: editForm.serialNumber.trim() || null,
      cpu: editForm.cpu.trim() || null,
      gpu: editForm.gpu.trim() || null,
      ram: editForm.ram.trim() || null,
      storage: editForm.storage.trim() || null,
      performance_notes: editForm.performanceNotes.trim() || null,
    };

    const { error: inventoryError } = await supabase
      .from("inventory_assets")
      .update(payload)
      .eq("id", editModalAsset.id);

    if (inventoryError) {
      showToast("Could not update asset details: " + inventoryError.message, "error");
      setEditSubmitting(false);
      return;
    }

    if (editModalAsset.assigned_employee_asset_id) {
      const { error: employeeAssetError } = await supabase
        .from("employee_assets")
        .update({ serial_number: payload.serial_number })
        .eq("id", editModalAsset.assigned_employee_asset_id);

      if (employeeAssetError) {
        showToast(
          "Inventory updated, but linked employee asset did not sync: " +
            employeeAssetError.message,
          "warning"
        );
      }
    }

    setInventoryAssets((current) =>
      current.map((asset) =>
        asset.id === editModalAsset.id
          ? { ...asset, ...payload }
          : asset
      )
    );

    showToast("Asset details updated.", "success");
    closeEditModal();
  }

  async function markAsAvailable(asset) {
    if (adminRole !== "it") return;

    if (asset.assigned_employee_asset_id) {
      const { error: deleteEmployeeAssetError } = await supabase
        .from("employee_assets")
        .delete()
        .eq("id", asset.assigned_employee_asset_id);

      if (deleteEmployeeAssetError) {
        showToast(
          "Could not remove the employee asset record: " + deleteEmployeeAssetError.message,
          "error"
        );
        return;
      }
    }

    const payload = {
      status: "available",
      assigned_report_id: null,
      assigned_employee_name: null,
      assigned_employee_identifier: null,
      assigned_employee_email: null,
      assigned_employee_asset_id: null,
      assigned_at: null,
    };

    const { error } = await supabase
      .from("inventory_assets")
      .update(payload)
      .eq("id", asset.id);

    if (error) {
      showToast("Could not update asset: " + error.message, "error");
      return;
    }

    setInventoryAssets((current) =>
      current.map((row) => (row.id === asset.id ? { ...row, ...payload } : row))
    );
    showToast("Asset marked as available.", "success");
  }

  async function deleteInventoryAsset(asset) {
    if (adminRole !== "it") return;

    const confirmed = window.confirm(
      `Delete inventory asset #${asset.id} (${asset.asset_type || "Asset"})? This cannot be undone.`
    );
    if (!confirmed) return;

    if (asset.assigned_employee_asset_id) {
      const { error: deleteEmployeeAssetError } = await supabase
        .from("employee_assets")
        .delete()
        .eq("id", asset.assigned_employee_asset_id);

      if (deleteEmployeeAssetError) {
        showToast(
          "Could not remove linked employee asset: " + deleteEmployeeAssetError.message,
          "error"
        );
        return;
      }
    }

    const { error } = await supabase.from("inventory_assets").delete().eq("id", asset.id);

    if (error) {
      showToast("Could not delete asset: " + error.message, "error");
      return;
    }

    setInventoryAssets((current) => current.filter((row) => row.id !== asset.id));
    showToast("Inventory asset deleted.", "success");
  }

  const filteredAssets = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const tabbedAssets =
      activeInventoryTab === "all"
        ? inventoryAssets
        : inventoryAssets.filter(
            (asset) => (asset.status || "available") === activeInventoryTab
          );

    if (!term) return tabbedAssets;

    return tabbedAssets.filter((asset) => {
      return (
        (asset.asset_type || "").toLowerCase().includes(term) ||
        (asset.serial_number || "").toLowerCase().includes(term) ||
        (asset.asset_tag || "").toLowerCase().includes(term) ||
        (asset.make_model || "").toLowerCase().includes(term) ||
        (asset.cpu || "").toLowerCase().includes(term) ||
        (asset.gpu || "").toLowerCase().includes(term) ||
        (asset.ram || "").toLowerCase().includes(term) ||
        (asset.storage || "").toLowerCase().includes(term) ||
        (asset.performance_notes || "").toLowerCase().includes(term) ||
        (asset.assigned_employee_name || "").toLowerCase().includes(term) ||
        (asset.assigned_employee_identifier || "").toLowerCase().includes(term) ||
        (asset.assigned_employee_email || "").toLowerCase().includes(term)
      );
    });
  }, [activeInventoryTab, inventoryAssets, searchTerm]);

  const availableCount = inventoryAssets.filter((asset) => asset.status === "available").length;
  const defectiveCount = inventoryAssets.filter((asset) => asset.status === "defective").length;

  const tabCounts = {
    available: availableCount,
    defective: defectiveCount,
    all: inventoryAssets.length,
  };

  if (loading) {
    return (
      <div className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-4">
          <div className="h-24 animate-pulse rounded-[24px] border border-zinc-200/80 bg-white" />
          <div className="h-[420px] animate-pulse rounded-[24px] border border-zinc-200/80 bg-white" />
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
                Admin Inventory
              </p>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-zinc-900">
                Asset Inventory
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                Register available IT stock and assign assets directly to employees.
              </p>
            </div>
            <div className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
              {availableCount} available | {defectiveCount} defective
            </div>
          </div>

          {canRegisterInventoryAssets ? (
            <form
              onSubmit={registerInventoryAsset}
              className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4"
            >
              <InputField
                label="Asset type *"
                value={form.assetType}
                onChange={(value) => updateField("assetType", value)}
                placeholder="e.g. Monitor"
              />
              <InputField
                label="Serial number"
                value={form.serialNumber}
                onChange={(value) => updateField("serialNumber", value)}
                placeholder="e.g. SN-22312"
              />
              <InputField
                label="Make / Model"
                value={form.makeModel}
                onChange={(value) => updateField("makeModel", value)}
                placeholder="e.g. Dell P2422H"
              />
              <InputField
                label="CPU"
                value={form.cpu}
                onChange={(value) => updateField("cpu", value)}
                placeholder="e.g. Intel i7-1360P"
              />
              <InputField
                label="GPU"
                value={form.gpu}
                onChange={(value) => updateField("gpu", value)}
                placeholder="e.g. Intel Iris Xe"
              />
              <InputField
                label="RAM"
                value={form.ram}
                onChange={(value) => updateField("ram", value)}
                placeholder="e.g. 16 GB"
              />
              <InputField
                label="Storage"
                value={form.storage}
                onChange={(value) => updateField("storage", value)}
                placeholder="e.g. 512 GB SSD"
              />
              <InputField
                label="Performance notes"
                value={form.performanceNotes}
                onChange={(value) => updateField("performanceNotes", value)}
                placeholder="e.g. Battery 86%, docking capable"
              />
              <InputField
                label="Condition notes"
                value={form.conditionNotes}
                onChange={(value) => updateField("conditionNotes", value)}
                placeholder="Optional"
              />
              <label className="block">
                <div className="mb-2 text-sm font-semibold text-zinc-900">Status</div>
                <select
                  value={form.status}
                  onChange={(e) => updateField("status", e.target.value)}
                  className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                >
                  {INVENTORY_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {labelize(status)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                >
                  {submitting ? "Saving..." : "Register Asset"}
                </button>
              </div>
            </form>
          ) : (
            <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
              Inventory registration is restricted to IT and HR roles.
            </div>
          )}

          <div className="mt-4">
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search type, serial, tag, assignee..."
              className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 sm:w-96"
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {INVENTORY_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveInventoryTab(tab.id)}
                className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                  activeInventoryTab === tab.id
                    ? "bg-zinc-900 text-white"
                    : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                {tab.label} ({tabCounts[tab.id]})
              </button>
            ))}
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}
        </section>

        <section className="overflow-hidden rounded-[24px] border border-zinc-200/80 bg-white shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full text-sm">
              <thead className="bg-zinc-50/80 text-left text-zinc-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Type</th>
                  <th className="px-5 py-3 font-semibold">Serial</th>
                  <th className="px-5 py-3 font-semibold">Tag</th>
                  <th className="px-5 py-3 font-semibold">Model</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Assignment</th>
                  <th className="px-5 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssets.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-zinc-500">
                      No inventory assets found.
                    </td>
                  </tr>
                ) : (
                  filteredAssets.map((asset) => (
                    <Fragment key={asset.id}>
                      <tr className="border-t border-zinc-200/70">
                        <td className="px-5 py-3">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedAssetId((current) =>
                                current === asset.id ? null : asset.id
                              )
                            }
                            className="text-left"
                          >
                            <div className="font-medium text-zinc-900">
                              {asset.asset_type || "-"}
                            </div>
                            <div className="text-xs font-medium text-blue-600">
                              {expandedAssetId === asset.id ? "Hide details" : "Show details"}
                            </div>
                          </button>
                          <div className="text-xs text-zinc-500">#{asset.id}</div>
                        </td>
                        <td className="px-5 py-3 text-zinc-700">{asset.serial_number || "-"}</td>
                        <td className="px-5 py-3 text-zinc-700">{asset.asset_tag || "-"}</td>
                        <td className="px-5 py-3 text-zinc-700">{asset.make_model || "-"}</td>
                        <td className="px-5 py-3">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${
                              STATUS_BADGE_STYLES[asset.status] || STATUS_BADGE_STYLES.available
                            }`}
                          >
                            {labelize(asset.status || "available")}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-zinc-700">
                          {asset.assigned_employee_name || asset.assigned_employee_email ? (
                            <div>
                              <div className="font-medium text-zinc-900">
                                {asset.assigned_employee_name || "-"}
                              </div>
                              <div className="text-xs text-zinc-500">
                                {asset.assigned_employee_email ||
                                  asset.assigned_employee_identifier ||
                                  "-"}
                              </div>
                            </div>
                          ) : asset.assigned_report_id ? (
                            <div>
                              <div className="font-medium text-zinc-900">
                                Report #{asset.assigned_report_id}
                              </div>
                              <div className="text-xs text-zinc-500">
                                {asset.assigned_employee_name || "-"} |{" "}
                                {asset.assigned_employee_identifier || "-"}
                              </div>
                            </div>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => printInventoryTag(asset)}
                              className="rounded-2xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
                            >
                              Print Tag
                            </button>
                            {adminRole === "it" ? (
                              <button
                                type="button"
                                onClick={() => openEditModal(asset)}
                                className="rounded-2xl border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
                              >
                                Edit Performance
                              </button>
                            ) : null}
                            {adminRole === "it" && asset.status === "available" ? (
                              <button
                                type="button"
                                onClick={() => openAssignModal(asset)}
                                className="rounded-2xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
                              >
                                Assign
                              </button>
                            ) : null}
                            {adminRole === "it" && asset.status !== "available" ? (
                              <button
                                type="button"
                                onClick={() => markAsAvailable(asset)}
                                className="rounded-2xl border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
                              >
                                Mark Available
                              </button>
                            ) : null}
                            {adminRole === "it" ? (
                              <button
                                type="button"
                                onClick={() => deleteInventoryAsset(asset)}
                                className="rounded-2xl border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                              >
                                Delete
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                      {expandedAssetId === asset.id ? (
                        <tr className="border-t border-zinc-100 bg-zinc-50/70">
                          <td colSpan={7} className="px-5 py-4">
                            <div className="flex flex-col gap-3">
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <div className="text-sm font-semibold text-zinc-900">
                                    Performance Details
                                  </div>
                                  <div className="text-xs text-zinc-500">
                                    CPU, GPU, RAM, storage, and extra performance notes.
                                  </div>
                                </div>
                                {adminRole === "it" ? (
                                  <button
                                    type="button"
                                    onClick={() => openEditModal(asset)}
                                    className="w-full rounded-2xl bg-zinc-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-zinc-800 sm:w-auto"
                                  >
                                    Edit Performance
                                  </button>
                                ) : null}
                              </div>
                              <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
                                <DetailItem label="CPU" value={asset.cpu} />
                                <DetailItem label="GPU" value={asset.gpu} />
                                <DetailItem label="RAM" value={asset.ram} />
                                <DetailItem label="Storage" value={asset.storage} />
                                <DetailItem
                                  label="Performance Notes"
                                  value={asset.performance_notes}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {assignModalAsset ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
          onClick={closeAssignModal}
        >
          <div
            className="w-full max-w-lg rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_20px_50px_rgba(0,0,0,0.18)]"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
              Assign Inventory Asset
            </p>
            <h3 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900">
              {assignModalAsset.asset_type || assignModalAsset.asset_name || "Asset"}
            </h3>
            <p className="mt-2 text-sm text-zinc-600">
              This creates an `employee_assets` record so the item appears in the employee&apos;s
              `My Assets` view immediately.
            </p>

            <form onSubmit={submitAssignment} className="mt-5 space-y-4">
              {knownEmployees.length > 0 ? (
                <label className="block">
                  <div className="mb-2 text-sm font-semibold text-zinc-900">
                    Choose registered employee
                  </div>
                  <select
                    value={assignForm.employeeEmail}
                    onChange={(event) => handleEmployeeSelection(event.target.value)}
                    className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="">Select employee</option>
                    {knownEmployees.map((employee) => (
                      <option key={employee.email} value={employee.email}>
                        {employee.name} | {employee.email}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <InputField
                label="Employee email *"
                value={assignForm.employeeEmail}
                onChange={(value) => updateAssignField("employeeEmail", value)}
                placeholder="name@gjirafa.com"
              />
              <InputField
                label="Employee name"
                value={assignForm.employeeName}
                onChange={(value) => updateAssignField("employeeName", value)}
                placeholder="Optional display name"
              />
              <InputField
                label="Asset name"
                value={assignForm.assetName}
                onChange={(value) => updateAssignField("assetName", value)}
                placeholder="What the employee should see"
              />

              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
                <div>Serial: {assignModalAsset.serial_number || "-"}</div>
                <div>Tag: {assignModalAsset.asset_tag || "-"}</div>
                <div>Model: {assignModalAsset.make_model || "-"}</div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={closeAssignModal}
                  className="rounded-2xl border border-zinc-300 bg-white px-5 py-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assignSubmitting}
                  className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                >
                  {assignSubmitting ? "Assigning..." : "Assign Asset"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {editModalAsset ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
          onClick={closeEditModal}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_20px_50px_rgba(0,0,0,0.18)]"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
              Edit Asset Performance
            </p>
            <h3 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900">
              {editModalAsset.asset_type || editModalAsset.asset_name || "Asset"}
            </h3>
            <p className="mt-2 text-sm text-zinc-600">
              Update the serial number and performance details for this registered inventory asset.
            </p>

            <form onSubmit={saveSerialNumber} className="mt-5 space-y-4">
              <InputField
                label="Serial number"
                value={editForm.serialNumber}
                onChange={(value) => updateEditField("serialNumber", value)}
                placeholder="e.g. SN-22312"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <InputField
                  label="CPU"
                  value={editForm.cpu}
                  onChange={(value) => updateEditField("cpu", value)}
                  placeholder="e.g. Intel i7-1360P"
                />
                <InputField
                  label="GPU"
                  value={editForm.gpu}
                  onChange={(value) => updateEditField("gpu", value)}
                  placeholder="e.g. Intel Iris Xe"
                />
                <InputField
                  label="RAM"
                  value={editForm.ram}
                  onChange={(value) => updateEditField("ram", value)}
                  placeholder="e.g. 16 GB"
                />
                <InputField
                  label="Storage"
                  value={editForm.storage}
                  onChange={(value) => updateEditField("storage", value)}
                  placeholder="e.g. 512 GB SSD"
                />
              </div>
              <InputField
                label="Performance notes"
                value={editForm.performanceNotes}
                onChange={(value) => updateEditField("performanceNotes", value)}
                placeholder="e.g. Battery 86%, docking capable"
              />

              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
                <div>Tag: {editModalAsset.asset_tag || "-"}</div>
                <div>Model: {editModalAsset.make_model || "-"}</div>
                <div>Status: {labelize(editModalAsset.status || "available")}</div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="rounded-2xl border border-zinc-300 bg-white px-5 py-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                >
                  {editSubmitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {toast ? <InlineToast tone={toast.tone} message={toast.message} /> : null}
    </div>
  );
}

function InputField({ label, value, onChange, placeholder = "" }) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-semibold text-zinc-900">{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-2 text-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
      />
    </label>
  );
}

function InlineToast({ tone = "info", message }) {
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

function DetailItem({ label, value }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
        {label}
      </div>
      <div className="mt-1 font-medium text-zinc-900">{value || "-"}</div>
    </div>
  );
}

function labelize(value) {
  return String(value || "").replaceAll("_", " ");
}

function generateInventoryTag(assetType) {
  const randomPart = String(Math.floor(Math.random() * 1000)).padStart(3, "0");
  return `IT-GJIR-${randomPart}`;
}

function buildInventoryQrValue(asset) {
  return asset.asset_tag || "-";
}

function buildInventoryQrSrc(asset) {
  const encoded = encodeURIComponent(buildInventoryQrValue(asset));
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encoded}`;
}

function printInventoryTag(asset) {
  const qrSrc = buildInventoryQrSrc(asset);
  const isDefective = (asset.status || "").toLowerCase() === "defective";
  const defectiveBadge = isDefective ? '<div class="defective">DEFECTIVE</div>' : "";
  const popup = window.open("", "_blank", "width=420,height=620");
  if (!popup) return;

  popup.document.write(`
    <html>
      <head>
        <title>Inventory Asset Tag</title>
        <style>
          @page { size: 2in 1in; margin: 0; }
          * { box-sizing: border-box; }
          html, body { width: 2in; height: 1in; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; color: #111827; }
          .tag {
            width: 2in;
            height: 1in;
            border: 1px solid #111827;
            border-radius: 0.06in;
            padding: 0.05in;
            display: grid;
            grid-template-columns: 0.8in 1fr;
            gap: 0.05in;
            align-items: center;
          }
          .qr img { width: 0.7in; height: 0.7in; display: block; margin: 0 auto; }
          .title { font-size: 7px; letter-spacing: .04em; text-transform: uppercase; color: #374151; line-height: 1.1; }
          .name { margin-top: 0.02in; font-size: 8px; font-weight: 700; line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .defective {
            display: inline-block;
            margin-top: 0.02in;
            border: 1px solid #dc2626;
            border-radius: 0.02in;
            padding: 0.01in 0.03in;
            color: #b91c1c;
            font-size: 8px;
            font-weight: 800;
            line-height: 1;
            letter-spacing: .08em;
          }
          .meta { margin-top: 0.03in; font-size: 7px; line-height: 1.2; }
          .meta div { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        </style>
      </head>
      <body>
        <div class="tag">
          <div class="qr">
            <img src="${qrSrc}" alt="Inventory QR code" />
          </div>
          <div>
            <div class="title">Asset Management System</div>
            <div class="name">${escapeHtml(asset.asset_type || "Asset")}</div>
            ${defectiveBadge}
            <div class="meta">
              <div><strong>Tag:</strong> ${escapeHtml(asset.asset_tag || "-")}</div>
              <div><strong>Type:</strong> ${escapeHtml(asset.asset_type || "-")}</div>
              <div><strong>SN:</strong> ${escapeHtml(asset.serial_number || "-")}</div>
            </div>
          </div>
        </div>
        <script>
          window.onload = () => { window.print(); };
        </script>
      </body>
    </html>
  `);
  popup.document.close();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}
