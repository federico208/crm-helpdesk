export interface User {
  id: string;
  name: string;
  email: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'AGENT' | 'VIEWER';
  tenantId: string;
  twoFactorEnabled?: boolean;
}

export interface AuthState {
  user: User | null;
  tenant: { id: string; name: string; slug: string } | null;
  accessToken: string | null;
  refreshToken: string | null;
}

export function getStoredAuth(): AuthState {
  if (typeof window === 'undefined') {
    return { user: null, tenant: null, accessToken: null, refreshToken: null };
  }
  try {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    const tenant = JSON.parse(localStorage.getItem('tenant') || 'null');
    const accessToken = localStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refreshToken');
    return { user, tenant, accessToken, refreshToken };
  } catch {
    return { user: null, tenant: null, accessToken: null, refreshToken: null };
  }
}

export function storeAuth(data: { user: User; tenant: any; accessToken: string; refreshToken: string }) {
  localStorage.setItem('user', JSON.stringify(data.user));
  localStorage.setItem('tenant', JSON.stringify(data.tenant));
  localStorage.setItem('accessToken', data.accessToken);
  localStorage.setItem('refreshToken', data.refreshToken);
}

export function clearAuth() {
  localStorage.removeItem('user');
  localStorage.removeItem('tenant');
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
}

export function isAuthenticated(): boolean {
  return !!localStorage.getItem('accessToken');
}

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Amministratore',
  AGENT: 'Agente',
  VIEWER: 'Visualizzatore',
};

export const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Aperto',
  IN_PROGRESS: 'In Lavorazione',
  PENDING_CUSTOMER: 'In Attesa Cliente',
  RESOLVED: 'Risolto',
  CLOSED: 'Chiuso',
};

export const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Basso',
  MEDIUM: 'Medio',
  HIGH: 'Alto',
  URGENT: 'Urgente',
};

export const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
  PENDING_CUSTOMER: 'bg-orange-100 text-orange-800',
  RESOLVED: 'bg-green-100 text-green-800',
  CLOSED: 'bg-gray-100 text-gray-600',
};

export const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-600',
  MEDIUM: 'bg-blue-100 text-blue-700',
  HIGH: 'bg-orange-100 text-orange-700',
  URGENT: 'bg-red-100 text-red-700',
};
