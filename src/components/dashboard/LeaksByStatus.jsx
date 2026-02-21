import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const STATUS_COLORS = {
  found: '#ef4444',
  notice_sent: '#f59e0b',
  waiting: '#6366f1',
  follow_up: '#8b5cf6',
  escalated: '#ec4899',
  removed: '#10b981',
  rejected: '#64748b',
};

const STATUS_LABELS = {
  found: 'Trovati',
  notice_sent: 'Notice Inviata',
  waiting: 'In Attesa',
  follow_up: 'Follow-up',
  escalated: 'Escalation',
  removed: 'Rimossi',
  rejected: 'Rifiutati',
};

export default function LeaksByStatus({ leaks }) {
  const statusCounts = leaks.reduce((acc, leak) => {
    acc[leak.status] = (acc[leak.status] || 0) + 1;
    return acc;
  }, {});

  const data = Object.entries(statusCounts).map(([status, count]) => ({
    name: STATUS_LABELS[status] || status,
    value: count,
    color: STATUS_COLORS[status] || '#94a3b8',
  }));

  return (
    <Card className="bg-white border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-slate-900">Leak per Stato</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1e293b', 
                  border: 'none', 
                  borderRadius: '8px',
                  color: 'white'
                }}
              />
              <Legend 
                verticalAlign="bottom" 
                height={36}
                formatter={(value) => <span className="text-sm text-slate-600">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}