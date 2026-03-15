'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { storeAuth } from '@/lib/auth';
import { Loader2, Building2 } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    companyName: '', companySlug: '', name: '', email: '', password: '',
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((p) => ({ ...p, [k]: e.target.value }));
    if (k === 'companyName') {
      setForm((p) => ({
        ...p,
        companyName: e.target.value,
        companySlug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/register', form);
      storeAuth(res.data.data);
      router.replace('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Errore durante la registrazione');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="card w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Building2 className="text-white w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Crea il tuo CRM</h1>
          <p className="text-gray-500 text-sm mt-1">Registra la tua azienda e inizia subito</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Nome Azienda</label>
            <input
              className="input" required
              placeholder="La Mia Azienda"
              value={form.companyName}
              onChange={set('companyName')}
            />
          </div>
          <div>
            <label className="label">Slug (URL univoco)</label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">crm.app/</span>
              <input
                className="input flex-1" required
                placeholder="mia-azienda"
                value={form.companySlug}
                onChange={set('companySlug')}
                pattern="[a-z0-9-]+"
              />
            </div>
          </div>
          <div>
            <label className="label">Il tuo nome</label>
            <input className="input" required placeholder="Mario Rossi" value={form.name} onChange={set('name')} />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" required placeholder="mario@azienda.com" value={form.email} onChange={set('email')} />
          </div>
          <div>
            <label className="label">
              Password
              <span className="text-xs text-gray-400 ml-2">(min 8 car., maiusc., numero, simbolo)</span>
            </label>
            <input
              className="input" type="password" required
              placeholder="••••••••"
              value={form.password} onChange={set('password')}
              autoComplete="new-password"
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Crea Account'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Hai già un account?{' '}
          <Link href="/login" className="text-blue-600 hover:underline font-medium">Accedi</Link>
        </p>
      </div>
    </div>
  );
}
