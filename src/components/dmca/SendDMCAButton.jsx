import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Send, Loader2, FileText, CheckCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import DMCAFormModal from '@/components/dmca/DMCAFormModal';

/**
 * Button that triggers a DMCA sendout.
 * - If domain method is "email": sends via backend function.
 * - If domain method is "form": opens a modal with notice text + form link + manual confirm.
 */
export default function SendDMCAButton({ leak, dmcaRequestId, onSuccess, size = 'sm', label = 'Invia DMCA' }) {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);
  const [formModal, setFormModal] = useState(null); // { formUrl, noticeNumber, activeDmcaId }
  const [preferredMethod, setPreferredMethod] = useState(null);

  const handleSend = async (e) => {
    e.stopPropagation();
    if (loading || sent) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Fetch creator + domain in parallel
      const [creators, domainEntries] = await Promise.all([
        leak.creator_id ? base44.entities.Creator.filter({ id: leak.creator_id }) : Promise.resolve([]),
        leak.domain ? base44.entities.DomainIntelligence.filter({ domain_name: leak.domain }) : Promise.resolve([]),
      ]);
      const docSelfieUrl = creators[0]?.doc_selfie_url || null;
      const domainData = domainEntries[0] || null;
      const preferredMethod = domainData?.preferred_method || 'email';

      // 2. Generate notice number and create DMCARequest if needed
      const noticeNumber = `PRIME-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      let activeDmcaId = dmcaRequestId;
      if (!activeDmcaId) {
        const dmcaReq = await base44.entities.DMCARequest.create({
          leak_id: leak.id,
          creator_id: leak.creator_id,
          creator_name: leak.creator_name,
          notice_number: noticeNumber,
          sent_to_entity: leak.hosting_provider || leak.domain,
          sent_to_type: 'hosting',
          method: preferredMethod,
          status: 'pending',
          escalation_level: 0,
          follow_up_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        });
        activeDmcaId = dmcaReq.id;
      }

      // 3. If method is "form" → open modal
      if (preferredMethod === 'form') {
        setFormModal({
          formUrl: domainData?.dmca_contact || null,
          noticeNumber,
          activeDmcaId,
        });
        setLoading(false);
        return;
      }

      // 4. Email method → find abuse email
      let abuseEmail = domainData?.abuse_email || domainData?.dmca_contact || null;

      if (!abuseEmail) {
        // Try to discover via AI
        try {
          const result = await base44.integrations.Core.InvokeLLM({
            prompt: `Find the official abuse/DMCA contact email address for the domain: "${leak.domain}". Search WHOIS records and hosting provider abuse contacts. Return ONLY the most relevant email address.`,
            add_context_from_internet: true,
            response_json_schema: {
              type: 'object',
              properties: { abuse_email: { type: 'string' } },
            },
          });
          const foundEmail = result?.abuse_email;
          if (foundEmail && foundEmail.includes('@') && foundEmail.includes('.')) {
            abuseEmail = foundEmail;
            if (domainData) {
              await base44.entities.DomainIntelligence.update(domainData.id, { abuse_email: abuseEmail });
            }
          } else {
            abuseEmail = null;
          }
        } catch (_) { abuseEmail = null; }

        if (!abuseEmail) {
          setError(`Email abuse non trovata per "${leak.domain}". Inseriscila manualmente in Domain Intelligence.`);
          setLoading(false);
          return;
        }
      }

      // 5. Send via backend function
      await base44.functions.invoke('sendDMCA', {
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
    <>
      <Button size={size} onClick={handleSend} disabled={loading}
        style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc' }}>
        {loading ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1" />}
        {loading ? 'Caricamento...' : label}
      </Button>

      {formModal && (
        <DMCAFormModal
          open={!!formModal}
          onOpenChange={(open) => { if (!open) setFormModal(null); }}
          leak={leak}
          formUrl={formModal.formUrl}
          noticeNumber={formModal.noticeNumber}
          activeDmcaId={formModal.activeDmcaId}
          onMarkedSent={(data) => {
            setSent(true);
            setFormModal(null);
            onSuccess && onSuccess(data);
          }}
        />
      )}
    </>
  );
}