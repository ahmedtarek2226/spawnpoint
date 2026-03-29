import { useState } from 'react';
import { Archive, CalendarClock, MessageSquare } from 'lucide-react';
import BackupsTab from './BackupsTab';
import ScheduleTab from './ScheduleTab';
import MessagesTab from './MessagesTab';

type Section = 'backups' | 'schedules' | 'messages';

const SECTIONS: { key: Section; label: string; Icon: React.ElementType }[] = [
  { key: 'backups', label: 'Backups', Icon: Archive },
  { key: 'schedules', label: 'Schedules', Icon: CalendarClock },
  { key: 'messages', label: 'Messages', Icon: MessageSquare },
];

export default function AutomationTab({ serverId }: { serverId: string }) {
  const [section, setSection] = useState<Section>('backups');

  return (
    <div className="flex flex-col h-full">
      {/* Secondary nav */}
      <div className="flex border-b border-mc-border px-2 bg-mc-panel/20 flex-shrink-0">
        {SECTIONS.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setSection(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px ${
              section === key
                ? 'border-mc-green text-mc-green'
                : 'border-transparent text-mc-muted hover:text-gray-300'
            }`}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {section === 'backups' && <BackupsTab serverId={serverId} />}
        {section === 'schedules' && <ScheduleTab serverId={serverId} />}
        {section === 'messages' && <MessagesTab serverId={serverId} />}
      </div>
    </div>
  );
}
