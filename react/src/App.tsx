import React, { useState, useEffect, useCallback } from 'react';
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

const SEO_TITLES: Record<string, string> = {
  landing: 'CampusAI Mentor — Free AI Career & Academic Mentor for College Students',
  profile: 'My Profile — CampusAI Mentor',
  dashboard: 'Dashboard — CampusAI Mentor',
  resume: 'Resume ATS Analysis — CampusAI Mentor',
  chat: 'AI Mentor Chat — CampusAI Mentor',
  compare: 'Peer Skill Comparison — CampusAI Mentor',
  certificates: 'Certificates & Verification — CampusAI Mentor',
  projects: 'Projects Tracker — CampusAI Mentor',
  clubs: 'Anonymous Student Clubs — CampusAI Mentor',
  placement: 'Placement Preparation — CampusAI Mentor',
  friends: 'Friends & Anonymous Chat — CampusAI Mentor',
  admin: 'Admin Panel — CampusAI Mentor',
};

const SEO_DESCRIPTIONS: Record<string, string> = {
  landing: 'Free AI-powered career and academic mentor for college students. Personalized skill roadmaps, resume analysis, peer comparison, placement prep and anonymous clubs.',
  clubs: 'Join anonymous student clubs at your college. Discuss DSA, placement tips, memes and doubts — all anonymously.',
  placement: 'College placement preparation: company-wise question banks, drive applications, resume tips and AI-powered interview prep.',
  chat: 'Chat with your AI Mentor for personalized career advice, skill roadmaps, resume improvement and placement preparation strategies.',
  compare: 'Compare your skills and progress with peers. See where you rank in DSA, web development, and other technical skills.',
  resume: 'Upload your resume for ATS score analysis, keyword detection, and AI-powered improvement suggestions.',
};

const SCREEN_TO_HASH: Record<string, string> = {
  landing: '',
  profile: 'profile',
  dashboard: 'dashboard',
  resume: 'resume',
  chat: 'chat',
  compare: 'compare',
  certificates: 'certificates',
  projects: 'projects',
  clubs: 'clubs',
  placement: 'placement',
  friends: 'friends',
  admin: 'admin',
};

const HASH_TO_SCREEN: Record<string, ScreenType> = Object.fromEntries(
  Object.entries(SCREEN_TO_HASH).filter(([_, v]) => v).map(([k, v]) => [v, k as ScreenType])
);

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>(() => {
    const h = window.location.hash.replace('#/', '').replace('#', '');
    return HASH_TO_SCREEN[h] || 'landing';
  });
  const [transitionType, setTransitionType] = useState<'none' | 'push' | 'slide_up'>('none');
  const [isWalkthroughOpen, setIsWalkthroughOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [photoUrl, setPhotoUrl] = useState('');
  const [dmTarget, setDmTarget] = useState<{ id: number; handle: string } | null>(null);
  const [adminTab, setAdminTab] = useState<string>('people');

  const ADMIN_TAB_DEFAULT: Record<string, string> = {
    super_admin: 'people',
    placement_officer: 'placement',
    club_manager: 'moderation',
    faculty: 'faculty',
  };

  useEffect(() => {
    if (!user) return;
    setAdminTab(ADMIN_TAB_DEFAULT[user.role ?? 'student'] ?? 'people');
    if (user.role !== 'student') setCurrentScreen('admin');
  }, [user?.id]);

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

  // SEO: update document.title and URL hash on every screen change
  useEffect(() => {
    document.title = SEO_TITLES[currentScreen] || SEO_TITLES.landing;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && SEO_DESCRIPTIONS[currentScreen]) {
      metaDesc.setAttribute('content', SEO_DESCRIPTIONS[currentScreen]);
    }
    const hash = SCREEN_TO_HASH[currentScreen];
    if (hash !== undefined) {
      const newUrl = hash ? `#${hash}` : window.location.pathname + window.location.search;
      if (window.location.hash !== newUrl) {
        window.history.pushState({}, '', newUrl);
      }
    }
  }, [currentScreen]);

  // SEO: handle browser back/forward for hash routes
  useEffect(() => {
    const onHashChange = () => {
      const h = window.location.hash.replace('#/', '').replace('#', '');
      const screen = HASH_TO_SCREEN[h];
      if (screen && screen !== currentScreen) setCurrentScreen(screen);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [currentScreen]);

  const handleLogout = () => {
    sessionStorage.removeItem('campusai_token');
    sessionStorage.removeItem('campusai_user');
    localStorage.removeItem('campusai_token');
    localStorage.removeItem('campusai_user');
    setUser(null);
    setPhotoUrl('');
    setCurrentScreen('landing');
  };

  const handleNavigate = useCallback((screen: ScreenType, transition: 'none' | 'push' | 'slide_up' = 'none', dmTarget?: { id: number; handle: string }) => {
    if (dmTarget) setDmTarget(dmTarget);
    setTransitionType(transition);
    setCurrentScreen(screen);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

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
        activeAdminTab={adminTab}
        onAdminNavigate={(t) => { setAdminTab(t); handleNavigate('admin', 'none'); }}
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
            <AdminPanel role={user.role} username={user.username} tab={adminTab} onTabChange={setAdminTab} />
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
