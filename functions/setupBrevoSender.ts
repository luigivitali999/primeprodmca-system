import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
const FROM_EMAIL = "dmca@myonly.me";
const FROM_NAME = "PRIME DMCA Intelligence";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "Content-Type" } });
  }

  try {
    const base44 = createClientFromRequest(req);

    console.log(`[BREVO SETUP] Verifying API key and checking sender ${FROM_EMAIL}`);

    const listRes = await fetch("https://api.brevo.com/v3/senders", {
      method: "GET",
      headers: {
        "api-key": BREVO_API_KEY,
        "Accept": "application/json",
      },
    });

    if (!listRes.ok) {
      const error = await listRes.text();
      console.error(`[BREVO SETUP] Failed to list senders: ${error}`);
      return Response.json({ error: `Failed to list senders: ${error}` }, { status: 500 });
    }

    const sendersList = await listRes.json();
    const existingSender = sendersList.senders?.find(s => s.email === FROM_EMAIL);

    return Response.json({
      success: true,
      message: "API key verified",
      email: FROM_EMAIL,
      senderExists: !!existingSender,
      senderEnabled: existingSender?.enabled || false,
    });
  } catch (error) {
    console.error("[BREVO SETUP] Error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});