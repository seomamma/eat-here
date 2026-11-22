import { ActionBar } from './components/ActionBar';
import { GuestCard } from './components/GuestCard';
import { Hud } from './components/Hud';
import { ShopPanel } from './components/ShopPanel';
import { RankUpModal } from './components/RankUpModal';
import { ReportModal } from './components/ReportModal';

export function App() {
  return (
    <>
      <Hud />
      <GuestCard />
      <ActionBar />
      <ShopPanel />
      <ReportModal />
      <RankUpModal />
    </>
  );
}
