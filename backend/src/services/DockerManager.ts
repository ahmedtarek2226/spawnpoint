import Dockerode from 'dockerode';
import path from 'path';
import fs from 'fs';
import { execFileSync } from 'child_process';
import { ServerConfig, ServerRuntime, ServerMetrics, ServerStatus, WsOutbound } from '../types';
import { MC_IMAGE, RCON_PORT_INSIDE_CONTAINER, CONSOLE_BUFFER_SIZE, SERVERS_DIR } from '../config';
import { getHostDataDir } from './hostDataDir';
import { analyzeCrash } from './CrashAnalyzer';
import { getServer } from '../models/Server';
import { startScheduler, stopScheduler, onPlayerJoin } from './MessageScheduler';
import { notifyServerStart, notifyServerStop, notifyServerCrash, notifyPlayerJoin } from './NotificationService';

const docker = new Dockerode({ socketPath: '/var/run/docker.sock' });

const runtimes = new Map<string, ServerRuntime>();
const metricsIntervals = new Map<string, NodeJS.Timeout>();
const logStreams = new Map<string, NodeJS.ReadableStream>();
const inProgress = new Set<string>(); // servers with a lifecycle operation in flight

type BroadcastFn = (serverId: string, msg: WsOutbound) => void;
let broadcast: BroadcastFn = () => {};

export function setBroadcast(fn: BroadcastFn): void {
  broadcast = fn;
}

function containerName(serverId: string): string {
  return `mc-server-${serverId}`;
}

function getRuntime(serverId: string): ServerRuntime {
  if (!runtimes.has(serverId)) {
    runtimes.set(serverId, {
      status: 'stopped',
      metrics: { cpuPercent: 0, ramMb: 0, tps: null, playersOnline: 0, playersMax: 0 },
      consoleBuf: [],
      playersOnline: [],
    });
  }
  return runtimes.get(serverId)!;
}

function setStatus(serverId: string, status: ServerStatus): void {
  const rt = getRuntime(serverId);
  rt.status = status;
  if (status === 'running') {
    rt.startedAt = Date.now();
    rt.stoppedAt = undefined;
  } else if (status === 'stopped' || status === 'crashed') {
    rt.stoppedAt = Date.now();
    rt.startedAt = undefined;
  }
  broadcast(serverId, { type: 'status_change', serverId, status, startedAt: rt.startedAt, stoppedAt: rt.stoppedAt });

  const config = getServer(serverId);
  if (config) {
    if (status === 'running') notifyServerStart(serverId, config.name);
    else if (status === 'stopped') notifyServerStop(serverId, config.name);
    else if (status === 'crashed') notifyServerCrash(serverId, config.name);
  }
}

export function setBackingUp(serverId: string, value: boolean): void {
  getRuntime(serverId).backingUp = value;
  broadcast(serverId, { type: 'backup_status', serverId, backingUp: value });
}

function pushLine(serverId: string, line: string, skipStatusInference = false): void {
  const rt = getRuntime(serverId);
  rt.consoleBuf.push(line);
  if (rt.consoleBuf.length > CONSOLE_BUFFER_SIZE) rt.consoleBuf.shift();
  broadcast(serverId, { type: 'console_line', serverId, line, timestamp: Date.now() });

  // Detect status from console output — skipped when replaying historical log lines during sync
  if (!skipStatusInference) {
    if (/Done \([\d.]+s\)! For help/.test(line)) {
      setStatus(serverId, 'running');
      const config = getServer(serverId);
      if (config) startScheduler(config);
    }
    if (/Stopping the server/.test(line)) setStatus(serverId, 'stopping');
  }

  // Parse TPS from Paper/Spigot `/tps` response
  const tpsMatch = line.match(/TPS from last 1m, 5m, 15m: ([\d.]+)/);
  if (tpsMatch) {
    getRuntime(serverId).metrics.tps = parseFloat(tpsMatch[1]);
  }

  // Parse player join/leave — NeoForge format: "[0] PlayerName joined the game"
  // Vanilla/Paper format: "PlayerName joined the game"
  if (line.includes('[Server thread/INFO]')) {
    const joinMatch = line.match(/(\w{3,16})\s+joined the game/);
    if (joinMatch) {
      const rt = getRuntime(serverId);
      const name = joinMatch[1];
      if (!rt.playersOnline.includes(name)) rt.playersOnline.push(name);
      rt.metrics.playersOnline = rt.playersOnline.length;
      const config = getServer(serverId);
      if (config) {
        onPlayerJoin(config, name);
        notifyPlayerJoin(serverId, config.name, name);
      }
    }
    const leaveMatch = line.match(/(\w{3,16})\s+left the game/);
    if (leaveMatch) {
      const rt = getRuntime(serverId);
      rt.playersOnline = rt.playersOnline.filter((p) => p !== leaveMatch[1]);
      rt.metrics.playersOnline = rt.playersOnline.length;
    }
  }
  // Parse max players from "There are X of a max of Y players"
  const playersMatch = line.match(/There are (\d+) of a max of (\d+) players/);
  if (playersMatch) {
    const rt = getRuntime(serverId);
    rt.metrics.playersOnline = parseInt(playersMatch[1]);
    rt.metrics.playersMax = parseInt(playersMatch[2]);
  }
}

