import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
const FROM_EMAIL = "dmca@myonly.me";
const FROM_NAME = "PRIME DMCA Intelligence";

function generateNoticeNumber() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PRIME-${ts}-${rand}`;
}

function buildDMCAEmail({ creatorName, leakUrl, domain, noticeNumber, fromEmail }) {
  const today = new Date().toISOString().split("T")[0];
  return `Dear DMCA Agent / Abuse Department at ${domain},

This is a formal DMCA Takedown Notice submitted pursuant to the Digital Millennium Copyright Act (17 U.S.C. § 512).

NOTICE NUMBER: ${noticeNumber}
DATE: ${today}

COPYRIGHT OWNER: ${creatorName}
INFRINGING URL: ${leakUrl}
HOSTING ENTITY: ${domain}

The content at the URL above reproduces, without authorization, original copyrighted material owned exclusively by ${creatorName}. This content has been published without the owner's consent and constitutes copyright infringement.

We hereby request the immediate removal of the above-mentioned infringing content.

By submitting this notice, I declare under penalty of perjury that I am authorized to act on behalf of the copyright owner and that the information in this notice is accurate.

Please confirm removal at: ${fromEmail}

Sincerely,
PRIME DMCA Intelligence System
Email: ${fromEmail}`.trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "Content-Type, Authorization" } });
  }

  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const dmcaRequestId = body.dmca_request_id;

    if (!dmcaRequestId) return Response.json({ error: "Missing dmca_request_id" }, { status: 400 });

    console.log(`[BATCH SEND] Starting for DMCA request: ${dmcaRequestId}`);

    const [dmcaRequest, leaks, domains] = await Promise.all([
      base44.asServiceRole.entities.DMCARequest.get(dmcaRequestId),
      base44.asServiceRole.entities.Leak.list(),
      base44.asServiceRole.entities.DomainIntelligence.list(),
    ]);

    if (!dmcaRequest) return Response.json({ error: "DMCA Request not found" }, { status: 404 });

    const leak = leaks.find(l => l.id === dmcaRequest.leak_id);
    if (!leak) return Response.json({ error: "Leak not found" }, { status: 404 });

    // Find domain intelligence for abuse email
    let abuseEmail = null;
    const domainIntel = domains.find(d => d.domain_name === leak.domain);
    
    if (domainIntel?.abuse_email) {
      abuseEmail = domainIntel.abuse_email;
      console.log(`[BATCH SEND] Found abuse_email in DomainIntelligence: ${abuseEmail}`);
    } else if (domainIntel?.dmca_contact) {
      abuseEmail = domainIntel.dmca_contact;
      console.log(`[BATCH SEND] Found dmca_contact in DomainIntelligence: ${abuseEmail}`);
    } else {
      console.log(`[BATCH SEND] No email in DomainIntelligence for domain ${leak.domain}`);
      // Return error - don't attempt extraction from website
    }

    if (!abuseEmail) {
      console.warn(`[BATCH SEND] No abuse email found for domain ${leak.domain}`);
      return Response.json({ error: "No abuse email found for this domain" }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(abuseEmail)) {
      console.error(`[BATCH SEND] INVALID EMAIL FORMAT: "${abuseEmail}" (length: ${abuseEmail.length})`);
      return Response.json({ error: `Invalid email format: "${abuseEmail}"` }, { status: 400 });
    }

    const emailBody = buildDMCAEmail({
      creatorName: dmcaRequest.creator_name,
      leakUrl: leak.leak_url,
      domain: leak.domain,
      noticeNumber: dmcaRequest.notice_number,
      fromEmail: FROM_EMAIL,
    });

    console.log(`[BATCH SEND] Sending to ${abuseEmail} for domain ${leak.domain}`);
    console.log(`[BATCH SEND] BREVO_API_KEY present: ${BREVO_API_KEY ? 'YES (first 10: ' + BREVO_API_KEY.substring(0, 10) + '...)' : 'NO'}`);

    const payload = {
      sender: { name: FROM_NAME, email: FROM_EMAIL },
      to: [{ email: abuseEmail, name: `Abuse @ ${leak.domain}` }],
      replyTo: { email: FROM_EMAIL },
      subject: `DMCA Takedown Notice – ${dmcaRequest.notice_number} – ${leak.domain}`,
      textContent: emailBody,
    };
    
    console.log(`[BATCH SEND] Payload about to send:`, JSON.stringify(payload, null, 2));
    console.log(`[BATCH SEND] Making POST request to https://api.brevo.com/v3/smtp/email`);

    const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const brevoText = await brevoRes.text();
    console.log(`[BATCH SEND] Brevo response status: ${brevoRes.status}`);
    console.log(`[BATCH SEND] Brevo response headers:`, Object.fromEntries(brevoRes.headers.entries()));
    console.log(`[BATCH SEND] Brevo response body: ${brevoText}`);

    if (!brevoRes.ok) {
      console.error(`[BATCH SEND] Brevo error: ${brevoText}`);
      return Response.json({ error: `Failed to send email: ${brevoText}` }, { status: 500 });
    }

    const today = new Date().toISOString().split("T")[0];

    // Update DMCA request status
    await base44.asServiceRole.entities.DMCARequest.update(dmcaRequestId, {
      status: "sent",
      sent_date: today,
    });

    // Update leak status
    await base44.asServiceRole.entities.Leak.update(leak.id, {
      status: "notice_sent",
      first_notice_date: today,
    });

    console.log(`[BATCH SEND] Successfully sent DMCA for request ${dmcaRequestId}`);

    return Response.json({
      success: true,
      dmcaRequestId,
      domain: leak.domain,
      abuseEmail,
      sentDate: today,
    });
  } catch (error) {
    console.error("[BATCH SEND] Fatal error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});