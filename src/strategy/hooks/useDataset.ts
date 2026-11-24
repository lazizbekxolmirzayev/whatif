import { useEffect, useState } from 'react';
import { loadMeta, loadOwners } from '../services/mapData';
import { CORRECTIONS, colorFor } from '../data/polities';
import { mix } from '../lib/mapColors';
import type { MapLabel } from '../components/map/WorldMap';

export interface DatasetView { owners: (string | null)[]; fills: string[]; labels: MapLabel[]; polities: { name: string; provinces: number; tribal: boolean }[]; year: number }

/** Historical borders straight from a dataset (no simulation) — used by menus, explorer & comparison. */
export function useDataset(key: string | null, parchment = true): { data: DatasetView | null; error: string | null } {
  const [data, setData] = useState<DatasetView | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!key) return;
    let live = true;
    Promise.all([loadOwners(key), loadMeta()]).then(([o, meta]) => {
      if (!live) return;
      const corr = CORRECTIONS.filter((c) => c.key === key);
      const owners = o.owner.map((i, pid) => {
        if (i < 0) return null;
        let n = o.polities[i].name;
        for (const c of corr) if (c.from === n && (c.modern === '*' || c.modern.includes(meta[pid].m))) { n = c.to; break; }
        return n;
      });
      const tribal = new Set(o.polities.filter((p) => p.tribal || /farmers|nomads|tribes|hunters|pastoral|chiefdoms|gatherers|foragers/i.test(p.name)).map((p) => p.name));
      const counts = new Map<string, number>();
      for (const n of owners) if (n) counts.set(n, (counts.get(n) ?? 0) + 1);
      const land = parchment ? '#cbb88f' : '#3b3a35';
      const fills = owners.map((n) => (n ? (tribal.has(n) ? mix(mix(colorFor(n), land, 0.5), '#9a9a9a', 0.3) : parchment ? mix(colorFor(n), '#e3d2a8', 0.18) : colorFor(n)) : land));
      const labels = Array.from(counts.entries()).filter(([n, c]) => !tribal.has(n) && c >= 2).map(([n]) => ({ owner: n, name: n }));
      const polities = Array.from(counts.entries()).map(([name, provinces]) => ({ name, provinces, tribal: tribal.has(name) })).sort((a, b) => b.provinces - a.provinces);
      setData({ owners, fills, labels, polities, year: o.year });
    }).catch((e) => live && setError(String(e.message ?? e)));
    return () => { live = false; };
  }, [key, parchment]);
  return { data, error };
}
