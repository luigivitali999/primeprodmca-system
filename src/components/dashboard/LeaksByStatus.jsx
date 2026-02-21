import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const STATUS_COLORS = {
  found:       '#f87171',
  notice_sent: '#fbbf24',
  waiting:     '#818cf8',
  follow_up:   '#c084fc',
  escalated:   '#f472b6',
  removed:     '#34d399',
  rejected:    '#475569',
};

const STATUS_LABELS = {
  found:       'Trovati',
  notice_sent: 'Notice Inviata',
  waiting:     'In Attesa',
  follow_up:   'Follow-up',
  escalated:   'Escalation',
  removed:     'Rimossi',
  rejected:    'Rifiutati',
};

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div style={{
      background: '#0f172a', border: '1px solid rgba(99,102,241,0.3)',
      borderRadius: 10, padding: '8px 14px',
      boxShadow: '0 0 20px rgba(99,102,241,0.15)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: d.payload.color, boxShadow: `0 0 6px ${d.payload.color}`, display: 'inline-block' }} />
        <span style={{ color: '#94a3b8', fontSize: 12 }}>{d.name}</span>
        <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 14, marginLeft: 4 }}>{d.value}</span>
      </div>
    </div>
  );
};

export default function LeaksByStatus({ leaks }) {
  const statusCounts = leaks.reduce((acc, leak) => {
    acc[leak.status] = (acc[leak.status] || 0) + 1;
    return acc;
  }, {});

  const data = Object.entries(statusCounts).map(([status, count]) => ({
    name: STATUS_LABELS[status] || status,
    value: count,
    color: STATUS_COLORS[status] || '#64748b',
  }));

  return (
    <div style={{ background: '#0f172a', border: '1px solid rgba(99,102,241,0.12)', borderRadius: 12 }} className="overflow-hidden">
      <div className="px-6 pt-5 pb-2">
        <p style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 600, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
          LEAK PER STATO
        </p>
      </div>
      <div style={{ height: 260 }} className="px-2 pb-4">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="45%"
              innerRadius={55}
              outerRadius={78}
              paddingAngle={3}
              dataKey="value"
              strokeWidth={0}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} style={{ filter: `drop-shadow(0 0 4px ${entry.color}60)` }} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        {/* Legend */}
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 px-4 -mt-2">
          {data.map((entry) => (
            <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: entry.color, boxShadow: `0 0 5px ${entry.color}`, display: 'inline-block', flexShrink: 0 }} />
              <span style={{ color: '#64748b', fontSize: 11 }}>{entry.name}</span>
              <span style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700 }}>{entry.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}