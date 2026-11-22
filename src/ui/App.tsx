import { ActionBar } from './components/ActionBar';
import { GuestCard } from './components/GuestCard';
import { NightOverlay } from './components/NightOverlay';
import { Hud } from './components/Hud';
import { RecipePanel } from './components/RecipePanel';
import { ShopPanel } from './components/ShopPanel';
import { Toasts } from './components/Toasts';
import { RankUpModal } from './components/RankUpModal';
import { ReportModal } from './components/ReportModal';

export function App() {
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
