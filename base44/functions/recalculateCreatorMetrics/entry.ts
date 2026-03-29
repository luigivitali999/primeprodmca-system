import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

function cleanDomain(raw) {
  if (!raw) return null;
  try {
    const withProto = raw.startsWith('http') ? raw : `https://${raw}`;
    const parsed = new URL(withProto);
    return parsed.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return raw.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
  }
}

const VMC_TIER = { low: 12, medium: 25, high: 60, vip: 130 };

function calcRiskScore(estimatedLoss, activeLeaks, removalRate) {
  const lossComponent = Math.min(estimatedLoss / 10000, 1) * 35;
  const leakComponent = Math.min(activeLeaks / 20, 1) * 15;
  const removalComponent = (1 - removalRate / 100) * 15;
  const baseComponent = 15;
  return Math.min(Math.round(lossComponent + leakComponent + removalComponent + baseComponent), 100);
}

function calcRiskLevel(score) {
  if (score >= 81) return 'critical';
  if (score >= 61) return 'high';
  if (score >= 31) return 'medium';
  return 'low';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('[RECALC] Starting global creator metrics recalculation...');

    // Fetch all data
    const [creators, leaks, domains, dmcaRequests] = await Promise.all([
      base44.asServiceRole.entities.Creator.list('-created_date', 1000),
      base44.asServiceRole.entities.Leak.list('-created_date', 5000),
      base44.asServiceRole.entities.DomainIntelligence.list('-created_date', 1000),
      base44.asServiceRole.entities.DMCARequest.list('-created_date', 5000),
    ]);

    const domainMap = new Map();
    domains.forEach(d => {
      domainMap.set(cleanDomain(d.domain_name), d);
    });

    let updatedCount = 0;

    // Process each creator
    for (const creator of creators) {
      console.log(`[RECALC] Processing creator: ${creator.stage_name} (${creator.id})`);

      // Get creator's leaks
      const creatorLeaks = leaks.filter(l => l.creator_id === creator.id);
      const activeLeaks = creatorLeaks.filter(l => l.status !== 'removed' && l.status !== 'rejected');
      const removedLeaks = creatorLeaks.filter(l => l.status === 'removed');
      const totalLeaks = creatorLeaks.length;

      // Calculate removal stats
      const removalRate = totalLeaks > 0 ? Math.round((removedLeaks.length / totalLeaks) * 100) : 0;

      let avgRemovalTime = null;
      const removedWithDates = removedLeaks.filter(l => l.first_notice_date && l.removal_date);
      if (removedWithDates.length > 0) {
        avgRemovalTime = Math.round(
          removedWithDates.reduce((sum, l) => {
            const firstDate = new Date(l.first_notice_date);
            const removalDate = new Date(l.removal_date);
            return sum + (removalDate - firstDate) / (24 * 60 * 60 * 1000);
          }, 0) / removedWithDates.length
        );
      }

      // Calculate estimated loss (only active leaks)
      let estimatedLoss = 0;
      for (const leak of activeLeaks) {
        const domain = domainMap.get(cleanDomain(leak.domain));
        const vmc = creator.content_value || VMC_TIER[creator.creator_tier] || 25;
        const fdd = domain?.diffusion_factor || 1.0;
        const daysOnline = leak.days_online || 1;
        const iit = 1 + (daysOnline / 30) * 0.15;
        estimatedLoss += vmc * fdd * iit;
      }

      // Add LTV-based opportunity loss
      if (creator.ltv_mean_fan && creator.ltv_mean_fan > 0 && activeLeaks.length > 0) {
        const avgConversionLoss = activeLeaks.reduce((sum, l) => {
          const domain = domainMap.get(cleanDomain(l.domain));
          return sum + (domain?.conversion_loss_factor || 0.04);
        }, 0) / activeLeaks.length;
        estimatedLoss += creator.ltv_mean_fan * avgConversionLoss * activeLeaks.length;
      }

      estimatedLoss = Math.round(estimatedLoss * 100) / 100;

      // Calculate risk score
      const riskScore = calcRiskScore(estimatedLoss, activeLeaks.length, removalRate);
      const riskLevel = calcRiskLevel(riskScore);

      // Update creator with recalculated metrics
      await base44.asServiceRole.entities.Creator.update(creator.id, {
        total_leaks: totalLeaks,
        active_leaks: activeLeaks.length,
        removed_leaks: removedLeaks.length,
        removal_rate: removalRate,
        estimated_loss: estimatedLoss,
        avg_removal_time: avgRemovalTime,
        risk_score: riskScore,
        risk_level: riskLevel,
      });

      console.log(`[RECALC] ✓ ${creator.stage_name}: ${totalLeaks} total, ${activeLeaks.length} active, loss=$${estimatedLoss}, risk=${riskLevel}(${riskScore})`);
      updatedCount++;
    }

    console.log(`[RECALC] Completed! Updated ${updatedCount} creators.`);
    return Response.json({
      success: true,
      creatorsUpdated: updatedCount,
      message: `Recalculated metrics for ${updatedCount} creators`,
    });
  } catch (error) {
    console.error('[RECALC] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});