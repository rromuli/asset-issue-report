import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabaseClient";

export default function AllAssets() {
  const [assets, setAssets] = useState([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState({});
  const [activePhoto, setActivePhoto] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [scanError, setScanError] = useState("");
  const [scanPayload, setScanPayload] = useState(null);
  const [scanMatch, setScanMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanTimerRef = useRef(null);
  const scanBusyRef = useRef(false);

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

  async function openPhoto(path, fallbackUrl, label) {
    if (!path && !fallbackUrl) return;

    if (path) {
      const { data, error } = await supabase.storage
        .from("asset-photos")
        .createSignedUrl(path, 300);

      if (!error && data?.signedUrl) {
        setActivePhoto({ url: data.signedUrl, label });
        return;
      }
    }

    if (fallbackUrl) {
      setActivePhoto({ url: fallbackUrl, label });
      return;
    }

    setError("Could not open photo.");
  }

  async function handleQrImageSelected(file) {
    if (!file) return;
    setScanError("");
    setScanPayload(null);
    setScanMatch(null);

    if (!("BarcodeDetector" in window)) {
      setScanError("QR scanning is not supported in this browser. Paste scanned QR text instead.");
      return;
    }

    try {
      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      const bitmap = await createImageBitmap(file);
      const results = await detector.detect(bitmap);

      if (!results?.length || !results[0]?.rawValue) {
        setScanError("No QR code detected in the image.");
        return;
      }

      applyScanValue(results[0].rawValue);
    } catch (scanErr) {
      setScanError("Could not scan QR: " + scanErr.message);
    }
  }

  function applyScanValue(rawValue) {
    const parsed = parseQrPayload(rawValue);
    if (!parsed) {
      setScanError("Scanned code is not a valid asset QR payload.");
      setScanPayload(null);
      setScanMatch(null);
      return;
    }

    setScanPayload(parsed);
    const match = findMatchingAsset(parsed, assets);
    setScanMatch(match || null);
    if (!match) {
      setScanError("Scanned QR is valid, but no matching active asset was found.");
    } else {
      setScanError("");
    }
  }

  function stopCameraScan() {
    if (scanTimerRef.current) {
      clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }

  async function startCameraScan() {
    setScanError("");
    if (!("BarcodeDetector" in window)) {
      setScanError("Live camera QR scanning is not supported in this browser.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setScanError("Camera access is not available in this browser.");
      return;
    }

    try {
      stopCameraScan();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;

      if (!videoRef.current) {
        setScanError("Video preview not ready.");
        stopCameraScan();
        return;
      }

      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraActive(true);

      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      scanTimerRef.current = window.setInterval(async () => {
        if (!videoRef.current || scanBusyRef.current) return;
        scanBusyRef.current = true;
        try {
          const results = await detector.detect(videoRef.current);
          if (results?.length && results[0]?.rawValue) {
            applyScanValue(results[0].rawValue);
            stopCameraScan();
          }
        } catch {
          // keep scanner running; transient frame errors are expected
        } finally {
          scanBusyRef.current = false;
        }
      }, 450);
    } catch (cameraErr) {
      setScanError("Camera access failed: " + cameraErr.message);
      stopCameraScan();
    }
  }

  function closeScanner() {
    stopCameraScan();
    setScannerOpen(false);
  }

  useEffect(() => {
    if (!scannerOpen) {
      stopCameraScan();
    }
    return () => {
      stopCameraScan();
    };
  }, [scannerOpen]);

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
          <div className="mt-3">
            <button
              type="button"
              onClick={() => {
                setScannerOpen(true);
                setScanError("");
                setScanPayload(null);
                setScanMatch(null);
              }}
              className="rounded-2xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
            >
              Scan Asset QR
            </button>
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
                            onClick={() =>
                              openPhoto(
                                asset.condition_photo_path,
                                photoPreviewUrls[asset.id],
                                `${asset.asset_name} - ${asset.employee_name || asset.employee_email}`
                              )
                            }
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

      {activePhoto ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
          onClick={() => setActivePhoto(null)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-3 shadow-[0_20px_50px_rgba(0,0,0,0.2)] sm:p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="truncate text-sm font-semibold text-zinc-800">{activePhoto.label}</p>
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
              alt={activePhoto.label}
              className="max-h-[70vh] w-full rounded-xl object-contain"
            />
          </div>
        </div>
      ) : null}

      {scannerOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
          onClick={closeScanner}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_20px_50px_rgba(0,0,0,0.2)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-zinc-900">Scan Asset QR</h3>
              <button
                type="button"
                onClick={closeScanner}
                className="rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
              >
                Close
              </button>
            </div>

            <p className="mt-2 text-sm text-zinc-600">
              Use camera scan, upload a QR image, or paste scanned QR text to find the matching asset.
            </p>

            <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={startCameraScan}
                  className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Use Camera
                </button>
                {cameraActive ? (
                  <button
                    type="button"
                    onClick={stopCameraScan}
                    className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    Stop Camera
                  </button>
                ) : null}
              </div>
              <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200 bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="h-44 w-full object-cover"
                />
              </div>
              <p className="mt-2 text-xs text-zinc-600">
                {cameraActive
                  ? "Camera is active. Point it at the QR code."
                  : "Tap Use Camera to scan directly from your phone camera."}
              </p>
            </div>

            <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <label className="block text-sm font-medium text-zinc-700">
                QR image
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => handleQrImageSelected(e.target.files?.[0] || null)}
                  className="mt-2 block w-full text-sm text-zinc-700 file:mr-3 file:rounded-xl file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-700"
                />
              </label>
            </div>

            <div className="mt-3">
              <label className="block text-sm font-medium text-zinc-700">
                Paste QR payload
                <textarea
                  rows={3}
                  onBlur={(e) => {
                    if (e.target.value.trim()) applyScanValue(e.target.value.trim());
                  }}
                  placeholder='{"employee_name":"...","serial_number":"...","asset_type":"..."}'
                  className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </label>
            </div>

            {scanError ? (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {scanError}
              </div>
            ) : null}

            {scanPayload ? (
              <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm">
                <p className="font-semibold text-zinc-900">Scanned QR</p>
                <p className="mt-1 text-zinc-700">
                  {scanPayload.employee_name || "-"} | {scanPayload.serial_number || "-"} |{" "}
                  {scanPayload.asset_type || "-"}
                </p>
              </div>
            ) : null}

            {scanMatch ? (
              <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm">
                <p className="font-semibold text-emerald-900">Matching asset found</p>
                <p className="mt-1 text-emerald-800">
                  {scanMatch.asset_name || "-"} | SN: {scanMatch.serial_number || "-"} |{" "}
                  {scanMatch.employee_name || scanMatch.employee_email || "-"}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm(scanMatch.serial_number || scanMatch.asset_name || "");
                    setScannerOpen(false);
                  }}
                  className="mt-2 rounded-xl border border-emerald-300 bg-white px-3 py-1.5 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
                >
                  Show in table
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function parseQrPayload(rawValue) {
  try {
    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.serial_number || !parsed.asset_type) return null;
    return parsed;
  } catch {
    return null;
  }
}

function findMatchingAsset(payload, assets) {
  const serial = String(payload.serial_number || "").trim().toLowerCase();
  const type = String(payload.asset_type || "").trim().toLowerCase();
  const employee = String(payload.employee_name || "").trim().toLowerCase();

  return (
    assets.find((asset) => {
      const serialMatch = String(asset.serial_number || "").trim().toLowerCase() === serial;
      const typeMatch = String(asset.asset_type || "").trim().toLowerCase() === type;
      if (!serialMatch || !typeMatch) return false;

      if (!employee) return true;
      const name = String(asset.employee_name || "").trim().toLowerCase();
      const email = String(asset.employee_email || "").trim().toLowerCase();
      return name === employee || email === employee;
    }) || null
  );
}
