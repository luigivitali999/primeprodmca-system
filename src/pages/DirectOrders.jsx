import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Zap, Plus, Search, MoreVertical, Trash2, Eye,
  AlertTriangle, Clock, CheckCircle2, Globe
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { cardStyle, T } from '@/components/utils/theme';

const PRIORITY_CONFIG = {
  low:      { label: 'Bassa',   color: '#94a3b8', bg: 'rgba(100,116,139,0.15)' },
  medium:   { label: 'Media',   color: '#60a5fa', bg: 'rgba(59,130,246,0.15)' },
  high:     { label: 'Alta',    color: '#fbbf24', bg: 'rgba(251,191,36,0.15)' },
  critical: { label: 'Critica', color: '#f87171', bg: 'rgba(239,68,68,0.15)' },
};

const STATUS_CONFIG = {
  pending:    { label: 'In Attesa',    color: '#94a3b8' },
  sent:       { label: 'Inviata',      color: '#60a5fa' },
  processing: { label: 'In Processo',  color: '#fbbf24' },
  completed:  { label: 'Completata',   color: '#34d399' },
  rejected:   { label: 'Rifiutata',    color: '#f87171' },
};

const EMPTY_FORM = {
  domain: '', leak_url: '', creator_id: '', priority: 'high', notes: '',
};

