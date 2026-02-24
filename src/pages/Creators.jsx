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
import { T, cardStyle, RISK_DARK, calcEstimatedLoss, calcRiskScore, riskLevel, VMC_TIER, CURRENCY } from '@/components/utils/theme';
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
    onlyfans_url: '',
    monthly_revenue: '',
    creator_tier: 'medium',
    content_value: '',
    ltv_mean_fan: '',
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
      onlyfans_url: '',
      monthly_revenue: '',
      creator_tier: 'medium',
      content_value: '',
      ltv_mean_fan: '',
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
    // Extract OF username to build avatar initials-based placeholder
    // OnlyFans avatars require auth — use ui-avatars as fallback with stage name
    const existingProfileImage = editingCreator?.profile_image || '';
    let profileImage = existingProfileImage;
    if (formData.onlyfans_url) {
      const match = formData.onlyfans_url.match(/onlyfans\.com\/([^/?#]+)/);
      if (match) {
        const username = match[1];
        // Use a public avatar service with the OF username
        profileImage = `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.stage_name || username)}&background=6366f1&color=fff&size=128&bold=true`;
      }
    }
    const data = {
      ...formData,
      monthly_revenue: formData.monthly_revenue ? parseFloat(formData.monthly_revenue) : 0,
      content_value: formData.content_value ? parseFloat(formData.content_value) : null,
      ltv_mean_fan: formData.ltv_mean_fan ? parseFloat(formData.ltv_mean_fan) : null,
      ...(profileImage && { profile_image: profileImage }),
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
      onlyfans_url: creator.onlyfans_url || '',
      monthly_revenue: creator.monthly_revenue?.toString() || '',
      creator_tier: creator.creator_tier || 'medium',
      content_value: creator.content_value?.toString() || '',
      ltv_mean_fan: creator.ltv_mean_fan?.toString() || '',
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
          <Skeleton className="h-8 w-32" style={{ background: 'rgba(99,102,241,0.1)' }} />
          <Skeleton className="h-10 w-36" style={{ background: 'rgba(99,102,241,0.1)' }} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" style={{ background: 'rgba(99,102,241,0.1)' }} />
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
          <h1 className="text-2xl font-bold" style={{ color: T.text }}>Creators</h1>
          <p style={{ color: T.textMuted, fontSize: 14, marginTop: 2 }}>{creators.length} creator gestiti</p>
        </div>
        <Button 
          onClick={() => { resetForm(); setIsDialogOpen(true); }}
          style={{ background: 'linear-gradient(135deg,#6366f1,#3b82f6)', color: '#fff', border: 'none' }}
        >
          <Plus className="w-4 h-4 mr-2" />
          Nuovo Creator
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: T.textMuted }} />
          <Input
            placeholder="Cerca per nome o email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.2)', color: T.text }}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40" style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.2)', color: T.text }}>
            <SelectValue placeholder="Stato" />
          </SelectTrigger>
          <SelectContent style={{ background: '#0f172a', border: '1px solid rgba(99,102,241,0.2)' }}>
            <SelectItem value="all">Tutti gli stati</SelectItem>
            <SelectItem value="active">Attivo</SelectItem>
            <SelectItem value="inactive">Inattivo</SelectItem>
            <SelectItem value="paused">In pausa</SelectItem>
          </SelectContent>
        </Select>
        <Select value={riskFilter} onValueChange={setRiskFilter}>
          <SelectTrigger className="w-full sm:w-40" style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.2)', color: T.text }}>
            <SelectValue placeholder="Rischio" />
          </SelectTrigger>
          <SelectContent style={{ background: '#0f172a', border: '1px solid rgba(99,102,241,0.2)' }}>
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
        {filteredCreators.map((creator) => {
          const risk = RISK_DARK[creator.risk_level] || RISK_DARK.low;
          const estimatedLoss = creator.estimated_loss || 0;
          const docComplete = creator.doc_front_url && creator.doc_back_url && creator.doc_selfie_url;
          return (
            <div key={creator.id} style={{ ...cardStyle, padding: 20 }} className="transition-all hover:border-indigo-500/30">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div style={{ width: 44, height: 44, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: 'linear-gradient(135deg,#4f46e5,#3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {creator.profile_image ? (
                      <img src={creator.profile_image} alt={creator.stage_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                    ) : null}
                    <span style={{ color: '#fff', fontWeight: 700, fontSize: 16, display: creator.profile_image ? 'none' : 'flex' }}>
                      {creator.stage_name?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold" style={{ color: T.text }}>{creator.stage_name}</h3>
                    <p className="text-sm" style={{ color: T.textMuted }}>{creator.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {docComplete ? (
                    <ShieldCheck className="w-4 h-4" style={{ color: '#34d399' }} title="Documenti verificati" />
                  ) : (
                    <ShieldAlert className="w-4 h-4" style={{ color: '#fbbf24' }} title="Documenti mancanti" />
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/5">
                        <MoreVertical className="w-4 h-4" style={{ color: T.textMuted }} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" style={{ background: '#0f172a', border: '1px solid rgba(99,102,241,0.2)' }}>
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
                      <DropdownMenuItem onClick={() => deleteMutation.mutate(creator.id)}>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Elimina
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: T.textMuted }}>Risk Score</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold" style={{ color: risk.color }}>
                      {Math.round(creator.risk_score || 0)}
                    </span>
                    <span style={{ background: risk.bg, color: risk.color, border: `1px solid ${risk.border}`, padding: '1px 8px', borderRadius: 5, fontSize: 11, fontWeight: 600 }}>
                      {risk.label}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: T.textMuted }}>Leak Attivi</span>
                  <span className="text-sm font-semibold flex items-center gap-1" style={{ color: T.text }}>
                    {creator.active_leaks || 0}
                    {(creator.active_leaks || 0) > 5 && (
                      <AlertTriangle className="w-3.5 h-3.5" style={{ color: '#fbbf24' }} />
                    )}
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm" style={{ color: T.textMuted }}>Tasso Rimozione</span>
                    <span className="text-sm font-semibold" style={{ color: T.text }}>
                      {Math.round(creator.removal_rate || 0)}%
                    </span>
                  </div>
                  <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${creator.removal_rate || 0}%`, height: '100%', background: 'linear-gradient(90deg,#6366f1,#10b981)', borderRadius: 2, transition: 'width 0.5s' }} />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2" style={{ borderTop: '1px solid rgba(99,102,241,0.1)' }}>
                  <span className="text-sm flex items-center gap-1" style={{ color: '#f87171' }}>
                    <TrendingDown className="w-3.5 h-3.5" />
                    Perdita Stimata
                  </span>
                  <span className="text-sm font-bold" style={{ color: '#f87171' }}>
                    ${estimatedLoss >= 1000 ? `${(estimatedLoss/1000).toFixed(1)}k` : Math.round(estimatedLoss)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredCreators.length === 0 && (
        <div className="text-center py-12">
          <Users className="w-12 h-12 mx-auto mb-4" style={{ color: 'rgba(99,102,241,0.3)' }} />
          <h3 className="text-lg font-medium" style={{ color: T.text }}>Nessun creator trovato</h3>
          <p style={{ color: T.textMuted }}>Prova a modificare i filtri o aggiungi un nuovo creator</p>
        </div>
      )}

      {/* Creator Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent style={{ background: '#0f172a', border: '1px solid rgba(99,102,241,0.2)', color: T.text, maxHeight: '90vh', overflowY: 'auto' }} className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle style={{ color: T.text }}>
              {editingCreator ? 'Modifica Creator' : 'Nuovo Creator'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Avatar upload */}
            <div className="space-y-2">
              <Label style={{ color: T.textMuted, fontSize: 12 }}>Immagine Profilo</Label>
              <div className="flex items-center gap-4">
                <div style={{ width: 56, height: 56, borderRadius: 10, overflow: 'hidden', background: 'linear-gradient(135deg,#4f46e5,#3b82f6)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {formData.profile_image ? (
                    <img src={formData.profile_image} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ color: '#fff', fontWeight: 700, fontSize: 20 }}>
                      {formData.stage_name?.charAt(0).toUpperCase() || '?'}
                    </span>
                  )}
                </div>
                <div className="flex-1">
                  <DocUploadField
                    label="Carica immagine"
                    value={formData.profile_image}
                    onChange={(url) => setFormData({ ...formData, profile_image: url })}
                  />
                </div>
              </div>
            </div>

            {/* Base info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label style={{ color: T.textMuted, fontSize: 12 }}>Nome Legale *</Label>
                <Input value={formData.legal_name}
                  onChange={(e) => setFormData({ ...formData, legal_name: e.target.value })}
                  required style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.2)', color: T.text }} />
              </div>
              <div className="space-y-2">
                <Label style={{ color: T.textMuted, fontSize: 12 }}>Stage Name *</Label>
                <Input value={formData.stage_name}
                  onChange={(e) => setFormData({ ...formData, stage_name: e.target.value })}
                  required style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.2)', color: T.text }} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label style={{ color: T.textMuted, fontSize: 12 }}>Email *</Label>
                <Input type="email" value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.2)', color: T.text }} />
              </div>
              <div className="space-y-2">
                <Label style={{ color: T.textMuted, fontSize: 12 }}>Stato</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                  <SelectTrigger style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.2)', color: T.text }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent style={{ background: '#0f172a', border: '1px solid rgba(99,102,241,0.2)' }}>
                    <SelectItem value="active">Attivo</SelectItem>
                    <SelectItem value="inactive">Inattivo</SelectItem>
                    <SelectItem value="paused">In pausa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Economic tier */}
            <div style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 8, padding: '14px' }} className="space-y-3">
              <p style={{ color: T.indigoSoft, fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>📊 Parametri Economic Impact Engine</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label style={{ color: T.textMuted, fontSize: 12 }}>Tier Creator</Label>
                  <Select value={formData.creator_tier} onValueChange={(v) => setFormData({ ...formData, creator_tier: v })}>
                    <SelectTrigger style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.2)', color: T.text }}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent style={{ background: '#0f172a', border: '1px solid rgba(99,102,241,0.2)' }}>
                      <SelectItem value="low">Basso (VMC ${VMC_TIER.low})</SelectItem>
                      <SelectItem value="medium">Medio (VMC ${VMC_TIER.medium})</SelectItem>
                      <SelectItem value="high">Alto (VMC ${VMC_TIER.high})</SelectItem>
                      <SelectItem value="vip">VIP (VMC ${VMC_TIER.vip})</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                   <Label style={{ color: T.textMuted, fontSize: 12 }}>Valore Personalizzato ($)</Label>
                   <Input type="number" value={formData.content_value}
                     onChange={(e) => setFormData({ ...formData, content_value: e.target.value })}
                     placeholder="Sovrascrive il tier"
                     style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.2)', color: T.text }} />
                 </div>
                 <div className="space-y-2">
                   <Label style={{ color: T.textMuted, fontSize: 12 }}>LTV Media Fan ($)</Label>
                   <Input type="number" value={formData.ltv_mean_fan}
                     onChange={(e) => setFormData({ ...formData, ltv_mean_fan: e.target.value })}
                     placeholder="Lifetime Value per fan"
                     style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.2)', color: T.text }} />
                 </div>
              </div>
            </div>

            {/* Documents */}
            <div style={{ background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: 8, padding: '14px' }} className="space-y-3">
              <p style={{ color: '#34d399', fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>🪪 Documenti Identità (obbligatori per DMCA)</p>
              <DocUploadField label="Documento Fronte" value={formData.doc_front_url}
                onChange={(url) => setFormData({ ...formData, doc_front_url: url })} required />
              <DocUploadField label="Documento Retro" value={formData.doc_back_url}
                onChange={(url) => setFormData({ ...formData, doc_back_url: url })} required />
              <DocUploadField label="Selfie con Documento" value={formData.doc_selfie_url}
                onChange={(url) => setFormData({ ...formData, doc_selfie_url: url })} required />
            </div>

            <div className="space-y-2">
              <Label style={{ color: T.textMuted, fontSize: 12 }}>Note</Label>
              <Textarea value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.2)', color: T.text }} />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}
                style={{ borderColor: 'rgba(99,102,241,0.3)', color: T.textMuted, background: 'transparent' }}>
                Annulla
              </Button>
              <Button type="submit" style={{ background: 'linear-gradient(135deg,#6366f1,#3b82f6)', color: '#fff', border: 'none' }}>
                {editingCreator ? 'Salva Modifiche' : 'Crea Creator'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}