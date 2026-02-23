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
import EconomicLossCard from '@/components/dashboard/EconomicLossCard';
import { Skeleton } from "@/components/ui/skeleton";
import { calcEstimatedLoss } from '@/components/utils/theme';

export default function Dashboard() {
  const { data: leaks = [], isLoading: leaksLoading } = useQuery({
    queryKey: ['leaks'],
    queryFn: () => base44.entities.Leak.list('-created_date', 1000),
  });

  const { data: creators = [], isLoading: creatorsLoading } = useQuery({
    queryKey: ['creators'],
    queryFn: () => base44.entities.Creator.list('-created_date', 100),
  });

  const { data: domains = [], isLoading: domainsLoading } = useQuery({
    queryKey: ['domains'],
    queryFn: () => base44.entities.DomainIntelligence.list('-total_leaks', 100),
  });

  const { data: dmcaRequests = [], isLoading: dmcaLoading } = useQuery({
    queryKey: ['dmca-requests'],
    queryFn: () => base44.entities.DMCARequest.list('-created_date', 500),
  });

  const isLoading = leaksLoading || creatorsLoading || domainsLoading || dmcaLoading;

  // Calculate stats
  const activeLeaks = leaks.filter(l => l.status !== 'removed' && l.status !== 'rejected');
  const removedLeaks = leaks.filter(l => l.status === 'removed');
  const criticalLeaks = leaks.filter(l => l.severity === 'critical' && l.status !== 'removed');
  const removalRate = leaks.length > 0 ? Math.round((removedLeaks.length / leaks.length) * 100) : 0;
  
  const avgRemovalTime = removedLeaks.length > 0
    ? Math.round(removedLeaks.reduce((acc, l) => acc + (l.days_online || 0), 0) / removedLeaks.length)
    : 0;

  const { data: domains = [] } = useQuery({
    queryKey: ['domains'],
    queryFn: () => base44.entities.DomainIntelligence.list('-total_leaks', 100),
  });

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

      {/* Stats Grid */}
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
          title="Leak Critici"
          value={criticalLeaks.length}
          subtitle="richiedono attenzione"
          icon={Activity}
          color="amber"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatsCard
          title="Creator Attivi"
          value={creators.filter(c => c.status === 'active').length}
          icon={Users}
          color="indigo"
        />
        <StatsCard
          title="Domini Monitorati"
          value={domains.length}
          icon={Globe}
          color="slate"
        />
        <StatsCard
          title="DMCA Inviate"
          value={dmcaRequests.length}
          icon={FileText}
          color="blue"
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