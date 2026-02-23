import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Plus, FileText, Trash2, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { T, cardStyle, STATUS_DARK } from '@/components/utils/theme';
import SocialReportForm from '@/components/social/SocialReportForm';
import ReportTextGenerator from '@/components/social/ReportTextGenerator';
import { Skeleton } from '@/components/ui/skeleton';

const PLATFORM_COLORS = {
  Instagram: '#E4405F',
  TikTok: '#000000',
  X: '#000000',
  Facebook: '#1877F2',
  Altro: '#6366F1',
};

export default function SocialProtection() {
  const [formOpen, setFormOpen] = useState(false);
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const queryClient = useQueryClient();

  const { data: reports = [], isLoading: reportsLoading } = useQuery({
    queryKey: ['social-reports'],
    queryFn: () => base44.entities.SocialReport.list('-created_date', 500),
  });

  const { data: creators = [] } = useQuery({
    queryKey: ['creators-social'],
    queryFn: () => base44.entities.Creator.list('-created_date', 100),
  });

  const deleteReportMutation = useMutation({
    mutationFn: (id) => base44.entities.SocialReport.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['social-reports'] }),
  });

  const updateReportMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.SocialReport.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['social-reports'] }),
  });

  const handleStatusChange = (report, newStatus) => {
    updateReportMutation.mutate({
      id: report.id,
      data: { status: newStatus, last_update: new Date().toISOString().split('T')[0] },
    });
  };

  const handleDelete = (id) => {
    if (window.confirm('Elimina questa segnalazione?')) {
      deleteReportMutation.mutate(id);
    }
  };

  const handleShowGenerator = (report) => {
    setSelectedReport(report);
    setGeneratorOpen(true);
  };

  const activeReports = reports.filter(r => ['Segnalato', 'In attesa', 'Escalation'].includes(r.status));
  const removedReports = reports.filter(r => r.status === 'Rimosso');

  const getCreatorForReport = (creatorId) => creators.find(c => c.id === creatorId);

  const statusConfig = {
    'Segnalato': { bg: 'rgba(59,130,246,0.15)', color: '#60a5fa', label: 'Segnalato' },
    'In attesa': { bg: 'rgba(251,191,36,0.15)', color: '#fbbf24', label: 'In Attesa' },
    'Rimosso': { bg: 'rgba(16,185,129,0.15)', color: '#34d399', label: 'Rimosso' },
    'Rifiutato': { bg: 'rgba(100,116,139,0.15)', color: '#94a3b8', label: 'Rifiutato' },
    'Escalation': { bg: 'rgba(236,72,153,0.15)', color: '#f472b6', label: 'Escalation' },
  };

  if (reportsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48 mb-2" />
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: T.text, letterSpacing: '-0.01em' }}>Social Protection</h1>
          <p style={{ color: T.textMuted, marginTop: 4, fontSize: 14 }}>Gestione impersonificazioni e violazioni social</p>
        </div>
        <Button onClick={() => setFormOpen(true)} className="gap-2" style={{ background: '#6366f1' }}>
          <Plus className="w-4 h-4" />
          Nuova Segnalazione
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg" style={cardStyle}>
          <p style={{ color: T.textMuted, fontSize: 12 }}>Segnalazioni Attive</p>
          <p className="text-2xl font-bold mt-2" style={{ color: T.text }}>{activeReports.length}</p>
        </div>
        <div className="p-4 rounded-lg" style={cardStyle}>
          <p style={{ color: T.textMuted, fontSize: 12 }}>Rimosse</p>
          <p className="text-2xl font-bold mt-2" style={{ color: '#34d399' }}>{removedReports.length}</p>
        </div>
        <div className="p-4 rounded-lg" style={cardStyle}>
          <p style={{ color: T.textMuted, fontSize: 12 }}>Tasso Rimozione</p>
          <p className="text-2xl font-bold mt-2" style={{ color: T.text }}>
            {reports.length > 0 ? Math.round((removedReports.length / reports.length) * 100) : 0}%
          </p>
        </div>
      </div>

      {/* Alerts */}
      {creators.map((creator) => {
        const creatorReports = reports.filter(r => r.creator_id === creator.id && ['Segnalato', 'In attesa', 'Escalation'].includes(r.status));
        return creatorReports.length > 3 ? (
          <div key={creator.id} className="p-4 rounded-lg border" style={{ borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.05)' }}>
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5" style={{ color: '#f87171' }} />
              <div>
                <p style={{ color: T.text, fontWeight: 500 }}>{creator.stage_name}: {creatorReports.length} impersonificazioni attive</p>
                <p style={{ color: T.textMuted, fontSize: 12 }}>Attenzione: numero elevato di segnalazioni</p>
              </div>
            </div>
          </div>
        ) : null;
      })}

      {/* Reports List */}
      <div className="space-y-3">
        {reports.length === 0 ? (
          <div className="p-8 text-center rounded-lg" style={cardStyle}>
            <p style={{ color: T.textMuted }}>Nessuna segnalazione yet</p>
          </div>
        ) : (
          reports.map((report) => {
            const creator = getCreatorForReport(report.creator_id);
            const config = statusConfig[report.status];
            return (
              <div key={report.id} className="p-4 rounded-lg border" style={{ ...cardStyle, borderColor: 'rgba(99,102,241,0.12)' }}>
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span style={{ color: PLATFORM_COLORS[report.platform] }} className="font-semibold">
                        {report.platform}
                      </span>
                      <span style={{ color: T.textMuted, fontSize: 13 }}>@{report.fake_username}</span>
                      <Badge style={{ background: config.bg, color: config.color, border: 'none' }}>
                        {config.label}
                      </Badge>
                    </div>
                    <p style={{ color: T.textMuted, fontSize: 13, marginBottom: 8 }}>
                      Creator: {creator?.stage_name} • Tipo: {report.violation_type}
                    </p>
                    <a href={report.fake_profile_url} target="_blank" rel="noopener noreferrer"
                      style={{ color: '#60a5fa', fontSize: 13, textDecoration: 'underline' }}>
                      {report.fake_profile_url}
                    </a>
                    {report.notes_internal && (
                      <p style={{ color: T.textMuted, fontSize: 12, marginTop: 8, fontStyle: 'italic' }}>
                        {report.notes_internal}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={report.status}
                      onChange={(e) => handleStatusChange(report, e.target.value)}
                      style={{
                        background: '#0a1120',
                        color: T.text,
                        border: '1px solid rgba(99,102,241,0.2)',
                        padding: '6px 8px',
                        borderRadius: 6,
                        fontSize: 12,
                      }}
                    >
                      <option value="Segnalato">Segnalato</option>
                      <option value="In attesa">In Attesa</option>
                      <option value="Escalation">Escalation</option>
                      <option value="Rimosso">Rimosso</option>
                      <option value="Rifiutato">Rifiutato</option>
                    </select>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleShowGenerator(report)}
                      className="text-blue-400 hover:bg-slate-800"
                    >
                      <FileText className="w-4 h-4" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(report.id)}
                      className="text-red-400 hover:bg-slate-800"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Forms */}
      <SocialReportForm
        creators={creators}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmitSuccess={() => {
          setFormOpen(false);
          queryClient.invalidateQueries({ queryKey: ['social-reports'] });
        }}
      />

      {selectedReport && (
        <ReportTextGenerator
          report={selectedReport}
          creator={getCreatorForReport(selectedReport.creator_id)}
          open={generatorOpen}
          onClose={() => {
            setGeneratorOpen(false);
            setSelectedReport(null);
          }}
        />
      )}
    </div>
  );
}