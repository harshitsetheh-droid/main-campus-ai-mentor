import React, { useState, useEffect } from 'react';
import { ScreenType } from './types';
import { Navbar } from './components/Navbar';
import { LandingScreen } from './components/LandingScreen';
import { ProfileScreen } from './components/ProfileScreen';
import { DashboardScreen } from './components/DashboardScreen';
import { ResumeScreen } from './components/ResumeScreen';
import { ChatScreen } from './components/ChatScreen';
import { PeerComparisonScreen } from './components/PeerComparisonScreen';
import { CertificatesScreen } from './components/CertificatesScreen';
import { ProjectsScreen } from './components/ProjectsScreen';
import { ClubScreen } from './components/ClubScreen';
import { PlacementScreen } from './components/PlacementScreen';
import { FriendsScreen } from './components/FriendsScreen';
import { AdminPanel } from './components/AdminPanel';
import { VideoWalkthroughModal } from './components/VideoWalkthroughModal';
import { LoginScreen } from './components/LoginScreen';
import { SignupScreen } from './components/SignupScreen';
import { motion, AnimatePresence, Transition } from 'motion/react';
import { AuthUser, api } from './api';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('landing');
  const [transitionType, setTransitionType] = useState<'none' | 'push' | 'slide_up'>('none');
  const [isWalkthroughOpen, setIsWalkthroughOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [photoUrl, setPhotoUrl] = useState('');
  const [dmTarget, setDmTarget] = useState<{ id: number; handle: string } | null>(null);

  useEffect(() => {
    // Per-tab session: do alag tabs = do alag accounts, no cross-tab confusion.
    // Fall back to old localStorage once so existing logins survive the move.
    let saved = sessionStorage.getItem('campusai_user');
    let token = sessionStorage.getItem('campusai_token');
    if (!saved || !token) {
      saved = localStorage.getItem('campusai_user');
      token = localStorage.getItem('campusai_token');
      if (saved && token) {
        sessionStorage.setItem('campusai_user', saved);
        sessionStorage.setItem('campusai_token', token);
      }
      localStorage.removeItem('campusai_token');
      localStorage.removeItem('campusai_user');
    }
    if (!saved || !token) return;
    try {
      setUser(JSON.parse(saved));
    } catch {
      sessionStorage.removeItem('campusai_user');
      return;
    }
    // Validate the stored token so stale/expired sessions are cleared cleanly.
    api.me()
      .then((res) => setUser(res.user))
      .catch(() => {
        sessionStorage.removeItem('campusai_token');
        sessionStorage.removeItem('campusai_user');
        setUser(null);
      });
  }, []);

  // Load the user's uploaded profile photo so the navbar can show it.
  // Re-fetches on every screen change so a freshly-uploaded photo appears.
  useEffect(() => {
    if (!user) return;
    api.getProfile()
      .then((res) => setPhotoUrl(res.profile.photoUrl || ''))
      .catch(() => setPhotoUrl(''));
  }, [user, currentScreen]);

  const handleLogout = () => {
    sessionStorage.removeItem('campusai_token');
    sessionStorage.removeItem('campusai_user');
    localStorage.removeItem('campusai_token');
    localStorage.removeItem('campusai_user');
    setUser(null);
    setPhotoUrl('');
    setCurrentScreen('landing');
  };

  const handleNavigate = (screen: ScreenType, transition: 'none' | 'push' | 'slide_up' = 'none', dmTarget?: { id: number; handle: string }) => {
    if (dmTarget) setDmTarget(dmTarget);
    setTransitionType(transition);
    setCurrentScreen(screen);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Auth gate: show login/signup until logged in
  if (!user) {
    if (authMode === 'signup') {
      return <SignupScreen onSuccess={setUser} onSwitchToLogin={() => setAuthMode('login')} />;
    }
    return <LoginScreen onSuccess={setUser} onSwitchToSignup={() => setAuthMode('signup')} />;
  }

  const getAnimationVariants = (): {
    initial: { y?: string; x?: string; opacity: number };
    animate: { y?: number; x?: number; opacity: number };
    exit: { y?: string; x?: string; opacity: number };
    transition: Transition;
  } => {
    if (transitionType === 'slide_up') {
      return {
        initial: { y: '100%', opacity: 0 },
        animate: { y: 0, opacity: 1 },
        exit: { y: '-30%', opacity: 0 },
        transition: { duration: 0.35, ease: 'easeOut' }
      };
    } else if (transitionType === 'push') {
      return {
        initial: { x: '100%', opacity: 0 },
        animate: { x: 0, opacity: 1 },
        exit: { x: '-20%', opacity: 0 },
        transition: { duration: 0.3, ease: 'easeInOut' }
      };
    } else {
      // none / instant
      return {
        initial: { opacity: 1 },
        animate: { opacity: 1 },
        exit: { opacity: 1 },
        transition: { duration: 0 }
      };
    }
  };

  const anim = getAnimationVariants();

  return (
    <div className="min-h-screen bg-[#13131b] text-[#e4e1ed] relative overflow-x-hidden">
      {/* Navigation Bar */}
      <Navbar 
        currentScreen={currentScreen} 
        onNavigate={handleNavigate} 
        onOpenWalkthrough={() => setIsWalkthroughOpen(true)}
        username={user.username}
        photoUrl={photoUrl}
        role={user.role}
        onLogout={handleLogout}
      />

      {/* Screen Container */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentScreen}
          initial={anim.initial}
          animate={anim.animate}
          exit={anim.exit}
          transition={anim.transition}
          className="w-full min-h-screen"
        >
          {currentScreen === 'landing' && (
            <LandingScreen 
              onNavigate={handleNavigate} 
              onOpenWalkthrough={() => setIsWalkthroughOpen(true)}
            />
          )}
          {currentScreen === 'profile' && (
            <ProfileScreen onNavigate={handleNavigate} />
          )}
          {currentScreen === 'dashboard' && (
            <DashboardScreen onNavigate={handleNavigate} />
          )}
          {currentScreen === 'resume' && (
            <ResumeScreen onNavigate={handleNavigate} />
          )}
          {currentScreen === 'chat' && (
            <ChatScreen onNavigate={handleNavigate} username={user.username} />
          )}
          {currentScreen === 'compare' && (
            <PeerComparisonScreen onNavigate={handleNavigate} />
          )}
          {currentScreen === 'certificates' && (
            <CertificatesScreen onNavigate={handleNavigate} />
          )}
          {currentScreen === 'projects' && (
            <ProjectsScreen onNavigate={handleNavigate} />
          )}
          {currentScreen === 'clubs' && (
            <ClubScreen onNavigate={handleNavigate} />
          )}
          {currentScreen === 'placement' && (
            <PlacementScreen onNavigate={handleNavigate} />
          )}
          {currentScreen === 'friends' && (
            <FriendsScreen onNavigate={handleNavigate} initialDmTarget={dmTarget} />
          )}
          {currentScreen === 'admin' && user.role && user.role !== 'student' && (
            <AdminPanel role={user.role} username={user.username} />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Interactive 2-Minute Video Walkthrough Modal */}
      <VideoWalkthroughModal
        isOpen={isWalkthroughOpen}
        onClose={() => setIsWalkthroughOpen(false)}
        onNavigateScreen={(scr) => handleNavigate(scr, 'none')}
      />
    </div>
  );
}
