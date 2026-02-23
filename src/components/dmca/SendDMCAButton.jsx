import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { Send, Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import AbuseEmailLookup from '@/components/dmca/AbuseEmailLookup';

/**
 * Button that triggers a DMCA sendout via the sendDMCA backend function.
 * It auto-fetches the domain's abuse email and the creator's selfie for attachment.
 *
 * Props:
 *   leak          - Leak entity object (required)
 *   dmcaRequestId - optional existing DMCARequest id
 *   onSuccess     - callback after successful send
 *   size          - button size (default "sm")
 *   label         - button label (default "Invia DMCA")
 */
export default function SendDMCAButton({ leak, dmcaRequestId, onSuccess, size = 'sm', label = 'Invia DMCA' }) {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  const handleSend = async (e) => {
    e.stopPropagation();
    if (loading || sent) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Fetch creator to get selfie URL
      let docSelfieUrl = null;
      if (leak.creator_id) {
        const creators = await base44.entities.Creator.filter({ id: leak.creator_id });
        docSelfieUrl = creators[0]?.doc_selfie_url || null;
      }

      // 2. Fetch domain intelligence for abuse email
      let abuseEmail = null;
      if (leak.domain) {
        const domainEntries = await base44.entities.DomainIntelligence.filter({ domain_name: leak.domain });
        abuseEmail = domainEntries[0]?.abuse_email || domainEntries[0]?.dmca_contact || null;
      }

      if (!abuseEmail) {
        setError('Email abuse non trovata per questo dominio. Aggiungila in Domain Intelligence.');
        setLoading(false);
        return;
      }

      // 3. Generate notice number and create/get DMCARequest
      const noticeNumber = dmcaRequestId
        ? (await base44.entities.DMCARequest.filter({ id: dmcaRequestId }))[0]?.notice_number
        : `PRIME-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      let activeDmcaId = dmcaRequestId;
      if (!activeDmcaId) {
        const dmcaReq = await base44.entities.DMCARequest.create({
          leak_id: leak.id,
          creator_id: leak.creator_id,
          creator_name: leak.creator_name,
          notice_number: noticeNumber,
          sent_to_entity: leak.hosting_provider || leak.domain,
          sent_to_type: 'hosting',
          method: 'email',
          status: 'pending',
          escalation_level: 0,
          follow_up_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        });
        activeDmcaId = dmcaReq.id;
      }

      // 4. Call backend function
      const result = await base44.functions.invoke('sendDMCA', {
        dmcaRequestId: activeDmcaId,
        leakId: leak.id,
        creatorId: leak.creator_id,
        creatorName: leak.creator_name,
        leakUrl: leak.leak_url,
        domain: leak.domain,
        sentToEntity: leak.hosting_provider || leak.domain,
        abuseEmail,
        noticeNumber,
        docSelfieUrl,
      });

      setSent(true);
      onSuccess && onSuccess({ dmcaRequestId: activeDmcaId, noticeNumber });
    } catch (err) {
      setError(err.message || 'Errore durante l\'invio');
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return (
      <div className="flex flex-col gap-1">
        <Button size={size} onClick={handleSend}
          style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
          <Send className="w-3.5 h-3.5 mr-1" />Riprova
        </Button>
        <p className="text-xs text-red-400 max-w-[200px]">{error}</p>
      </div>
    );
  }

  if (sent) {
    return (
      <Button size={size} disabled
        style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399' }}>
        <Send className="w-3.5 h-3.5 mr-1" />Inviata ✓
      </Button>
    );
  }

  return (
    <Button size={size} onClick={handleSend} disabled={loading}
      style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc' }}>
      {loading ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1" />}
      {loading ? 'Invio...' : label}
    </Button>
  );
}