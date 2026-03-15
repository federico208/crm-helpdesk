'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { unwrap } from '@/lib/utils';
import { toast } from '@/components/ui/toaster';
import { Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NewTicketPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', priority: 'MEDIUM',
    customerName: '', customerEmail: '', customerPhone: '',
    assigneeId: '', tags: '',
  });

  const { data: agents } = useQuery({
    queryKey: ['agents'],
    queryFn: () => api.get('/users?role=AGENT&isActive=true&limit=100').then(unwrap),
  });

  const set = (k: string) => (e: React.ChangeEvent<any>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...form,
        assigneeId: form.assigneeId || null,
        tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      };
      const res = await api.post('/tickets', payload);
      const ticket = res.data.data;
      toast({ title: 'Ticket creato', description: `#${ticket.number} creato con successo` });
      router.push(`/tickets/${ticket.id}`);
    } catch (err: any) {
      toast({
        title: 'Errore',
        description: err.response?.data?.message || 'Errore nella creazione',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/tickets" className="btn-ghost p-2">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nuovo Ticket</h1>
          <p className="text-gray-500 text-sm">Crea una nuova richiesta di supporto</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 space-y-5">
        <div>
          <label className="label">Titolo <span className="text-red-500">*</span></label>
          <input
            className="input" required
            placeholder="Descrivi brevemente il problema"
            value={form.title} onChange={set('title')}
          />
        </div>

        <div>
          <label className="label">Descrizione <span className="text-red-500">*</span></label>
          <textarea
            className="input resize-none" rows={5} required
            placeholder="Descrivi il problema in dettaglio…"
            value={form.description} onChange={set('description')}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Priorità</label>
            <select className="input" value={form.priority} onChange={set('priority')}>
              <option value="LOW">Bassa</option>
              <option value="MEDIUM">Media</option>
              <option value="HIGH">Alta</option>
              <option value="URGENT">Urgente</option>
            </select>
          </div>
          <div>
            <label className="label">Assegna a</label>
            <select className="input" value={form.assigneeId} onChange={set('assigneeId')}>
              <option value="">Non assegnato</option>
              {((agents as any)?.users || []).map((u: any) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-5">
          <h3 className="text-sm font-medium text-gray-700 mb-4">Informazioni Cliente (opzionale)</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Nome cliente</label>
              <input className="input" placeholder="Mario Rossi" value={form.customerName} onChange={set('customerName')} />
            </div>
            <div>
              <label className="label">Email cliente</label>
              <input className="input" type="email" placeholder="mario@example.com" value={form.customerEmail} onChange={set('customerEmail')} />
            </div>
            <div>
              <label className="label">Telefono</label>
              <input className="input" placeholder="+39 333 1234567" value={form.customerPhone} onChange={set('customerPhone')} />
            </div>
            <div>
              <label className="label">Tag (separati da virgola)</label>
              <input className="input" placeholder="bug, fatturazione, api" value={form.tags} onChange={set('tags')} />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link href="/tickets" className="btn-secondary">Annulla</Link>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Crea Ticket'}
          </button>
        </div>
      </form>
    </div>
  );
}
