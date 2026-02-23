import { createClientFromRequest } from "npm:@base44/sdk";

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
const FROM_DOMAIN = "foryoulink.com";
const FROM_EMAIL = `dmca@${FROM_DOMAIN}`;
const FROM_NAME = "PRIME DMCA Intelligence";

function buildDMCAEmail(data: {
  creatorName: string;
  leakUrl: string;
  domain: string;
  sentToEntity: string;
  abuseEmail: string;
  noticeNumber: string;
}): string {
  const today = new Date().toISOString().split("T")[0];
  return `
Dear DMCA Agent / Abuse Department at ${data.domain},

This is a formal DMCA Takedown Notice submitted pursuant to the Digital Millennium Copyright Act (17 U.S.C. § 512).

NOTICE NUMBER: ${data.noticeNumber}
DATE: ${today}

I, the undersigned, am the authorized representative acting on behalf of the copyright owner identified below.

COPYRIGHT OWNER: ${data.creatorName}
INFRINGING URL: ${data.leakUrl}
HOSTING ENTITY: ${data.sentToEntity}

The content at the URL above reproduces, without authorization, original copyrighted material owned exclusively by ${data.creatorName}. This content has been published without the owner's consent and constitutes copyright infringement.

We hereby request the immediate removal of the above-mentioned infringing content.

By submitting this notice, I declare under penalty of perjury that:
1. I am authorized to act on behalf of the copyright owner;
2. The information in this notice is accurate to the best of my knowledge;
3. I have a good faith belief that the use of the material is not authorized by the copyright owner.

Please confirm removal at: ${FROM_EMAIL}

Sincerely,
PRIME DMCA Intelligence System
Authorized DMCA Agent for ${data.creatorName}
Email: ${FROM_EMAIL}
  `.trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "Content-Type, Authorization" } });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const {
      dmcaRequestId,
      leakId,
      creatorId,
      creatorName,
      leakUrl,
      domain,
      sentToEntity,
      abuseEmail,
      noticeNumber,
    } = body;

    if (!abuseEmail || !leakUrl || !creatorName) {
      return Response.json({ error: "Missing required fields: abuseEmail, leakUrl, creatorName" }, { status: 400 });
    }

    const emailBody = buildDMCAEmail({ creatorName, leakUrl, domain, sentToEntity, abuseEmail, noticeNumber });

    // Send via Brevo API
    const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY!,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        sender: { name: FROM_NAME, email: FROM_EMAIL },
        to: [{ email: abuseEmail, name: `Abuse @ ${domain}` }],
        replyTo: { email: FROM_EMAIL },
        subject: `DMCA Takedown Notice – ${noticeNumber} – ${domain}`,
        textContent: emailBody,
        headers: {
          "X-PRIME-Notice": noticeNumber,
          "X-Creator-ID": creatorId || "",
          "X-Leak-ID": leakId || "",
        },
      }),
    });

    if (!brevoRes.ok) {
      const err = await brevoRes.text();
      return Response.json({ error: `Brevo error: ${err}` }, { status: 500 });
    }

    const brevoData = await brevoRes.json();

    // Update DMCARequest status to "sent"
    if (dmcaRequestId) {
      await base44.asServiceRole.entities.DMCARequest.update(dmcaRequestId, {
        status: "sent",
        sent_date: new Date().toISOString().split("T")[0],
        notice_number: noticeNumber,
      });
    }

    // Update Leak status to "notice_sent"
    if (leakId) {
      await base44.asServiceRole.entities.Leak.update(leakId, {
        status: "notice_sent",
        first_notice_date: new Date().toISOString().split("T")[0],
      });
    }

    return Response.json({ success: true, messageId: brevoData.messageId });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});