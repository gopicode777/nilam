import { useState } from 'react';
import { useL } from '../i18n';
import { DOC_LABEL } from '../engine';
import * as api from '../api';
import type { DocType } from '../types';

/** Field mode: photograph a document on the phone. Photos have no useful file name, so the user picks the document type. */
export default function CameraUpload({ caseId }: { caseId: string }) {
  const { L, B } = useL(), [type, setType] = useState<DocType>('sale_deed'), [busy, setBusy] = useState(false), [msg, setMsg] = useState('');
  const take = async (files: FileList | null) => {
    if (!files?.length) return; setBusy(true); setMsg('');
    const bad = await api.addFiles(caseId, [...files], type); setBusy(false);
    setMsg(bad ? L('Could not upload the photo.', 'படத்தை பதிவேற்ற முடியவில்லை.') : L('Photo added. It is being read.', 'படம் சேர்க்கப்பட்டது. படிக்கப்படுகிறது.'));
  };
  return <div className="row wrap" style={{ gap: 8, marginTop: 10 }}>
    <select className="in" style={{ width: 'auto' }} value={type} onChange={e => setType(e.target.value as DocType)} aria-label={L('Document type', 'ஆவண வகை')}>{(Object.keys(DOC_LABEL) as DocType[]).map(k => <option key={k} value={k}>{B(DOC_LABEL[k])}</option>)}</select>
    <label className="btn o sm" style={{ cursor: busy ? 'wait' : 'pointer' }}>📷 {busy ? L('Uploading…', 'பதிவேற்றுகிறது…') : L('Scan with camera', 'கேமரா மூலம் ஸ்கேன்')}
      <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} disabled={busy} onChange={e => { void take(e.target.files); e.target.value = ''; }} /></label>
    {msg && <span className="mu sm" role="status">{msg}</span>}
  </div>;
}
