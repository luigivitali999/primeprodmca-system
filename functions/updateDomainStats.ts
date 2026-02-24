import { createClientFromRequest } from "npm:@base44/sdk@0.8.6";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { 
      headers: { 
        "Access-Control-Allow-Origin": "*", 
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type, Authorization" 
      } 
    });
  }

  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { domain, event_type, leak_id } = body;

    if (!domain || !event_type) {
      return Response.json({ error: "Missing domain or event_type" }, { status: 400 });
    }

    const cleanedDomain = cleanDomain(domain);
    if (!cleanedDomain) {
      return Response.json({ error: "Invalid domain" }, { status: 400 });
    }

    console.log(`[DOMAIN STATS] Event: ${event_type} | Domain: ${cleanedDomain} | LeakID: ${leak_id || "N/A"}`);

    // Fetch or create DomainIntelligence
    const existing = await base44.asServiceRole.entities.DomainIntelligence.filter(
      { domain_name: cleanedDomain }
    );
    
    let domainRecord = existing.length > 0 ? existing[0] : null;

    if (!domainRecord) {
      // Create new DomainIntelligence record
      domainRecord = await base44.asServiceRole.entities.DomainIntelligence.create({
        domain_name: cleanedDomain,
        total_leaks: 0,
        removal_count: 0,
        removal_rate: 0,
        active_leaks: 0,
        escalation_count: 0,
        last_updated: new Date().toISOString(),
      });
      console.log(`[DOMAIN STATS] Created new domain record: ${cleanedDomain}`);
    }

    let updates = { last_updated: new Date().toISOString() };

    // ─── HANDLE EVENT TYPE ────────────────────────────────────────
    if (event_type === "dmca_sent") {
      // Increment total_leaks
      updates.total_leaks = (domainRecord.total_leaks || 0) + 1;
      updates.active_leaks = updates.total_leaks - (domainRecord.removal_count || 0);
      updates.removal_rate = domainRecord.removal_count > 0 
        ? Math.round((domainRecord.removal_count / updates.total_leaks) * 100) 
        : 0;
      console.log(`[DOMAIN STATS] DMCA sent: total_leaks=${updates.total_leaks}`);

    } else if (event_type === "removal_confirmed") {
      // Increment removal_count and recalculate
      updates.removal_count = (domainRecord.removal_count || 0) + 1;
      updates.active_leaks = (domainRecord.total_leaks || 0) - updates.removal_count;
      updates.removal_rate = domainRecord.total_leaks > 0
        ? Math.round((updates.removal_count / domainRecord.total_leaks) * 100)
        : 0;

      // Calculate avg_removal_time if leak_id provided
      if (leak_id) {
        try {
          const leak = await base44.asServiceRole.entities.Leak.get(leak_id);
          if (leak && leak.first_notice_date && leak.removal_date) {
            const daysDiff = Math.floor(
              (new Date(leak.removal_date) - new Date(leak.first_notice_date)) / 86400000
            );
            
            // Recalculate average removal time
            const leaksWithRemovalTime = await base44.asServiceRole.entities.Leak.filter({
              domain: cleanedDomain,
              status: "removed"
            });
            
            const validRemovals = leaksWithRemovalTime.filter(l => l.first_notice_date && l.removal_date);
            if (validRemovals.length > 0) {
              const totalDays = validRemovals.reduce((sum, l) => {
                return sum + Math.floor((new Date(l.removal_date) - new Date(l.first_notice_date)) / 86400000);
              }, 0);
              updates.avg_removal_time = Math.round(totalDays / validRemovals.length);
            }
          }
        } catch (err) {
          console.warn(`[DOMAIN STATS] Could not calculate removal time for leak ${leak_id}: ${err.message}`);
        }
      }
      console.log(`[DOMAIN STATS] Removal confirmed: removal_count=${updates.removal_count}, avg_removal_time=${updates.avg_removal_time || "N/A"}`);

    } else if (event_type === "escalation") {
      // Increment escalation_count
      updates.escalation_count = (domainRecord.escalation_count || 0) + 1;
      console.log(`[DOMAIN STATS] Escalation triggered: escalation_count=${updates.escalation_count}`);
    }

    // ─── UPDATE DOMAIN RECORD ────────────────────────────────────
    await base44.asServiceRole.entities.DomainIntelligence.update(domainRecord.id, updates);
    console.log(`[DOMAIN STATS] Domain ${cleanedDomain} updated successfully`);

    // ─── UPDATE CREATOR STATS (RECALCULATE ESTIMATED LOSS) ────────
    if (leak_id) {
      try {
        const leak = await base44.asServiceRole.entities.Leak.get(leak_id);
        if (leak?.creator_id) {
          const creator = await base44.asServiceRole.entities.Creator.get(leak.creator_id);
          const allLeaks = await base44.asServiceRole.entities.Leak.filter({ creator_id: leak.creator_id });
          const domains = await base44.asServiceRole.entities.DomainIntelligence.list();
          const knownDomainMap = new Map(domains.map(d => [cleanDomain(d.domain_name), d]));

          const activeLeaks = allLeaks.filter(l => l.status !== "removed" && l.status !== "rejected");
          const removedLeaks = allLeaks.filter(l => l.status === "removed");
          const totalLeaks = allLeaks.length;
          const removalRate = totalLeaks > 0 ? Math.round((removedLeaks.length / totalLeaks) * 100) : 0;

          const VMC_TIER = { low: 12, medium: 25, high: 60, vip: 130 };
          const vmc = creator.content_value || VMC_TIER[creator.creator_tier] || 25;

          let estimatedLoss = 0;
          for (const l of allLeaks) {
            const d = knownDomainMap.get(cleanDomain(l.domain));
            const fdd = d?.diffusion_factor || 1.0;
            const daysOnline = l.days_online || 1;
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

          await base44.asServiceRole.entities.Creator.update(leak.creator_id, {
            total_leaks: totalLeaks,
            active_leaks: activeLeaks.length,
            removed_leaks: removedLeaks.length,
            removal_rate: removalRate,
            estimated_loss: estimatedLoss,
            avg_removal_time: avgRemovalTime,
            risk_score: riskScore,
            risk_level: riskLevel,
          });
          console.log(`[DOMAIN STATS] Creator ${leak.creator_id} stats updated: estimated_loss=${estimatedLoss}`);
        }
      } catch (err) {
        console.warn(`[DOMAIN STATS] Creator stats update failed: ${err.message}`);
      }
    }

    return Response.json({
      success: true,
      domain: cleanedDomain,
      event: event_type,
      updates,
    });

  } catch (error) {
    console.error("[DOMAIN STATS] Fatal error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});