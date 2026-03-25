import { getServer } from '../models/Server';

interface DiscordEmbed {
  title: string;
  description?: string;
  color: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  timestamp?: string;
}

async function sendWebhook(url: string, embed: DiscordEmbed): Promise<void> {
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [{ ...embed, timestamp: new Date().toISOString() }] }),
    });
  } catch {
    // Best-effort — never crash the caller
  }
}

function getWebhook(serverId: string): string | null {
  return getServer(serverId)?.discordWebhookUrl ?? null;
}

const COLORS = {
  green: 0x4ade80,
  red: 0xf87171,
  yellow: 0xfacc15,
  blue: 0x60a5fa,
  gray: 0x6b7280,
};

export function notifyServerStart(serverId: string, serverName: string): void {
  const url = getWebhook(serverId);
  if (!url) return;
  sendWebhook(url, {
    title: '✅ Server Started',
    description: `**${serverName}** is now online.`,
    color: COLORS.green,
  });
}

export function notifyServerStop(serverId: string, serverName: string): void {
  const url = getWebhook(serverId);
  if (!url) return;
  sendWebhook(url, {
    title: '⏹️ Server Stopped',
    description: `**${serverName}** has stopped.`,
    color: COLORS.gray,
  });
}

export function notifyServerCrash(serverId: string, serverName: string): void {
  const url = getWebhook(serverId);
  if (!url) return;
  sendWebhook(url, {
    title: '💥 Server Crashed',
    description: `**${serverName}** has crashed unexpectedly.`,
    color: COLORS.red,
  });
}

export function notifyPlayerJoin(serverId: string, serverName: string, playerName: string): void {
  const url = getWebhook(serverId);
  if (!url) return;
  sendWebhook(url, {
    title: '👤 Player Joined',
    description: `**${playerName}** joined **${serverName}**.`,
    color: COLORS.blue,
  });
}

export function notifyBackupComplete(serverId: string, serverName: string, label: string, sizeMb: number): void {
  const url = getWebhook(serverId);
  if (!url) return;
  sendWebhook(url, {
    title: '💾 Backup Complete',
    description: `Auto-backup of **${serverName}** finished.`,
    color: COLORS.yellow,
    fields: [
      { name: 'Label', value: label, inline: true },
      { name: 'Size', value: `${sizeMb.toFixed(1)} MB`, inline: true },
    ],
  });
}
