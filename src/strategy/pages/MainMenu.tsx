import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen, Compass, Crown, FolderOpen, Music, Play, Plus, ScrollText, Users, VolumeX } from 'lucide-react';
import { useGame } from '../store/game';
import { latestSave, loadWorld, type SaveMeta } from '../services/saves';
import { SCENARIOS } from '../data/scenarios';
import { ScenarioArt } from '../components/art/ScenarioArt';
import { Button } from '../components/ui';
import { Flag } from '../components/ui/Flag';
import { useSettings } from '../services/settings';
import { startMusic, stopMusic } from '../services/audio';
import { fmtYear } from '../engine/date';
import { useT } from '../i18n';

export default function MainMenu() {
  const navigate = useNavigate();
  const t = useT();
  const world = useGame((s) => s.world);
  const setWorld = useGame((s) => s.setWorld);
  const toast = useGame((s) => s.toast);
  const [last, setLast] = useState<SaveMeta | null>(null);
  const musicOn = useSettings((s) => s.musicOn);
  const set = useSettings((s) => s.set);
  useEffect(() => { void latestSave().then(setLast).catch(() => setLast(null)); }, []);

  const cont = async () => {
    if (world) { navigate('/game'); return; }
    if (!last) return;
    try { await setWorld(await loadWorld(last.slot)); navigate('/game'); } catch (e) { toast(`${t('Could not load')}: ${(e as Error).message}`, 'bad'); }
  };
  const toggleMusic = () => { if (musicOn) { stopMusic(); set({ musicOn: false }); } else { startMusic(); set({ musicOn: true }); } };

  return (
    <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr]">
      <motion.section initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="flex flex-col justify-center py-6 lg:py-16">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.45em] text-gold-400">{t('Alternative History Grand Strategy')}</div>
        <h1 className="title-display gold-text text-6xl font-extrabold leading-none md:text-8xl" style={{ textShadow: '0 4px 40px rgba(217,182,92,.25)' }}>What If?</h1>
        <div className="divider-gold my-6 w-72" />
        <p className="max-w-xl font-serif text-xl leading-relaxed text-parchment-100/90">{t('Rewrite a single moment of history and watch the consequences ripple through economies, dynasties, wars and centuries — on real historical borders, driven by a living simulation.')}</p>
        <div className="mt-8 grid max-w-md gap-2.5">
          <Button variant="gold" size="lg" icon={<Plus className="h-5 w-5" />} onClick={() => navigate('/new')}>{t('New Game')}</Button>
          <Button size="lg" icon={<Play className="h-5 w-5" />} disabled={!world && !last} onClick={() => void cont()}>
            {t('Continue Game')} {world ? `— ${world.name}` : last ? `— ${last.name} (${last.date})` : ''}
          </Button>
          <Button size="lg" icon={<FolderOpen className="h-5 w-5" />} onClick={() => navigate('/saves')}>{t('Load Saved Game')}</Button>
          <Button size="lg" icon={<ScrollText className="h-5 w-5" />} onClick={() => navigate('/scenarios')}>{t('Explore Historical Scenarios')}</Button>
        </div>
        <button onClick={toggleMusic} className="mt-6 flex w-fit items-center gap-2 text-xs text-parchment-300/70 hover:text-gold-200">{musicOn ? <Music className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />} {musicOn ? t('Ambient score on') : t('Play ambient score')}</button>
      </motion.section>

      <motion.section initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.15 }} className="space-y-4 lg:pt-12">
        <div className="grid grid-cols-2 gap-3">
          {[
            { to: '/scenarios', icon: ScrollText, t: 'What If History', d: 'Change pivotal events' },
            { to: '/sandbox', icon: Crown, t: 'Imperial Sandbox', d: 'Forge your own empire' },
            { to: '/explorer', icon: Compass, t: 'World Explorer', d: '2,500 years of borders' },
            { to: '/multiplayer', icon: Users, t: 'Multiplayer', d: 'Shared turn-based worlds' },
          ].map((m) => (
            <Link key={m.to} to={m.to} className="panel group p-4 transition hover:-translate-y-0.5 hover:shadow-glow">
              <m.icon className="h-6 w-6 text-gold-300 transition group-hover:text-gold-100" />
              <div className="title-display mt-3 text-[13px] text-gold-100">{t(m.t)}</div>
              <div className="text-xs text-parchment-300/70">{t(m.d)}</div>
            </Link>
          ))}
        </div>
        <div className="panel panel-ornate p-4">
          <div className="mb-3 flex items-center justify-between"><h2 className="title-display text-xs text-gold-200">{t('Featured scenarios')}</h2><Link to="/library" className="text-[11px] text-gold-300 hover:underline"><BookOpen className="mr-1 inline h-3 w-3" />{t('Library')}</Link></div>
          <div className="space-y-2.5">
            {SCENARIOS.slice(0, 3).map((s, i) => (
              <Link key={s.id} to={`/scenarios/${s.id}`} className="group relative block h-24 overflow-hidden rounded-md ring-1 ring-gold-600/30 hover:ring-gold-300">
                <ScenarioArt hue={s.artHue} year={fmtYear(s.start.y)} seed={i + 3} className="absolute inset-0 h-full w-full transition duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-r from-ink-950/90 via-ink-950/50 to-transparent" />
                <div className="relative p-3">
                  <div className="title-display text-[13px] text-gold-100">{s.title}</div>
                  <div className="mt-1 max-w-sm font-serif text-sm italic text-parchment-100/90">{s.question}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
        {last && (
          <div className="panel flex items-center gap-3 p-3 text-xs">
            {last.playerFlag && <Flag flag={last.playerFlag} className="h-7 w-10 rounded-sm" />}
            <div><div className="text-parchment-50">{last.name}</div><div className="text-parchment-300/60">{last.playerName ?? t('Observer')} · {last.date} · {new Date(last.savedAt).toLocaleString()}</div></div>
          </div>
        )}
      </motion.section>
    </div>
  );
}
