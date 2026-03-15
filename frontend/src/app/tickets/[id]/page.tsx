'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import api from '@/lib/api';
import { unwrap, timeAgo, formatDate } from '@/lib/utils';
import { getStoredAuth, STATUS_LABELS, STATUS_COLORS, PRIORITY_LABELS, PRIORITY_COLORS } from '@/lib/auth';
import { toast } from '@/components/ui/toaster';
import {
  ArrowLeft, Send, Lock, AlertTriangle,
  User, Clock, Tag, Loader2, ChevronDown,
} from 'lucide-react';

const STATUSES = ['OPEN', 'IN_PROGRESS', 'PENDING_CUSTOMER', 'RESOLVED', 'CLOSED'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = getStoredAuth();
  const isViewer = user?.role === 'VIEWER';

  const [message, setMessage] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: ticket, isLoading } = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => api.get(`/tickets/${id}`).then(unwrap),
  });

  const { data: agents } = useQuery({
    queryKey: ['agents'],
    queryFn: () => api.get('/users?role=AGENT&isActive=true&limit=100').then(unwrap),
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [(ticket as any)?.messages?.length]);

  const updateTicket = useMutation({
    mutationFn: (data: any) => api.patch(`/tickets/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ticket', id] });
      toast({ title: 'Ticket aggiornato' });
    },
    onError: (err: any) => toast({
      title: 'Errore',
      description: err.response?.data?.message || 'Errore aggiornamento',
      variant: 'destructive',
    }),
  });

  const assignTicket = useMutation({
    mutationFn: (assigneeId: string | null) => api.patch(`/tickets/${id}/assign`, { assigneeId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ticket', id] });
      toast({ title: 'Agente assegnato' });
    },
  });

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setSending(true);
    try {
      await api.post(`/tickets/${id}/messages`, { content: message, isInternal });
      setMessage('');
      qc.invalidateQueries({ queryKey: ['ticket', id] });
    } catch (err: any) {
      toast({ title: 'Errore', description: 'Messaggio non inviato', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!ticket) return <div className="p-6 text-gray-500">Ticket non trovato</div>;
  const t = ticket as any;

  return (
    <div className="flex h-screen flex-col">
      {/* Sticky header */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 flex-shrink-0">
        <Link href="/tickets" className="btn-ghost p-1.5">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-mono">#{t.number}</span>
            <span className={`badge ${STATUS_COLORS[t.status]}`}>{STATUS_LABELS[t.status]}</span>
            <span className={`badge ${PRIORITY_COLORS[t.priority]}`}>{PRIORITY_LABELS[t.priority]}</span>
            {t.slaBreachAt && new Date(t.slaBreachAt) < new Date() && t.status !== 'CLOSED' && t.status !== 'RESOLVED' && (
              <span className="badge bg-red-100 text-red-700 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> SLA violato
              </span>
            )}
          </div>
          <h1 className="text-base font-semibold text-gray-900 truncate">{t.title}</h1>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Messages */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {t.messages?.map((msg: any) => {
              const isAgent = msg.authorType === 'agent';
              const isCurrentUser = msg.authorId === user?.id;
              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${isCurrentUser ? 'flex-row-reverse' : ''}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    msg.authorType === 'customer' ? 'bg-gray-200' : 'bg-blue-500'
                  }`}>
                    <span className="text-xs font-semibold text-white">
                      {msg.author?.name?.charAt(0) || t.customerName?.charAt(0) || '?'}
                    </span>
                  </div>
                  <div className={`max-w-[70%] ${isCurrentUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-600">
                        {msg.author?.name || t.customerName || 'Cliente'}
                      </span>
                      {msg.isInternal && (
                        <span className="flex items-center gap-1 text-xs text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">
                          <Lock className="w-2.5 h-2.5" /> Interno
                        </span>
                      )}
                      <span className="text-xs text-gray-400">{timeAgo(msg.createdAt)}</span>
                    </div>
                    <div className={`rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                      msg.isInternal
                        ? 'bg-orange-50 border border-orange-100 text-orange-800'
                        : isCurrentUser
                          ? 'bg-blue-600 text-white'
                          : 'bg-white border border-gray-200 text-gray-800'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Message input */}
          {!isViewer && (
            <form onSubmit={sendMessage} className="border-t border-gray-200 bg-white p-4">
              <div className="flex gap-2 items-center mb-2">
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isInternal}
                    onChange={(e) => setIsInternal(e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  <Lock className="w-3.5 h-3.5" />
                  Nota interna (non visibile al cliente)
                </label>
              </div>
              <div className="flex gap-2">
                <textarea
                  className={`input flex-1 resize-none ${isInternal ? 'border-orange-300 bg-orange-50' : ''}`}
                  rows={2}
                  placeholder={isInternal ? 'Nota interna per il team…' : 'Scrivi una risposta…'}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendMessage(e as any);
                  }}
                />
                <button
                  type="submit"
                  disabled={!message.trim() || sending}
                  className="btn-primary self-end px-4"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">Cmd/Ctrl+Enter per inviare</p>
            </form>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-72 border-l border-gray-200 bg-white overflow-y-auto flex-shrink-0">
          <div className="p-4 space-y-5">
            {/* Status */}
            <div>
              <label className="label">Stato</label>
              <select
                className="input"
                value={t.status}
                disabled={isViewer}
                onChange={(e) => updateTicket.mutate({ status: e.target.value, version: t.version })}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="label">Priorità</label>
              <select
                className="input"
                value={t.priority}
                disabled={isViewer}
                onChange={(e) => updateTicket.mutate({ priority: e.target.value, version: t.version })}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                ))}
              </select>
            </div>

            {/* Assignee */}
            <div>
              <label className="label">Assegnato a</label>
              <select
                className="input"
                value={t.assignee?.id || ''}
                disabled={isViewer}
                onChange={(e) => assignTicket.mutate(e.target.value || null)}
              >
                <option value="">Non assegnato</option>
                {((agents as any)?.users || []).map((u: any) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>

            {/* Customer info */}
            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Cliente</p>
              <div className="space-y-2">
                {t.customerName && (
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    {t.customerName}
                  </div>
                )}
                {t.customerEmail && (
                  <div className="text-sm text-gray-600 break-all">{t.customerEmail}</div>
                )}
                {t.customerPhone && (
                  <div className="text-sm text-gray-600">{t.customerPhone}</div>
                )}
                {!t.customerName && !t.customerEmail && (
                  <p className="text-xs text-gray-400">Nessun cliente associato</p>
                )}
              </div>
            </div>

            {/* Tags */}
            {t.tags?.length > 0 && (
              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Tag</p>
                <div className="flex flex-wrap gap-1.5">
                  {t.tags.map((tag: string) => (
                    <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Tag className="w-2.5 h-2.5" /> {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Dates */}
            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Date</p>
              <div className="space-y-1.5 text-xs text-gray-500">
                <div className="flex justify-between">
                  <span>Creato</span>
                  <span className="text-gray-700">{formatDate(t.createdAt)}</span>
                </div>
                {t.firstResponseAt && (
                  <div className="flex justify-between">
                    <span>Prima risposta</span>
                    <span className="text-gray-700">{formatDate(t.firstResponseAt)}</span>
                  </div>
                )}
                {t.resolvedAt && (
                  <div className="flex justify-between">
                    <span>Risolto</span>
                    <span className="text-green-700">{formatDate(t.resolvedAt)}</span>
                  </div>
                )}
                {t.slaBreachAt && (
                  <div className="flex justify-between">
                    <span>Scadenza SLA</span>
                    <span className={new Date(t.slaBreachAt) < new Date() ? 'text-red-600 font-medium' : 'text-gray-700'}>
                      {formatDate(t.slaBreachAt)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Metadata */}
            <div className="border-t border-gray-100 pt-4 text-xs text-gray-400">
              <div>Versione: {t.version}</div>
              <div>Creato da: {t.createdBy?.name}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
