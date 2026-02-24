import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

function generateNoticeNumber() {
  return `PRIME-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all active leaks (not removed)
    const leaks = await base44.asServiceRole.entities.Leak.filter({ status: { $ne: 'removed' } });
    
    let sent = 0;
    let skipped = 0;

    for (const leak of leaks) {
      // Skip if no DMCA request exists yet or if recently sent
      const dmcaRequests = await base44.asServiceRole.entities.DMCARequest.filter({ leak_id: leak.id });
      
      if (dmcaRequests.length === 0) {
        skipped++;
        continue;
      }

      const lastDMCA = dmcaRequests.sort((a, b) => 
        new Date(b.sent_date || 0) - new Date(a.sent_date || 0)
      )[0];

      // Only re-send if more than 5 days have passed
      const daysSinceSent = lastDMCA.sent_date 
        ? Math.floor((Date.now() - new Date(lastDMCA.sent_date).getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      if (daysSinceSent < 5) {
        skipped++;
        continue;
      }

      // Get domain intelligence
      const domainIntel = await base44.asServiceRole.entities.DomainIntelligence.filter({ 
        domain_name: leak.domain 
      });
      
      const abuseEmail = domainIntel.length > 0 ? domainIntel[0].abuse_email : null;
      
      if (!abuseEmail) {
        skipped++;
        continue;
      }

      // Get creator for doc_selfie
      const creator = await base44.asServiceRole.entities.Creator.filter({ id: leak.creator_id });
      const docSelfieUrl = creator.length > 0 ? creator[0].doc_selfie_url : null;

      // Send DMCA
      try {
        await base44.asServiceRole.functions.invoke('sendDMCA', {
          leakId: leak.id,
          creatorId: leak.creator_id,
          creatorName: leak.creator_name,
          leakUrl: leak.leak_url,
          domain: leak.domain,
          sentToEntity: domainIntel.length > 0 ? domainIntel[0].hosting_provider : 'Unknown',
          abuseEmail,
          noticeNumber: generateNoticeNumber(),
          docSelfieUrl,
        });
        sent++;
      } catch (err) {
        console.error(`Failed to send DMCA for leak ${leak.id}: ${err.message}`);
      }
    }

    return Response.json({ 
      success: true, 
      total_active_leaks: leaks.length,
      dmca_sent: sent,
      skipped: skipped
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});