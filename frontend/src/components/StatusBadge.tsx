import type { ServerStatus } from '../stores/serversStore';

const colors: Record<ServerStatus, string> = {
  running: 'text-mc-green',
  starting: 'text-yellow-400',
  stopping: 'text-orange-400',
  stopped: 'text-mc-muted',
  crashed: 'text-red-500',
};

const bgColors: Record<ServerStatus, string> = {
  running: 'bg-mc-green/20 text-mc-green border border-mc-green/40',
  starting: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40',
  stopping: 'bg-orange-500/20 text-orange-400 border border-orange-500/40',
  stopped: 'bg-gray-700/40 text-gray-400 border border-gray-600/40',
  crashed: 'bg-red-500/20 text-red-400 border border-red-500/40',
};

interface Props {
  status: ServerStatus;
  dot?: boolean;
}

export default function StatusBadge({ status, dot }: Props) {
  if (dot) {
    return (
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
        status === 'running' ? 'bg-mc-green shadow-[0_0_6px_#5da832]' :
        status === 'starting' ? 'bg-yellow-400 animate-pulse' :
        status === 'stopping' ? 'bg-orange-400' :
        status === 'crashed' ? 'bg-red-500' : 'bg-gray-600'
      }`} />
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${bgColors[status]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${
        status === 'running' ? 'bg-mc-green shadow-[0_0_4px_#5da832]' :
        status === 'starting' ? 'bg-yellow-400 animate-pulse' :
        status === 'crashed' ? 'bg-red-500' : 'bg-current opacity-60'
      }`} />
      {status}
    </span>
  );
}
