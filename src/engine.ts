import type { Audit, Bi, Case, Cat, Cfg, Claim, Doc, DocType, Field, Finding, NearbyItem, Sev } from './types';

export const DOC_LABEL: Record<DocType, Bi> = {
  parent: { en: 'Parent deed', ta: 'தாய்ப் பத்திரம்' }, sale_deed: { en: 'Sale deed', ta: 'விற்பனை பத்திரம்' }, patta: { en: 'Patta', ta: 'பட்டா' }, chitta: { en: 'Chitta', ta: 'சிட்டா' },
  ec: { en: 'Encumbrance certificate', ta: 'வில்லங்க சான்று' }, fmb: { en: 'FMB sketch', ta: 'FMB வரைபடம்' },
  approval: { en: 'Layout approval', ta: 'மனை அனுமதி' }, tax: { en: 'Tax receipt', ta: 'வரி ரசீது' },
};
export const FIELD_LABEL: Record<string, Bi> = {
  seller: { en: 'Seller', ta: 'விற்பவர்' }, buyer: { en: 'Buyer', ta: 'வாங்குபவர்' }, holder: { en: 'Holder', ta: 'பட்டாதாரர்' }, survey: { en: 'Survey no.', ta: 'சர்வே எண்' },
  extent: { en: 'Extent (sq.ft)', ta: 'பரப்பு (ச.அடி)' }, village: { en: 'Village', ta: 'கிராமம்' }, docno: { en: 'Document no.', ta: 'ஆவண எண்' },
  period: { en: 'Period', ta: 'காலம்' }, entries: { en: 'Encumbrance entries', ta: 'வில்லங்க பதிவுகள்' }, authority: { en: 'Authority', ta: 'அதிகார அமைப்பு' }, ref: { en: 'Reference', ta: 'குறிப்பு எண்' },
};
export const CAT_LABEL: Record<Cat, Bi> = {
  legal: { en: 'Legal', ta: 'சட்டம்' }, revenue: { en: 'Revenue & survey', ta: 'வருவாய் & சர்வே' }, planning: { en: 'Planning & approval', ta: 'திட்டமிடல் & அனுமதி' },
  access: { en: 'Access', ta: 'அணுகல்' }, environment: { en: 'Environment', ta: 'சுற்றுச்சூழல்' }, neighbourhood: { en: 'Neighbourhood', ta: 'சுற்றுப்புறம்' },
  market: { en: 'Market', ta: 'சந்தை' }, evidence: { en: 'Evidence quality', ta: 'ஆதார தரம்' },
};
export const DEFAULT_CFG: Cfg = { max: { legal: 20, revenue: 20, planning: 15, access: 10, environment: 10, neighbourhood: 10, market: 10, evidence: 5 }, pen: { critical: 1, high: 0.4, medium: 0.2, low: 0.08, info: 0 }, cap: 59 };

export const NEARBY_CATS: Record<string, { tag: [string, string]; label: Bi }> = {
  hospital: { tag: ['amenity', 'hospital'], label: { en: 'Hospitals', ta: 'மருத்துவமனைகள்' } },
  school: { tag: ['amenity', 'school'], label: { en: 'Schools', ta: 'பள்ளிகள்' } },
  college: { tag: ['amenity', 'college'], label: { en: 'Colleges', ta: 'கல்லூரிகள்' } },
  bank: { tag: ['amenity', 'bank'], label: { en: 'Banks', ta: 'வங்கிகள்' } },
  bus_station: { tag: ['amenity', 'bus_station'], label: { en: 'Bus stands', ta: 'பேருந்து நிலையம்' } },
  fuel: { tag: ['amenity', 'fuel'], label: { en: 'Petrol stations', ta: 'பெட்ரோல் நிலையம்' } },
  railway: { tag: ['railway', 'station'], label: { en: 'Railway stations', ta: 'ரயில் நிலையம்' } },
};

const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
export function detectType(name: string): DocType {
  const n = name.toLowerCase();
  if (/parent|mother|தாய்/.test(n)) return 'parent';
  if (/deed|sale|பத்திர/.test(n)) return 'sale_deed';
  if (/patta|பட்டா/.test(n)) return 'patta';
  if (/chitta|சிட்டா/.test(n)) return 'chitta';
  if (/\bec\b|encumb|வில்லங்க/.test(n)) return 'ec';
  if (/fmb|sketch/.test(n)) return 'fmb';
  if (/approv|dtcp|cmda|layout/.test(n)) return 'approval';
  return 'tax';
}
/** Demo extraction. Replace with the OCR/LLM service in api.ts. Patta extent is deliberately 12.5% lower so the mismatch rule can be seen. */
export function extract(type: DocType, c: Case, name: string): Record<string, Field> {
  const h = hash(name), f = (v: string, i: number): Field => ({ v, conf: 86 + ((h >> i) % 13), page: 1 + ((h >> (i + 1)) % 5) });
  const ext = String(c.extent), pext = String(Math.round(c.extent * 0.875));
  switch (type) {
    case 'sale_deed': return { seller: f(c.seller, 1), survey: f(c.survey, 2), extent: f(ext, 3), village: f(c.village, 4), docno: f('1842/2024', 5) };
    case 'parent': return { seller: f('Late T. Subramani', 1), buyer: f(c.seller, 2), survey: f(c.survey, 3), extent: f(ext, 4), docno: f('905/1998', 5) };
    case 'patta': return { holder: f(c.seller, 1), survey: f(c.survey, 2), extent: f(pext, 3), village: f(c.village, 4) };
    case 'chitta': return { holder: f(c.seller, 1), survey: f(c.survey, 2), extent: f(ext, 3) };
    case 'ec': return { survey: f(c.survey, 1), period: f('2011 – 2026', 2), entries: f('0', 3) };
    case 'fmb': return { survey: f(c.survey, 1), extent: f(ext, 2) };
    case 'approval': return { authority: f('DTCP', 1), ref: f('LP/2019/118', 2), survey: f(c.survey, 3) };
    default: return { holder: f(c.seller, 1), survey: f(c.survey, 2), period: f('2025 – 26', 3) };
  }
}
export function makeDoc(type: DocType, c: Case, name: string, at: string): Doc {
  return { id: 'D' + hash(name + at).toString(36), type, name, uploaded: at, verified: false, fields: extract(type, c, name) };
}

