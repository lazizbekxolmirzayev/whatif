import { useGame } from '../../store/game';
import { Badge, Button, Modal } from '../ui';
import { Flag } from '../ui/Flag';
import { fmtDate } from '../../engine/date';
import { ScrollText } from 'lucide-react';

/** Shows the oldest pending decision for the active player's country. */
export function EventModal() {
  useGame((s) => s.version);
  const w = useGame((s) => s.world);
  const dispatch = useGame((s) => s.dispatch);
  if (!w || !w.player) return null;
  const pe = w.events.pending.find((e) => e.country === w.player);
  if (!pe) return null;
  const c = w.countries[pe.country];
  return (
    <Modal open title={pe.title}>
      <div className="parchment -mx-1 p-5">
        <div className="mb-3 flex items-center gap-3">
          {c && <Flag flag={c.flag} className="h-8 w-12 rounded-sm" />}
          <div>
            <div className="font-display text-lg font-bold text-ink-900">{pe.title}</div>
            <div className="text-xs text-ink-700">{c?.name} · {fmtDate(pe.date)}</div>
          </div>
          <div className="ml-auto"><Badge tone="purple">Simulated event</Badge></div>
        </div>
        <ScrollText className="float-left mr-3 mt-1 h-10 w-10 text-bronze-500" />
        <p className="font-serif text-[17px] leading-relaxed text-ink-900">{pe.body}</p>
      </div>
      <div className="mt-4 space-y-2">
        {pe.options.map((o) => (
          <button key={o.id} onClick={() => void dispatch({ type: 'eventChoice', country: pe.country, uid: pe.uid, option: o.id })}
            className="group block w-full rounded-md bg-ink-950/70 px-4 py-3 text-left ring-1 ring-gold-600/40 transition hover:bg-ink-800 hover:ring-gold-300">
            <div className="font-semibold text-gold-100 group-hover:text-gold-50">{o.label}</div>
            <div className="text-xs text-parchment-300/70">{o.hint}</div>
          </button>
        ))}
      </div>
      {w.events.pending.filter((e) => e.country === w.player).length > 1 && <div className="mt-3 text-center text-[11px] text-parchment-300/60">{w.events.pending.filter((e) => e.country === w.player).length - 1} more decision(s) waiting</div>}
      <div className="sr-only"><Button>Decide</Button></div>
    </Modal>
  );
}
