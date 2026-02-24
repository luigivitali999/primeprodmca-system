// Global dark theme constants for PRIME
export const T = {
  bg: '#080e1a',
  card: '#0f172a',
  cardHover: '#111827',
  border: 'rgba(99,102,241,0.15)',
  borderSubtle: 'rgba(99,102,241,0.08)',
  text: '#e2e8f0',
  textMuted: '#475569',
  textDim: '#334155',
  indigo: '#6366f1',
  blue: '#3b82f6',
  emerald: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
  indigoSoft: '#a5b4fc',
};

export const cardStyle = {
  background: '#0f172a',
  border: '1px solid rgba(99,102,241,0.15)',
  borderRadius: 12,
};

export const inputStyle = {
  background: '#0a1120',
  border: '1px solid rgba(99,102,241,0.2)',
  color: '#e2e8f0',
};

export const RISK_DARK = {
  critical: { bg: 'rgba(239,68,68,0.15)',  color: '#f87171', border: 'rgba(239,68,68,0.3)',  label: 'Critico' },
  high:     { bg: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: 'rgba(251,191,36,0.3)', label: 'Alto' },
  medium:   { bg: 'rgba(234,179,8,0.15)',  color: '#eab308', border: 'rgba(234,179,8,0.3)',  label: 'Medio' },
  low:      { bg: 'rgba(16,185,129,0.15)', color: '#34d399', border: 'rgba(16,185,129,0.3)', label: 'Basso' },
};

export const STATUS_DARK = {
  found:       { bg: 'rgba(239,68,68,0.15)',   color: '#f87171', label: 'Trovato' },
  notice_sent: { bg: 'rgba(251,191,36,0.15)',  color: '#fbbf24', label: 'Notice Inviata' },
  waiting:     { bg: 'rgba(59,130,246,0.15)',  color: '#60a5fa', label: 'In Attesa' },
  follow_up:   { bg: 'rgba(168,85,247,0.15)', color: '#c084fc', label: 'Follow-up' },
  escalated:   { bg: 'rgba(236,72,153,0.15)', color: '#f472b6', label: 'Escalation' },
  removed:     { bg: 'rgba(16,185,129,0.15)', color: '#34d399', label: 'Rimosso' },
  rejected:    { bg: 'rgba(100,116,139,0.15)',color: '#94a3b8', label: 'Rifiutato' },
};

// VMC by tier (USD)
export const VMC_TIER = {
  low: 12,
  medium: 25,
  high: 60,
  vip: 130,
};

export const CURRENCY = '$';

// Risk Score 2.0 calculation
export function calcRiskScore(creator, leaks = [], domains = []) {
  if (!leaks.length && !creator.active_leaks) return 0;

  const activeLeaks = leaks.filter(l => l.status !== 'removed' && l.status !== 'rejected');

  // 35% economic loss
  const estimatedLoss = creator.estimated_loss || calcEstimatedLoss(leaks, creator, domains);
  const lossScore = Math.min(estimatedLoss / 10000, 1) * 35;

  // 20% diffusion speed (avg views)
  const avgViews = leaks.reduce((a, l) => a + (l.estimated_views || 0), 0) / Math.max(leaks.length, 1);
  const diffScore = Math.min(avgViews / 50000, 1) * 20;

  // 15% avg time online
  const avgDaysOnline = activeLeaks.reduce((a, l) => a + (l.days_online || 0), 0) / Math.max(activeLeaks.length, 1);
  const timeScore = Math.min(avgDaysOnline / 90, 1) * 15;

  // 15% historical removal rate (inverse)
  const removalScore = (1 - (creator.removal_rate || 0) / 100) * 15;

  // 15% active leaks count
  const activeScore = Math.min((creator.active_leaks || activeLeaks.length) / 20, 1) * 15;

  const total = lossScore + diffScore + timeScore + removalScore + activeScore;
  return Math.round(Math.min(total, 100));
}

export function riskLevel(score) {
  if (score >= 81) return 'critical';
  if (score >= 61) return 'high';
  if (score >= 31) return 'medium';
  return 'low';
}

// Economic Impact Engine - Perdita Stimata Totale
export function calcEstimatedLoss(leaks = [], creator = {}, domains = []) {
  const vmc = creator.content_value || VMC_TIER[creator.creator_tier] || VMC_TIER.medium;
  
  // A) Perdita Diretta: Numero contenuti × VMC × Fattore dominio × Tempo online
  const directLoss = leaks.reduce((total, leak) => {
    const domain = domains.find(d => d.domain_name === leak.domain);
    const fdd = domain?.diffusion_factor || 1.0;
    const daysOnline = leak.days_online || 1;
    const iit = 1 + (daysOnline / 30) * 0.15;
    return total + (vmc * fdd * iit);
  }, 0);
  
  // B) Perdita Opportunità: ltv_mean_fan × conversion_loss_factor (se valorizzato)
  let opportunityLoss = 0;
  if (creator.ltv_mean_fan && creator.ltv_mean_fan > 0) {
    const avgConversionFactor = leaks.length > 0
      ? leaks.reduce((sum, leak) => {
          const domain = domains.find(d => d.domain_name === leak.domain);
          return sum + (domain?.conversion_loss_factor || 1.0);
        }, 0) / leaks.length
      : 1.0;
    opportunityLoss = creator.ltv_mean_fan * avgConversionFactor;
  }
  
  return directLoss + opportunityLoss;
}