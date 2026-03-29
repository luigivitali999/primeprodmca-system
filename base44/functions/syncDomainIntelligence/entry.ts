import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    console.log('[DOMAIN SYNC] Starting domain intelligence sync from DMCA requests');

    // Fetch all DMCA requests and leaks
    const [dmcaRequests, leaks, existingDomains] = await Promise.all([
      base44.asServiceRole.entities.DMCARequest.list(),
      base44.asServiceRole.entities.Leak.list(),
      base44.asServiceRole.entities.DomainIntelligence.list(),
    ]);

    console.log(`[DOMAIN SYNC] Found ${dmcaRequests.length} DMCA requests and ${leaks.length} leaks`);

    const domainMap = new Map(existingDomains.map(d => [d.domain_name, d]));
    const newDomains = [];
    let updated = 0;

    // Process each DMCA request
    for (const dmcaRequest of dmcaRequests) {
      const leak = leaks.find(l => l.id === dmcaRequest.leak_id);
      if (!leak) continue;

      const domain = leak.domain;
      if (!domain) continue;

      if (!domainMap.has(domain)) {
        // Create new domain intelligence
        newDomains.push({
          domain_name: domain,
          total_leaks: 1,
          active_leaks: leak.status !== 'removed' ? 1 : 0,
          removal_count: leak.status === 'removed' ? 1 : 0,
        });
        console.log(`[DOMAIN SYNC] New domain added: ${domain}`);
      } else {
        // Update existing domain statistics
        const existingDomain = domainMap.get(domain);
        const isRemoved = leak.status === 'removed';
        
        await base44.asServiceRole.entities.DomainIntelligence.update(
          existingDomain.id,
          {
            total_leaks: (existingDomain.total_leaks || 0) + 1,
            active_leaks: isRemoved ? (existingDomain.active_leaks || 0) : (existingDomain.active_leaks || 0) + 1,
            removal_count: isRemoved ? (existingDomain.removal_count || 0) + 1 : (existingDomain.removal_count || 0),
          }
        );
        updated++;
      }
    }

    // Bulk create new domains
    if (newDomains.length > 0) {
      await base44.asServiceRole.entities.DomainIntelligence.bulkCreate(newDomains);
      console.log(`[DOMAIN SYNC] Created ${newDomains.length} new domain records`);
    }

    console.log(`[DOMAIN SYNC] Updated ${updated} existing domains`);

    return Response.json({
      success: true,
      created: newDomains.length,
      updated,
      message: `Synced ${newDomains.length + updated} domains`,
    });
  } catch (error) {
    console.error('[DOMAIN SYNC] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});