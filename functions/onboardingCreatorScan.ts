import { createClientFromRequest } from "npm:@base44/sdk@0.8.6";

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
const FROM_DOMAIN = "foryoulink.com";

function generateNoticeNumber() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PRIME-${ts}-${rand}`;
}

function cleanDomain(raw) {
  if (!raw) return null;
  try {
    const withProto = raw.startsWith("http") ? raw : `https://${raw}`;
    const parsed = new URL(withProto);
    return parsed.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return raw.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase();
  }
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

async function sendDMCAEmail({ creatorName, creatorId, leakUrl, domain, abuseEmail, noticeNumber, leakId, dmcaRequestId, base44 }) {
  const creatorSlug = (creatorName || "dmca").toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 30);
  const fromEmail = `${creatorSlug}@${FROM_DOMAIN}`;
  const emailBody = buildDMCAEmail({ creatorName, leakUrl, domain, noticeNumber, fromEmail });

  const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({
      sender: { name: creatorName, email: fromEmail },
      to: [{ email: abuseEmail, name: `Abuse @ ${domain}` }],
      replyTo: { email: fromEmail },
      subject: `DMCA Takedown Notice – ${noticeNumber} – ${domain}`,
      textContent: emailBody,
    }),
  });

  if (!brevoRes.ok) {
    console.error(`[DMCA EMAIL] Brevo error for ${domain}: ${await brevoRes.text()}`);
    return false;
  }

  await Promise.all([
    base44.asServiceRole.entities.DMCARequest.update(dmcaRequestId, { status: "sent", sent_date: new Date().toISOString().split("T")[0] }),
    base44.asServiceRole.entities.Leak.update(leakId, { status: "notice_sent", first_notice_date: new Date().toISOString().split("T")[0] }),
  ]);
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "Content-Type, Authorization" } });
  }

  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const creatorId = body.creator_id || body?.event?.entity_id;

    if (!creatorId) return Response.json({ error: "Missing creator_id" }, { status: 400 });

    console.log(`[SCAN] Loading data for creator: ${creatorId}`);

    const [creator, domains, whitelist] = await Promise.all([
      base44.asServiceRole.entities.Creator.get(creatorId),
      base44.asServiceRole.entities.DomainIntelligence.list(),
      base44.asServiceRole.entities.Whitelist.filter({ status: "active" }),
    ]);

    if (!creator) return Response.json({ error: "Creator not found" }, { status: 404 });

    const stageName = creator.stage_name || creator.legal_name;
    const legalName = creator.legal_name || stageName;
    const aliases = Array.isArray(creator.aliases) ? creator.aliases : [];
    const allNames = [...new Set([stageName, legalName, ...aliases].filter(Boolean))];

    console.log(`[SCAN] Creator: ${stageName} | Legal: ${legalName} | Aliases: ${aliases.join(", ") || "none"}`);
    console.log(`[SCAN] Known domains: ${domains.length} | Whitelist: ${whitelist.length}`);

    const whitelistSet = new Set(whitelist.map(w => cleanDomain(w.domain)).filter(Boolean));

    const today = new Date().toISOString().split("T")[0];
    let newLeaks = 0;
    let dmcaSent = 0;

    // ─── 1. KNOWN DOMAINS SCAN ────────────────────────────────────────────────
    for (const domEntry of domains) {
      const domain = cleanDomain(domEntry.domain_name);
      if (!domain || whitelistSet.has(domain)) continue;

      const nameQueries = allNames.flatMap((name, ni) => [
        `${ni * 4 + 1}. site:${domain} "${name}"`,
        `${ni * 4 + 2}. site:${domain} "${name}" leak`,
        `${ni * 4 + 3}. site:${domain} "${name}" onlyfans`,
        `${ni * 4 + 4}. site:${domain} "${name}" nude`,
      ]).join("\n");

      console.log(`[KNOWN DOMAIN] Scanning: ${domain}`);

      const aiRes = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a DMCA investigator. Search Google for leaked adult content of "${stageName}" (legal name: "${legalName}"${aliases.length ? `, also known as: ${aliases.join(", ")}` : ""}) on the site "${domain}".

Run these searches:
${nameQueries}

Return JSON:
- found: true only if you found real content pages
- urls: array of real specific page URLs (not homepage, max 8)
- content_types: matching array of types (video/gallery/forum/torrent/other)

Do NOT invent URLs. Only report pages you actually verified exist.`,
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

      console.log(`[KNOWN DOMAIN] ${domain}: found=${aiRes?.found}, urls=${aiRes?.urls?.length ?? 0}`);
      if (!aiRes?.found || !aiRes?.urls?.length) continue;

      const existingLeaks = await base44.asServiceRole.entities.Leak.filter({ creator_id: creator.id, domain });
      const existingUrls = new Set(existingLeaks.map(l => l.leak_url));
      const abuseEmail = domEntry.abuse_email || domEntry.dmca_contact;

      for (let i = 0; i < aiRes.urls.length; i++) {
        const url = aiRes.urls[i];
        if (!url || existingUrls.has(url)) continue;

        const noticeNumber = generateNoticeNumber();
        const newLeak = await base44.asServiceRole.entities.Leak.create({
          creator_id: creator.id,
          creator_name: stageName,
          leak_url: url,
          domain,
          hosting_provider: domEntry.hosting_provider || "",
          registrar: domEntry.registrar || "",
          country: domEntry.country || "",
          content_type: aiRes.content_types?.[i] || "other",
          discovery_date: today,
          detected_by: "scraping",
          severity: "high",
          status: "found",
        });
        newLeaks++;
        console.log(`[KNOWN DOMAIN] Created leak: ${url}`);

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
          const sent = await sendDMCAEmail({ creatorName: stageName, creatorId: creator.id, leakUrl: url, domain, abuseEmail, noticeNumber, leakId: newLeak.id, dmcaRequestId: dmcaReq.id, base44 });
          if (sent) dmcaSent++;
        }
      }
    }

    // ─── 2. FREE WEB SCAN ─────────────────────────────────────────────────────
    const keywords = [
      "onlyfans leak", "onlyfans leaks", "leaked", "nude", "nudes", "mega",
      "telegram", "full pack", "archive", "zip", "ppv leak", "free onlyfans",
      "onlyfans mega link", "onlyfans telegram", "sex tape", "onlyfans 2025",
      "onlyfans gratis", "nuda", "video leak",
    ];

    const topQueries = allNames.flatMap(name =>
      keywords.slice(0, 10).map(kw => `"${name}" ${kw}`)
    ).slice(0, 30).map((q, i) => `${i + 1}. ${q}`).join("\n");

    console.log(`[FREE SCAN] Starting free scan for: ${allNames.join(", ")}`);

    const freeRes = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a DMCA investigator. Find pirated/leaked adult content of this creator:

Stage name: "${stageName}"
Legal name: "${legalName}"
${aliases.length ? `Aliases: ${aliases.join(", ")}` : ""}

Run ALL of these searches on Google and Bing:
${topQueries}

Also search directly on high-risk sites:
- site:simpcity.su "${stageName}"
- site:coomer.su "${stageName}"
- site:forums.socialmediagirls.com "${stageName}"
- site:leakedbb.com "${stageName}"
- site:thothub.tv "${stageName}"
- site:fapello.com "${stageName}"
- "${stageName}" telegram leak
- "${legalName}" nude leaked

RULES:
- Report ALL pages found, even low confidence
- Do NOT exclude anything except: onlyfans.com, fansly.com, patreon.com, instagram.com, twitter.com, x.com, tiktok.com, youtube.com
- Include forum threads, video pages, mega links, telegram references, file hosts
- Empty results array is OK if truly nothing found - do NOT fabricate results

Return JSON with results array (each item: url, domain, content_type, confidence, context).`,
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

    const freeResults = freeRes?.results || [];
    console.log(`[FREE SCAN] AI returned ${freeResults.length} results`);
    if (freeResults.length > 0) {
      console.log(`[FREE SCAN] Findings: ${JSON.stringify(freeResults.map(r => ({ url: r.url, domain: r.domain, confidence: r.confidence })))}`);
    }

    let pendingApprovals = 0;
    if (freeResults.length > 0) {
      const [existingPending, existingLeaksAll] = await Promise.all([
        base44.asServiceRole.entities.PendingApproval.filter({ creator_id: creator.id }),
        base44.asServiceRole.entities.Leak.filter({ creator_id: creator.id }),
      ]);
      const pendingUrlSet = new Set(existingPending.map(p => p.leak_url));
      const leakUrlSet = new Set(existingLeaksAll.map(l => l.leak_url));

      for (const result of freeResults) {
        if (!result.url || !result.domain) continue;
        const domain = cleanDomain(result.domain) || result.domain.toLowerCase();
        if (whitelistSet.has(domain)) continue;
        if (leakUrlSet.has(result.url) || pendingUrlSet.has(result.url)) continue;

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
        pendingApprovals++;
        console.log(`[FREE SCAN] Created pending approval: ${result.url} (${result.confidence})`);
      }
    }

    console.log(`[SCAN] Done. newLeaks=${newLeaks}, dmcaSent=${dmcaSent}, pendingApprovals=${pendingApprovals}`);

    // ─── 3. UPDATE CREATOR STATS ──────────────────────────────────────────────
    const allLeaks = await base44.asServiceRole.entities.Leak.filter({ creator_id: creatorId });
    const activeLeaks = allLeaks.filter(l => l.status !== "removed" && l.status !== "rejected");
    const removedLeaks = allLeaks.filter(l => l.status === "removed");
    const totalLeaks = allLeaks.length;
    const removalRate = totalLeaks > 0 ? Math.round((removedLeaks.length / totalLeaks) * 100) : 0;

    const VMC_TIER = { low: 12, medium: 25, high: 60, vip: 130 };
    const vmc = creator.content_value || VMC_TIER[creator.creator_tier] || 25;
    const domainMap = {};
    domains.forEach(d => { domainMap[cleanDomain(d.domain_name)] = d; });

    let estimatedLoss = 0;
    for (const leak of allLeaks) {
      const d = domainMap[cleanDomain(leak.domain)];
      const fdd = d?.diffusion_factor || 1.0;
      const daysOnline = leak.days_online || 1;
      estimatedLoss += vmc * fdd * (1 + (daysOnline / 30) * 0.15);
    }
    if (creator.ltv_mean_fan > 0) {
      const avgConv = allLeaks.length > 0
        ? allLeaks.reduce((s, l) => s + (domainMap[cleanDomain(l.domain)]?.conversion_loss_factor || 0.04), 0) / allLeaks.length
        : 0.04;
      estimatedLoss += creator.ltv_mean_fan * avgConv * activeLeaks.length;
    }
    estimatedLoss = Math.round(estimatedLoss * 100) / 100;

    let avgRemovalTime = null;
    const removedWithDates = removedLeaks.filter(l => l.first_notice_date && l.removal_date);
    if (removedWithDates.length > 0) {
      avgRemovalTime = Math.round(removedWithDates.reduce((s, l) => s + (new Date(l.removal_date) - new Date(l.first_notice_date)) / 86400000, 0) / removedWithDates.length);
    }

    const riskScore = Math.min(Math.round(Math.min(estimatedLoss / 10000, 1) * 35 + Math.min(activeLeaks.length / 20, 1) * 15 + (1 - removalRate / 100) * 15 + 15), 100);
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
    console.error("[SCAN] Fatal error:", error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});