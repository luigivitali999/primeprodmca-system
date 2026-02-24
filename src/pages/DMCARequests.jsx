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
  CheckCircle,
  Clock,
  Send,
  AlertTriangle,
  FileText,
  Loader
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

const STATUS_LABELS = {
  pending: 'In Attesa', sent: 'Inviata', acknowledged: 'Ricevuta',
  processing: 'In Elaborazione', completed: 'Completata',
  rejected: 'Rifiutata', escalated: 'Escalation',
};

const DMCA_STATUS_DARK = {
  pending:     { bg: 'rgba(59,130,246,0.15)',  color: '#60a5fa', label: 'In Attesa' },
  sent:        { bg: 'rgba(251,191,36,0.15)',  color: '#fbbf24', label: 'Inviata' },
  acknowledged:{ bg: 'rgba(168,85,247,0.15)', color: '#c084fc', label: 'Ricevuta' },
  processing:  { bg: 'rgba(99,102,241,0.15)', color: '#a5b4fc', label: 'In Elaborazione' },
  completed:   { bg: 'rgba(16,185,129,0.15)', color: '#34d399', label: 'Completata' },
  rejected:    { bg: 'rgba(100,116,139,0.15)',color: '#94a3b8', label: 'Rifiutata' },
  escalated:   { bg: 'rgba(236,72,153,0.15)', color: '#f472b6', label: 'Escalation' },
};

