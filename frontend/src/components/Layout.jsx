import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import {
  LayoutDashboard, Calendar, ClipboardList, Package,
  FolderOpen, Users, Settings, Menu,
} from 'lucide-react';
import { RankInsignia } from './Rank';

const ROLE_LABELS = {
  soldat:'Soldat', grpc:'Gruppchef', pc:'Plutonchef', toc:'Troppchef',
  kompc:'Kompanichef', kvm:'Komp-VKM', s4:'S4 / Bat-VKM', batCh:'Bataljonschef', stab:'Stab'
};

function NavItem({ to, label, icon: Icon, badge, onClick }) {
  return (
    <NavLink to={to} onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors
         ${isActive
           ? 'bg-white/15 text-white font-medium'
           : 'text-white/70 hover:text-white hover:bg-white/10'}`
      }
    >
      <Icon size={16} strokeWidth={1.75} className="shrink-0" />
      <span className="flex-1">{label}</span>
      {badge > 0 && (
        <span className="bg-red-500 text-white text-xs font-bold rounded-full min-w-[1.25rem] h-5 flex items-center justify-center px-1">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </NavLink>
  );
}

function SidebarContent({ user, pendingBadge, hasRole, isLogistics, onNav, onLogout }) {
  return (
    <>
      <div className="px-4 py-4 border-b border-white/10 flex items-center gap-3 shrink-0">
        <img src="/logo.png" alt="" className="h-9 w-auto shrink-0" />
        <div>
          <div className="text-white font-bold text-sm tracking-wide leading-tight">HV-WEBBEN</div>
          <div className="text-white/50 text-xs">Prototyp v0.1</div>
        </div>
      </div>

      <div className="px-4 py-3 border-b border-white/10 shrink-0">
        <div className="text-white text-sm font-medium truncate flex items-center gap-1.5">
          <RankInsignia rank={user?.rank} />
          {user?.name}
        </div>
        <div className="text-white/50 text-xs">{ROLE_LABELS[user?.role]}</div>
        <div className="text-white/30 text-xs truncate">{user?.unit_name}</div>
        <div className="mt-2 flex flex-col gap-1">
          <NavLink to="/profil" onClick={onNav}
            className="text-xs text-white/50 hover:text-white transition-colors">
            Redigera profil
          </NavLink>
          <button onClick={onLogout}
                  className="text-xs text-white/50 hover:text-white transition-colors text-left">
            Logga ut
          </button>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-0.5">
        <NavItem to="/"           label="Översikt"         icon={LayoutDashboard}  onClick={onNav} />
        <NavItem to="/kalender"   label="Kalender"         icon={Calendar}         onClick={onNav} />
        <NavItem to="/arenden"    label="Ärenden"          icon={ClipboardList}    badge={pendingBadge} onClick={onNav} />
        <NavItem to="/utrustning" label="Pers. Utrustning" icon={Package}          onClick={onNav} />
        <NavItem to="/dokument"   label="Dokument"         icon={FolderOpen}       onClick={onNav} />
        {hasRole('grpc') && (
          <NavItem to="/enhet"    label="Min enhet"        icon={Users}            onClick={onNav} />
        )}
        {isLogistics() && (
          <NavItem to="/org"      label="Administration"   icon={Settings}         onClick={onNav} />
        )}
      </nav>
    </>
  );
}

export default function Layout({ children }) {
  const { user, logout, hasRole, isLogistics } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingBadge, setPendingBadge] = useState(0);

  useEffect(() => {
    api.pendingCount()
      .then(c => setPendingBadge((c.review || 0) + (c.approve || 0) + (c.returned || 0) + (c.cases || 0)))
      .catch(() => {});
  }, [user?.id]);

  // Close drawer on route change
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const sidebarProps = {
    user, pendingBadge, hasRole, isLogistics,
    onNav: () => setMenuOpen(false),
    onLogout: handleLogout,
  };

  return (
    <div className="flex h-screen">

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 bg-military-navy flex-col shrink-0 h-screen sticky top-0">
        <SidebarContent {...sidebarProps} />
      </aside>

      {/* Mobile drawer overlay */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMenuOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-military-navy flex flex-col z-50">
            <SidebarContent {...sidebarProps} />
          </aside>
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Mobile top bar */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-military-navy shrink-0">
          <button onClick={() => setMenuOpen(true)} className="text-white p-1">
            <Menu size={24} />
          </button>
          <img src="/logo.png" alt="" className="h-7 w-auto" />
          <span className="text-white font-bold text-sm tracking-wide flex-1">HV-WEBBEN</span>
          {pendingBadge > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold rounded-full min-w-[1.25rem] h-5 flex items-center justify-center px-1">
              {pendingBadge > 9 ? '9+' : pendingBadge}
            </span>
          )}
        </header>

        <main className="flex-1 overflow-y-auto bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  );
}
