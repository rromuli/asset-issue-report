import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders } from "npm:@supabase/supabase-js/cors";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      employee_name,
      employee_email,
      asset_name,
      asset_type,
      asset_tag,
      serial_number,
    } = await req.json();

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
        from: "Asset Management System <onboarding@resend.dev>",
        to: ["rron.s@gjirafa.com"],
        subject: `Asset Return Confirmation Request - ${asset_name}`,
        html: `
          <div style="font-family:Arial,sans-serif;color:#111827;line-height:1.6">
            <h2>Asset Return Confirmation Request</h2>
            <p>An employee marked an asset as returned and is requesting HR confirmation.</p>
            <ul>
              <li><strong>Employee:</strong> ${employee_name || "-"}</li>
              <li><strong>Email:</strong> ${employee_email || "-"}</li>
              <li><strong>Asset:</strong> ${asset_name || "-"}</li>
              <li><strong>Type:</strong> ${asset_type || "-"}</li>
              <li><strong>Asset Tag:</strong> ${asset_tag || "-"}</li>
              <li><strong>Serial Number:</strong> ${serial_number || "-"}</li>
            </ul>
            <p>
              Open dashboard:
              <a href="https://asset-issue-report.vercel.app/?view=admin">Admin Dashboard</a>
            </p>
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
