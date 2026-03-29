import { getDb } from '../db/database';

export function getSetting(key: string): string | null {
  const row = getDb().query<{ value: string }, [string]>(
    'SELECT value FROM settings WHERE key = ?'
  ).get(key);
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  getDb().run(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value]
  );
}

export function deleteSetting(key: string): void {
  getDb().run('DELETE FROM settings WHERE key = ?', [key]);
}