async function attachLogs(serverId: string, container: Dockerode.Container, skipStatusInference = false): Promise<void> {
  if (logStreams.has(serverId)) return;

  const stream = await container.logs({
    follow: true,
    stdout: true,
    stderr: true,
    tail: 100,
  }) as NodeJS.ReadableStream;

  logStreams.set(serverId, stream);

  let buf = '';
  stream.on('data', (chunk: Buffer) => {
    // Docker multiplexed stream: 8-byte header per frame
    let offset = 0;
    while (offset < chunk.length) {
      if (chunk.length - offset < 8) break;
      const frameSize = chunk.readUInt32BE(offset + 4);
      offset += 8;
      if (offset + frameSize > chunk.length) break;
      buf += chunk.slice(offset, offset + frameSize).toString('utf8');
      offset += frameSize;
    }
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      if (line.trim()) pushLine(serverId, line, skipStatusInference);
    }
  });

  stream.on('end', () => {
    logStreams.delete(serverId);
    stopScheduler(serverId);
    const rt = getRuntime(serverId);
    if (rt.status !== 'stopping' && rt.status !== 'stopped') {
      const serverDir = path.join(SERVERS_DIR, serverId);
      rt.crashDiagnosis = analyzeCrash(rt.consoleBuf, serverDir);
      broadcast(serverId, { type: 'crash_diagnosis', serverId, issues: rt.crashDiagnosis });
      setStatus(serverId, 'crashed');
    } else {
      rt.crashDiagnosis = undefined;
      setStatus(serverId, 'stopped');
    }
    stopMetrics(serverId);
  });

  stream.on('error', () => {
    logStreams.delete(serverId);
    setStatus(serverId, 'crashed');
    stopMetrics(serverId);
  });
}

function startMetrics(serverId: string, container: Dockerode.Container): void {
  stopMetrics(serverId);

  const interval = setInterval(async () => {
    try {
      const stats = await new Promise<Dockerode.ContainerStats>((resolve, reject) => {
        container.stats({ stream: false }, (err, data) => {
          if (err) reject(err);
          else resolve(data!);
        });
      });

      const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
      const sysDelta = (stats.cpu_stats.system_cpu_usage ?? 0) - (stats.precpu_stats.system_cpu_usage ?? 0);
      const numCpus = stats.cpu_stats.online_cpus ?? 1;
      const cpuPercent = sysDelta > 0 ? (cpuDelta / sysDelta) * numCpus * 100 : 0;
      const ramMb = (stats.memory_stats.usage ?? 0) / (1024 * 1024);

      const rt = getRuntime(serverId);
      rt.metrics.cpuPercent = Math.round(cpuPercent * 10) / 10;
      rt.metrics.ramMb = Math.round(ramMb);

      broadcast(serverId, {
        type: 'metrics_tick',
        serverId,
        metrics: { ...rt.metrics },
        timestamp: Date.now(),
      });
    } catch {
      // Container may not be running yet
    }
  }, 3000);

  metricsIntervals.set(serverId, interval);
}

function stopMetrics(serverId: string): void {
  const interval = metricsIntervals.get(serverId);
  if (interval) {
    clearInterval(interval);
    metricsIntervals.delete(serverId);
  }
}

