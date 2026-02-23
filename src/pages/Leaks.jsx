import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { 
  Plus, 
  Search, 
  Filter,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  Send,
  ExternalLink,
  AlertTriangle,
  Upload,
  X
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { T, cardStyle, STATUS_DARK } from '@/components/utils/theme';
import SendDMCAButton from '@/components/dmca/SendDMCAButton';

const STATUS_LABELS = {
  found: 'Trovato', notice_sent: 'Notice Inviata', waiting: 'In Attesa',
  follow_up: 'Follow-up', escalated: 'Escalation', removed: 'Rimosso', rejected: 'Rifiutato',
};

const SEVERITY_CFG = {
  critical: { color: '#f87171', bg: 'rgba(239,68,68,0.15)' },
  high:     { color: '#fbbf24', bg: 'rgba(251,191,36,0.15)' },
  medium:   { color: '#eab308', bg: 'rgba(234,179,8,0.15)' },
  low:      { color: '#94a3b8', bg: 'rgba(100,116,139,0.15)' },
};

export default function Leaks() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [creatorFilter, setCreatorFilter] = useState('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLeak, setEditingLeak] = useState(null);
  const [formData, setFormData] = useState({
    creator_id: '',
    leak_url: '',
    domain: '',
    hosting_provider: '',
    registrar: '',
    country: '',
    content_type: 'video',
    detected_by: 'manual',
    estimated_views: '',
    google_indexed: false,
    severity: 'medium',
    notes: '',
  });

  const queryClient = useQueryClient();

  const { data: leaks = [], isLoading } = useQuery({
    queryKey: ['leaks'],
    queryFn: () => base44.entities.Leak.list('-created_date', 500),
  });

  const { data: creators = [] } = useQuery({
    queryKey: ['creators'],
    queryFn: () => base44.entities.Creator.list('-created_date', 200),
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const creator = creators.find(c => c.id === data.creator_id);
      const leakData = {
        ...data,
        creator_name: creator?.stage_name || '',
        discovery_date: format(new Date(), 'yyyy-MM-dd'),
        status: 'found',
        estimated_views: data.estimated_views ? parseInt(data.estimated_views) : 0,
        damage_score: calculateDamageScore(data),
      };
      return base44.entities.Leak.create(leakData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaks'] });
      setIsDialogOpen(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Leak.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaks'] });
      setIsDialogOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Leak.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaks'] });
    },
  });

  const calculateDamageScore = (data) => {
    let score = 0;
    const views = parseInt(data.estimated_views) || 0;
    score += Math.min(views / 1000, 30);
    
    if (data.severity === 'critical') score += 40;
    else if (data.severity === 'high') score += 25;
    else if (data.severity === 'medium') score += 15;
    else score += 5;

    if (data.google_indexed) score += 20;

    const typeScores = { video: 15, gallery: 12, mega: 10, torrent: 8, forum: 5, telegram: 7, other: 3 };
    score += typeScores[data.content_type] || 5;

    return Math.min(score, 100);
  };

  const resetForm = () => {
    setFormData({
      creator_id: '',
      leak_url: '',
      domain: '',
      hosting_provider: '',
      registrar: '',
      country: '',
      content_type: 'video',
      detected_by: 'manual',
      estimated_views: '',
      google_indexed: false,
      severity: 'medium',
      notes: '',
    });
    setEditingLeak(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingLeak) {
      updateMutation.mutate({ id: editingLeak.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (leak) => {
    setEditingLeak(leak);
    setFormData({
      creator_id: leak.creator_id || '',
      leak_url: leak.leak_url || '',
      domain: leak.domain || '',
      hosting_provider: leak.hosting_provider || '',
      registrar: leak.registrar || '',
      country: leak.country || '',
      content_type: leak.content_type || 'video',
      detected_by: leak.detected_by || 'manual',
      estimated_views: leak.estimated_views?.toString() || '',
      google_indexed: leak.google_indexed || false,
      severity: leak.severity || 'medium',
      notes: leak.notes || '',
    });
    setIsDialogOpen(true);
  };

  const extractDomain = (url) => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return '';
    }
  };

  const filteredLeaks = leaks.filter(leak => {
    const matchesSearch = 
      leak.leak_url?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      leak.domain?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      leak.creator_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || leak.status === statusFilter;
    const matchesSeverity = severityFilter === 'all' || leak.severity === severityFilter;
    const matchesCreator = creatorFilter === 'all' || leak.creator_id === creatorFilter;
    return matchesSearch && matchesStatus && matchesSeverity && matchesCreator;
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-32" style={{ background: 'rgba(99,102,241,0.1)' }} />
          <Skeleton className="h-10 w-36" style={{ background: 'rgba(99,102,241,0.1)' }} />
        </div>
        <Skeleton className="h-96 rounded-xl" style={{ background: 'rgba(99,102,241,0.1)' }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: T.text }}>Leaks</h1>
          <p style={{ color: T.textMuted, fontSize: 14, marginTop: 2 }}>{leaks.length} leak tracciati</p>
        </div>
        <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}
          style={{ background: 'linear-gradient(135deg,#6366f1,#3b82f6)', color: '#fff', border: 'none' }}>
          <Plus className="w-4 h-4 mr-2" />
          Nuovo Leak
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: T.textMuted }} />
          <Input placeholder="Cerca per URL, dominio o creator..." value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)} className="pl-10"
            style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.2)', color: T.text }} />
        </div>
        <Select value={creatorFilter} onValueChange={setCreatorFilter}>
          <SelectTrigger className="w-full lg:w-48" style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.2)', color: T.text }}>
            <SelectValue placeholder="Creator" />
          </SelectTrigger>
          <SelectContent style={{ background: '#0f172a', border: '1px solid rgba(99,102,241,0.2)' }}>
            <SelectItem value="all">Tutti i creator</SelectItem>
            {creators.map(c => <SelectItem key={c.id} value={c.id}>{c.stage_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full lg:w-40" style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.2)', color: T.text }}>
            <SelectValue placeholder="Stato" />
          </SelectTrigger>
          <SelectContent style={{ background: '#0f172a', border: '1px solid rgba(99,102,241,0.2)' }}>
            <SelectItem value="all">Tutti gli stati</SelectItem>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-full lg:w-40" style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.2)', color: T.text }}>
            <SelectValue placeholder="Severità" />
          </SelectTrigger>
          <SelectContent style={{ background: '#0f172a', border: '1px solid rgba(99,102,241,0.2)' }}>
            <SelectItem value="all">Tutte</SelectItem>
            <SelectItem value="critical">Critica</SelectItem>
            <SelectItem value="high">Alta</SelectItem>
            <SelectItem value="medium">Media</SelectItem>
            <SelectItem value="low">Bassa</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div style={{ ...cardStyle, overflow: 'hidden' }}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow style={{ borderBottom: '1px solid rgba(99,102,241,0.12)' }}>
                {['URL / Dominio', 'Creator', 'Tipo', 'Severità', 'Stato', 'Scoperto', 'Score', ''].map(h => (
                  <TableHead key={h} style={{ color: T.textMuted, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', background: '#0a1120' }}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLeaks.slice(0, 100).map((leak) => {
                const sev = SEVERITY_CFG[leak.severity] || SEVERITY_CFG.low;
                const st = STATUS_DARK[leak.status] || STATUS_DARK.found;
                return (
                  <TableRow key={leak.id} style={{ borderBottom: '1px solid rgba(99,102,241,0.06)' }} className="hover:bg-white/[0.02] transition-colors">
                    <TableCell>
                      <div className="max-w-[250px]">
                        <p className="font-medium truncate" style={{ color: T.text }}>{leak.domain}</p>
                        <div className="flex items-center gap-1">
                          <a href={leak.leak_url} target="_blank" rel="noopener noreferrer"
                            className="text-xs hover:underline truncate" style={{ color: T.textMuted }}>
                            {leak.leak_url?.substring(0, 40)}...
                          </a>
                          <ExternalLink className="w-3 h-3 flex-shrink-0" style={{ color: T.textMuted }} />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell style={{ color: T.text, fontSize: 14 }}>{leak.creator_name || 'N/D'}</TableCell>
                    <TableCell style={{ color: T.textMuted, fontSize: 13, textTransform: 'capitalize' }}>{leak.content_type || 'N/D'}</TableCell>
                    <TableCell>
                      <span style={{ background: sev.bg, color: sev.color, padding: '2px 9px', borderRadius: 5, fontSize: 11, fontWeight: 600, textTransform: 'capitalize' }}>
                        {leak.severity || 'N/D'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span style={{ background: st.bg, color: st.color, padding: '2px 9px', borderRadius: 5, fontSize: 11, fontWeight: 600 }}>
                        {st.label || leak.status}
                      </span>
                    </TableCell>
                    <TableCell style={{ color: T.textMuted, fontSize: 13 }}>
                      {leak.discovery_date ? format(new Date(leak.discovery_date), 'dd/MM/yy') : 'N/D'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <span className="font-semibold" style={{ color: (leak.damage_score || 0) >= 70 ? '#f87171' : T.text }}>{Math.round(leak.damage_score || 0)}</span>
                        {(leak.damage_score || 0) >= 70 && <AlertTriangle className="w-3.5 h-3.5" style={{ color: '#f87171' }} />}
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/5">
                            <MoreVertical className="w-4 h-4" style={{ color: T.textMuted }} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" style={{ background: '#0f172a', border: '1px solid rgba(99,102,241,0.2)' }}>
                          <DropdownMenuItem onClick={() => handleEdit(leak)}>
                            <Edit className="w-4 h-4 mr-2" />Modifica
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                             <SendDMCAButton leak={leak} onSuccess={() => queryClient.invalidateQueries({ queryKey: ['leaks'] })} label="Invia DMCA" size="sm" />
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => deleteMutation.mutate(leak.id)} className="text-red-400">
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
        {filteredLeaks.length === 0 && (
          <div className="text-center py-12">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4" style={{ color: 'rgba(99,102,241,0.3)' }} />
            <p style={{ color: T.textMuted }}>Nessun leak trovato</p>
          </div>
        )}
      </div>

      {/* Leak Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent style={{ background: '#0f172a', border: '1px solid rgba(99,102,241,0.2)', color: T.text, maxHeight: '90vh', overflowY: 'auto' }} className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle style={{ color: T.text }}>{editingLeak ? 'Modifica Leak' : 'Nuovo Leak'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label style={{ color: T.textMuted, fontSize: 12 }}>Creator *</Label>
              <Select value={formData.creator_id} onValueChange={(value) => setFormData({ ...formData, creator_id: value })}>
                <SelectTrigger style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.2)', color: T.text }}>
                  <SelectValue placeholder="Seleziona creator" />
                </SelectTrigger>
                <SelectContent style={{ background: '#0f172a', border: '1px solid rgba(99,102,241,0.2)' }}>
                  {creators.map(c => <SelectItem key={c.id} value={c.id}>{c.stage_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label style={{ color: T.textMuted, fontSize: 12 }}>URL Leak *</Label>
              <Input value={formData.leak_url}
                onChange={(e) => { const url = e.target.value; setFormData({ ...formData, leak_url: url, domain: extractDomain(url) || formData.domain }); }}
                placeholder="https://..." required
                style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.2)', color: T.text }} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label style={{ color: T.textMuted, fontSize: 12 }}>Dominio</Label>
                <Input value={formData.domain} onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                  style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.2)', color: T.text }} />
              </div>
              <div className="space-y-2">
                <Label style={{ color: T.textMuted, fontSize: 12 }}>Hosting Provider</Label>
                <Input value={formData.hosting_provider} onChange={(e) => setFormData({ ...formData, hosting_provider: e.target.value })}
                  style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.2)', color: T.text }} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label style={{ color: T.textMuted, fontSize: 12 }}>Registrar</Label>
                <Input value={formData.registrar} onChange={(e) => setFormData({ ...formData, registrar: e.target.value })}
                  style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.2)', color: T.text }} />
              </div>
              <div className="space-y-2">
                <Label style={{ color: T.textMuted, fontSize: 12 }}>Paese</Label>
                <Input value={formData.country} onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  placeholder="US, DE, NL..."
                  style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.2)', color: T.text }} />
              </div>
              <div className="space-y-2">
                <Label style={{ color: T.textMuted, fontSize: 12 }}>Views Stimate</Label>
                <Input type="number" value={formData.estimated_views} onChange={(e) => setFormData({ ...formData, estimated_views: e.target.value })}
                  style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.2)', color: T.text }} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label style={{ color: T.textMuted, fontSize: 12 }}>Tipo Contenuto</Label>
                <Select value={formData.content_type} onValueChange={(value) => setFormData({ ...formData, content_type: value })}>
                  <SelectTrigger style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.2)', color: T.text }}><SelectValue /></SelectTrigger>
                  <SelectContent style={{ background: '#0f172a', border: '1px solid rgba(99,102,241,0.2)' }}>
                    {['video','gallery','mega','torrent','forum','telegram','other'].map(v => <SelectItem key={v} value={v} className="capitalize">{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label style={{ color: T.textMuted, fontSize: 12 }}>Rilevato da</Label>
                <Select value={formData.detected_by} onValueChange={(value) => setFormData({ ...formData, detected_by: value })}>
                  <SelectTrigger style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.2)', color: T.text }}><SelectValue /></SelectTrigger>
                  <SelectContent style={{ background: '#0f172a', border: '1px solid rgba(99,102,241,0.2)' }}>
                    <SelectItem value="manual">Manuale</SelectItem>
                    <SelectItem value="scraping">Scraping</SelectItem>
                    <SelectItem value="tool">Tool</SelectItem>
                    <SelectItem value="report">Segnalazione</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label style={{ color: T.textMuted, fontSize: 12 }}>Severità</Label>
                <Select value={formData.severity} onValueChange={(value) => setFormData({ ...formData, severity: value })}>
                  <SelectTrigger style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.2)', color: T.text }}><SelectValue /></SelectTrigger>
                  <SelectContent style={{ background: '#0f172a', border: '1px solid rgba(99,102,241,0.2)' }}>
                    <SelectItem value="critical">Critica</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="medium">Media</SelectItem>
                    <SelectItem value="low">Bassa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="google_indexed" checked={formData.google_indexed}
                onCheckedChange={(checked) => setFormData({ ...formData, google_indexed: checked })} />
              <Label htmlFor="google_indexed" className="text-sm font-normal" style={{ color: T.textMuted }}>
                Indicizzato su Google
              </Label>
            </div>
            <div className="space-y-2">
              <Label style={{ color: T.textMuted, fontSize: 12 }}>Note</Label>
              <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={2}
                style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.2)', color: T.text }} />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}
                style={{ borderColor: 'rgba(99,102,241,0.3)', color: T.textMuted, background: 'transparent' }}>
                Annulla
              </Button>
              <Button type="submit" style={{ background: 'linear-gradient(135deg,#6366f1,#3b82f6)', color: '#fff', border: 'none' }}>
                {editingLeak ? 'Salva Modifiche' : 'Crea Leak'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}