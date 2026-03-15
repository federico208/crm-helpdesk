'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { storeAuth } from '@/lib/auth';
import { toast } from '@/components/ui/toaster';
import { Loader2, Lock, Mail } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@demo.com');
  const [password, setPassword] = useState('Password123!');
  const [otpCode, setOtpCode] = useState('');
  const [tempToken, setTempToken] = useState('');
  const [step, setStep] = useState<'credentials' | '2fa'>('credentials');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/login', { email, password });
      const data = res.data.data;

      if (data.requiresTwoFactor) {
        setTempToken(data.tempToken);
        setStep('2fa');
        return;
      }

      storeAuth(data);
      router.replace('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Credenziali non valide');
    } finally {
      setLoading(false);
    }
  };

  const handle2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/2fa/validate', { tempToken, otpCode });
      storeAuth(res.data.data);
      router.replace('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Codice OTP non valido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="card w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Lock className="text-white w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">CRM Helpdesk</h1>
          <p className="text-gray-500 text-sm mt-1">
            {step === 'credentials' ? 'Accedi al tuo account' : 'Inserisci il codice autenticatore'}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm mb-4">
            {error}
          </div>
        )}

        {step === 'credentials' ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input pl-10"
                  placeholder="nome@azienda.com"
                  required
                  autoComplete="email"
                />
              </div>
            </div>
            <div>
              <label className="label">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Accedi'}
            </button>
          </form>
        ) : (
          <form onSubmit={handle2FA} className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 text-blue-700 rounded-lg p-3 text-sm">
              Apri la tua app di autenticazione e inserisci il codice a 6 cifre.
            </div>
            <div>
              <label className="label">Codice OTP</label>
              <input
                type="text"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="input text-center text-2xl tracking-widest font-mono"
                placeholder="000000"
                maxLength={6}
                required
                autoFocus
              />
            </div>
            <button type="submit" disabled={loading || otpCode.length !== 6} className="btn-primary w-full">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verifica'}
            </button>
            <button type="button" onClick={() => setStep('credentials')} className="btn-ghost w-full text-sm">
              ← Torna al login
            </button>
          </form>
        )}

        <p className="text-center text-sm text-gray-500 mt-6">
          Non hai un account?{' '}
          <Link href="/register" className="text-blue-600 hover:underline font-medium">
            Registra la tua azienda
          </Link>
        </p>

        <div className="mt-6 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-400 text-center font-medium mb-2">Credenziali di test</p>
          <div className="space-y-1">
            {[
              ['Admin', 'admin@demo.com'],
              ['Agente', 'marco.bianchi@demo.com'],
              ['Viewer', 'viewer@demo.com'],
            ].map(([role, email]) => (
              <button
                key={email}
                type="button"
                onClick={() => { setEmail(email); setPassword('Password123!'); }}
                className="w-full text-left text-xs text-gray-500 hover:text-blue-600 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
              >
                <span className="font-medium">{role}:</span> {email}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