export const normSurvey = (s: string) => s.toLowerCase().replace(/[\s-]/g, '').replace(/\\/g, '/');
const toks = (s: string) => s.toLowerCase().replace(/[^a-z0-9\u0B80-\u0BFF ]/g, ' ').split(/\s+/).filter(Boolean);
export const ownerScore = (a: string, b: string) => { const x = new Set(toks(a)), y = toks(b); return y.filter(w => x.has(w)).length / Math.max(1, Math.min(x.size, y.length)); };
const num = (s?: string) => parseFloat((s ?? '').replace(/,/g, ''));
const doc = (c: Case, t: DocType) => c.docs.find(d => d.type === t);
const ref = (d: Doc, k: string) => `${DOC_LABEL[d.type].en} · p.${d.fields[k]?.page ?? 1}`;
const refTa = (d: Doc) => DOC_LABEL[d.type].ta;

export type ClaimResult = { res: 'supported' | 'partial' | 'not' | 'unverified'; note: Bi; needed?: Bi; who?: Bi; next?: Bi };
const bi = (en: string, ta: string): Bi => ({ en, ta });
/** A straight line is never longer than a road, so it can disprove a distance claim but never fully prove one. */
export function evalClaim(c: Case, cl: Claim): ClaimResult {
  const deed = doc(c, 'sale_deed'), patta = doc(c, 'patta'), ec = doc(c, 'ec'), appr = doc(c, 'approval');
  switch (cl.kind) {
    case 'distance': {
      const list: NearbyItem[] | undefined = c.nearby?.[cl.target ?? ''];
      if (!list) return { res: 'unverified', note: bi('Location data has not been fetched for this category.', 'இந்த வகைக்கான இடத் தரவு பெறப்படவில்லை.'), needed: bi('Nearby map data for this pin.', 'இந்த பின்னுக்கான வரைபட தரவு.'), who: bi('You', 'நீங்கள்'), next: bi('Open Location and analyse this category.', 'இடம் பகுதியில் இந்த வகையை பகுப்பாய்வு செய்க.') };
      if (!list.length) return { res: 'not', note: bi(`Nothing found within ${c.radius / 1000} km.`, `${c.radius / 1000} கி.மீ-க்குள் இல்லை.`), next: bi('Ask the broker which place they mean.', 'எந்த இடத்தை குறிக்கிறார் என தரகரிடம் கேளுங்கள்.') };
      const km = list[0].km, claim = cl.km ?? 0, n = `${km.toFixed(1)} km`;
      return km <= claim
        ? { res: 'supported', note: bi(`Nearest is ${n} in a straight line. Consistent with the claim.`, `அருகிலுள்ளது நேர்கோட்டில் ${n}. கூற்றுடன் ஒத்துப்போகிறது.`), needed: bi('Road distance. A straight line cannot prove it.', 'சாலை தூரம்; நேர்கோடு நிரூபிக்காது.'), who: bi('You, on the map', 'நீங்கள், வரைபடத்தில்'), next: bi('Check the real road route before relying on it.', 'நம்புவதற்கு முன் உண்மை சாலை வழியை பாருங்கள்.') }
        : { res: 'not', note: bi(`Nearest is ${n} even in a straight line, so by road it is longer than the claimed ${claim} km.`, `நேர்கோட்டிலேயே ${n}; சாலையில் இன்னும் அதிகம். கூறியது ${claim} கி.மீ.`), next: bi('Ask the broker to correct or justify the claim in writing.', 'தரகர் கூற்றை திருத்த / எழுத்தில் நியாயப்படுத்த கேளுங்கள்.') };
    }
    case 'approval':
      return appr && normSurvey(appr.fields.survey?.v ?? '') === normSurvey(c.survey)
        ? { res: 'partial', note: bi(`Reference ${appr.fields.ref?.v} appears in your documents. That is the seller's paper, not an official confirmation.`, `ஆவணங்களில் ${appr.fields.ref?.v} உள்ளது. இது விற்பவரின் ஆவணம்; அதிகாரப்பூர்வ உறுதி அல்ல.`), needed: bi('Written confirmation from the planning authority.', 'திட்ட அமைப்பின் எழுத்து உறுதி.'), who: bi('DTCP / CMDA / local body', 'DTCP / CMDA / உள்ளாட்சி'), next: bi('Ask the authority to confirm this reference and your plot number.', 'இந்த எண்ணையும் உங்கள் மனை எண்ணையும் அதிகாரியிடம் உறுதி செய்க.') }
        : { res: 'unverified', note: bi('No approval reference found for this survey number.', 'இந்த சர்வே எண்ணுக்கு அனுமதி எண் இல்லை.'), needed: bi('Approval number and approved layout plan.', 'அனுமதி எண், அங்கீகரிக்கப்பட்ட வரைபடம்.'), who: bi('Planning authority or advocate', 'திட்ட அமைப்பு / வழக்கறிஞர்'), next: bi('Ask the seller for the approval number, then confirm with the authority.', 'விற்பவரிடம் அனுமதி எண் கேட்டு அதிகாரியிடம் உறுதி செய்க.') };
    case 'title': {
      if (!ec) return { res: 'unverified', note: bi('No encumbrance certificate uploaded.', 'வில்லங்க சான்று பதிவேற்றப்படவில்லை.'), needed: bi('EC for at least 13 years and the deeds.', 'குறைந்தது 13 ஆண்டு EC, பத்திரங்கள்.'), who: bi('Advocate', 'வழக்கறிஞர்'), next: bi('Upload the EC, then request an advocate review.', 'EC பதிவேற்றி வழக்கறிஞர் மதிப்பாய்வு கோருங்கள்.') };
      const bad = num(ec.fields.entries?.v) > 0 || (deed && patta && ownerScore(deed.fields.seller?.v ?? '', patta.fields.holder?.v ?? '') < 0.8);
      return bad ? { res: 'not', note: bi('The EC lists entries, or the seller and patta names differ.', 'EC-ல் பதிவுகள் உள்ளன, அல்லது விற்பவர் - பட்டா பெயர் வேறு.'), next: bi('Ask for discharge proof and the link document.', 'விடுவிப்பு ஆதாரம், இணைப்பு ஆவணம் கேளுங்கள்.') }
        : { res: 'partial', note: bi('EC shows no entries and the names match. That is encouraging, not a certified title.', 'EC-ல் பதிவு இல்லை; பெயர்கள் பொருந்துகின்றன. ஊக்கமளிக்கிறது; சான்றளிக்கப்பட்ட உரிமை அல்ல.'), needed: bi('A legal title opinion.', 'சட்ட உரிமை கருத்து.'), who: bi('Advocate', 'வழக்கறிஞர்'), next: bi('Request an advocate review.', 'வழக்கறிஞர் மதிப்பாய்வு கோருங்கள்.') };
    }
    case 'price': {
      const v = cl.value ?? 0, g = cl.guide;
      if (!g) return { res: 'unverified', note: bi('Guideline value not entered, so the price cannot be placed in context.', 'வழிகாட்டி மதிப்பு இல்லை; விலையை ஒப்பிட முடியாது.'), needed: bi('Guideline value for this survey number.', 'இந்த சர்வே எண்ணுக்கான வழிகாட்டி மதிப்பு.'), who: bi('Sub-registrar office or TNREGINET', 'சார்பதிவாளர் அலுவலகம் / TNREGINET'), next: bi('Add the guideline value to this claim.', 'கூற்றில் வழிகாட்டி மதிப்பை சேர்க்கவும்.') };
      const r = v / g, t = `${r.toFixed(2)}×`;
      return r <= 1.25 ? { res: 'supported', note: bi(`Claimed price is ${t} the guideline value.`, `கூறிய விலை வழிகாட்டி மதிப்பின் ${t}.`) } : r <= 2 ? { res: 'partial', note: bi(`Claimed price is ${t} the guideline value. Ask what justifies the premium.`, `கூறிய விலை வழிகாட்டி மதிப்பின் ${t}. கூடுதலுக்கு காரணம் கேளுங்கள்.`), who: bi('Valuer', 'மதிப்பீட்டாளர்'), next: bi('Compare with recent registered sales nearby.', 'அருகிலுள்ள சமீபத்திய பதிவு விற்பனைகளுடன் ஒப்பிடுக.') } : { res: 'not', note: bi(`Claimed price is ${t} the guideline value.`, `கூறிய விலை வழிகாட்டி மதிப்பின் ${t}.`), who: bi('Valuer', 'மதிப்பீட்டாளர்'), next: bi('Request a valuer review before negotiating.', 'பேரத்துக்கு முன் மதிப்பீட்டாளர் மதிப்பாய்வு கோருங்கள்.') };
    }
    case 'road': return { res: 'unverified', note: bi('No road-width source is connected.', 'சாலை அகலத்திற்கு தரவு மூலம் இணைக்கப்படவில்லை.'), needed: bi('Site measurement or the approved layout plan.', 'நேரில் அளவு அல்லது அங்கீகரிக்கப்பட்ட வரைபடம்.'), who: bi('Surveyor or planning authority', 'சர்வேயர் / திட்ட அமைப்பு'), next: bi('Measure on site with a surveyor.', 'சர்வேயருடன் நேரில் அளக்கவும்.') };
    case 'groundwater': return { res: 'unverified', note: bi('Groundwater cannot be established from documents or maps.', 'ஆவணங்கள், வரைபடங்களிலிருந்து நிலத்தடி நீரை அறிய முடியாது.'), needed: bi('Nearby borewell records or a site visit.', 'அருகிலுள்ள ஆழ்துளை பதிவுகள் / நேரடி ஆய்வு.'), who: bi('Hydrogeology professional', 'நீரியல் நிபுணர்'), next: bi('Ask neighbouring owners and check borewell depth.', 'அண்டை உரிமையாளர்களிடம் கேட்டு ஆழ்துளை ஆழம் பாருங்கள்.') };
    default: return { res: 'unverified', note: bi('This claim does not match anything the system can check.', 'இந்த கூற்றை சரிபார்க்க முடியாது.'), needed: bi('Independent written proof.', 'சுயாதீன எழுத்து ஆதாரம்.'), who: bi('Depends on the claim', 'கூற்றை பொறுத்து'), next: bi('Ask the seller for written proof.', 'விற்பவரிடம் எழுத்து ஆதாரம் கேளுங்கள்.') };
  }
}
const CLAIM_CAT: Record<string, Cat> = { distance: 'neighbourhood', approval: 'planning', title: 'legal', price: 'market', road: 'access', groundwater: 'environment', other: 'evidence' };

