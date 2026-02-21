import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle } from 'lucide-react';

export default function TopDomainsTable({ domains }) {
  const sortedDomains = [...domains]
    .sort((a, b) => (b.total_leaks || 0) - (a.total_leaks || 0))
    .slice(0, 8);

  return (
    <Card className="bg-white border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-slate-900">Top Domini per Leak</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-slate-100">
          {sortedDomains.map((domain, idx) => (
            <div key={domain.id} className="flex items-center gap-4 px-6 py-3 hover:bg-slate-50 transition-colors">
              <span className="text-sm font-medium text-slate-400 w-5">{idx + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-slate-900 truncate">{domain.domain_name}</p>
                  {domain.high_risk_flag && (
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-slate-500">{domain.total_leaks || 0} leak</span>
                  <span className="text-xs text-slate-400">•</span>
                  <span className="text-xs text-emerald-600">{domain.total_removed || 0} rimossi</span>
                </div>
              </div>
              <div className="w-24">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-500">Rimozione</span>
                  <span className="text-xs font-medium text-slate-700">{Math.round(domain.removal_rate || 0)}%</span>
                </div>
                <Progress value={domain.removal_rate || 0} className="h-1.5" />
              </div>
            </div>
          ))}
          {sortedDomains.length === 0 && (
            <div className="px-6 py-8 text-center text-sm text-slate-500">
              Nessun dominio registrato
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}