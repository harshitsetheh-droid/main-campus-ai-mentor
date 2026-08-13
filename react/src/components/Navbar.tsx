import React, { useState, useEffect } from 'react';
import { ScreenType } from '../types';
import { Sparkles, Home, LayoutDashboard, Bot, User, Bell, PlayCircle, Users, LogOut, Award, FolderGit2, FileText, ChevronRight, MessageSquare, Briefcase, UserPlus, ShieldCheck } from 'lucide-react';
import { api, Notification, Role } from '../api';

interface NavbarProps {
  currentScreen: ScreenType;
  onNavigate: (screen: ScreenType, transition?: 'none' | 'push' | 'slide_up') => void;
  onOpenWalkthrough: () => void;
  username?: string;
  photoUrl?: string;
  role?: Role;
  onLogout: () => void;
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

export const Navbar: React.FC<NavbarProps> = ({ currentScreen, onNavigate, onOpenWalkthrough, username, photoUrl, role, onLogout }) => {
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
            <a
              href="#"
              onClick={(e) => handleNavClick(e, 'landing')}
              className={`text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                currentScreen === 'landing' ? 'text-[#c0c1ff]' : 'text-[#c6c5d7] hover:text-white'
              }`}
            >
              <Home className="w-4 h-4" />
              <span className="hidden 2xl:inline">Home</span>
            </a>
            <a
              href="#"
              onClick={(e) => handleNavClick(e, 'dashboard')}
              className={`text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                currentScreen === 'dashboard' ? 'text-[#c0c1ff]' : 'text-[#c6c5d7] hover:text-white'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span className="hidden 2xl:inline">Dashboard</span>
            </a>
            <a
              href="#"
              onClick={(e) => handleNavClick(e, 'compare')}
              className={`text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                currentScreen === 'compare' ? 'text-[#c0c1ff]' : 'text-[#c6c5d7] hover:text-white'
              }`}
            >
              <Users className="w-4 h-4" />
              <span className="hidden 2xl:inline">Compare Skills</span>
            </a>
<a
              href="#"
              onClick={(e) => handleNavClick(e, 'chat')}
              className={`text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                currentScreen === 'chat' ? 'text-[#c0c1ff]' : 'text-[#c6c5d7] hover:text-white'
              }`}
            >
              <Bot className="w-4 h-4" />
              <span className="hidden 2xl:inline">AI Mentor</span>
            </a>
            <a
              href="#"
              onClick={(e) => handleNavClick(e, 'clubs')}
              className={`text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                currentScreen === 'clubs' ? 'text-[#c0c1ff]' : 'text-[#c6c5d7] hover:text-white'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span className="hidden 2xl:inline">Clubs</span>
            </a>
            <a
              href="#"
              onClick={(e) => handleNavClick(e, 'friends')}
              className={`text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                currentScreen === 'friends' ? 'text-[#c0c1ff]' : 'text-[#c6c5d7] hover:text-white'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              <span className="hidden 2xl:inline">Friends</span>
            </a>
            <a
              href="#"
              onClick={(e) => handleNavClick(e, 'placement')}
              className={`text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                currentScreen === 'placement' ? 'text-[#c0c1ff]' : 'text-[#c6c5d7] hover:text-white'
              }`}
            >
              <Briefcase className="w-4 h-4" />
              <span className="hidden 2xl:inline">Placement</span>
            </a>
            <a
              href="#"
              onClick={(e) => handleNavClick(e, 'certificates')}
              className={`text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                currentScreen === 'certificates' ? 'text-[#c0c1ff]' : 'text-[#c6c5d7] hover:text-white'
              }`}
            >
              <Award className="w-4 h-4" />
              <span className="hidden 2xl:inline">Certificates</span>
            </a>
            <a
              href="#"
              onClick={(e) => handleNavClick(e, 'projects')}
              className={`text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                currentScreen === 'projects' ? 'text-[#c0c1ff]' : 'text-[#c6c5d7] hover:text-white'
              }`}
            >
              <FolderGit2 className="w-4 h-4" />
              <span className="hidden 2xl:inline">Projects</span>
            </a>
            <a
              href="#"
              onClick={(e) => handleNavClick(e, 'resume')}
              className={`text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                currentScreen === 'resume' ? 'text-[#c0c1ff]' : 'text-[#c6c5d7] hover:text-white'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span className="hidden 2xl:inline">Resume</span>
            </a>
            <a
              href="#"
              onClick={(e) => handleNavClick(e, 'profile')}
              className={`text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                currentScreen === 'profile' ? 'text-[#c0c1ff]' : 'text-[#c6c5d7] hover:text-white'
              }`}
            >
              <User className="w-4 h-4" />
              <span className="hidden 2xl:inline">Profile</span>
            </a>
            {role && role !== 'student' && (
              <a
                href="#"
                onClick={(e) => handleNavClick(e, 'admin')}
                className={`text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  currentScreen === 'admin' ? 'text-[#c0c1ff]' : 'text-[#c6c5d7] hover:text-white'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span className="hidden 2xl:inline">Admin</span>
              </a>
            )}

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
              {role && role !== 'student' && (
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
            <button
              onClick={onOpenWalkthrough}
              className="bg-[#5b5fef] text-white px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1"
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
          <a
            href="#"
            onClick={(e) => handleNavClick(e, 'landing')}
            className={`flex flex-col items-center justify-center transition-all flex-1 min-w-[58px] shrink-0 ${
              currentScreen === 'landing'
                ? 'text-[#c0c1ff] drop-shadow-[0_0_8px_rgba(192,193,255,0.5)]'
                : 'text-[#c6c5d7]/70 hover:text-[#c0c1ff]'
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px] font-semibold mt-0.5 whitespace-nowrap max-w-[70px] truncate">Home</span>
          </a>

          <a
            href="#"
            onClick={(e) => handleNavClick(e, 'dashboard')}
            className={`flex flex-col items-center justify-center transition-all flex-1 min-w-[58px] shrink-0 ${
              currentScreen === 'dashboard'
                ? 'text-[#c0c1ff] drop-shadow-[0_0_8px_rgba(192,193,255,0.5)]'
                : 'text-[#c6c5d7]/70 hover:text-[#c0c1ff]'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="text-[10px] font-semibold mt-0.5 whitespace-nowrap max-w-[70px] truncate">Dashboard</span>
          </a>

          <a
            href="#"
            onClick={(e) => handleNavClick(e, 'compare')}
            className={`flex flex-col items-center justify-center transition-all flex-1 min-w-[58px] shrink-0 ${
              currentScreen === 'compare'
                ? 'text-[#c0c1ff] drop-shadow-[0_0_8px_rgba(192,193,255,0.5)]'
                : 'text-[#c6c5d7]/70 hover:text-[#c0c1ff]'
            }`}
          >
            <Users className="w-5 h-5" />
            <span className="text-[10px] font-semibold mt-0.5 whitespace-nowrap max-w-[70px] truncate">Compare</span>
          </a>

          <a
            href="#"
            onClick={(e) => handleNavClick(e, 'chat')}
            className={`flex flex-col items-center justify-center transition-all flex-1 min-w-[58px] shrink-0 ${
              currentScreen === 'chat'
                ? 'text-[#c0c1ff] drop-shadow-[0_0_8px_rgba(192,193,255,0.5)]'
                : 'text-[#c6c5d7]/70 hover:text-[#c0c1ff]'
            }`}
          >
            <Bot className="w-5 h-5" />
            <span className="text-[10px] font-semibold mt-0.5 whitespace-nowrap max-w-[70px] truncate">AI Mentor</span>
          </a>

          <a
            href="#"
            onClick={(e) => handleNavClick(e, 'clubs')}
            className={`flex flex-col items-center justify-center transition-all flex-1 min-w-[58px] shrink-0 ${
              currentScreen === 'clubs'
                ? 'text-[#c0c1ff] drop-shadow-[0_0_8px_rgba(192,193,255,0.5)]'
                : 'text-[#c6c5d7]/70 hover:text-[#c0c1ff]'
            }`}
          >
            <MessageSquare className="w-5 h-5" />
            <span className="text-[10px] font-semibold mt-0.5 whitespace-nowrap max-w-[70px] truncate">Clubs</span>
          </a>

          <a
            href="#"
            onClick={(e) => handleNavClick(e, 'friends')}
            className={`flex flex-col items-center justify-center transition-all flex-1 min-w-[58px] shrink-0 ${
              currentScreen === 'friends'
                ? 'text-[#c0c1ff] drop-shadow-[0_0_8px_rgba(192,193,255,0.5)]'
                : 'text-[#c6c5d7]/70 hover:text-[#c0c1ff]'
            }`}
          >
            <UserPlus className="w-5 h-5" />
            <span className="text-[10px] font-semibold mt-0.5 whitespace-nowrap max-w-[70px] truncate">Friends</span>
          </a>

          {role && role !== 'student' && (
            <a
              href="#"
              onClick={(e) => handleNavClick(e, 'admin')}
              className={`flex flex-col items-center justify-center transition-all flex-1 min-w-[58px] shrink-0 ${
                currentScreen === 'admin'
                  ? 'text-[#c0c1ff] drop-shadow-[0_0_8px_rgba(192,193,255,0.5)]'
                  : 'text-[#c6c5d7]/70 hover:text-[#c0c1ff]'
              }`}
            >
              <ShieldCheck className="w-5 h-5" />
              <span className="text-[10px] font-semibold mt-0.5 whitespace-nowrap max-w-[70px] truncate">Admin</span>
            </a>
          )}

          <a
            href="#"
            onClick={(e) => handleNavClick(e, 'placement')}
            className={`flex flex-col items-center justify-center transition-all flex-1 min-w-[58px] shrink-0 ${
              currentScreen === 'placement'
                ? 'text-[#c0c1ff] drop-shadow-[0_0_8px_rgba(192,193,255,0.5)]'
                : 'text-[#c6c5d7]/70 hover:text-[#c0c1ff]'
            }`}
          >
            <Briefcase className="w-5 h-5" />
            <span className="text-[10px] font-semibold mt-0.5 whitespace-nowrap max-w-[70px] truncate">Placement</span>
          </a>

          <a
            href="#"
            onClick={(e) => handleNavClick(e, 'certificates')}
            className={`flex flex-col items-center justify-center transition-all flex-1 min-w-[58px] shrink-0 ${
              currentScreen === 'certificates'
                ? 'text-[#c0c1ff] drop-shadow-[0_0_8px_rgba(192,193,255,0.5)]'
                : 'text-[#c6c5d7]/70 hover:text-[#c0c1ff]'
            }`}
          >
            <Award className="w-5 h-5" />
            <span className="text-[10px] font-semibold mt-0.5 whitespace-nowrap max-w-[70px] truncate">Certs</span>
          </a>

          <a
            href="#"
            onClick={(e) => handleNavClick(e, 'projects')}
            className={`flex flex-col items-center justify-center transition-all flex-1 min-w-[58px] shrink-0 ${
              currentScreen === 'projects'
                ? 'text-[#c0c1ff] drop-shadow-[0_0_8px_rgba(192,193,255,0.5)]'
                : 'text-[#c6c5d7]/70 hover:text-[#c0c1ff]'
            }`}
          >
            <FolderGit2 className="w-5 h-5" />
            <span className="text-[10px] font-semibold mt-0.5 whitespace-nowrap max-w-[70px] truncate">Projects</span>
          </a>

          <a
            href="#"
            onClick={(e) => handleNavClick(e, 'resume')}
            className={`flex flex-col items-center justify-center transition-all flex-1 min-w-[58px] shrink-0 ${
              currentScreen === 'resume'
                ? 'text-[#c0c1ff] drop-shadow-[0_0_8px_rgba(192,193,255,0.5)]'
                : 'text-[#c6c5d7]/70 hover:text-[#c0c1ff]'
            }`}
          >
            <FileText className="w-5 h-5" />
            <span className="text-[10px] font-semibold mt-0.5 whitespace-nowrap max-w-[70px] truncate">Resume</span>
          </a>

          <a
            href="#"
            onClick={(e) => handleNavClick(e, 'profile')}
            className={`flex flex-col items-center justify-center transition-all flex-1 min-w-[58px] shrink-0 ${
              currentScreen === 'profile'
                ? 'text-[#c0c1ff] drop-shadow-[0_0_8px_rgba(192,193,255,0.5)]'
                : 'text-[#c6c5d7]/70 hover:text-[#c0c1ff]'
            }`}
          >
            <User className="w-5 h-5" />
            <span className="text-[10px] font-semibold mt-0.5 whitespace-nowrap max-w-[70px] truncate">Profile</span>
          </a>

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

