import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { 
  Plus, 
  Search, 
  MoreVertical,
  Edit,
  Trash2,
  AlertTriangle,
  Globe,
  Shield,
  TrendingUp,
  Clock
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import StatsCard from '@/components/dashboard/StatsCard';
import { T, cardStyle } from '@/components/utils/theme';
import AbuseEmailLookup from '@/components/dmca/AbuseEmailLookup';

const RESPONSE_CFG = {
  excellent:    { label: 'Eccellente',    color: '#34d399', bg: 'rgba(52,211,153,0.15)' },
  good:         { label: 'Buona',         color: '#60a5fa', bg: 'rgba(96,165,250,0.15)' },
  poor:         { label: 'Scarsa',        color: '#fbbf24', bg: 'rgba(251,191,36,0.15)' },
  unresponsive: { label: 'Non Risponde',  color: '#f87171', bg: 'rgba(239,68,68,0.15)' },
};

export default function Domains() {
  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDomain, setEditingDomain] = useState(null);
  const [formData, setFormData] = useState({
    domain_name: '',
    hosting_provider: '',
    registrar: '',
    country: '',
    abuse_email: '',
    dmca_contact: '',
    preferred_method: 'email',
    response_quality: 'good',
    high_risk_flag: false,
    notes: '',
  });

  const queryClient = useQueryClient();

  const { data: domains = [], isLoading } = useQuery({
    queryKey: ['domains'],
    queryFn: () => base44.entities.DomainIntelligence.list('-total_leaks', 200),
    staleTime: 60000,
  });

  const { data: allLeaks = [] } = useQuery({
    queryKey: ['leaks-for-domains'],
    queryFn: () => base44.entities.Leak.list('-created_date', 1000),
    staleTime: 60000,
  });

  // Calcola statistiche live dai leak reali, sovrascrivendo i valori statici del dominio
  const domainsWithLiveStats = domains.map(domain => {
    const domainLeaks = allLeaks.filter(l => l.domain === domain.domain_name);
    const removed = domainLeaks.filter(l => l.status === 'removed').length;
    const total = domainLeaks.length;
    const removalRate = total > 0 ? Math.round((removed / total) * 100) : 0;
    return {
      ...domain,
      total_leaks: total || domain.total_leaks || 0,
      total_removed: removed || domain.total_removed || 0,
      removal_rate: total > 0 ? removalRate : (domain.removal_rate || 0),
    };
  }).sort((a, b) => b.total_leaks - a.total_leaks);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.DomainIntelligence.create({
      ...data,
      total_leaks: 0,
      total_removed: 0,
      removal_rate: 0,
      avg_removal_time: 0,
      escalation_count: 0,
      blacklist_score: data.high_risk_flag ? 50 : 0,
      last_updated: format(new Date(), 'yyyy-MM-dd'),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domains'] });
      setIsDialogOpen(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.DomainIntelligence.update(id, {
      ...data,
      last_updated: format(new Date(), 'yyyy-MM-dd'),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domains'] });
      setIsDialogOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.DomainIntelligence.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domains'] });
    },
  });

  const resetForm = () => {
    setFormData({
      domain_name: '',
      hosting_provider: '',
      registrar: '',
      country: '',
      abuse_email: '',
      dmca_contact: '',
      preferred_method: 'email',
      response_quality: 'good',
      high_risk_flag: false,
      notes: '',
    });
    setEditingDomain(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingDomain) {
      updateMutation.mutate({ id: editingDomain.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (domain) => {
    setEditingDomain(domain);
    setFormData({
      domain_name: domain.domain_name || '',
      hosting_provider: domain.hosting_provider || '',
      registrar: domain.registrar || '',
      country: domain.country || '',
      abuse_email: domain.abuse_email || '',
      dmca_contact: domain.dmca_contact || '',
      preferred_method: domain.preferred_method || 'email',
      response_quality: domain.response_quality || 'good',
      high_risk_flag: domain.high_risk_flag || false,
      notes: domain.notes || '',
    });
    setIsDialogOpen(true);
  };

  const filteredDomains = domainsWithLiveStats.filter(domain => {
    const matchesSearch = 
      domain.domain_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      domain.hosting_provider?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRisk = riskFilter === 'all' || 
      (riskFilter === 'high' && domain.high_risk_flag) ||
      (riskFilter === 'normal' && !domain.high_risk_flag);
    return matchesSearch && matchesRisk;
  });

  // Stats live
  const highRiskDomains = domainsWithLiveStats.filter(d => d.high_risk_flag);
  const avgRemovalRate = domainsWithLiveStats.length > 0 
    ? Math.round(domainsWithLiveStats.reduce((acc, d) => acc + (d.removal_rate || 0), 0) / domainsWithLiveStats.length)
    : 0;
  const totalLeaks = allLeaks.length;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: T.text }}>Domain Intelligence</h1>
          <p style={{ color: T.textMuted, fontSize: 14, marginTop: 2 }}>{domains.length} domini monitorati</p>
        </div>
        <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}
          style={{ background: 'linear-gradient(135deg,#6366f1,#3b82f6)', color: '#fff', border: 'none' }}>
          <Plus className="w-4 h-4 mr-2" />Aggiungi Dominio
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatsCard title="Domini Totali" value={domains.length} icon={Globe} color="blue" />
        <StatsCard title="Alto Rischio" value={highRiskDomains.length} icon={AlertTriangle} color="red" />
        <StatsCard title="Tasso Rimozione Medio" value={`${avgRemovalRate}%`} icon={TrendingUp} color="emerald" />
        <StatsCard title="Leak Totali" value={totalLeaks} icon={Shield} color="amber" />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: T.textMuted }} />
          <Input placeholder="Cerca per dominio o hosting..." value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)} className="pl-10"
            style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.2)', color: T.text }} />
        </div>
        <Select value={riskFilter} onValueChange={setRiskFilter}>
          <SelectTrigger className="w-full sm:w-48" style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.2)', color: T.text }}>
            <SelectValue placeholder="Livello Rischio" />
          </SelectTrigger>
          <SelectContent style={{ background: '#0f172a', border: '1px solid rgba(99,102,241,0.2)' }}>
            <SelectItem value="all">Tutti i livelli</SelectItem>
            <SelectItem value="high">Alto Rischio</SelectItem>
            <SelectItem value="normal">Normale</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div style={{ ...cardStyle, overflow: 'hidden' }}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow style={{ borderBottom: '1px solid rgba(99,102,241,0.12)' }}>
                {['Dominio', 'Hosting / Registrar', 'Leak', 'Tasso Rimozione', 'Tempo Medio', 'Risposta', 'Score', ''].map(h => (
                  <TableHead key={h} style={{ color: T.textMuted, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', background: '#0a1120' }}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDomains.map((domain) => {
                const rq = RESPONSE_CFG[domain.response_quality];
                return (
                  <TableRow key={domain.id} style={{ borderBottom: '1px solid rgba(99,102,241,0.06)' }} className="hover:bg-white/[0.02] transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {domain.high_risk_flag && <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: '#f87171' }} />}
                        <span className="font-medium" style={{ color: T.text }}>{domain.domain_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm" style={{ color: T.text }}>{domain.hosting_provider || 'N/D'}</p>
                      <p className="text-xs" style={{ color: T.textMuted }}>{domain.registrar || 'N/D'}</p>
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className="font-semibold" style={{ color: T.text }}>{domain.total_leaks || 0}</span>
                      <span style={{ color: T.textMuted }}> / </span>
                      <span style={{ color: '#34d399' }}>{domain.total_removed || 0} rimossi</span>
                    </TableCell>
                    <TableCell>
                      <div className="w-24">
                        <p className="text-sm font-semibold mb-1" style={{ color: T.text }}>{Math.round(domain.removal_rate || 0)}%</p>
                        <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ width: `${domain.removal_rate || 0}%`, height: '100%', background: 'linear-gradient(90deg,#6366f1,#10b981)', borderRadius: 2 }} />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm flex items-center gap-1" style={{ color: T.textMuted }}>
                        <Clock className="w-3 h-3" />{Math.round(domain.avg_removal_time || 0)}g
                      </span>
                    </TableCell>
                    <TableCell>
                      {rq ? <span style={{ background: rq.bg, color: rq.color, padding: '2px 9px', borderRadius: 5, fontSize: 11, fontWeight: 600 }}>{rq.label}</span>
                        : <span style={{ color: T.textMuted, fontSize: 12 }}>N/D</span>}
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold" style={{ color: (domain.blacklist_score || 0) >= 60 ? '#f87171' : T.text }}>
                        {Math.round(domain.blacklist_score || 0)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/5">
                            <MoreVertical className="w-4 h-4" style={{ color: T.textMuted }} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" style={{ background: '#0f172a', border: '1px solid rgba(99,102,241,0.2)' }}>
                          <DropdownMenuItem onClick={() => handleEdit(domain)}><Edit className="w-4 h-4 mr-2" />Modifica</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => deleteMutation.mutate(domain.id)} className="text-red-400">
                            <Trash2 className="w-4 h-4 mr-2" />Elimina
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        {filteredDomains.length === 0 && (
          <div className="text-center py-12">
            <Globe className="w-12 h-12 mx-auto mb-4" style={{ color: 'rgba(99,102,241,0.3)' }} />
            <p style={{ color: T.textMuted }}>Nessun dominio trovato</p>
          </div>
        )}
      </div>

      {/* Domain Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent style={{ background: '#0f172a', border: '1px solid rgba(99,102,241,0.2)', color: T.text, maxHeight: '90vh', overflowY: 'auto' }} className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle style={{ color: T.text }}>{editingDomain ? 'Modifica Dominio' : 'Nuovo Dominio'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label style={{ color: T.textMuted, fontSize: 12 }}>Nome Dominio *</Label>
              <Input value={formData.domain_name} onChange={(e) => setFormData({ ...formData, domain_name: e.target.value })}
                placeholder="example.com" required
                style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.2)', color: T.text }} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label style={{ color: T.textMuted, fontSize: 12 }}>Hosting Provider</Label>
                <Input value={formData.hosting_provider} onChange={(e) => setFormData({ ...formData, hosting_provider: e.target.value })}
                  style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.2)', color: T.text }} />
              </div>
              <div className="space-y-2">
                <Label style={{ color: T.textMuted, fontSize: 12 }}>Registrar</Label>
                <Input value={formData.registrar} onChange={(e) => setFormData({ ...formData, registrar: e.target.value })}
                  style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.2)', color: T.text }} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label style={{ color: T.textMuted, fontSize: 12 }}>Paese</Label>
                <Input value={formData.country} onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  placeholder="US, DE, NL..."
                  style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.2)', color: T.text }} />
              </div>
              <div className="space-y-2">
                <Label style={{ color: T.textMuted, fontSize: 12 }}>Metodo Preferito</Label>
                <Select value={formData.preferred_method} onValueChange={(value) => setFormData({ ...formData, preferred_method: value })}>
                  <SelectTrigger style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.2)', color: T.text }}><SelectValue /></SelectTrigger>
                  <SelectContent style={{ background: '#0f172a', border: '1px solid rgba(99,102,241,0.2)' }}>
                    <SelectItem value="email">Email</SelectItem><SelectItem value="form">Form Online</SelectItem>
                    <SelectItem value="api">API</SelectItem><SelectItem value="legal">Legale</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label style={{ color: T.textMuted, fontSize: 12 }}>Email Abuse</Label>
                <Input type="email" value={formData.abuse_email} onChange={(e) => setFormData({ ...formData, abuse_email: e.target.value })}
                  style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.2)', color: T.text }} />
                {formData.domain_name && !formData.abuse_email && (
                  <AbuseEmailLookup
                    domain={formData.domain_name}
                    onFound={(email) => setFormData(f => ({ ...f, abuse_email: email }))}
                  />
                )}
              </div>
              <div className="space-y-2">
                <Label style={{ color: T.textMuted, fontSize: 12 }}>Contatto DMCA</Label>
                <Input value={formData.dmca_contact} onChange={(e) => setFormData({ ...formData, dmca_contact: e.target.value })}
                  style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.2)', color: T.text }} />
              </div>
            </div>
            <div className="space-y-2">
              <Label style={{ color: T.textMuted, fontSize: 12 }}>Qualità Risposta</Label>
              <Select value={formData.response_quality} onValueChange={(value) => setFormData({ ...formData, response_quality: value })}>
                <SelectTrigger style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.2)', color: T.text }}><SelectValue /></SelectTrigger>
                <SelectContent style={{ background: '#0f172a', border: '1px solid rgba(99,102,241,0.2)' }}>
                  <SelectItem value="excellent">Eccellente</SelectItem><SelectItem value="good">Buona</SelectItem>
                  <SelectItem value="poor">Scarsa</SelectItem><SelectItem value="unresponsive">Non Risponde</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="high_risk" checked={formData.high_risk_flag}
                onCheckedChange={(checked) => setFormData({ ...formData, high_risk_flag: checked })} />
              <Label htmlFor="high_risk" className="text-sm font-normal" style={{ color: T.textMuted }}>Contrassegna come Alto Rischio</Label>
            </div>
            <div className="space-y-2">
              <Label style={{ color: T.textMuted, fontSize: 12 }}>Note Intelligence</Label>
              <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={2}
                style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.2)', color: T.text }} />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}
                style={{ borderColor: 'rgba(99,102,241,0.3)', color: T.textMuted, background: 'transparent' }}>Annulla</Button>
              <Button type="submit" style={{ background: 'linear-gradient(135deg,#6366f1,#3b82f6)', color: '#fff', border: 'none' }}>
                {editingDomain ? 'Salva Modifiche' : 'Aggiungi Dominio'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}