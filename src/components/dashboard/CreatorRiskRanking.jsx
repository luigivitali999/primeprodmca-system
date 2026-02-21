import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const RISK_COLORS = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-amber-100 text-amber-700 border-amber-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const RISK_LABELS = {
  critical: 'Critico',
  high: 'Alto',
  medium: 'Medio',
  low: 'Basso',
};

export default function CreatorRiskRanking({ creators }) {
  const sortedCreators = [...creators]
    .sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0))
    .slice(0, 6);

  return (
    <Card className="bg-white border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-slate-900">Creator per Rischio</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-slate-100">
          {sortedCreators.map((creator) => (
            <Link 
              key={creator.id} 
              to={createPageUrl(`CreatorDetail?id=${creator.id}`)}
              className="flex items-center gap-4 px-6 py-3 hover:bg-slate-50 transition-colors"
            >
              <Avatar className="h-9 w-9 bg-gradient-to-br from-slate-200 to-slate-300">
                <AvatarFallback className="text-slate-600 text-sm font-medium">
                  {creator.stage_name?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{creator.stage_name}</p>
                <p className="text-xs text-slate-500">{creator.active_leaks || 0} leak attivi</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-900">{Math.round(creator.risk_score || 0)}</p>
                  <p className="text-xs text-slate-500">score</p>
                </div>
                <Badge variant="outline" className={`text-xs ${RISK_COLORS[creator.risk_level] || RISK_COLORS.low}`}>
                  {RISK_LABELS[creator.risk_level] || 'N/D'}
                </Badge>
              </div>
            </Link>
          ))}
          {sortedCreators.length === 0 && (
            <div className="px-6 py-8 text-center text-sm text-slate-500">
              Nessun creator registrato
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}