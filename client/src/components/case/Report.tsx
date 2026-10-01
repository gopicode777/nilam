import type { Case } from '../../types';
import { Badge } from '../ui';

export default function Report({ c }: { c: Case }) {
  const list = c.findings.filter((f) => f.status !== 'dismissed');
  return (
    <div className="card space-y-4">
      <div className="no-print flex justify-end"><button className="btn" onClick={() => window.print()}>Print / Save as PDF</button></div>
      <div><h2 className="text-xl font-bold">Land Audit Report</h2><p className="text-sm text-slate-600">{c.title} · {c.village}, {c.district} · Survey {c.survey_no}</p><p className="text-xs text-slate-500">Generated {new Date().toLocaleString()}</p></div>
      <div className="text-lg font-bold">Score: {c.score.overall ?? 'n/a'}/100 <span className="text-sm font-normal text-slate-500">— covers {c.score.coverage}% of the audit framework</span></div>
      <table className="w-full text-sm"><tbody>{c.score.categories.map((k) => <tr key={k.id} className="border-t"><td className="py-1">{k.name}</td><td className="text-right">{k.assessed ? k.score : 'Not assessed'}</td></tr>)}</tbody></table>
      <h3 className="font-semibold">Findings</h3>
      {list.map((f) => <div key={f.id} className="break-inside-avoid border-t pt-2"><Badge sev={f.severity} /> <b className="text-sm">{f.title}</b><p className="text-sm">{f.detail}</p>{f.action && <p className="text-sm text-slate-600">Action: {f.action}</p>}{f.status === 'reviewed' && <p className="text-xs text-slate-500">Reviewed by user</p>}</div>)}
      <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900"><b>Limitations.</b> Values are machine-read from uploaded documents. No government registry (TNREGINET, DTCP, CMDA, TNGIS) was queried; approvals and encumbrances are unverified. Map data is from OpenStreetMap. This report is a risk indicator, not a legal opinion — consult a qualified advocate and licensed surveyor before purchase.</div>
    </div>
  );
}
