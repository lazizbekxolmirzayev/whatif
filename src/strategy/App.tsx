import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { GameLayout } from './components/game/GameLayout';
import { LoadingScreen } from './components/layout/LoadingScreen';
import { Toasts } from './components/layout/Toasts';
import { Loading } from './components/ui';
import { ErrorBoundary } from './components/layout/ErrorBoundary';
import { useSettings } from './services/settings';

const MainMenu = lazy(() => import('./pages/MainMenu'));
const NewGame = lazy(() => import('./pages/NewGame'));
const EraSelect = lazy(() => import('./pages/EraSelect'));
const WhatIfHistory = lazy(() => import('./pages/WhatIfHistory'));
const ScenarioLibrary = lazy(() => import('./pages/ScenarioLibrary'));
const ScenarioDetails = lazy(() => import('./pages/ScenarioDetails'));
const ScenarioEditor = lazy(() => import('./pages/ScenarioEditor'));
const ImperialSandbox = lazy(() => import('./pages/ImperialSandbox'));
const WorldExplorer = lazy(() => import('./pages/WorldExplorer'));
const SaveLoad = lazy(() => import('./pages/SaveLoad'));
const MultiplayerLobby = lazy(() => import('./pages/MultiplayerLobby'));
const MultiplayerRoom = lazy(() => import('./pages/MultiplayerRoom'));
const PlayerProfile = lazy(() => import('./pages/PlayerProfile'));
const Achievements = lazy(() => import('./pages/Achievements'));
const SettingsPage = lazy(() => import('./pages/Settings'));
const CountryPage = lazy(() => import('./pages/game/Country'));
const EconomyPage = lazy(() => import('./pages/game/Economy'));
const PopulationPage = lazy(() => import('./pages/game/Population'));
const FoodPage = lazy(() => import('./pages/game/Food'));
const HealthPage = lazy(() => import('./pages/game/Health'));
const TechnologyPage = lazy(() => import('./pages/game/Technology'));
const InfrastructurePage = lazy(() => import('./pages/game/Infrastructure'));
const DiplomacyPage = lazy(() => import('./pages/game/Diplomacy'));
const MilitaryPage = lazy(() => import('./pages/game/Military'));
const EventsPage = lazy(() => import('./pages/game/Events'));
const TimelinePage = lazy(() => import('./pages/game/Timeline'));
const ComparePage = lazy(() => import('./pages/game/Compare'));
const HistorianPage = lazy(() => import('./pages/game/Historian'));

export default function App() {
  const reduce = useSettings((s) => s.reduceMotion);
  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', reduce);
    // do not leak the setting into the rest of the WHATIF site after leaving the game
    return () => document.documentElement.classList.remove('reduce-motion');
  }, [reduce]);
  return (
    <ErrorBoundary>
      <Suspense fallback={<div className="fixed inset-0 flex items-center justify-center"><Loading label="Unrolling the scrolls" /></div>}>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<MainMenu />} />
            <Route path="new" element={<NewGame />} />
            <Route path="eras" element={<EraSelect />} />
            <Route path="scenarios" element={<WhatIfHistory />} />
            <Route path="scenarios/:id" element={<ScenarioDetails />} />
            <Route path="library" element={<ScenarioLibrary />} />
            <Route path="editor" element={<ScenarioEditor />} />
            <Route path="editor/:id" element={<ScenarioEditor />} />
            <Route path="sandbox" element={<ImperialSandbox />} />
            <Route path="explorer" element={<WorldExplorer />} />
            <Route path="saves" element={<SaveLoad />} />
            <Route path="worlds" element={<Navigate to="/saves" replace />} />
            <Route path="multiplayer" element={<MultiplayerLobby />} />
            <Route path="multiplayer/:roomId" element={<MultiplayerRoom />} />
            <Route path="profile" element={<PlayerProfile />} />
            <Route path="achievements" element={<Achievements />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route path="game" element={<GameLayout />}>
            <Route index element={null} />
            <Route path="country" element={<CountryPage />} />
            <Route path="economy" element={<EconomyPage />} />
            <Route path="population" element={<PopulationPage />} />
            <Route path="food" element={<FoodPage />} />
            <Route path="health" element={<HealthPage />} />
            <Route path="technology" element={<TechnologyPage />} />
            <Route path="infrastructure" element={<InfrastructurePage />} />
            <Route path="diplomacy" element={<DiplomacyPage />} />
            <Route path="military" element={<MilitaryPage />} />
            <Route path="events" element={<EventsPage />} />
            <Route path="timeline" element={<TimelinePage />} />
            <Route path="compare" element={<ComparePage />} />
            <Route path="historian" element={<HistorianPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <LoadingScreen />
      <Toasts />
    </ErrorBoundary>
  );
}
