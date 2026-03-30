import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders } from "npm:@supabase/supabase-js/cors";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    const {
      full_name,
      employee_id,
      department,
      asset_type,
      issue_category,
      severity,
      technical_assessment,
      report_id,
    } = body;

    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: "Missing RESEND_API_KEY" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "IT Support <onboarding@resend.dev>",
        to: ["rron.s@gjirafa.com"],
        subject: `Approval Required - Asset Replacement Request - ${asset_type}`,
        html: `
          <div style="margin:0;padding:0;background:#f6f7fb;font-family:Arial,sans-serif;color:#18181b;">
            <div style="max-width:680px;margin:0 auto;padding:32px 20px;">
              <div style="background:#ffffff;border:1px solid #e4e4e7;border-radius:24px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.06);">
                
                <div style="padding:32px 32px 24px 32px;background:linear-gradient(135deg,#111827 0%,#1f2937 100%);color:#ffffff;">
                  <div style="font-size:11px;letter-spacing:0.24em;text-transform:uppercase;font-weight:700;color:#cbd5e1;">
                    Gjirafa • Approval Workflow
                  </div>
                  <h1 style="margin:14px 0 0 0;font-size:30px;line-height:1.2;font-weight:700;">
                    Replacement Approval Required
                  </h1>
                  <p style="margin:14px 0 0 0;font-size:15px;line-height:1.7;color:#e5e7eb;">
                    IT has marked this asset as not repairable and is requesting approval for replacement.
                  </p>
                </div>

                <div style="padding:32px;">
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
                    <div style="background:#f9fafb;border-radius:18px;padding:16px;">
                      <div style="font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#71717a;">Employee</div>
                      <div style="margin-top:8px;font-size:15px;font-weight:600;color:#111827;">${full_name}</div>
                    </div>

                    <div style="background:#f9fafb;border-radius:18px;padding:16px;">
                      <div style="font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#71717a;">Employee ID</div>
                      <div style="margin-top:8px;font-size:15px;font-weight:600;color:#111827;">${employee_id}</div>
                    </div>

                    <div style="background:#f9fafb;border-radius:18px;padding:16px;">
                      <div style="font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#71717a;">Department</div>
                      <div style="margin-top:8px;font-size:15px;font-weight:600;color:#111827;">${department}</div>
                    </div>

                    <div style="background:#f9fafb;border-radius:18px;padding:16px;">
                      <div style="font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#71717a;">Asset Type</div>
                      <div style="margin-top:8px;font-size:15px;font-weight:600;color:#111827;">${asset_type}</div>
                    </div>

                    <div style="background:#f9fafb;border-radius:18px;padding:16px;">
                      <div style="font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#71717a;">Issue Category</div>
                      <div style="margin-top:8px;font-size:15px;font-weight:600;color:#111827;">${issue_category}</div>
                    </div>

                    <div style="background:#f9fafb;border-radius:18px;padding:16px;">
                      <div style="font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#71717a;">Severity</div>
                      <div style="margin-top:8px;font-size:15px;font-weight:600;color:#111827;">${severity}</div>
                    </div>
                  </div>

                  <div style="margin-top:16px;background:#ffffff;border:1px solid #e4e4e7;border-radius:18px;padding:18px;">
                    <div style="font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#71717a;">IT Technical Assessment</div>
                    <div style="margin-top:10px;font-size:15px;line-height:1.8;color:#3f3f46;">
                      ${technical_assessment || "No assessment provided."}
                    </div>
                  </div>

                  <div style="margin-top:24px;">
                    <a href="https://asset-issue-report.vercel.app/?view=admin" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:14px 22px;border-radius:16px;">
                      Review in Admin Dashboard
                    </a>
                  </div>

                  <p style="margin-top:18px;font-size:12px;color:#71717a;">
                    Report Reference ID: ${report_id}
                  </p>
                </div>

                <div style="padding:20px 32px;background:#fafafa;border-top:1px solid #e4e4e7;">
                  <p style="margin:0;font-size:12px;line-height:1.7;color:#71717a;">
                    This approval request was generated automatically by the Asset Issue Reporting System.
                  </p>
                </div>
              </div>
            </div>
          </div>
        `,
      }),
    });

    const resendData = await emailResponse.json();

    return new Response(
      JSON.stringify({
        resend_ok: emailResponse.ok,
        resend_status: emailResponse.status,
        resend_response: resendData,
      }),
      {
        status: emailResponse.ok ? 200 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});