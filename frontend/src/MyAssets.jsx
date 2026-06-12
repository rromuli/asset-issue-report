import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { supabase } from "./supabaseClient";

const MAX_ORIGINAL_UPLOAD_BYTES = 8 * 1024 * 1024;
const TARGET_UPLOAD_MAX_BYTES = 500 * 1024;

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
    asset_tag: "IT-GJIR-042",
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
    asset_tag: "IT-GJIR-018",
    make_model: "iPhone 14",
    assigned_at: new Date().toISOString(),
    condition_notes: "Minor cosmetic wear on frame. Screen condition is good.",
    condition_photo_path: null,
  },
];

export default function MyAssets({ session, onReportIssue }) {
  const [assets, setAssets] = useState([]);
  const [selectedAssetIds, setSelectedAssetIds] = useState([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState({});
  const [returnStatusByAssetId, setReturnStatusByAssetId] = useState({});
  const [activePhoto, setActivePhoto] = useState(null);
  const [tagAsset, setTagAsset] = useState(null);
  const [tagQrUrl, setTagQrUrl] = useState(null);
  const [confirmReturnAsset, setConfirmReturnAsset] = useState(null);
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
  const selectedVisibleCount = visibleAssets.filter((asset) =>
    selectedAssetIds.includes(asset.id)
  ).length;

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

  useEffect(() => {
    setSelectedAssetIds((current) =>
      current.filter((id) => visibleAssets.some((asset) => asset.id === id))
    );
  }, [visibleAssets]);

  useEffect(() => {
    if (!tagAsset) {
      setTagQrUrl(null);
      return;
    }
    QRCode.toDataURL(buildQrValue(tagAsset), { width: 220, margin: 1 })
      .then((url) => setTagQrUrl(url))
      .catch(() => setTagQrUrl(null));
  }, [tagAsset]);

  async function fetchAssets() {
    setLoading(true);
    setError("");

    if (!session?.user?.email) {
      setAssets([]);
      setPhotoPreviewUrls({});
      setReturnStatusByAssetId({});
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("employee_assets")
      .select(
        "id, employee_name, asset_name, asset_type, serial_number, asset_tag, make_model, assigned_at, condition_notes, condition_photo_path"
      )
      .eq("employee_email", session.user.email)
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
      if (!form.photo) {
        setError("A condition photo is required for each asset.");
        setSubmitting(false);
        return;
      }

      if (form.photo.size > MAX_ORIGINAL_UPLOAD_BYTES) {
        setError("Photo is too large. Please use an image up to 8 MB.");
        setSubmitting(false);
        return;
      }

      const assetTagValue =
        form.assetTag?.trim() || generateItTag(form.assetType || "Other");

      if (form.photo) {
        const optimizedPhoto = await optimizePhotoForUpload(form.photo);
        const cleanName = form.photo.name.replace(/\.[^/.]+$/, "");
        const fileName = `${Date.now()}-${cleanName}.jpg`;
        const filePath = `${session.user.email}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("asset-photos")
          .upload(filePath, optimizedPhoto);

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
          asset_tag: assetTagValue || null,
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
      showToast(`Asset saved. IT Tag: ${assetTagValue}`, "success");
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
      setActivePhoto({ url: data.signedUrl });
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

  function buildQrValue(asset) {
    const payload = {
      employee_name:
        asset.employee_name ||
        session?.user?.user_metadata?.full_name ||
        session?.user?.email ||
        "-",
      serial_number: asset.serial_number || "-",
      asset_type: asset.asset_type || "-",
      it_tag: asset.asset_tag || "-",
    };
    return JSON.stringify(payload);
  }

  async function printIdTag(asset) {
    let qrSrc;
    try {
      qrSrc = await QRCode.toDataURL(buildQrValue(asset), { width: 220, margin: 1 });
    } catch {
      showToast("Could not generate QR code.", "error");
      return;
    }
    const popup = window.open("", "_blank", "width=420,height=620");
    if (!popup) {
      showToast("Pop-up blocked. Please allow pop-ups to print the tag.", "warning");
      return;
    }

    popup.document.write(`
      <html>
        <head>
          <title>Asset ID Tag</title>
          <style>
            @page { size: 2in 1in; margin: 0; }
            * { box-sizing: border-box; }
            html, body { margin: 0; padding: 0; width: 2in; height: 1in; overflow: hidden; }
            body { font-family: Arial, sans-serif; color: #111827; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .tag {
              width: 2in;
              height: 1in;
              border: 1px solid #111827;
              border-radius: 0.06in;
              padding: 0.04in;
              display: grid;
              grid-template-columns: 0.8in 1fr;
              gap: 0.04in;
              align-items: center;
            }
            .qr img { width: 0.7in; height: 0.7in; display: block; margin: 0 auto; }
            .title { font-size: 7px; letter-spacing: .04em; text-transform: uppercase; color: #374151; line-height: 1.1; }
            .name { margin-top: 0.01in; font-size: 8px; font-weight: 700; line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .meta { margin-top: 0.03in; font-size: 7px; line-height: 1.2; }
            .meta div { max-width: 1.05in; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          </style>
        </head>
        <body>
          <div class="tag">
            <div class="qr">
              <img src="${qrSrc}" alt="Asset QR code" />
            </div>
            <div>
              <div class="title">Asset Management System</div>
              <div class="name">${escapeHtml(asset.asset_name || "Asset")}</div>
              <div class="meta">
                <div><strong>Tag:</strong> ${escapeHtml(asset.asset_tag || "-")}</div>
                <div><strong>Type:</strong> ${escapeHtml(asset.asset_type || "-")}</div>
                <div><strong>SN:</strong> ${escapeHtml(asset.serial_number || "-")}</div>
              </div>
            </div>
          </div>
          <script>
            const waitForImages = () => {
              const images = Array.from(document.images);
              if (!images.length) return Promise.resolve();
              return Promise.all(
                images.map((img) =>
                  img.complete
                    ? Promise.resolve()
                    : new Promise((resolve) => {
                        img.onload = resolve;
                        img.onerror = resolve;
                      })
                )
              );
            };
            waitForImages().then(() => {
              setTimeout(() => {
                window.print();
              }, 120);
            });
          </script>
        </body>
      </html>
    `);
    popup.document.close();
  }

  function toggleAssetSelection(assetId) {
    setSelectedAssetIds((current) =>
      current.includes(assetId)
        ? current.filter((id) => id !== assetId)
        : [...current, assetId]
    );
  }

  function selectAllVisibleAssets() {
    setSelectedAssetIds(visibleAssets.map((asset) => asset.id));
  }

  function clearSelectedAssets() {
    setSelectedAssetIds([]);
  }

  async function printSelectedTags() {
    const selectedAssets = visibleAssets.filter((asset) => selectedAssetIds.includes(asset.id));

    if (selectedAssets.length === 0) {
      showToast("Select at least one asset first.", "warning");
      return;
    }

    let qrSources;
    try {
      qrSources = await Promise.all(
        selectedAssets.map((asset) =>
          QRCode.toDataURL(buildQrValue(asset), { width: 220, margin: 1 })
        )
      );
    } catch {
      showToast("Could not generate QR codes.", "error");
      return;
    }

    const popup = window.open("", "_blank", "width=1000,height=760");
    if (!popup) {
      showToast("Pop-up blocked. Please allow pop-ups to print tags.", "warning");
      return;
    }

    const tagsHtml = selectedAssets
      .map((asset, i) => {
        const qrSrc = qrSources[i];
        return `
          <div class="tag">
            <div class="qr">
              <img src="${qrSrc}" alt="Asset QR code" />
            </div>
            <div>
              <div class="title">Asset Management System</div>
              <div class="name">${escapeHtml(asset.asset_name || "Asset")}</div>
              <div class="meta">
                <div><strong>Tag:</strong> ${escapeHtml(asset.asset_tag || "-")}</div>
                <div><strong>Type:</strong> ${escapeHtml(asset.asset_type || "-")}</div>
                <div><strong>SN:</strong> ${escapeHtml(asset.serial_number || "-")}</div>
              </div>
            </div>
          </div>
        `;
      })
      .join("");

    popup.document.write(`
      <html>
        <head>
          <title>Print Selected Asset Tags</title>
          <style>
            @page { size: 2in 1in; margin: 0; }
            * { box-sizing: border-box; }
            html, body { margin: 0; padding: 0; width: 2in; }
            body { font-family: Arial, sans-serif; color: #111827; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .tag {
              width: 2in;
              height: 1in;
              border: 1px solid #111827;
              border-radius: 0.06in;
              padding: 0.04in;
              display: grid;
              grid-template-columns: 0.8in 1fr;
              gap: 0.04in;
              align-items: center;
              page-break-after: always;
              break-after: page;
            }
            .qr img { width: 0.7in; height: 0.7in; display: block; margin: 0 auto; }
            .title { font-size: 7px; letter-spacing: .04em; text-transform: uppercase; color: #374151; line-height: 1.1; }
            .name { margin-top: 0.01in; font-size: 8px; font-weight: 700; line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .meta { margin-top: 0.03in; font-size: 7px; line-height: 1.2; }
            .meta div { max-width: 1.05in; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          </style>
        </head>
        <body>
          ${tagsHtml}
          <script>
            const waitForImages = () => {
              const images = Array.from(document.images);
              if (!images.length) return Promise.resolve();
              return Promise.all(
                images.map((img) =>
                  img.complete
                    ? Promise.resolve()
                    : new Promise((resolve) => {
                        img.onload = resolve;
                        img.onerror = resolve;
                      })
                )
              );
            };
            waitForImages().then(() => {
              setTimeout(() => {
                window.print();
              }, 120);
            });
          </script>
        </body>
      </html>
    `);
    popup.document.close();
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.08),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.06),_transparent_22%),#f6f7fb] p-2 sm:p-3">
      <div className="mx-auto max-w-7xl space-y-2.5">
        <section className="rounded-[18px] border border-zinc-200/80 bg-white p-3 shadow-[0_8px_24px_rgba(0,0,0,0.05)] sm:p-4">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Employee Asset Portal
              </p>
              <h1 className="mt-1 text-lg font-bold tracking-tight text-zinc-900 sm:text-xl">
                My Assets
              </h1>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-zinc-600 sm:text-sm">
                View assigned devices, update condition details, and jump into issue reporting.
              </p>
            </div>

            <button
              onClick={() => setShowForm((v) => !v)}
              className="rounded-xl bg-blue-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              {showForm ? "Close form" : "Add Asset"}
            </button>
          </div>

          {!session ? (
            <div className="mt-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-5 text-amber-800">
              Sign in with your @gjirafa.com account to view and manage your assets.
            </div>
          ) : null}
        </section>

        {showForm ? (
          <section className="rounded-[18px] border border-zinc-200/80 bg-white p-3 shadow-[0_8px_24px_rgba(0,0,0,0.05)] sm:p-4">
            <h2 className="text-base font-bold text-zinc-900">Register New Asset</h2>
            <p className="mt-1 text-sm leading-5 text-zinc-600">
              Add the asset currently assigned to you, including a photo of its condition.
            </p>

            {error ? (
              <div className="mt-2.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {error}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="mt-3 grid grid-cols-1 gap-2.5 md:grid-cols-3">
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
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
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
                  placeholder="e.g. IT-GJIR-042"
                />
              </Field>

              <Field label="Make / Model">
                <Input
                  value={form.makeModel}
                  onChange={(v) => updateField("makeModel", v)}
                  placeholder="e.g. Dell Latitude 5440"
                />
              </Field>

              <Field label="Current condition photo" required>
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp"
                  onChange={(e) => updateField("photo", e.target.files?.[0] || null)}
                  required
                  className="block w-full text-sm text-zinc-700 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-700"
                />
              </Field>

              <div className="md:col-span-3">
                <Field label="Condition notes">
                  <textarea
                    rows={2}
                    value={form.conditionNotes}
                    onChange={(e) => updateField("conditionNotes", e.target.value)}
                    placeholder="Describe the asset's current physical condition, visible damage, or anything IT should know."
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </Field>
              </div>

              <div className="flex gap-2 md:col-span-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-blue-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
                >
                  {submitting ? "Saving asset..." : session ? "Save Asset" : "Preview Only"}
                </button>

                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-xl border border-zinc-300 bg-white px-3.5 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        ) : null}

        <section className="rounded-[18px] border border-zinc-200/80 bg-white p-3 shadow-[0_8px_24px_rgba(0,0,0,0.05)] sm:p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-bold text-zinc-900">Registered Assets</h2>
              <p className="mt-0.5 text-xs leading-5 text-zinc-600 sm:text-sm">
                Assets currently registered under your account.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
                {loading
                  ? "Loading"
                  : `${visibleAssets.length} item${visibleAssets.length === 1 ? "" : "s"}`}
              </div>
              {!loading && visibleAssets.length > 0 ? (
                <>
                  <button
                    type="button"
                    onClick={selectAllVisibleAssets}
                    className="rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={clearSelectedAssets}
                    className="rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={printSelectedTags}
                    className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    Print selected ({selectedVisibleCount})
                  </button>
                </>
              ) : null}
            </div>
          </div>

          {loading ? (
            <div className="mt-3 grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-40 animate-pulse rounded-[16px] border border-zinc-200/80 bg-zinc-100/60"
                />
              ))}
            </div>
          ) : visibleAssets.length === 0 ? (
            <div className="mt-3 rounded-xl bg-zinc-50 p-3 text-sm text-zinc-600">
              No assets registered yet. Click <strong>Add Asset</strong> to create your first record.
            </div>
          ) : (
            <div className="mt-3 grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
              {visibleAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="rounded-[16px] border border-zinc-200/80 bg-zinc-50/70 p-2.5 shadow-[0_3px_10px_rgba(0,0,0,0.04)]"
                >
                  {photoPreviewUrls[asset.id] ? (
                    <button
                      type="button"
                      onClick={() => openPhoto(asset.condition_photo_path)}
                      className="group mb-2 block w-full overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100"
                    >
                      <img
                        src={photoPreviewUrls[asset.id]}
                        alt={`${asset.asset_name} condition`}
                        className="h-24 w-full object-cover transition duration-200 group-hover:scale-[1.02] sm:h-28"
                        loading="lazy"
                      />
                    </button>
                  ) : (
                    <div className="mb-2 flex h-14 items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-100/70 text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500">
                      No photo
                    </div>
                  )}

                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-zinc-900">{asset.asset_name}</p>
                      <p className="mt-0.5 text-xs text-zinc-500">{asset.asset_type}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <label className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700">
                        <input
                          type="checkbox"
                          checked={selectedAssetIds.includes(asset.id)}
                          onChange={() => toggleAssetSelection(asset.id)}
                        />
                        Select
                      </label>
                      <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700">
                        #{asset.id}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 space-y-1.5 text-xs">
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

                  <div className="mt-2 rounded-xl bg-white p-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                      Condition Notes
                    </p>
                    <p className="mt-1 max-h-10 overflow-hidden text-xs leading-5 text-zinc-700">
                      {asset.condition_notes || "No condition notes added."}
                    </p>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {asset.condition_photo_path && session ? (
                      <button
                        onClick={() => openPhoto(asset.condition_photo_path)}
                        className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
                      >
                        View Photo
                      </button>
                    ) : null}

                    <button
                      onClick={() => onReportIssue?.(asset)}
                      className="rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
                    >
                      Report Issue
                    </button>

                    <button
                      onClick={() => setTagAsset(asset)}
                      className="rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
                    >
                      ID Tag
                    </button>

                    <button
                      onClick={() => setConfirmReturnAsset(asset)}
                      disabled={returnStatusByAssetId[asset.id] === "pending"}
                      className={`rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                        returnStatusByAssetId[asset.id] === "pending"
                          ? "cursor-not-allowed border border-amber-300 bg-amber-50 text-amber-700"
                        : returnStatusByAssetId[asset.id] === "confirmed"
                          ? "border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
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

        {activePhoto ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
            onClick={() => setActivePhoto(null)}
          >
            <div
              className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-3 shadow-[0_20px_50px_rgba(0,0,0,0.2)] sm:p-4"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setActivePhoto(null)}
                  className="rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
                >
                  Close
                </button>
              </div>
              <img
                src={activePhoto.url}
                alt="Asset condition"
                className="max-h-[70vh] w-full rounded-xl object-contain"
              />
            </div>
          </div>
        ) : null}

        {tagAsset ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
            onClick={() => setTagAsset(null)}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_20px_50px_rgba(0,0,0,0.2)]"
              onClick={(event) => event.stopPropagation()}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Printable Asset Tag
              </p>
              <h3 className="mt-1 text-lg font-bold text-zinc-900">{tagAsset.asset_name}</h3>
              <p className="mt-1 text-sm text-zinc-600">
                ID #{tagAsset.id} | {tagAsset.asset_type || "-"}
              </p>

              <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                <img
                  src={tagQrUrl || ""}
                  alt="Asset QR code"
                  className="mx-auto h-48 w-48 rounded-lg bg-white p-2"
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => printIdTag(tagAsset)}
                  className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  Print Tag
                </button>
                <button
                  type="button"
                  onClick={() => setTagAsset(null)}
                  className="rounded-2xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {confirmReturnAsset ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
            onClick={() => setConfirmReturnAsset(null)}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_20px_50px_rgba(0,0,0,0.2)]"
              onClick={(event) => event.stopPropagation()}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Confirm Return Request
              </p>
              <h3 className="mt-1 text-lg font-bold text-zinc-900">
                Submit return confirmation?
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-700">
                This will notify HR that you returned
                {" "}
                <span className="font-semibold">{confirmReturnAsset.asset_name}</span>
                {" "}
                and ask them to confirm it in the admin dashboard.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    const asset = confirmReturnAsset;
                    setConfirmReturnAsset(null);
                    if (asset) {
                      await requestReturnConfirmation(asset);
                    }
                  }}
                  className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  Yes, Submit
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReturnAsset(null)}
                  className="rounded-2xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const ASSET_TYPE_PREFIX = {
  Laptop: "LAP",
  Phone: "PHN",
  Monitor: "MON",
  Keyboard: "KBD",
  Mouse: "MSE",
  Accessory: "ACC",
};

function generateItTag(assetType) {
  const prefix = ASSET_TYPE_PREFIX[assetType] || "OTH";
  const randomPart = Math.floor(100 + Math.random() * 900);
  return `IT-${prefix}-${randomPart}`;
}

async function optimizePhotoForUpload(file) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Only image files are allowed for asset photos.");
  }

  const image = await readImageFile(file);
  const ratio = image.width > 1600 ? 1600 / image.width : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * ratio));
  canvas.height = Math.max(1, Math.round(image.height * ratio));

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not process image file.");
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  let quality = 0.82;
  let blob = await canvasToBlob(canvas, "image/jpeg", quality);

  while (blob.size > TARGET_UPLOAD_MAX_BYTES && quality > 0.52) {
    quality -= 0.08;
    blob = await canvasToBlob(canvas, "image/jpeg", quality);
  }

  return new File([blob], "asset-photo.jpg", {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

function readImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Could not read image data."));
      img.src = reader.result;
    };

    reader.onerror = () => reject(new Error("Could not open selected file."));
    reader.readAsDataURL(file);
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Image conversion failed."));
          return;
        }
        resolve(blob);
      },
      type,
      quality
    );
  });
}

function Field({ label, required = false, children }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-xs font-semibold text-zinc-900 sm:text-sm">
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
      className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
    />
  );
}

function AssetRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-zinc-500">{label}</span>
      <span className="break-all text-right font-medium text-zinc-900">{value || "-"}</span>
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
    <div className="fixed bottom-4 left-4 right-4 z-50 sm:bottom-5 sm:left-auto sm:right-5 sm:max-w-sm">
      <div className={`rounded-2xl border px-4 py-3 text-sm shadow-lg ${toneMap[tone]}`}>
        {message}
      </div>
    </div>
  );
}
