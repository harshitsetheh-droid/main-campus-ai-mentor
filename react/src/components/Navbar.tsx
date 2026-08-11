import React from 'react';
import { ScreenType } from '../types';
import { Sparkles, Home, LayoutDashboard, Bot, User, Bell, PlayCircle, Users, LogOut, Award, FolderGit2, FileText } from 'lucide-react';

interface NavbarProps {
  currentScreen: ScreenType;
  onNavigate: (screen: ScreenType, transition?: 'none' | 'push' | 'slide_up') => void;
  onOpenWalkthrough: () => void;
  username?: string;
  photoUrl?: string;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentScreen, onNavigate, onOpenWalkthrough, username, photoUrl, onLogout }) => {
  const handleNavClick = (e: React.MouseEvent, screen: ScreenType) => {
    e.preventDefault();
    onNavigate(screen, 'none');
  };

  return (
    <>
      {/* Top Navigation Bar */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#13131b]/80 backdrop-blur-xl border-b border-white/10 shadow-[0_0_30px_rgba(192,193,255,0.15)]">
        <div className="h-16 flex items-center justify-between pl-8 sm:pl-10 pr-24">
          {/* Logo */}
          <div 
            className="flex items-center gap-2 cursor-pointer shrink-0 ml-[255px]"
            style={{ transform: 'translateY(-4px)' }}
            onClick={(e) => handleNavClick(e, 'landing')}
          >
            <Sparkles className="w-6 h-6 text-[#c0c1ff]" />
            <span className="font-bold text-xl lg:text-3xl leading-none whitespace-nowrap bg-clip-text text-transparent bg-gradient-to-r from-[#c0c1ff] to-[#3cd7ff]">
              CampusAI Mentor
            </span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-5 lg:gap-7 whitespace-nowrap leading-none">
            <a
              href="#"
              onClick={(e) => handleNavClick(e, 'landing')}
              className={`text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                currentScreen === 'landing' ? 'text-[#c0c1ff]' : 'text-[#c6c5d7] hover:text-white'
              }`}
            >
              <Home className="w-4 h-4" />
              <span className="hidden lg:inline">Home</span>
            </a>
            <a
              href="#"
              onClick={(e) => handleNavClick(e, 'dashboard')}
              className={`text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                currentScreen === 'dashboard' ? 'text-[#c0c1ff]' : 'text-[#c6c5d7] hover:text-white'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span className="hidden lg:inline">Dashboard</span>
            </a>
            <a
              href="#"
              onClick={(e) => handleNavClick(e, 'compare')}
              className={`text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                currentScreen === 'compare' ? 'text-[#c0c1ff]' : 'text-[#c6c5d7] hover:text-white'
              }`}
            >
              <Users className="w-4 h-4" />
              <span className="hidden lg:inline">Compare Skills</span>
            </a>
            <a
              href="#"
              onClick={(e) => handleNavClick(e, 'chat')}
              className={`text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                currentScreen === 'chat' ? 'text-[#c0c1ff]' : 'text-[#c6c5d7] hover:text-white'
              }`}
            >
              <Bot className="w-4 h-4" />
              <span className="hidden lg:inline">AI Mentor</span>
            </a>
            <a
              href="#"
              onClick={(e) => handleNavClick(e, 'certificates')}
              className={`text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                currentScreen === 'certificates' ? 'text-[#c0c1ff]' : 'text-[#c6c5d7] hover:text-white'
              }`}
            >
              <Award className="w-4 h-4" />
              <span className="hidden lg:inline">Certificates</span>
            </a>
            <a
              href="#"
              onClick={(e) => handleNavClick(e, 'projects')}
              className={`text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                currentScreen === 'projects' ? 'text-[#c0c1ff]' : 'text-[#c6c5d7] hover:text-white'
              }`}
            >
              <FolderGit2 className="w-4 h-4" />
              <span className="hidden lg:inline">Projects</span>
            </a>
            <a
              href="#"
              onClick={(e) => handleNavClick(e, 'resume')}
              className={`text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                currentScreen === 'resume' ? 'text-[#c0c1ff]' : 'text-[#c6c5d7] hover:text-white'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span className="hidden lg:inline">Resume</span>
            </a>
            <a
              href="#"
              onClick={(e) => handleNavClick(e, 'profile')}
              className={`text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                currentScreen === 'profile' ? 'text-[#c0c1ff]' : 'text-[#c6c5d7] hover:text-white'
              }`}
            >
              <User className="w-4 h-4" />
              <span className="hidden lg:inline">Profile</span>
            </a>

            <button
              onClick={onOpenWalkthrough}
              className="bg-gradient-to-r from-[#5b5fef] to-[#3cd7ff] text-white px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 shadow-md hover:scale-105 transition-all cursor-pointer border border-white/20"
            >
              <PlayCircle className="w-4 h-4" />
              <span className="hidden lg:inline">2-Min Demo</span>
            </button>
            
            <button
              onClick={() => onNavigate('dashboard', 'none')}
              title="Notifications"
              className="text-[#c0c1ff] hover:opacity-80 p-2 rounded-full transition-transform active:scale-95 cursor-pointer"
            >
              <Bell className="w-5 h-5" />
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
              <button
                onClick={onLogout}
                title="Logout"
                className="text-[#c6c5d7] hover:text-rose-400 p-2 rounded-full transition-all cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </nav>

          <div className="md:hidden flex items-center gap-2 ml-auto">
            <button
              onClick={onOpenWalkthrough}
              className="bg-[#5b5fef] text-white px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1"
            >
              <PlayCircle className="w-3.5 h-3.5" />
              <span>2-Min Demo</span>
            </button>

            <button
              onClick={() => onNavigate('dashboard', 'none')}
              title="Notifications"
              className="text-[#c0c1ff] p-2 rounded-full cursor-pointer"
            >
              <Bell className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar inside a nav tag */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#1f1f28]/90 backdrop-blur-xl border-t border-white/10 shadow-[0_-4px_20px_rgba(0,0,0,0.4)]">
        <div className="flex justify-between items-center h-16 px-1">
          <a
            href="#"
            onClick={(e) => handleNavClick(e, 'landing')}
            className={`flex flex-col items-center justify-center transition-all ${
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
            className={`flex flex-col items-center justify-center transition-all ${
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
            className={`flex flex-col items-center justify-center transition-all ${
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
            className={`flex flex-col items-center justify-center transition-all ${
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
              onClick={(e) => handleNavClick(e, 'certificates')}
              className={`flex flex-col items-center justify-center transition-all ${
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
              className={`flex flex-col items-center justify-center transition-all ${
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
              className={`flex flex-col items-center justify-center transition-all ${
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
              className={`flex flex-col items-center justify-center transition-all ${
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
            className="flex flex-col items-center justify-center transition-all text-[#c6c5d7]/70 hover:text-rose-400 cursor-pointer"
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
