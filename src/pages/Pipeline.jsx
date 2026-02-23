import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { format } from 'date-fns';
import { 
  AlertTriangle, 
  ExternalLink, 
  User,
  Clock,
  MoreVertical,
  Send,
  Eye,
  Filter
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { T } from '@/components/utils/theme';
import SendDMCAButton from '@/components/dmca/SendDMCAButton';

const COLUMNS = [
  { id: 'found',       label: 'Trovati',       dot: '#f87171' },
  { id: 'notice_sent', label: 'Notice Inviata', dot: '#fbbf24' },
  { id: 'waiting',     label: 'In Attesa',      dot: '#60a5fa' },
  { id: 'follow_up',   label: 'Follow-up',      dot: '#a78bfa' },
  { id: 'escalated',   label: 'Escalation',     dot: '#f472b6' },
  { id: 'removed',     label: 'Rimossi',        dot: '#34d399' },
];

const SEVERITY_BORDER = {
  critical: '#f87171', high: '#fbbf24', medium: '#eab308', low: '#64748b',
};

export default function Pipeline() {
  const [creatorFilter, setCreatorFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');

  const queryClient = useQueryClient();

  const { data: leaks = [], isLoading } = useQuery({
    queryKey: ['leaks'],
    queryFn: () => base44.entities.Leak.list('-created_date', 500),
  });

  const { data: creators = [] } = useQuery({
    queryKey: ['creators'],
    queryFn: () => base44.entities.Creator.list('-created_date', 200),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Leak.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaks'] });
    },
  });

  const filteredLeaks = leaks.filter(leak => {
    const matchesCreator = creatorFilter === 'all' || leak.creator_id === creatorFilter;
    const matchesSeverity = severityFilter === 'all' || leak.severity === severityFilter;
    return matchesCreator && matchesSeverity && leak.status !== 'rejected';
  });

  const getColumnLeaks = (columnId) => {
    return filteredLeaks.filter(leak => leak.status === columnId);
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    
    const { draggableId, destination } = result;
    const newStatus = destination.droppableId;
    
    const leak = leaks.find(l => l.id === draggableId);
    if (leak && leak.status !== newStatus) {
      const updateData = { status: newStatus };
      
      // Auto-set dates based on status
      if (newStatus === 'notice_sent' && !leak.first_notice_date) {
        updateData.first_notice_date = format(new Date(), 'yyyy-MM-dd');
      }
      if (newStatus === 'removed' && !leak.removal_date) {
        updateData.removal_date = format(new Date(), 'yyyy-MM-dd');
        if (leak.discovery_date) {
          const discovery = new Date(leak.discovery_date);
          const removal = new Date();
          updateData.days_online = Math.ceil((removal - discovery) / (1000 * 60 * 60 * 24));
        }
      }
      
      updateMutation.mutate({ id: draggableId, data: updateData });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" style={{ background: 'rgba(99,102,241,0.1)' }} />
        <div className="flex gap-4 overflow-x-auto">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-96 w-72 flex-shrink-0 rounded-xl" style={{ background: 'rgba(99,102,241,0.1)' }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: T.text }}>DMCA Pipeline</h1>
          <p style={{ color: T.textMuted, fontSize: 14, marginTop: 2 }}>{filteredLeaks.length} leak in gestione</p>
        </div>
        <div className="flex gap-3">
          <Select value={creatorFilter} onValueChange={setCreatorFilter}>
            <SelectTrigger className="w-48" style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.2)', color: T.text }}>
              <SelectValue placeholder="Filtra creator" />
            </SelectTrigger>
            <SelectContent style={{ background: '#0f172a', border: '1px solid rgba(99,102,241,0.2)' }}>
              <SelectItem value="all">Tutti i creator</SelectItem>
              {creators.map(c => <SelectItem key={c.id} value={c.id}>{c.stage_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-40" style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.2)', color: T.text }}>
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
      </div>

      {/* Kanban Board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((column) => {
            const columnLeaks = getColumnLeaks(column.id);
            return (
              <div key={column.id} className="flex-shrink-0 w-72">
                <div style={{ background: '#0a1120', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 12, padding: 12 }}>
                  {/* Column Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: column.dot, flexShrink: 0 }} />
                      <h3 className="font-semibold text-sm" style={{ color: T.text }}>{column.label}</h3>
                    </div>
                    <span style={{ background: 'rgba(99,102,241,0.15)', color: T.indigoSoft, padding: '1px 8px', borderRadius: 5, fontSize: 11, fontWeight: 600 }}>
                      {columnLeaks.length}
                    </span>
                  </div>

                  {/* Droppable Area */}
                  <Droppable droppableId={column.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className="space-y-2 transition-colors rounded-lg p-1"
                        style={{ minHeight: 400, background: snapshot.isDraggingOver ? 'rgba(99,102,241,0.06)' : 'transparent' }}
                      >
                        {columnLeaks.map((leak, index) => (
                          <Draggable key={leak.id} draggableId={leak.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                style={{
                                  ...provided.draggableProps.style,
                                  background: '#0f172a',
                                  borderRadius: 8,
                                  borderLeft: `3px solid ${SEVERITY_BORDER[leak.severity] || SEVERITY_BORDER.low}`,
                                  boxShadow: snapshot.isDragging ? '0 8px 24px rgba(0,0,0,0.4)' : '0 1px 4px rgba(0,0,0,0.3)',
                                  transform: snapshot.isDragging ? `${provided.draggableProps.style?.transform} rotate(1deg)` : provided.draggableProps.style?.transform,
                                }}
                              >
                                <div className="p-3">
                                  <div className="flex items-start justify-between mb-2">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium truncate" style={{ color: T.text }}>{leak.domain}</p>
                                      <a href={leak.leak_url} target="_blank" rel="noopener noreferrer"
                                        className="text-xs hover:underline flex items-center gap-1" style={{ color: '#60a5fa' }}
                                        onClick={(e) => e.stopPropagation()}>
                                        Apri URL <ExternalLink className="w-3 h-3" />
                                      </a>
                                    </div>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 -mr-1 hover:bg-white/5">
                                          <MoreVertical className="w-3 h-3" style={{ color: T.textMuted }} />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end" style={{ background: '#0f172a', border: '1px solid rgba(99,102,241,0.2)' }}>
                                      <DropdownMenuItem><Eye className="w-3 h-3 mr-2" />Dettagli</DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>

                                  <div className="flex items-center gap-2 text-xs mb-2" style={{ color: T.textMuted }}>
                                    <User className="w-3 h-3" />
                                    <span className="truncate">{leak.creator_name || 'N/D'}</span>
                                  </div>

                                  <div className="flex items-center justify-between">
                                    <span style={{
                                      background: `${SEVERITY_BORDER[leak.severity]}22`,
                                      color: SEVERITY_BORDER[leak.severity] || T.textMuted,
                                      padding: '1px 7px', borderRadius: 4, fontSize: 10, fontWeight: 600, textTransform: 'capitalize'
                                    }}>
                                      {leak.severity}
                                    </span>
                                    {leak.discovery_date && (
                                      <span className="flex items-center gap-1" style={{ fontSize: 10, color: T.textMuted }}>
                                        <Clock className="w-3 h-3" />
                                        {format(new Date(leak.discovery_date), 'dd/MM')}
                                      </span>
                                    )}
                                  </div>

                                  {(leak.damage_score || 0) >= 70 && (
                                    <div className="mt-2 flex items-center gap-1" style={{ fontSize: 10, color: '#f87171' }}>
                                      <AlertTriangle className="w-3 h-3" />
                                      Score {Math.round(leak.damage_score)}
                                    </div>
                                  )}
                                  {leak.status === 'found' && (
                                    <div className="mt-2">
                                      <SendDMCAButton leak={leak} onSuccess={() => queryClient.invalidateQueries({ queryKey: ['leaks'] })} />
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              </div>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
}