/** Checks that passed: the "key highlights" of a report. */
export function passes(c: Case): Bi[] {
  const out: Bi[] = [], deed = doc(c, 'sale_deed'), patta = doc(c, 'patta'), ec = doc(c, 'ec'), parent = doc(c, 'parent'), appr = doc(c, 'approval');
  const sv = c.docs.map(d => d.fields.survey?.v).filter(Boolean) as string[];
  if (sv.length >= 2 && sv.every(x => normSurvey(x) === normSurvey(c.survey))) out.push(bi(`Survey number ${c.survey} is the same in all ${sv.length} documents`, `சர்வே எண் ${c.survey} அனைத்து ${sv.length} ஆவணங்களிலும் ஒன்றே`));
  if (deed && patta && ownerScore(deed.fields.seller?.v ?? '', patta.fields.holder?.v ?? '') >= 0.8) out.push(bi('Seller name matches the patta holder', 'விற்பவர் பெயர் பட்டாதாரருடன் பொருந்துகிறது'));
  if (deed && patta && Math.abs(num(deed.fields.extent?.v) - num(patta.fields.extent?.v)) / Math.max(num(deed.fields.extent?.v), 1) <= 0.02) out.push(bi('Extent matches between deed and patta', 'பத்திரம் - பட்டா பரப்பு பொருந்துகிறது'));
  if (ec && num(ec.fields.entries?.v) === 0) out.push(bi(`No encumbrance entries in ${ec.fields.period?.v}`, `${ec.fields.period?.v} காலத்தில் வில்லங்க பதிவு இல்லை`));
  if (parent && deed && ownerScore(parent.fields.buyer?.v ?? '', deed.fields.seller?.v ?? '') >= 0.6) out.push(bi('Parent deed leads to the current seller', 'தாய்ப் பத்திரம் தற்போதைய விற்பவருக்கு வருகிறது'));
  if (appr && normSurvey(appr.fields.survey?.v ?? '') === normSurvey(c.survey)) out.push(bi(`Approval reference ${appr.fields.ref?.v} found for this survey number`, `இந்த சர்வே எண்ணுக்கு அனுமதி ${appr.fields.ref?.v} உள்ளது`));
  const h = c.nearby?.hospital?.[0], s = c.nearby?.school?.[0];
  if (h) out.push(bi(`Nearest hospital ${h.km.toFixed(1)} km away (straight line)`, `அருகிலுள்ள மருத்துவமனை ${h.km.toFixed(1)} கி.மீ (நேர்கோடு)`));
  if (s) out.push(bi(`Nearest school ${s.km.toFixed(1)} km away (straight line)`, `அருகிலுள்ள பள்ளி ${s.km.toFixed(1)} கி.மீ (நேர்கோடு)`));
  return out;
}
export type StatusRow = { label: Bi; value: Bi; tone: '' | 'a' | 'r' | 'n' };
/** Four headline rows used at the top of the report. */
export function statusRows(c: Case): StatusRow[] {
  const a = c.audit!, has = (cat: Cat) => a.cats.find(x => x.cat === cat)?.assessed, sev = (cat: Cat) => a.findings.filter(f => f.cat === cat).map(f => f.sev);
  const row = (label: Bi, cat: Cat, ok: Bi, minor: Bi, bad: Bi): StatusRow => { const s = sev(cat); return !has(cat) ? { label, value: bi('Not checked', 'சரிபார்க்கவில்லை'), tone: 'n' } : s.some(x => x === 'critical' || x === 'high') ? { label, value: bad, tone: 'r' } : s.some(x => x === 'medium' || x === 'low') ? { label, value: minor, tone: 'a' } : { label, value: ok, tone: '' }; };
  const mkt = c.claims.find(k => k.kind === 'price' && k.guide);
  return [
    row(bi('Legal status', 'சட்ட நிலை'), 'legal', bi('Clear', 'தெளிவு'), bi('Review', 'ஆய்வு'), bi('Issues found', 'சிக்கல்கள்')),
    row(bi('Physical condition', 'நில நிலை'), 'revenue', bi('Consistent', 'ஒத்துப்போகிறது'), bi('Minor issues', 'சிறு சிக்கல்'), bi('Issues found', 'சிக்கல்கள்')),
    row(bi('Location & connectivity', 'இடம் & இணைப்பு'), 'neighbourhood', bi('Good', 'நன்று'), bi('Fair', 'நடுத்தரம்'), bi('Weak', 'பலவீனம்')),
    mkt ? { label: bi('Financial value', 'நிதி மதிப்பு'), value: bi(`₹${mkt.value}/sq.ft vs guideline ₹${mkt.guide}`, `₹${mkt.value}/ச.அடி; வழிகாட்டி ₹${mkt.guide}`), tone: evalClaim(c, mkt).res === 'not' ? 'r' : evalClaim(c, mkt).res === 'partial' ? 'a' : '' } : { label: bi('Financial value', 'நிதி மதிப்பு'), value: bi('Not verified', 'சரிபார்க்கப்படவில்லை'), tone: 'n' },
  ];
}

