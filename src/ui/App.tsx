import { ActionBar } from './components/ActionBar';
import { Hud } from './components/Hud';
import { ReportModal } from './components/ReportModal';

export function App() {
  return (
    <>
      <Hud />
      <ActionBar />
      <ReportModal />
    </>
  );
}
