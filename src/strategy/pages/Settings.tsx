import { useSettings } from '../services/settings';
import { Button, Panel, SectionTitle, Slider, Toggle } from '../components/ui';
import { setMusicVolume, startMusic, stopMusic } from '../services/audio';
import { useState } from 'react';
import { cloudEnabled } from '../services/supabase';
import { useT } from '../i18n';
import { LangSwitcher } from '../components/ui/LangSwitcher';

export default function SettingsPage() {
  const s = useSettings();
  const t = useT();
  const [cleared, setCleared] = useState(false);
  return (
    <div>
      <SectionTitle kicker="Settings">Configure your chronicle</SectionTitle>
      <div className="grid gap-5 md:grid-cols-2">
        <Panel title="Language">
          <LangSwitcher className="w-fit" />
          <p className="mt-2 text-xs text-parchment-300/70">O‘zbekcha · English · Русский</p>
        </Panel>
        <Panel title="Audio">
          <Toggle label="Ambient music (procedural score)" checked={s.musicOn} onChange={(v) => { s.set({ musicOn: v }); if (v) startMusic(); else stopMusic(); }} />
          <div className="mt-2"><span className="label">{t('Music volume')}</span><Slider value={s.musicVolume} min={0} max={1} onChange={(v) => { s.set({ musicVolume: v }); setMusicVolume(v); }} format={(v) => `${Math.round(v * 100)}%`} /></div>
          <div className="mt-3"><span className="label">{t('Sound effects')}</span><Slider value={s.sfxVolume} min={0} max={1} onChange={(v) => s.set({ sfxVolume: v })} format={(v) => `${Math.round(v * 100)}%`} /></div>
        </Panel>
        <Panel title="Gameplay">
          <Toggle label="Pause when a decision event appears" checked={s.autoPauseEvents} onChange={(v) => s.set({ autoPauseEvents: v })} />
          <Toggle label="Pause when war breaks out" checked={s.autoPauseWar} onChange={(v) => s.set({ autoPauseWar: v })} />
          <Toggle label="Confirm before declaring war" checked={s.confirmWar} onChange={(v) => s.set({ confirmWar: v })} />
          <div className="mt-2"><span className="label">{t('Autosave every')}</span><Slider value={s.autosaveMonths} min={0} max={60} step={6} onChange={(v) => s.set({ autosaveMonths: v })} format={(v) => (v ? `${v} ${t('mo')}` : t('off'))} /></div>
        </Panel>
        <Panel title="Map">
          <Toggle label="Parchment map style" checked={s.parchmentMap} onChange={(v) => s.set({ parchmentMap: v })} />
          <Toggle label="City labels" checked={s.showCityLabels} onChange={(v) => s.set({ showCityLabels: v })} />
          <Toggle label="Rivers & lakes" checked={s.showRivers} onChange={(v) => s.set({ showRivers: v })} />
          <Toggle label="Deserts & mountain ranges" checked={s.showTerrain} onChange={(v) => s.set({ showTerrain: v })} />
          <Toggle label="Trade routes" checked={s.showTradeRoutes} onChange={(v) => s.set({ showTradeRoutes: v })} />
        </Panel>
        <Panel title="Accessibility & data">
          <Toggle label="Reduce motion" checked={s.reduceMotion} onChange={(v) => s.set({ reduceMotion: v })} />
          <p className="mt-3 text-xs text-parchment-300/70">{t('Cloud features')}: {cloudEnabled ? t('Supabase connected') : t('offline mode (no Supabase configured)')}.</p>
          <Button variant="danger" className="mt-3" onClick={() => { indexedDB.deleteDatabase('whatif-db'); localStorage.removeItem('whatif-profile'); setCleared(true); }}>Delete all local saves & profile</Button>
          {cleared && <p className="mt-2 text-xs text-emerald-300">{t('Local data cleared. Reload the page.')}</p>}
        </Panel>
      </div>
    </div>
  );
}
