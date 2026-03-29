import { ChevronLeft } from 'lucide-react';

export const JAVA_VERSIONS = [
  { value: '8',        label: 'Java 8' },
  { value: '11',       label: 'Java 11' },
  { value: '17',       label: 'Java 17' },
  { value: '21',       label: 'Java 21 (recommended)' },
  { value: '21-graal', label: 'Java 21 GraalVM' },
  { value: '22',       label: 'Java 22' },
  { value: '25',       label: 'Java 25 (latest)' },
];

export const SERVER_TYPES = ['vanilla', 'paper', 'spigot', 'purpur', 'fabric', 'forge', 'neoforge', 'quilt', 'bungeecord', 'velocity'] as const;

export const TYPE_LABELS: Record<string, string> = {
  vanilla: 'Vanilla', paper: 'Paper', spigot: 'Spigot', purpur: 'Purpur',
  fabric: 'Fabric', forge: 'Forge', neoforge: 'NeoForge', quilt: 'Quilt',
  bungeecord: 'BungeeCord', velocity: 'Velocity',
};

export const POPULAR_VERSIONS = ['1.21.4', '1.21.3', '1.21.1', '1.20.6', '1.20.4', '1.20.1', '1.19.4', '1.18.2', '1.16.5', '1.12.2', '1.8.9'];

export function fmtDownloads(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 text-sm text-mc-muted hover:text-gray-200 mb-6 transition-colors">
      <ChevronLeft size={16} /> Back
    </button>
  );
}
