import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, ExternalLink, Clock, Globe, AlertTriangle } from "lucide-react";

const CONTENT_TYPE_LABELS = {
  video: "Video",
  gallery: "Gallery",
  mega: "MEGA",
  torrent: "Torrent",
  forum: "Forum",
  telegram: "Telegram",
  other: "Altro",
};

function generateNoticeNumber() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PRIME-${ts}-${rand}`;
}

export default function PendingApprovals() {
  const queryClient = useQueryClient();
  const [processing, setProcessing] = useState(null);

  const { data: pending = [], isLoading } = useQuery({
    queryKey: ["pending_approvals"],
    queryFn: () => base44.entities.PendingApproval.filter({ status: "pending" }, "-created_date"),
  });

  const approveMutation = useMutation({
    mutationFn: async (item) => {
      setProcessing(item.id);

      // 1. Create Leak
      const leak = await base44.entities.Leak.create({
        creator_id: item.creator_id,
        creator_name: item.creator_name,
        leak_url: item.leak_url,
        domain: item.domain,
        content_type: item.content_type || "other",
        discovery_date: item.discovery_date || new Date().toISOString().split("T")[0],
        detected_by: "scraping",
        severity: "high",
        status: "found",
      });

      // 2. Add domain to DomainIntelligence if not already there
      const existing = await base44.entities.DomainIntelligence.filter({ domain_name: item.domain });
      let domainEntry = existing[0];
      if (!domainEntry) {
        domainEntry = await base44.entities.DomainIntelligence.create({
          domain_name: item.domain,
          last_updated: new Date().toISOString().split("T")[0],
        });
      }

      // 3. Create DMCARequest (pending — abuse email might not be known yet)
      const noticeNumber = generateNoticeNumber();
      const dmcaReq = await base44.entities.DMCARequest.create({
        leak_id: leak.id,
        creator_id: item.creator_id,
        creator_name: item.creator_name,
        notice_number: noticeNumber,
        sent_to_entity: item.domain,
        sent_to_type: "hosting",
        method: "email",
        status: "pending",
        escalation_level: 0,
        follow_up_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      });

      // 4. Update PendingApproval
      await base44.entities.PendingApproval.update(item.id, {
        status: "approved",
        reviewed_date: new Date().toISOString().split("T")[0],
        leak_id: leak.id,
        dmca_request_id: dmcaReq.id,
      });
    },
    onSuccess: () => {
      setProcessing(null);
      queryClient.invalidateQueries({ queryKey: ["pending_approvals"] });
    },
    onError: () => setProcessing(null),
  });

  const rejectMutation = useMutation({
    mutationFn: async (item) => {
      await base44.entities.PendingApproval.update(item.id, {
        status: "rejected",
        reviewed_date: new Date().toISOString().split("T")[0],
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pending_approvals"] }),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Approvazioni Pendenti</h1>
        <p className="text-slate-400 text-sm mt-1">
          Leak trovati su nuovi domini — approva per creare il leak e la DMCA, rifiuta per ignorare.
        </p>
      </div>

      {/* Count badge */}
      {pending.length > 0 && (
        <div
          className="flex items-center gap-2 px-4 py-3 rounded-lg"
          style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)" }}
        >
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <span className="text-amber-300 text-sm font-medium">
            {pending.length} leak{pending.length !== 1 ? "s" : ""} in attesa di revisione
          </span>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="text-slate-400 text-sm">Caricamento...</div>
      ) : pending.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-16 rounded-xl"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <CheckCircle className="w-10 h-10 text-emerald-500 mb-3" />
          <p className="text-white font-medium">Nessuna approvazione pendente</p>
          <p className="text-slate-500 text-sm mt-1">Tutti i leak trovati sono stati revisionati.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pending.map((item) => (
            <div
              key={item.id}
              className="rounded-xl p-5"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <div className="flex flex-col md:flex-row md:items-start gap-4">
                {/* Info */}
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-semibold">{item.creator_name}</span>
                    <Badge
                      style={{
                        background: "rgba(99,102,241,0.15)",
                        color: "#a5b4fc",
                        border: "1px solid rgba(99,102,241,0.25)",
                      }}
                    >
                      {CONTENT_TYPE_LABELS[item.content_type] || item.content_type}
                    </Badge>
                    <Badge
                      style={{
                        background: "rgba(245,158,11,0.1)",
                        color: "#fcd34d",
                        border: "1px solid rgba(245,158,11,0.2)",
                      }}
                    >
                      Nuovo dominio
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Globe className="w-3.5 h-3.5" />
                    <span className="font-mono text-slate-300">{item.domain}</span>
                  </div>

                  <a
                    href={item.leak_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 break-all"
                  >
                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                    {item.leak_url}
                  </a>

                  {item.search_context && (
                    <p className="text-xs text-slate-500 italic">"{item.search_context}"</p>
                  )}

                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Clock className="w-3 h-3" />
                    Trovato il {item.discovery_date || item.created_date?.split("T")[0]}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    disabled={processing === item.id}
                    onClick={() => approveMutation.mutate(item)}
                    style={{
                      background: "rgba(16,185,129,0.15)",
                      border: "1px solid rgba(16,185,129,0.3)",
                      color: "#34d399",
                    }}
                    className="hover:opacity-80"
                  >
                    <CheckCircle className="w-4 h-4" />
                    {processing === item.id ? "..." : "Approva"}
                  </Button>
                  <Button
                    size="sm"
                    disabled={processing === item.id}
                    onClick={() => rejectMutation.mutate(item)}
                    style={{
                      background: "rgba(239,68,68,0.1)",
                      border: "1px solid rgba(239,68,68,0.25)",
                      color: "#f87171",
                    }}
                    className="hover:opacity-80"
                  >
                    <XCircle className="w-4 h-4" />
                    Rifiuta
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}