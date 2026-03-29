import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState, lazy, Suspense } from 'react';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import JobsPanel from './components/JobsPanel';

const Dashboard    = lazy(() => import('./pages/Dashboard'));
const ServerDetail = lazy(() => import('./pages/ServerDetail'));
const CreateServer = lazy(() => import('./pages/CreateServer'));
const ImportPrism  = lazy(() => import('./pages/ImportPrism'));
const ImportBackup = lazy(() => import('./pages/ImportBackup'));
import { initWs, onWsConnect } from './hooks/useServerSocket';
import { useServersStore } from './stores/serversStore';
import { useJobStore } from './stores/jobStore';
import { api } from './api/client';
import type { Server } from './stores/serversStore';
import type { JobRecord } from './stores/jobStore';

type AuthState = 'loading' | 'unauthenticated' | 'authenticated';

export default function App() {
  const setServers = useServersStore((s) => s.setServers);
  const servers = useServersStore((s) => s.servers);
  const setJobs = useJobStore((s) => s.setJobs);
  const [auth, setAuth] = useState<AuthState>('loading');

  useEffect(() => {
    fetch('/api/auth/check')
      .then((r) => r.json())
      .then((json) => {
        if (!json.data.required || json.data.authenticated) {
          setAuth('authenticated');
        } else {
          setAuth('unauthenticated');
        }
      })
      .catch(() => setAuth('unauthenticated'));
  }, []);

  useEffect(() => {
    if (auth !== 'authenticated') return;
    initWs();
    const fetchServers = () => api.get<Server[]>('/servers').then(setServers).catch(() => {});
    fetchServers();
    api.get<JobRecord[]>('/jobs').then(setJobs).catch(() => {});
    // Re-sync on WS connect/reconnect to catch any missed status changes
    const unsubWs = onWsConnect(fetchServers);
    return unsubWs;
  }, [auth]);

  // Fast-poll while any server is in a transitional state
  useEffect(() => {
    const transitional = servers.some((s) =>
      s.runtime.status === 'starting' || s.runtime.status === 'stopping'
    );
    if (!transitional) return;
    const interval = setInterval(() => {
      api.get<Server[]>('/servers').then(setServers).catch(() => {});
    }, 2000);
    return () => clearInterval(interval);
  }, [servers]);

  useEffect(() => {
    const live = servers.filter((s) => s.runtime.status === 'running').length;
    document.title = live > 0 ? `(${live} live) Spawnpoint` : 'Spawnpoint';
  }, [servers]);

  if (auth === 'loading') {
    return <div className="min-h-screen bg-mc-dark" />;
  }

  if (auth === 'unauthenticated') {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <>
      <Suspense fallback={<div className="min-h-screen bg-mc-dark" />}>
        <Routes>
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="servers/new" element={<CreateServer />} />
            <Route path="servers/import" element={<ImportPrism />} />
            <Route path="servers/import-backup" element={<ImportBackup />} />
            <Route path="servers/:id/*" element={<ServerDetail />} />
          </Route>
        </Routes>
      </Suspense>
      <JobsPanel />
    </>
  );
}
