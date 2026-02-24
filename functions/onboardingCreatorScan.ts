import { createClientFromRequest } from "npm:@base44/sdk@0.8.6";

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
const FROM_DOMAIN = "foryoulink.com";

function generateNoticeNumber() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PRIME-${ts}-${rand}`;
}

function buildDMCAEmail({ creatorName, leakUrl, domain, noticeNumber, fromEmail }) {
  const today = new Date().toISOString().split("T")[0];
  return `
Dear DMCA Agent / Abuse Department at ${domain},

This is a formal DMCA Takedown Notice submitted pursuant to the Digital Millennium Copyright Act (17 U.S.C. § 512).

NOTICE NUMBER: ${noticeNumber}
DATE: ${today}

I, the undersigned, am the authorized representative acting on behalf of the copyright owner identified below.

COPYRIGHT OWNER: ${creatorName}
INFRINGING URL: ${leakUrl}
HOSTING ENTITY: ${domain}

The content at the URL above reproduces, without authorization, original copyrighted material owned exclusively by ${creatorName}. This content has been published without the owner's consent and constitutes copyright infringement.

We hereby request the immediate removal of the above-mentioned infringing content.

By submitting this notice, I declare under penalty of perjury that:
1. I am authorized to act on behalf of the copyright owner;
2. The information in this notice is accurate to the best of my knowledge;
3. I have a good faith belief that the use of the material is not authorized by the copyright owner.

Please confirm removal at: ${fromEmail}

