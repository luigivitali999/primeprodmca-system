import React from 'react';
import { TrendingDown } from 'lucide-react';
import { T, VMC_TIER, calcEstimatedLoss } from '@/components/utils/theme';

export default function EconomicLossCard({ creators = [], leaks = [], domains = [] }) {
  // Total estimated loss across all creators
  const totalLoss = creators.reduce((sum, creator) => {
    const creatorLeaks = leaks.filter(l => l.creator_id === creator.id);
    return sum + calcEstimatedLoss(creatorLeaks, creator, domains);
  }, 0);

  const monthlyLoss = leaks
    .filter(l => {
      const d = new Date(l.discovery_date || l.created_date);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((sum, leak) => {
      const creator = creators.find(c => c.id === leak.creator_id);
      if (!creator) return sum;
      const domain = domains.find(d => d.domain_name === leak.domain);
      const vmc = creator.content_value || VMC_TIER[creator.creator_tier] || 40;
      const fdd = domain?.diffusion_factor || 1.0;
      const iit = 1 + ((leak.days_online || 1) / 30) * 0.15;
      return sum + (vmc * fdd * iit);
    }, 0);

  const fmt = (n) => n >= 1000 ? `€${(n / 1000).toFixed(1)}k` : `€${Math.round(n)}`;

  return (
    <div className="rounded-xl p-5 relative overflow-hidden" style={{ background: '#0f172a', border: '1px solid rgba(239,68,68,0.15)' }}>
      <div style={{
        position: 'absolute', top: 0, right: 0, width: 120, height: 120,
        background: 'rgba(239,68,68,0.08)', borderRadius: '50%',
        transform: 'translate(40%,-40%)', filter: 'blur(30px)', pointerEvents: 'none',
      }} />
      <div className="relative flex items-start justify-between">
        <div>
          <p style={{ color: '#475569', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Perdita Economica Stimata
          </p>
          <p style={{ color: '#f87171', fontSize: 28, fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.02em', marginTop: 4 }}>
            {fmt(totalLoss)}
          </p>
          <p style={{ color: '#475569', fontSize: 12, marginTop: 2 }}>
            {fmt(monthlyLoss)} questo mese
          </p>
        </div>
        <div style={{
          width: 42, height: 42, borderRadius: 10,
          background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 12px rgba(239,68,68,0.2)', flexShrink: 0,
        }}>
          <TrendingDown style={{ width: 18, height: 18, color: '#f87171' }} />
        </div>
      </div>
    </div>
  );
}