export default function DirectOrders() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const queryClient = useQueryClient();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['direct-orders'],
    queryFn: () => base44.entities.DirectOrder.list('-created_date', 500),
  });

  const { data: creators = [] } = useQuery({
    queryKey: ['creators'],
    queryFn: () => base44.entities.Creator.list('-created_date', 200),
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const creator = creators.find(c => c.id === data.creator_id);
      // 1. Create a Leak record
      const leak = await base44.entities.Leak.create({
        creator_id: data.creator_id,
        creator_name: creator?.stage_name || '',
        leak_url: data.leak_url,
        domain: data.domain,
        status: 'found',
        severity: data.priority === 'critical' ? 'critical' : data.priority === 'high' ? 'high' : 'medium',
        discovery_date: format(new Date(), 'yyyy-MM-dd'),
        detected_by: 'manual',
        notes: data.notes,
      });
      // 2. Create a DMCA Request
      const dmca = await base44.entities.DMCARequest.create({
        leak_id: leak.id,
        creator_id: data.creator_id,
        creator_name: creator?.stage_name || '',
        sent_date: format(new Date(), 'yyyy-MM-dd'),
        status: 'sent',
        notice_number: `ORD-${Date.now()}`,
        sent_to_entity: data.domain,
        sent_to_type: 'hosting',
        method: 'email',
        escalation_level: data.priority === 'critical' ? 2 : 1,
        notes: `[ORDINE DIRETTO] ${data.notes}`,
      });
      // 3. Create the DirectOrder linking both
      return base44.entities.DirectOrder.create({
        ...data,
        creator_name: creator?.stage_name || '',
        sent_date: format(new Date(), 'yyyy-MM-dd'),
        status: 'sent',
        leak_id: leak.id,
        dmca_request_id: dmca.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['direct-orders'] });
      queryClient.invalidateQueries({ queryKey: ['leaks'] });
      queryClient.invalidateQueries({ queryKey: ['dmca-requests'] });
      setIsDialogOpen(false);
      setFormData(EMPTY_FORM);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.DirectOrder.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['direct-orders'] }),
  });

  const filtered = orders.filter(o =>
    o.domain?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.creator_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pending = orders.filter(o => o.status === 'pending' || o.status === 'sent').length;
  const completed = orders.filter(o => o.status === 'completed').length;

  if (isLoading) return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" style={{ background: 'rgba(99,102,241,0.1)' }} />
      <Skeleton className="h-64 rounded-xl" style={{ background: 'rgba(99,102,241,0.1)' }} />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: T.text }}>Ordini Diretti Takedown</h1>
          <p style={{ color: T.textMuted, fontSize: 14, marginTop: 2 }}>
            {pending} in corso · {completed} completati
          </p>
        </div>
        <Button
          onClick={() => { setFormData(EMPTY_FORM); setIsDialogOpen(true); }}
          style={{ background: 'linear-gradient(135deg,#6366f1,#3b82f6)', color: '#fff', border: 'none' }}
        >
          <Zap className="w-4 h-4 mr-2" />
          Nuovo Ordine Diretto
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: T.textMuted }} />
        <Input
          placeholder="Cerca per dominio o creator..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
          style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.2)', color: T.text }}
        />
      </div>

      {/* Table */}
      <div style={{ ...cardStyle, overflow: 'hidden' }}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow style={{ borderBottom: '1px solid rgba(99,102,241,0.12)' }}>
                {['Dominio / URL', 'Creator', 'Priorità', 'Stato', 'Data Invio', 'Note', ''].map(h => (
                  <TableHead key={h} style={{ color: T.textMuted, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', background: '#0a1120' }}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((order) => {
                const pc = PRIORITY_CONFIG[order.priority] || PRIORITY_CONFIG.medium;
                const sc = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
                return (
                  <TableRow key={order.id} style={{ borderBottom: '1px solid rgba(99,102,241,0.06)' }}
                    className="transition-colors hover:bg-white/[0.02]">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Globe className="w-4 h-4" style={{ color: '#60a5fa' }} />
                        </div>
                        <div>
                          <p className="font-medium" style={{ color: T.text }}>{order.domain}</p>
                          {order.leak_url && (
                            <a href={order.leak_url} target="_blank" rel="noopener noreferrer"
                              className="text-xs hover:underline truncate block max-w-[200px]"
                              style={{ color: T.textMuted }}>
                              {order.leak_url.substring(0, 40)}...
                            </a>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell style={{ color: T.text, fontSize: 14 }}>{order.creator_name || '—'}</TableCell>
                    <TableCell>
                      <span style={{ background: pc.bg, color: pc.color, padding: '2px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
                        {pc.label}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span style={{ color: sc.color, fontSize: 13, fontWeight: 500 }}>● {sc.label}</span>
                    </TableCell>
                    <TableCell style={{ color: T.textMuted, fontSize: 13 }}>
                      {order.sent_date ? format(new Date(order.sent_date), 'dd/MM/yyyy') : '—'}
                    </TableCell>
                    <TableCell style={{ color: T.textMuted, fontSize: 12, maxWidth: 150 }}>
                      <span className="truncate block">{order.notes || '—'}</span>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-red-500/10"
                        onClick={() => deleteMutation.mutate(order.id)}>
                        <Trash2 className="w-4 h-4" style={{ color: '#f87171' }} />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-12">
            <Zap className="w-12 h-12 mx-auto mb-4" style={{ color: 'rgba(99,102,241,0.3)' }} />
            <p style={{ color: T.textMuted }}>Nessun ordine diretto trovato</p>
            <p className="text-sm mt-1" style={{ color: T.textDim }}>Usa questa sezione per segnalazioni urgenti o siti non monitorati</p>
          </div>
        )}
      </div>

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent style={{ background: '#0f172a', border: '1px solid rgba(99,102,241,0.2)', color: T.text }} className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle style={{ color: T.text }}>
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5" style={{ color: '#6366f1' }} />
                Nuovo Ordine Diretto Takedown
              </div>
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(formData); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label style={{ color: T.textMuted, fontSize: 12 }}>Dominio *</Label>
                <Input value={formData.domain}
                  onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                  placeholder="esempio.com" required
                  style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.2)', color: T.text }}
                />
              </div>
              <div className="space-y-2">
                <Label style={{ color: T.textMuted, fontSize: 12 }}>Creator *</Label>
                <Select value={formData.creator_id} onValueChange={(v) => setFormData({ ...formData, creator_id: v })}>
                  <SelectTrigger style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.2)', color: T.text }}>
                    <SelectValue placeholder="Seleziona..." />
                  </SelectTrigger>
                  <SelectContent style={{ background: '#0f172a', border: '1px solid rgba(99,102,241,0.2)' }}>
                    {creators.map(c => <SelectItem key={c.id} value={c.id}>{c.stage_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label style={{ color: T.textMuted, fontSize: 12 }}>URL Specifico (opzionale)</Label>
              <Input value={formData.leak_url}
                onChange={(e) => setFormData({ ...formData, leak_url: e.target.value })}
                placeholder="https://..."
                style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.2)', color: T.text }}
              />
            </div>
            <div className="space-y-2">
              <Label style={{ color: T.textMuted, fontSize: 12 }}>Priorità</Label>
              <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
                <SelectTrigger style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.2)', color: T.text }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent style={{ background: '#0f172a', border: '1px solid rgba(99,102,241,0.2)' }}>
                  <SelectItem value="low">🔵 Bassa</SelectItem>
                  <SelectItem value="medium">🟡 Media</SelectItem>
                  <SelectItem value="high">🟠 Alta</SelectItem>
                  <SelectItem value="critical">🔴 Critica</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label style={{ color: T.textMuted, fontSize: 12 }}>Note Interne</Label>
              <Textarea value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3} placeholder="Dettagli, segnalatore, urgenza..."
                style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.2)', color: T.text }}
              />
            </div>
            <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 8, padding: '10px 14px' }}>
              <p className="text-xs" style={{ color: '#fbbf24' }}>
                ⚡ L'invio creerà automaticamente: un Leak, una richiesta DMCA e un log nell'ordine. 
                La DMCA verrà registrata in pipeline per il tracking.
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}
                style={{ borderColor: 'rgba(99,102,241,0.3)', color: T.textMuted, background: 'transparent' }}>
                Annulla
              </Button>
              <Button type="submit" disabled={createMutation.isPending || !formData.creator_id}
                style={{ background: 'linear-gradient(135deg,#6366f1,#3b82f6)', color: '#fff', border: 'none' }}>
                {createMutation.isPending ? 'Invio...' : '⚡ Invia DMCA Immediata'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}