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
  ShieldCheck,
  Globe,
  User,
  CalendarCheck,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
import { T, cardStyle } from '@/components/utils/theme';

const CONTENT_TYPES = ['video', 'gallery', 'mega', 'torrent', 'forum', 'telegram', 'other'];

const STATUS_CONFIG = {
  active:  { label: 'Attiva',   color: '#34d399', bg: 'rgba(16,185,129,0.12)' },
  expired: { label: 'Scaduta',  color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
  revoked: { label: 'Revocata', color: '#f87171', bg: 'rgba(239,68,68,0.12)' },
};

const SCOPE_CONFIG = {
  global:           { label: 'Globale',     color: '#60a5fa', bg: 'rgba(59,130,246,0.12)' },
  creator_specific: { label: 'Per Creator', color: '#c084fc', bg: 'rgba(168,85,247,0.12)' },
};

const EMPTY_FORM = {
  domain: '',
  platform_name: '',
  url: '',
  creator_id: '',
  scope: 'creator_specific',
  authorization_date: format(new Date(), 'yyyy-MM-dd'),
  expiry_date: '',
  content_types_allowed: [],
  status: 'active',
  notes: '',
};

export default function Whitelist() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [creatorFilter, setCreatorFilter] = useState('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const queryClient = useQueryClient();

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['whitelist'],
    queryFn: () => base44.entities.Whitelist.list('-created_date', 500),
  });

  const { data: creators = [] } = useQuery({
    queryKey: ['creators'],
    queryFn: () => base44.entities.Creator.list('-created_date', 200),
  });

  const createMutation = useMutation({
    mutationFn: (data) => {
      const creator = creators.find(c => c.id === data.creator_id);
      return base44.entities.Whitelist.create({
        ...data,
        creator_name: creator?.stage_name || '',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whitelist'] });
      setIsDialogOpen(false);
      setFormData(EMPTY_FORM);
      setEditingEntry(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => {
      const creator = creators.find(c => c.id === data.creator_id);
      return base44.entities.Whitelist.update(id, {
        ...data,
        creator_name: creator?.stage_name || '',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whitelist'] });
      setIsDialogOpen(false);
      setFormData(EMPTY_FORM);
      setEditingEntry(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Whitelist.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['whitelist'] }),
  });

  const revokeMutation = useMutation({
    mutationFn: (id) => base44.entities.Whitelist.update(id, { status: 'revoked' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['whitelist'] }),
  });

  const handleEdit = (entry) => {
    setEditingEntry(entry);
    setFormData({
      domain: entry.domain || '',
      platform_name: entry.platform_name || '',
      url: entry.url || '',
      creator_id: entry.creator_id || '',
      scope: entry.scope || 'creator_specific',
      authorization_date: entry.authorization_date || format(new Date(), 'yyyy-MM-dd'),
      expiry_date: entry.expiry_date || '',
      content_types_allowed: entry.content_types_allowed || [],
      status: entry.status || 'active',
      notes: entry.notes || '',
    });
    setIsDialogOpen(true);
  };

  const toggleContentType = (type) => {
    const current = formData.content_types_allowed || [];
    setFormData({
      ...formData,
      content_types_allowed: current.includes(type)
        ? current.filter(t => t !== type)
        : [...current, type],
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingEntry) {
      updateMutation.mutate({ id: editingEntry.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const filteredEntries = entries.filter(entry => {
    const matchesSearch =
      entry.domain?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.platform_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.creator_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || entry.status === statusFilter;
    const matchesCreator = creatorFilter === 'all' || entry.creator_id === creatorFilter;
    return matchesSearch && matchesStatus && matchesCreator;
  });

  const activeCount = entries.filter(e => e.status === 'active').length;
  const globalCount = entries.filter(e => e.scope === 'global').length;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" style={{ background: 'rgba(99,102,241,0.1)' }} />
          <Skeleton className="h-10 w-40" style={{ background: 'rgba(99,102,241,0.1)' }} />
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
          <h1 className="text-2xl font-bold" style={{ color: T.text }}>Whitelist Siti</h1>
          <p style={{ color: T.textMuted, fontSize: 14, marginTop: 2 }}>
            {activeCount} siti autorizzati · {globalCount} autorizzazioni globali
          </p>
        </div>
        <Button
          onClick={() => { setFormData(EMPTY_FORM); setEditingEntry(null); setIsDialogOpen(true); }}
          style={{ background: 'linear-gradient(135deg,#6366f1,#3b82f6)', color: '#fff', border: 'none' }}
        >
          <Plus className="w-4 h-4 mr-2" />
          Aggiungi Sito
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: T.textMuted }} />
          <Input
            placeholder="Cerca per dominio, piattaforma o creator..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.2)', color: T.text }}
          />
        </div>
        <Select value={creatorFilter} onValueChange={setCreatorFilter}>
          <SelectTrigger className="w-full sm:w-48" style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.2)', color: T.text }}>
            <SelectValue placeholder="Creator" />
          </SelectTrigger>
          <SelectContent style={{ background: '#0f172a', border: '1px solid rgba(99,102,241,0.2)' }}>
            <SelectItem value="all">Tutti i creator</SelectItem>
            {creators.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.stage_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40" style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.2)', color: T.text }}>
            <SelectValue placeholder="Stato" />
          </SelectTrigger>
          <SelectContent style={{ background: '#0f172a', border: '1px solid rgba(99,102,241,0.2)' }}>
            <SelectItem value="all">Tutti</SelectItem>
            <SelectItem value="active">Attiva</SelectItem>
            <SelectItem value="expired">Scaduta</SelectItem>
            <SelectItem value="revoked">Revocata</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div style={{ ...cardStyle, overflow: 'hidden' }}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow style={{ borderBottom: '1px solid rgba(99,102,241,0.12)' }}>
                <TableHead style={{ color: T.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', background: '#0a1120' }}>Dominio / Piattaforma</TableHead>
                <TableHead style={{ color: T.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', background: '#0a1120' }}>Creator</TableHead>
                <TableHead style={{ color: T.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', background: '#0a1120' }}>Scope</TableHead>
                <TableHead style={{ color: T.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', background: '#0a1120' }}>Contenuti</TableHead>
                <TableHead style={{ color: T.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', background: '#0a1120' }}>Autorizzato il</TableHead>
                <TableHead style={{ color: T.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', background: '#0a1120' }}>Scadenza</TableHead>
                <TableHead style={{ color: T.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', background: '#0a1120' }}>Stato</TableHead>
                <TableHead style={{ background: '#0a1120', width: 40 }}></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEntries.map((entry) => {
                const isExpired = entry.expiry_date && new Date(entry.expiry_date) < new Date() && entry.status === 'active';
                const statusKey = isExpired ? 'expired' : entry.status;
                const sc = STATUS_CONFIG[statusKey] || STATUS_CONFIG.active;
                const scp = SCOPE_CONFIG[entry.scope] || SCOPE_CONFIG.creator_specific;
                return (
                  <TableRow key={entry.id} style={{ borderBottom: '1px solid rgba(99,102,241,0.06)' }} className="hover:bg-white/[0.02] transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Globe className="w-4 h-4" style={{ color: '#34d399' }} />
                        </div>
                        <div>
                          <p className="font-medium" style={{ color: T.text }}>{entry.domain}</p>
                          {entry.platform_name && (
                            <p className="text-xs" style={{ color: T.textMuted }}>{entry.platform_name}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell style={{ color: T.text, fontSize: 14 }}>
                      {entry.scope === 'global' ? (
                        <span style={{ color: T.textMuted, fontStyle: 'italic', fontSize: 13 }}>Tutti i creator</span>
                      ) : (
                        entry.creator_name || 'N/D'
                      )}
                    </TableCell>
                    <TableCell>
                      <span style={{ background: scp.bg, color: scp.color, padding: '2px 9px', borderRadius: 5, fontSize: 11, fontWeight: 600 }}>
                        {scp.label}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {entry.content_types_allowed?.length > 0 ? (
                          entry.content_types_allowed.slice(0, 2).map(type => (
                            <span key={type} style={{ background: 'rgba(99,102,241,0.1)', color: '#a5b4fc', padding: '1px 7px', borderRadius: 4, fontSize: 11, textTransform: 'capitalize' }}>
                              {type}
                            </span>
                          ))
                        ) : (
                          <span style={{ color: T.textMuted, fontSize: 12 }}>Tutti</span>
                        )}
                        {(entry.content_types_allowed?.length || 0) > 2 && (
                          <span style={{ color: T.textMuted, fontSize: 12 }}>+{entry.content_types_allowed.length - 2}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell style={{ color: T.textMuted, fontSize: 13 }}>
                      {entry.authorization_date ? format(new Date(entry.authorization_date), 'dd/MM/yyyy') : 'N/D'}
                    </TableCell>
                    <TableCell>
                      {entry.expiry_date ? (
                        <span className="text-sm flex items-center gap-1" style={{ color: isExpired ? '#f87171' : T.textMuted }}>
                          {isExpired && <AlertTriangle className="w-3 h-3" />}
                          {format(new Date(entry.expiry_date), 'dd/MM/yyyy')}
                        </span>
                      ) : (
                        <span style={{ color: T.textDim, fontSize: 12 }}>Nessuna</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span style={{ background: sc.bg, color: sc.color, padding: '2px 9px', borderRadius: 5, fontSize: 11, fontWeight: 600 }}>
                        {sc.label}
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
                          <DropdownMenuItem onClick={() => handleEdit(entry)}>
                            <Edit className="w-4 h-4 mr-2" />
                            Modifica
                          </DropdownMenuItem>
                          {entry.status === 'active' && (
                            <DropdownMenuItem onClick={() => revokeMutation.mutate(entry.id)} className="text-amber-400">
                              <AlertTriangle className="w-4 h-4 mr-2" />
                              Revoca
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => deleteMutation.mutate(entry.id)} className="text-red-400">
                            <Trash2 className="w-4 h-4 mr-2" />
                            Elimina
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
        {filteredEntries.length === 0 && (
          <div className="text-center py-12">
            <ShieldCheck className="w-12 h-12 mx-auto mb-4" style={{ color: 'rgba(99,102,241,0.3)' }} />
            <p className="font-medium" style={{ color: T.text }}>Nessun sito in whitelist</p>
            <p className="text-sm mt-1" style={{ color: T.textMuted }}>Aggiungi i siti autorizzati a pubblicare i contenuti dei creator</p>
          </div>
        )}
      </div>

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingEntry ? 'Modifica Autorizzazione' : 'Nuovo Sito Autorizzato'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                 <Label style={{ color: T.text }}>Dominio *</Label>
                 <Input
                   value={formData.domain}
                   onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                   placeholder="example.com"
                   required
                   style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.2)', color: T.text }}
                 />
               </div>
               <div className="space-y-2">
                 <Label style={{ color: T.text }}>Nome Piattaforma</Label>
                 <Input
                   value={formData.platform_name}
                   onChange={(e) => setFormData({ ...formData, platform_name: e.target.value })}
                   placeholder="OnlyFans, Patreon..."
                   style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.2)', color: T.text }}
                 />
               </div>
            </div>

            <div className="space-y-2">
              <Label style={{ color: T.text }}>URL Profilo</Label>
              <Input
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                placeholder="https://..."
                style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.2)', color: T.text }}
              />
            </div>

            <div className="space-y-2">
              <Label style={{ color: T.text }}>Scope</Label>
              <Select
                value={formData.scope}
                onValueChange={(value) => setFormData({ ...formData, scope: value, creator_id: value === 'global' ? '' : formData.creator_id })}
              >
                <SelectTrigger style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.2)', color: T.text }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent style={{ background: '#0f172a', border: '1px solid rgba(99,102,241,0.2)' }}>
                  <SelectItem value="creator_specific">Per Creator Specifico</SelectItem>
                  <SelectItem value="global">Globale (tutti i creator)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.scope === 'creator_specific' && (
              <div className="space-y-2">
                <Label style={{ color: T.text }}>Creator *</Label>
                <Select
                  value={formData.creator_id}
                  onValueChange={(value) => setFormData({ ...formData, creator_id: value })}
                >
                  <SelectTrigger style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.2)', color: T.text }}>
                    <SelectValue placeholder="Seleziona creator" />
                  </SelectTrigger>
                  <SelectContent style={{ background: '#0f172a', border: '1px solid rgba(99,102,241,0.2)' }}>
                    {creators.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.stage_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label style={{ color: T.text }}>Data Autorizzazione</Label>
                <Input
                  type="date"
                  value={formData.authorization_date}
                  onChange={(e) => setFormData({ ...formData, authorization_date: e.target.value })}
                  style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.2)', color: T.text }}
                />
              </div>
              <div className="space-y-2">
                <Label style={{ color: T.text }}>Scadenza (opzionale)</Label>
                <Input
                  type="date"
                  value={formData.expiry_date}
                  onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                  style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.2)', color: T.text }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tipi Contenuto Permessi</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {CONTENT_TYPES.map(type => (
                  <label key={type} className="flex items-center gap-1.5 cursor-pointer">
                    <Checkbox
                      checked={(formData.content_types_allowed || []).includes(type)}
                      onCheckedChange={() => toggleContentType(type)}
                    />
                    <span className="text-sm capitalize">{type}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-slate-500">Nessuna selezione = tutti i tipi</p>
            </div>

            <div className="space-y-2">
              <Label>Note</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                placeholder="Dettagli accordo, contratto di riferimento..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Annulla
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                <ShieldCheck className="w-4 h-4 mr-2" />
                {editingEntry ? 'Salva Modifiche' : 'Aggiungi alla Whitelist'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}