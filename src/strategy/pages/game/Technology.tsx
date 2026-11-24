import { RequirePlayer } from './common';
import { Bar, Panel, Stat, cx } from '../../components/ui';
import { ERAS } from '../../data/eras';
import { TECHS, TECH_BY_ID, TECH_CATEGORIES, techAvailable, techLevel } from '../../data/technologies';
import { techCost } from '../../engine/systems';
import { useGame } from '../../store/game';
import { CheckCircle2, Lock, FlaskConical } from 'lucide-react';

export default function TechnologyPage() {
  const dispatch = useGame((s) => s.dispatch);
  const st = useGame((s) => s.st)!;
  return (
    <RequirePlayer>{(c, w) => {
      const t = c.tech;
      const cur = t.researching ? TECH_BY_ID[t.researching] : null;
      const cost = cur ? techCost(w, c, cur.id, st) : 0;
      const eta = cur && t.lastOutput > 0 ? Math.max(0, Math.ceil((cost - t.points) / t.lastOutput)) : null;
      const leaders = Object.values(w.countries).filter((x) => x.alive && !x.tribal).sort((a, b) => b.tech.known.length - a.tech.known.length).slice(0, 5);
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Stat label="Tech level" value={techLevel(t.known).toFixed(2)} sub="of 6.00" />
            <Stat label="Research / month" value={t.lastOutput.toFixed(1)} />
            <Stat label="Education" value={Math.round(t.education)} />
            <Stat label="Institutions" value={t.institutions} sub="universities & academies" />
          </div>
          <Panel title="Current research">
            {cur ? <>
              <div className="mb-2 flex items-center gap-2 text-gold-100"><FlaskConical className="h-4 w-4" />{cur.name}<span className="text-xs text-parchment-300/70">— {cur.description}</span></div>
              <Bar value={t.points} max={cost} right={`${Math.round(t.points)} / ${cost}${eta !== null ? ` · ~${eta} months` : ''}`} />
              <p className="mt-2 text-[11px] text-parchment-300/60">Cost falls when neighbours and trade partners already know a technology (knowledge diffusion).</p>
            </> : <p className="text-sm text-blood-400">No research selected — choose a technology below. Points accumulate meanwhile.</p>}
          </Panel>
          <Panel title="Technology tree" subtitle="Click an available technology to research it.">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-separate border-spacing-1 text-xs">
                <thead><tr><th />{ERAS.map((e) => <th key={e.id} className="title-display py-1 text-[10px] text-gold-300">{e.name.replace(' Era', '')}</th>)}</tr></thead>
                <tbody>
                  {TECH_CATEGORIES.map((cat) => (
                    <tr key={cat}>
                      <td className="pr-2 text-right text-[10px] uppercase tracking-wider text-parchment-300/60">{cat}</td>
                      {ERAS.map((_, era) => {
                        const tech = TECHS.find((x) => x.category === cat && x.era === era);
                        if (!tech) return <td key={era} />;
                        const known = t.known.includes(tech.id);
                        const avail = techAvailable(t.known, tech.id);
                        const active = t.researching === tech.id;
                        return (
                          <td key={era}>
                            <button disabled={!avail} onClick={() => void dispatch({ type: 'research', country: c.id, tech: tech.id })} title={`${tech.description}\nEffects: ${Object.entries(tech.effects).map(([k, v]) => `${k} ${v! > 0 ? '+' : ''}${v}`).join(', ')}${tech.unlocks ? `\nUnlocks: ${tech.unlocks}` : ''}\nCost: ${techCost(w, c, tech.id, st)}`}
                              className={cx('flex h-14 w-full flex-col justify-between rounded p-1.5 text-left ring-1 transition', known ? 'bg-verdigris-500/20 ring-emerald-400/40' : active ? 'bg-gold-400/25 ring-gold-200 shadow-glow' : avail ? 'bg-ink-800 ring-gold-600/40 hover:ring-gold-300' : 'bg-ink-950/60 opacity-50 ring-white/5')}>
                              <span className="leading-tight text-parchment-50">{tech.name}</span>
                              <span className="flex items-center gap-1 text-[10px] text-parchment-300/70">{known ? <><CheckCircle2 className="h-3 w-3 text-emerald-300" />known</> : avail ? `${techCost(w, c, tech.id, st)} pts` : <><Lock className="h-3 w-3" />locked</>}</span>
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
          <Panel title="Scientific leaders of the world">
            {leaders.map((x) => <div key={x.id} className="flex justify-between text-sm"><span className={x.id === c.id ? 'text-gold-100' : ''}>{x.name}</span><span className="stat-num text-parchment-300/70">{techLevel(x.tech.known).toFixed(2)}</span></div>)}
          </Panel>
        </div>
      );
    }}</RequirePlayer>
  );
}
