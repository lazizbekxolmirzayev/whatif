import { useMemo, useState } from 'react';
import { RequirePlayer } from './common';
import { Button, Panel, Stat, cx } from '../../components/ui';
import { fmtNum } from '../../engine/util';
import { maxBuildingLevel } from '../../engine/commands';
import { buildCost } from '../../engine/ai';
import { useGame } from '../../store/game';
import type { BuildingKind, Country, World } from '../../types/game';

const KINDS: { k: BuildingKind; label: string }[] = [{ k: 'farms', label: 'Farms' }, { k: 'roads', label: 'Roads' }, { k: 'market', label: 'Markets' }, { k: 'buildings', label: 'Public' }, { k: 'port', label: 'Ports' }, { k: 'fort', label: 'Forts' }];
const PAGE = 12;

export default function InfrastructurePage() {
  return <RequirePlayer>{(c, w) => <Body c={c} w={w} />}</RequirePlayer>;
}
function Body({ c, w }: { c: Country; w: World }) {
  const dispatch = useGame((s) => s.dispatch);
  const select = useGame((s) => s.select);
  const [sort, setSort] = useState<'pop' | 'dev' | BuildingKind>('pop');
  const [page, setPage] = useState(0);
  const provs = useMemo(() => w.provinces.filter((p) => p.owner === c.id).sort((a, b) => (b[sort] as number) - (a[sort] as number)), [w, c.id, sort, c.economy.treasury]); // eslint-disable-line react-hooks/exhaustive-deps
  const avg = (k: BuildingKind) => (provs.reduce((s, p) => s + p[k], 0) / Math.max(1, provs.length)).toFixed(1);
  const pages = Math.ceil(provs.length / PAGE);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 md:grid-cols-6">{KINDS.map((x) => <Stat key={x.k} label={`Avg ${x.label}`} value={avg(x.k)} sub={`max lvl ${maxBuildingLevel(c, x.k)}`} />)}</div>
      <Panel title="Provinces" subtitle={`Treasury ${fmtNum(c.economy.treasury)}. Costs rise with level and the size of your economy. The infrastructure budget also slowly upgrades provinces automatically.`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-xs">
            <thead><tr className="text-left text-[10px] uppercase tracking-wider text-parchment-300/60">
              <th className="cursor-pointer py-1" onClick={() => setSort('pop')}>Province {sort === 'pop' && '▾'}</th>
              <th className="cursor-pointer" onClick={() => setSort('dev')}>Dev {sort === 'dev' && '▾'}</th>
              {KINDS.map((x) => <th key={x.k} className="cursor-pointer" onClick={() => setSort(x.k)}>{x.label} {sort === x.k && '▾'}</th>)}
            </tr></thead>
            <tbody>
              {provs.slice(page * PAGE, page * PAGE + PAGE).map((p) => (
                <tr key={p.id} className="border-t border-gold-700/20">
                  <td className="py-1.5"><button className="text-left text-parchment-50 hover:text-gold-200" onClick={() => select(p.id)}>{p.name}</button><div className="text-[10px] text-parchment-300/50">{fmtNum(p.pop)}{p.controller !== c.id && ' · occupied'}</div></td>
                  <td className="stat-num">{p.dev}</td>
                  {KINDS.map((x) => {
                    if (x.k === 'port' && !p.coastal) return <td key={x.k} className="text-parchment-300/30">—</td>;
                    const max = maxBuildingLevel(c, x.k);
                    const cost = buildCost(w, c, p[x.k]);
                    const can = p[x.k] < max && c.economy.treasury >= cost && p.controller === c.id;
                    return <td key={x.k}><button disabled={!can} onClick={() => void dispatch({ type: 'build', country: c.id, province: p.id, building: x.k })} title={p[x.k] >= max ? 'Max level for your technology' : `Upgrade for ${fmtNum(cost)}`} className={cx('stat-num rounded px-1.5 py-0.5 ring-1', can ? 'ring-gold-500/50 hover:bg-gold-500/20' : 'opacity-50 ring-transparent')}>{p[x.k]}{can && <span className="ml-1 text-gold-300">+</span>}</button></td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pages > 1 && <div className="mt-3 flex items-center justify-center gap-2"><Button size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Prev</Button><span className="text-xs text-parchment-300">{page + 1} / {pages}</span><Button size="sm" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</Button></div>}
      </Panel>
    </div>
  );
}
