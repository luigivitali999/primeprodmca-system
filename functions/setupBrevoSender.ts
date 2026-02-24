import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
const FROM_EMAIL = "dmca@foryoulink.com";
const FROM_NAME = "PRIME DMCA Intelligence";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "Content-Type" } });
  }

  try {
    const base44 = createClientFromRequest(req);

    console.log(`[BREVO SETUP] Checking sender: ${FROM_EMAIL}`);

    // Step 1: List all senders
    const listRes = await fetch("https://api.brevo.com/v3/senders", {
      method: "GET",
      headers: { "api-key": BREVO_API_KEY, "Accept": "application/json" },
    });

    if (!listRes.ok) {
      const error = await listRes.text();
      console.error(`[BREVO SETUP] Failed to list senders: ${error}`);
      return Response.json({ error: `Failed to list senders: ${error}` }, { status: 500 });
    }

    const sendersList = await listRes.json();
    console.log(`[BREVO SETUP] Found ${sendersList.senders?.length || 0} senders`);

    // Check if our sender already exists
    const existingSender = sendersList.senders?.find(s => s.email === FROM_EMAIL);
    
    if (existingSender) {
      console.log(`[BREVO SETUP] Sender ${FROM_EMAIL} already exists`);
      return Response.json({
        success: true,
        email: FROM_EMAIL,
        status: existingSender.enabled ? "verified" : "pending_verification",
        message: existingSender.enabled ? "Sender is active" : "Sender is registered but needs verification",
      });
    }

    // Step 2: Register new sender
    console.log(`[BREVO SETUP] Registering new sender: ${FROM_EMAIL}`);

    const createRes = await fetch("https://api.brevo.com/v3/senders", {
      method: "POST",
      headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: FROM_EMAIL,
        name: FROM_NAME,
        ips: [],
      }),
    });

    if (!createRes.ok) {
      const error = await createRes.text();
      console.error(`[BREVO SETUP] Failed to create sender: ${error}`);
      return Response.json({ error: `Failed to register sender: ${error}` }, { status: 500 });
    }

    const newSender = await createRes.json();
    console.log(`[BREVO SETUP] Sender registered, ID: ${newSender.id}`);

    return Response.json({
      success: true,
      email: FROM_EMAIL,
      status: "pending_verification",
      message: "Sender registered. Check your email to verify the sender address.",
      senderId: newSender.id,
    });
  } catch (error) {
    console.error("[BREVO SETUP] Error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});