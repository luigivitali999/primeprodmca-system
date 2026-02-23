import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Wand2, Loader2, CheckCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";

/**
 * Button that auto-discovers the abuse email for a given domain using AI + web search.
 * onFound(email) is called when an email is found.
 */
export default function AbuseEmailLookup({ domain, onFound }) {
  const [loading, setLoading] = useState(false);
  const [found, setFound] = useState(null);
  const [error, setError] = useState(null);

  const handleLookup = async () => {
    if (!domain || loading) return;
    setLoading(true);
    setError(null);
    setFound(null);

    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Find the official abuse/DMCA contact email address for the domain: "${domain}".
Search WHOIS records, the domain's abuse contact, hosting provider abuse email, and any DMCA takedown contact.
Return ONLY the most relevant abuse or DMCA email address found. If multiple exist, prefer the one specifically for DMCA/copyright takedowns.
If no email is found, return null.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            abuse_email: { type: 'string', description: 'The abuse or DMCA contact email, or null if not found' },
            source: { type: 'string', description: 'Where this email was found (e.g. WHOIS, hosting provider page, etc.)' },
          },
        },
      });

      const email = result?.abuse_email;
      if (email && email.includes('@')) {
        setFound({ email, source: result?.source });
        onFound && onFound(email);
      } else {
        setError('Nessuna email trovata automaticamente. Inseriscila manualmente.');
      }
    } catch (err) {
      setError('Errore durante la ricerca. Riprova.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        size="sm"
        onClick={handleLookup}
        disabled={loading || !domain}
        style={{
          background: loading ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.15)',
          border: '1px solid rgba(99,102,241,0.3)',
          color: '#a5b4fc',
          fontSize: 11,
        }}
      >
        {loading
          ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Ricerca in corso...</>
          : found
          ? <><CheckCircle className="w-3 h-3 mr-1" />Trovata: {found.email}</>
          : <><Wand2 className="w-3 h-3 mr-1" />Cerca automaticamente</>
        }
      </Button>
      {found?.source && (
        <p className="text-xs" style={{ color: '#64748b' }}>Fonte: {found.source}</p>
      )}
      {error && (
        <p className="text-xs" style={{ color: '#f87171' }}>{error}</p>
      )}
    </div>
  );
}