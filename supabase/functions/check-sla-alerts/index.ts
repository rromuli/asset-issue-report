import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SLA_DAYS: Record<string, number> = { High: 2, Medium: 5 };

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const itEmail = Deno.env.get("IT_ALERT_EMAIL") || "rron.s@gjirafa.com";

    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: "Missing RESEND_API_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: reports, error } = await supabase
      .from("asset_issue_reports")
      .select("id, full_name, employee_id, department, asset_type, severity, issue_category, created_at, status")
      .not("status", "eq", "resolved")
      .is("sla_notified_at", null)
      .in("severity", ["High", "Medium"]);

    if (error) throw error;

    const now = Date.now();
    const overdue = (reports || []).filter((r) => {
      const ageDays = (now - new Date(r.created_at).getTime()) / 86400000;
      return ageDays > (SLA_DAYS[r.severity] ?? Infinity);
    });

    if (overdue.length === 0) {
      return new Response(
        JSON.stringify({ message: "No overdue reports.", notified: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rows = overdue
      .map((r) => {
        const ageDays = ((now - new Date(r.created_at).getTime()) / 86400000).toFixed(1);
        const color = r.severity === "High" ? "#dc2626" : "#d97706";
        return `
          <tr style="border-bottom:1px solid #e4e4e7;">
            <td style="padding:12px 16px;font-size:14px;color:#111827;">${r.full_name || "—"}</td>
            <td style="padding:12px 16px;font-size:14px;color:#3f3f46;">${r.department || "—"}</td>
            <td style="padding:12px 16px;font-size:14px;color:#3f3f46;">${r.asset_type || "—"}</td>
            <td style="padding:12px 16px;font-size:14px;color:#3f3f46;">${r.issue_category || "—"}</td>
            <td style="padding:12px 16px;">
              <span style="background:${color}1a;color:${color};font-size:12px;font-weight:700;padding:3px 10px;border-radius:20px;">
                ${r.severity}
              </span>
            </td>
            <td style="padding:12px 16px;font-size:14px;font-weight:600;color:#dc2626;">${ageDays}d</td>
          </tr>`;
      })
      .join("");

    const emailHtml = `
      <div style="margin:0;padding:0;background:#f6f7fb;font-family:Arial,sans-serif;color:#18181b;">
        <div style="max-width:720px;margin:0 auto;padding:32px 20px;">
          <div style="background:#fff;border:1px solid #e4e4e7;border-radius:24px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.06);">

            <div style="padding:32px;background:linear-gradient(135deg,#7c3aed 0%,#6d28d9 100%);color:#fff;">
              <div style="font-size:11px;letter-spacing:.24em;text-transform:uppercase;font-weight:700;color:#ddd6fe;">
                Gjirafa • SLA Alert
              </div>
              <h1 style="margin:14px 0 0;font-size:28px;font-weight:700;">
                ${overdue.length} Overdue Report${overdue.length > 1 ? "s" : ""}
              </h1>
              <p style="margin:14px 0 0;font-size:15px;line-height:1.7;color:#ede9fe;">
                The following reports have exceeded their SLA thresholds and need immediate attention.
              </p>
            </div>

            <div style="padding:32px;">
              <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:14px;padding:14px 18px;margin-bottom:24px;font-size:13px;color:#92400e;">
                SLA thresholds: <strong>High = 2 days</strong> &nbsp;|&nbsp; <strong>Medium = 5 days</strong>
              </div>

              <table style="width:100%;border-collapse:collapse;border:1px solid #e4e4e7;border-radius:16px;overflow:hidden;">
                <thead>
                  <tr style="background:#f9fafb;">
                    <th style="padding:12px 16px;text-align:left;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#71717a;">Employee</th>
                    <th style="padding:12px 16px;text-align:left;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#71717a;">Department</th>
                    <th style="padding:12px 16px;text-align:left;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#71717a;">Asset</th>
                    <th style="padding:12px 16px;text-align:left;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#71717a;">Issue</th>
                    <th style="padding:12px 16px;text-align:left;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#71717a;">Severity</th>
                    <th style="padding:12px 16px;text-align:left;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#71717a;">Age</th>
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>

              <div style="margin-top:24px;">
                <a href="https://asset-issue-report.vercel.app/?view=admin"
                   style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:14px 22px;border-radius:16px;">
                  Open Admin Dashboard
                </a>
              </div>
            </div>

            <div style="padding:20px 32px;background:#fafafa;border-top:1px solid #e4e4e7;">
              <p style="margin:0;font-size:12px;line-height:1.7;color:#71717a;">
                Generated automatically by the Asset Management System. Each report is notified once per SLA breach.
              </p>
            </div>
          </div>
        </div>
      </div>`;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "IT Support <onboarding@resend.dev>",
        to: [itEmail],
        subject: `SLA Alert: ${overdue.length} overdue report${overdue.length > 1 ? "s" : ""} require attention`,
        html: emailHtml,
      }),
    });

    if (!emailResponse.ok) {
      const err = await emailResponse.json();
      throw new Error(`Resend error: ${JSON.stringify(err)}`);
    }

    const ids = overdue.map((r) => r.id);
    await supabase
      .from("asset_issue_reports")
      .update({ sla_notified_at: new Date().toISOString() })
      .in("id", ids);

    return new Response(
      JSON.stringify({ message: "SLA alert sent.", notified: overdue.length, report_ids: ids }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
