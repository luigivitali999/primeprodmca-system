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

const STATUS_COLORS = {
  found: 'bg-red-100 text-red-700',
  notice_sent: 'bg-amber-100 text-amber-700',
  waiting: 'bg-blue-100 text-blue-700',
  follow_up: 'bg-purple-100 text-purple-700',
  escalated: 'bg-pink-100 text-pink-700',
  removed: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-slate-100 text-slate-700',
};

const STATUS_LABELS = {
  found: 'Trovato',
  notice_sent: 'Notice Inviata',
  waiting: 'In Attesa',
  follow_up: 'Follow-up',
  escalated: 'Escalation',
  removed: 'Rimosso',
  rejected: 'Rifiutato',
};

const SEVERITY_COLORS = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-amber-100 text-amber-700 border-amber-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-slate-100 text-slate-700 border-slate-200',
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
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-36" />
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
          <h1 className="text-2xl font-bold text-slate-900">Leaks</h1>
          <p className="text-slate-500 mt-1">{leaks.length} leak tracciati</p>
        </div>
        <Button 
          onClick={() => { resetForm(); setIsDialogOpen(true); }}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nuovo Leak
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Cerca per URL, dominio o creator..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={creatorFilter} onValueChange={setCreatorFilter}>
          <SelectTrigger className="w-full lg:w-48">
            <SelectValue placeholder="Creator" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i creator</SelectItem>
            {creators.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.stage_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full lg:w-40">
            <SelectValue placeholder="Stato" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli stati</SelectItem>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-full lg:w-40">
            <SelectValue placeholder="Severità" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte</SelectItem>
            <SelectItem value="critical">Critica</SelectItem>
            <SelectItem value="high">Alta</SelectItem>
            <SelectItem value="medium">Media</SelectItem>
            <SelectItem value="low">Bassa</SelectItem>
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
                  <TableHead className="w-[250px]">URL / Dominio</TableHead>
                  <TableHead>Creator</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Severità</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Scoperto</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeaks.slice(0, 100).map((leak) => (
                  <TableRow key={leak.id} className="hover:bg-slate-50">
                    <TableCell>
                      <div className="max-w-[250px]">
                        <p className="font-medium text-slate-900 truncate">{leak.domain}</p>
                        <div className="flex items-center gap-1">
                          <a 
                            href={leak.leak_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline truncate"
                          >
                            {leak.leak_url?.substring(0, 40)}...
                          </a>
                          <ExternalLink className="w-3 h-3 text-blue-600 flex-shrink-0" />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium text-slate-900">{leak.creator_name || 'N/D'}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm capitalize text-slate-600">{leak.content_type || 'N/D'}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs capitalize ${SEVERITY_COLORS[leak.severity] || SEVERITY_COLORS.low}`}>
                        {leak.severity || 'N/D'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${STATUS_COLORS[leak.status] || 'bg-slate-100'}`}>
                        {STATUS_LABELS[leak.status] || leak.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {leak.discovery_date ? format(new Date(leak.discovery_date), 'dd/MM/yy') : 'N/D'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <span className="font-semibold text-slate-900">{Math.round(leak.damage_score || 0)}</span>
                        {leak.damage_score >= 70 && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(leak)}>
                            <Edit className="w-4 h-4 mr-2" />
                            Modifica
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Send className="w-4 h-4 mr-2" />
                            Invia DMCA
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => deleteMutation.mutate(leak.id)}
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
          {filteredLeaks.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <AlertTriangle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p>Nessun leak trovato</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Leak Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingLeak ? 'Modifica Leak' : 'Nuovo Leak'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
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

            <div className="space-y-2">
              <Label>URL Leak *</Label>
              <Input
                value={formData.leak_url}
                onChange={(e) => {
                  const url = e.target.value;
                  setFormData({ 
                    ...formData, 
                    leak_url: url,
                    domain: extractDomain(url) || formData.domain
                  });
                }}
                placeholder="https://..."
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Dominio</Label>
                <Input
                  value={formData.domain}
                  onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Hosting Provider</Label>
                <Input
                  value={formData.hosting_provider}
                  onChange={(e) => setFormData({ ...formData, hosting_provider: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Registrar</Label>
                <Input
                  value={formData.registrar}
                  onChange={(e) => setFormData({ ...formData, registrar: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Paese</Label>
                <Input
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  placeholder="US, DE, NL..."
                />
              </div>
              <div className="space-y-2">
                <Label>Views Stimate</Label>
                <Input
                  type="number"
                  value={formData.estimated_views}
                  onChange={(e) => setFormData({ ...formData, estimated_views: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Tipo Contenuto</Label>
                <Select 
                  value={formData.content_type} 
                  onValueChange={(value) => setFormData({ ...formData, content_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="video">Video</SelectItem>
                    <SelectItem value="gallery">Gallery</SelectItem>
                    <SelectItem value="mega">Mega</SelectItem>
                    <SelectItem value="torrent">Torrent</SelectItem>
                    <SelectItem value="forum">Forum</SelectItem>
                    <SelectItem value="telegram">Telegram</SelectItem>
                    <SelectItem value="other">Altro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Rilevato da</Label>
                <Select 
                  value={formData.detected_by} 
                  onValueChange={(value) => setFormData({ ...formData, detected_by: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manuale</SelectItem>
                    <SelectItem value="scraping">Scraping</SelectItem>
                    <SelectItem value="tool">Tool</SelectItem>
                    <SelectItem value="report">Segnalazione</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Severità</Label>
                <Select 
                  value={formData.severity} 
                  onValueChange={(value) => setFormData({ ...formData, severity: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critical">Critica</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="medium">Media</SelectItem>
                    <SelectItem value="low">Bassa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="google_indexed"
                checked={formData.google_indexed}
                onCheckedChange={(checked) => setFormData({ ...formData, google_indexed: checked })}
              />
              <Label htmlFor="google_indexed" className="text-sm font-normal">
                Indicizzato su Google
              </Label>
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
                {editingLeak ? 'Salva Modifiche' : 'Crea Leak'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}