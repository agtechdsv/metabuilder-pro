import { BpmCanvas } from '@/components/studio/bpm/BpmCanvas';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Automations & BPM | MetaBuilder PRO',
  description: 'Visual Business Process Management',
};

export default function AutomationsPage() {
  return (
    <div className="h-screen w-full bg-white dark:bg-neutral-950 overflow-hidden">
      <BpmCanvas />
    </div>
  );
}
