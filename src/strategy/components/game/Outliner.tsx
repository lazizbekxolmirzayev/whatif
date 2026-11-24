import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp, Mail, Swords, ScrollText } from 'lucide-react';
import { useGame } from '../../store/game';
import { cx } from '../ui';
import { fmtDate } from '../../engine/date';

/** Journal-style overview of wars, diplomatic offers and recent news. */
export function Outliner() {
  useGame((s) => s.version);
  const w = useGame((s) => s.world)!;
  const dispatch = useGame((s) => s.dispatch);
  const select = useGame((s) => s.select);
  const [open, setOpen] = useState(true);
  const me = w.player;
  const wars = w.wars.filter((x) => !x.ended && me && (x.attackers.includes(me) || x.defenders.includes(me)));
  const offers = w.offers.filter((o) => o.to === me);
  const news = w.log.slice(-6).reverse();
  return (
    <div className="panel pointer-events-auto w-full overflow-hidden md:w-[320px]">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-3 py-2 text-left">
        <span className="title-display text-[11px] text-gold-200">Journal {offers.length + wars.length > 0 && <span className="ml-1 rounded-full bg-blood-500 px-1.5 text-[10px] text-white">{offers.length + wars.length}</span>}</span>
        {open ? <ChevronUp className="h-4 w-4 text-gold-300" /> : <ChevronDown className="h-4 w-4 text-gold-300" />}
      </button>
      {open && (
        <div className="scroll-thin max-h-[45vh] space-y-3 overflow-y-auto border-t border-gold-600/20 px-3 py-2 text-xs">
          {wars.map((war) => {
            const side = war.attackers.includes(me!) ? 1 : -1;
            const score = Math.round(war.score * side);
            return (
              <Link to="/game/military" key={war.id} className="block rounded bg-blood-600/10 p-2 ring-1 ring-blood-400/30 hover:bg-blood-600/20">
                <div className="flex items-center gap-1.5 font-semibold text-parchment-50"><Swords className="h-3.5 w-3.5 text-blood-400" />{war.name}</div>
                <div className="mt-1 h-1.5 rounded-full bg-ink-950"><div className={cx('h-full rounded-full', score >= 0 ? 'bg-emerald-400' : 'bg-blood-400')} style={{ width: `${Math.min(100, Math.abs(score))}%` }} /></div>
                <div className="mt-0.5 text-[10px] text-parchment-300/70">War score {score} · since {fmtDate(war.start, true)}</div>
              </Link>
            );
          })}
          {offers.map((o) => (
            <div key={o.uid} className="rounded bg-sky-500/10 p-2 ring-1 ring-sky-400/30">
              <div className="flex items-center gap-1.5 font-semibold text-parchment-50"><Mail className="h-3.5 w-3.5 text-sky-300" />{w.countries[o.from]?.name}</div>
              <div className="mt-0.5 text-parchment-200/80">{o.reason}</div>
              <div className="mt-1.5 flex gap-1.5">
                <button className="btn-gold !px-2 !py-0.5 !text-[11px]" onClick={() => void dispatch({ type: 'answerOffer', country: me!, uid: o.uid, accept: true })}>Accept</button>
                <button className="btn-ghost !px-2 !py-0.5 !text-[11px]" onClick={() => void dispatch({ type: 'answerOffer', country: me!, uid: o.uid, accept: false })}>Decline</button>
              </div>
            </div>
          ))}
          <div>
            <div className="label flex items-center gap-1"><ScrollText className="h-3 w-3" />Chronicle</div>
            <ul className="space-y-1">
              {news.map((n, i) => (
                <li key={i} className="cursor-pointer text-parchment-200/80 hover:text-gold-100" onClick={() => n.country && w.countries[n.country] && select(w.countries[n.country].capital, n.country)}>
                  <span className="text-parchment-300/50">{fmtDate(n.date, true)} · </span>{n.text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
