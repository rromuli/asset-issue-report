import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

export default function AllAssets() {
  const [assets, setAssets] = useState([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchAssets();
  }, []);

  async function fetchAssets() {
    setLoading(true);
    setError("");

    const [
      { data: assetRows, error: assetsError },
      { data: returnRows, error: returnsError },
    ] = await Promise.all([
      supabase
        .from("employee_assets")
        .select(
          "id, employee_name, employee_email, asset_name, asset_type, serial_number, asset_tag, make_model, assigned_at, condition_photo_path, created_at"
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("asset_return_requests")
        .select("asset_id, status, requested_at")
        .order("requested_at", { ascending: false }),
    ]);

    if (assetsError) {
      setError(assetsError.message);
      setLoading(false);
      return;
    }

    const nextAssets = assetRows || [];

    if (returnsError) {
      // Keep page functional even in environments where return-requests table is unavailable.
      console.error("asset_return_requests load error:", returnsError.message);
      setAssets(nextAssets);
      setLoading(false);
      return;
    }

    const latestStatusByAssetId = {};
    for (const row of returnRows || []) {
      if (!latestStatusByAssetId[row.asset_id]) {
        latestStatusByAssetId[row.asset_id] = row.status || "pending";
      }
    }

    const visibleAssets = nextAssets.filter(
      (asset) => latestStatusByAssetId[asset.id] !== "confirmed"
    );

    setAssets(visibleAssets);
    await loadPhotoPreviews(visibleAssets);
    setLoading(false);
  }

  async function loadPhotoPreviews(assetRows) {
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

  async function openPhoto(path) {
    if (!path) return;

    const { data, error } = await supabase.storage
      .from("asset-photos")
      .createSignedUrl(path, 60);

    if (error) {
      setError("Could not open photo: " + error.message);
      return;
    }

    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    }
  }

  const filteredAssets = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return assets;

    return assets.filter((asset) => {
      return (
        (asset.employee_name || "").toLowerCase().includes(term) ||
        (asset.employee_email || "").toLowerCase().includes(term) ||
        (asset.asset_name || "").toLowerCase().includes(term) ||
        (asset.asset_type || "").toLowerCase().includes(term) ||
        (asset.serial_number || "").toLowerCase().includes(term) ||
        (asset.asset_tag || "").toLowerCase().includes(term) ||
        (asset.make_model || "").toLowerCase().includes(term)
      );
    });
  }, [assets, searchTerm]);

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
          <h2 className="font-semibold">Could not load assets</h2>
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
                All Employee Assets
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                Full inventory submitted by employees.
              </p>
            </div>
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search employee, asset, serial, tag..."
              className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 sm:w-80"
            />
          </div>
        </section>

        <section className="overflow-hidden rounded-[24px] border border-zinc-200/80 bg-white shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50/80 text-left text-zinc-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Employee</th>
                  <th className="px-5 py-3 font-semibold">Asset</th>
                  <th className="px-5 py-3 font-semibold">Photo</th>
                  <th className="px-5 py-3 font-semibold">Type</th>
                  <th className="px-5 py-3 font-semibold">Serial</th>
                  <th className="px-5 py-3 font-semibold">Tag</th>
                  <th className="px-5 py-3 font-semibold">Model</th>
                  <th className="px-5 py-3 font-semibold">Assigned</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssets.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-zinc-500">
                      No assets found.
                    </td>
                  </tr>
                ) : (
                  filteredAssets.map((asset) => (
                    <tr key={asset.id} className="border-t border-zinc-200/70">
                      <td className="px-5 py-3">
                        <div className="font-medium text-zinc-900">
                          {asset.employee_name || "-"}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {asset.employee_email || "-"}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-zinc-700">{asset.asset_name || "-"}</td>
                      <td className="px-5 py-3">
                        {photoPreviewUrls[asset.id] ? (
                          <button
                            type="button"
                            onClick={() => openPhoto(asset.condition_photo_path)}
                            className="block h-12 w-16 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100"
                          >
                            <img
                              src={photoPreviewUrls[asset.id]}
                              alt={`${asset.asset_name} condition`}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          </button>
                        ) : (
                          <span className="text-xs text-zinc-500">No photo</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-zinc-700">{asset.asset_type || "-"}</td>
                      <td className="px-5 py-3 text-zinc-700">{asset.serial_number || "-"}</td>
                      <td className="px-5 py-3 text-zinc-700">{asset.asset_tag || "-"}</td>
                      <td className="px-5 py-3 text-zinc-700">{asset.make_model || "-"}</td>
                      <td className="px-5 py-3 text-zinc-700">
                        {asset.assigned_at
                          ? new Date(asset.assigned_at).toLocaleDateString()
                          : "-"}
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
