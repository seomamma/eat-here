import { ActionBar } from './components/ActionBar';
import { GuestCard } from './components/GuestCard';
import { NightOverlay } from './components/NightOverlay';
import { Hud } from './components/Hud';
import { RecipePanel } from './components/RecipePanel';
import { ShopPanel } from './components/ShopPanel';
import { Toasts } from './components/Toasts';
import { RankUpModal } from './components/RankUpModal';
import { ReportModal } from './components/ReportModal';
import { TitleScreen } from './components/TitleScreen';
import { screen } from './store';

export function App() {
  if (screen.value === 'title') return <TitleScreen />;
  return (
    <>
      <NightOverlay />
      <Hud />
      <GuestCard />
      <ActionBar />
      <ShopPanel />
      <RecipePanel />
      <Toasts />
      <ReportModal />
      <RankUpModal />
    </>
  );
}
