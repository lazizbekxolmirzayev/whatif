import { Languages } from 'lucide-react';
import { LANGS, useLang } from '../../i18n';
import { cx } from './index';

/** Compact UZ / EN / RU switcher. */
export function LangSwitcher({ className }: { className?: string }) {
  const lang = useLang((s) => s.lang);
  const setLang = useLang((s) => s.setLang);
  return (
    <div className={cx('flex items-center gap-1 rounded-md bg-ink-950/70 p-1 ring-1 ring-gold-700/40', className)} role="group" aria-label="Language">
      <Languages className="mx-1 h-3.5 w-3.5 text-gold-300" />
      {LANGS.map((l) => (
        <button key={l.id} title={l.label} onClick={() => setLang(l.id)} className={cx('rounded px-2 py-1 text-[11px] font-bold transition', lang === l.id ? 'bg-gold-400 text-ink-950' : 'text-gold-200 hover:bg-ink-800')}>{l.short}</button>
      ))}
    </div>
  );
}
