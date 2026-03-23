import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-mc-dark">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — drawer on mobile, always visible on md+ */}
      <div className={`
        fixed inset-y-0 left-0 z-30 transition-transform duration-200
        md:static md:translate-x-0 md:z-auto
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-auto min-w-0">
        {/* Mobile top bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-mc-border bg-mc-panel md:hidden">
          <button onClick={() => setSidebarOpen(true)} className="text-mc-muted hover:text-gray-200">
            <Menu size={20} />
          </button>
          <img src="/favicon.svg" alt="" className="w-5 h-5" />
          <span className="font-bold text-mc-green text-sm tracking-tight">Spawnpoint</span>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
