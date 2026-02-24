import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle, Loader, AlertCircle } from 'lucide-react';

const STEPS = [
  'Recupera i dati',
  "Costruisce l'email",
  'Invia via Brevo',
  'Aggiorna lo stato',
  'Completo'
];

export default function SendDMCAProgressDialog({ isOpen, currentStep, error, creatorName, domain }) {
  return (
    <Dialog open={isOpen}>
      <DialogContent style={{ background: '#0f172a', border: '1px solid rgba(99,102,241,0.2)', color: '#e2e8f0' }} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle style={{ color: '#e2e8f0' }}>Invio DMCA in Corso</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {creatorName && domain && (
            <div style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '0.5rem', padding: '1rem' }}>
              <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Creator: <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{creatorName}</span></p>
              <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '0.5rem' }}>Domain: <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{domain}</span></p>
            </div>
          )}

          <div className="space-y-3">
            {STEPS.map((step, index) => {
              const isCompleted = currentStep > index;
              const isActive = currentStep === index;
              const isFailed = error && isActive;

              return (
                <div key={index} className="flex items-center gap-3">
                  <div style={{
                    width: '2rem',
                    height: '2rem',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isCompleted ? 'rgba(16,185,129,0.15)' : isActive ? 'rgba(99,102,241,0.15)' : 'rgba(51,65,85,0.2)',
                    border: isCompleted ? '2px solid #10b981' : isActive ? '2px solid #6366f1' : '2px solid rgba(99,102,241,0.2)',
                  }}>
                    {isCompleted && <CheckCircle className="w-5 h-5" style={{ color: '#10b981' }} />}
                    {isActive && !isFailed && <Loader className="w-5 h-5 animate-spin" style={{ color: '#6366f1' }} />}
                    {isFailed && <AlertCircle className="w-5 h-5" style={{ color: '#ef4444' }} />}
                    {!isCompleted && !isActive && <span style={{ color: '#94a3b8', fontSize: '0.875rem', fontWeight: 600 }}>{index + 1}</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ 
                      color: isCompleted ? '#10b981' : isActive ? '#6366f1' : '#94a3b8',
                      fontSize: '0.875rem',
                      fontWeight: isActive ? 600 : 500,
                    }}>
                      {step}
                    </p>
                    {isActive && !isFailed && (
                      <p style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.25rem' }}>In corso...</p>
                    )}
                    {isFailed && (
                      <p style={{ color: '#fca5a5', fontSize: '0.75rem', marginTop: '0.25rem' }}>Errore: {error}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {currentStep === STEPS.length - 1 && (
            <div style={{ 
              background: 'rgba(16,185,129,0.15)', 
              border: '1px solid rgba(16,185,129,0.3)',
              borderRadius: '0.5rem', 
              padding: '1rem',
              marginTop: '1rem'
            }}>
              <p style={{ color: '#10b981', fontSize: '0.875rem', fontWeight: 600 }}>✓ DMCA inviata con successo!</p>
              <p style={{ color: '#86efac', fontSize: '0.75rem', marginTop: '0.5rem' }}>Lo stato è stato aggiornato a "Inviata"</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}