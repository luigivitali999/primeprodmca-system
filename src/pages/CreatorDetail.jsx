import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { 
  ArrowLeft, AlertTriangle, CheckCircle, Clock,
  Eye, Mail, Search, Loader2, ExternalLink
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import StatsCard from '@/components/dashboard/StatsCard';

const RISK_DARK = {
  critical: { bg: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)', label: 'Critical' },
  high:     { bg: 'rgba(245,158,11,0.15)', color: '#fcd34d', border: '1px solid rgba(245,158,11,0.3)', label: 'High' },
  medium:   { bg: 'rgba(234,179,8,0.15)',  color: '#fde047', border: '1px solid rgba(234,179,8,0.3)',  label: 'Medium' },
  low:      { bg: 'rgba(16,185,129,0.15)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.3)', label: 'Low' },
};

const STATUS_DARK = {
  found:       { bg: 'rgba(239,68,68,0.15)',   color: '#f87171',  label: 'Trovato' },
  notice_sent: { bg: 'rgba(245,158,11,0.15)',  color: '#fcd34d',  label: 'Notice Inviata' },
  waiting:     { bg: 'rgba(59,130,246,0.15)',  color: '#93c5fd',  label: 'In Attesa' },
  follow_up:   { bg: 'rgba(139,92,246,0.15)', color: '#c4b5fd',  label: 'Follow-up' },
  escalated:   { bg: 'rgba(236,72,153,0.15)', color: '#f9a8d4',  label: 'Escalation' },
  removed:     { bg: 'rgba(16,185,129,0.15)', color: '#6ee7b7',  label: 'Rimosso' },
  rejected:    { bg: 'rgba(100,116,139,0.15)', color: '#94a3b8', label: 'Rifiutato' },
};

const SEVERITY_DARK = {
  critical: { bg: 'rgba(239,68,68,0.15)',   color: '#f87171' },
  high:     { bg: 'rgba(245,158,11,0.15)',  color: '#fcd34d' },
  medium:   { bg: 'rgba(234,179,8,0.15)',   color: '#fde047' },
  low:      { bg: 'rgba(16,185,129,0.15)',  color: '#6ee7b7' },
};

const card = { background: '#0d1829', border: '1px solid rgba(99,102,241,0.12)', borderRadius: '12px' };
const tableRow = { borderBottom: '1px solid rgba(99,102,241,0.08)' };

export default function CreatorDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const creatorId = urlParams.get('id');
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const queryClient = useQueryClient();

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

  const isLoading = creatorLoading || leaksLoading;

  const handleScan = async () => {
    setScanning(true);
    setScanResult(null);
    const res = await base44.functions.invoke('onboardingCreatorScan', { creator_id: creatorId });
    setScanning(false);
    setScanResult(res.data);
    queryClient.invalidateQueries({ queryKey: ['creator-leaks', creatorId] });
    queryClient.invalidateQueries({ queryKey: ['creator', creatorId] });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" style={{ background: 'rgba(99,102,241,0.1)' }} />
        <Skeleton className="h-48 rounded-xl" style={{ background: 'rgba(99,102,241,0.1)' }} />
      </div>
    );
  }

  if (!creator) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-slate-300">Creator non trovato</h2>
        <Link to={createPageUrl('Creators')}>
          <Button variant="link" className="mt-4 text-indigo-400">Torna alla lista</Button>
        </Link>
      </div>
    );
  }

  const activeLeaks = leaks.filter(l => l.status !== 'removed' && l.status !== 'rejected');
  const removedLeaks = leaks.filter(l => l.status === 'removed');
  const removalRate = leaks.length > 0 ? Math.round((removedLeaks.length / leaks.length) * 100) : 0;
  const risk = RISK_DARK[creator.risk_level] || RISK_DARK.low;
  const initials = creator.stage_name?.charAt(0).toUpperCase() || '?';

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Link to={createPageUrl('Creators')}>
          <Button variant="ghost" className="gap-2 -ml-2" style={{ color: '#94a3b8' }}>
            <ArrowLeft className="w-4 h-4" />
            Torna ai Creators
          </Button>
        </Link>
        <div className="flex items-center gap-3 flex-wrap">
          {scanResult && (
            <div className="text-sm px-4 py-2 rounded-lg" style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', color: '#a5b4fc' }}>
              ✓ {scanResult.newLeaks || 0} nuovi leak · {scanResult.pendingApprovals || 0} approvazioni pendenti
            </div>
          )}
          <Button
            onClick={handleScan}
            disabled={scanning}
            className="gap-2"
            style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.35)', color: '#a5b4fc' }}
          >
            {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {scanning ? 'Scansione in corso...' : 'Avvia Scansione AI'}
          </Button>
        </div>
      </div>

      {/* Creator Header */}
      <div className="p-6 flex flex-col md:flex-row md:items-center gap-6" style={card}>
        {/* Profile image */}
        <div className="relative flex-shrink-0">
          {creator.profile_image ? (
            <img
              src={creator.profile_image}
              alt={creator.stage_name}
              className="h-20 w-20 rounded-full object-cover"
              style={{ border: '2px solid rgba(99,102,241,0.4)' }}
            />
          ) : (
            <div className="h-20 w-20 rounded-full flex items-center justify-center text-2xl font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)', border: '2px solid rgba(99,102,241,0.4)' }}>
              {initials}
            </div>
          )}
          {/* Risk indicator dot */}
          <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2" style={{ background: risk.color, borderColor: '#0d1829' }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-white">{creator.stage_name}</h1>
            <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: risk.bg, color: risk.color, border: risk.border }}>
              {risk.label} Risk
            </span>
            <span className="text-xs px-2 py-1 rounded-full font-medium"
              style={{
                background: creator.status === 'active' ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.15)',
                color: creator.status === 'active' ? '#6ee7b7' : '#94a3b8',
                border: creator.status === 'active' ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(100,116,139,0.3)'
              }}>
              {creator.status === 'active' ? 'Attivo' : creator.status}
            </span>
          </div>
          <p className="text-slate-400 text-sm">{creator.legal_name}</p>
          <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-slate-500">
            <span className="flex items-center gap-1">
              <Mail className="w-3.5 h-3.5" />
              {creator.email}
            </span>
            {creator.contract_start && (
              <span>Cliente dal {format(new Date(creator.contract_start), 'MMM yyyy', { locale: it })}</span>
            )}
            {creator.onlyfans_url && (
              <a href={creator.onlyfans_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300">
                <ExternalLink className="w-3.5 h-3.5" /> OnlyFans
              </a>
            )}
          </div>
        </div>

        <div className="text-right">
          <p className="text-xs text-slate-500 mb-1">Revenue Mensile</p>
          <p className="text-2xl font-bold text-white">${(creator.monthly_revenue || 0).toLocaleString()}</p>
          {creator.estimated_loss > 0 && (
            <>
              <p className="text-xs text-slate-500 mt-2 mb-1">Perdita Stimata</p>
              <p className="text-lg font-semibold" style={{ color: '#f87171' }}>${creator.estimated_loss.toLocaleString()}</p>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Risk Score" value={Math.round(creator.risk_score || 0)} icon={AlertTriangle}
          color={creator.risk_level === 'critical' ? 'red' : creator.risk_level === 'high' ? 'amber' : 'emerald'} />
        <StatsCard title="Leak Attivi" value={activeLeaks.length} subtitle={`${leaks.length} totali`} icon={Eye} color="red" />
        <StatsCard title="Tasso Rimozione" value={`${removalRate}%`} icon={CheckCircle} color="emerald" />
        <StatsCard title="Tempo Medio" value={`${Math.round(creator.avg_removal_time || 0)}g`} icon={Clock} color="blue" />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="leaks" className="space-y-4">
        <TabsList style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.15)' }}>
          <TabsTrigger value="leaks" style={{ color: '#94a3b8' }} className="data-[state=active]:text-white data-[state=active]:bg-indigo-600/30">
            Leak ({leaks.length})
          </TabsTrigger>
          <TabsTrigger value="dmca" style={{ color: '#94a3b8' }} className="data-[state=active]:text-white data-[state=active]:bg-indigo-600/30">
            DMCA ({dmcaRequests.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="leaks">
          <div style={card}>
            <div className="p-4 border-b" style={{ borderColor: 'rgba(99,102,241,0.12)' }}>
              <h3 className="text-sm font-semibold text-white">Leak Tracciati</h3>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow style={{ borderColor: 'rgba(99,102,241,0.12)' }}>
                    <TableHead style={{ color: '#64748b' }}>URL / Dominio</TableHead>
                    <TableHead style={{ color: '#64748b' }}>Tipo</TableHead>
                    <TableHead style={{ color: '#64748b' }}>Severità</TableHead>
                    <TableHead style={{ color: '#64748b' }}>Stato</TableHead>
                    <TableHead style={{ color: '#64748b' }}>Scoperto</TableHead>
                    <TableHead style={{ color: '#64748b' }}>Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaks.slice(0, 50).map((leak) => {
                    const sev = SEVERITY_DARK[leak.severity] || SEVERITY_DARK.low;
                    const st = STATUS_DARK[leak.status] || STATUS_DARK.rejected;
                    return (
                      <TableRow key={leak.id} style={tableRow}>
                        <TableCell>
                          <div className="max-w-xs">
                            <p className="font-medium text-slate-200 truncate">{leak.domain}</p>
                            <a href={leak.leak_url} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-indigo-400 hover:text-indigo-300 truncate block">
                              {leak.leak_url?.substring(0, 50)}...
                            </a>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-slate-400 capitalize">{leak.content_type || 'N/D'}</TableCell>
                        <TableCell>
                          <span className="text-xs px-2 py-0.5 rounded-full capitalize font-medium"
                            style={{ background: sev.bg, color: sev.color }}>
                            {leak.severity || 'N/D'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ background: st.bg, color: st.color }}>
                            {st.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-slate-500">
                          {leak.discovery_date ? format(new Date(leak.discovery_date), 'dd/MM/yy') : 'N/D'}
                        </TableCell>
                        <TableCell>
                          <span className="font-semibold text-slate-300">{Math.round(leak.damage_score || 0)}</span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {leaks.length === 0 && (
              <div className="text-center py-10 text-slate-500">Nessun leak trovato per questo creator</div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="dmca">
          <div style={card}>
            <div className="p-4 border-b" style={{ borderColor: 'rgba(99,102,241,0.12)' }}>
              <h3 className="text-sm font-semibold text-white">Richieste DMCA</h3>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow style={{ borderColor: 'rgba(99,102,241,0.12)' }}>
                    <TableHead style={{ color: '#64748b' }}>Notice #</TableHead>
                    <TableHead style={{ color: '#64748b' }}>Destinatario</TableHead>
                    <TableHead style={{ color: '#64748b' }}>Metodo</TableHead>
                    <TableHead style={{ color: '#64748b' }}>Data Invio</TableHead>
                    <TableHead style={{ color: '#64748b' }}>Stato</TableHead>
                    <TableHead style={{ color: '#64748b' }}>Escalation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dmcaRequests.map((request) => (
                    <TableRow key={request.id} style={tableRow}>
                      <TableCell className="font-mono text-sm text-slate-300">{request.notice_number || 'N/D'}</TableCell>
                      <TableCell>
                        <p className="font-medium text-slate-200">{request.sent_to_entity || 'N/D'}</p>
                        <p className="text-xs text-slate-500 capitalize">{request.sent_to_type}</p>
                      </TableCell>
                      <TableCell className="text-sm text-slate-400 capitalize">{request.method || 'N/D'}</TableCell>
                      <TableCell className="text-sm text-slate-400">
                        {request.sent_date ? format(new Date(request.sent_date), 'dd/MM/yy') : 'N/D'}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={request.removal_confirmed
                            ? { background: 'rgba(16,185,129,0.15)', color: '#6ee7b7' }
                            : { background: 'rgba(245,158,11,0.15)', color: '#fcd34d' }}>
                          {request.removal_confirmed ? 'Confermato' : 'In corso'}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm font-medium text-slate-400">Lv. {request.escalation_level || 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {dmcaRequests.length === 0 && (
              <div className="text-center py-10 text-slate-500">Nessuna richiesta DMCA per questo creator</div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}