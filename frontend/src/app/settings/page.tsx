'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { unwrap } from '@/lib/utils';
import { getStoredAuth } from '@/lib/auth';
import { toast } from '@/components/ui/toaster';
import {
  Shield, Key, Webhook, Settings, QrCode,
  Copy, Eye, EyeOff, Plus, Trash2, Loader2, CheckCircle, X,
} from 'lucide-react';

type Tab = 'general' | 'security' | 'apikeys' | 'webhooks' | 'sla';

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('general');
  const { user } = getStoredAuth();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  const tabs = [
    { id: 'general', label: 'Generale', icon: Settings },
    { id: 'security', label: 'Sicurezza & 2FA', icon: Shield },
    ...(isAdmin ? [
      { id: 'apikeys', label: 'API Keys', icon: Key },
      { id: 'webhooks', label: 'Webhook', icon: Webhook },
      { id: 'sla', label: 'SLA', icon: CheckCircle },
    ] : []),
  ] as const;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Impostazioni</h1>
        <p className="text-gray-500 text-sm">Gestisci il tuo account e il tenant</p>
      </div>

      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id as Tab)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'general' && <GeneralTab />}
      {tab === 'security' && <SecurityTab />}
      {tab === 'apikeys' && isAdmin && <ApiKeysTab />}
      {tab === 'webhooks' && isAdmin && <WebhooksTab />}
      {tab === 'sla' && isAdmin && <SlaTab />}
    </div>
  );
}

// ─── GENERAL ──────────────────────────────────────────────────────────────────