export function analyze(c: Case, cfg: Cfg = DEFAULT_CFG): Audit {
  const MAX = cfg.max, PEN = cfg.pen;
  const F: Finding[] = [], pending: Bi[] = [];
  const add = (cat: Cat, sev: Sev, title: Bi, why: Bi, evidence: string[], conf: number, action: Bi) => F.push({ id: 'F' + (F.length + 1), cat, sev, title, why, evidence, conf, action });
  const parent = doc(c, 'parent'), deed = doc(c, 'sale_deed'), patta = doc(c, 'patta'), ec = doc(c, 'ec'), appr = doc(c, 'approval');
  const minConf = (...v: (Field | undefined)[]) => Math.min(...v.map(x => x?.conf ?? 80));

  if (deed && normSurvey(deed.fields.survey?.v ?? '') !== normSurvey(c.survey))
    add('legal', 'medium', { en: 'Survey number on deed differs from the one you entered', ta: 'பத்திரத்தில் உள்ள சர்வே எண் நீங்கள் கொடுத்ததிலிருந்து வேறுபடுகிறது' },
      { en: `Deed shows ${deed.fields.survey?.v}, case says ${c.survey}.`, ta: `பத்திரம்: ${deed.fields.survey?.v}; நீங்கள்: ${c.survey}.` }, [ref(deed, 'survey')], minConf(deed.fields.survey),
      { en: 'Confirm the correct survey and sub-division number with the seller.', ta: 'சரியான சர்வே / உட்பிரிவு எண்ணை விற்பவரிடம் உறுதி செய்யவும்.' });
  if (parent && deed && ownerScore(parent.fields.buyer?.v ?? '', deed.fields.seller?.v ?? '') < 0.6)
    add('legal', 'high', { en: 'Ownership chain break: parent deed buyer is not the seller', ta: 'உரிமை சங்கிலி உடைவு: தாய்ப் பத்திர வாங்குபவர் விற்பவரல்ல' },
      { en: `Parent deed transfers to "${parent.fields.buyer?.v}" but the sale deed is signed by "${deed.fields.seller?.v}".`, ta: `தாய்ப் பத்திரம் "${parent.fields.buyer?.v}" பெயருக்கு; விற்பனை பத்திரத்தில் "${deed.fields.seller?.v}".` },
      [ref(parent, 'buyer'), ref(deed, 'seller')], minConf(parent.fields.buyer, deed.fields.seller), { en: 'Ask for the document that links the two names (sale, gift, will or legal-heir certificate).', ta: 'இரு பெயர்களையும் இணைக்கும் ஆவணம் (விற்பனை, தானம், உயில், வாரிசு சான்று) கேட்கவும்.' });
  if (deed && patta) {
    if (normSurvey(deed.fields.survey?.v ?? '') !== normSurvey(patta.fields.survey?.v ?? ''))
      add('revenue', 'high', { en: 'Survey number mismatch between deed and patta', ta: 'பத்திரம் - பட்டா சர்வே எண் பொருந்தவில்லை' },
        { en: `Deed ${deed.fields.survey?.v} vs Patta ${patta.fields.survey?.v}.`, ta: `பத்திரம் ${deed.fields.survey?.v} / பட்டா ${patta.fields.survey?.v}.` }, [ref(deed, 'survey'), ref(patta, 'survey')], minConf(deed.fields.survey, patta.fields.survey),
        { en: 'Verify with taluk revenue records or a licensed surveyor.', ta: 'வட்ட வருவாய் பதிவுகள் அல்லது உரிமம் பெற்ற சர்வேயரிடம் சரிபார்க்கவும்.' });
    const a = num(deed.fields.extent?.v), b = num(patta.fields.extent?.v), pct = Math.abs(a - b) / Math.max(a, b, 1);
    if (pct > 0.02) add('revenue', pct > 0.1 ? 'high' : 'medium', { en: `Extent mismatch: deed ${a} vs patta ${b} sq.ft`, ta: `பரப்பு பொருந்தவில்லை: பத்திரம் ${a} / பட்டா ${b} ச.அடி` },
      { en: `Difference of ${Math.abs(a - b)} sq.ft (${(pct * 100).toFixed(1)}%). This is a mismatch to verify, not a finding that the land is illegal.`, ta: `${Math.abs(a - b)} ச.அடி வேறுபாடு (${(pct * 100).toFixed(1)}%). இது சரிபார்க்க வேண்டிய பொருத்தமின்மை; நிலம் சட்டவிரோதம் என்று பொருளல்ல.` },
      [ref(deed, 'extent'), ref(patta, 'extent')], minConf(deed.fields.extent, patta.fields.extent),
      { en: 'Verify extent with revenue records and a surveyor before paying any advance.', ta: 'முன்பணம் கொடுக்கும் முன் வருவாய் பதிவு மற்றும் சர்வேயரிடம் பரப்பை சரிபார்க்கவும்.' });
    const o = ownerScore(deed.fields.seller?.v ?? '', patta.fields.holder?.v ?? '');
    if (o < 0.8) add('legal', o < 0.5 ? 'critical' : 'medium', { en: 'Seller name does not match patta holder', ta: 'விற்பவர் பெயர் பட்டாதாரருடன் பொருந்தவில்லை' },
      { en: `Deed seller "${deed.fields.seller?.v}" vs patta holder "${patta.fields.holder?.v}".`, ta: `பத்திர விற்பவர் "${deed.fields.seller?.v}" / பட்டாதாரர் "${patta.fields.holder?.v}".` },
      [ref(deed, 'seller'), ref(patta, 'holder')], minConf(deed.fields.seller, patta.fields.holder),
      { en: 'Ask for the link document (parent deed, will or legal-heir certificate) and have an advocate review it.', ta: 'தாய்ப் பத்திரம் / உயில் / வாரிசு சான்று கேட்டு வழக்கறிஞரிடம் காட்டவும்.' });
  }
  if (ec && num(ec.fields.entries?.v) > 0) add('legal', 'high', { en: `${ec.fields.entries.v} encumbrance entries found`, ta: `${ec.fields.entries.v} வில்லங்க பதிவுகள் உள்ளன` },
    { en: 'The EC lists registered charges such as mortgage or attachment on this survey number.', ta: 'இந்த சர்வே எண்ணில் அடமானம் / முடக்கம் போன்ற பதிவுகள் EC-யில் உள்ளன.' }, [ref(ec, 'entries')], ec.fields.entries.conf,
    { en: 'Get discharge proof for each entry before registration.', ta: 'பதிவுக்கு முன் ஒவ்வொரு பதிவுக்கும் விடுவிப்பு ஆதாரம் பெறவும்.' });
  if (appr && normSurvey(appr.fields.survey?.v ?? '') !== normSurvey(c.survey)) add('planning', 'high', { en: 'Approval is for a different survey number', ta: 'அனுமதி வேறு சர்வே எண்ணுக்கானது' },
    { en: `Approval lists ${appr.fields.survey?.v}.`, ta: `அனுமதியில்: ${appr.fields.survey?.v}.` }, [ref(appr, 'survey')], minConf(appr.fields.survey), { en: 'Ask the authority to confirm the layout covers your plot.', ta: 'உங்கள் மனை அந்த லேஅவுட்டில் உள்ளதா என அதிகாரியிடம் உறுதி செய்யவும்.' });
  const unconfirmed = c.docs.filter(d => !d.verified);
  const low = c.docs.flatMap(d => Object.entries(d.fields).filter(([, f]) => f.conf < 88 && !d.verified).map(([k]) => ref(d, k)));
  if (low.length) add('evidence', 'low', { en: `${low.length} extracted values have low confidence`, ta: `${low.length} மதிப்புகளின் நம்பகத்தன்மை குறைவு` }, { en: 'OCR was unsure about these values and you have not confirmed them.', ta: 'இவற்றில் OCR உறுதியாக இல்லை; நீங்களும் உறுதி செய்யவில்லை.' }, low.slice(0, 4), 70, { en: 'Open Documents and confirm or edit each value.', ta: 'ஆவணங்கள் பகுதியில் மதிப்புகளை உறுதி செய்யவும் / திருத்தவும்.' });
  if (unconfirmed.length) add('evidence', 'info', { en: `${unconfirmed.length} document(s) not confirmed by you`, ta: `${unconfirmed.length} ஆவணம் உங்களால் உறுதி செய்யப்படவில்லை` }, { en: 'Unconfirmed values lower the evidence score.', ta: 'உறுதி செய்யாத மதிப்புகள் ஆதார மதிப்பெண்ணை குறைக்கும்.' }, unconfirmed.map(d => DOC_LABEL[d.type].en), 90, { en: 'Confirm values in Documents.', ta: 'ஆவணங்களில் உறுதி செய்யவும்.' });
  c.claims.forEach(cl => { const r = evalClaim(c, cl); if (r.res === 'not' || (r.res === 'partial' && cl.kind === 'price')) add(CLAIM_CAT[cl.kind], r.res === 'not' ? 'medium' : 'low', { en: `Claim not supported: ${cl.text}`, ta: `கூற்று உறுதியாகவில்லை: ${cl.text}` }, r.note, [cl.kind === 'distance' ? 'Map data · OpenStreetMap' : `Claim by ${cl.by ?? 'broker'}`], 80, r.next ?? { en: 'Ask for written proof.', ta: 'எழுத்து ஆதாரம் கேளுங்கள்.' }); });

  if (!parent) pending.push({ en: 'Parent deed not uploaded: earlier ownership not checked', ta: 'தாய்ப் பத்திரம் இல்லை: முந்தைய உரிமை சரிபார்க்கப்படவில்லை' });
  if (!deed) pending.push({ en: 'Sale deed not uploaded: ownership chain not checked', ta: 'விற்பனை பத்திரம் இல்லை: உரிமை சங்கிலி சரிபார்க்கப்படவில்லை' });
  if (!patta) pending.push({ en: 'Patta not uploaded: revenue records not checked', ta: 'பட்டா இல்லை: வருவாய் பதிவு சரிபார்க்கப்படவில்லை' });
  if (!ec) pending.push({ en: 'Encumbrance certificate not uploaded', ta: 'வில்லங்க சான்று பதிவேற்றப்படவில்லை' });
  if (!appr) pending.push({ en: 'Layout / planning approval not verified', ta: 'மனை / திட்ட அனுமதி சரிபார்க்கப்படவில்லை' });
  pending.push({ en: 'Road access and width: no reliable source connected', ta: 'சாலை அணுகல், அகலம்: நம்பகமான தரவு மூலம் இணைக்கப்படவில்லை' });
  pending.push({ en: 'Flood, groundwater, eco-sensitive zones: source not connected', ta: 'வெள்ளம், நிலத்தடி நீர், சூழல் மண்டலம்: தரவு மூலம் இணைக்கப்படவில்லை' });
  pending.push({ en: 'Price context: guideline and registered-price source not connected', ta: 'விலை சூழல்: வழிகாட்டி / பதிவு விலை தரவு இணைக்கப்படவில்லை' });
  c.claims.filter(k => evalClaim(c, k).res === 'unverified').slice(0, 3).forEach(k => pending.push({ en: `Claim not verified: ${k.text}`, ta: `கூற்று சரிபார்க்கப்படவில்லை: ${k.text}` }));
  if (!c.nearby) pending.push({ en: 'Neighbourhood: run the location analysis', ta: 'சுற்றுப்புறம்: இடப் பகுப்பாய்வை இயக்கவும்' });

  const assessed: Record<Cat, boolean> = { legal: !!(deed || ec), revenue: !!patta, planning: !!appr, access: false, environment: false, neighbourhood: !!c.nearby, market: c.claims.some(k => k.kind === 'price' && !!k.guide), evidence: c.docs.length > 0 };
  const cats = (Object.keys(MAX) as Cat[]).map(cat => {
    const pen = Math.min(1, F.filter(f => f.cat === cat).reduce((s, f) => s + PEN[f.sev], 0));
    const base = cat === 'evidence' ? (c.docs.length ? c.docs.filter(d => d.verified).length / c.docs.length : 0) : 1 - pen;
    return { cat, max: MAX[cat], got: assessed[cat] ? +(MAX[cat] * Math.max(0, cat === 'evidence' ? base * (1 - pen) : base)).toFixed(1) : 0, assessed: assessed[cat] };
  });
  const amax = cats.filter(x => x.assessed).reduce((s, x) => s + x.max, 0);
  let total = amax ? Math.round((cats.reduce((s, x) => s + x.got, 0) / amax) * 100) : 0;
  const critical = F.filter(f => f.sev === 'critical').length;
  if (critical) total = Math.min(total, cfg.cap);
  const tone = total >= 80 ? 'ok' : total >= 60 ? 'warn' : 'bad';
  const verdict: Bi = tone === 'ok' ? { en: 'Low observed risk on what was checked', ta: 'சரிபார்த்தவற்றில் குறைந்த அபாயம்' } : tone === 'warn' ? { en: 'Proceed only after the listed verifications', ta: 'பட்டியலிட்ட சரிபார்ப்புகளுக்கு பின் தொடரவும்' } : { en: 'Resolve the issues before paying any advance', ta: 'முன்பணம் கொடுக்கும் முன் சிக்கல்களை தீர்க்கவும்' };
  return { at: new Date().toISOString(), findings: F, cats, total, coverage: amax, verdict, tone, pending, counts: { critical, high: F.filter(f => f.sev === 'high').length, verify: F.filter(f => f.sev === 'medium' || f.sev === 'low').length, pending: pending.length } };
}

