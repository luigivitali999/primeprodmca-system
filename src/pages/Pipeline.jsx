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
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-4 overflow-x-auto">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-96 w-72 flex-shrink-0 rounded-xl" />
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
          <h1 className="text-2xl font-bold text-slate-900">DMCA Pipeline</h1>
          <p className="text-slate-500 mt-1">{filteredLeaks.length} leak in gestione</p>
        </div>
        <div className="flex gap-3">
          <Select value={creatorFilter} onValueChange={setCreatorFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filtra creator" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti i creator</SelectItem>
              {creators.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.stage_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-40">
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
      </div>

      {/* Kanban Board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((column) => {
            const columnLeaks = getColumnLeaks(column.id);
            return (
              <div key={column.id} className="flex-shrink-0 w-72">
                <div className="bg-slate-100 rounded-xl p-3">
                  {/* Column Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${column.color}`} />
                      <h3 className="font-semibold text-slate-900 text-sm">{column.label}</h3>
                    </div>
                    <Badge variant="secondary" className="bg-white text-slate-600">
                      {columnLeaks.length}
                    </Badge>
                  </div>

                  {/* Droppable Area */}
                  <Droppable droppableId={column.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`min-h-[400px] space-y-2 transition-colors rounded-lg p-1 ${
                          snapshot.isDraggingOver ? 'bg-blue-50' : ''
                        }`}
                      >
                        {columnLeaks.map((leak, index) => (
                          <Draggable key={leak.id} draggableId={leak.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`bg-white rounded-lg border-l-4 shadow-sm hover:shadow transition-shadow ${
                                  SEVERITY_COLORS[leak.severity] || SEVERITY_COLORS.low
                                } ${snapshot.isDragging ? 'shadow-lg rotate-1' : ''}`}
                              >
                                <div className="p-3">
                                  <div className="flex items-start justify-between mb-2">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-slate-900 truncate">
                                        {leak.domain}
                                      </p>
                                      <a 
                                        href={leak.leak_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        Apri URL
                                        <ExternalLink className="w-3 h-3" />
                                      </a>
                                    </div>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 -mr-1">
                                          <MoreVertical className="w-3 h-3" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem>
                                          <Eye className="w-3 h-3 mr-2" />
                                          Dettagli
                                        </DropdownMenuItem>
                                        <DropdownMenuItem>
                                          <Send className="w-3 h-3 mr-2" />
                                          Invia DMCA
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>

                                  <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                                    <User className="w-3 h-3" />
                                    <span className="truncate">{leak.creator_name || 'N/D'}</span>
                                  </div>

                                  <div className="flex items-center justify-between">
                                    <Badge 
                                      variant="outline" 
                                      className={`text-[10px] capitalize ${
                                        leak.severity === 'critical' ? 'bg-red-50 text-red-700 border-red-200' :
                                        leak.severity === 'high' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                        'bg-slate-50 text-slate-600'
                                      }`}
                                    >
                                      {leak.severity}
                                    </Badge>
                                    {leak.discovery_date && (
                                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {format(new Date(leak.discovery_date), 'dd/MM')}
                                      </span>
                                    )}
                                  </div>

                                  {leak.damage_score >= 70 && (
                                    <div className="mt-2 flex items-center gap-1 text-[10px] text-red-600">
                                      <AlertTriangle className="w-3 h-3" />
                                      Score {Math.round(leak.damage_score)}
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