function GeneralTab() {
  const qc = useQueryClient();
  const { data: settings } = useQuery({
    queryKey: ['tenant-settings'],
    queryFn: () => api.get('/tenants/settings').then(unwrap),
  });
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const tenant = settings as any;

  return (
    <div className="card p-6 max-w-lg space-y-4">
      <h2 className="font-semibold text-gray-900">Dati Aziendali</h2>
      <div>
        <label className="label">Nome Azienda</label>
        <input
          className="input"
          defaultValue={tenant?.name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div>
        <label className="label">Slug</label>
        <input className="input bg-gray-50" disabled value={tenant?.slug || ''} />
        <p className="text-xs text-gray-400 mt-1">Lo slug non può essere modificato</p>
      </div>
      <div>
        <label className="label">Piano</label>
        <input className="input bg-gray-50" disabled value={tenant?.plan || ''} />
      </div>
      <button
        disabled={saving}
        onClick={async () => {
          if (!name) return;
          setSaving(true);
          await api.patch('/tenants/settings', { name });
          qc.invalidateQueries({ queryKey: ['tenant-settings'] });
          toast({ title: 'Impostazioni salvate' });
          setSaving(false);
        }}
        className="btn-primary"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salva'}
      </button>
    </div>
  );
}

// ─── SECURITY / 2FA ───────────────────────────────────────────────────────────

function SecurityTab() {
  const { user } = getStoredAuth();
  const [step, setStep] = useState<'idle' | 'setup' | 'enabled' | 'disable'>('idle');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const start2FASetup = async () => {
    setLoading(true);
    try {
      const res = await api.post('/auth/2fa/setup');
      const d = res.data.data;
      setQrCode(d.qrCode);
      setSecret(d.secret);
      setStep('setup');
    } catch (err: any) {
      toast({ title: 'Errore', description: err.response?.data?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const enable2FA = async () => {
    if (otp.length !== 6) return;
    setLoading(true);
    try {
      const res = await api.post('/auth/2fa/enable', { otpCode: otp });
      setRecoveryCodes(res.data.data.recoveryCodes);
      setStep('enabled');
      toast({ title: '2FA abilitato!' });
    } catch (err: any) {
      toast({ title: 'Codice errato', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const disable2FA = async () => {
    if (otp.length !== 6) return;
    setLoading(true);
    try {
      await api.post('/auth/2fa/disable', { otpCode: otp });
      setStep('idle');
      setOtp('');
      toast({ title: '2FA disabilitato' });
    } catch (err: any) {
      toast({ title: 'Codice errato', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg space-y-6">
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-gray-900">Autenticazione a Due Fattori (2FA)</h2>
            <p className="text-sm text-gray-500 mt-1">
              Proteggi il tuo account con un secondo fattore di autenticazione
            </p>
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-medium ${
            user?.twoFactorEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}>
            {user?.twoFactorEnabled ? 'Abilitato' : 'Disabilitato'}
          </div>
        </div>

        {step === 'idle' && (
          <div className="space-y-3">
            {user?.twoFactorEnabled ? (
              <>
                <p className="text-sm text-gray-600">
                  Il 2FA è attivo. Puoi disabilitarlo inserendo il tuo codice OTP.
                </p>
                <div>
                  <label className="label">Codice OTP</label>
                  <input
                    className="input font-mono text-lg tracking-widest text-center max-w-[160px]"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                  />
                </div>
                <button
                  onClick={disable2FA}
                  disabled={loading || otp.length !== 6}
                  className="btn-danger"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Disabilita 2FA'}
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-600">
                  Scansiona un QR code con Google Authenticator, Authy o un'app compatibile TOTP.
                </p>
                <button onClick={start2FASetup} disabled={loading} className="btn-primary">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                    <><QrCode className="w-4 h-4" /> Configura 2FA</>
                  )}
                </button>
              </>
            )}
          </div>
        )}

        {step === 'setup' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              1. Scansiona questo QR code con la tua app di autenticazione
            </p>
            {qrCode && (
              <div className="flex justify-center">
                <img src={qrCode} alt="2FA QR Code" className="w-48 h-48 border border-gray-200 rounded-lg" />
              </div>
            )}
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Oppure inserisci manualmente:</p>
              <code className="text-xs font-mono text-gray-800 break-all">{secret}</code>
            </div>
            <p className="text-sm text-gray-600">
              2. Inserisci il codice a 6 cifre mostrato dall'app:
            </p>
            <input
              className="input font-mono text-lg tracking-widest text-center max-w-[160px]"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              autoFocus
            />
            <div className="flex gap-3">
              <button onClick={() => { setStep('idle'); setOtp(''); }} className="btn-secondary">Annulla</button>
              <button onClick={enable2FA} disabled={loading || otp.length !== 6} className="btn-primary">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Attiva 2FA'}
              </button>
            </div>
          </div>
        )}

        {step === 'enabled' && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-800 font-medium text-sm flex items-center gap-2">
                <CheckCircle className="w-4 h-4" /> 2FA abilitato con successo!
              </p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-amber-800 font-semibold text-sm mb-2">
                Salva questi codici di recupero in un luogo sicuro.
              </p>
              <p className="text-amber-700 text-xs mb-3">
                Usali se perdi accesso alla tua app di autenticazione. Ogni codice può essere usato una sola volta.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {recoveryCodes.map((code) => (
                  <code key={code} className="text-xs font-mono bg-white border border-amber-200 px-2 py-1 rounded text-center">
                    {code}
                  </code>
                ))}
              </div>
            </div>
            <button onClick={() => setStep('idle')} className="btn-primary">Ho salvato i codici</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── API KEYS ─────────────────────────────────────────────────────────────────

function ApiKeysTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => api.get('/tenants/api-keys').then(unwrap),
  });
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [name, setName] = useState('');

  const createKey = async () => {
    if (!name) return;
    setCreating(true);
    try {
      const res = await api.post('/tenants/api-keys', {
        name,
        scopes: ['read:tickets', 'write:tickets'],
      });
      setNewKey(res.data.data.key);
      qc.invalidateQueries({ queryKey: ['api-keys'] });
      setName('');
    } catch (err: any) {
      toast({ title: 'Errore', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const revokeKey = async (id: string) => {
    await api.delete(`/tenants/api-keys/${id}`);
    qc.invalidateQueries({ queryKey: ['api-keys'] });
    toast({ title: 'API Key revocata' });
  };

  const keys = data as any[] || [];

  return (
    <div className="max-w-2xl space-y-4">
      <div className="card p-5">
        <h2 className="font-semibold text-gray-900 mb-3">Crea nuova API Key</h2>
        <div className="flex gap-3">
          <input
            className="input flex-1"
            placeholder="Nome chiave (es. Integrazione CRM)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button onClick={createKey} disabled={creating || !name} className="btn-primary">
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> Crea</>}
          </button>
        </div>
        {newKey && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800 text-sm font-medium mb-2">
              ⚠️ Copia questa chiave ora — non verrà mostrata di nuovo!
            </p>
            <div className="flex items-center gap-2">
              <code className="text-xs font-mono bg-white border border-green-200 px-2 py-1 rounded flex-1 break-all">
                {newKey}
              </code>
              <button
                onClick={() => { navigator.clipboard.writeText(newKey); toast({ title: 'Copiato!' }); }}
                className="btn-ghost p-1.5"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 text-sm">API Keys attive</h2>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
        ) : keys.length === 0 ? (
          <p className="text-center text-gray-400 py-8 text-sm">Nessuna API key creata</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {keys.map((k: any) => (
              <div key={k.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{k.name}</p>
                  <p className="text-xs text-gray-400 font-mono">{k.keyPrefix}…</p>
                  <div className="flex gap-1 mt-1">
                    {k.scopes.map((s: string) => (
                      <span key={s} className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{s}</span>
                    ))}
                  </div>
                </div>
                <button onClick={() => revokeKey(k.id)} className="btn-ghost text-red-500 hover:bg-red-50 p-1.5">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── WEBHOOKS ─────────────────────────────────────────────────────────────────

function WebhooksTab() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['webhooks'],
    queryFn: () => api.get('/tenants/webhooks').then(unwrap),
  });
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', url: '', events: ['ticket.created'] });

  const ALL_EVENTS = ['ticket.created', 'ticket.updated', 'ticket.resolved', 'ticket.closed'];

  const createWebhook = async () => {
    await api.post('/tenants/webhooks', form);
    qc.invalidateQueries({ queryKey: ['webhooks'] });
    setShowCreate(false);
    setForm({ name: '', url: '', events: ['ticket.created'] });
    toast({ title: 'Webhook creato' });
  };

  const deleteWebhook = async (id: string) => {
    await api.delete(`/tenants/webhooks/${id}`);
    qc.invalidateQueries({ queryKey: ['webhooks'] });
    toast({ title: 'Webhook eliminato' });
  };

  const hooks = data as any[] || [];

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="font-semibold text-gray-900">Webhook Outbound</h2>
          <p className="text-sm text-gray-500">Notifica sistemi esterni sugli eventi dei ticket</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> Nuovo
        </button>
      </div>

      <div className="card overflow-hidden">
        {hooks.length === 0 ? (
          <p className="text-center text-gray-400 py-8 text-sm">Nessun webhook configurato</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {hooks.map((h: any) => (
              <div key={h.id} className="flex items-start justify-between px-4 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900">{h.name}</p>
                    <span className={`badge ${h.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {h.isActive ? 'Attivo' : 'Inattivo'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 font-mono mt-0.5 truncate max-w-xs">{h.url}</p>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {h.events.map((e: string) => (
                      <span key={e} className="text-xs bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded">{e}</span>
                    ))}
                  </div>
                </div>
                <button onClick={() => deleteWebhook(h.id)} className="btn-ghost text-red-500 hover:bg-red-50 p-1.5">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Nuovo Webhook</h3>
              <button onClick={() => setShowCreate(false)} className="btn-ghost p-1"><X className="w-4 h-4" /></button>
            </div>
            <div>
              <label className="label">Nome</label>
              <input className="input" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label className="label">URL</label>
              <input className="input" type="url" placeholder="https://…" value={form.url} onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))} />
            </div>
            <div>
              <label className="label">Eventi</label>
              <div className="space-y-2">
                {ALL_EVENTS.map((e) => (
                  <label key={e} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.events.includes(e)}
                      onChange={(ev) => setForm((p) => ({
                        ...p,
                        events: ev.target.checked ? [...p.events, e] : p.events.filter((x) => x !== e),
                      }))}
                    />
                    {e}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowCreate(false)} className="btn-secondary">Annulla</button>
              <button onClick={createWebhook} className="btn-primary">Crea</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SLA ──────────────────────────────────────────────────────────────────────

function SlaTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['sla'],
    queryFn: () => api.get('/tenants/sla').then(unwrap),
  });
  const [saving, setSaving] = useState<string | null>(null);

  const saveProfile = async (id: string, data: any) => {
    setSaving(id);
    await api.patch(`/tenants/sla/${id}`, data);
    qc.invalidateQueries({ queryKey: ['sla'] });
    toast({ title: 'SLA aggiornato' });
    setSaving(null);
  };

  const profiles = data as any[] || [];

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h2 className="font-semibold text-gray-900">Profili SLA</h2>
        <p className="text-sm text-gray-500">Tempi di risposta e risoluzione per priorità</p>
      </div>
      <div className="space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
        ) : (
          profiles.map((p: any) => (
            <SlaProfileRow key={p.id} profile={p} onSave={saveProfile} saving={saving === p.id} />
          ))
        )}
      </div>
    </div>
  );
}

function SlaProfileRow({ profile, onSave, saving }: any) {
  const [frt, setFrt] = useState(profile.firstResponseHours);
  const [res, setRes] = useState(profile.resolutionHours);

  const PRIORITY_BADGE: Record<string, string> = {
    URGENT: 'bg-red-100 text-red-700',
    HIGH: 'bg-orange-100 text-orange-700',
    MEDIUM: 'bg-blue-100 text-blue-700',
    LOW: 'bg-gray-100 text-gray-600',
  };

  return (
    <div className="card p-4 flex items-center gap-4">
      <span className={`badge min-w-[80px] justify-center ${PRIORITY_BADGE[profile.priority]}`}>
        {profile.priority}
      </span>
      <div className="flex items-center gap-3 flex-1">
        <div className="flex-1">
          <label className="text-xs text-gray-500 mb-1 block">Prima risposta (ore)</label>
          <input
            type="number" min={1} className="input py-1.5 text-sm"
            value={frt} onChange={(e) => setFrt(Number(e.target.value))}
          />
        </div>
        <div className="flex-1">
          <label className="text-xs text-gray-500 mb-1 block">Risoluzione (ore)</label>
          <input
            type="number" min={1} className="input py-1.5 text-sm"
            value={res} onChange={(e) => setRes(Number(e.target.value))}
          />
        </div>
      </div>
      <button
        onClick={() => onSave(profile.id, { firstResponseHours: frt, resolutionHours: res })}
        disabled={saving}
        className="btn-primary py-1.5 text-sm"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salva'}
      </button>
    </div>
  );
}
