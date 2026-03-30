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

export default function MyAssets({ session }) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(!!session);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    assetName: "",
    assetType: "",
    serialNumber: "",
    assetTag: "",
    makeModel: "",
    conditionNotes: "",
    photo: null,
  });

  useEffect(() => {
    if (session) {
      fetchAssets();
    } else {
      setAssets(previewAssets);
      setLoading(false);
    }
  }, [session]);

  async function fetchAssets() {
    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from("employee_assets")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setAssets(data || []);
    setLoading(false);
  }

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!session) {
      alert("Authentication will be connected later. For now this page is in preview mode.");
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
      alert(error.message);
      return;
    }

    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.08),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.06),_transparent_22%),#f6f7fb] p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[32px] border border-zinc-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(0,0,0,0.06)] sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                Employee Asset Portal
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 sm:text-5xl">
                My Assets
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-600 sm:text-base">
                View assets registered under your name, document their current condition,
                and prepare for support or replacement workflows.
              </p>
            </div>

            <button
              onClick={() => setShowForm((v) => !v)}
              className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-700"
            >
              {showForm ? "Close form" : "Add Asset"}
            </button>
          </div>

          {!session ? (
            <div className="mt-6 rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-7 text-amber-800">
              Preview mode is active right now. Google / OIDC login and real asset saving
              will be connected next.
            </div>
          ) : null}
        </section>

        {showForm ? (
          <section className="rounded-[32px] border border-zinc-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(0,0,0,0.06)] sm:p-8">
            <h2 className="text-xl font-bold text-zinc-900">Register New Asset</h2>
            <p className="mt-2 text-sm leading-7 text-zinc-600">
              Add the asset currently assigned to you, including a photo of its condition.
            </p>

            {error ? (
              <div className="mt-5 rounded-[24px] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
                {error}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
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
                  className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
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
                    rows={5}
                    value={form.conditionNotes}
                    onChange={(e) => updateField("conditionNotes", e.target.value)}
                    placeholder="Describe the asset's current physical condition, visible damage, or anything IT should know."
                    className="w-full rounded-[24px] border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </Field>
              </div>

              <div className="md:col-span-2 flex gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-700 disabled:opacity-60"
                >
                  {submitting ? "Saving asset..." : session ? "Save Asset" : "Preview Only"}
                </button>

                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-2xl border border-zinc-300 bg-white px-5 py-3 text-sm font-medium text-zinc-700 transition hover:-translate-y-0.5 hover:bg-zinc-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        ) : null}

        <section className="rounded-[32px] border border-zinc-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(0,0,0,0.06)] sm:p-8">
          <h2 className="text-xl font-bold text-zinc-900">Registered Assets</h2>
          <p className="mt-2 text-sm leading-7 text-zinc-600">
            Assets currently registered under your account.
          </p>

          {loading ? (
            <div className="mt-6 text-sm text-zinc-500">Loading assets...</div>
          ) : assets.length === 0 ? (
            <div className="mt-6 rounded-[24px] bg-zinc-50 p-6 text-sm text-zinc-600">
              No assets registered yet. Click <strong>Add Asset</strong> to create your first record.
            </div>
          ) : (
            <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {assets.map((asset) => (
                <div
                  key={asset.id}
                  className="rounded-[28px] border border-zinc-200/80 bg-white p-5 shadow-[0_6px_18px_rgba(0,0,0,0.05)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-zinc-900">{asset.asset_name}</p>
                      <p className="mt-1 text-sm text-zinc-500">{asset.asset_type}</p>
                    </div>
                    <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
                      #{asset.id}
                    </span>
                  </div>

                  <div className="mt-5 space-y-3 text-sm">
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

                  <div className="mt-5 rounded-[20px] bg-zinc-50 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      Condition Notes
                    </p>
                    <p className="mt-2 text-sm leading-7 text-zinc-700">
                      {asset.condition_notes || "No condition notes added."}
                    </p>
                  </div>

                  <div className="mt-5 flex gap-3">
                    {asset.condition_photo_path && session ? (
                      <button
                        onClick={() => openPhoto(asset.condition_photo_path)}
                        className="rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-blue-700"
                      >
                        View Photo
                      </button>
                    ) : null}

                    <button
                      className="rounded-2xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:-translate-y-0.5 hover:bg-zinc-50"
                    >
                      Report Issue
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
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
      className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
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