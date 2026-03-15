'use client';
import { useState, useEffect, createContext, useContext, useCallback } from 'react';

interface Toast { id: string; title: string; description?: string; variant?: 'default' | 'destructive' }
interface ToastContext { toast: (t: Omit<Toast, 'id'>) => void }

const ToastCtx = createContext<ToastContext>({ toast: () => {} });
export const useToast = () => useContext(ToastCtx);

let globalToast: ((t: Omit<Toast, 'id'>) => void) | null = null;
export const toast = (t: Omit<Toast, 'id'>) => globalToast?.(t);

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { ...t, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 4000);
  }, []);

  useEffect(() => { globalToast = addToast; }, [addToast]);

  return (
    <ToastCtx.Provider value={{ toast: addToast }}>
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`card p-4 shadow-lg border-l-4 animate-in slide-in-from-right-5 ${
              t.variant === 'destructive' ? 'border-red-500 bg-red-50' : 'border-blue-500 bg-white'
            }`}
          >
            <p className={`font-medium text-sm ${t.variant === 'destructive' ? 'text-red-800' : 'text-gray-900'}`}>
              {t.title}
            </p>
            {t.description && (
              <p className="text-xs text-gray-600 mt-0.5">{t.description}</p>
            )}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