export async function syncContainerStates(servers: ServerConfig[]): Promise<void> {
  for (const server of servers) {
    try {
      const container = docker.getContainer(containerName(server.id));
      const info = await container.inspect();
      if (info.State.Running) {
        getRuntime(server.id).containerId = info.Id;
        setStatus(server.id, 'running');
        await attachLogs(server.id, container, true); // skipStatusInference: don't let stale log lines override the inspect()-confirmed state
        startMetrics(server.id, container);
        const config = getServer(server.id);
        if (config) startScheduler(config); // restart scheduler for servers that were running before backend restarted
      }
    } catch {
      // Container doesn't exist — server is stopped
    }
  }
}

export function getServerRuntime(serverId: string): ServerRuntime {
  return getRuntime(serverId);
}

export function getConsoleBuf(serverId: string): string[] {
  return [...getRuntime(serverId).consoleBuf];
}

export async function startServer(config: ServerConfig): Promise<void> {
  if (inProgress.has(config.id)) throw new Error('Operation already in progress for this server');
  const rt = getRuntime(config.id);
  if (rt.status === 'running' || rt.status === 'starting') {
    throw new Error('Server is already running');
  }

  inProgress.add(config.id);
  setStatus(config.id, 'starting');
  rt.consoleBuf = [];
  rt.metrics.playersOnline = 0;
  rt.playersOnline = [];
  rt.crashDiagnosis = undefined;

  const name = containerName(config.id);

  // Resolve host directory for bind mount — must be an absolute HOST path
  const hostDataDir = await getHostDataDir();
  const hostDir = path.isAbsolute(config.hostDirectory)
    ? config.hostDirectory
    : path.join(hostDataDir, 'servers', config.id);

  fs.mkdirSync(hostDir, { recursive: true });

  // Remove old container if it exists
  try {
    const old = docker.getContainer(name);
    await old.remove({ force: true });
  } catch { /* doesn't exist */ }

  // Remove stale session.lock files so Minecraft can acquire the world lock.
  // These are left behind when a container is killed (SIGKILL) without a clean shutdown.
  // Scan all subdirectories — don't rely on server.properties being present yet.
  try {
    const serverDataDir = path.join(SERVERS_DIR, config.id);
    if (fs.existsSync(serverDataDir)) {
      for (const entry of fs.readdirSync(serverDataDir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          const lockPath = path.join(serverDataDir, entry.name, 'session.lock');
          if (fs.existsSync(lockPath)) {
            fs.unlinkSync(lockPath);
            console.log(`[startServer] Removed stale session.lock from ${entry.name}/`);
          }
        }
      }
    }
  } catch (e) {
    console.warn(`[startServer] session.lock cleanup failed: ${e}`);
  }

  // Fix ownership so the minecraft user (UID 1000) inside the container can write to the
  // server directory. Files created by older containers or by root have root ownership,
  // which causes java.nio.file.AccessDeniedException on session.lock.
  try {
    const serverDataDir = path.join(SERVERS_DIR, config.id);
    if (fs.existsSync(serverDataDir)) {
      execFileSync('chown', ['-R', '1000:1000', serverDataDir]);
      console.log(`[startServer] Fixed ownership of ${serverDataDir} to 1000:1000`);
    }
  } catch (e) {
    console.warn(`[startServer] chown failed: ${e}`);
  }

  const env = [
    `TYPE=${config.type.toUpperCase()}`,
    `VERSION=${config.mcVersion}`,
    `EULA=TRUE`,
    `MEMORY=${config.memoryMb}M`,
    `JVM_OPTS=${config.jvmFlags}`,
    `RCON_PASSWORD=${config.rconPassword}`,
    `ENABLE_RCON=true`,
    `RCON_PORT=${RCON_PORT_INSIDE_CONTAINER}`,
    `SERVER_PORT=25565`,
    `JAVA_VERSION=${config.javaVersion ?? '21'}`,
  ];

  // Select the Java-specific image tag to guarantee the correct JVM version.
  // itzg/minecraft-server tags: java8, java11, java17, java21, java21-graalvm, java22
  const javaTag = (config.javaVersion ?? '21') === '21-graal' ? 'java21-graalvm' : `java${config.javaVersion ?? '21'}`;
  const image = `${MC_IMAGE}:${javaTag}`;

  // Pull image if not present locally
  await new Promise<void>((resolve, reject) => {
    docker.pull(image, (err: Error | null, stream: NodeJS.ReadableStream) => {
      if (err) return reject(err);
      docker.modem.followProgress(stream, (err: Error | null) => err ? reject(err) : resolve());
    });
  });

  const container = await docker.createContainer({
    name,
    Image: image,
    Env: env,
    HostConfig: {
      PortBindings: {
        '25565/tcp': [{ HostPort: `${config.port}` }],
      },
      Binds: [`${hostDir}:/data`],
      RestartPolicy: { Name: 'no' },
    },
    ExposedPorts: { '25565/tcp': {} },
  });

  try {
    await container.start();
    getRuntime(config.id).containerId = container.id;
    await attachLogs(config.id, container);
    startMetrics(config.id, container);
  } finally {
    inProgress.delete(config.id);
  }
}

