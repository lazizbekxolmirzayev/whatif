import type { ReactNode } from 'react';
import { useGame } from '../../store/game';
import type { Country, World } from '../../types/game';
import { EmptyState } from '../../components/ui';
import { Skull } from 'lucide-react';
import { fmtYear } from '../../engine/date';

export function usePlayer(): { w: World; c: Country | null } {
  useGame((s) => s.version);
  const w = useGame((s) => s.world)!;
  const c = w.player ? w.countries[w.player] : null;
  return { w, c };
}
export function RequirePlayer({ children }: { children: (c: Country, w: World) => ReactNode }) {
  const { w, c } = usePlayer();
  if (!c) return <EmptyState title="Observer mode" text="You are not controlling a country in this world." />;
  if (!c.alive) return <EmptyState icon={<Skull className="h-8 w-8" />} title={`${c.name} has fallen`} text="Your nation no longer exists. Explore the timeline or ask the AI Historian why." />;
  return <>{children(c, w)}</>;
}
export function historySeries(w: World, id: string, key: 'pop' | 'gdp' | 'provinces' | 'stability' | 'tech' | 'military' | 'treasury') {
  return w.history.filter((h) => h.countries[id]).map((h) => ({ x: h.year, y: h.countries[id][key] }));
}
export const yearLabel = (x: number) => fmtYear(x);
export const pct = (v: number, d = 0) => `${(v * 100).toFixed(d)}%`;
