import React, { useState, useEffect } from 'react';
import { ScreenType } from '../types';
import { Sparkles, Home, LayoutDashboard, Bot, User, Bell, PlayCircle, Users, LogOut, Award, FolderGit2, FileText, ChevronRight, MessageSquare, Briefcase, UserPlus, ShieldCheck, BarChart3 } from 'lucide-react';
import { api, Notification, Role } from '../api';

interface NavbarProps {
  currentScreen: ScreenType;
  onNavigate: (screen: ScreenType, transition?: 'none' | 'push' | 'slide_up') => void;
  onOpenWalkthrough: () => void;
  username?: string;
  photoUrl?: string;
  role?: Role;
  onLogout: () => void;
  activeAdminTab?: string;
  onAdminNavigate?: (tab: string) => void;
}

interface NavItem {
  key: string;
  label: string;
  short?: string;
  icon: React.ComponentType<{ className?: string }>;
  screen: ScreenType;
  adminTab?: string;
}

const ROLE_LABELS: Record<string, string> = {
  student: 'Student',
  placement_officer: 'PO',
  club_manager: 'Club Mgr',
  faculty: 'Faculty',
  super_admin: 'Super Admin',
};

function formatNotificationDate(value: string): string {
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${date}, ${time}`;
}

export const Navbar: React.FC<NavbarProps> = ({ currentScreen, onNavigate, onOpenWalkthrough, username, photoUrl, role, onLogout, activeAdminTab, onAdminNavigate }) => {
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);

  const refreshNotifs = () => {
    api.getNotifications()
      .then((res) => setNotifs((res.notifications || []).slice(0, 5)))
      .catch(() => {});
  };

  useEffect(() => {
    refreshNotifs();
    const id = setInterval(refreshNotifs, 20000);
    window.addEventListener('focus', refreshNotifs);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', refreshNotifs);
    };
  }, []);

  const handleReadNotif = (n: Notification) => {
    if (!n.is_read) {
      api.readNotification(n.id).catch(() => {});
      setNotifs((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
    }
  };

  const unreadCount = notifs.filter((n) => !n.is_read).length;

  const handleNavClick = (e: React.MouseEvent, screen: ScreenType) => {
    e.preventDefault();
    onNavigate(screen, 'none');
  };

  const navItems: NavItem[] = (() => {
    if (!role || role === 'student') {
      return [
        { key: 'home', label: 'Home', icon: Home, screen: 'landing' },
        { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, screen: 'dashboard' },
        { key: 'compare', label: 'Compare', icon: Users, screen: 'compare' },
        { key: 'chat', label: 'AI Mentor', icon: Bot, screen: 'chat' },
        { key: 'clubs', label: 'Clubs', icon: MessageSquare, screen: 'clubs' },
        { key: 'friends', label: 'Friends', icon: UserPlus, screen: 'friends' },
        { key: 'placement', label: 'Placement', icon: Briefcase, screen: 'placement' },
        { key: 'certificates', label: 'Certificates', short: 'Certs', icon: Award, screen: 'certificates' },
        { key: 'projects', label: 'Projects', icon: FolderGit2, screen: 'projects' },
        { key: 'resume', label: 'Resume', icon: FileText, screen: 'resume' },
        { key: 'profile', label: 'Profile', icon: User, screen: 'profile' },
      ];
    }
    if (role === 'super_admin') {
      return [
        { key: 'placement', label: 'Placement', icon: Briefcase, screen: 'admin', adminTab: 'placement' },
        { key: 'clubs', label: 'Clubs', icon: MessageSquare, screen: 'admin', adminTab: 'clubs' },
        { key: 'people', label: 'People', icon: Users, screen: 'admin', adminTab: 'people' },
        { key: 'admin', label: 'Admin', icon: ShieldCheck, screen: 'admin', adminTab: 'admin' },
        { key: 'profile', label: 'Profile', icon: User, screen: 'admin', adminTab: 'profile' },
      ];
    }
    if (role === 'placement_officer') {
      return [
        { key: 'placement', label: 'Placement', icon: Briefcase, screen: 'admin', adminTab: 'placement' },
        { key: 'profile', label: 'Profile', icon: User, screen: 'admin', adminTab: 'profile' },
      ];
    }
    if (role === 'faculty') {
      return [
        { key: 'stats', label: 'Stats', icon: BarChart3, screen: 'admin', adminTab: 'faculty' },
        { key: 'profile', label: 'Profile', icon: User, screen: 'admin', adminTab: 'profile' },
      ];
    }
    return [
      { key: 'clubs', label: 'My Clubs', icon: ShieldCheck, screen: 'admin', adminTab: 'moderation' },
      { key: 'profile', label: 'Profile', icon: User, screen: 'admin', adminTab: 'profile' },
    ];
  })();

  const isNavActive = (item: NavItem) => {
    if (item.adminTab) return currentScreen === 'admin' && activeAdminTab === item.adminTab;
    return currentScreen === item.screen;
  };

  const handleItemClick = (e: React.MouseEvent, item: NavItem) => {
    e.preventDefault();
    if (item.adminTab) {
      onAdminNavigate?.(item.adminTab);
    } else {
      onNavigate(item.screen, 'none');
    }
  };

  return (
    <>
      {/* Top Navigation Bar */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#13131b]/80 backdrop-blur-xl border-b border-white/10 shadow-[0_0_30px_rgba(192,193,255,0.15)]">
        <div className="h-16 flex items-center justify-between px-4 sm:px-6">
          {/* Logo */}
          <div 
            className="flex items-center gap-2 cursor-pointer shrink-0 min-w-0"
            style={{ transform: 'translateY(-4px)' }}
            onClick={(e) => handleNavClick(e, 'landing')}
          >
            <Sparkles className="w-6 h-6 text-[#c0c1ff] shrink-0" />
            <span className="font-bold text-base sm:text-lg xl:text-2xl 2xl:text-3xl leading-none whitespace-nowrap bg-clip-text text-transparent bg-gradient-to-r from-[#c0c1ff] to-[#3cd7ff]">
              CampusAI Mentor
            </span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-4 xl:gap-6 whitespace-nowrap leading-none">
            {navItems.map((item) => (
              <a
                key={item.key}
                href="#"
                onClick={(e) => handleItemClick(e, item)}
                className={`text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  isNavActive(item) ? 'text-[#c0c1ff]' : 'text-[#c6c5d7] hover:text-white'
                }`}
              >
                <item.icon className="w-4 h-4" />
                <span className="hidden 2xl:inline">{item.label}</span>
              </a>
            ))}

            <button
              onClick={onOpenWalkthrough}
              className="bg-gradient-to-r from-[#5b5fef] to-[#3cd7ff] text-white px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 shadow-md hover:scale-105 transition-all cursor-pointer border border-white/20"
            >
              <PlayCircle className="w-4 h-4" />
              <span className="hidden 2xl:inline">2-Min Demo</span>
            </button>
            
            <button
              onClick={() => setNotifOpen((v) => !v)}
              title="Notifications"
              className="relative text-[#c0c1ff] hover:opacity-80 p-2 rounded-full transition-transform active:scale-95 cursor-pointer"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 min-w-[18px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>

            <div className="flex items-center gap-2 pl-3 border-l border-white/10">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={username}
                  className="w-8 h-8 rounded-full object-cover border border-white/20"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#5b5fef] to-[#3cd7ff] flex items-center justify-center text-white text-xs font-bold uppercase">
                  {username?.charAt(0)}
                </div>
              )}
              <span className="text-xs font-semibold text-white hidden lg:inline max-w-[90px] truncate">
                {username}
              </span>
              {role && (
                <span className="hidden lg:inline-flex items-center gap-1 text-[9px] font-extrabold text-[#3cd7ff] bg-[#3cd7ff]/10 border border-[#3cd7ff]/40 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                  {ROLE_LABELS[role] || role}
                </span>
              )}
              <button
                onClick={onLogout}
                title="Logout"
                className="text-[#c6c5d7] hover:text-rose-400 p-2 rounded-full transition-all cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </nav>

          <div className="lg:hidden flex items-center gap-1.5 ml-auto">
            {role && (
              <span className="flex items-center gap-1 text-[9px] font-extrabold text-[#3cd7ff] bg-[#3cd7ff]/10 border border-[#3cd7ff]/40 px-1.5 py-1 rounded-full uppercase tracking-wide whitespace-nowrap max-w-[64px] truncate">
                {ROLE_LABELS[role] || role}
              </span>
            )}
            <button
              onClick={onOpenWalkthrough}
              className="hidden min-[380px]:inline-flex bg-[#5b5fef] text-white px-2.5 py-1 rounded-full text-xs font-semibold items-center gap-1"
            >
              <PlayCircle className="w-3.5 h-3.5" />
              <span className="hidden min-[380px]:inline">2-Min Demo</span>
            </button>

            <button
              onClick={() => setNotifOpen((v) => !v)}
              title="Notifications"
              className="relative text-[#c0c1ff] p-2 rounded-full cursor-pointer"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 min-w-[18px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Notifications dropdown (navbar bell) */}
        {notifOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
            <div className="absolute right-2 sm:right-6 top-full mt-2 w-[min(92vw,24rem)] bg-[#1b1b26] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Bell className="w-4 h-4 text-[#3cd7ff]" /> Notifications
                </h4>
                {unreadCount > 0 && (
                  <span className="text-[10px] bg-rose-500/15 text-rose-300 px-2 py-0.5 rounded-full font-bold">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifs.length === 0 ? (
                  <p className="text-xs text-[#c6c5d7] p-4">
                    No notifications yet. When peers complete skills, projects or earn certificates, you will see updates here.
                  </p>
                ) : (
                  notifs.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => handleReadNotif(n)}
                      className={`w-full text-left px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-all cursor-pointer ${
                        n.is_read ? 'opacity-60' : ''
                      }`}
                    >
                      <p className="text-xs font-bold text-white flex items-start gap-2">
                        {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-[#3cd7ff] mt-0.5 shrink-0" />}
                        <span>{n.title}</span>
                      </p>
                      {n.detail && <p className="text-[11px] text-[#c6c5d7] mt-0.5">{n.detail}</p>}
                      {n.created_at && (
                        <p className="text-[9px] text-[#7e7d94] mt-1 text-right">
                          {formatNotificationDate(n.created_at)}
                        </p>
                      )}
                    </button>
                  ))
                )}
              </div>
              <button
                onClick={() => { setNotifOpen(false); onNavigate('dashboard', 'none'); }}
                className="w-full px-4 py-2.5 text-xs font-semibold text-[#3cd7ff] hover:bg-white/5 transition-all cursor-pointer flex items-center justify-center gap-1 border-t border-white/10"
              >
                View all notifications <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </>
        )}
      </header>

{/* Mobile Bottom Navigation Bar inside a nav tag */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#1f1f28]/90 backdrop-blur-xl border-t border-white/10 shadow-[0_-4px_20px_rgba(0,0,0,0.4)]">
        <div className="flex items-center h-16 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {navItems.map((item) => (
            <a
              key={item.key}
              href="#"
              onClick={(e) => handleItemClick(e, item)}
              className={`flex flex-col items-center justify-center transition-all flex-1 min-w-[58px] shrink-0 ${
                isNavActive(item)
                  ? 'text-[#c0c1ff] drop-shadow-[0_0_8px_rgba(192,193,255,0.5)]'
                  : 'text-[#c6c5d7]/70 hover:text-[#c0c1ff]'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-semibold mt-0.5 whitespace-nowrap max-w-[70px] truncate">{item.short || item.label}</span>
            </a>
          ))}

          <button
            onClick={(e) => { e.preventDefault(); onLogout(); }}
            className="flex flex-col items-center justify-center transition-all flex-1 min-w-[58px] shrink-0 text-[#c6c5d7]/70 hover:text-rose-400 cursor-pointer"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-[10px] font-semibold mt-0.5 whitespace-nowrap max-w-[70px] truncate">Logout</span>
          </button>
        </div>
      </nav>
    </>
  );
};

