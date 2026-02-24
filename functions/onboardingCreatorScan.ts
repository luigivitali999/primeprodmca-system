import { createClientFromRequest } from "npm:@base44/sdk@0.8.6";

const SERPAPI_KEY = Deno.env.get("SERPAPI_KEY");
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

  // ─── UPDATE DOMAIN STATS (EVENT-DRIVEN) ────────────────────────
  try {
    await base44.asServiceRole.functions.invoke("updateDomainStats", {
      domain,
      event_type: "dmca_sent",
      leak_id: leakId,
    });
    console.log(`[DMCA EMAIL] Domain stats updated for ${domain}`);
  } catch (err) {
    console.warn(`[DMCA EMAIL] Domain stats update failed: ${err.message}`);
  }

  return true;
}

async function querySerpAPI(engine, query) {
  console.log(`[SERPAPI] ${engine.toUpperCase()}: "${query}"`);
  
  const params = new URLSearchParams({
    api_key: SERPAPI_KEY,
    q: query,
    num: 30,
  });

  params.set("engine", engine === "bing" ? "bing" : "google");

  const res = await fetch(`https://serpapi.com/search?${params.toString()}`);
  if (!res.ok) {
    console.error(`[SERPAPI] Error ${engine}: ${res.status}`);
    return [];
  }

  const data = await res.json();
  const results = data.organic_results || [];
  
  return results.map((r, idx) => ({
    url: r.link || "",
    title: r.title || "",
    snippet: r.snippet || "",
    domain: cleanDomain(r.link) || "",
    position: idx + 1,
  })).filter(r => r.url && r.domain);
}

