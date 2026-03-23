import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import ServerDetail from './pages/ServerDetail';
import CreateServer from './pages/CreateServer';
import ImportPrism from './pages/ImportPrism';
import Login from './pages/Login';
import { initWs } from './hooks/useServerSocket';
import { useServersStore } from './stores/serversStore';
import { api } from './api/client';
import type { Server } from './stores/serversStore';

type AuthState = 'loading' | 'unauthenticated' | 'authenticated';

export default function App() {
  const setServers = useServersStore((s) => s.setServers);
  const servers = useServersStore((s) => s.servers);
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
    api.get<Server[]>('/servers').then(setServers).catch(console.error);
  }, [auth]);

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
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="servers/new" element={<CreateServer />} />
        <Route path="servers/import" element={<ImportPrism />} />
        <Route path="servers/:id/*" element={<ServerDetail />} />
      </Route>
    </Routes>
  );
}
