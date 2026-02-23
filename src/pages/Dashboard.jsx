import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  TrendingUp,
  Users,
  Globe,
  FileText,
  Activity
} from 'lucide-react';
import StatsCard from '@/components/dashboard/StatsCard';
import LeaksByStatus from '@/components/dashboard/LeaksByStatus';
import LeaksTimeline from '@/components/dashboard/LeaksTimeline';
import TopDomainsTable from '@/components/dashboard/TopDomainsTable';
import CreatorRiskRanking from '@/components/dashboard/CreatorRiskRanking';
import EconomicLossTimeline from '@/components/dashboard/EconomicLossTimeline';
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
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
          title="Tempo Medio Rimozione"
          value={`${avgRemovalTime}g`}
          subtitle="dalla scoperta"
          icon={Clock}
          color="blue"
        />
        <StatsCard
          title="Perdita Stimata"
          value={`€${(creators.reduce((sum, c) => sum + (c.estimated_loss || 0), 0) / 1000).toFixed(0)}k`}
          subtitle="accumulata"
          icon={TrendingUp}
          color="red"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LeaksTimeline leaks={leaks} />
        <LeaksByStatus leaks={leaks} />
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopDomainsTable domains={domains} />
        <CreatorRiskRanking creators={creators} />
      </div>
    </div>
  );
}