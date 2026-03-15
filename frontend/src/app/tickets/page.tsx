'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import api from '@/lib/api';
import { unwrap, timeAgo } from '@/lib/utils';
import { STATUS_LABELS, STATUS_COLORS, PRIORITY_COLORS, PRIORITY_LABELS } from '@/lib/auth';
import { Plus, Search, Filter, RefreshCw, Download, ChevronLeft, ChevronRight } from 'lucide-react';

const STATUSES = ['', 'OPEN', 'IN_PROGRESS', 'PENDING_CUSTOMER', 'RESOLVED', 'CLOSED'];
const PRIORITIES = ['', 'URGENT', 'HIGH', 'MEDIUM', 'LOW'];

export default function TicketsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['tickets', search, status, priority, page],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (status) params.set('status', status);
      if (priority) params.set('priority', priority);
      params.set('page', String(page));
      params.set('limit', '20');
      return api.get(`/tickets?${params}`).then(unwrap);
    },
  });

  const tickets = (data as any)?.tickets || [];
  const total = (data as any)?.total || 0;
  const pages = (data as any)?.pages || 1;

  const handleExport = async (level: string) => {
    const token = localStorage.getItem('accessToken');
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/export/tickets?level=${level}&format=csv`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tickets-${level}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ticket</h1>
          <p className="text-gray-500 text-sm">{total} ticket totali</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button className="btn-secondary gap-2">
              <Download className="w-4 h-4" />
              Export
            </button>
            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 hidden group-hover:block min-w-[180px]">
              <button onClick={() => handleExport('anonymized')} className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50">
                CSV Anonimizzato
              </button>
              <button onClick={() => handleExport('full')} className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50">
                CSV Completo (Admin)
              </button>
            </div>
          </div>
          <button onClick={() => handleExport('anonymized')} className="btn-secondary">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <Link href="/tickets/new" className="btn-primary">
            <Plus className="w-4 h-4" />
            Nuovo Ticket
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input pl-9 w-full"
            placeholder="Cerca per titolo, cliente, email…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          className="input w-auto"
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
        >
          <option value="">Tutti gli stati</option>
          {STATUSES.slice(1).map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
        <select
          className="input w-auto"
          value={priority}
          onChange={(e) => { setPriority(e.target.value); setPage(1); }}
        >
          <option value="">Tutte le priorità</option>
          {PRIORITIES.slice(1).map((p) => (
            <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
          ))}
        </select>
        <button onClick={() => refetch()} className="btn-ghost">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Filter className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>Nessun ticket trovato</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">#</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Titolo</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Stato</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Priorità</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Assegnato a</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Creato</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {tickets.map((t: any) => (
                <tr key={t.id} className="hover:bg-gray-50 transition-colors cursor-pointer">
                  <td className="px-4 py-3">
                    <Link href={`/tickets/${t.id}`} className="text-xs text-gray-400 font-mono">
                      #{t.number}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/tickets/${t.id}`} className="text-sm font-medium text-gray-900 hover:text-blue-600 line-clamp-1">
                      {t.title}
                    </Link>
                    {t.tags?.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {t.tags.slice(0, 3).map((tag: string) => (
                          <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${STATUS_COLORS[t.status]}`}>
                      {STATUS_LABELS[t.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${PRIORITY_COLORS[t.priority]}`}>
                      {PRIORITY_LABELS[t.priority]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {t.assignee?.name || <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 max-w-[150px] truncate">
                    {t.customerName || t.customerEmail || <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                    {timeAgo(t.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              Pagina {page} di {pages} ({total} risultati)
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-ghost p-1.5"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={page === pages}
                className="btn-ghost p-1.5"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