export type ChainNode = { key: string; title: Bi; who?: string; detail: Bi; status: 'ok' | 'warn' | 'missing' };
/** Ownership and record chain, oldest first. Each link is checked against the next one. */
export function buildChain(c: Case): ChainNode[] {
  const parent = doc(c, 'parent'), deed = doc(c, 'sale_deed'), patta = doc(c, 'patta'), ec = doc(c, 'ec'), tax = doc(c, 'tax');
  const miss: Bi = { en: 'Not provided. This link is not verified.', ta: 'வழங்கப்படவில்லை. இந்த இணைப்பு சரிபார்க்கப்படவில்லை.' };
  const out: ChainNode[] = [];
  out.push(parent ? { key: 'parent', title: DOC_LABEL.parent, who: `${parent.fields.seller?.v} → ${parent.fields.buyer?.v}`, status: ownerScore(parent.fields.buyer?.v ?? '', deed?.fields.seller?.v ?? parent.fields.buyer?.v ?? '') >= 0.6 ? 'ok' : 'warn', detail: { en: `Doc no. ${parent.fields.docno?.v}. Earlier transfer into the seller's name.`, ta: `ஆவண எண் ${parent.fields.docno?.v}. விற்பவர் பெயருக்கு முந்தைய மாற்றம்.` } }
    : { key: 'parent', title: DOC_LABEL.parent, status: 'missing', detail: miss });
  out.push(deed ? { key: 'deed', title: DOC_LABEL.sale_deed, who: `${deed.fields.seller?.v} → ${L_YOU}`, status: parent && ownerScore(parent.fields.buyer?.v ?? '', deed.fields.seller?.v ?? '') < 0.6 ? 'warn' : 'ok', detail: { en: `Doc no. ${deed.fields.docno?.v}, ${deed.fields.extent?.v} sq.ft, S.No ${deed.fields.survey?.v}.`, ta: `ஆவண எண் ${deed.fields.docno?.v}, ${deed.fields.extent?.v} ச.அடி, சர்வே ${deed.fields.survey?.v}.` } }
    : { key: 'deed', title: DOC_LABEL.sale_deed, status: 'missing', detail: miss });
  out.push(patta ? { key: 'patta', title: DOC_LABEL.patta, who: patta.fields.holder?.v, status: deed && (ownerScore(deed.fields.seller?.v ?? '', patta.fields.holder?.v ?? '') < 0.8 || Math.abs(num(deed.fields.extent?.v) - num(patta.fields.extent?.v)) / Math.max(num(deed.fields.extent?.v), 1) > 0.02) ? 'warn' : 'ok', detail: { en: `Current revenue record: ${patta.fields.extent?.v} sq.ft.`, ta: `தற்போதைய வருவாய் பதிவு: ${patta.fields.extent?.v} ச.அடி.` } }
    : { key: 'patta', title: DOC_LABEL.patta, status: 'missing', detail: miss });
  out.push(ec ? { key: 'ec', title: DOC_LABEL.ec, who: ec.fields.period?.v, status: num(ec.fields.entries?.v) > 0 ? 'warn' : 'ok', detail: { en: `${ec.fields.entries?.v} encumbrance entries in the period.`, ta: `காலத்தில் ${ec.fields.entries?.v} வில்லங்க பதிவுகள்.` } } : { key: 'ec', title: DOC_LABEL.ec, status: 'missing', detail: miss });
  out.push(tax ? { key: 'tax', title: DOC_LABEL.tax, who: tax.fields.holder?.v, status: 'ok', detail: { en: `Tax paid for ${tax.fields.period?.v}.`, ta: `${tax.fields.period?.v} வரி செலுத்தப்பட்டது.` } } : { key: 'tax', title: DOC_LABEL.tax, status: 'missing', detail: miss });
  return out;
}
const L_YOU = 'Buyer';

