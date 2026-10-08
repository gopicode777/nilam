import { useStore } from './store';
import type { Bi } from './types';
/** Inline bilingual strings: L('English', 'தமிழ்'). Reads the live language from the store, so switching back and forth always re-renders. */
export function useL() {
  const { lang } = useStore();
  const L = (en: string, ta: string) => (lang === 'ta' ? ta : en);
  const B = (b: Bi) => (lang === 'ta' ? b.ta : b.en);
  return { L, B, lang };
}
export const pick = (b: Bi, lang: 'en' | 'ta') => (lang === 'ta' ? b.ta : b.en);
