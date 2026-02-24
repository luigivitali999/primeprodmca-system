import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format, subDays, startOfDay } from 'date-fns';
import { it } from 'date-fns/locale';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{
      background: '#0f172a',
      border: '1px solid rgba(99,102,241,0.3)',
      borderRadius: '10px',
      padding: '10px 16px',
      boxShadow: '0 0 24px rgba(99,102,241,0.15)',
      minWidth: 160,
    }}>
      <p style={{ color: '#94a3b8', fontSize: 11, marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        {label}
      </p>
      {payload.map((entry) => (
        <div key={entry.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: '#ef4444',
            boxShadow: '0 0 6px #ef4444',
            flexShrink: 0,
          }} />
          <span style={{ color: '#cbd5e1', fontSize: 12 }}>
            Perdita Cumulativa
          </span>
          <span style={{
            marginLeft: 'auto',
            fontWeight: 700,
            fontSize: 14,
            color: '#f87171',
          }}>
            ${(entry.value / 1000).toFixed(1)}k
          </span>
        </div>
      ))}
    </div>
  );
};

const CustomDot = (props) => {
  const { cx, cy, stroke } = props;
  return (
    <circle cx={cx} cy={cy} r={3} fill={stroke} stroke="#0f172a" strokeWidth={2}
      style={{ filter: `drop-shadow(0 0 4px ${stroke})` }} />
  );
};

export default function EconomicLossTimeline({ leaks, creators, domains }) {
  const last30Days = useMemo(() => {
    const data = Array.from({ length: 30 }, (_, i) => {
      const date = startOfDay(subDays(new Date(), 29 - i));
      return {
        date: format(date, 'yyyy-MM-dd'),
        label: format(date, 'dd MMM', { locale: it }),
        loss: 0,
      };
    });

    let cumulativeLoss = 0;
    leaks.forEach(leak => {
      if (leak.discovery_date) {
        const dayIndex = data.findIndex(d => d.date === leak.discovery_date);
        if (dayIndex !== -1) {
          const creator = creators.find(c => c.id === leak.creator_id);
          const domain = domains.find(d => d.domain_name === leak.domain);
          if (creator) {
            const vmc = creator.content_value || 25;
            const fdd = domain?.diffusion_factor || 1.0;
            const daysOnline = leak.days_online || 1;
            const iit = 1 + (daysOnline / 30) * 0.15;
            const dayLoss = vmc * fdd * iit;
            
            for (let j = dayIndex; j < data.length; j++) {
              data[j].loss += dayLoss;
            }
          }
        }
      }
    });

    return data.map(d => ({ ...d, loss: Math.round(d.loss) }));
  }, [leaks, creators, domains]);

  const totalLoss = last30Days.length > 0 ? last30Days[last30Days.length - 1].loss : 0;
  const last30Loss = last30Days.reduce((sum, d) => sum + d.loss, 0) / 30;

  return (
    <Card style={{ background: '#0f172a', border: '1px solid rgba(99,102,241,0.15)' }} className="shadow-lg">
      <CardHeader className="pb-1 pt-5 px-6">
        <div className="flex items-center justify-between">
          <CardTitle style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 600, letterSpacing: '0.03em' }}>
            PERDITA ECONOMICA ULTIMI 30 GIORNI
          </CardTitle>
          <div style={{ color: '#94a3b8', fontSize: 12 }}>
            ${(totalLoss / 1000).toFixed(1)}k cumulativa
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-2 pb-4 pt-2">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={last30Days} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="gradLoss" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 6" stroke="rgba(99,102,241,0.1)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: '#475569', fontFamily: 'monospace' }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#475569', fontFamily: 'monospace' }}
                tickLine={false}
                axisLine={false}
                width={40}
                formatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{
                  stroke: 'rgba(148,163,184,0.2)',
                  strokeWidth: 1,
                  strokeDasharray: '4 4',
                }}
              />
              <Area
                type="monotone"
                dataKey="loss"
                stroke="#ef4444"
                strokeWidth={2}
                fill="url(#gradLoss)"
                dot={false}
                activeDot={<CustomDot stroke="#ef4444" />}
                name="loss"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}