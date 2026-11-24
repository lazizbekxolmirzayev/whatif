import { NavLink, Outlet, useLocation } from 'react-router-dom';
import NextLink from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { Award, BookOpen, Castle, Compass, Crown, Globe2, Home, Menu, ScrollText, Settings, Swords, User, Users, X } from 'lucide-react';
import { useState } from 'react';
import { WorldMap } from '../map/WorldMap';
import { useDataset } from '../../hooks/useDataset';
import { cx } from '../ui';
import { useProfile } from '../../services/profile';
import { useT } from '../../i18n';
import { LangSwitcher } from '../ui/LangSwitcher';

export const NAV = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/scenarios', label: 'What If History', icon: ScrollText },
  { to: '/sandbox', label: 'Imperial Sandbox', icon: Crown },
  { to: '/library', label: 'Scenario Library', icon: BookOpen },
  { to: '/explorer', label: 'World Explorer', icon: Compass },
  { to: '/saves', label: 'My Worlds', icon: Castle },
  { to: '/multiplayer', label: 'Multiplayer', icon: Users },
  { to: '/achievements', label: 'Achievements', icon: Award },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function Logo({ small }: { small?: boolean }) {
  return (
    <NavLink to="/" className="flex items-center gap-2.5">
      <span className={cx('flex items-center justify-center rounded-full bg-gradient-to-b from-gold-100 to-gold-600 text-ink-950 shadow-glow ring-1 ring-gold-700', small ? 'h-8 w-8' : 'h-10 w-10')}><Globe2 className={small ? 'h-4 w-4' : 'h-5 w-5'} /></span>
      <span className={cx('title-display gold-text font-extrabold', small ? 'text-lg' : 'text-xl')}>What If?</span>
    </NavLink>
  );
}

const BACKDROP_KEYS = ['1400', '1530', '1815', '1200', '100'];
export function MapBackdrop({ dim = 0.55 }: { dim?: number }) {
  const [key] = useState(() => BACKDROP_KEYS[Math.floor(Date.now() / 86400000) % BACKDROP_KEYS.length]);
  const { data } = useDataset(key);
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="animate-slowpan absolute inset-0">
        {data && <WorldMap decorative owners={data.owners} fills={data.fills} fillVersion={1} borderVersion={1} labels={data.labels} year={data.year} showControls={false} />}
      </div>
      <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, rgba(7,9,15,${dim + 0.2}) 0%, rgba(7,9,15,${dim}) 40%, rgba(7,9,15,${dim + 0.3}) 100%)` }} />
    </div>
  );
}

export function AppShell() {
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const name = useProfile((s) => s.displayName);
  const t = useT();
  return (
    <div className="min-h-full">
      <MapBackdrop dim={loc.pathname === '/' ? 0.35 : 0.72} />
      <header className="sticky top-0 z-40 border-b border-gold-600/20 bg-ink-950/75 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1500px] items-center gap-4 px-4 py-3 md:px-8">
          <NextLink href="/" className="shrink-0 rounded px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-parchment-200/60 ring-1 ring-gold-600/25 hover:text-gold-100" title="Back to the WHATIF site" aria-label="Back to the WHATIF site">←<span className="hidden 2xl:inline"> WHATIF</span></NextLink>
          <Logo />
          <nav className="hidden flex-1 items-center gap-1 xl:flex">
            {NAV.slice(1).map((n) => (
              <NavLink key={n.to} to={n.to} className={({ isActive }) => cx('rounded px-2.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.1em] transition', isActive ? 'text-gold-100 bg-gold-500/10 ring-1 ring-gold-400/30' : 'text-parchment-200/70 hover:text-gold-100')}>{t(n.label)}</NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <LangSwitcher />
            <NavLink to="/profile" className="btn-ghost !py-1.5"><User className="h-4 w-4" /><span className="hidden sm:inline">{name}</span></NavLink>
            <button className="btn-ghost !px-2 !py-1.5 xl:hidden" onClick={() => setOpen(!open)} aria-label={t('Menu')}>{open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}</button>
          </div>
        </div>
        {open && (
          <nav className="grid grid-cols-2 gap-1 border-t border-gold-600/20 px-4 py-3 xl:hidden">
            {NAV.map((n) => <NavLink key={n.to} to={n.to} onClick={() => setOpen(false)} className="flex items-center gap-2 rounded px-3 py-2 text-sm text-parchment-100 hover:bg-ink-800"><n.icon className="h-4 w-4 text-gold-300" />{t(n.label)}</NavLink>)}
          </nav>
        )}
      </header>
      <AnimatePresence mode="wait">
        <motion.main key={loc.pathname} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }} className="mx-auto max-w-[1500px] px-4 pb-20 pt-8 md:px-8">
          <Outlet />
        </motion.main>
      </AnimatePresence>
      <footer className="border-t border-gold-600/10 py-6 text-center text-[11px] text-parchment-300/40">
        {t('Historical borders: historical-basemaps (A. Ourednik, GPL-3.0) · Geography: Natural Earth (public domain) · Population & economic figures are model approximations.')} <Swords className="inline h-3 w-3" />
      </footer>
    </div>
  );
}
