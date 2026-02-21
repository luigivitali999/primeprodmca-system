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
  FileText
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

const STATUS_COLORS = {
  pending: 'bg-slate-100 text-slate-700',
  sent: 'bg-blue-100 text-blue-700',
  acknowledged: 'bg-purple-100 text-purple-700',
  processing: 'bg-amber-100 text-amber-700',
  completed: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
  escalated: 'bg-pink-100 text-pink-700',
};

const STATUS_LABELS = {
  pending: 'In Attesa',
  sent: 'Inviata',
  acknowledged: 'Ricevuta',
  processing: 'In Elaborazione',
  completed: 'Completata',
  rejected: 'Rifiutata',
  escalated: 'Escalation',
};

export default function DMCARequests() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState(null);
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
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-40" />
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
          <h1 className="text-2xl font-bold text-slate-900">Richieste DMCA</h1>
          <p className="text-slate-500 mt-1">{requests.length} richieste totali</p>
        </div>
        <Button 
          onClick={() => { resetForm(); setIsDialogOpen(true); }}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nuova DMCA
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Cerca per numero, destinatario o creator..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Stato" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli stati</SelectItem>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
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
                  <TableHead>Notice #</TableHead>
                  <TableHead>Creator</TableHead>
                  <TableHead>Destinatario</TableHead>
                  <TableHead>Metodo</TableHead>
                  <TableHead>Data Invio</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Follow-up</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.map((request) => (
                  <TableRow key={request.id} className="hover:bg-slate-50">
                    <TableCell className="font-mono text-sm font-medium">
                      {request.notice_number || 'N/D'}
                    </TableCell>
                    <TableCell className="text-sm font-medium text-slate-900">
                      {request.creator_name || 'N/D'}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{request.sent_to_entity || 'N/D'}</p>
                        <p className="text-xs text-slate-500 capitalize">{request.sent_to_type}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm capitalize text-slate-600">
                      {request.method || 'N/D'}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {request.sent_date ? format(new Date(request.sent_date), 'dd/MM/yy') : 'N/D'}
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${STATUS_COLORS[request.status] || 'bg-slate-100'}`}>
                        {STATUS_LABELS[request.status] || request.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {request.follow_up_date && !request.removal_confirmed && (
                        <span className="text-xs text-slate-600 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(new Date(request.follow_up_date), 'dd/MM')}
                        </span>
                      )}
                      {request.removal_confirmed && (
                        <span className="text-xs text-emerald-600 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Rimosso
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(request)}>
                            <Edit className="w-4 h-4 mr-2" />
                            Modifica
                          </DropdownMenuItem>
                          {!request.removal_confirmed && (
                            <DropdownMenuItem onClick={() => confirmRemovalMutation.mutate(request)}>
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Conferma Rimozione
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => deleteMutation.mutate(request.id)}
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
          {filteredRequests.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p>Nessuna richiesta DMCA trovata</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* DMCA Request Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingRequest ? 'Modifica Richiesta DMCA' : 'Nuova Richiesta DMCA'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Leak *</Label>
              <Select 
                value={formData.leak_id} 
                onValueChange={(value) => {
                  const leak = leaks.find(l => l.id === value);
                  setFormData({ 
                    ...formData, 
                    leak_id: value,
                    creator_id: leak?.creator_id || formData.creator_id,
                    sent_to_entity: leak?.hosting_provider || formData.sent_to_entity,
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona leak" />
                </SelectTrigger>
                <SelectContent>
                  {availableLeaks.map(l => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.domain} - {l.creator_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Creator *</Label>
              <Select 
                value={formData.creator_id} 
                onValueChange={(value) => setFormData({ ...formData, creator_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona creator" />
                </SelectTrigger>
                <SelectContent>
                  {creators.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.stage_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Destinatario *</Label>
                <Input
                  value={formData.sent_to_entity}
                  onChange={(e) => setFormData({ ...formData, sent_to_entity: e.target.value })}
                  placeholder="Cloudflare, Namecheap..."
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo Destinatario</Label>
                <Select 
                  value={formData.sent_to_type} 
                  onValueChange={(value) => setFormData({ ...formData, sent_to_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hosting">Hosting</SelectItem>
                    <SelectItem value="registrar">Registrar</SelectItem>
                    <SelectItem value="google">Google</SelectItem>
                    <SelectItem value="cloudflare">Cloudflare</SelectItem>
                    <SelectItem value="platform">Piattaforma</SelectItem>
                    <SelectItem value="other">Altro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Metodo Invio</Label>
                <Select 
                  value={formData.method} 
                  onValueChange={(value) => setFormData({ ...formData, method: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="form">Form Online</SelectItem>
                    <SelectItem value="api">API</SelectItem>
                    <SelectItem value="fax">Fax</SelectItem>
                    <SelectItem value="legal_letter">Lettera Legale</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Template</Label>
                <Select 
                  value={formData.template_used} 
                  onValueChange={(value) => setFormData({ ...formData, template_used: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard_dmca">DMCA Standard</SelectItem>
                    <SelectItem value="google_dmca">Google DMCA</SelectItem>
                    <SelectItem value="cloudflare_abuse">Cloudflare Abuse</SelectItem>
                    <SelectItem value="legal_notice">Diffida Legale</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Note</Label>
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
                <Send className="w-4 h-4 mr-2" />
                {editingRequest ? 'Salva Modifiche' : 'Invia DMCA'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}