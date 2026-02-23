import { createClientFromRequest } from "npm:@base44/sdk";

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
const FROM_DOMAIN = "foryoulink.com";

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

Please confirm removal at: legal@foryoulink.com

Sincerely,
PRIME DMCA Intelligence System
Authorized DMCA Agent for ${data.creatorName}
Email: legal@foryoulink.com
  `.trim();
}

function buildDMCAPdf(data: {
  creatorName: string;
  leakUrl: string;
  domain: string;
  sentToEntity: string;
  abuseEmail: string;
  noticeNumber: string;
}): string {
  // Build a minimal but valid PDF manually (no external lib needed in Deno)
  const today = new Date().toISOString().split("T")[0];
  const lines = [
    `DMCA TAKEDOWN NOTICE`,
    ``,
    `Notice Number : ${data.noticeNumber}`,
    `Date          : ${today}`,
    ``,
    `TO: DMCA Agent / Abuse Department`,
    `    ${data.domain} (${data.sentToEntity})`,
    `    ${data.abuseEmail}`,
    ``,
    `This is a formal DMCA Takedown Notice pursuant to 17 U.S.C. § 512.`,
    ``,
    `COPYRIGHT OWNER : ${data.creatorName}`,
    `INFRINGING URL  : ${data.leakUrl}`,
    ``,
    `The content at the URL above reproduces, without authorisation, original`,
    `copyrighted material owned exclusively by ${data.creatorName}. This content`,
    `was published without the owner's consent and constitutes infringement.`,
    ``,
    `We request the IMMEDIATE REMOVAL of the above infringing content.`,
    ``,
    `DECLARATION (under penalty of perjury):`,
    `1. I am authorised to act on behalf of the copyright owner.`,
    `2. The information in this notice is accurate to my best knowledge.`,
    `3. I have a good-faith belief that the use of the material is not`,
    `   authorised by the copyright owner, its agent, or the law.`,
    ``,
    `Confirmation of removal: legal@foryoulink.com`,
    ``,
    `Signed,`,
    `PRIME DMCA Intelligence System`,
    `Authorised DMCA Agent for ${data.creatorName}`,
  ];

  // PDF content stream
  const content = lines.map((l, i) => `BT /F1 11 Tf 50 ${750 - i * 16} Td (${l.replace(/[()\\]/g, "\\$&")}) Tj ET`).join("\n");
  const streamLen = new TextEncoder().encode(content).length;

  const pdf = `%PDF-1.4
1 0 obj<</Type /Catalog /Pages 2 0 R>>endobj
2 0 obj<</Type /Pages /Kids [3 0 R] /Count 1>>endobj
3 0 obj<</Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Contents 4 0 R /Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length ${streamLen}>>
stream
${content}
endstream
endobj
5 0 obj<</Type /Font /Subtype /Type1 /BaseFont /Helvetica>>endobj
xref
0 6
0000000000 65535 f 
trailer<</Size 6 /Root 1 0 R>>
startxref
0
%%EOF`;

  // Base64 encode
  const bytes = new TextEncoder().encode(pdf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
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
      docSelfieUrl,
    } = body;

    if (!abuseEmail || !leakUrl || !creatorName) {
      return Response.json({ error: "Missing required fields: abuseEmail, leakUrl, creatorName" }, { status: 400 });
    }

    // Build dynamic sender based on creator name
    const creatorSlug = (creatorName || "dmca")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 30);
    const FROM_EMAIL = `${creatorSlug}@${FROM_DOMAIN}`;
    const FROM_NAME = creatorName || "PRIME DMCA Intelligence";

    const emailBody = buildDMCAEmail({ creatorName, leakUrl, domain, sentToEntity, abuseEmail, noticeNumber });

    // Build email payload
    const emailPayload: any = {
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
    };

    // Build attachments array
    const attachments: any[] = [];

    // 1. Formal DMCA notice as PDF
    const pdfBase64 = buildDMCAPdf({ creatorName, leakUrl, domain, sentToEntity, abuseEmail, noticeNumber });
    attachments.push({
      content: pdfBase64,
      name: `DMCA_Notice_${noticeNumber}.pdf`,
    });

    // 2. Selfie with identity document
    if (docSelfieUrl) {
      try {
        const imgRes = await fetch(docSelfieUrl);
        if (imgRes.ok) {
          const arrayBuffer = await imgRes.arrayBuffer();
          const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
          const contentType = imgRes.headers.get("content-type") || "image/jpeg";
          const ext = contentType.includes("png") ? "png" : "jpg";
          attachments.push({
            content: base64,
            name: `identity_proof_${creatorSlug}.${ext}`,
          });
        }
      } catch (_) {
        // selfie fetch failed, continue without it
      }
    }

    if (attachments.length > 0) {
      emailPayload.attachment = attachments;
    }

    // Send via Brevo API
    const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY!,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(emailPayload),
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