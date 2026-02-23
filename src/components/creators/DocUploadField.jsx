import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Upload, CheckCircle2, Loader2 } from 'lucide-react';
import { T } from '@/components/utils/theme';

export default function DocUploadField({ label, value, onChange, required = false }) {
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    onChange(file_url);
    setUploading(false);
  };

  return (
    <div className="space-y-2">
      <label style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        {label} {required && <span style={{ color: '#f87171' }}>*</span>}
      </label>
      <div
        style={{
          background: '#0a1120',
          border: value ? '1px solid rgba(16,185,129,0.4)' : '1px dashed rgba(99,102,241,0.3)',
          borderRadius: 8,
          padding: '12px 16px',
          cursor: 'pointer',
          transition: 'border-color 0.2s',
        }}
        onClick={() => !uploading && document.getElementById(`upload-${label}`).click()}
      >
        <input id={`upload-${label}`} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFile} />
        {uploading ? (
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#6366f1' }} />
            <span style={{ color: '#94a3b8', fontSize: 13 }}>Caricamento...</span>
          </div>
        ) : value ? (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" style={{ color: '#34d399' }} />
            <span style={{ color: '#34d399', fontSize: 13 }}>Documento caricato</span>
            <a href={value} target="_blank" rel="noopener noreferrer"
              className="text-xs hover:underline ml-auto" style={{ color: '#6366f1' }}
              onClick={e => e.stopPropagation()}>
              Visualizza
            </a>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4" style={{ color: '#6366f1' }} />
            <span style={{ color: '#475569', fontSize: 13 }}>Clicca per caricare (immagine o PDF)</span>
          </div>
        )}
      </div>
    </div>
  );
}