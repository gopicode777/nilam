import type { Sev } from '../types';
export const sevStyle: Record<Sev, string> = { red: 'bg-red-50 text-red-700 border-red-200', amber: 'bg-amber-50 text-amber-800 border-amber-200', info: 'bg-sky-50 text-sky-700 border-sky-200' };
export const sevLabel: Record<Sev, string> = { red: 'High risk', amber: 'Needs review', info: 'Note' };
export const Badge = ({ sev }: { sev: Sev }) => <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${sevStyle[sev]}`}>{sevLabel[sev]}</span>;
export const scoreColor = (s: number | null) => (s == null ? 'text-slate-400' : s >= 80 ? 'text-emerald-700' : s >= 60 ? 'text-amber-600' : 'text-red-600');
export const Spinner = () => <div className="p-8 text-center text-sm text-slate-500">Loading…</div>;
export const ErrorBox = ({ msg }: { msg: string }) => <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{msg}</div>;
