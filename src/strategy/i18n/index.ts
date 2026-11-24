import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DICT } from './dict';

export type Lang = 'uz' | 'en' | 'ru';
export const LANGS: { id: Lang; label: string; short: string }[] = [
  { id: 'uz', label: "O'zbekcha", short: 'UZ' },
  { id: 'en', label: 'English', short: 'EN' },
  { id: 'ru', label: 'Русский', short: 'RU' },
];

function detect(): Lang {
  const n = (typeof navigator !== 'undefined' ? navigator.language : 'en').toLowerCase();
  if (n.startsWith('uz')) return 'uz';
  if (n.startsWith('ru')) return 'ru';
  return 'en';
}

interface LangState { lang: Lang; setLang: (l: Lang) => void }
export const useLang = create<LangState>()(persist((set) => ({
  lang: detect(),
  setLang: (lang) => { if (typeof document !== 'undefined') document.documentElement.lang = lang; set({ lang }); },
}), {
  name: 'whatif-lang',
  onRehydrateStorage: () => (s) => { if (s && typeof document !== 'undefined') document.documentElement.lang = s.lang; },
}));

/** Translate an English source string. Unknown strings fall back to English. */
export function translate(lang: Lang, text: string): string {
  if (lang === 'en') return text;
  return DICT[text]?.[lang] ?? text;
}

/** Non-hook translation using the current language (for toasts, data tables). */
export function tr(text: string): string { return translate(useLang.getState().lang, text); }

/** Hook: returns a `t` function that re-renders the component when the language changes. */
export function useT(): (text: string) => string {
  const lang = useLang((s) => s.lang);
  return (text: string) => translate(lang, text);
}
