import { useSyncExternalStore } from 'react';
import type { State } from './types';

/**
 * In-memory cache of the signed-in user's data. Supabase is the source of truth:
 * `hydrate()` in data.ts fills this after login, api.ts writes to Supabase and updates it.
 * Only language and theme are kept in localStorage.
 */
const PREF = 'landaudit_prefs';
function prefs(): Pick<State, 'lang' | 'theme'> {
  try { const p = JSON.parse(localStorage.getItem(PREF) ?? '{}'); return { lang: p.lang === 'ta' ? 'ta' : 'en', theme: p.theme === 'dark' ? 'dark' : 'light' }; } catch { return { lang: 'en', theme: 'light' }; }
}
export const emptyState = (): State => ({ users: [], cases: [], reviews: [], logs: [], payments: [], session: null, ready: false, ...prefs() });

let state: State = emptyState();
const subs = new Set<() => void>();
export const get = () => state;
export function set(fn: (s: State) => State) {
  state = fn(state);
  try { localStorage.setItem(PREF, JSON.stringify({ lang: state.lang, theme: state.theme })); } catch { /* ignore */ }
  document.documentElement.dataset.theme = state.theme;
  document.documentElement.lang = state.lang;
  subs.forEach(f => f());
}
export const useStore = () => useSyncExternalStore(cb => { subs.add(cb); return () => subs.delete(cb); }, get);
document.documentElement.dataset.theme = state.theme;
document.documentElement.lang = state.lang;
