import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Coins, FlaskConical, HeartPulse, Pause, Play, Shield, SkipForward, Users, Wheat, Scale, FastForward, Menu } from 'lucide-react';
import { useGame, type Speed } from '../../store/game';
import { useHotseat, endTurnOnline } from '../../services/multiplayer';
import { Flag } from '../ui/Flag';
import { cx } from '../ui';
import { fmtDate } from '../../engine/date';
import { fmtNum } from '../../engine/util';
import { techLevel } from '../../data/technologies';
import { useT } from '../../i18n';

const MONTH_MS: Record<Exclude<Speed, 0>, number> = { 1: 2000, 2: 1000, 5: 400, 10: 160 };

/** Simulation clock: drives monthly ticks at the selected speed. */
export function useGameClock(): void {
  const speed = useGame((s) => s.speed);
  const acc = useRef(0);
  useEffect(() => {
    if (!speed) return;
    let last = performance.now();
    let raf = 0;
    const loop = (t: number) => {
      acc.current += t - last; last = t;
      const st = useGame.getState();
      if (!st.busy && st.remote?.mode !== 'online' && acc.current >= MONTH_MS[speed as Exclude<Speed, 0>]) {
        acc.current = 0;
        const w = st.world;
        const blocked = w && w.player && w.events.pending.some((e) => e.country === w.player);
        if (!blocked) st.tick(1);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [speed]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
      const st = useGame.getState();
      if (e.code === 'Space') { e.preventDefault(); st.setSpeed(st.speed ? 0 : 1); }
      const map: Record<string, Speed> = { Digit1: 1, Digit2: 2, Digit3: 5, Digit4: 10 };
      if (map[e.code]) st.setSpeed(map[e.code]);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);
}

function Res({ icon, value, delta, title, tone }: { icon: React.ReactNode; value: string; delta?: string; title: string; tone?: 'good' | 'bad' }) {
  return (
    <div title={title} className="flex items-center gap-1.5 rounded bg-ink-950/60 px-2 py-1 ring-1 ring-gold-700/30">
      <span className="text-gold-300">{icon}</span>
      <span className="stat-num text-[13px] font-semibold text-parchment-50">{value}</span>
      {delta && <span className={cx('stat-num text-[11px]', tone === 'good' ? 'text-emerald-300' : tone === 'bad' ? 'text-blood-400' : 'text-parchment-300/60')}>{delta}</span>}
    </div>
  );
}

export function TopBar({ onMenu }: { onMenu: () => void }) {
  useGame((s) => s.version);
  const t = useT();
  const w = useGame((s) => s.world)!;
  const speed = useGame((s) => s.speed);
  const setSpeed = useGame((s) => s.setSpeed);
  const advance = useGame((s) => s.advance);
  const busy = useGame((s) => s.busy);
  const remote = useGame((s) => s.remote);
  const c = w.player ? w.countries[w.player] : null;
  const online = remote?.mode === 'online';
  return (
    <div className="pointer-events-auto flex flex-wrap items-center gap-2 border-b border-gold-600/30 bg-gradient-to-b from-ink-850/95 to-ink-950/90 px-3 py-2 shadow-panel backdrop-blur">
      <button onClick={onMenu} className="nav-icon !h-9 !w-9" aria-label={t('Game menu')}><Menu className="h-4 w-4" /></button>
      {c ? (
        <Link to="/game/country" className="flex items-center gap-2 rounded px-1.5 py-0.5 hover:bg-ink-800">
          <Flag flag={c.flag} className="h-7 w-10 rounded-sm" title={c.name} />
          <div className="leading-tight">
            <div className="title-display max-w-[180px] truncate text-[12px] text-gold-100">{c.name}</div>
            <div className="text-[10px] text-parchment-300/60">{c.ruler.title} {c.ruler.name}</div>
          </div>
        </Link>
      ) : <div className="title-display text-xs text-parchment-300">{t('Observer mode')}</div>}
      {c && c.alive && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Res icon={<Coins className="h-3.5 w-3.5" />} value={fmtNum(c.economy.treasury)} delta={`${c.economy.lastBalance >= 0 ? '+' : ''}${fmtNum(c.economy.lastBalance)}`} tone={c.economy.lastBalance >= 0 ? 'good' : 'bad'} title={t('Treasury and monthly balance')} />
          <Res icon={<Users className="h-3.5 w-3.5" />} value={fmtNum(c.pop.total)} delta={`${(c.pop.growthRate * 100).toFixed(1)}%`} tone={c.pop.growthRate >= 0 ? 'good' : 'bad'} title={t('Population and annual growth')} />
          <Res icon={<Wheat className="h-3.5 w-3.5" />} value={`${(c.food.stock / Math.max(1, c.food.consumption)).toFixed(1)}m`} delta={c.food.shortage > 0 ? t('famine') : undefined} tone="bad" title={t('Food stock in months of consumption')} />
          <Res icon={<Scale className="h-3.5 w-3.5" />} value={`${Math.round(c.stability.value)}`} tone={c.stability.value < 35 ? 'bad' : 'good'} title={t('Stability (0–100)')} />
          <Res icon={<Shield className="h-3.5 w-3.5" />} value={`${c.military.regiments.toFixed(0)}k`} delta={`${Math.round(c.military.morale * 100)}%`} title={t('Army (thousands) and morale')} />
          <Res icon={<FlaskConical className="h-3.5 w-3.5" />} value={techLevel(c.tech.known).toFixed(2)} title={t('Technology level')} />
          {c.health.epidemic && <Res icon={<HeartPulse className="h-3.5 w-3.5" />} value={t('Epidemic')} tone="bad" title={c.health.epidemic.name} />}
        </div>
      )}
      <div className="ml-auto flex items-center gap-2">
        <div className="text-right leading-tight">
          <div className="title-display text-[13px] text-gold-100">{fmtDate(w.date)}</div>
          <div className="text-[10px] text-parchment-300/60">{online ? `${t('Turn-based')} · ${remote?.roomId}` : speed ? `${t('Running')} ${speed}×` : t('Paused')}</div>
        </div>
        {remote && <EndTurn />}
        {!online && (
          <div className="flex items-center gap-1 rounded-md bg-ink-950/70 p-1 ring-1 ring-gold-700/40">
            <button className={cx('rounded p-1.5', speed === 0 ? 'bg-gold-400 text-ink-950' : 'text-gold-200 hover:bg-ink-800')} onClick={() => setSpeed(0)} title={t('Pause (Space)')}><Pause className="h-3.5 w-3.5" /></button>
            {([1, 2, 5, 10] as Speed[]).map((s) => (
              <button key={s} className={cx('stat-num rounded px-1.5 py-1 text-[11px] font-bold', speed === s ? 'bg-gold-400 text-ink-950' : 'text-gold-200 hover:bg-ink-800')} onClick={() => setSpeed(s)} title={`${s}× ${t('speed')}`}>{s === 1 ? <Play className="h-3.5 w-3.5" /> : `${s}×`}</button>
            ))}
            <span className="mx-0.5 h-5 w-px bg-gold-700/40" />
            <button disabled={busy} className="rounded px-1.5 py-1 text-[11px] font-semibold text-gold-200 hover:bg-ink-800 disabled:opacity-40" onClick={() => void advance(1)} title={t('Advance one month')}><SkipForward className="inline h-3.5 w-3.5" />{t('1m')}</button>
            <button disabled={busy} className="rounded px-1.5 py-1 text-[11px] font-semibold text-gold-200 hover:bg-ink-800 disabled:opacity-40" onClick={() => void advance(12)} title={t('Advance one year')}><FastForward className="inline h-3.5 w-3.5" />{t('1y')}</button>
            <button disabled={busy} className="rounded px-1.5 py-1 text-[11px] font-semibold text-gold-200 hover:bg-ink-800 disabled:opacity-40" onClick={() => void advance(120)} title={t('Advance a decade')}>{t('10y')}</button>
          </div>
        )}
      </div>
    </div>
  );
}

function EndTurn() {
  const remote = useGame((s) => s.remote)!;
  const busy = useGame((s) => s.busy);
  const toast = useGame((s) => s.toast);
  const hs = useHotseat();
  const t = useT();
  const label = remote.mode === 'hotseat' ? `${t('End turn')} · ${hs.players[hs.current]?.name ?? ''}` : t('End turn');
  return (
    <button disabled={busy} className="btn-gold !py-1.5 !text-xs" onClick={() => {
      if (remote.mode === 'hotseat') void hs.endTurn();
      else void endTurnOnline(remote.roomId).then((r) => toast(r.advanced ? t('Turn resolved by the server.') : t('Turn submitted — waiting for other players.'), 'info')).catch((e) => toast(e.message, 'bad'));
    }}>{label}</button>
  );
}
