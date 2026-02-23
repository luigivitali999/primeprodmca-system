import { createClientFromRequest } from "npm:@base44/sdk";

// This endpoint is called by Cloudflare Email Routing (or Brevo inbound webhook)
// Configure in Cloudflare: Email Routing → Catch-all → Send to HTTP → this URL
// OR in Brevo: Settings → Inbound Parsing → Webhook URL

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "Content-Type, Authorization" } });
  }

  try {
    // Parse incoming email payload (Brevo inbound format or Cloudflare)
    let payload: any = {};
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      payload = await req.json();
    } else if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      for (const [key, value] of formData.entries()) {
        payload[key] = value;
      }
    } else {
      payload = await req.json().catch(() => ({}));
    }

    // Extract email fields (Brevo inbound schema)
    const fromEmail: string = payload.From || payload.from || payload.sender || "";
    const subject: string = payload.Subject || payload.subject || "";
    const bodyText: string = payload.TextContent || payload.text || payload.body || "";
    const toEmail: string = payload.To || payload.to || "";

    // Extract PRIME notice number from subject or headers
    const noticeMatch = subject.match(/DMCA-\d{4}-\d+/i) || bodyText.match(/NOTICE NUMBER[:\s]+([A-Z0-9-]+)/i);
    const noticeNumber = noticeMatch ? noticeMatch[1] || noticeMatch[0] : null;

    // Detect if it's a removal confirmation
    const isRemovalConfirmed = /removed|taken down|deleted|complied|actioned/i.test(subject + " " + bodyText);
    const isRejection = /reject|denied|not remove|cannot comply|fair use/i.test(subject + " " + bodyText);

    // Use service role to update DB without user auth (this is a webhook)
    const base44 = createClientFromRequest(req);

    // Find matching DMCARequest by notice number or sender domain
    let dmcaRequests: any[] = [];
    if (noticeNumber) {
      dmcaRequests = await base44.asServiceRole.entities.DMCARequest.filter({ notice_number: noticeNumber });
    }

    // If no match by notice, try to match by sender domain
    if (dmcaRequests.length === 0 && fromEmail) {
      const senderDomain = fromEmail.split("@")[1] || "";
      // Get all recent pending requests
      const allPending = await base44.asServiceRole.entities.DMCARequest.filter({ status: "sent" });
      dmcaRequests = allPending.filter((r: any) =>
        r.sent_to_entity && senderDomain && r.sent_to_entity.toLowerCase().includes(senderDomain.toLowerCase())
      ).slice(0, 1);
    }

    const today = new Date().toISOString().split("T")[0];

    // Update matching DMCARequest(s)
    for (const dmca of dmcaRequests) {
      const updateData: any = {
        response_received: `Da: ${fromEmail}\nOggetto: ${subject}\n\n${bodyText.slice(0, 1000)}`,
        response_date: today,
        status: isRemovalConfirmed ? "completed" : isRejection ? "rejected" : "acknowledged",
      };

      if (isRemovalConfirmed) {
        updateData.removal_confirmed = true;
        updateData.removal_confirmation_date = today;
      }

      await base44.asServiceRole.entities.DMCARequest.update(dmca.id, updateData);

      // Also update associated Leak
      if (dmca.leak_id) {
        const leakUpdate: any = {};
        if (isRemovalConfirmed) {
          leakUpdate.status = "removed";
          leakUpdate.removal_date = today;
        } else if (isRejection) {
          leakUpdate.status = "rejected";
        } else {
          leakUpdate.status = "waiting";
        }
        await base44.asServiceRole.entities.Leak.update(dmca.leak_id, leakUpdate);
      }
    }

    return Response.json({
      success: true,
      matched: dmcaRequests.length,
      isRemovalConfirmed,
      isRejection,
      noticeNumber,
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});