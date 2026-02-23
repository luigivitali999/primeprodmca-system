import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { ExternalLink, Copy, CheckCircle, ClipboardCheck } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { T } from '@/components/utils/theme';

function buildNoticeText({ noticeNumber, creatorName, leakUrl, domain, sentToEntity }) {
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  return `DMCA TAKEDOWN NOTICE
Notice Reference: ${noticeNumber}
Date: ${today}

To: ${sentToEntity || domain} Abuse / DMCA Department

I am writing on behalf of ${creatorName}, the copyright owner of the content described below.

INFRINGING CONTENT:
URL: ${leakUrl}
Domain: ${domain}

This content reproduces copyrighted material belonging exclusively to ${creatorName} without authorization. The publication, distribution, or hosting of this material constitutes copyright infringement under the Digital Millennium Copyright Act (17 U.S.C. § 512) and/or applicable international copyright law.

We hereby request the immediate removal or disabling of access to the infringing content identified above.

I have a good faith belief that the use of the copyrighted material described above is not authorized by the copyright owner, its agent, or the law.

I declare, under penalty of perjury, that the information in this notification is accurate, and that I am authorized to act on behalf of the copyright owner.

Sincerely,
PRIME DMCA Intelligence
On behalf of: ${creatorName}
Reference: ${noticeNumber}`;
}

export default function DMCAFormModal({ open, onOpenChange, leak, formUrl, noticeNumber, activeDmcaId, onMarkedSent }) {
  const [copied, setCopied] = useState(false);
  const [marking, setMarking] = useState(false);
  const [marked, setMarked] = useState(false);
  const [notes, setNotes] = useState('');

  React.useEffect(() => {
    if (formUrl && open) {
      window.open(formUrl, '_blank');
    }
  }, [formUrl, open]);

  const noticeText = buildNoticeText({
    noticeNumber,
    creatorName: leak?.creator_name || 'the Creator',
    leakUrl: leak?.leak_url || '',
    domain: leak?.domain || '',
    sentToEntity: leak?.hosting_provider || leak?.domain || '',
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(noticeText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleMarkSent = async () => {
    if (marking || marked) return;
    setMarking(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      if (activeDmcaId) {
        await base44.entities.DMCARequest.update(activeDmcaId, {
          status: 'sent',
          method: 'form',
          sent_date: today,
          notes: notes || undefined,
          follow_up_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        });
      }
      if (leak?.id) {
        await base44.entities.Leak.update(leak.id, {
          status: 'notice_sent',
          first_notice_date: today,
          notes: leak.notes ? `${leak.notes}\n---\nForm submission: ${notes}` : `Form submission: ${notes}`,
        });
      }
      setMarked(true);
      onMarkedSent && onMarkedSent({ dmcaRequestId: activeDmcaId, noticeNumber });
    } finally {
      setMarking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        style={{ background: '#0f172a', border: '1px solid rgba(99,102,241,0.2)', color: T.text, maxWidth: 640 }}
        className="max-h-[90vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle style={{ color: T.text }}>Invio DMCA tramite Form</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Step 1 */}
          <div className="rounded-lg p-3 space-y-2" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#a5b4fc' }}>
              Step 1 — Copia il testo della notice
            </p>
            <pre className="text-xs whitespace-pre-wrap rounded-lg p-3 overflow-auto max-h-52" style={{ background: '#080e1a', color: '#94a3b8', fontFamily: 'monospace' }}>
              {noticeText}
            </pre>
            <Button size="sm" onClick={handleCopy}
              style={{ background: copied ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.15)', border: `1px solid ${copied ? 'rgba(16,185,129,0.3)' : 'rgba(99,102,241,0.3)'}`, color: copied ? '#34d399' : '#a5b4fc' }}>
              {copied ? <><CheckCircle className="w-3.5 h-3.5 mr-1" />Copiato!</> : <><Copy className="w-3.5 h-3.5 mr-1" />Copia testo</>}
            </Button>
          </div>

          {/* Step 2 */}
          <div className="rounded-lg p-3 space-y-2" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#a5b4fc' }}>
              Step 2 — Apri il form e incolla il testo
            </p>
            {formUrl ? (
              <Button size="sm" asChild
                style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa' }}>
                <a href={formUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-3.5 h-3.5 mr-1" />Apri Form DMCA
                </a>
              </Button>
            ) : (
              <p className="text-xs" style={{ color: '#f87171' }}>
                URL del form non configurato. Aggiungilo nel campo "Contatto DMCA" in Domain Intelligence.
              </p>
            )}
          </div>

          {/* Step 3 */}
          <div className="rounded-lg p-3 space-y-2" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#34d399' }}>
              Step 3 — Dopo aver inviato il form, registra l'invio
            </p>
            <Button size="sm" onClick={handleMarkSent} disabled={marking || marked}
              style={{ background: marked ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399' }}>
              {marked
                ? <><CheckCircle className="w-3.5 h-3.5 mr-1" />Registrata come Inviata ✓</>
                : <><ClipboardCheck className="w-3.5 h-3.5 mr-1" />{marking ? 'Salvataggio...' : 'Segna come Inviata'}</>
              }
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}