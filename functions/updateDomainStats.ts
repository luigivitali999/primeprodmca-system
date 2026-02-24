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