import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default function TopDomainsTable({ domains }) {
  const sortedDomains = [...domains]
    .sort((a, b) => (b.total_leaks || 0) - (a.total_leaks || 0))
    .slice(0, 8);

  return (
    <div style={{ background: '#0f172a', border: '1px solid rgba(99,102,241,0.12)', borderRadius: 12 }} className="overflow-hidden">
      <div className="px-6 pt-5 pb-3">
        <p style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 600, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
          TOP DOMINI PER LEAK
        </p>
      </div>
      <div>
        {sortedDomains.map((domain, idx) => {
          const rate = Math.round(domain.removal_rate || 0);
          return (
            <div
              key={domain.id}
              className="flex items-center gap-4 px-6 py-3 transition-colors"
              style={{ borderTop: '1px solid rgba(99,102,241,0.07)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.05)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ color: '#334155', fontSize: 12, fontFamily: 'monospace', width: 16, flexShrink: 0 }}>{String(idx + 1).padStart(2, '0')}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="flex items-center gap-1.5">
                  <p style={{ color: '#cbd5e1', fontSize: 13, fontWeight: 500 }} className="truncate">{domain.domain_name}</p>
                  {domain.high_risk_flag && (
                    <AlertTriangle style={{ width: 12, height: 12, color: '#f87171', flexShrink: 0 }} />
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span style={{ color: '#475569', fontSize: 11 }}>{domain.total_leaks || 0} leak</span>
                  <span style={{ color: '#334155', fontSize: 11 }}>·</span>
                  <span style={{ color: '#34d399', fontSize: 11 }}>{domain.total_removed || 0} rimossi</span>
                </div>
              </div>
              <div style={{ width: 80, flexShrink: 0 }}>
                <div className="flex items-center justify-between mb-1">
                  <span style={{ color: '#475569', fontSize: 10 }}>rimozione</span>
                  <span style={{ color: rate >= 70 ? '#34d399' : rate >= 40 ? '#fbbf24' : '#f87171', fontSize: 11, fontWeight: 700 }}>{rate}%</span>
                </div>
                <div style={{ height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${rate}%`,
                    background: rate >= 70 ? '#34d399' : rate >= 40 ? '#fbbf24' : '#f87171',
                    boxShadow: rate >= 70 ? '0 0 6px #34d399' : rate >= 40 ? '0 0 6px #fbbf24' : '0 0 6px #f87171',
                    borderRadius: 2,
                    transition: 'width 0.6s ease',
                  }} />
                </div>
              </div>
            </div>
          );
        })}
        {sortedDomains.length === 0 && (
          <div className="px-6 py-8 text-center" style={{ color: '#334155', fontSize: 13 }}>
            Nessun dominio registrato
          </div>
        )}
      </div>
    </div>
  );
}