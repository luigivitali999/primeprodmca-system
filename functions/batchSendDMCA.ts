import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
const FROM_DOMAIN = "foryoulink.com";

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
    } else if (domainIntel?.dmca_contact) {
      abuseEmail = domainIntel.dmca_contact;
    } else {
      // Try to extract email from website
      console.log(`[BATCH SEND] Email not in database, attempting to extract from ${leak.domain}`);
      try {
        const extractRes = await base44.asServiceRole.functions.invoke('extractAbuseEmail', {
          domain: leak.domain,
        });
        abuseEmail = extractRes.data?.abuseEmail;
        if (abuseEmail) {
          console.log(`[BATCH SEND] Successfully extracted email: ${abuseEmail}`);
          // Update domain intelligence for future use
          if (domainIntel) {
            await base44.asServiceRole.entities.DomainIntelligence.update(domainIntel.id, { abuse_email: abuseEmail });
          }
        }
      } catch (err) {
        console.warn(`[BATCH SEND] Failed to extract email: ${err.message}`);
      }
    }

    if (!abuseEmail) {
      console.warn(`[BATCH SEND] No abuse email found for domain ${leak.domain}`);
      return Response.json({ error: "No abuse email found for this domain" }, { status: 400 });
    }

    const creatorSlug = (dmcaRequest.creator_name || "dmca").toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 30);
    const fromEmail = `${creatorSlug}@${FROM_DOMAIN}`;
    const emailBody = buildDMCAEmail({
      creatorName: dmcaRequest.creator_name,
      leakUrl: leak.leak_url,
      domain: leak.domain,
      noticeNumber: dmcaRequest.notice_number,
      fromEmail,
    });

    console.log(`[BATCH SEND] Sending to ${abuseEmail} for domain ${leak.domain}`);

    const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({
        sender: { name: dmcaRequest.creator_name, email: fromEmail },
        to: [{ email: abuseEmail, name: `Abuse @ ${leak.domain}` }],
        replyTo: { email: fromEmail },
        subject: `DMCA Takedown Notice – ${dmcaRequest.notice_number} – ${leak.domain}`,
        textContent: emailBody,
      }),
    });

    if (!brevoRes.ok) {
      console.error(`[BATCH SEND] Brevo error: ${await brevoRes.text()}`);
      return Response.json({ error: `Failed to send email: ${await brevoRes.text()}` }, { status: 500 });
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