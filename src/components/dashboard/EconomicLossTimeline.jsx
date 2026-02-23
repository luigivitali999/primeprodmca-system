import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card } from "@/components/ui/card";
import { T } from '@/components/utils/theme';

export default function EconomicLossTimeline({ leaks, creators, domains }) {
  const chartData = useMemo(() => {
    if (!leaks.length) return [];

    // Group leaks by discovery_date
    const byDate = {};
    leaks.forEach(leak => {
      if (!leak.discovery_date) return;
      
      const date = leak.discovery_date;
      if (!byDate[date]) byDate[date] = [];
      byDate[date].push(leak);
    });

    // Calculate cumulative loss per day
    const sorted = Object.keys(byDate).sort();
    let cumulativeLoss = 0;

    return sorted.map(date => {
      const dayLeaks = byDate[date];
      const dayLoss = dayLeaks.reduce((total, leak) => {
        const creator = creators.find(c => c.id === leak.creator_id);
        const domain = domains.find(d => d.domain_name === leak.domain);
        if (!creator) return total;

        const vmc = creator.content_value || 25;
        const fdd = domain?.diffusion_factor || 1.0;
        const daysOnline = leak.days_online || 1;
        const iit = 1 + (daysOnline / 30) * 0.15;
        
        return total + (vmc * fdd * iit);
      }, 0);

      cumulativeLoss += dayLoss;

      return {
        date: date,
        loss: Math.round(cumulativeLoss),
        dayLoss: Math.round(dayLoss),
      };
    });
  }, [leaks, creators, domains]);

  return (
    <Card style={T.cardStyle}>
      <div className="p-6">
        <h3 style={{ color: T.text, fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
          Perdita Economica Cumulativa
        </h3>
        
        {chartData.length === 0 ? (
          <div style={{ color: T.textMuted, textAlign: 'center', padding: '40px 0' }}>
            Nessun dato disponibile
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.1)" />
              <XAxis 
                dataKey="date" 
                stroke={T.textMuted}
                tick={{ fontSize: 12 }}
                style={{ color: T.textMuted }}
              />
              <YAxis 
                stroke={T.textMuted}
                tick={{ fontSize: 12 }}
                formatter={(value) => `€${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  background: T.card,
                  border: `1px solid ${T.border}`,
                  borderRadius: 8,
                  color: T.text,
                }}
                formatter={(value) => `€${value.toLocaleString('it-IT')}`}
              />
              <Line
                type="monotone"
                dataKey="loss"
                stroke={T.red}
                strokeWidth={2}
                dot={{ fill: T.red, r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}

        {chartData.length > 0 && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: T.textMuted, fontSize: 12 }}>
              <span>Perdita Totale: <span style={{ color: T.red, fontWeight: 600 }}>€{chartData[chartData.length - 1]?.loss.toLocaleString('it-IT')}</span></span>
              <span>Ultimi 30gg: <span style={{ color: T.red, fontWeight: 600 }}>€{chartData.slice(-30).reduce((sum, d) => sum + d.dayLoss, 0).toLocaleString('it-IT')}</span></span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}