export async function stopServer(serverId: string): Promise<void> {
  if (inProgress.has(serverId)) throw new Error('Operation already in progress for this server');
  const rt = getRuntime(serverId);
  if (rt.status === 'stopped') return;

  inProgress.add(serverId);
  setStatus(serverId, 'stopping');

  try {
    const container = docker.getContainer(containerName(serverId));
    await container.stop({ t: 30 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes('not running')) throw err;
  } finally {
    inProgress.delete(serverId);
  }

  stopMetrics(serverId);
  setStatus(serverId, 'stopped');
}

export async function restartServer(config: ServerConfig): Promise<void> {
  await stopServer(config.id);
  await startServer(config);
}

export async function killServer(serverId: string): Promise<void> {
  try {
    const container = docker.getContainer(containerName(serverId));
    await container.kill();
  } catch { /* ignore */ }
  stopMetrics(serverId);
  stopScheduler(serverId);
  setStatus(serverId, 'stopped');
}

export async function sendCommand(config: ServerConfig, command: string): Promise<void> {
  const rt = getRuntime(config.id);
  if (rt.status !== 'running') throw new Error('Server is not running');

  const container = docker.getContainer(containerName(config.id));
  const exec = await container.exec({
    Cmd: ['rcon-cli', '--password', config.rconPassword, command],
    AttachStdout: true,
    AttachStderr: true,
    Tty: true, // plain stream — no 8-byte mux headers
  });

  // Dockerode bundles the stream payload inside the error message for exec
  // (HTTP 101 / stream upgrade). Collect whichever path provides the data.
  let raw = '';
  try {
    raw = await new Promise<string>((resolve, reject) => {
      exec.start({ hijack: true, Tty: true }, (err: Error | null, stream: NodeJS.ReadableStream) => {
        if (err && !stream) return reject(err);
        if (!stream) return resolve('');
        let buf = '';
        stream.on('data', (chunk: Buffer) => { buf += chunk.toString('utf8'); });
        stream.on('end', () => resolve(buf.trim()));
        (stream as NodeJS.ReadableStream & { on(e: 'close', l: () => void): void })
          .on('close', () => resolve(buf.trim()));
        stream.on('error', reject);
      });
    });
  } catch (err) {
    // Extract payload bundled after "unexpected - " in the Dockerode error message
    const msg = (err as Error).message ?? '';
    const idx = msg.indexOf('unexpected - ');
    raw = idx >= 0 ? msg.slice(idx + 'unexpected - '.length) : '';
    if (!raw) throw err;
  }

  // Strip ANSI escape codes and carriage returns that rcon-cli injects
  const output = raw.replace(/\x1b\[[0-9;]*[\x40-\x7e]/g, '').replace(/\r/g, '').trim();

  if (output) {
    for (const line of output.split('\n')) {
      if (line.trim()) pushLine(config.id, line);
    }
  }
}

export async function checkDockerAvailable(): Promise<boolean> {
  try {
    await docker.ping();
    return true;
  } catch {
    return false;
  }
}

export async function pullImage(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    docker.pull(MC_IMAGE, (err: Error | null, stream: NodeJS.ReadableStream) => {
      if (err) return reject(err);
      docker.modem.followProgress(stream, (err2: Error | null) => {
        if (err2) reject(err2);
        else resolve();
      });
    });
  });
}
