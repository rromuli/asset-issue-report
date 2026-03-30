import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

const assetTypes = [
  "Laptop",
  "Phone",
  "Monitor",
  "Keyboard",
  "Mouse",
  "Accessory",
  "Other",
];

const previewAssets = [
  {
    id: 101,
    asset_name: "Work Laptop",
    asset_type: "Laptop",
    serial_number: "C02XG2JHJGH5",
    asset_tag: "IT-LAP-0042",
    make_model: "Dell Latitude 5440",
    assigned_at: new Date().toISOString(),
    condition_notes: "Device is in good condition with light signs of daily use.",
    condition_photo_path: null,
  },
  {
    id: 102,
    asset_name: "Company Phone",
    asset_type: "Phone",
    serial_number: "SN-IPH-8821",
    asset_tag: "IT-PHN-0018",
    make_model: "iPhone 14",
    assigned_at: new Date().toISOString(),
    condition_notes: "Minor cosmetic wear on frame. Screen condition is good.",
    condition_photo_path: null,
  },
];

export default function MyAssets({ session, onReportIssue }) {
  const [assets, setAssets] = useState([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState({});
  const [returnStatusByAssetId, setReturnStatusByAssetId] = useState({});
  const [loading, setLoading] = useState(!!session);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [form, setForm] = useState({
    assetName: "",
    assetType: "",
    serialNumber: "",
    assetTag: "",
    makeModel: "",
    conditionNotes: "",
    photo: null,
  });

  const visibleAssets = assets.filter(
    (asset) => returnStatusByAssetId[asset.id] !== "confirmed"
  );

  useEffect(() => {
    if (session) {
      fetchAssets();
    } else {
      setAssets(previewAssets);
      setPhotoPreviewUrls({});
      setReturnStatusByAssetId({});
      setLoading(false);
    }
  }, [session]);

  async function fetchAssets() {
    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from("employee_assets")
      .select(
        "id, asset_name, asset_type, serial_number, asset_tag, make_model, assigned_at, condition_notes, condition_photo_path"
      )
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    const nextAssets = data || [];
    setAssets(nextAssets);
    await loadPhotoPreviews(nextAssets);
    await loadReturnRequestStatuses(nextAssets);
    setLoading(false);
  }

  async function loadReturnRequestStatuses(assetRows) {
    if (!session || assetRows.length === 0) {
      setReturnStatusByAssetId({});
      return;
    }

    const assetIds = assetRows.map((asset) => asset.id);
    const { data, error } = await supabase
      .from("asset_return_requests")
      .select("asset_id, status, requested_at")
      .eq("employee_email", session.user.email)
      .in("asset_id", assetIds)
      .order("requested_at", { ascending: false });

    if (error) {
      // Table may not exist yet in some environments. Do not block the UI.
      console.error("asset_return_requests load error:", error.message);
      setReturnStatusByAssetId({});
      return;
    }

    const latestByAssetId = {};
    for (const row of data || []) {
      if (!latestByAssetId[row.asset_id]) {
        latestByAssetId[row.asset_id] = row.status || "pending";
      }
    }
    setReturnStatusByAssetId(latestByAssetId);
  }

  async function loadPhotoPreviews(assetRows) {
    if (!session) {
      setPhotoPreviewUrls({});
      return;
    }

    const rowsWithPhotos = assetRows.filter((row) => row.condition_photo_path);

    if (rowsWithPhotos.length === 0) {
      setPhotoPreviewUrls({});
      return;
    }

    const urlEntries = await Promise.all(
      rowsWithPhotos.map(async (row) => {
        const { data, error } = await supabase.storage
          .from("asset-photos")
          .createSignedUrl(row.condition_photo_path, 3600);

        if (error || !data?.signedUrl) {
          return [row.id, null];
        }

        return [row.id, data.signedUrl];
      })
    );

    setPhotoPreviewUrls(Object.fromEntries(urlEntries.filter(([, url]) => !!url)));
  }

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function showToast(message, tone = "info") {
    setToast({ message, tone });
    window.setTimeout(() => {
      setToast((current) => (current?.message === message ? null : current));
    }, 2600);
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!session) {
      showToast("Preview mode is active. Sign in to save real assets.", "info");
      return;
    }

    setSubmitting(true);
    setError("");

    let photoPath = null;

    try {
      if (form.photo) {
        const fileName = `${Date.now()}-${form.photo.name}`;
        const filePath = `${session.user.email}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("asset-photos")
          .upload(filePath, form.photo);

        if (uploadError) {
          setError(uploadError.message);
          setSubmitting(false);
          return;
        }

        photoPath = filePath;
      }

      const { error: insertError } = await supabase.from("employee_assets").insert([
        {
          user_id: session.user.id,
          employee_email: session.user.email,
          employee_name: session.user.user_metadata?.full_name || session.user.email,
          asset_name: form.assetName,
          asset_type: form.assetType,
          serial_number: form.serialNumber || null,
          asset_tag: form.assetTag || null,
          make_model: form.makeModel || null,
          condition_notes: form.conditionNotes || null,
          condition_photo_path: photoPath,
        },
      ]);

      if (insertError) {
        setError(insertError.message);
        setSubmitting(false);
        return;
      }

      setForm({
        assetName: "",
        assetType: "",
        serialNumber: "",
        assetTag: "",
        makeModel: "",
        conditionNotes: "",
        photo: null,
      });

      setShowForm(false);
      fetchAssets();
    } catch (err) {
      console.error(err);
      setError("Unexpected error: " + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function openPhoto(path) {
    if (!path || !session) return;

    const { data, error } = await supabase.storage
      .from("asset-photos")
      .createSignedUrl(path, 60);

    if (error) {
      showToast(error.message, "error");
      return;
    }

    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    }
  }

  async function requestReturnConfirmation(asset) {
    if (!session) {
      showToast("Sign in first to submit a return confirmation request.", "warning");
      return;
    }

    if (returnStatusByAssetId[asset.id] === "pending") {
      showToast("You already have a pending return request for this asset.", "info");
      return;
    }

    const payload = {
      asset_id: asset.id,
      employee_email: session.user.email,
      employee_name: session.user.user_metadata?.full_name || session.user.email,
      asset_name: asset.asset_name,
      asset_type: asset.asset_type || null,
      asset_tag: asset.asset_tag || null,
      serial_number: asset.serial_number || null,
      status: "pending",
      requested_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("asset_return_requests").insert([payload]);
    if (error) {
      showToast("Could not create return request: " + error.message, "error");
      return;
    }

    setReturnStatusByAssetId((current) => ({ ...current, [asset.id]: "pending" }));
    showToast("Return request sent to HR for confirmation.", "success");

    const { error: emailError } = await supabase.functions.invoke(
      "send-asset-return-request-email",
      {
        body: {
          employee_name: payload.employee_name,
          employee_email: payload.employee_email,
          asset_name: payload.asset_name,
          asset_type: payload.asset_type,
          asset_tag: payload.asset_tag,
          serial_number: payload.serial_number,
        },
      }
    );

    if (emailError) {
      console.error("Return request email error:", emailError.message);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.08),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.06),_transparent_22%),#f6f7fb] p-3 sm:p-4">
      <div className="mx-auto max-w-6xl space-y-3">
        <section className="rounded-[24px] border border-zinc-200/80 bg-white p-4 shadow-[0_10px_30px_rgba(0,0,0,0.06)] sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                Employee Asset Portal
              </p>
              <h1 className="mt-1.5 text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl">
                My Assets
              </h1>
              <p className="mt-1.5 max-w-2xl text-sm leading-5 text-zinc-600">
                View assigned devices, update condition details, and jump into issue reporting.
              </p>
            </div>

            <button
              onClick={() => setShowForm((v) => !v)}
              className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-700"
            >
              {showForm ? "Close form" : "Add Asset"}
            </button>
          </div>

          {!session ? (
            <div className="mt-3 rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm leading-5 text-amber-800">
              Preview mode is active right now. Google / OIDC login and real asset saving
              will be connected next.
            </div>
          ) : null}
        </section>

        {showForm ? (
          <section className="rounded-[24px] border border-zinc-200/80 bg-white p-4 shadow-[0_10px_30px_rgba(0,0,0,0.06)] sm:p-5">
            <h2 className="text-lg font-bold text-zinc-900">Register New Asset</h2>
            <p className="mt-1 text-sm leading-5 text-zinc-600">
              Add the asset currently assigned to you, including a photo of its condition.
            </p>

            {error ? (
              <div className="mt-3 rounded-[18px] border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">
                {error}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Asset name" required>
                <Input
                  value={form.assetName}
                  onChange={(v) => updateField("assetName", v)}
                  placeholder="e.g. Work Laptop"
                />
              </Field>

              <Field label="Asset type" required>
                <select
                  value={form.assetType}
                  onChange={(e) => updateField("assetType", e.target.value)}
                  className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  required
                >
                  <option value="">Select asset type</option>
                  {assetTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Serial number">
                <Input
                  value={form.serialNumber}
                  onChange={(v) => updateField("serialNumber", v)}
                  placeholder="e.g. C02XG2JHJGH5"
                />
              </Field>

              <Field label="Asset tag / IT tag">
                <Input
                  value={form.assetTag}
                  onChange={(v) => updateField("assetTag", v)}
                  placeholder="e.g. IT-LAP-0042"
                />
              </Field>

              <Field label="Make / Model">
                <Input
                  value={form.makeModel}
                  onChange={(v) => updateField("makeModel", v)}
                  placeholder="e.g. Dell Latitude 5440"
                />
              </Field>

              <Field label="Current condition photo">
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp"
                  onChange={(e) => updateField("photo", e.target.files?.[0] || null)}
                  className="block w-full text-sm text-zinc-700 file:mr-4 file:rounded-xl file:border-0 file:bg-blue-600 file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-700"
                />
              </Field>

              <div className="md:col-span-2">
                <Field label="Condition notes">
                  <textarea
                    rows={3}
                    value={form.conditionNotes}
                    onChange={(e) => updateField("conditionNotes", e.target.value)}
                    placeholder="Describe the asset's current physical condition, visible damage, or anything IT should know."
                    className="w-full rounded-[18px] border border-zinc-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </Field>
              </div>

              <div className="md:col-span-2 flex gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-700 disabled:opacity-60"
                >
                  {submitting ? "Saving asset..." : session ? "Save Asset" : "Preview Only"}
                </button>

                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-2xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:-translate-y-0.5 hover:bg-zinc-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        ) : null}

        <section className="rounded-[24px] border border-zinc-200/80 bg-white p-4 shadow-[0_10px_30px_rgba(0,0,0,0.06)] sm:p-5">
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-base font-bold text-zinc-900">Registered Assets</h2>
              <p className="mt-1 text-sm leading-5 text-zinc-600">
                Assets currently registered under your account.
              </p>
            </div>
            <div className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
              {loading
                ? "Loading"
                : `${visibleAssets.length} item${visibleAssets.length === 1 ? "" : "s"}`}
            </div>
          </div>

          {loading ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-52 animate-pulse rounded-[20px] border border-zinc-200/80 bg-zinc-100/60"
                />
              ))}
            </div>
          ) : visibleAssets.length === 0 ? (
            <div className="mt-4 rounded-[18px] bg-zinc-50 p-4 text-sm text-zinc-600">
              No assets registered yet. Click <strong>Add Asset</strong> to create your first record.
            </div>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {visibleAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="rounded-[20px] border border-zinc-200/80 bg-zinc-50/70 p-3.5 shadow-[0_4px_14px_rgba(0,0,0,0.04)]"
                >
                  {photoPreviewUrls[asset.id] ? (
                    <button
                      type="button"
                      onClick={() => openPhoto(asset.condition_photo_path)}
                      className="group mb-3 block w-full overflow-hidden rounded-[16px] border border-zinc-200 bg-zinc-100"
                    >
                      <img
                        src={photoPreviewUrls[asset.id]}
                        alt={`${asset.asset_name} condition`}
                        className="h-36 w-full object-cover transition duration-200 group-hover:scale-[1.02]"
                        loading="lazy"
                      />
                    </button>
                  ) : (
                    <div className="mb-3 flex h-20 items-center justify-center rounded-[16px] border border-dashed border-zinc-300 bg-zinc-100/70 text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
                      No photo
                    </div>
                  )}

                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">{asset.asset_name}</p>
                      <p className="mt-1 text-sm text-zinc-500">{asset.asset_type}</p>
                    </div>
                    <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
                      #{asset.id}
                    </span>
                  </div>

                  <div className="mt-3 space-y-2 text-sm">
                    <AssetRow label="Make / Model" value={asset.make_model} />
                    <AssetRow label="Serial Number" value={asset.serial_number} />
                    <AssetRow label="Asset Tag" value={asset.asset_tag} />
                    <AssetRow
                      label="Assigned"
                      value={
                        asset.assigned_at
                          ? new Date(asset.assigned_at).toLocaleDateString()
                          : "-"
                      }
                    />
                  </div>

                  <div className="mt-3 rounded-[16px] bg-white p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      Condition Notes
                    </p>
                    <p className="mt-1.5 text-sm leading-5 text-zinc-700">
                      {asset.condition_notes || "No condition notes added."}
                    </p>
                  </div>

                  <div className="mt-3 flex gap-2">
                    {asset.condition_photo_path && session ? (
                      <button
                        onClick={() => openPhoto(asset.condition_photo_path)}
                        className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-blue-700"
                      >
                        View Photo
                      </button>
                    ) : null}

                    <button
                      onClick={() => onReportIssue?.(asset)}
                      className="rounded-2xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:-translate-y-0.5 hover:bg-zinc-50"
                    >
                      Report Issue
                    </button>

                    <button
                      onClick={() => requestReturnConfirmation(asset)}
                      disabled={returnStatusByAssetId[asset.id] === "pending"}
                      className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
                        returnStatusByAssetId[asset.id] === "pending"
                          ? "cursor-not-allowed border border-amber-300 bg-amber-50 text-amber-700"
                          : returnStatusByAssetId[asset.id] === "confirmed"
                          ? "border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          : "border border-zinc-300 bg-white text-zinc-700 hover:-translate-y-0.5 hover:bg-zinc-50"
                      }`}
                    >
                      {returnStatusByAssetId[asset.id] === "pending"
                        ? "Return Requested"
                        : returnStatusByAssetId[asset.id] === "confirmed"
                        ? "Return Confirmed"
                        : "I Returned This Asset"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        {toast ? <InlineToast tone={toast.tone} message={toast.message} /> : null}
      </div>
    </div>
  );
}

function Field({ label, required = false, children }) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-semibold text-zinc-900">
        {label} {required ? <span className="text-orange-500">*</span> : null}
      </div>
      {children}
    </label>
  );
}

function Input({ value, onChange, placeholder }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-2 text-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
    />
  );
}

function AssetRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-zinc-500">{label}</span>
      <span className="text-right font-medium text-zinc-900">{value || "-"}</span>
    </div>
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
    <div className="fixed bottom-5 right-5 z-50 max-w-sm">
      <div className={`rounded-2xl border px-4 py-3 text-sm shadow-lg ${toneMap[tone]}`}>
        {message}
      </div>
    </div>
  );
}