/** Questions to put to the seller, driven by the findings and by what is missing. */
export function sellerQuestions(c: Case): { q: Bi; ref?: string }[] {
  const a = c.audit, out: { q: Bi; ref?: string }[] = [];
  a?.findings.filter(f => f.sev !== 'info').forEach(f => out.push({ q: f.action, ref: f.id }));
  const has = (t: DocType) => c.docs.some(d => d.type === t);
  if (!has('parent')) out.push({ q: { en: 'Please share the parent deed (how you became the owner).', ta: 'தாய்ப் பத்திரத்தை (நீங்கள் உரிமையாளரான விதம்) காட்டவும்.' } });
  if (!has('ec')) out.push({ q: { en: 'Please share a recent encumbrance certificate covering at least 13 years.', ta: 'குறைந்தது 13 ஆண்டுகளுக்கான சமீபத்திய வில்லங்க சான்றை காட்டவும்.' } });
  if (!has('approval') && c.ptype !== 'Agricultural') out.push({ q: { en: 'What is the layout approval number and which authority issued it?', ta: 'லேஅவுட் அனுமதி எண் என்ன, எந்த அமைப்பு வழங்கியது?' } });
  if (!has('tax')) out.push({ q: { en: 'Please share the latest property tax or land revenue receipt.', ta: 'சமீபத்திய சொத்து வரி / நில வரி ரசீதை காட்டவும்.' } });
  c.claims.filter(k => ['unverified', 'not', 'partial'].includes(evalClaim(c, k).res)).slice(0, 4).forEach(k => out.push({ q: { en: `Please give written proof for: ${k.text}`, ta: `இதற்கு எழுத்து ஆதாரம் தரவும்: ${k.text}` } }));
  out.push({ q: { en: 'Is there any loan, mortgage, dispute or court case on this land? Please confirm in writing.', ta: 'இந்த நிலத்தில் கடன், அடமானம், தகராறு, வழக்கு உள்ளதா? எழுத்தில் உறுதி செய்யவும்.' } });
  out.push({ q: { en: 'Can we measure the plot with a surveyor against the FMB sketch before the advance?', ta: 'முன்பணத்துக்கு முன் FMB வரைபடத்துடன் சர்வேயர் மூலம் அளக்கலாமா?' } });
  return out;
}
