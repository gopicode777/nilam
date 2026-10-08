export type Bi = { en: string; ta: string };
export type Role = 'user' | 'admin';
export type Plan = 'free' | 'pro' | 'professional' | 'business';
export interface Prefs { email: boolean; whatsapp: boolean; alerts: boolean }
export interface User { prefs?: Prefs; id: string; name: string; email: string; mobile: string; role: Role; plan: Plan; credits: number; joined: string; status: 'active' | 'suspended' }
export type DocType = 'parent' | 'sale_deed' | 'patta' | 'chitta' | 'ec' | 'fmb' | 'approval' | 'tax';
export interface Field { v: string; conf: number; page: number }
export interface Doc { id: string; type: DocType; name: string; uploaded: string; verified: boolean; fields: Record<string, Field> }
export type NearbyItem = { name: string; km: number; lat: number; lng: number };
export type ClaimKind = 'distance' | 'approval' | 'title' | 'road' | 'price' | 'groundwater' | 'other';
export interface Claim { id: string; kind: ClaimKind; text: string; target?: string; km?: number; value?: number; guide?: number; by?: 'broker' | 'seller' | 'agent' }
export type Cat = 'legal' | 'revenue' | 'planning' | 'access' | 'environment' | 'neighbourhood' | 'market' | 'evidence';
export type Sev = 'critical' | 'high' | 'medium' | 'low' | 'info';
export interface Finding { id: string; cat: Cat; sev: Sev; title: Bi; why: Bi; evidence: string[]; conf: number; action: Bi }
export interface Audit { at: string; findings: Finding[]; cats: { cat: Cat; max: number; got: number; assessed: boolean }[]; total: number; coverage: number; verdict: Bi; tone: 'ok' | 'warn' | 'bad'; pending: Bi[]; counts: { critical: number; high: number; verify: number; pending: number } }
export interface Case {
  id: string; ownerId: string; created: string; district: string; taluk: string; village: string; survey: string; extent: number;
  seller: string; ptype: string; purpose: string; lat: number; lng: number; docs: Doc[]; claims: Claim[]; radius: number;
  share?: { token: string; on: boolean; at: string }; nearby?: Record<string, NearbyItem[]>; nearbyAt?: string; audit?: Audit; paid?: boolean;
}
export interface Review { prefer?: string; id: string; caseId: string; userId: string; kind: 'advocate' | 'surveyor' | 'planner' | 'valuer'; status: 'requested' | 'assigned' | 'completed'; assignee?: string; remark?: string; at: string }
export interface Log { id: string; at: string; actor: string; action: string; target?: string }
export interface Payment { id: string; userId: string; pack: string; credits: number; amount: number; at: string }
export interface Cfg { max: Record<Cat, number>; pen: Record<Sev, number>; cap: number }
export interface State { config?: Cfg; users: User[]; cases: Case[]; reviews: Review[]; logs: Log[]; payments: Payment[]; session: string | null; lang: 'en' | 'ta'; theme: 'light' | 'dark'; pending?: { name: string; email: string; mobile: string } }
