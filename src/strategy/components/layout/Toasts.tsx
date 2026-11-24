import { AnimatePresence, motion } from 'framer-motion';
import { useGame } from '../../store/game';
import { cx } from '../ui';

export function Toasts() {
  const toasts = useGame((s) => s.toasts);
  const dismiss = useGame((s) => s.dismiss);
  return (
    <div className="pointer-events-none fixed bottom-24 left-1/2 z-[60] flex w-[min(92vw,460px)] -translate-x-1/2 flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.button key={t.id} onClick={() => dismiss(t.id)} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className={cx('pointer-events-auto panel px-4 py-2.5 text-left text-sm', t.tone === 'good' && 'text-emerald-200', t.tone === 'bad' && 'text-blood-400', t.tone === 'event' && 'text-gold-100', t.tone === 'info' && 'text-parchment-100')}>
            {t.text}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
