import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useGame } from '../../store/game';
import { Globe2 } from 'lucide-react';

// Documented historical facts shown while worlds are generated.
const FACTS = [
  'In 1405 Timur died at Otrar while marching on Ming China — one of history\'s great "what ifs".',
  'The Battle of Waterloo (18 June 1815) was, in Wellington\'s words, "the nearest-run thing you ever saw in your life".',
  'The Eastern Roman Empire outlived the Western Empire by almost a thousand years, until 1453.',
  'At its height the Mongol Empire was the largest contiguous land empire in history.',
  'The Inca road system, the Qhapaq Ñan, stretched roughly 30,000 km along the Andes.',
  'The siege of Vienna in 1683 ended with the largest cavalry charge in history, led by Jan III Sobieski.',
  'The Black Death (1346–1353) killed an estimated 30–50% of Europe\'s population.',
];

export function LoadingScreen() {
  const loading = useGame((s) => s.loading);
  const [i, setI] = useState(() => Math.floor(Math.random() * FACTS.length));
  useEffect(() => { if (!loading) return; const t = setInterval(() => setI((x) => (x + 1) % FACTS.length), 3500); return () => clearInterval(t); }, [loading]);
  if (!loading) return null;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-ink-950/95 p-6 backdrop-blur">
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 18, ease: 'linear' }} className="mb-8 rounded-full p-5 ring-1 ring-gold-500/40 shadow-glow"><Globe2 className="h-14 w-14 text-gold-300" /></motion.div>
      <div className="title-display gold-text text-2xl">{loading}…</div>
      <div className="skeleton mt-5 h-1.5 w-72 rounded-full" />
      <p className="mt-8 max-w-lg text-center font-serif text-lg italic text-parchment-200/80">“{FACTS[i]}”</p>
      <span className="mt-2 text-[10px] uppercase tracking-[0.3em] text-parchment-300/40">Documented history</span>
    </motion.div>
  );
}
