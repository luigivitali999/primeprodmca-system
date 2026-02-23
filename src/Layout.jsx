import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { base44 } from '@/api/base44Client';
import { 
  LayoutDashboard, 
  Users, 
  AlertTriangle, 
  FileText, 
  Globe, 
  Kanban,
  BarChart3,
  LogOut,
  Menu,
  X,
  Shield,
  ShieldCheck,
  Zap,
  Clock
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export default function Layout({ children, currentPageName }) {
  const [user, setUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [criticalLeaks, setCriticalLeaks] = useState(0);
  const [pendingApprovals, setPendingApprovals] = useState(0);

  useEffect(() => {
    loadUser();
    loadAlerts();
  }, []);

  const loadUser = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);
    } catch (e) {
      console.log('User not authenticated');
    }
  };

  const loadAlerts = async () => {
    try {
      const [leaks, pending] = await Promise.all([
        base44.entities.Leak.filter({ severity: 'critical', status: 'found' }),
        base44.entities.PendingApproval.filter({ status: 'pending' }),
      ]);
      setCriticalLeaks(leaks.length);
      setPendingApprovals(pending.length);
    } catch (e) {}
  };

  const navigation = [
    { name: 'Dashboard', page: 'Dashboard', icon: LayoutDashboard },
    { name: 'Creators', page: 'Creators', icon: Users },
    { name: 'Leaks', page: 'Leaks', icon: AlertTriangle },
    { name: 'DMCA Pipeline', page: 'Pipeline', icon: Kanban },
    { name: 'Richieste DMCA', page: 'DMCARequests', icon: FileText },
    { name: 'Domini', page: 'Domains', icon: Globe },
    { name: 'Whitelist', page: 'Whitelist', icon: ShieldCheck },
    { name: 'Ordini Diretti', page: 'DirectOrders', icon: Zap },
    { name: 'Approvazioni', page: 'PendingApprovals', icon: Clock },
    { name: 'Report', page: 'Reports', icon: BarChart3 },
  ];

  const isActive = (page) => currentPageName === page;

  return (
    <div className="min-h-screen" style={{ background: '#080e1a' }}>
      <style>{`
        :root {
          --prime-navy: #0a1120;
          --prime-blue: #3b82f6;
          --prime-indigo: #6366f1;
          --prime-emerald: #10b981;
          --prime-amber: #f59e0b;
          --prime-red: #ef4444;
        }
        body { background: #080e1a !important; }
      `}</style>

      {/* Sidebar Desktop */}
      <aside className="fixed inset-y-0 left-0 z-50 w-64 hidden lg:flex lg:flex-col" style={{ background: '#0a1120', borderRight: '1px solid rgba(99,102,241,0.12)' }}>
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 px-6" style={{ borderBottom: '1px solid rgba(99,102,241,0.12)' }}>
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-lg font-bold text-white tracking-tight">PRIME</span>
            <p className="text-[10px] text-slate-500 -mt-0.5 tracking-wider">DMCA INTELLIGENCE</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.page);
            return (
              <Link
                key={item.name}
                to={createPageUrl(item.page)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all relative
                  ${active 
                    ? 'text-white' 
                    : 'text-slate-500 hover:text-slate-200'
                  }
                `}
              style={isActive(item.page) ? {
                background: 'rgba(99,102,241,0.15)',
                boxShadow: 'inset 0 0 0 1px rgba(99,102,241,0.25)',
              } : {}}
              >
                <Icon className="w-4 h-4" />
                {item.name}
                {item.page === 'Leaks' && criticalLeaks > 0 && (
                  <Badge className="ml-auto text-[10px] px-1.5" style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
                    {criticalLeaks}
                  </Badge>
                )}
                {item.page === 'PendingApprovals' && pendingApprovals > 0 && (
                  <Badge className="ml-auto text-[10px] px-1.5" style={{ background: 'rgba(245,158,11,0.2)', color: '#fcd34d', border: '1px solid rgba(245,158,11,0.3)' }}>
                    {pendingApprovals}
                  </Badge>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Section */}
        {user && (
          <div className="p-4" style={{ borderTop: '1px solid rgba(99,102,241,0.12)' }}>
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9" style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.3)' }}>
                <AvatarFallback className="text-sm" style={{ color: '#a5b4fc', background: 'transparent' }}>
                  {user.full_name?.charAt(0) || user.email?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{user.full_name || 'Utente'}</p>
                <p className="text-xs text-slate-500 truncate capitalize">{user.role || 'user'}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-slate-500 hover:text-slate-200 hover:bg-transparent"
                onClick={() => base44.auth.logout()}
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-40 h-14 flex items-center justify-between px-4" style={{ background: '#0a1120', borderBottom: '1px solid rgba(99,102,241,0.12)' }}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <span className="text-base font-bold text-white">PRIME</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-white"
          onClick={() => setSidebarOpen(true)}
        >
          <Menu className="w-5 h-5" />
        </Button>
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64" style={{ background: '#0a1120', borderRight: '1px solid rgba(99,102,241,0.12)' }}>
            <div className="flex h-14 items-center justify-between px-4" style={{ borderBottom: '1px solid rgba(99,102,241,0.12)' }}>
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-500" />
                <span className="text-base font-bold text-white">PRIME</span>
              </div>
              <Button variant="ghost" size="icon" className="text-white" onClick={() => setSidebarOpen(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>
            <nav className="px-3 py-4 space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    to={createPageUrl(item.page)}
                    onClick={() => setSidebarOpen(false)}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                      ${isActive(item.page) ? 'text-white' : 'text-slate-500 hover:text-slate-200'}
                    `}
                  >
                    <Icon className="w-5 h-5" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main className="lg:pl-64 pt-14 lg:pt-0 min-h-screen">
        <div className="p-4 lg:p-8" style={{ background: '#080e1a', minHeight: '100vh' }}>
          {children}
        </div>
      </main>
    </div>
  );
}