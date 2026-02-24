import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { 
  ArrowLeft,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  ExternalLink,
  Eye,
  Mail,
  Search,
  Loader2
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import StatsCard from '@/components/dashboard/StatsCard';

const RISK_COLORS = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-amber-100 text-amber-700 border-amber-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const STATUS_COLORS = {
  found: 'bg-red-100 text-red-700',
  notice_sent: 'bg-amber-100 text-amber-700',
  waiting: 'bg-blue-100 text-blue-700',
  follow_up: 'bg-purple-100 text-purple-700',
  escalated: 'bg-pink-100 text-pink-700',
  removed: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-slate-100 text-slate-700',
};

const STATUS_LABELS = {
  found: 'Trovato',
  notice_sent: 'Notice Inviata',
  waiting: 'In Attesa',
  follow_up: 'Follow-up',
  escalated: 'Escalation',
  removed: 'Rimosso',
  rejected: 'Rifiutato',
};

export default function CreatorDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const creatorId = urlParams.get('id');
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);

  const { data: creator, isLoading: creatorLoading } = useQuery({
    queryKey: ['creator', creatorId],
    queryFn: async () => {
      const creators = await base44.entities.Creator.filter({ id: creatorId });
      return creators[0];
    },
    enabled: !!creatorId,
  });

  const { data: leaks = [], isLoading: leaksLoading } = useQuery({
    queryKey: ['creator-leaks', creatorId],
    queryFn: () => base44.entities.Leak.filter({ creator_id: creatorId }, '-created_date', 500),
    enabled: !!creatorId,
  });

  const { data: dmcaRequests = [] } = useQuery({
    queryKey: ['creator-dmca', creatorId],
    queryFn: () => base44.entities.DMCARequest.filter({ creator_id: creatorId }, '-created_date', 500),
    enabled: !!creatorId,
  });

  const queryClient = useQueryClient();

  const isLoading = creatorLoading || leaksLoading;

  const handleScan = async () => {
    setScanning(true);
    setScanResult(null);
    const res = await base44.functions.invoke('onboardingCreatorScan', { creator_id: creatorId });
    setScanning(false);
    setScanResult(res.data);
    queryClient.invalidateQueries({ queryKey: ['creator-leaks', creatorId] });
    queryClient.invalidateQueries({ queryKey: ['creator', creatorId] });
    queryClient.invalidateQueries({ queryKey: ['pending_approvals'] });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  if (!creator) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-slate-900">Creator non trovato</h2>
        <Link to={createPageUrl('Creators')}>
          <Button variant="link" className="mt-4">Torna alla lista</Button>
        </Link>
      </div>
    );
  }

  const activeLeaks = leaks.filter(l => l.status !== 'removed' && l.status !== 'rejected');
  const removedLeaks = leaks.filter(l => l.status === 'removed');
  const removalRate = leaks.length > 0 ? Math.round((removedLeaks.length / leaks.length) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link to={createPageUrl('Creators')}>
        <Button variant="ghost" className="gap-2 -ml-2">
          <ArrowLeft className="w-4 h-4" />
          Torna ai Creators
        </Button>
      </Link>

      {/* Creator Header */}
      <Card className="bg-white border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <Avatar className="h-20 w-20 bg-gradient-to-br from-blue-500 to-indigo-600">
              <AvatarFallback className="text-white text-2xl font-bold">
                {creator.stage_name?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-slate-900">{creator.stage_name}</h1>
                <Badge variant="outline" className={RISK_COLORS[creator.risk_level] || RISK_COLORS.low}>
                  Rischio {creator.risk_level || 'N/D'}
                </Badge>
                <Badge variant="outline" className={creator.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}>
                  {creator.status === 'active' ? 'Attivo' : creator.status}
                </Badge>
              </div>
              <p className="text-slate-600">{creator.legal_name}</p>
              <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                <span className="flex items-center gap-1">
                  <Mail className="w-4 h-4" />
                  {creator.email}
                </span>
                {creator.contract_start && (
                  <span>
                    Cliente dal {format(new Date(creator.contract_start), 'MMM yyyy', { locale: it })}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-500">Revenue Mensile</p>
              <p className="text-2xl font-bold text-slate-900">€{(creator.monthly_revenue || 0).toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
           title="Risk Score"
          value={Math.round(creator.risk_score || 0)}
          icon={AlertTriangle}
          color={creator.risk_level === 'critical' ? 'red' : creator.risk_level === 'high' ? 'amber' : 'emerald'}
        />
        <StatsCard
          title="Leak Attivi"
          value={activeLeaks.length}
          subtitle={`${leaks.length} totali`}
          icon={Eye}
          color="red"
        />
        <StatsCard
          title="Tasso Rimozione"
          value={`${removalRate}%`}
          icon={CheckCircle}
          color="emerald"
        />
        <StatsCard
          title="Tempo Medio"
          value={`${Math.round(creator.avg_removal_time || 0)}g`}
          icon={Clock}
          color="blue"
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="leaks" className="space-y-6">
        <TabsList>
          <TabsTrigger value="leaks">Leak ({leaks.length})</TabsTrigger>
          <TabsTrigger value="dmca">DMCA ({dmcaRequests.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="leaks">
          <Card className="bg-white border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Leak Tracciati</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>URL / Dominio</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Severità</TableHead>
                      <TableHead>Stato</TableHead>
                      <TableHead>Scoperto</TableHead>
                      <TableHead>Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaks.slice(0, 50).map((leak) => (
                      <TableRow key={leak.id}>
                        <TableCell>
                          <div className="max-w-xs">
                            <p className="font-medium text-slate-900 truncate">{leak.domain}</p>
                            <a 
                              href={leak.leak_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline truncate block"
                            >
                              {leak.leak_url?.substring(0, 50)}...
                            </a>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm capitalize">{leak.content_type || 'N/D'}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs capitalize ${
                            leak.severity === 'critical' ? 'bg-red-100 text-red-700' :
                            leak.severity === 'high' ? 'bg-amber-100 text-amber-700' :
                            leak.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {leak.severity || 'N/D'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${STATUS_COLORS[leak.status] || 'bg-slate-100'}`}>
                            {STATUS_LABELS[leak.status] || leak.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">
                          {leak.discovery_date ? format(new Date(leak.discovery_date), 'dd/MM/yy') : 'N/D'}
                        </TableCell>
                        <TableCell>
                          <span className="font-semibold text-slate-900">{Math.round(leak.damage_score || 0)}</span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {leaks.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  Nessun leak trovato per questo creator
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dmca">
          <Card className="bg-white border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Richieste DMCA</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Notice #</TableHead>
                      <TableHead>Destinatario</TableHead>
                      <TableHead>Metodo</TableHead>
                      <TableHead>Data Invio</TableHead>
                      <TableHead>Stato</TableHead>
                      <TableHead>Escalation</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dmcaRequests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell className="font-mono text-sm">{request.notice_number || 'N/D'}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-slate-900">{request.sent_to_entity || 'N/D'}</p>
                            <p className="text-xs text-slate-500 capitalize">{request.sent_to_type}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm capitalize">{request.method || 'N/D'}</TableCell>
                        <TableCell className="text-sm">
                          {request.sent_date ? format(new Date(request.sent_date), 'dd/MM/yy') : 'N/D'}
                        </TableCell>
                        <TableCell>
                          <Badge className={request.removal_confirmed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}>
                            {request.removal_confirmed ? 'Confermato' : 'In corso'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-medium">Lv. {request.escalation_level || 0}</span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {dmcaRequests.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  Nessuna richiesta DMCA per questo creator
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}