import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Copy, Download, Heart, PenTool, Search, Share2, Trash2, Upload } from 'lucide-react';
import { SCENARIOS } from '../data/scenarios';
import { deleteCustom, exportCode, importCode, listCommunity, listCustom, saveCustom, shareScenario } from '../services/scenarios';
import type { ScenarioDefinition } from '../types/game';
import { Badge, Button, EmptyState, ErrorBox, Loading, Modal, Panel, SectionTitle, Tabs, cx } from '../components/ui';
import { ScenarioArt } from '../components/art/ScenarioArt';
import { formatYear } from '../data/eras';
import { useProfile } from '../services/profile';
import { useGame } from '../store/game';
import { cloudEnabled } from '../services/supabase';

type Tab = 'builtin' | 'mine' | 'community' | 'favorites';

export default function ScenarioLibrary() {
  const [tab, setTab] = useState<Tab>('builtin');
  const [mine, setMine] = useState<ScenarioDefinition[] | null>(null);
  const [community, setCommunity] = useState<ScenarioDefinition[] | null>(null);
  const [cErr, setCErr] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [code, setCode] = useState('');
  const [shareOf, setShareOf] = useState<ScenarioDefinition | null>(null);
  const favorites = useProfile((s) => s.favorites);
  const toggleFav = useProfile((s) => s.toggleFavorite);
  const toast = useGame((s) => s.toast);
  const navigate = useNavigate();
  const reload = () => void listCustom().then(setMine);
  useEffect(reload, []);
  useEffect(() => { if (tab === 'community' && community === null) listCommunity().then(setCommunity).catch((e) => { setCErr(e.message); setCommunity([]); }); }, [tab, community]);

  const all = useMemo(() => [...SCENARIOS, ...(mine ?? []), ...(community ?? [])], [mine, community]);
  const list = useMemo(() => {
    const src = tab === 'builtin' ? SCENARIOS : tab === 'mine' ? mine ?? [] : tab === 'community' ? community ?? [] : all.filter((s) => favorites.includes(s.id));
    return src.filter((s) => (s.title + s.question).toLowerCase().includes(q.toLowerCase()));
  }, [tab, mine, community, all, favorites, q]);

  const doImport = async () => {
    try { const s = importCode(code); await saveCustom(s); setImportOpen(false); setCode(''); reload(); setTab('mine'); toast(`Imported “${s.title}”.`, 'good'); }
    catch (e) { toast((e as Error).message, 'bad'); }
  };
  const loading = (tab === 'mine' && mine === null) || (tab === 'community' && community === null);

  return (
    <div>
      <SectionTitle kicker="Scenario library">Every road not taken</SectionTitle>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Tabs value={tab} onChange={setTab} tabs={[{ id: 'builtin', label: `Built-in (${SCENARIOS.length})` }, { id: 'mine', label: `My scenarios (${mine?.length ?? 0})` }, { id: 'community', label: 'Community' }, { id: 'favorites', label: `Favourites (${favorites.length})` }]} />
        <div className="relative min-w-[200px] flex-1"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-parchment-300/50" /><input className="input !pl-8" placeholder="Search scenarios…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Button icon={<Upload className="h-4 w-4" />} onClick={() => setImportOpen(true)}>Import code</Button>
        <Button variant="gold" icon={<PenTool className="h-4 w-4" />} onClick={() => navigate('/editor')}>Create scenario</Button>
      </div>
      {tab === 'community' && !cloudEnabled && <div className="mb-4"><ErrorBox error="Community sharing needs a Supabase project (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). Share codes work without it." /></div>}
      {cErr && <div className="mb-4"><ErrorBox error={cErr} /></div>}
      {loading ? <Loading /> : !list.length ? (
        <EmptyState icon={<PenTool className="h-8 w-8" />} title={tab === 'mine' ? 'No custom scenarios yet' : 'Nothing here'} text={tab === 'mine' ? 'Use the Scenario Editor to write your own alternative history.' : 'Try another tab or search.'} action={tab === 'mine' ? <Link className="btn-gold mt-3" to="/editor">Open the editor</Link> : undefined} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((s, i) => (
            <Panel key={s.id} className="!p-0 overflow-hidden">
              <Link to={`/scenarios/${s.id}`} className="group relative block h-32">
                <ScenarioArt hue={s.artHue} year={formatYear(s.start.y)} seed={i + 5} className="absolute inset-0 h-full w-full transition group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-ink-900 to-transparent" />
                <div className="absolute bottom-2 left-3 right-3"><div className="title-display text-[13px] text-gold-50">{s.title}</div><div className="text-[11px] text-parchment-200/70">{formatYear(s.start.y)} · {s.custom ? `by ${s.author ?? 'you'}` : 'built-in'}</div></div>
              </Link>
              <div className="p-3">
                <p className="line-clamp-2 font-serif italic text-parchment-100/90">{s.question}</p>
                <div className="mt-3 flex items-center gap-1.5">
                  {s.custom ? <Badge tone="purple">custom</Badge> : <Badge tone="blue">curated</Badge>}
                  <button className="ml-auto rounded p-1.5 hover:bg-ink-800" title="Favourite" onClick={() => toggleFav(s.id)}><Heart className={cx('h-4 w-4', favorites.includes(s.id) ? 'fill-blood-400 text-blood-400' : 'text-parchment-300')} /></button>
                  {s.custom && tab === 'mine' && <>
                    <button className="rounded p-1.5 hover:bg-ink-800" title="Edit" onClick={() => navigate(`/editor/${s.id}`)}><PenTool className="h-4 w-4 text-parchment-300" /></button>
                    <button className="rounded p-1.5 hover:bg-ink-800" title="Share" onClick={() => setShareOf(s)}><Share2 className="h-4 w-4 text-parchment-300" /></button>
                    <button className="rounded p-1.5 hover:bg-ink-800" title="Delete" onClick={() => void deleteCustom(s.id).then(reload)}><Trash2 className="h-4 w-4 text-blood-400" /></button>
                  </>}
                  {s.custom && tab === 'community' && <button className="rounded p-1.5 hover:bg-ink-800" title="Save to my scenarios" onClick={() => void saveCustom(s).then(() => { reload(); toast('Saved to your scenarios.', 'good'); })}><Download className="h-4 w-4 text-parchment-300" /></button>}
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}
      <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Import a scenario" footer={<Button variant="gold" disabled={!code.trim()} onClick={() => void doImport()}>Import</Button>}>
        <textarea className="input h-40 font-mono text-xs" placeholder="Paste a scenario share code…" value={code} onChange={(e) => setCode(e.target.value)} />
      </Modal>
      <Modal open={!!shareOf} onClose={() => setShareOf(null)} title={`Share “${shareOf?.title ?? ''}”`}>
        {shareOf && <div className="space-y-3">
          <p className="text-sm text-parchment-200">Share code (anyone can import it):</p>
          <textarea readOnly className="input h-28 font-mono text-[10px]" value={exportCode(shareOf)} />
          <div className="flex gap-2">
            <Button icon={<Copy className="h-4 w-4" />} onClick={() => void navigator.clipboard.writeText(exportCode(shareOf)).then(() => toast('Copied.', 'good'))}>Copy code</Button>
            <Button variant="gold" icon={<Share2 className="h-4 w-4" />} disabled={!cloudEnabled} onClick={() => void shareScenario(shareOf).then(() => toast('Published to the community.', 'good')).catch((e) => toast(e.message, 'bad'))}>Publish to community</Button>
          </div>
        </div>}
      </Modal>
    </div>
  );
}
