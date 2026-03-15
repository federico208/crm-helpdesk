'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { unwrap } from '@/lib/utils';
import {
  Ticket, AlertTriangle, CheckCircle, Clock,
  TrendingUp, Users, RefreshCw,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { STATUS_LABELS, STATUS_COLORS, PRIORITY_COLORS, PRIORITY_LABELS } from '@/lib/auth';
import Link from 'next/link';

function KpiCard({ label, value, icon: Icon, color, sub }: any) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value ?? '—'}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
        <div className={`p-2.5 rounded-xl ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: kpi, isLoading: kpiLoading, refetch } = useQuery({
    queryKey: ['kpi'],
    queryFn: () => api.get('/analytics/kpi?days=30').then(unwrap),
  });

  const { data: trend } = useQuery({
    queryKey: ['trend'],
    queryFn: () => api.get('/analytics/trend?days=14').then(unwrap),
  });

  const { data: recent } = useQuery({
    queryKey: ['tickets-recent'],
    queryFn: () => api.get('/tickets?limit=5&sortBy=createdAt&sortOrder=desc').then(unwrap),
  });

  if (kpiLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const chartData = (trend as any[])?.map((d: any) => ({
    date: format(new Date(d.date), 'd MMM', { locale: it }),
    Creati: d.total,
    Risolti: d.resolved,
  })) || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm">Ultimi 30 giorni</p>
        </div>
        <button onClick={() => refetch()} className="btn-secondary">
          <RefreshCw className="w-4 h-4" />
          Aggiorna
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Ticket Aperti"
          value={(kpi as any)?.tickets?.open}
          icon={Ticket}
          color="bg-blue-500"
          sub={`${(kpi as any)?.tickets?.createdInPeriod} creati nel periodo`}
        />
        <KpiCard
          label="Risolti"
          value={(kpi as any)?.tickets?.resolvedInPeriod}
          icon={CheckCircle}
          color="bg-green-500"
          sub="Nel periodo selezionato"
        />
        <KpiCard
          label="SLA Violati"
          value={(kpi as any)?.sla?.overdueCount}
          icon={AlertTriangle}
          color={(kpi as any)?.sla?.overdueCount > 0 ? 'bg-red-500' : 'bg-gray-400'}
          sub={`${(kpi as any)?.sla?.overduePercent}% dei ticket aperti`}
        />
        <KpiCard
          label="Risoluzione Media"
          value={(kpi as any)?.performance?.avgResolutionHours != null
            ? `${(kpi as any)?.performance?.avgResolutionHours}h`
            : '—'}
          icon={Clock}
          color="bg-purple-500"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Trend */}
        <div className="card p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Andamento Ultimi 14 Giorni</h2>
          {chartData.length ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="Creati" stroke="#3b82f6" fill="#eff6ff" strokeWidth={2} />
                <Area type="monotone" dataKey="Risolti" stroke="#22c55e" fill="#f0fdf4" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-gray-400 py-16 text-sm">Nessun dato disponibile</p>
          )}
        </div>

        {/* By assignee */}
        <div className="card p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Ticket per Agente (aperti)</h2>
          <div className="space-y-3">
            {(kpi as any)?.byAssignee?.length ? (
              (kpi as any).byAssignee.slice(0, 6).map((a: any) => (
                <div key={a.agentId} className="flex items-center gap-3">
                  <div className="w-7 h-7 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-semibold text-gray-600">
                      {a.agentName.charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-800 truncate">{a.agentName}</span>
                      <span className="text-sm text-gray-500 ml-2">{a.ticketCount}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{
                          width: `${Math.min(100, (a.ticketCount / Math.max(...(kpi as any).byAssignee.map((x: any) => x.ticketCount))) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-gray-400 py-16 text-sm">Nessun ticket assegnato</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent tickets */}
      <div className="card">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Ticket Recenti</h2>
          <Link href="/tickets" className="text-sm text-blue-600 hover:underline">Vedi tutti →</Link>
        </div>
        <div className="divide-y divide-gray-50">
          {(recent as any)?.tickets?.map((t: any) => (
            <Link
              key={t.id}
              href={`/tickets/${t.id}`}
              className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors"
            >
              <div className="flex-shrink-0 w-6 text-center">
                <span className="text-xs text-gray-400">#{t.number}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{t.title}</p>
                <p className="text-xs text-gray-400 truncate">{t.customerName || t.customerEmail || 'Nessun cliente'}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`badge ${STATUS_COLORS[t.status]}`}>
                  {STATUS_LABELS[t.status]}
                </span>
                <span className={`badge ${PRIORITY_COLORS[t.priority]}`}>
                  {PRIORITY_LABELS[t.priority]}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
