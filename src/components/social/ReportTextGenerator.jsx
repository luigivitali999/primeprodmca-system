import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Copy, Check } from 'lucide-react';
import { T, cardStyle } from '@/components/utils/theme';

export default function ReportTextGenerator({ report, creator, open, onClose }) {
  const [copied, setCopied] = useState(false);

  const generateReportText = () => {
    const creatorReal = creator?.stage_name || 'Creator';
    const creatorRealLink = `https://instagram.com/${creatorReal}` || 'N/A';
    const fakeLink = report.fake_profile_url;
    const violationType = report.violation_type;

    return `SEGNALAZIONE DI ${violationType.toUpperCase()}

Creator vittima: ${creatorReal}
Profilo ufficiale: ${creatorRealLink}

Profilo falso segnalato:
Username: ${report.fake_username}
Link: ${fakeLink}

DETTAGLI VIOLAZIONE:
Tipo: ${violationType}
Piattaforma: ${report.platform}
Data segnalazione: ${report.date_reported}

DICHIARO SOTTO LA MIA RESPONSABILITÀ:

1. Attesto che il profilo indicato è un'impersonificazione non autorizzata
2. Dichiaro di agire in buona fede e con l'intento di proteggere i diritti del creator
3. Ritengo che i contenuti del profilo falso violino i termini di servizio della piattaforma

RICHIESTA:

Si richiede la rimozione immediata del profilo "${report.fake_username}" dalla piattaforma ${report.platform}, in quanto rappresenta un'impersonificazione non autorizzata del creator ${creatorReal}.

Note: ${report.notes_internal || 'Nessuna nota aggiuntiva'}

Cordiali saluti`;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generateReportText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const reportText = generateReportText();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent style={{ ...cardStyle, background: '#0f172a', maxHeight: '80vh' }} className="max-w-2xl overflow-auto">
        <DialogHeader>
          <DialogTitle style={{ color: T.text }}>Testo Segnalazione Precompilato</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-slate-900/30 rounded-lg p-4 border border-slate-700/50">
            <pre className="text-xs whitespace-pre-wrap break-words" style={{ color: T.text, fontFamily: 'monospace' }}>
              {reportText}
            </pre>
          </div>

          <div className="flex gap-3">
            <Button onClick={handleCopy} className="flex-1 gap-2" style={{ background: '#6366f1' }}>
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copiato!' : 'Copia Testo'}
            </Button>
            <Button variant="outline" onClick={onClose} className="flex-1">
              Chiudi
            </Button>
          </div>

          <p style={{ fontSize: 12, color: T.textMuted }} className="text-center">
            Il testo è pronto per essere copiato e incollato nella segnalazione ufficiale della piattaforma social.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}