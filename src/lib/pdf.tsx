import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import ReportDoc, { ReportOpt } from '../components/ReportDoc';
import type { Bi, Case } from '../types';

const load = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; const t = setTimeout(() => rej(new Error('timeout')), 7000); i.onload = () => { clearTimeout(t); res(i); }; i.onerror = () => { clearTimeout(t); rej(new Error('tile')); }; i.src = src; });

/** Builds a map image from OpenStreetMap tiles so it can be drawn into the PDF. Returns undefined if tiles cannot be loaded. */
export async function staticMap(c: Case, w = 520, h = 300, z = 16): Promise<string | undefined> {
  try {
    const n = 2 ** z, rad = (c.lat * Math.PI) / 180, x = ((c.lng + 180) / 360) * n, y = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n, tx = Math.floor(x), ty = Math.floor(y), px = (x - tx) * 256, py = (y - ty) * 256;
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d')!; g.fillStyle = '#E9ECE6'; g.fillRect(0, 0, w, h);
    let ok = 0;
    await Promise.all([-2, -1, 0, 1, 2].flatMap(dx => [-1, 0, 1].map(async dy => { try { const im = await load(`https://tile.openstreetmap.org/${z}/${tx + dx}/${ty + dy}.png`); g.drawImage(im, w / 2 - px + dx * 256, h / 2 - py + dy * 256); ok++; } catch { /* skip tile */ } })));
    if (!ok) return undefined;
    const side = Math.max(18, Math.sqrt(c.extent * 0.092903) / ((156543.03 * Math.cos(rad)) / n)); g.strokeStyle = '#1F57C3'; g.fillStyle = 'rgba(31,87,195,.3)'; g.lineWidth = 2; g.fillRect(w / 2 - side / 2, h / 2 - side / 2, side, side); g.strokeRect(w / 2 - side / 2, h / 2 - side / 2, side, side);
    g.fillStyle = '#B63A3A'; g.beginPath(); g.arc(w / 2, h / 2, 5, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke();
    return cv.toDataURL('image/png');
  } catch { return undefined; }
}

export async function downloadReport(c: Case, lang: 'en' | 'ta', opt: ReportOpt) {
  const mapUrl = opt.highlights ? await staticMap(c) : undefined;
  const host = document.createElement('div'); host.setAttribute('data-theme', 'light'); host.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;background:#fff;z-index:-1';
  document.body.appendChild(host); const root = createRoot(host);
  try {
    flushSync(() => root.render(<ReportDoc c={c} lang={lang} opt={opt} mapUrl={mapUrl} />));
    await document.fonts.ready; await Promise.all([...host.querySelectorAll('img')].map(i => i.decode().catch(() => undefined)));
    const pdf = new jsPDF({ unit: 'pt', format: 'a4' }), W = pdf.internal.pageSize.getWidth(), H = pdf.internal.pageSize.getHeight(), top = 22, bottom = 36;
    let y = top;
    for (const b of [...host.querySelectorAll<HTMLElement>('[data-pdf]')]) {
      const cv = await html2canvas(b, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false }), ih = (cv.height * W) / cv.width;
      if (y + ih > H - bottom && y > top) { pdf.addPage(); y = top; }
      pdf.addImage(cv.toDataURL('image/jpeg', 0.92), 'JPEG', 0, y, W, ih); y += ih;
    }
    const n = pdf.getNumberOfPages();
    for (let i = 1; i <= n; i++) { pdf.setPage(i); pdf.setFontSize(8); pdf.setTextColor(120); pdf.text(`LandAudit  |  ${c.id}  |  ${i} / ${n}`, W / 2, H - 16, { align: 'center' }); }
    pdf.save(`LandAudit-${c.id}-${lang}.pdf`);
  } finally { root.unmount(); host.remove(); }
}

export function downloadCsv(c: Case, lang: 'en' | 'ta') {
  const a = c.audit; if (!a) return; const B = (b: Bi) => (lang === 'ta' ? b.ta : b.en), q = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const rows = [['ID', 'Category', 'Severity', 'Title', 'Why', 'Evidence', 'Confidence', 'Action'], ...a.findings.map(f => [f.id, f.cat, f.sev, B(f.title), B(f.why), f.evidence.join('; '), f.conf + '%', B(f.action)])];
  const blob = new Blob(['\ufeff' + rows.map(r => r.map(q).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }), u = URL.createObjectURL(blob), el = document.createElement('a');
  el.href = u; el.download = `LandAudit-${c.id}-findings.csv`; el.click(); URL.revokeObjectURL(u);
}
