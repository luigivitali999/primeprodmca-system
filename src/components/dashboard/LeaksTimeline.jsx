import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format, subDays, parseISO, startOfDay } from 'date-fns';
import { it } from 'date-fns/locale';

export default function LeaksTimeline({ leaks }) {
  // Generate last 30 days data
  const last30Days = Array.from({ length: 30 }, (_, i) => {
    const date = startOfDay(subDays(new Date(), 29 - i));
    return {
      date: format(date, 'yyyy-MM-dd'),
      label: format(date, 'dd MMM', { locale: it }),
      found: 0,
      removed: 0,
    };
  });

  // Count leaks by date
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
    <Card className="bg-white border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-slate-900">Trend Ultimi 30 Giorni</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={last30Days}>
              <defs>
                <linearGradient id="colorFound" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorRemoved" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis 
                dataKey="label" 
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
                interval="preserveStartEnd"
              />
              <YAxis 
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1e293b', 
                  border: 'none', 
                  borderRadius: '8px',
                  color: 'white'
                }}
              />
              <Legend 
                verticalAlign="top" 
                height={36}
                formatter={(value) => <span className="text-sm text-slate-600">{value === 'found' ? 'Trovati' : 'Rimossi'}</span>}
              />
              <Area 
                type="monotone" 
                dataKey="found" 
                stroke="#ef4444" 
                fillOpacity={1} 
                fill="url(#colorFound)"
                strokeWidth={2}
                name="found"
              />
              <Area 
                type="monotone" 
                dataKey="removed" 
                stroke="#10b981" 
                fillOpacity={1} 
                fill="url(#colorRemoved)"
                strokeWidth={2}
                name="removed"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}