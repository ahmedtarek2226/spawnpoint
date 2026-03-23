import fs from 'fs';
import path from 'path';
import { CrashIssue } from '../types';

export function analyzeCrash(consoleBuf: string[], serverDir: string): CrashIssue[] {
  const issues: CrashIssue[] = [];
  const buf = consoleBuf.join('\n');

  // Client-only mod: "X (modid) has failed to load correctly" + "invalid dist DEDICATED_SERVER"
  if (/invalid dist DEDICATED_SERVER/i.test(buf)) {
    const failedModRe = /([^\n]+)\s+has\s+failed\s+to\s+load\s+correctly/gi;
    let match: RegExpExecArray | null;
    while ((match = failedModRe.exec(buf)) !== null) {
      const label = match[1].trim();
      const idMatch = label.match(/\(([^)]+)\)\s*$/);
      const modId = idMatch?.[1] ?? label;
      const displayName = idMatch ? label.replace(/\s*\([^)]+\)\s*$/, '').trim() : label;

      // Find the jar file in the mods directory
      let modFile: string | undefined;
      const modsDir = path.join(serverDir, 'mods');
      if (fs.existsSync(modsDir)) {
        const jars = fs.readdirSync(modsDir).filter((f) => f.endsWith('.jar'));
        modFile = jars.find((j) => j.toLowerCase().includes(modId.toLowerCase()));
      }

      issues.push({
        type: 'client_only_mod',
        message: `"${displayName}" is a client-only mod and cannot run on a dedicated server.`,
        modId,
        modFile,
        fixable: !!modFile,
      });
    }
  }

  // Java version mismatch
  const javaMatch = buf.match(/requires javaVersion ([\d.]+) or above.*?but ([\d.]+) is available/i);
  if (javaMatch) {
    issues.push({
      type: 'java_version',
      message: `Java version mismatch: requires ${javaMatch[1]}+, but ${javaMatch[2]} is available. Update the Java version in server settings.`,
      fixable: false,
    });
  }

  // Out of memory
  if (/OutOfMemoryError/i.test(buf)) {
    issues.push({
      type: 'out_of_memory',
      message: 'Server ran out of memory. Increase the RAM allocation in server settings.',
      fixable: false,
    });
  }

  if (issues.length === 0) {
    issues.push({
      type: 'unknown',
      message: 'Server crashed unexpectedly. Check the console output for details.',
      fixable: false,
    });
  }

  return issues;
}
