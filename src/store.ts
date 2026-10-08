import { useSyncExternalStore } from 'react';
import { seed } from './seed';
import type { State } from './types';

const KEY = 'landaudit_v4';
function load(): State {
  try { const s = localStorage.getItem(KEY); if (s) return JSON.parse(s) as State; } catch { /* ignore */ }
  return seed();
}
let state: State = load();
const subs = new Set<() => void>();
export const get = () => state;
export function set(fn: (s: State) => State) {
  state = fn(state);
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
  document.documentElement.dataset.theme = state.theme;
  document.documentElement.lang = state.lang;
  subs.forEach(f => f());
}
export const useStore = () => useSyncExternalStore(cb => { subs.add(cb); return () => subs.delete(cb); }, get);
export const resetDemo = () => { localStorage.removeItem(KEY); state = seed(); set(s => s); };
document.documentElement.dataset.theme = state.theme;
document.documentElement.lang = state.lang;
