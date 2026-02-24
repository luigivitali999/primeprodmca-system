import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
const FROM_EMAIL = "dmca@myonly.me";
const FROM_NAME = "PRIME DMCA Intelligence";

// Email validation regex - strict
const EMAIL_REGEX = /^[a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

function generateNoticeNumber() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PRIME-${ts}-${rand}`;
}

function normalizeEmail(email) {
  if (!email || typeof email !== 'string') return null;
  // Remove all whitespace (including non-breaking spaces, tabs, newlines)
  let normalized = email.replace(/[\s\u00a0\u200b\u200c\u200d\ufeff]/g, '').trim().toLowerCase();
  return normalized || null;
}

function isValidEmail(email) {
  if (!email) return false;
  return EMAIL_REGEX.test(email);
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

    // Find domain intelligence for abuse email (from structured source only)
    let abuseEmail = null;
    const domainIntel = domains.find(d => d.domain_name === leak.domain);
    
    console.log(`[BATCH SEND] Looking for abuse email for domain: ${leak.domain}`);
    
    if (domainIntel?.abuse_email) {
      abuseEmail = domainIntel.abuse_email;
      console.log(`[BATCH SEND] Found abuse_email in DomainIntelligence: "${abuseEmail}"`);
    } else if (domainIntel?.dmca_contact) {
      abuseEmail = domainIntel.dmca_contact;
      console.log(`[BATCH SEND] Found dmca_contact in DomainIntelligence: "${abuseEmail}"`);
    }

    // Normalize email (remove all invisible whitespace)
    if (abuseEmail) {
      const originalEmail = abuseEmail;
      abuseEmail = normalizeEmail(abuseEmail);
      console.log(`[BATCH SEND] Email before normalization: "${originalEmail}"`);
      console.log(`[BATCH SEND] Email after normalization: "${abuseEmail}"`);
    }

    // Validate email format
    if (!abuseEmail || !isValidEmail(abuseEmail)) {
      console.error(`[BATCH SEND] INVALID/MISSING EMAIL for domain ${leak.domain}`);
      console.error(`[BATCH SEND] Email value: "${abuseEmail}"`);
      
      // Set DMCA request to pending with note about missing contact
      const today = new Date().toISOString().split("T")[0];
      await base44.asServiceRole.entities.DMCARequest.update(dmcaRequestId, {
        status: "pending",
        notes: `No valid abuse email found in DomainIntelligence for ${leak.domain}. Email must be added via admin interface.`,
      });
      
      return Response.json({ 
        error: "Missing valid contact email", 
        domain: leak.domain,
        status: "pending",
        message: "DMCA request set to pending - email contact required"
      }, { status: 400 });
    }
    
    console.log(`[BATCH SEND] ✓ Email validation passed: ${abuseEmail}`);

    const emailBody = buildDMCAEmail({
      creatorName: dmcaRequest.creator_name,
      leakUrl: leak.leak_url,
      domain: leak.domain,
      noticeNumber: dmcaRequest.notice_number,
      fromEmail: FROM_EMAIL,
    });

    console.log(`[BATCH SEND] ✓ Preparing email payload for: ${abuseEmail}`);
    console.log(`[BATCH SEND] BREVO_API_KEY present: ${BREVO_API_KEY ? 'YES' : 'NO'}`);

    const payload = {
      sender: { name: FROM_NAME, email: FROM_EMAIL },
      to: [{ email: abuseEmail, name: `Abuse @ ${leak.domain}` }],
      replyTo: { email: FROM_EMAIL },
      subject: `DMCA Takedown Notice – ${dmcaRequest.notice_number} – ${leak.domain}`,
      textContent: emailBody,
    };
    
    // Final validation before sending
    console.log(`[BATCH SEND] ━━━ PAYLOAD SUMMARY ━━━`);
    console.log(`[BATCH SEND] From: ${payload.sender.email}`);
    console.log(`[BATCH SEND] To: ${payload.to[0].email}`);
    console.log(`[BATCH SEND] Subject: ${payload.subject}`);
    console.log(`[BATCH SEND] Notice Number: ${dmcaRequest.notice_number}`);
    console.log(`[BATCH SEND] ━━━ SENDING TO BREVO ━━━`);

    const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const brevoText = await brevoRes.text();
    let brevoData = null;
    try {
      brevoData = JSON.parse(brevoText);
    } catch (e) {
      brevoData = brevoText;
    }

    console.log(`[BATCH SEND] Brevo response status: ${brevoRes.status}`);
    console.log(`[BATCH SEND] Brevo response body:`, brevoData);

    if (!brevoRes.ok) {
      console.error(`[BATCH SEND] Brevo error:`, brevoData);
      return Response.json({ error: `Failed to send email: ${JSON.stringify(brevoData)}` }, { status: 500 });
    }
    
    // Log message ID if available
    if (brevoData?.messageId) {
      console.log(`[BATCH SEND] Brevo messageId: ${brevoData.messageId}`);
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