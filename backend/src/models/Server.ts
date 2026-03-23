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

export function createServer(config: Omit<ServerConfig, 'createdAt' | 'updatedAt'>): ServerConfig {
  getDb().query(`
    INSERT INTO servers (id, name, type, mc_version, port, jvm_flags, memory_mb, java_version, rcon_password, host_directory)
    VALUES ($id, $name, $type, $mcVersion, $port, $jvmFlags, $memoryMb, $javaVersion, $rconPassword, $hostDirectory)
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
  });
  return getServer(config.id)!;
}

export function updateServer(id: string, patch: Partial<Pick<ServerConfig, 'name' | 'jvmFlags' | 'memoryMb' | 'port' | 'javaVersion'>>): ServerConfig | undefined {
  const fields: string[] = [];
  const params: Record<string, unknown> = { $id: id };

  if (patch.name !== undefined) { fields.push('name = $name'); params.$name = patch.name; }
  if (patch.jvmFlags !== undefined) { fields.push('jvm_flags = $jvmFlags'); params.$jvmFlags = patch.jvmFlags; }
  if (patch.memoryMb !== undefined) { fields.push('memory_mb = $memoryMb'); params.$memoryMb = patch.memoryMb; }
  if (patch.port !== undefined) { fields.push('port = $port'); params.$port = patch.port; }
  if (patch.javaVersion !== undefined) { fields.push('java_version = $javaVersion'); params.$javaVersion = patch.javaVersion; }

  if (fields.length === 0) return getServer(id);

  fields.push("updated_at = datetime('now')");
  getDb().query(`UPDATE servers SET ${fields.join(', ')} WHERE id = $id`).run(params);
  return getServer(id);
}

export function deleteServer(id: string): void {
  getDb().query('DELETE FROM servers WHERE id = $id').run({ $id: id });
}