Sincerely,
PRIME DMCA Intelligence System
Authorized DMCA Agent for ${creatorName}
Email: ${fromEmail}
  `.trim();
}

async function sendDMCAEmail({ creatorName, creatorId, leakUrl, domain, abuseEmail, noticeNumber, leakId, dmcaRequestId, base44 }) {
  const creatorSlug = (creatorName || "dmca").toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 30);
  const fromEmail = `${creatorSlug}@${FROM_DOMAIN}`;

  const emailBody = buildDMCAEmail({ creatorName, leakUrl, domain, noticeNumber, fromEmail });

  const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": BREVO_API_KEY,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      sender: { name: creatorName, email: fromEmail },
      to: [{ email: abuseEmail, name: `Abuse @ ${domain}` }],
      replyTo: { email: fromEmail },
      subject: `DMCA Takedown Notice – ${noticeNumber} – ${domain}`,
      textContent: emailBody,
      headers: {
        "X-PRIME-Notice": noticeNumber,
        "X-Creator-ID": creatorId,
        "X-Leak-ID": leakId,
      },
    }),
  });

  if (!brevoRes.ok) {
    const err = await brevoRes.text();
    console.error(`Brevo error for ${domain}: ${err}`);
    return false;
  }

  await base44.asServiceRole.entities.DMCARequest.update(dmcaRequestId, {
    status: "sent",
    sent_date: new Date().toISOString().split("T")[0],
  });
  await base44.asServiceRole.entities.Leak.update(leakId, {
    status: "notice_sent",
    first_notice_date: new Date().toISOString().split("T")[0],
  });

  return true;
}

async function scanKnownDomains(creator, domains, whitelistDomains, base44) {
  const stageName = creator.stage_name || creator.legal_name;
  let newLeaks = 0;
  let dmcaSent = 0;
  const today = new Date().toISOString().split("T")[0];

  for (const domainEntry of domains) {
    const domain = domainEntry.domain_name;
    if (!domain) continue;
    if (whitelistDomains.has(domain.toLowerCase().replace(/^www\./, ""))) continue;

    const aiResponse = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a DMCA investigator. Search Google for leaked/pirated adult content of the creator "${stageName}" on the site "${domain}".

Use these specific Google search queries:
1. site:${domain} "${stageName}"
2. site:${domain} "${stageName}" leak
3. site:${domain} "${stageName}" onlyfans

For each query, check if real pages exist with their content (videos, galleries, photos, forum threads with their material).

Return JSON with:
- found: boolean (true ONLY if you found real pages with their content)
- urls: array of real, specific page URLs you found (NOT the domain homepage, actual content pages, max 5)
- content_types: array of types for each url (video/gallery/forum/torrent/other)

IMPORTANT: Only include URLs that are real pages you actually found. Do not invent URLs.`,
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

    const existingLeaks = await base44.asServiceRole.entities.Leak.filter({ creator_id: creator.id, domain });
    const existingUrls = new Set(existingLeaks.map((l) => l.leak_url));
    const abuseEmail = domainEntry.abuse_email || domainEntry.dmca_contact;

    for (const url of aiResponse.urls) {
      if (!url || existingUrls.has(url)) continue;

      const noticeNumber = generateNoticeNumber();

      const newLeak = await base44.asServiceRole.entities.Leak.create({
        creator_id: creator.id,
        creator_name: stageName,
        leak_url: url,
        domain,
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
  }

  return { newLeaks, dmcaSent };
}

async function scanFreely(creator, knownDomains, whitelistDomains, base44) {
  const stageName = creator.stage_name || creator.legal_name;

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
  - confidence: high/medium/low
  - context: brief description of what was found

Only include results with confidence medium or high. Maximum 10 results total.`,
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

  const existingPending = await base44.asServiceRole.entities.PendingApproval.filter({ creator_id: creator.id });
  const existingPendingUrls = new Set(existingPending.map((p) => p.leak_url));
  const existingLeaks = await base44.asServiceRole.entities.Leak.filter({ creator_id: creator.id });
  const existingLeakUrls = new Set(existingLeaks.map((l) => l.leak_url));

  for (const result of aiResponse.results) {
    if (!result.url || !result.domain) continue;
    const domain = result.domain.toLowerCase().replace(/^www\./, "");
    if (whitelistDomains.has(domain)) continue;
    if (existingLeakUrls.has(result.url) || existingPendingUrls.has(result.url)) continue;
    if (knownDomains.has(domain)) continue;

    await base44.asServiceRole.entities.PendingApproval.create({
      creator_id: creator.id,
      creator_name: stageName,
      leak_url: result.url,
      domain,
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

    // Payload: { creator_id, creator (optional full object) }
    const body = await req.json().catch(() => ({}));
    const creatorId = body.creator_id || body?.event?.entity_id;

    if (!creatorId) {
      return Response.json({ error: "Missing creator_id" }, { status: 400 });
    }

    // Load creator + supporting data in parallel
    const [creator, domains, whitelist] = await Promise.all([
      base44.asServiceRole.entities.Creator.get(creatorId),
      base44.asServiceRole.entities.DomainIntelligence.list(),
      base44.asServiceRole.entities.Whitelist.filter({ status: "active" }),
    ]);

    if (!creator) {
      return Response.json({ error: "Creator not found" }, { status: 404 });
    }

    const whitelistDomains = new Set(whitelist.map((w) => w.domain.toLowerCase().replace(/^www\./, "")));
    const knownDomains = new Set(domains.map((d) => d.domain_name?.toLowerCase().replace(/^www\./, "")));

    console.log(`[ONBOARDING SCAN] Starting scan for creator: ${creator.stage_name || creator.legal_name}`);

    // 1. Scan known domains → auto DMCA
    const { newLeaks, dmcaSent } = await scanKnownDomains(creator, domains, whitelistDomains, base44);

    // 2. Free web scan → PendingApproval for unknown domains
    const pendingApprovals = await scanFreely(creator, knownDomains, whitelistDomains, base44);

    console.log(`[ONBOARDING SCAN] Done. newLeaks=${newLeaks}, dmcaSent=${dmcaSent}, pendingApprovals=${pendingApprovals}`);

    // Aggiorna statistiche creator
    const allLeaks = await base44.asServiceRole.entities.Leak.filter({ creator_id: creatorId });
    const activeLeaks = allLeaks.filter((l) => l.status !== "removed" && l.status !== "rejected");
    const removedLeaks = allLeaks.filter((l) => l.status === "removed");
    const totalLeaks = allLeaks.length;
    const removalRate = totalLeaks > 0 ? Math.round((removedLeaks.length / totalLeaks) * 100) : 0;

    // Calcolo estimated_loss
    const VMC_TIER = { low: 12, medium: 25, high: 60, vip: 130 };
    const vmc = creator.content_value || VMC_TIER[creator.creator_tier] || 25;
    const domainMap = {};
    domains.forEach((d) => { domainMap[d.domain_name] = d; });

    let estimatedLoss = 0;
    for (const leak of allLeaks) {
      const domainEntry = domainMap[leak.domain];
      const fdd = domainEntry?.diffusion_factor || 1.0;
      const daysOnline = leak.days_online || 1;
      const iit = 1 + (daysOnline / 30) * 0.15;
      estimatedLoss += vmc * fdd * iit;
    }
    // Aggiungi perdita opportunità
    if (creator.ltv_mean_fan && creator.ltv_mean_fan > 0) {
      const avgConvFactor = allLeaks.length > 0
        ? allLeaks.reduce((sum, leak) => {
            const d = domainMap[leak.domain];
            return sum + (d?.conversion_loss_factor || 0.04);
          }, 0) / allLeaks.length
        : 0.04;
      estimatedLoss += creator.ltv_mean_fan * avgConvFactor * activeLeaks.length;
    }
    estimatedLoss = Math.round(estimatedLoss * 100) / 100;

    // Calcolo avg_removal_time per i leak rimossi
    let avgRemovalTime = null;
    const removedWithDates = removedLeaks.filter((l) => l.first_notice_date && l.removal_date);
    if (removedWithDates.length > 0) {
      const totalDays = removedWithDates.reduce((sum, l) => {
        const diff = (new Date(l.removal_date) - new Date(l.first_notice_date)) / (1000 * 60 * 60 * 24);
        return sum + diff;
      }, 0);
      avgRemovalTime = Math.round(totalDays / removedWithDates.length);
    }

    // Calcolo risk score
    const lossScore = Math.min(estimatedLoss / 10000, 1) * 35;
    const activeScore = Math.min(activeLeaks.length / 20, 1) * 15;
    const removalScore = (1 - removalRate / 100) * 15;
    const riskScore = Math.min(Math.round(lossScore + activeScore + removalScore + 15), 100);
    const riskLevel = riskScore >= 81 ? "critical" : riskScore >= 61 ? "high" : riskScore >= 31 ? "medium" : "low";

    await base44.asServiceRole.entities.Creator.update(creatorId, {
      total_leaks: totalLeaks,
      active_leaks: activeLeaks.length,
      removed_leaks: removedLeaks.length,
      removal_rate: removalRate,
      estimated_loss: estimatedLoss,
      avg_removal_time: avgRemovalTime,
      risk_score: riskScore,
      risk_level: riskLevel,
    });

    return Response.json({ success: true, creatorId, newLeaks, dmcaSent, pendingApprovals });
  } catch (error) {
    console.error("[ONBOARDING SCAN] Error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});