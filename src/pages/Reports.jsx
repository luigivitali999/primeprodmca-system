import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { it } from 'date-fns/locale';
import { 
  Download,
  FileText,
  Calendar,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  Users,
  BarChart3,
  PieChart
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import StatsCard from '@/components/dashboard/StatsCard';
import { T, cardStyle } from '@/components/utils/theme';

const SEVERITY_COLORS = {
  critical: '#ef4444',
  high: '#f59e0b',
  medium: '#eab308',
  low: '#64748b',
};

export default function Reports() {
  const [selectedCreator, setSelectedCreator] = useState('all');
  const [period, setPeriod] = useState('30');

  const { data: leaks = [], isLoading: leaksLoading } = useQuery({
    queryKey: ['leaks'],
    queryFn: () => base44.entities.Leak.list('-created_date', 1000),
  });

  const { data: creators = [], isLoading: creatorsLoading } = useQuery({
    queryKey: ['creators'],
    queryFn: () => base44.entities.Creator.list('-created_date', 200),
  });

  const { data: domains = [] } = useQuery({
    queryKey: ['domains'],
    queryFn: () => base44.entities.DomainIntelligence.list('-total_leaks', 100),
  });

  const { data: dmcaRequests = [] } = useQuery({
    queryKey: ['dmca-requests'],
    queryFn: () => base44.entities.DMCARequest.list('-created_date', 500),
  });

  const isLoading = leaksLoading || creatorsLoading;

  // Filter data by period
  const periodDays = parseInt(period);
  const startDate = subDays(new Date(), periodDays);
  
  const filteredLeaks = leaks.filter(leak => {
    const matchesPeriod = !leak.discovery_date || new Date(leak.discovery_date) >= startDate;
    const matchesCreator = selectedCreator === 'all' || leak.creator_id === selectedCreator;
    return matchesPeriod && matchesCreator;
  });

  const filteredDMCA = dmcaRequests.filter(req => {
    const matchesPeriod = !req.sent_date || new Date(req.sent_date) >= startDate;
    const matchesCreator = selectedCreator === 'all' || req.creator_id === selectedCreator;
    return matchesPeriod && matchesCreator;
  });

  // Calculate stats
  const activeLeaks = filteredLeaks.filter(l => l.status !== 'removed' && l.status !== 'rejected');
  const removedLeaks = filteredLeaks.filter(l => l.status === 'removed');
  const removalRate = filteredLeaks.length > 0 
    ? Math.round((removedLeaks.length / filteredLeaks.length) * 100) 
    : 0;
  const avgRemovalTime = removedLeaks.length > 0
    ? Math.round(removedLeaks.reduce((acc, l) => acc + (l.days_online || 0), 0) / removedLeaks.length)
    : 0;
  const criticalLeaks = filteredLeaks.filter(l => l.severity === 'critical');
  const totalDamageScore = filteredLeaks.reduce((acc, l) => acc + (l.damage_score || 0), 0);
  const mitigatedDamage = removedLeaks.reduce((acc, l) => acc + (l.damage_score || 0), 0);

  // Severity distribution
  const severityData = [
    { name: 'Critica', value: filteredLeaks.filter(l => l.severity === 'critical').length, color: SEVERITY_COLORS.critical },
    { name: 'Alta', value: filteredLeaks.filter(l => l.severity === 'high').length, color: SEVERITY_COLORS.high },
    { name: 'Media', value: filteredLeaks.filter(l => l.severity === 'medium').length, color: SEVERITY_COLORS.medium },
    { name: 'Bassa', value: filteredLeaks.filter(l => l.severity === 'low').length, color: SEVERITY_COLORS.low },
  ].filter(d => d.value > 0);

  // Top domains
  const domainCounts = {};
  filteredLeaks.forEach(leak => {
    if (leak.domain) {
      domainCounts[leak.domain] = (domainCounts[leak.domain] || 0) + 1;
    }
  });
  const topDomains = Object.entries(domainCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([domain, count]) => ({ domain, count }));

  // Content type distribution
  const contentTypeData = {};
  filteredLeaks.forEach(leak => {
    const type = leak.content_type || 'other';
    contentTypeData[type] = (contentTypeData[type] || 0) + 1;
  });
  const contentTypeChartData = Object.entries(contentTypeData)
    .map(([type, count]) => ({ name: type, value: count }));

  // Creator report data
  const creatorReportData = creators.map(creator => {
    const creatorLeaks = filteredLeaks.filter(l => l.creator_id === creator.id);
    const creatorRemoved = creatorLeaks.filter(l => l.status === 'removed');
    return {
      id: creator.id,
      name: creator.stage_name,
      totalLeaks: creatorLeaks.length,
      activeLeaks: creatorLeaks.filter(l => l.status !== 'removed' && l.status !== 'rejected').length,
      removedLeaks: creatorRemoved.length,
      removalRate: creatorLeaks.length > 0 
        ? Math.round((creatorRemoved.length / creatorLeaks.length) * 100) 
        : 0,
      damageScore: creatorLeaks.reduce((acc, l) => acc + (l.damage_score || 0), 0),
      mitigatedDamage: creatorRemoved.reduce((acc, l) => acc + (l.damage_score || 0), 0),
    };
  }).filter(c => c.totalLeaks > 0).sort((a, b) => b.totalLeaks - a.totalLeaks);

  const generateReport = () => {
    const reportData = {
      generatedAt: format(new Date(), 'yyyy-MM-dd HH:mm'),
      period: `Ultimi ${period} giorni`,
      creator: selectedCreator === 'all' ? 'Tutti' : creators.find(c => c.id === selectedCreator)?.stage_name,
      summary: {
        totalLeaks: filteredLeaks.length,
        activeLeaks: activeLeaks.length,
        removedLeaks: removedLeaks.length,
        removalRate: `${removalRate}%`,
        avgRemovalTime: `${avgRemovalTime} giorni`,
        totalDamageScore,
        mitigatedDamage,
      },
      topDomains,
      severityDistribution: severityData,
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prime-report-${format(new Date(), 'yyyy-MM-dd')}.json`;
    a.click();
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Report & Analytics</h1>
          <p className="text-slate-500 mt-1">Analisi performance DMCA</p>
        </div>
        <div className="flex gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Ultimi 7 giorni</SelectItem>
              <SelectItem value="30">Ultimi 30 giorni</SelectItem>
              <SelectItem value="90">Ultimi 90 giorni</SelectItem>
              <SelectItem value="365">Ultimo anno</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedCreator} onValueChange={setSelectedCreator}>
            <SelectTrigger className="w-48">
              <Users className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti i creator</SelectItem>
              {creators.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.stage_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={generateReport} className="bg-blue-600 hover:bg-blue-700">
            <Download className="w-4 h-4 mr-2" />
            Esporta Report
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Leak Trovati"
          value={filteredLeaks.length}
          subtitle={`${activeLeaks.length} attivi`}
          icon={AlertTriangle}
          color="red"
        />
        <StatsCard
          title="Leak Rimossi"
          value={removedLeaks.length}
          subtitle={`${removalRate}% tasso`}
          icon={CheckCircle}
          color="emerald"
        />
        <StatsCard
          title="Tempo Medio Rimozione"
          value={`${avgRemovalTime}g`}
          icon={Clock}
          color="blue"
        />
        <StatsCard
          title="Danno Mitigato"
          value={Math.round(mitigatedDamage)}
          subtitle={`su ${Math.round(totalDamageScore)} totale`}
          icon={TrendingUp}
          color="indigo"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Domains */}
        <Card className="bg-white border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Top 10 Domini per Leak
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topDomains} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis 
                    dataKey="domain" 
                    type="category" 
                    width={120}
                    tick={{ fontSize: 10, fill: '#64748b' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1e293b', 
                      border: 'none', 
                      borderRadius: '8px',
                      color: 'white'
                    }}
                  />
                  <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Severity Distribution */}
        <Card className="bg-white border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <PieChart className="w-4 h-4" />
              Distribuzione per Severità
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <RePieChart>
                  <Pie
                    data={severityData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {severityData.map((entry, index) => (
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
                  <Legend />
                </RePieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Creator Performance Table */}
      <Card className="bg-white border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Performance per Creator</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Creator</TableHead>
                  <TableHead className="text-center">Leak Totali</TableHead>
                  <TableHead className="text-center">Attivi</TableHead>
                  <TableHead className="text-center">Rimossi</TableHead>
                  <TableHead>Tasso Rimozione</TableHead>
                  <TableHead className="text-center">Danno Score</TableHead>
                  <TableHead className="text-center">Mitigato</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {creatorReportData.slice(0, 15).map((creator) => (
                  <TableRow key={creator.id}>
                    <TableCell className="font-medium text-slate-900">{creator.name}</TableCell>
                    <TableCell className="text-center">{creator.totalLeaks}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                        {creator.activeLeaks}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                        {creator.removedLeaks}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="w-24">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold">{creator.removalRate}%</span>
                        </div>
                        <Progress value={creator.removalRate} className="h-1.5" />
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-semibold">{Math.round(creator.damageScore)}</TableCell>
                    <TableCell className="text-center text-emerald-600 font-semibold">
                      {Math.round(creator.mitigatedDamage)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {creatorReportData.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              Nessun dato disponibile per il periodo selezionato
            </div>
          )}
        </CardContent>
      </Card>

      {/* DMCA Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Statistiche DMCA</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <span className="text-sm text-slate-600">DMCA Inviate</span>
              <span className="text-lg font-bold text-slate-900">{filteredDMCA.length}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <span className="text-sm text-slate-600">Rimozioni Confermate</span>
              <span className="text-lg font-bold text-emerald-600">
                {filteredDMCA.filter(d => d.removal_confirmed).length}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <span className="text-sm text-slate-600">In Attesa</span>
              <span className="text-lg font-bold text-amber-600">
                {filteredDMCA.filter(d => !d.removal_confirmed && d.status !== 'rejected').length}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <span className="text-sm text-slate-600">Escalation</span>
              <span className="text-lg font-bold text-pink-600">
                {filteredDMCA.filter(d => d.status === 'escalated').length}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Distribuzione Contenuti</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {contentTypeChartData.map((item) => (
                <div key={item.name} className="flex items-center gap-3">
                  <span className="text-sm text-slate-600 w-24 capitalize">{item.name}</span>
                  <div className="flex-1">
                    <Progress 
                      value={filteredLeaks.length > 0 ? (item.value / filteredLeaks.length) * 100 : 0} 
                      className="h-2"
                    />
                  </div>
                  <span className="text-sm font-medium text-slate-900 w-12 text-right">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}