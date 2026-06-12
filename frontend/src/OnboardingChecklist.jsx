import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

const DEPARTMENTS = [
  "IT", "Tech", "HR", "Finance", "Operations",
  "Marketing", "Customer Support", "Warehouse", "Other",
];

const ITEM_TYPES = [
  { value: "asset",    label: "Asset",         color: "bg-blue-50 text-blue-700 ring-1 ring-blue-200" },
  { value: "software", label: "Software",      color: "bg-violet-50 text-violet-700 ring-1 ring-violet-200" },
  { value: "access",   label: "System Access", color: "bg-amber-50 text-amber-700 ring-1 ring-amber-200" },
  { value: "other",    label: "Other",         color: "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200" },
];

function typeStyle(type) {
  return ITEM_TYPES.find((t) => t.value === type)?.color ?? ITEM_TYPES[3].color;
}
function typeLabel(type) {
  return ITEM_TYPES.find((t) => t.value === type)?.label ?? "Other";
}

function ProgressBar({ done, total }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between text-xs font-medium text-zinc-500 mb-1">
        <span>{done} of {total} signed off</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-zinc-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${pct === 100 ? "bg-emerald-500" : "bg-blue-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function OnboardingChecklist({ session, isAdmin, adminRole }) {
  const [checklists, setChecklists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [signingOff, setSigningOff] = useState(null);
  const [notice, setNotice] = useState(null);

  const [form, setForm] = useState({ employee_email: "", employee_name: "", department: "", notes: "" });
  const [items, setItems] = useState([{ item_description: "", item_type: "asset" }]);

  const userEmail = session?.user?.email?.toLowerCase() ?? "";
  const canManage = isAdmin && (adminRole === "it" || adminRole === "hr");

  useEffect(() => { fetchChecklists(); }, []);

  async function fetchChecklists() {
    setLoading(true);
    let query = supabase
      .from("onboarding_checklists")
      .select("*, onboarding_checklist_items(*)")
      .order("created_at", { ascending: false });

    if (!isAdmin) {
      query = query.eq("employee_email", userEmail);
    }

    const { data, error } = await query;
    if (error) {
      setNotice({ tone: "error", message: "Failed to load checklists: " + error.message });
    } else {
      setChecklists(data || []);
    }
    setLoading(false);
  }

  async function handleCreate(e) {
    e.preventDefault();
    const validItems = items.filter((i) => i.item_description.trim());
    if (!form.employee_email.trim() || validItems.length === 0) {
      setNotice({ tone: "error", message: "Employee email and at least one item are required." });
      return;
    }
    setSaving(true);
    setNotice(null);

    const { data: checklist, error: clErr } = await supabase
      .from("onboarding_checklists")
      .insert({
        employee_email: form.employee_email.trim().toLowerCase(),
        employee_name: form.employee_name.trim() || null,
        department: form.department || null,
        created_by: userEmail,
        notes: form.notes.trim() || null,
        status: "pending",
      })
      .select()
      .single();

    if (clErr) {
      setNotice({ tone: "error", message: "Failed to create checklist: " + clErr.message });
      setSaving(false);
      return;
    }

    const { error: itemErr } = await supabase
      .from("onboarding_checklist_items")
      .insert(
        validItems.map((item) => ({
          checklist_id: checklist.id,
          item_description: item.item_description.trim(),
          item_type: item.item_type,
          asset_tag: item.asset_tag?.trim() || null,
          serial_number: item.serial_number?.trim() || null,
        }))
      );

    if (itemErr) {
      setNotice({ tone: "error", message: "Checklist created but items failed: " + itemErr.message });
      setSaving(false);
      return;
    }

    try {
      await supabase.functions.invoke("send-onboarding-email", {
        body: {
          employee_email: form.employee_email.trim().toLowerCase(),
          employee_name: form.employee_name.trim() || form.employee_email,
          department: form.department || null,
          created_by: userEmail,
          checklist_id: checklist.id,
          items: validItems,
        },
      });
    } catch (_) {}

    setNotice({ tone: "success", message: "Checklist created and employee notified by email." });
    setShowCreate(false);
    setForm({ employee_email: "", employee_name: "", department: "", notes: "" });
    setItems([{ item_description: "", item_type: "asset" }]);
    await fetchChecklists();
    setSaving(false);
  }

  async function handleSignOff(itemId, checklistId) {
    setSigningOff(itemId);
    const { error } = await supabase
      .from("onboarding_checklist_items")
      .update({ signed_off_at: new Date().toISOString(), signed_off_by: userEmail })
      .eq("id", itemId);

    if (error) {
      setNotice({ tone: "error", message: "Sign-off failed: " + error.message });
      setSigningOff(null);
      return;
    }

    // Auto-complete checklist when all items are signed off
    const checklist = checklists.find((c) => c.id === checklistId);
    if (checklist) {
      const remaining = checklist.onboarding_checklist_items.filter(
        (i) => !i.signed_off_at && i.id !== itemId
      );
      if (remaining.length === 0) {
        await supabase
          .from("onboarding_checklists")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("id", checklistId);
      }
    }

    setSigningOff(null);
    await fetchChecklists();
  }

  async function handleMarkComplete(checklistId) {
    await supabase
      .from("onboarding_checklists")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", checklistId);
    await fetchChecklists();
  }

  function addItem() {
    setItems([...items, { item_description: "", item_type: "other" }]);
  }

  function removeItem(idx) {
    setItems(items.filter((_, i) => i !== idx));
  }

  function updateItem(idx, field, value) {
    const next = [...items];
    next[idx] = { ...next[idx], [field]: value };
    setItems(next);
  }

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-6">

        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
              {isAdmin ? "Admin" : "Employee"}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900">
              Onboarding Checklists
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              {isAdmin
                ? "Create and track onboarding checklists for new employees."
                : "Review and sign off your onboarding items."}
            </p>
          </div>
          {canManage ? (
            <button
              onClick={() => { setShowCreate((v) => !v); setNotice(null); }}
              className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-emerald-700 shrink-0"
            >
              {showCreate ? "Cancel" : "+ New Checklist"}
            </button>
          ) : null}
        </div>

        {/* Notice */}
        {notice ? (
          <div
            className={`rounded-2xl px-5 py-4 text-sm font-medium ${
              notice.tone === "error"
                ? "bg-red-50 text-red-700 ring-1 ring-red-200"
                : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
            }`}
          >
            {notice.message}
          </div>
        ) : null}

        {/* Create form */}
        {showCreate && canManage ? (
          <form
            onSubmit={handleCreate}
            className="overflow-hidden rounded-[28px] border border-zinc-200/80 bg-white shadow-[0_10px_30px_rgba(0,0,0,0.06)]"
          >
            <div className="border-b border-zinc-200/70 bg-zinc-50/60 px-6 py-4">
              <h2 className="text-base font-semibold text-zinc-900">New Onboarding Checklist</h2>
            </div>

            <div className="space-y-5 px-6 py-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Employee Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={form.employee_email}
                    onChange={(e) => setForm({ ...form, employee_email: e.target.value })}
                    placeholder="employee@gjirafa.com"
                    className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={form.employee_name}
                    onChange={(e) => setForm({ ...form, employee_name: e.target.value })}
                    placeholder="First Last"
                    className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Department
                  </label>
                  <select
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="">Select department</option>
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Notes
                  </label>
                  <input
                    type="text"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Optional internal notes"
                    className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </div>
              </div>

              {/* Items */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Checklist Items *
                  </label>
                  <button
                    type="button"
                    onClick={addItem}
                    className="rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
                  >
                    + Add item
                  </button>
                </div>

                <div className="space-y-3">
                  {items.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-start">
                      <select
                        value={item.item_type}
                        onChange={(e) => updateItem(idx, "item_type", e.target.value)}
                        className="w-36 shrink-0 rounded-2xl border border-zinc-300 bg-white px-3 py-3 text-sm text-zinc-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      >
                        {ITEM_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        required={idx === 0}
                        value={item.item_description}
                        onChange={(e) => updateItem(idx, "item_description", e.target.value)}
                        placeholder={
                          item.item_type === "asset" ? "e.g. MacBook Pro 14-inch (2024)"
                          : item.item_type === "software" ? "e.g. Slack, Jira"
                          : item.item_type === "access" ? "e.g. Google Workspace, GitHub"
                          : "Description"
                        }
                        className="flex-1 rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      />
                      {items.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="mt-0.5 rounded-xl p-2.5 text-zinc-400 transition hover:bg-red-50 hover:text-red-500"
                        >
                          ✕
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-zinc-200/70 bg-zinc-50/60 px-6 py-4">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-2xl border border-zinc-300 bg-white px-5 py-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-emerald-700 disabled:opacity-60"
              >
                {saving ? "Creating…" : "Create & Notify Employee"}
              </button>
            </div>
          </form>
        ) : null}

        {/* List */}
        {loading ? (
          <div className="rounded-[28px] border border-zinc-200/80 bg-white px-6 py-10 text-center text-sm text-zinc-500 shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
            Loading checklists…
          </div>
        ) : checklists.length === 0 ? (
          <div className="rounded-[28px] border border-zinc-200/80 bg-white px-6 py-12 text-center shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
            <p className="text-sm font-medium text-zinc-500">
              {isAdmin ? "No onboarding checklists yet." : "You have no onboarding checklist assigned."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {checklists.map((cl) => {
              const totalItems = cl.onboarding_checklist_items?.length ?? 0;
              const doneItems = cl.onboarding_checklist_items?.filter((i) => i.signed_off_at).length ?? 0;
              const isExpanded = expandedId === cl.id;
              const isComplete = cl.status === "completed";

              return (
                <div
                  key={cl.id}
                  className="overflow-hidden rounded-[28px] border border-zinc-200/80 bg-white shadow-[0_10px_30px_rgba(0,0,0,0.06)]"
                >
                  {/* Card header */}
                  <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-semibold text-zinc-900 truncate">
                          {cl.employee_name || cl.employee_email}
                        </span>
                        {cl.employee_name ? (
                          <span className="text-sm text-zinc-400 truncate">{cl.employee_email}</span>
                        ) : null}
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${
                            isComplete
                              ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                              : "bg-amber-50 text-amber-700 ring-amber-200"
                          }`}
                        >
                          {isComplete ? "Completed" : "Pending"}
                        </span>
                        {cl.department ? (
                          <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 ring-1 ring-zinc-200">
                            {cl.department}
                          </span>
                        ) : null}
                      </div>
                      <ProgressBar done={doneItems} total={totalItems} />
                      <p className="mt-2 text-xs text-zinc-400">
                        Created {new Date(cl.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        {cl.created_by ? ` by ${cl.created_by}` : ""}
                        {cl.completed_at
                          ? ` · Completed ${new Date(cl.completed_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
                          : ""}
                      </p>
                    </div>

                    <div className="flex shrink-0 gap-2">
                      {canManage && !isComplete ? (
                        <button
                          onClick={() => handleMarkComplete(cl.id)}
                          className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                        >
                          Mark complete
                        </button>
                      ) : null}
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : cl.id)}
                        className="rounded-2xl border border-zinc-300 bg-white px-4 py-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
                      >
                        {isExpanded ? "Hide items" : `View ${totalItems} item${totalItems !== 1 ? "s" : ""}`}
                      </button>
                    </div>
                  </div>

                  {/* Items */}
                  {isExpanded ? (
                    <div className="border-t border-zinc-200/70 divide-y divide-zinc-100">
                      {(cl.onboarding_checklist_items || []).map((item) => {
                        const signed = !!item.signed_off_at;
                        const canSign = !signed && (!isAdmin || !canManage);
                        return (
                          <div
                            key={item.id}
                            className={`flex items-center gap-3 px-5 py-3.5 ${signed ? "bg-emerald-50/40" : ""}`}
                          >
                            <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${signed ? "bg-emerald-100 text-emerald-600" : "bg-zinc-100 text-zinc-400"}`}>
                              {signed ? "✓" : "○"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${typeStyle(item.item_type)}`}>
                                  {typeLabel(item.item_type)}
                                </span>
                                <span className={`text-sm font-medium ${signed ? "text-zinc-400 line-through" : "text-zinc-900"}`}>
                                  {item.item_description}
                                </span>
                              </div>
                              {signed ? (
                                <p className="mt-0.5 text-xs text-zinc-400">
                                  Signed off {new Date(item.signed_off_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                                  {item.signed_off_by ? ` by ${item.signed_off_by}` : ""}
                                </p>
                              ) : null}
                            </div>
                            {canSign ? (
                              <button
                                onClick={() => handleSignOff(item.id, cl.id)}
                                disabled={signingOff === item.id}
                                className="shrink-0 rounded-2xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:-translate-y-0.5 hover:bg-blue-700 disabled:opacity-60"
                              >
                                {signingOff === item.id ? "Saving…" : "Sign off"}
                              </button>
                            ) : null}
                          </div>
                        );
                      })}
                      {cl.notes ? (
                        <div className="px-5 py-3 text-xs text-zinc-500">
                          <span className="font-semibold text-zinc-600">Note: </span>{cl.notes}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
