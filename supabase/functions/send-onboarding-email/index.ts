import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders } from "npm:@supabase/supabase-js/cors";

const TYPE_LABELS: Record<string, string> = {
  asset: "Asset",
  software: "Software",
  access: "System Access",
  other: "Other",
};

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  asset:    { bg: "#eff6ff", text: "#1d4ed8" },
  software: { bg: "#f5f3ff", text: "#6d28d9" },
  access:   { bg: "#fffbeb", text: "#92400e" },
  other:    { bg: "#f4f4f5", text: "#3f3f46" },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      employee_email,
      employee_name,
      department,
      created_by,
      checklist_id,
      items = [],
    } = await req.json();

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: "Missing RESEND_API_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const itemRows = items
      .map((item: { item_description: string; item_type: string }) => {
        const c = TYPE_COLORS[item.item_type] || TYPE_COLORS.other;
        const label = TYPE_LABELS[item.item_type] || "Other";
        return `
          <tr style="border-bottom:1px solid #e4e4e7;">
            <td style="padding:12px 16px;">
              <span style="background:${c.bg};color:${c.text};font-size:11px;font-weight:700;padding:3px 9px;border-radius:20px;">
                ${label}
              </span>
            </td>
            <td style="padding:12px 16px;font-size:14px;color:#111827;">${item.item_description}</td>
            <td style="padding:12px 16px;text-align:center;">
              <span style="font-size:18px;">☐</span>
            </td>
          </tr>`;
      })
      .join("");

    const html = `
      <div style="margin:0;padding:0;background:#f6f7fb;font-family:Arial,sans-serif;color:#18181b;">
        <div style="max-width:680px;margin:0 auto;padding:32px 20px;">
          <div style="background:#fff;border:1px solid #e4e4e7;border-radius:24px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.06);">

            <div style="padding:32px;background:linear-gradient(135deg,#059669 0%,#047857 100%);color:#fff;">
              <div style="font-size:11px;letter-spacing:.24em;text-transform:uppercase;font-weight:700;color:#a7f3d0;">
                Gjirafa • Onboarding
              </div>
              <h1 style="margin:14px 0 0;font-size:28px;font-weight:700;">
                Welcome, ${employee_name || employee_email}!
              </h1>
              <p style="margin:14px 0 0;font-size:15px;line-height:1.7;color:#d1fae5;">
                Your onboarding checklist has been prepared${department ? ` for the <strong>${department}</strong> team` : ""}.
                Please review and sign off each item in the Asset Management System.
              </p>
            </div>

            <div style="padding:32px;">
              <table style="width:100%;border-collapse:collapse;border:1px solid #e4e4e7;border-radius:16px;overflow:hidden;">
                <thead>
                  <tr style="background:#f9fafb;">
                    <th style="padding:12px 16px;text-align:left;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#71717a;width:130px;">Type</th>
                    <th style="padding:12px 16px;text-align:left;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#71717a;">Item</th>
                    <th style="padding:12px 16px;text-align:center;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#71717a;width:80px;">Done</th>
                  </tr>
                </thead>
                <tbody>${itemRows}</tbody>
              </table>

              <div style="margin-top:24px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:14px;padding:16px 18px;font-size:13px;color:#166534;">
                Log in to the Asset Management System to sign off each item once you have received it.
              </div>

              <div style="margin-top:20px;">
                <a href="https://asset-issue-report.vercel.app/?view=onboarding"
                   style="display:inline-block;background:#059669;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:14px 22px;border-radius:16px;">
                  Open My Onboarding Checklist
                </a>
              </div>

              <p style="margin-top:18px;font-size:12px;color:#71717a;">
                Checklist ID: ${checklist_id} &nbsp;|&nbsp; Prepared by: ${created_by}
              </p>
            </div>

            <div style="padding:20px 32px;background:#fafafa;border-top:1px solid #e4e4e7;">
              <p style="margin:0;font-size:12px;line-height:1.7;color:#71717a;">
                This message was sent automatically by the Gjirafa Asset Management System.
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
        to: [employee_email],
        subject: `Your onboarding checklist is ready — ${items.length} item${items.length !== 1 ? "s" : ""} to sign off`,
        html,
      }),
    });

    const resendData = await emailResponse.json();

    return new Response(
      JSON.stringify({ resend_ok: emailResponse.ok, resend_response: resendData }),
      {
        status: emailResponse.ok ? 200 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