export default function DMCARequests() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState(null);
  const [sendingRequestId, setSendingRequestId] = useState(null);
  const [formData, setFormData] = useState({
    leak_id: '',
    creator_id: '',
    sent_to_entity: '',
    sent_to_type: 'hosting',
    method: 'email',
    template_used: 'standard_dmca',
    notes: '',
  });

  const queryClient = useQueryClient();

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['dmca-requests'],
    queryFn: () => base44.entities.DMCARequest.list('-created_date', 500),
  });

  const { data: creators = [] } = useQuery({
    queryKey: ['creators'],
    queryFn: () => base44.entities.Creator.list('-created_date', 200),
  });

  const { data: leaks = [] } = useQuery({
    queryKey: ['leaks'],
    queryFn: () => base44.entities.Leak.list('-created_date', 500),
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const creator = creators.find(c => c.id === data.creator_id);
      const leak = leaks.find(l => l.id === data.leak_id);
      const noticeNumber = `DMCA-${format(new Date(), 'yyyyMMdd')}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      
      const requestData = {
        ...data,
        notice_number: noticeNumber,
        creator_name: creator?.stage_name || '',
        sent_date: format(new Date(), 'yyyy-MM-dd'),
        follow_up_date: format(new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
        status: 'sent',
        escalation_level: 0,
      };
      
      // Update leak status
      if (leak) {
        await base44.entities.Leak.update(leak.id, { 
          status: 'notice_sent',
          first_notice_date: format(new Date(), 'yyyy-MM-dd')
        });
      }
      
      return base44.entities.DMCARequest.create(requestData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dmca-requests'] });
      queryClient.invalidateQueries({ queryKey: ['leaks'] });
      setIsDialogOpen(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.DMCARequest.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dmca-requests'] });
      setIsDialogOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.DMCARequest.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dmca-requests'] });
    },
  });

  const confirmRemovalMutation = useMutation({
    mutationFn: async (request) => {
      const today = format(new Date(), 'yyyy-MM-dd');
      
      await base44.entities.DMCARequest.update(request.id, {
        removal_confirmed: true,
        removal_confirmation_date: today,
        status: 'completed',
        days_to_remove: request.sent_date 
          ? Math.ceil((new Date() - new Date(request.sent_date)) / (1000 * 60 * 60 * 24))
          : 0,
      });
      
      if (request.leak_id) {
        await base44.entities.Leak.update(request.leak_id, {
          status: 'removed',
          removal_date: today,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dmca-requests'] });
      queryClient.invalidateQueries({ queryKey: ['leaks'] });
    },
  });

  const sendDMCAMutation = useMutation({
    mutationFn: async (request) => {
      setSendingRequestId(request.id);
      const response = await base44.functions.invoke('batchSendDMCA', {
        dmca_request_id: request.id,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dmca-requests'] });
      queryClient.invalidateQueries({ queryKey: ['leaks'] });
      setSendingRequestId(null);
    },
    onError: () => {
      setSendingRequestId(null);
    },
  });

  const resetForm = () => {
    setFormData({
      leak_id: '',
      creator_id: '',
      sent_to_entity: '',
      sent_to_type: 'hosting',
      method: 'email',
      template_used: 'standard_dmca',
      notes: '',
    });
    setEditingRequest(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingRequest) {
      updateMutation.mutate({ id: editingRequest.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (request) => {
    setEditingRequest(request);
    setFormData({
      leak_id: request.leak_id || '',
      creator_id: request.creator_id || '',
      sent_to_entity: request.sent_to_entity || '',
      sent_to_type: request.sent_to_type || 'hosting',
      method: request.method || 'email',
      template_used: request.template_used || 'standard_dmca',
      notes: request.notes || '',
    });
    setIsDialogOpen(true);
  };

  const filteredRequests = requests.filter(request => {
    const matchesSearch = 
      request.notice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.sent_to_entity?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.creator_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Get leaks that don't have DMCA sent yet
  const availableLeaks = leaks.filter(l => 
    l.status === 'found' || 
    !requests.some(r => r.leak_id === l.id)
  );

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
          <h1 className="text-2xl font-bold" style={{ color: T.text }}>Richieste DMCA</h1>
          <p style={{ color: T.textMuted, fontSize: 14, marginTop: 2 }}>{requests.length} richieste totali</p>
        </div>
        <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}
          style={{ background: 'linear-gradient(135deg,#6366f1,#3b82f6)', color: '#fff', border: 'none' }}>
          <Plus className="w-4 h-4 mr-2" />Nuova DMCA
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: T.textMuted }} />
          <Input placeholder="Cerca per numero, destinatario o creator..." value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)} className="pl-10"
            style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.2)', color: T.text }} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48" style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.2)', color: T.text }}>
            <SelectValue placeholder="Stato" />
          </SelectTrigger>
          <SelectContent style={{ background: '#0f172a', border: '1px solid rgba(99,102,241,0.2)' }}>
            <SelectItem value="all">Tutti gli stati</SelectItem>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div style={{ ...cardStyle, overflow: 'hidden' }}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow style={{ borderBottom: '1px solid rgba(99,102,241,0.12)' }}>
                {['Notice #', 'Creator', 'Destinatario', 'Metodo', 'Data Invio', 'Stato', 'Follow-up', ''].map(h => (
                  <TableHead key={h} style={{ color: T.textMuted, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', background: '#0a1120' }}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRequests.map((request) => {
                const st = DMCA_STATUS_DARK[request.status] || DMCA_STATUS_DARK.pending;
                return (
                  <TableRow key={request.id} style={{ borderBottom: '1px solid rgba(99,102,241,0.06)' }} className="hover:bg-white/[0.02] transition-colors">
                    <TableCell className="font-mono text-sm font-medium" style={{ color: T.indigoSoft }}>
                      {request.notice_number || 'N/D'}
                    </TableCell>
                    <TableCell style={{ color: T.text, fontSize: 14 }}>{request.creator_name || 'N/D'}</TableCell>
                    <TableCell>
                      <p className="text-sm font-medium" style={{ color: T.text }}>{request.sent_to_entity || 'N/D'}</p>
                      <p className="text-xs capitalize" style={{ color: T.textMuted }}>{request.sent_to_type}</p>
                    </TableCell>
                    <TableCell style={{ color: T.textMuted, fontSize: 13, textTransform: 'capitalize' }}>{request.method || 'N/D'}</TableCell>
                    <TableCell style={{ color: T.textMuted, fontSize: 13 }}>
                      {request.sent_date ? format(new Date(request.sent_date), 'dd/MM/yy') : 'N/D'}
                    </TableCell>
                    <TableCell>
                      <span style={{ background: st.bg, color: st.color, padding: '2px 9px', borderRadius: 5, fontSize: 11, fontWeight: 600 }}>
                        {st.label || request.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      {request.follow_up_date && !request.removal_confirmed && (
                        <span className="text-xs flex items-center gap-1" style={{ color: T.textMuted }}>
                          <Clock className="w-3 h-3" />{format(new Date(request.follow_up_date), 'dd/MM')}
                        </span>
                      )}
                      {request.removal_confirmed && (
                        <span className="text-xs flex items-center gap-1" style={{ color: '#34d399' }}>
                          <CheckCircle className="w-3 h-3" />Rimosso
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/5">
                            <MoreVertical className="w-4 h-4" style={{ color: T.textMuted }} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" style={{ background: '#0f172a', border: '1px solid rgba(99,102,241,0.2)' }}>
                          {request.status === 'pending' && (
                            <DropdownMenuItem 
                              onClick={() => sendDMCAMutation.mutate(request)}
                              disabled={sendingRequestId === request.id}
                              className="flex items-center gap-2"
                            >
                              {sendingRequestId === request.id ? (
                                <>
                                  <Loader className="w-4 h-4 animate-spin" />Invio in corso...
                                </>
                              ) : (
                                <>
                                  <Send className="w-4 h-4" />Invia DMCA Ora
                                </>
                              )}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => handleEdit(request)}>
                            <Edit className="w-4 h-4 mr-2" />Modifica
                          </DropdownMenuItem>
                          {!request.removal_confirmed && (
                            <DropdownMenuItem onClick={() => confirmRemovalMutation.mutate(request)}>
                              <CheckCircle className="w-4 h-4 mr-2" />Conferma Rimozione
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => deleteMutation.mutate(request.id)} className="text-red-400">
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
        {filteredRequests.length === 0 && (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 mx-auto mb-4" style={{ color: 'rgba(99,102,241,0.3)' }} />
            <p style={{ color: T.textMuted }}>Nessuna richiesta DMCA trovata</p>
          </div>
        )}
      </div>

      {/* DMCA Request Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent style={{ background: '#0f172a', border: '1px solid rgba(99,102,241,0.2)', color: T.text, maxHeight: '90vh', overflowY: 'auto' }} className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle style={{ color: T.text }}>
              {editingRequest ? 'Modifica Richiesta DMCA' : 'Nuova Richiesta DMCA'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label style={{ color: T.textMuted, fontSize: 12 }}>Leak *</Label>
              <Select value={formData.leak_id} onValueChange={(value) => {
                const leak = leaks.find(l => l.id === value);
                setFormData({ ...formData, leak_id: value, creator_id: leak?.creator_id || formData.creator_id, sent_to_entity: leak?.hosting_provider || formData.sent_to_entity });
              }}>
                <SelectTrigger style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.2)', color: T.text }}>
                  <SelectValue placeholder="Seleziona leak" />
                </SelectTrigger>
                <SelectContent style={{ background: '#0f172a', border: '1px solid rgba(99,102,241,0.2)' }}>
                  {availableLeaks.map(l => <SelectItem key={l.id} value={l.id}>{l.domain} - {l.creator_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label style={{ color: T.textMuted, fontSize: 12 }}>Destinatario *</Label>
                <Input value={formData.sent_to_entity} onChange={(e) => setFormData({ ...formData, sent_to_entity: e.target.value })}
                  placeholder="Cloudflare, Namecheap..." required
                  style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.2)', color: T.text }} />
              </div>
              <div className="space-y-2">
                <Label style={{ color: T.textMuted, fontSize: 12 }}>Tipo Destinatario</Label>
                <Select value={formData.sent_to_type} onValueChange={(value) => setFormData({ ...formData, sent_to_type: value })}>
                  <SelectTrigger style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.2)', color: T.text }}><SelectValue /></SelectTrigger>
                  <SelectContent style={{ background: '#0f172a', border: '1px solid rgba(99,102,241,0.2)' }}>
                    <SelectItem value="hosting">Hosting</SelectItem><SelectItem value="registrar">Registrar</SelectItem>
                    <SelectItem value="google">Google</SelectItem><SelectItem value="cloudflare">Cloudflare</SelectItem>
                    <SelectItem value="platform">Piattaforma</SelectItem><SelectItem value="other">Altro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label style={{ color: T.textMuted, fontSize: 12 }}>Metodo Invio</Label>
                <Select value={formData.method} onValueChange={(value) => setFormData({ ...formData, method: value })}>
                  <SelectTrigger style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.2)', color: T.text }}><SelectValue /></SelectTrigger>
                  <SelectContent style={{ background: '#0f172a', border: '1px solid rgba(99,102,241,0.2)' }}>
                    <SelectItem value="email">Email</SelectItem><SelectItem value="form">Form Online</SelectItem>
                    <SelectItem value="api">API</SelectItem><SelectItem value="fax">Fax</SelectItem>
                    <SelectItem value="legal_letter">Lettera Legale</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label style={{ color: T.textMuted, fontSize: 12 }}>Template</Label>
                <Select value={formData.template_used} onValueChange={(value) => setFormData({ ...formData, template_used: value })}>
                  <SelectTrigger style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.2)', color: T.text }}><SelectValue /></SelectTrigger>
                  <SelectContent style={{ background: '#0f172a', border: '1px solid rgba(99,102,241,0.2)' }}>
                    <SelectItem value="standard_dmca">DMCA Standard</SelectItem><SelectItem value="google_dmca">Google DMCA</SelectItem>
                    <SelectItem value="cloudflare_abuse">Cloudflare Abuse</SelectItem><SelectItem value="legal_notice">Diffida Legale</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label style={{ color: T.textMuted, fontSize: 12 }}>Note</Label>
              <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={2}
                style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.2)', color: T.text }} />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}
                style={{ borderColor: 'rgba(99,102,241,0.3)', color: T.textMuted, background: 'transparent' }}>Annulla</Button>
              <Button type="submit" style={{ background: 'linear-gradient(135deg,#6366f1,#3b82f6)', color: '#fff', border: 'none' }}>
                <Send className="w-4 h-4 mr-2" />{editingRequest ? 'Salva Modifiche' : 'Invia DMCA'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}