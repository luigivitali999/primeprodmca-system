import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  TrendingUp,
  Users,
  Globe,
  FileText,
  Activity,
  Mail,
  CheckCheck
} from 'lucide-react';
import StatsCard from '@/components/dashboard/StatsCard';
import LeaksByStatus from '@/components/dashboard/LeaksByStatus';
import LeaksTimeline from '@/components/dashboard/LeaksTimeline';
import TopDomainsTable from '@/components/dashboard/TopDomainsTable';
import CreatorRiskRanking from '@/components/dashboard/CreatorRiskRanking';
import EconomicLossTimeline from '@/components/dashboard/EconomicLossTimeline';
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const queryClient = useQueryClient();

  const { data: leaks = [], isLoading: leaksLoading } = useQuery({
    queryKey: ['leaks'],
    queryFn: () => base44.entities.Leak.list('-created_date', 1000),
  });

  const { data: creators = [], isLoading: creatorsLoading } = useQuery({
    queryKey: ['creators'],
    queryFn: () => base44.entities.Creator.list('-created_date', 100),
  });

  const { data: domainsFetch = [], isLoading: domainsLoading } = useQuery({
    queryKey: ['domains-dashboard'],
    queryFn: () => base44.entities.DomainIntelligence.list('-total_leaks', 100),
  });

  const { data: dmcaRequests = [], isLoading: dmcaLoading } = useQuery({
    queryKey: ['dmca-requests'],
    queryFn: () => base44.entities.DMCARequest.list('-created_date', 500),
  });

  const { data: socialReports = [], isLoading: socialLoading } = useQuery({
    queryKey: ['social-reports-dashboard'],
    queryFn: () => base44.entities.SocialReport.list('-created_date', 500),
  });

  // Real-time subscription to Creator changes (estimated_loss updates)
  useEffect(() => {
    const unsubscribe = base44.entities.Creator.subscribe((event) => {
      if (event.type === 'update') {
        queryClient.invalidateQueries({ queryKey: ['creators'] });
      }
    });
    return unsubscribe;
  }, [queryClient]);

  const isLoading = leaksLoading || creatorsLoading || domainsLoading || dmcaLoading || socialLoading;
  const domains = domainsFetch;

  // Calculate stats
  const activeLeaks = leaks.filter(l => l.status !== 'removed' && l.status !== 'rejected');
  const removedLeaks = leaks.filter(l => l.status === 'removed');
  const criticalLeaks = leaks.filter(l => l.severity === 'critical' && l.status !== 'removed');
  const removalRate = leaks.length > 0 ? Math.round((removedLeaks.length / leaks.length) * 100) : 0;
  
  const avgRemovalTime = removedLeaks.length > 0
    ? Math.round(removedLeaks.reduce((acc, l) => acc + (l.days_online || 0), 0) / removedLeaks.length)
    : 0;

  const activeSocialReports = socialReports.filter(r => ['Segnalato', 'In attesa', 'Escalation'].includes(r.status));
  const removedSocialReports = socialReports.filter(r => r.status === 'Rimosso');
  const socialRemovalRate = socialReports.length > 0 ? Math.round((removedSocialReports.length / socialReports.length) * 100) : 0;

  const avgSocialRemovalTime = removedSocialReports.length > 0
    ? Math.round(removedSocialReports.reduce((acc, r) => acc + (r.days_online || 0), 0) / removedSocialReports.length)
    : 0;

  const creatorsWithHighImpersonation = creators.filter(c => 
    socialReports.filter(r => r.creator_id === c.id && ['Segnalato', 'In attesa', 'Escalation'].includes(r.status)).length > 3
  );

  // DMCA Stats
  const dmcaSent = dmcaRequests.filter(d => ['sent', 'acknowledged', 'processing', 'completed'].includes(d.status));
  const dmcaSuccessful = dmcaRequests.filter(d => d.removal_confirmed);
  const dmcaFailed = dmcaRequests.filter(d => d.status === 'rejected');
  const dmcaSuccessRate = dmcaRequests.length > 0 ? Math.round((dmcaSuccessful.length / dmcaSent.length) * 100) : 0;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#e2e8f0', letterSpacing: '-0.01em' }}>Dashboard</h1>
        <p style={{ color: '#475569', marginTop: 4, fontSize: 14 }}>Panoramica DMCA Intelligence</p>
      </div>

      {/* Top KPI Section - Tactical */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Leak Attivi"
          value={activeLeaks.length}
          subtitle={`${leaks.length} totali`}
          icon={AlertTriangle}
          color="red"
        />
        <StatsCard
          title="Tasso Rimozione"
          value={`${removalRate}%`}
          subtitle={`${removedLeaks.length} rimossi`}
          icon={CheckCircle}
          color="emerald"
        />
        <StatsCard
          title="DMCA Successo"
          value={`${dmcaSuccessRate}%`}
          subtitle={`${dmcaSuccessful.length}/${dmcaSent.length} rimosse`}
          icon={CheckCheck}
          color="emerald"
        />
        <StatsCard
          title="DMCA Inviate"
          value={dmcaSent.length}
          subtitle={`${dmcaFailed.length} rifiutate`}
          icon={Mail}
          color="blue"
        />
      </div>

      {/* Economic Loss Chart */}
      <EconomicLossTimeline leaks={leaks} creators={creators} domains={domains} />

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LeaksTimeline leaks={leaks} />
        <LeaksByStatus leaks={leaks} />
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopDomainsTable domains={domains} leaks={leaks} />
        <CreatorRiskRanking creators={creators} />
      </div>

      {/* DMCA Success Status */}
      <div style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.12)', borderRadius: '0.75rem', padding: '1.5rem' }}>
        <h2 style={{ color: '#e2e8f0', fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>Ultimi risultati DMCA</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: '0.875rem', color: '#cbd5e1' }}>
            <thead style={{ borderBottom: '1px solid rgba(99,102,241,0.12)' }}>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.75rem', color: '#94a3b8', fontWeight: 500 }}>Notice</th>
                <th style={{ textAlign: 'left', padding: '0.75rem', color: '#94a3b8', fontWeight: 500 }}>Domain</th>
                <th style={{ textAlign: 'left', padding: '0.75rem', color: '#94a3b8', fontWeight: 500 }}>Status</th>
                <th style={{ textAlign: 'left', padding: '0.75rem', color: '#94a3b8', fontWeight: 500 }}>Risultato</th>
              </tr>
            </thead>
            <tbody>
              {dmcaRequests.slice(0, 8).map(req => (
                <tr key={req.id} style={{ borderBottom: '1px solid rgba(99,102,241,0.08)' }}>
                  <td style={{ padding: '0.75rem', fontSize: '0.75rem', fontFamily: 'monospace' }}>{req.notice_number || 'N/A'}</td>
                  <td style={{ padding: '0.75rem' }}>{req.sent_to_entity || '-'}</td>
                  <td style={{ padding: '0.75rem' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '0.25rem',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      background: req.status === 'completed' ? 'rgba(16,185,129,0.15)' : req.status === 'rejected' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                      color: req.status === 'completed' ? '#86efac' : req.status === 'rejected' ? '#f87171' : '#fcd34d',
                      border: req.status === 'completed' ? '1px solid rgba(16,185,129,0.3)' : req.status === 'rejected' ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(245,158,11,0.3)',
                    }}>
                      {req.status}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '0.25rem',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      background: req.removal_confirmed ? 'rgba(16,185,129,0.15)' : 'rgba(229,231,235,0.05)',
                      color: req.removal_confirmed ? '#86efac' : '#9ca3af',
                      border: req.removal_confirmed ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(209,213,219,0.3)',
                    }}>
                      {req.removal_confirmed ? '✓ Rimosso' : '○ In sospeso'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}