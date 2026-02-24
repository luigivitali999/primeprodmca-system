import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';
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
      minWidth: 140,
    }}>
      <p style={{ color: '#94a3b8', fontSize: 11, marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        {label}
      </p>
      {payload.map((entry) => (
        <div key={entry.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: entry.dataKey === 'found' ? '#818cf8' : '#34d399',
            boxShadow: entry.dataKey === 'found' ? '0 0 6px #818cf8' : '0 0 6px #34d399',
            flexShrink: 0,
          }} />
          <span style={{ color: '#cbd5e1', fontSize: 12 }}>
            {entry.dataKey === 'found' ? 'Trovati' : 'Rimossi'}
          </span>
          <span style={{
            marginLeft: 'auto',
            fontWeight: 700,
            fontSize: 14,
            color: entry.dataKey === 'found' ? '#a5b4fc' : '#6ee7b7',
          }}>
            {entry.value}
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

export default function LeaksTimeline({ leaks }) {
  const last30Days = Array.from({ length: 30 }, (_, i) => {
    const date = startOfDay(subDays(new Date(), 29 - i));
    return {
      date: format(date, 'yyyy-MM-dd'),
      label: format(date, 'dd MMM', { locale: it }),
      found: 0,
      removed: 0,
    };
  });

  leaks.forEach(leak => {
    if (leak.discovery_date) {
      const found = last30Days.find(d => d.date === leak.discovery_date);
      if (found) found.found++;
    }
    if (leak.removal_date) {
      const removed = last30Days.find(d => d.date === leak.removal_date);
      if (removed) removed.removed++;
    }
  });

  return (
    <Card style={{ background: '#0f172a', border: '1px solid rgba(99,102,241,0.15)' }} className="shadow-lg">
      <CardHeader className="pb-1 pt-5 px-6">
        <div className="flex items-center justify-between">
          <CardTitle style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 600, letterSpacing: '0.03em' }}>
            TREND ULTIMI 30 GIORNI
          </CardTitle>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#818cf8', boxShadow: '0 0 6px #818cf8', display: 'inline-block' }} />
              <span style={{ color: '#94a3b8', fontSize: 11 }}>Trovati</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 6px #34d399', display: 'inline-block' }} />
              <span style={{ color: '#94a3b8', fontSize: 11 }}>Rimossi</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-2 pb-4 pt-2">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={last30Days} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="gradFound" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#818cf8" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradRemoved" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
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
                width={24}
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
                type="basis"
                dataKey="found"
                stroke="#818cf8"
                strokeWidth={2.5}
                fill="url(#gradFound)"
                dot={false}
                activeDot={<CustomDot stroke="#818cf8" />}
                name="found"
              />
              <Area
                type="basis"
                dataKey="removed"
                stroke="#34d399"
                strokeWidth={2.5}
                fill="url(#gradRemoved)"
                dot={false}
                activeDot={<CustomDot stroke="#34d399" />}
                name="removed"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}