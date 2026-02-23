import { createClientFromRequest } from "npm:@base44/sdk";

const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36";
const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
const FROM_DOMAIN = "foryoulink.com";

function generateNoticeNumber(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PRIME-${ts}-${rand}`;
}

function buildDMCAEmail(data: {
  creatorName: string;
  leakUrl: string;
  domain: string;
  sentToEntity: string;
  noticeNumber: string;
  fromEmail: string;
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

Please confirm removal at: ${data.fromEmail}

Sincerely,
PRIME DMCA Intelligence System
Authorized DMCA Agent for ${data.creatorName}
Email: ${data.fromEmail}
  `.trim();
}

async function sendDMCAEmail(data: {
  creatorName: string;
  creatorId: string;
  leakUrl: string;
  domain: string;
  abuseEmail: string;
  noticeNumber: string;
  leakId: string;
  dmcaRequestId: string;
  base44: any;
}) {
  const creatorSlug = (data.creatorName || "dmca")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 30);
  const fromEmail = `${creatorSlug}@${FROM_DOMAIN}`;

  const emailBody = buildDMCAEmail({
    creatorName: data.creatorName,
    leakUrl: data.leakUrl,
    domain: data.domain,
    sentToEntity: data.domain,
    noticeNumber: data.noticeNumber,
    fromEmail,
  });

  const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": BREVO_API_KEY!,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      sender: { name: data.creatorName, email: fromEmail },
      to: [{ email: data.abuseEmail, name: `Abuse @ ${data.domain}` }],
      replyTo: { email: fromEmail },
      subject: `DMCA Takedown Notice – ${data.noticeNumber} – ${data.domain}`,
      textContent: emailBody,
      headers: {
        "X-PRIME-Notice": data.noticeNumber,
        "X-Creator-ID": data.creatorId,
        "X-Leak-ID": data.leakId,
      },
    }),
  });

  if (!brevoRes.ok) {
    const err = await brevoRes.text();
    console.error(`Brevo error for ${data.domain}: ${err}`);
    return false;
  }

  // Update DMCARequest status
  await data.base44.asServiceRole.entities.DMCARequest.update(data.dmcaRequestId, {
    status: "sent",
    sent_date: new Date().toISOString().split("T")[0],
  });

  // Update Leak status
  await data.base44.asServiceRole.entities.Leak.update(data.leakId, {
    status: "notice_sent",
    first_notice_date: new Date().toISOString().split("T")[0],
  });

  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    const base44 = createClientFromRequest(req);

    // Load all active creators, all domains, whitelist
    const [creators, domains, whitelist] = await Promise.all([
      base44.asServiceRole.entities.Creator.filter({ status: "active" }),
      base44.asServiceRole.entities.DomainIntelligence.list(),
      base44.asServiceRole.entities.Whitelist.filter({ status: "active" }),
    ]);

    const whitelistDomains = new Set(whitelist.map((w: any) => w.domain.toLowerCase()));

    const results = {
      scanned: 0,
      newLeaks: 0,
      dmcaSent: 0,
      errors: [] as string[],
    };

    for (const creator of creators) {
      const stageName = creator.stage_name || creator.legal_name;
      if (!stageName) continue;

      for (const domainEntry of domains) {
        const domain = domainEntry.domain_name;
        if (!domain) continue;

        // Skip whitelisted domains
        if (whitelistDomains.has(domain.toLowerCase())) continue;

        results.scanned++;

        try {
          // Use AI with web search to find leaks
          const searchPrompt = `
Search the web for leaked or unauthorized content featuring the creator named "${stageName}" on the website "${domain}".

Look for:
- Pages containing "${stageName}" with adult/leaked content
- Profile pages, galleries, videos, or posts with their content
- Forum threads sharing their content

Return a JSON with:
- found: boolean (true if you found actual content pages)
- urls: array of specific URLs found (max 5, only real URLs that likely contain their content)
- content_types: array of types found (video/gallery/forum/etc)

Only return URLs that are very likely to contain their actual content, not just mentions of their name.
If nothing is found, return found: false with empty arrays.
          `.trim();

          const aiResponse = await base44.integrations.Core.InvokeLLM({
            prompt: searchPrompt,
            add_context_from_internet: true,
            response_json_schema: {
              type: "object",
              properties: {
                found: { type: "boolean" },
                urls: { type: "array", items: { type: "string" } },
                content_types: { type: "array", items: { type: "string" } },
              },
            },
          });

          if (!aiResponse?.found || !aiResponse?.urls?.length) continue;

          // Get existing leaks for this creator/domain to avoid duplicates
          const existingLeaks = await base44.asServiceRole.entities.Leak.filter({
            creator_id: creator.id,
            domain: domain,
          });
          const existingUrls = new Set(existingLeaks.map((l: any) => l.leak_url));

          for (const url of aiResponse.urls) {
            if (!url || existingUrls.has(url)) continue;

            const contentType = aiResponse.content_types?.[0] || "other";
            const today = new Date().toISOString().split("T")[0];
            const noticeNumber = generateNoticeNumber();

            // Create Leak
            const newLeak = await base44.asServiceRole.entities.Leak.create({
              creator_id: creator.id,
              creator_name: stageName,
              leak_url: url,
              domain: domain,
              hosting_provider: domainEntry.hosting_provider || "",
              registrar: domainEntry.registrar || "",
              country: domainEntry.country || "",
              content_type: contentType,
              discovery_date: today,
              detected_by: "scraping",
              severity: "high",
              status: "found",
            });

            results.newLeaks++;

            // If domain has abuse email, create DMCARequest and send immediately
            const abuseEmail = domainEntry.abuse_email || domainEntry.dmca_contact;
            if (abuseEmail) {
              const dmcaReq = await base44.asServiceRole.entities.DMCARequest.create({
                leak_id: newLeak.id,
                creator_id: creator.id,
                creator_name: stageName,
                notice_number: noticeNumber,
                sent_to_entity: domain,
                sent_to_type: "hosting",
                method: "email",
                status: "pending",
                escalation_level: 0,
                follow_up_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                  .toISOString()
                  .split("T")[0],
              });

              const sent = await sendDMCAEmail({
                creatorName: stageName,
                creatorId: creator.id,
                leakUrl: url,
                domain: domain,
                abuseEmail: abuseEmail,
                noticeNumber: noticeNumber,
                leakId: newLeak.id,
                dmcaRequestId: dmcaReq.id,
                base44,
              });

              if (sent) results.dmcaSent++;
            }
          }
        } catch (err: any) {
          results.errors.push(`${stageName}@${domain}: ${err.message}`);
        }
      }
    }

    return Response.json({ success: true, ...results });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});