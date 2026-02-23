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
    queryFn: () => base44.entities.DomainIntelligence.list('-total_leaks', 500),
  });

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

  const filteredDomains = domains.filter(domain => {
    const matchesSearch = 
      domain.domain_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      domain.hosting_provider?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRisk = riskFilter === 'all' || 
      (riskFilter === 'high' && domain.high_risk_flag) ||
      (riskFilter === 'normal' && !domain.high_risk_flag);
    return matchesSearch && matchesRisk;
  });

  // Stats
  const highRiskDomains = domains.filter(d => d.high_risk_flag);
  const avgRemovalRate = domains.length > 0 
    ? Math.round(domains.reduce((acc, d) => acc + (d.removal_rate || 0), 0) / domains.length)
    : 0;
  const totalLeaks = domains.reduce((acc, d) => acc + (d.total_leaks || 0), 0);

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
          <h1 className="text-2xl font-bold text-slate-900">Domain Intelligence</h1>
          <p className="text-slate-500 mt-1">{domains.length} domini monitorati</p>
        </div>
        <Button 
          onClick={() => { resetForm(); setIsDialogOpen(true); }}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Aggiungi Dominio
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatsCard
          title="Domini Totali"
          value={domains.length}
          icon={Globe}
          color="blue"
        />
        <StatsCard
          title="Alto Rischio"
          value={highRiskDomains.length}
          icon={AlertTriangle}
          color="red"
        />
        <StatsCard
          title="Tasso Rimozione Medio"
          value={`${avgRemovalRate}%`}
          icon={TrendingUp}
          color="emerald"
        />
        <StatsCard
          title="Leak Totali"
          value={totalLeaks}
          icon={Shield}
          color="amber"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Cerca per dominio o hosting..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={riskFilter} onValueChange={setRiskFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Livello Rischio" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i livelli</SelectItem>
            <SelectItem value="high">Alto Rischio</SelectItem>
            <SelectItem value="normal">Normale</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="bg-white border-0 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Dominio</TableHead>
                  <TableHead>Hosting / Registrar</TableHead>
                  <TableHead>Leak</TableHead>
                  <TableHead>Tasso Rimozione</TableHead>
                  <TableHead>Tempo Medio</TableHead>
                  <TableHead>Risposta</TableHead>
                  <TableHead>Rischio</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDomains.map((domain) => (
                  <TableRow key={domain.id} className="hover:bg-slate-50">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {domain.high_risk_flag && (
                          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                        )}
                        <span className="font-medium text-slate-900">{domain.domain_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm text-slate-900">{domain.hosting_provider || 'N/D'}</p>
                        <p className="text-xs text-slate-500">{domain.registrar || 'N/D'}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <span className="font-semibold text-slate-900">{domain.total_leaks || 0}</span>
                        <span className="text-slate-500"> / </span>
                        <span className="text-emerald-600">{domain.total_removed || 0} rimossi</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="w-24">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold text-slate-900">
                            {Math.round(domain.removal_rate || 0)}%
                          </span>
                        </div>
                        <Progress value={domain.removal_rate || 0} className="h-1.5" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {Math.round(domain.avg_removal_time || 0)}g
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${RESPONSE_COLORS[domain.response_quality] || 'bg-slate-100'}`}>
                        {RESPONSE_LABELS[domain.response_quality] || 'N/D'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-semibold text-slate-900">
                        {Math.round(domain.blacklist_score || 0)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(domain)}>
                            <Edit className="w-4 h-4 mr-2" />
                            Modifica
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => deleteMutation.mutate(domain.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Elimina
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {filteredDomains.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <Globe className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p>Nessun dominio trovato</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Domain Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingDomain ? 'Modifica Dominio' : 'Nuovo Dominio'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome Dominio *</Label>
              <Input
                value={formData.domain_name}
                onChange={(e) => setFormData({ ...formData, domain_name: e.target.value })}
                placeholder="example.com"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Hosting Provider</Label>
                <Input
                  value={formData.hosting_provider}
                  onChange={(e) => setFormData({ ...formData, hosting_provider: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Registrar</Label>
                <Input
                  value={formData.registrar}
                  onChange={(e) => setFormData({ ...formData, registrar: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Paese</Label>
                <Input
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  placeholder="US, DE, NL..."
                />
              </div>
              <div className="space-y-2">
                <Label>Metodo Preferito</Label>
                <Select 
                  value={formData.preferred_method} 
                  onValueChange={(value) => setFormData({ ...formData, preferred_method: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="form">Form Online</SelectItem>
                    <SelectItem value="api">API</SelectItem>
                    <SelectItem value="legal">Legale</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email Abuse</Label>
                <Input
                  type="email"
                  value={formData.abuse_email}
                  onChange={(e) => setFormData({ ...formData, abuse_email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Contatto DMCA</Label>
                <Input
                  value={formData.dmca_contact}
                  onChange={(e) => setFormData({ ...formData, dmca_contact: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Qualità Risposta</Label>
              <Select 
                value={formData.response_quality} 
                onValueChange={(value) => setFormData({ ...formData, response_quality: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="excellent">Eccellente</SelectItem>
                  <SelectItem value="good">Buona</SelectItem>
                  <SelectItem value="poor">Scarsa</SelectItem>
                  <SelectItem value="unresponsive">Non Risponde</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="high_risk"
                checked={formData.high_risk_flag}
                onCheckedChange={(checked) => setFormData({ ...formData, high_risk_flag: checked })}
              />
              <Label htmlFor="high_risk" className="text-sm font-normal">
                Contrassegna come Alto Rischio
              </Label>
            </div>

            <div className="space-y-2">
              <Label>Note Intelligence</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Annulla
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                {editingDomain ? 'Salva Modifiche' : 'Aggiungi Dominio'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}