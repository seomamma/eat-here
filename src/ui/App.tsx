import { ActionBar } from './components/ActionBar';
import { GuestCard } from './components/GuestCard';
import { NightOverlay } from './components/NightOverlay';
import { Hud } from './components/Hud';
import { ShopPanel } from './components/ShopPanel';
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
      <ReportModal />
      <RankUpModal />
    </>
  );
}
