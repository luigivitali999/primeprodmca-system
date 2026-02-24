import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const RISK_CONFIG = {
  critical: { label: 'Critico', color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.25)' },
  high:     { label: 'Alto',    color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.25)'  },
  medium:   { label: 'Medio',   color: '#a5b4fc', bg: 'rgba(165,180,252,0.1)',  border: 'rgba(165,180,252,0.2)'  },
  low:      { label: 'Basso',   color: '#34d399', bg: 'rgba(52,211,153,0.1)',   border: 'rgba(52,211,153,0.2)'   },
};

export default function CreatorRiskRanking({ creators }) {
  const sortedCreators = [...creators]
    .sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0))
    .slice(0, 6);

  return (
    <div style={{ background: '#0f172a', border: '1px solid rgba(99,102,241,0.12)', borderRadius: 12 }} className="overflow-hidden">
      <div className="px-6 pt-5 pb-3">
        <p style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 600, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
          CREATOR PER RISCHIO
        </p>
      </div>
      <div>
        {sortedCreators.map((creator) => {
          const risk = RISK_CONFIG[creator.risk_level] || RISK_CONFIG.low;
          const initials = creator.stage_name?.charAt(0).toUpperCase() || '?';
          const score = Math.round(creator.risk_score || 0);
          return (
            <Link
              key={creator.id}
              to={createPageUrl(`CreatorDetail?id=${creator.id}`)}
              className="flex items-center gap-4 px-6 py-3 transition-colors"
              style={{ borderTop: '1px solid rgba(99,102,241,0.07)', textDecoration: 'none' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.05)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{
                width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                background: risk.bg, border: `1px solid ${risk.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: risk.color, fontSize: 13, fontWeight: 700,
                overflow: 'hidden',
              }}>
                {creator.profile_image
                  ? <img src={creator.profile_image} alt={creator.stage_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : initials
                }
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: '#cbd5e1', fontSize: 13, fontWeight: 500 }} className="truncate">{creator.stage_name}</p>
                <p style={{ color: '#475569', fontSize: 11 }}>{creator.active_leaks || 0} leak attivi</p>
              </div>
              <div className="flex items-center gap-3">
                <div style={{ textAlign: 'right' }}>
                  <p style={{ color: risk.color, fontSize: 16, fontWeight: 700, lineHeight: 1, textShadow: `0 0 8px ${risk.color}` }}>{score}</p>
                  <p style={{ color: '#334155', fontSize: 10 }}>score</p>
                </div>
                <div style={{
                  padding: '2px 8px', borderRadius: 6,
                  background: risk.bg, border: `1px solid ${risk.border}`,
                  color: risk.color, fontSize: 10, fontWeight: 600,
                  letterSpacing: '0.05em',
                }}>
                  {risk.label}
                </div>
              </div>
            </Link>
          );
        })}
        {sortedCreators.length === 0 && (
          <div className="px-6 py-8 text-center" style={{ color: '#334155', fontSize: 13 }}>
            Nessun creator registrato
          </div>
        )}
      </div>
    </div>
  );
}