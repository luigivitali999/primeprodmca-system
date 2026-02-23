import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  Plus, 
  Search, 
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  AlertTriangle,
  TrendingDown,
  Users,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';
import DocUploadField from '@/components/creators/DocUploadField';
import { T, cardStyle, RISK_DARK, calcEstimatedLoss, calcRiskScore, riskLevel, VMC_TIER } from '@/components/utils/theme';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { Skeleton } from "@/components/ui/skeleton";



export default function Creators() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCreator, setEditingCreator] = useState(null);
  const [formData, setFormData] = useState({
    legal_name: '',
    stage_name: '',
    email: '',
    monthly_revenue: '',
    creator_tier: 'medium',
    content_value: '',
    status: 'active',
    notes: '',
    doc_front_url: '',
    doc_back_url: '',
    doc_selfie_url: '',
    doc_verified: false,
  });

  const queryClient = useQueryClient();

  const { data: creators = [], isLoading } = useQuery({
    queryKey: ['creators'],
    queryFn: () => base44.entities.Creator.list('-created_date', 200),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Creator.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creators'] });
      setIsDialogOpen(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Creator.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creators'] });
      setIsDialogOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Creator.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creators'] });
    },
  });

  const resetForm = () => {
    setFormData({
      legal_name: '',
      stage_name: '',
      email: '',
      monthly_revenue: '',
      creator_tier: 'medium',
      content_value: '',
      status: 'active',
      notes: '',
      doc_front_url: '',
      doc_back_url: '',
      doc_selfie_url: '',
      doc_verified: false,
    });
    setEditingCreator(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      ...formData,
      monthly_revenue: formData.monthly_revenue ? parseFloat(formData.monthly_revenue) : 0,
      content_value: formData.content_value ? parseFloat(formData.content_value) : null,
    };

    if (editingCreator) {
      updateMutation.mutate({ id: editingCreator.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (creator) => {
    setEditingCreator(creator);
    setFormData({
      legal_name: creator.legal_name || '',
      stage_name: creator.stage_name || '',
      email: creator.email || '',
      monthly_revenue: creator.monthly_revenue?.toString() || '',
      creator_tier: creator.creator_tier || 'medium',
      content_value: creator.content_value?.toString() || '',
      status: creator.status || 'active',
      notes: creator.notes || '',
      doc_front_url: creator.doc_front_url || '',
      doc_back_url: creator.doc_back_url || '',
      doc_selfie_url: creator.doc_selfie_url || '',
      doc_verified: creator.doc_verified || false,
    });
    setIsDialogOpen(true);
  };

  const filteredCreators = creators.filter(creator => {
    const matchesSearch = 
      creator.stage_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      creator.legal_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      creator.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || creator.status === statusFilter;
    const matchesRisk = riskFilter === 'all' || creator.risk_level === riskFilter;
    return matchesSearch && matchesStatus && matchesRisk;
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-36" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Creators</h1>
          <p className="text-slate-500 mt-1">{creators.length} creator gestiti</p>
        </div>
        <Button 
          onClick={() => { resetForm(); setIsDialogOpen(true); }}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nuovo Creator
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Cerca per nome o email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Stato" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli stati</SelectItem>
            <SelectItem value="active">Attivo</SelectItem>
            <SelectItem value="inactive">Inattivo</SelectItem>
            <SelectItem value="paused">In pausa</SelectItem>
          </SelectContent>
        </Select>
        <Select value={riskFilter} onValueChange={setRiskFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Rischio" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i livelli</SelectItem>
            <SelectItem value="critical">Critico</SelectItem>
            <SelectItem value="high">Alto</SelectItem>
            <SelectItem value="medium">Medio</SelectItem>
            <SelectItem value="low">Basso</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Creators Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCreators.map((creator) => (
          <Card key={creator.id} className="bg-white border-0 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12 bg-gradient-to-br from-blue-500 to-indigo-600">
                    <AvatarFallback className="text-white font-semibold">
                      {creator.stage_name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold text-slate-900">{creator.stage_name}</h3>
                    <p className="text-sm text-slate-500">{creator.email}</p>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link to={createPageUrl(`CreatorDetail?id=${creator.id}`)}>
                        <Eye className="w-4 h-4 mr-2" />
                        Visualizza
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleEdit(creator)}>
                      <Edit className="w-4 h-4 mr-2" />
                      Modifica
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => deleteMutation.mutate(creator.id)}
                      className="text-red-600"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Elimina
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Risk Score</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">
                      {Math.round(creator.risk_score || 0)}
                    </span>
                    <Badge variant="outline" className={`text-xs ${RISK_COLORS[creator.risk_level] || RISK_COLORS.low}`}>
                      {RISK_LABELS[creator.risk_level] || 'N/D'}
                    </Badge>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Leak Attivi</span>
                  <span className="text-sm font-semibold text-slate-900 flex items-center gap-1">
                    {creator.active_leaks || 0}
                    {(creator.active_leaks || 0) > 5 && (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    )}
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-500">Tasso Rimozione</span>
                    <span className="text-sm font-semibold text-slate-900">
                      {Math.round(creator.removal_rate || 0)}%
                    </span>
                  </div>
                  <Progress value={creator.removal_rate || 0} className="h-1.5" />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-sm text-slate-500">Revenue Mensile</span>
                  <span className="text-sm font-semibold text-slate-900">
                    €{(creator.monthly_revenue || 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredCreators.length === 0 && (
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-1">Nessun creator trovato</h3>
          <p className="text-slate-500">Prova a modificare i filtri o aggiungi un nuovo creator</p>
        </div>
      )}

      {/* Creator Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingCreator ? 'Modifica Creator' : 'Nuovo Creator'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome Legale *</Label>
                <Input
                  value={formData.legal_name}
                  onChange={(e) => setFormData({ ...formData, legal_name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Stage Name *</Label>
                <Input
                  value={formData.stage_name}
                  onChange={(e) => setFormData({ ...formData, stage_name: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Revenue Mensile (€)</Label>
                <Input
                  type="number"
                  value={formData.monthly_revenue}
                  onChange={(e) => setFormData({ ...formData, monthly_revenue: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Stato</Label>
              <Select 
                value={formData.status} 
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Attivo</SelectItem>
                  <SelectItem value="inactive">Inattivo</SelectItem>
                  <SelectItem value="paused">In pausa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Note</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Annulla
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                {editingCreator ? 'Salva Modifiche' : 'Crea Creator'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}