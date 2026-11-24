import { Award, Lock } from 'lucide-react';
import { ACHIEVEMENTS } from '../engine/achievements';
import { useProfile } from '../services/profile';
import { Badge, Panel, SectionTitle, cx } from '../components/ui';

export default function Achievements() {
  const got = useProfile((s) => s.achievements);
  const n = Object.keys(got).length;
  return (
    <div>
      <SectionTitle kicker={`${n} of ${ACHIEVEMENTS.length} unlocked`}>Achievements</SectionTitle>
      <div className="mb-6 h-2 max-w-md overflow-hidden rounded-full bg-ink-950 ring-1 ring-gold-700/30"><div className="h-full bg-gradient-to-r from-gold-500 to-gold-200" style={{ width: `${(n / ACHIEVEMENTS.length) * 100}%` }} /></div>
      {(['general', 'sandbox', 'historical'] as const).map((cat) => (
        <div key={cat} className="mb-6">
          <h2 className="title-display mb-3 text-sm text-gold-200">{cat === 'historical' ? 'Historical scenarios' : cat === 'sandbox' ? 'Imperial sandbox' : 'General'}</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {ACHIEVEMENTS.filter((a) => a.category === cat).map((a) => {
              const at = got[a.id];
              return (
                <Panel key={a.id} className={cx('flex items-start gap-3', !at && 'opacity-60')}>
                  <div className={cx('flex h-12 w-12 shrink-0 items-center justify-center rounded-full ring-2', at ? 'bg-gradient-to-b from-gold-100 to-gold-500 text-ink-950 ring-gold-300 shadow-glow' : 'bg-ink-950 text-parchment-300 ring-ink-600')}>{at ? <Award className="h-6 w-6" /> : <Lock className="h-5 w-5" />}</div>
                  <div><div className="font-semibold text-gold-100">{a.name}</div><div className="text-xs text-parchment-200/70">{a.description}</div>{at && <div className="mt-1"><Badge tone="green">Unlocked {new Date(at).toLocaleDateString()}</Badge></div>}</div>
                </Panel>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
