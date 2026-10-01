import type { Case, CaseRow, Field } from './types';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch('/api' + path, { ...init, headers: init?.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : undefined });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `Request failed (${r.status})`);
  return r.status === 204 ? (undefined as T) : r.json();
}
const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

export const api = {
  cases: () => req<CaseRow[]>('/cases'),
  createCase: (b: { title: string; district: string; village: string; survey_no: string }) => req<Case>('/cases', json('POST', b)),
  getCase: (id: string) => req<Case>(`/cases/${id}`),
  deleteCase: (id: string) => req<void>(`/cases/${id}`, { method: 'DELETE' }),
  analyze: (id: string) => req<Case>(`/cases/${id}/analyze`, { method: 'POST' }),
  upload: (id: string, type: string, file: File) => { const f = new FormData(); f.append('type', type); f.append('file', file); return req<Case>(`/cases/${id}/documents`, { method: 'POST', body: f }); },
  deleteDoc: (id: string) => req<void>(`/documents/${id}`, { method: 'DELETE' }),
  saveFields: (docId: string, fields: Field[]) => req<Case>(`/documents/${docId}/fields`, json('PUT', { fields })),
  reviewFinding: (id: string, status: string, note?: string) => req<Case>(`/findings/${id}`, json('PATCH', { status, note })),
  search: (q: string) => req<{ name: string; lat: number; lng: number }[]>(`/geo/search?q=${encodeURIComponent(q)}`),
  setLocation: (id: string, lat: number, lng: number) => req<Case>(`/cases/${id}/location`, json('PUT', { lat, lng })),
  messages: (id: string) => req<{ role: string; content: string }[]>(`/cases/${id}/messages`),
  chat: (id: string, message: string) => req<{ role: string; content: string }>(`/cases/${id}/chat`, json('POST', { message })),
  sources: () => req<{ name: string; status: string; note: string }[]>('/sources'),
};
