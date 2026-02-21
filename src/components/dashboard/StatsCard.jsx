import React from 'react';
import { cn } from "@/lib/utils";

const ICON_STYLES = {
  blue:    { bg: 'rgba(59,130,246,0.15)',  color: '#60a5fa', glow: '0 0 12px rgba(59,130,246,0.3)'  },
  emerald: { bg: 'rgba(52,211,153,0.12)',  color: '#34d399', glow: '0 0 12px rgba(52,211,153,0.25)' },
  amber:   { bg: 'rgba(251,191,36,0.12)',  color: '#fbbf24', glow: '0 0 12px rgba(251,191,36,0.25)' },
  red:     { bg: 'rgba(248,113,113,0.12)', color: '#f87171', glow: '0 0 12px rgba(248,113,113,0.25)'},
  indigo:  { bg: 'rgba(165,180,252,0.12)', color: '#a5b4fc', glow: '0 0 12px rgba(165,180,252,0.25)'},
  slate:   { bg: 'rgba(148,163,184,0.1)',  color: '#94a3b8', glow: '0 0 10px rgba(148,163,184,0.2)' },
};

export default function StatsCard({ title, value, subtitle, icon: Icon, trend, trendUp, color = 'blue', className }) {
  const s = ICON_STYLES[color] || ICON_STYLES.blue;

  return (
    <div
      className={cn("rounded-xl p-5 relative overflow-hidden", className)}
      style={{
        background: '#0f172a',
        border: '1px solid rgba(99,102,241,0.12)',
      }}
    >
      {/* subtle bg glow */}
      <div style={{
        position: 'absolute', top: 0, right: 0, width: 120, height: 120,
        background: s.bg, borderRadius: '50%',
        transform: 'translate(40%, -40%)', filter: 'blur(30px)', pointerEvents: 'none',
      }} />
      <div className="relative flex items-start justify-between">
        <div className="space-y-1">
          <p style={{ color: '#475569', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {title}
          </p>
          <p style={{ color: '#e2e8f0', fontSize: 28, fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            {value}
          </p>
          {subtitle && (
            <p style={{ color: '#475569', fontSize: 12 }}>{subtitle}</p>
          )}
          {trend && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: trendUp ? '#34d399' : '#f87171' }}>
              <span>{trendUp ? '↑' : '↓'}</span>
              <span>{trend}</span>
            </div>
          )}
        </div>
        {Icon && (
          <div style={{
            width: 42, height: 42, borderRadius: 10,
            background: s.bg, border: `1px solid ${s.color}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: s.glow, flexShrink: 0,
          }}>
            <Icon style={{ width: 18, height: 18, color: s.color }} />
          </div>
        )}
      </div>
    </div>
  );
}