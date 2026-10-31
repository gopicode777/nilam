import { supabase } from './supabase';
import { get } from '../store';

/** Sends browser errors to the client_errors table (admin > Errors). Capped so one bug cannot flood the table. */
let sent = 0; const seen = new Set<string>();
export function reportError(message: string, stack?: string) {
  try {
    if (sent >= 5 || !get().session || /ResizeObserver|Script error/i.test(message)) return;
    const key = message.slice(0, 120); if (seen.has(key)) return; seen.add(key); sent++;
    void supabase.from('client_errors').insert({ message: message.slice(0, 500), stack: stack?.slice(0, 4000), route: window.location.hash.slice(0, 200), ua: navigator.userAgent.slice(0, 300), build: import.meta.env.MODE });
  } catch { /* never let error reporting cause an error */ }
}
export function installErrorReporting() {
  window.addEventListener('error', e => reportError(e.message || 'Unknown error', e.error?.stack));
  window.addEventListener('unhandledrejection', e => { const r = e.reason as Error | undefined; reportError(String(r?.message ?? e.reason), r?.stack); });
}
