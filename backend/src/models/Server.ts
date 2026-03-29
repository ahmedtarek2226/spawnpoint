import { getDb } from '../db/database';
import { ServerConfig } from '../types';

interface ServerRow {
  id: string;
  name: string;
  type: string;
  mc_version: string;
  port: number;
  jvm_flags: string;
  memory_mb: number;
  java_version: string;
  rcon_password: string;
  host_directory: string;
  tags: string;
  backup_enabled: number;
  backup_interval_hours: number;
  backup_retain_count: number;
  backup_last_at: string | null;
  discord_webhook_url: string | null;
  modpack_source: string | null;
  modpack_project_id: string | null;
  modpack_version_id: string | null;
  modpack_slug: string | null;
  created_at: string;
  updated_at: string;
}

function rowToConfig(row: ServerRow): ServerConfig {
  return {
    id: row.id,
    name: row.name,
    type: row.type as ServerConfig['type'],
    mcVersion: row.mc_version,
    port: row.port,
    jvmFlags: row.jvm_flags,
    memoryMb: row.memory_mb,
    javaVersion: row.java_version ?? '21',
    rconPassword: row.rcon_password,
    hostDirectory: row.host_directory,
    tags: JSON.parse(row.tags ?? '[]'),
    backupEnabled: row.backup_enabled === 1,
    backupIntervalHours: row.backup_interval_hours ?? 24,
    backupRetainCount: row.backup_retain_count ?? 5,
    backupLastAt: row.backup_last_at ?? null,
    discordWebhookUrl: row.discord_webhook_url ?? null,
    modpackSource: (row.modpack_source as 'modrinth' | 'curseforge' | null) ?? null,
    modpackProjectId: row.modpack_project_id ?? null,
    modpackVersionId: row.modpack_version_id ?? null,
    modpackSlug: row.modpack_slug ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listServers(): ServerConfig[] {
  return (getDb().query('SELECT * FROM servers ORDER BY created_at ASC').all() as ServerRow[]).map(rowToConfig);
}

export function getServer(id: string): ServerConfig | undefined {
  const row = getDb().query('SELECT * FROM servers WHERE id = $id').get({ $id: id }) as ServerRow | undefined;
  return row ? rowToConfig(row) : undefined;
}

export function createServer(config: Omit<ServerConfig, 'createdAt' | 'updatedAt' | 'tags' | 'backupEnabled' | 'backupIntervalHours' | 'backupRetainCount' | 'backupLastAt' | 'discordWebhookUrl'> & {
  tags?: string[];
  backupEnabled?: boolean;
  backupIntervalHours?: number;
  backupRetainCount?: number;
  backupLastAt?: string | null;
  discordWebhookUrl?: string | null;
}): ServerConfig {
  getDb().query(`
    INSERT INTO servers (id, name, type, mc_version, port, jvm_flags, memory_mb, java_version, rcon_password, host_directory, modpack_source, modpack_project_id, modpack_version_id, modpack_slug)
    VALUES ($id, $name, $type, $mcVersion, $port, $jvmFlags, $memoryMb, $javaVersion, $rconPassword, $hostDirectory, $modpackSource, $modpackProjectId, $modpackVersionId, $modpackSlug)
  `).run({
    $id: config.id,
    $name: config.name,
    $type: config.type,
    $mcVersion: config.mcVersion,
    $port: config.port,
    $jvmFlags: config.jvmFlags,
    $memoryMb: config.memoryMb,
    $javaVersion: config.javaVersion ?? '21',
    $rconPassword: config.rconPassword,
    $hostDirectory: config.hostDirectory,
    $modpackSource: config.modpackSource ?? null,
    $modpackProjectId: config.modpackProjectId ?? null,
    $modpackVersionId: config.modpackVersionId ?? null,
    $modpackSlug: config.modpackSlug ?? null,
  });
  return getServer(config.id)!;
}

type ServerPatch = Partial<Pick<ServerConfig,
  'name' | 'jvmFlags' | 'memoryMb' | 'port' | 'javaVersion' | 'tags' |
  'backupEnabled' | 'backupIntervalHours' | 'backupRetainCount' | 'backupLastAt' |
  'rconPassword' | 'discordWebhookUrl' |
  'modpackSource' | 'modpackProjectId' | 'modpackVersionId' | 'modpackSlug' |
  'mcVersion' | 'type'
>>;

export function updateServer(id: string, patch: ServerPatch): ServerConfig | undefined {
  const fields: string[] = [];
  const params: Record<string, unknown> = { $id: id };

  if (patch.name !== undefined) { fields.push('name = $name'); params.$name = patch.name; }
  if (patch.jvmFlags !== undefined) { fields.push('jvm_flags = $jvmFlags'); params.$jvmFlags = patch.jvmFlags; }
  if (patch.memoryMb !== undefined) { fields.push('memory_mb = $memoryMb'); params.$memoryMb = patch.memoryMb; }
  if (patch.port !== undefined) { fields.push('port = $port'); params.$port = patch.port; }
  if (patch.javaVersion !== undefined) { fields.push('java_version = $javaVersion'); params.$javaVersion = patch.javaVersion; }
  if (patch.tags !== undefined) { fields.push('tags = $tags'); params.$tags = JSON.stringify(patch.tags); }
  if (patch.backupEnabled !== undefined) { fields.push('backup_enabled = $backupEnabled'); params.$backupEnabled = patch.backupEnabled ? 1 : 0; }
  if (patch.backupIntervalHours !== undefined) { fields.push('backup_interval_hours = $backupIntervalHours'); params.$backupIntervalHours = patch.backupIntervalHours; }
  if (patch.backupRetainCount !== undefined) { fields.push('backup_retain_count = $backupRetainCount'); params.$backupRetainCount = patch.backupRetainCount; }
  if (patch.backupLastAt !== undefined) { fields.push('backup_last_at = $backupLastAt'); params.$backupLastAt = patch.backupLastAt; }
  if (patch.rconPassword !== undefined) { fields.push('rcon_password = $rconPassword'); params.$rconPassword = patch.rconPassword; }
  if (patch.discordWebhookUrl !== undefined) { fields.push('discord_webhook_url = $discordWebhookUrl'); params.$discordWebhookUrl = patch.discordWebhookUrl; }
  if (patch.modpackSource !== undefined) { fields.push('modpack_source = $modpackSource'); params.$modpackSource = patch.modpackSource; }
  if (patch.modpackProjectId !== undefined) { fields.push('modpack_project_id = $modpackProjectId'); params.$modpackProjectId = patch.modpackProjectId; }
  if (patch.modpackVersionId !== undefined) { fields.push('modpack_version_id = $modpackVersionId'); params.$modpackVersionId = patch.modpackVersionId; }
  if (patch.modpackSlug !== undefined) { fields.push('modpack_slug = $modpackSlug'); params.$modpackSlug = patch.modpackSlug; }
  if (patch.mcVersion !== undefined) { fields.push('mc_version = $mcVersion'); params.$mcVersion = patch.mcVersion; }
  if (patch.type !== undefined) { fields.push('type = $type'); params.$type = patch.type; }

  if (fields.length === 0) return getServer(id);

  fields.push("updated_at = datetime('now')");
  getDb().query(`UPDATE servers SET ${fields.join(', ')} WHERE id = $id`).run(params);
  return getServer(id);
}

export function deleteServer(id: string): void {
  getDb().query('DELETE FROM servers WHERE id = $id').run({ $id: id });
}
