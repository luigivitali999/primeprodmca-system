import { createClientFromRequest } from "npm:@base44/sdk";

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
HOSTING ENTITY: ${data.domain}

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

  await data.base44.asServiceRole.entities.DMCARequest.update(data.dmcaRequestId, {
    status: "sent",
    sent_date: new Date().toISOString().split("T")[0],
  });
  await data.base44.asServiceRole.entities.Leak.update(data.leakId, {
    status: "notice_sent",
    first_notice_date: new Date().toISOString().split("T")[0],
  });

  return true;
}

async function processKnownDomain(creator: any, domainEntry: any, existingUrls: Set<string>, base44: any) {
  const stageName = creator.stage_name || creator.legal_name;
  const domain = domainEntry.domain_name;

  const aiResponse = await base44.integrations.Core.InvokeLLM({
    prompt: `Search the web for leaked or unauthorized content featuring the creator named "${stageName}" specifically on the website "${domain}" (use site:${domain} in your search).
Look for pages containing their content: videos, galleries, forum posts, etc.
Return JSON with:
- found: boolean
- urls: array of specific page URLs found (max 5, only real URLs with their content)
- content_types: array of types (video/gallery/forum/etc)
Only return found:true if you are confident the content belongs to this creator.`,
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

  if (!aiResponse?.found || !aiResponse?.urls?.length) return { newLeaks: 0, dmcaSent: 0 };

  let newLeaks = 0;
  let dmcaSent = 0;
  const today = new Date().toISOString().split("T")[0];
  const abuseEmail = domainEntry.abuse_email || domainEntry.dmca_contact;

  for (const url of aiResponse.urls) {
    if (!url || existingUrls.has(url)) continue;

    const noticeNumber = generateNoticeNumber();

    const newLeak = await base44.asServiceRole.entities.Leak.create({
      creator_id: creator.id,
      creator_name: stageName,
      leak_url: url,
      domain: domain,
      hosting_provider: domainEntry.hosting_provider || "",
      registrar: domainEntry.registrar || "",
      country: domainEntry.country || "",
      content_type: aiResponse.content_types?.[0] || "other",
      discovery_date: today,
      detected_by: "scraping",
      severity: "high",
      status: "found",
    });

    newLeaks++;

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
        follow_up_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      });

      const sent = await sendDMCAEmail({
        creatorName: stageName,
        creatorId: creator.id,
        leakUrl: url,
        domain,
        abuseEmail,
        noticeNumber,
        leakId: newLeak.id,
        dmcaRequestId: dmcaReq.id,
        base44,
      });

      if (sent) dmcaSent++;
    }
  }

  return { newLeaks, dmcaSent };
}

async function processFreeScan(creator: any, knownDomains: Set<string>, whitelistDomains: Set<string>, base44: any) {
  const stageName = creator.stage_name || creator.legal_name;

  // Free search across the whole web
  const aiResponse = await base44.integrations.Core.InvokeLLM({
    prompt: `Search the web broadly for leaked or unauthorized content featuring the adult content creator named "${stageName}".
Search across all websites (not limited to specific domains).
Exclude official platforms like OnlyFans, Fansly, Patreon, Instagram, Twitter/X, TikTok, YouTube, Reddit.
Look for piracy/leak sites sharing their content without authorization.

Return JSON with:
- results: array of objects, each with:
  - url: the specific page URL
  - domain: just the domain name (e.g. "example.com")
  - content_type: video/gallery/forum/other
  - confidence: high/medium/low (how confident you are this is their content)
  - context: brief description of what was found

Only include results with confidence medium or high.
Maximum 10 results total.`,
    add_context_from_internet: true,
    response_json_schema: {
      type: "object",
      properties: {
        results: {
          type: "array",
          items: {
            type: "object",
            properties: {
              url: { type: "string" },
              domain: { type: "string" },
              content_type: { type: "string" },
              confidence: { type: "string" },
              context: { type: "string" },
            },
          },
        },
      },
    },
  });

  if (!aiResponse?.results?.length) return 0;

  let pendingCreated = 0;
  const today = new Date().toISOString().split("T")[0];

  // Get existing pending approvals for this creator to avoid duplicates
  const existingPending = await base44.asServiceRole.entities.PendingApproval.filter({
    creator_id: creator.id,
  });
  const existingPendingUrls = new Set(existingPending.map((p: any) => p.leak_url));

  // Get existing leaks for this creator
  const existingLeaks = await base44.asServiceRole.entities.Leak.filter({ creator_id: creator.id });
  const existingLeakUrls = new Set(existingLeaks.map((l: any) => l.leak_url));

  for (const result of aiResponse.results) {
    if (!result.url || !result.domain) continue;

    const domain = result.domain.toLowerCase().replace(/^www\./, "");

    // Skip whitelisted
    if (whitelistDomains.has(domain)) continue;

    // Skip already known leaks
    if (existingLeakUrls.has(result.url) || existingPendingUrls.has(result.url)) continue;

    // If domain is already in our known list → it will be handled by the known domain scan
    if (knownDomains.has(domain)) continue;

    // New domain: create PendingApproval for manual review
    await base44.asServiceRole.entities.PendingApproval.create({
      creator_id: creator.id,
      creator_name: stageName,
      leak_url: result.url,
      domain: domain,
      content_type: result.content_type || "other",
      discovery_date: today,
      search_context: result.context || "",
      status: "pending",
    });

    pendingCreated++;
  }

  return pendingCreated;
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

    const [creators, domains, whitelist] = await Promise.all([
      base44.asServiceRole.entities.Creator.filter({ status: "active" }),
      base44.asServiceRole.entities.DomainIntelligence.list(),
      base44.asServiceRole.entities.Whitelist.filter({ status: "active" }),
    ]);

    const whitelistDomains = new Set(whitelist.map((w: any) => w.domain.toLowerCase().replace(/^www\./, "")));
    const knownDomains = new Set(domains.map((d: any) => d.domain_name?.toLowerCase().replace(/^www\./, "")));

    const results = {
      scanned: 0,
      newLeaks: 0,
      dmcaSent: 0,
      pendingApprovals: 0,
      errors: [] as string[],
    };

    for (const creator of creators) {
      const stageName = creator.stage_name || creator.legal_name;
      if (!stageName) continue;

      // 1. Scan known domains → automatic DMCA
      for (const domainEntry of domains) {
        const domain = domainEntry.domain_name;
        if (!domain) continue;
        if (whitelistDomains.has(domain.toLowerCase().replace(/^www\./, ""))) continue;

        results.scanned++;

        try {
          const existingLeaks = await base44.asServiceRole.entities.Leak.filter({
            creator_id: creator.id,
            domain: domain,
          });
          const existingUrls = new Set(existingLeaks.map((l: any) => l.leak_url));

          const { newLeaks, dmcaSent } = await processKnownDomain(creator, domainEntry, existingUrls, base44);
          results.newLeaks += newLeaks;
          results.dmcaSent += dmcaSent;
        } catch (err: any) {
          results.errors.push(`known:${stageName}@${domain}: ${err.message}`);
        }
      }

      // 2. Free scan → pending approval if new domain
      try {
        const pending = await processFreeScan(creator, knownDomains, whitelistDomains, base44);
        results.pendingApprovals += pending;
      } catch (err: any) {
        results.errors.push(`free:${stageName}: ${err.message}`);
      }
    }

    return Response.json({ success: true, ...results });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});