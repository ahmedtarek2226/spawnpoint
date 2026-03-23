const BASE = '/api';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    window.location.href = '/login';
    throw new ApiError(401, 'Authentication required');
  }
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new ApiError(res.status, json.error?.message ?? 'Request failed');
  }
  return json.data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  delete: <T>(path: string, body?: unknown) => request<T>('DELETE', path, body),
};

export async function uploadFiles(path: string, files: FileList | File[], extra?: Record<string, string>): Promise<void> {
  const fd = new FormData();
  for (const f of Array.from(files)) fd.append('files', f);
  if (extra) for (const [k, v] of Object.entries(extra)) fd.append(k, v);
  const res = await fetch(`${BASE}${path}`, { method: 'POST', body: fd });
  const json = await res.json();
  if (!res.ok || !json.success) throw new ApiError(res.status, json.error?.message ?? 'Upload failed');
}

export async function uploadPrismExport(file: File, opts: { name?: string; port?: number; memoryMb?: number; javaVersion?: string }): Promise<unknown> {
  const fd = new FormData();
  fd.append('export', file);
  if (opts.name) fd.append('name', opts.name);
  if (opts.port) fd.append('port', String(opts.port));
  if (opts.memoryMb) fd.append('memoryMb', String(opts.memoryMb));
  if (opts.javaVersion) fd.append('javaVersion', opts.javaVersion);
  const res = await fetch(`${BASE}/prism/import`, { method: 'POST', body: fd });
  const json = await res.json();
  if (!res.ok || !json.success) throw new ApiError(res.status, json.error?.message ?? 'Import failed');
  return json.data;
}
