import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen, Crown, Landmark, PenTool, ScrollText, Users } from 'lucide-react';
import { SectionTitle } from '../components/ui';
import { useT } from '../i18n';

const MODES = [
  { to: '/scenarios', icon: ScrollText, title: 'What If History', text: 'Pick a turning point — Waterloo, Otrar, Vienna, Cajamarca — choose how it ends, and play the consequences.', tag: 'Game mode one' },
  { to: '/sandbox', icon: Crown, title: 'Imperial Sandbox', text: 'Create your own nation: name, flag, capital, territory, government, people and technology, in any era from 500 BC to 2010.', tag: 'Game mode two' },
  { to: '/eras', icon: Landmark, title: 'Historical Nation', text: 'Choose an era and a starting year, then take command of any historical country on documented borders.', tag: 'Grand campaign' },
  { to: '/library', icon: BookOpen, title: 'Scenario Library', text: 'Browse built-in, your own and community scenarios. Favourite and share them.', tag: 'Library' },
  { to: '/editor', icon: PenTool, title: 'Scenario Editor', text: 'Author your own alternative history with dated events, conditions and branching outcomes.', tag: 'Create' },
  { to: '/multiplayer', icon: Users, title: 'Multiplayer', text: 'Turn-based shared worlds — online rooms (Supabase) or local hot-seat on one device.', tag: 'Together' },
];

export default function NewGame() {
  const t = useT();
  return (
    <div>
      <SectionTitle kicker="New game">Choose your path through history</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {MODES.map((m, i) => (
          <motion.div key={m.to} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Link to={m.to} className="panel panel-ornate group block h-full p-6 transition hover:-translate-y-1 hover:shadow-glow">
              <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-gold-400/70">{t(m.tag)}</div>
              <m.icon className="mt-4 h-9 w-9 text-gold-300 transition group-hover:scale-110 group-hover:text-gold-100" />
              <h2 className="title-display mt-4 text-lg text-gold-100">{t(m.title)}</h2>
              <p className="mt-2 text-sm leading-relaxed text-parchment-200/75">{t(m.text)}</p>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