async function classifyAllResults(creatorName, stageName, legalName, results, knownDomainMap, base44) {
  if (!results.length) return [];

  console.log(`[AI CLASSIFY] Classifying ${results.length} results...`);

  const knownDomainList = Array.from(knownDomainMap.keys()).slice(0, 20);
  const domainContext = knownDomainList.length ? `\nKnown risky domains in database: ${knownDomainList.join(", ")}` : "";

  const prompt = `You are a DMCA investigator. Classify each search result for leaked content of creator "${stageName}" (legal: "${legalName}").

For each result, determine:
- "leak": actual leaked/pirated content pages
- "uncertain": possibly contains leaks but unclear from snippet
- "false_positive": legitimate site, news, social media, etc.

Results to classify:
${results.map((r, i) => `${i + 1}. URL: ${r.url}
   Domain: ${r.domain}
   Title: ${r.title}
   Snippet: ${r.snippet}`).join("\n\n")}
${domainContext}

Return JSON: array of {url, classification, confidence, reasoning}.`;

  try {
    const aiRes = await base44.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: false,
      response_json_schema: {
        type: "object",
        properties: {
          results: {
            type: "array",
            items: {
              type: "object",
              properties: {
                url: { type: "string" },
                classification: { type: "string" },
                confidence: { type: "string" },
                reasoning: { type: "string" },
              },
            },
          },
        },
      },
    });

    return (aiRes?.results || []).map(r => ({
      url: r.url,
      classification: r.classification || "unclassified",
      confidence: r.confidence || "low",
      reasoning: r.reasoning || "",
    }));
  } catch (err) {
    console.error(`[AI CLASSIFY] Error: ${err.message}`);
    return results.map(r => ({ url: r.url, classification: "unclassified", confidence: "low", reasoning: "AI error" }));
  }
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

    console.log(`[SCAN] Starting scan for creator: ${creatorId}`);

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

    const whitelistSet = new Set(whitelist.map(w => cleanDomain(w.domain)).filter(Boolean));
    const knownDomainMap = new Map();
    domains.forEach(d => { knownDomainMap.set(cleanDomain(d.domain_name), d); });

    const today = new Date().toISOString().split("T")[0];
    const scanTimestamp = new Date().toISOString();
    
    // ─── 1. GENERATE QUERIES ──────────────────────────────────────────────
    const keywords = [
      "onlyfans leak", "onlyfans leaks", "leaked", "nude", "nudes", "mega",
      "telegram", "full pack", "free onlyfans", "ppv leak", "sex tape",
      "video leak", "archive", "zip", "onlyfans 2024", "onlyfans 2025",
    ];

    const queries = [];
    for (const name of allNames) {
      for (const kw of keywords) {
        queries.push(`"${name}" ${kw}`);
      }
    }

    console.log(`[SCAN] Generated ${queries.length} queries`);

    // ─── 2. EXECUTE SERP QUERIES + COLLECT ALL RESULTS ──────────────────────
    const allSerpResults = [];
    
    for (const query of queries.slice(0, 15)) {
      const [googleResults, bingResults] = await Promise.all([
        querySerpAPI("google", query),
        querySerpAPI("bing", query),
      ]);

      // Add engine info to each result
      googleResults.forEach(r => {
        allSerpResults.push({ ...r, engine: "google", query });
      });
      bingResults.forEach(r => {
        allSerpResults.push({ ...r, engine: "bing", query });
      });
    }

    console.log(`[SCAN] SERP total: ${allSerpResults.length} results (before dedup)`);

    // Deduplicate by URL
    const dedupMap = new Map();
    for (const result of allSerpResults) {
      if (!dedupMap.has(result.url)) {
        dedupMap.set(result.url, result);
      }
    }
    const uniqueResults = Array.from(dedupMap.values());
    console.log(`[SCAN] Deduplicated to ${uniqueResults.length} unique results`);

    // ─── 3. CLASSIFY ALL RESULTS WITH AI ──────────────────────────────────
    const classified = await classifyAllResults(
      stageName,
      stageName,
      legalName,
      uniqueResults,
      knownDomainMap,
      base44
    );

    console.log(`[SCAN] AI classification complete`);

    // ─── 4. CREATE CLASSIFICATION MAP ────────────────────────────────────
    const classificationMap = new Map(classified.map(c => [c.url, c]));

    // ─── 5. PROCESS RESULTS + SAVE SCANLOG ──────────────────────────────
    const [existingLeaks, existingPending] = await Promise.all([
      base44.asServiceRole.entities.Leak.filter({ creator_id: creatorId }),
      base44.asServiceRole.entities.PendingApproval.filter({ creator_id: creatorId }),
    ]);

    const existingLeakUrls = new Set(existingLeaks.map(l => l.leak_url));
    const existingPendingUrls = new Set(existingPending.map(p => p.leak_url));

    let newLeaks = 0;
    let dmcaSent = 0;
    let pendingApprovals = 0;
    const scanLogEntries = [];

    for (const result of uniqueResults) {
      const classification = classificationMap.get(result.url) || { classification: "unclassified", confidence: "low" };
      const domain = result.domain;
      const isKnownDomain = knownDomainMap.has(domain);
      const isDuplicate = existingLeakUrls.has(result.url) || existingPendingUrls.has(result.url);
      const isWhitelisted = whitelistSet.has(domain);

      let actionTaken = "ignored";
      let leakId = null;
      let pendingId = null;

      // ─── DETERMINE ACTION ────────────────────────────────────
      if (isDuplicate) {
        actionTaken = "duplicate";
      } else if (isWhitelisted) {
        actionTaken = "whitelisted";
      } else if (classification.classification === "leak" || classification.classification === "uncertain") {
        if (isKnownDomain) {
          // ─── AUTO DMCA FOR KNOWN DOMAINS ─────────────────────
          const noticeNumber = generateNoticeNumber();
          const domainEntry = knownDomainMap.get(domain);

          const newLeak = await base44.asServiceRole.entities.Leak.create({
            creator_id: creatorId,
            creator_name: stageName,
            leak_url: result.url,
            domain,
            hosting_provider: domainEntry.hosting_provider || "",
            registrar: domainEntry.registrar || "",
            country: domainEntry.country || "",
            content_type: "other",
            discovery_date: today,
            detected_by: "scraping",
            severity: "high",
            status: "found",
          });
          leakId = newLeak.id;
          newLeaks++;
          actionTaken = "dmca_sent";

          const abuseEmail = domainEntry.abuse_email || domainEntry.dmca_contact;
          if (abuseEmail) {
            const dmcaReq = await base44.asServiceRole.entities.DMCARequest.create({
              leak_id: newLeak.id,
              creator_id: creatorId,
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
              creatorId: creatorId,
              leakUrl: result.url,
              domain,
              abuseEmail,
              noticeNumber,
              leakId: newLeak.id,
              dmcaRequestId: dmcaReq.id,
              base44,
            });
            if (sent) dmcaSent++;
          }
        } else {
          // ─── PENDING APPROVAL FOR UNKNOWN DOMAINS ────────────
          const pending = await base44.asServiceRole.entities.PendingApproval.create({
            creator_id: creatorId,
            creator_name: stageName,
            leak_url: result.url,
            domain,
            content_type: "other",
            discovery_date: today,
            search_context: result.snippet || "",
            status: "pending",
          });
          pendingId = pending.id;
          pendingApprovals++;
          actionTaken = "pending_approval";
        }
      }

      // ─── SAVE SCANLOG ENTRY ─────────────────────────────────
      scanLogEntries.push({
        creator_id: creatorId,
        creator_name: stageName,
        scan_timestamp: scanTimestamp,
        search_engine: result.engine,
        query_executed: result.query,
        result_url: result.url,
        result_title: result.title,
        result_snippet: result.snippet,
        result_domain: domain,
        serp_position: result.position,
        ai_classification: classification.classification,
        ai_confidence: classification.confidence,
        is_known_domain: isKnownDomain,
        action_taken: actionTaken,
        leak_id: leakId,
        pending_approval_id: pendingId,
        notes: classification.reasoning || "",
      });
    }

    // ─── BULK INSERT SCANLOG ────────────────────────────────
    if (scanLogEntries.length > 0) {
      await base44.asServiceRole.entities.ScanLog.bulkCreate(scanLogEntries);
      console.log(`[SCAN] Saved ${scanLogEntries.length} ScanLog entries`);
    }

    console.log(`[SCAN] Complete. newLeaks=${newLeaks}, dmcaSent=${dmcaSent}, pendingApprovals=${pendingApprovals}`);

    // ─── 6. UPDATE CREATOR STATS ────────────────────────────────────────
    const allLeaks = await base44.asServiceRole.entities.Leak.filter({ creator_id: creatorId });
    const activeLeaks = allLeaks.filter(l => l.status !== "removed" && l.status !== "rejected");
    const removedLeaks = allLeaks.filter(l => l.status === "removed");
    const totalLeaks = allLeaks.length;
    const removalRate = totalLeaks > 0 ? Math.round((removedLeaks.length / totalLeaks) * 100) : 0;

    const VMC_TIER = { low: 12, medium: 25, high: 60, vip: 130 };
    const vmc = creator.content_value || VMC_TIER[creator.creator_tier] || 25;

    let estimatedLoss = 0;
    for (const leak of allLeaks) {
      const d = knownDomainMap.get(cleanDomain(leak.domain));
      const fdd = d?.diffusion_factor || 1.0;
      const daysOnline = leak.days_online || 1;
      estimatedLoss += vmc * fdd * (1 + (daysOnline / 30) * 0.15);
    }
    if (creator.ltv_mean_fan > 0) {
      const avgConv = allLeaks.length > 0
        ? allLeaks.reduce((s, l) => s + (knownDomainMap.get(cleanDomain(l.domain))?.conversion_loss_factor || 0.04), 0) / allLeaks.length
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

    return Response.json({
      success: true,
      creatorId,
      newLeaks,
      dmcaSent,
      pendingApprovals,
      serpTotal: uniqueResults.length,
      scanLogSaved: scanLogEntries.length,
    });
  } catch (error) {
    console.error("[SCAN] Fatal error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});