import React, { useState, useEffect } from 'react';
import { ScreenType } from '../types';
import { 
  Play, Pause, RotateCcw, X, 
  Sparkles, ChevronRight, ChevronLeft, CheckCircle2,
  Bot, ChevronDown, ChevronUp
} from 'lucide-react';

interface VideoWalkthroughModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateScreen: (screen: ScreenType) => void;
}

interface Chapter {
  id: string;
  title: string;
  timeRange: string;
  startSec: number;
  endSec: number;
  screen: ScreenType;
  narration: string;
  slideMeaning: string;
  corePurpose: string;
  aiIntegration: string;
  keyFeatures: string[];
  slideBreakdown: { label: string; desc: string }[];
}

const CHAPTERS: Chapter[] = [
  {
    id: '1',
    title: 'Slide 1: Landing Page Overview',
    timeRange: '0:00 - 0:20',
    startSec: 0,
    endSec: 20,
    screen: 'landing',
    narration: 'Welcome to CampusAI Mentor — an intelligent career and academic partner. The Landing Page features a high-impact hero section with primary action triggers and an Intelligent Toolset grid highlighting all major tools.',
    slideMeaning: 'The primary entry point designed to convert college students into active users by establishing trust and showcasing AI capabilities.',
    corePurpose: 'Welcome visitors, demonstrate value proposition, and provide quick navigation into Dashboard, Resume Parsing, Peer Comparison, and AI Chat.',
    aiIntegration: 'High-level preview of Gemini 2.5 Flash capabilities and ATS resume scoring engine.',
    keyFeatures: [
      'Hero CTA: "Start Free" & "Upload Resume"',
      'Intelligent Toolset Bento Grid with hover effects',
      'Quick Navigation routing across all views'
    ],
    slideBreakdown: [
      { label: 'Hero Header', desc: 'Bold typography with gradient text and quick CTA buttons.' },
      { label: 'Toolset Bento Grid', desc: 'Card grid routing users directly to core tools.' }
    ]
  },
  {
    id: '2',
    title: 'Slide 2: Student Dashboard',
    timeRange: '0:20 - 0:40',
    startSec: 20,
    endSec: 40,
    screen: 'dashboard',
    narration: 'The Student Dashboard serves as your career command center. You can monitor your Mastery Progress via an interactive circular gauge, examine a Skill Analysis Radar Chart built from your skills, view AI recommendations, and jump to peer comparison.',
    slideMeaning: 'A real-time progress hub that synthesizes learning milestones, technical skills, and tailored project suggestions into a single actionable dashboard.',
    corePurpose: 'Track academic progress, identify skill gaps against target roles, and launch high-impact engineering projects.',
    aiIntegration: 'Dynamic skill mapping comparing your profile against real-world AI/ML job benchmarks.',
    keyFeatures: [
      'Mastery Progress SVG circular gauge',
      'Interactive Skill Radar Chart',
      'Peer Skill Comparison CTA banner',
      'Recommended Projects with XP reward badges'
    ],
    slideBreakdown: [
      { label: 'Mastery Progress Gauge', desc: 'Visual completion ring with track resume trigger.' },
      { label: 'Skill Radar Chart', desc: 'Polygon chart mapping your skill areas.' },
      { label: 'Peer Comparison Banner', desc: 'Direct entry trigger to compare skills against your cohort.' }
    ]
  },
  {
    id: '3',
    title: 'Slide 3: Peer Skill Comparison Matrix',
    timeRange: '0:40 - 1:00',
    startSec: 40,
    endSec: 60,
    screen: 'compare',
    narration: 'The Peer Skill Comparison Matrix lets students benchmark their technical scores against class cohorts and top-10% industry benchmarks. It provides an interactive "What-If" simulator, percentile ranking, and peer leaderboards.',
    slideMeaning: 'A peer benchmarking suite providing transparency into skill standings compared to peers and top 10% industry targets.',
    corePurpose: 'Allow students to compare their skills across categories, test score improvements interactively, and view cohort rankings.',
    aiIntegration: 'AI-driven gap analysis recommending specific study roadmaps to reach the top 10%.',
    keyFeatures: [
      'Cohort Filters (choose your benchmark group)',
      'Side-by-side Skill Matrix Bars (You vs Cohort vs Top 10%)',
      'Interactive "What-If" Skill Simulator slider',
      'Cohort Top Performers Leaderboard'
    ],
    slideBreakdown: [
      { label: 'Cohort Selector', desc: 'Filter benchmarks by university, track, or target role.' },
      { label: 'Skill Matrix', desc: 'Multi-bar visual comparison across languages, AI, CS core, and DevOps.' },
      { label: 'Skill Simulator', desc: 'Drag-and-drop slider testing percentile gains.' }
    ]
  },
  {
    id: '4',
    title: 'Slide 4: Student Profile',
    timeRange: '1:00 - 1:20',
    startSec: 60,
    endSec: 80,
    screen: 'profile',
    narration: 'The Student Profile tracks your verified identity and achievements. It highlights the student profile with a Skill Score, Certificates, Achievements, customizable technical skills with proficiency bars, and linked coding profiles.',
    slideMeaning: 'A comprehensive academic and technical portfolio proving student readiness to recruiters and AI career algorithms.',
    corePurpose: 'Manage verified profile data, showcase certifications, manage skill tags, and link external profiles like GitHub & LeetCode.',
    aiIntegration: 'Automated AI Skill Score calculation based on certificates and coding activity.',
    keyFeatures: [
      'Verified Student Avatar & University Metadata',
      'Bento Stats: Certificates, Achievements, Skill Score',
      'Interactive "Add Skill" proficiency tags',
      'Direct trigger to start AI Coaching Session'
    ],
    slideBreakdown: [
      { label: 'Profile Card', desc: 'Avatar with verification badge and semester details.' },
      { label: 'Technical Skills List', desc: 'Interactive skill pills with progress bars and add option.' },
      { label: 'Coding Links', desc: 'Quick links to GitHub, LinkedIn, and LeetCode.' }
    ]
  },
  {
    id: '5',
    title: 'Slide 5: Resume AI Analysis',
    timeRange: '1:20 - 1:40',
    startSec: 80,
    endSec: 100,
    screen: 'resume',
    narration: 'The Resume AI Analysis tool scans your CV against tech benchmarks. It displays an ATS Visibility Score gauge, categorized Skill Gap Analysis highlighting identified strengths vs missing additions, and actionable recommendations.',
    slideMeaning: 'An intelligent CV optimizer that identifies missing keywords, evaluates ATS parsing likelihood, and gives step-by-step feedback.',
    corePurpose: 'Upload PDF/DOCX resumes, receive instant ATS scoring, and view prioritized fixes to maximize interview callbacks.',
    aiIntegration: 'Natural language processing rules evaluating formatting, metric quantification, and keyword density.',
    keyFeatures: [
      'Drag & Drop File Uploader (.pdf / .docx)',
      'ATS Visibility Circular Gauge with delta',
      'Categorized Strengths vs Recommended Additions',
      'Actionable cards for metric quantification & project links'
    ],
    slideBreakdown: [
      { label: 'Upload Zone', desc: 'Drag-and-drop dropzone with instant simulation trigger.' },
      { label: 'ATS Score Gauge', desc: 'Visual gauge with historical improvement tracking.' },
      { label: 'Actionable Cards', desc: 'Specific recommendations like "Quantify Experience" & "Add Links".' }
    ]
  },
  {
    id: '6',
    title: 'Slide 6: AI Mentor Chat',
    timeRange: '1:40 - 2:00',
    startSec: 100,
    endSec: 120,
    screen: 'chat',
    narration: 'The AI Mentor Chat is powered by Gemini 2.5 Flash for 24/7 personalized coaching. It offers contextual insights, quick prompt triggers such as "How do I improve my resume?", and real-time advice for electives, portfolio projects, and interview prep.',
    slideMeaning: 'A 24/7 conversational mentor offering instant guidance on coursework, technical interview questions, and career strategy.',
    corePurpose: 'Provide conversational AI assistance backed by Gemini 2.5 Flash server-side routes.',
    aiIntegration: 'Full-stack Express + Google GenAI (Gemini 2.5 Flash) proxy API endpoint with conversation history support.',
    keyFeatures: [
      'Server-side Gemini 2.5 Flash API route (/api/mentor)',
      'Contextual career recommendations sidebar',
      'Quick Prompt pills for instant queries',
      'Real-time markdown formatted response streams'
    ],
    slideBreakdown: [
      { label: 'Chat Stream', desc: 'Interactive chat bubbles with AI vs User styling.' },
      { label: 'Quick Prompts', desc: 'One-click chips to ask common career questions.' },
      { label: 'Contextual Sidebar', desc: 'Automated insights based on student background.' }
    ]
  }
];

export const VideoWalkthroughModal: React.FC<VideoWalkthroughModalProps> = ({
  isOpen,
  onClose,
  onNavigateScreen
}) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showDetails, setShowDetails] = useState(true);
  const totalDuration = 120; // 2 minutes (120 seconds)

  const activeChapterIndex = CHAPTERS.findIndex(
    (c) => currentTime >= c.startSec && currentTime < c.endSec
  );
  
  const currentChapterIndex = activeChapterIndex >= 0 ? activeChapterIndex : 0;
  const activeChapter = CHAPTERS[currentChapterIndex];

  // Timer auto-advance
  useEffect(() => {
    let interval: any = null;
    if (isPlaying && isOpen) {
      interval = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= totalDuration) {
            setIsPlaying(false);
            return totalDuration;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isPlaying, isOpen]);

  // Sync active screen behind modal as slides advance
  useEffect(() => {
    if (isOpen && activeChapter) {
      onNavigateScreen(activeChapter.screen);
    }
  }, [activeChapter.id, isOpen]);

  if (!isOpen) return null;

  const togglePlay = () => {
    if (currentTime >= totalDuration) {
      setCurrentTime(0);
    }
    setIsPlaying(!isPlaying);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setCurrentTime(val);
  };

  const handleNextSlide = () => {
    if (currentChapterIndex < CHAPTERS.length - 1) {
      const nextChap = CHAPTERS[currentChapterIndex + 1];
      setCurrentTime(nextChap.startSec);
      setIsPlaying(true);
    }
  };

  const handlePrevSlide = () => {
    if (currentChapterIndex > 0) {
      const prevChap = CHAPTERS[currentChapterIndex - 1];
      setCurrentTime(prevChap.startSec);
      setIsPlaying(true);
    }
  };

  const handleJumpChapter = (chapter: Chapter) => {
    setCurrentTime(chapter.startSec);
    setIsPlaying(true);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-2xl flex items-center justify-center p-2 sm:p-5 overflow-y-auto">
      <div className="bg-[#181824] border border-[#c0c1ff]/30 rounded-3xl w-full max-w-5xl overflow-hidden shadow-[0_0_60px_rgba(91,95,239,0.35)] flex flex-col max-h-[95vh]">
        
        {/* Header Bar */}
        <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between bg-[#13131b]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#5b5fef] to-[#3cd7ff] flex items-center justify-center text-white shadow-md">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base sm:text-lg flex items-center gap-2">
                Interactive Slide-by-Slide Prototype Tour
                <span className="text-[11px] bg-[#5b5fef]/30 text-[#c0c1ff] px-2.5 py-0.5 rounded-full border border-[#5b5fef]/40">
                  Slide {currentChapterIndex + 1} of {CHAPTERS.length}
                </span>
              </h3>
              <p className="text-xs text-[#c6c5d7]">
                Live 2-Minute Prototype Presentation & Visual Slide Breakdown
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setIsPlaying(false);
              onClose();
            }}
            className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/15 text-[#c6c5d7] hover:text-white flex items-center justify-center transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Content Body */}
        <div className="p-4 sm:p-6 flex-1 overflow-y-auto space-y-6">
          
          {/* Top Slide Navigation Strip */}
          <div className="bg-[#12121a] p-3 rounded-2xl border border-white/10 flex items-center justify-between gap-2">
            <button
              onClick={handlePrevSlide}
              disabled={currentChapterIndex === 0}
              className="px-3 py-2 rounded-xl bg-[#292932] text-white text-xs font-semibold hover:bg-[#3cd7ff]/20 disabled:opacity-30 disabled:hover:bg-[#292932] transition-all flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Prev Slide</span>
            </button>

            {/* Horizontal Slide Thumbnails */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
              {CHAPTERS.map((ch, idx) => {
                const isActive = idx === currentChapterIndex;
                return (
                  <button
                    key={ch.id}
                    onClick={() => handleJumpChapter(ch)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shrink-0 flex items-center gap-2 cursor-pointer ${
                      isActive
                        ? 'bg-[#5b5fef] text-white border-[#c0c1ff] shadow-[0_0_12px_rgba(192,193,255,0.4)] scale-105'
                        : 'bg-[#1e1e2a] text-[#c6c5d7] border-white/5 hover:border-white/20'
                    }`}
                  >
                    <span>{idx + 1}.</span>
                    <span className="truncate max-w-[100px] sm:max-w-none">
                      {ch.title.replace(`Slide ${idx + 1}: `, '')}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              onClick={handleNextSlide}
              disabled={currentChapterIndex === CHAPTERS.length - 1}
              className="px-3 py-2 rounded-xl bg-[#5b5fef] text-white text-xs font-semibold hover:bg-[#5b5fef]/80 disabled:opacity-30 disabled:hover:bg-[#5b5fef] transition-all flex items-center gap-1 cursor-pointer"
            >
              <span className="hidden sm:inline">Next Slide</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Video Frame Display */}
          <div className="relative rounded-2xl overflow-hidden border border-[#5b5fef]/40 bg-[#0c0c14] p-5 sm:p-6 shadow-2xl space-y-5">
            
            {/* Live Indicator Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Active Presentation Frame
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-[#3cd7ff] bg-[#3cd7ff]/10 border border-[#3cd7ff]/30 px-3 py-1 rounded-full font-mono">
                  {activeChapter.timeRange}
                </span>
                <span className="text-xs text-[#c0c1ff] bg-[#5b5fef]/20 border border-[#5b5fef]/30 px-3 py-1 rounded-full font-bold capitalize">
                  Current View: {activeChapter.screen}
                </span>
              </div>
            </div>

            {/* Slide Title & Meaning Header */}
            <div className="space-y-2">
              <h4 className="text-xl sm:text-2xl font-extrabold hero-gradient-text">
                {activeChapter.title}
              </h4>
              <p className="text-sm text-[#e4e1ed] leading-relaxed bg-[#1b1b26] p-3.5 rounded-xl border border-white/10 font-medium">
                <strong className="text-[#3cd7ff]">Slide Meaning:</strong> {activeChapter.slideMeaning}
              </p>
            </div>

            {/* Presentation Script Box */}
            <div className="bg-gradient-to-r from-[#1f1f2e] to-[#151522] rounded-xl p-4 border border-[#5b5fef]/30">
              <div className="flex items-center gap-2 text-xs font-bold text-[#c0c1ff] mb-1.5 uppercase tracking-wider">
                <Bot className="w-4 h-4 text-[#3cd7ff]" />
                <span>Presentation Script</span>
              </div>
              <p className="text-sm text-white italic leading-relaxed">
                "{activeChapter.narration}"
              </p>
            </div>

            {/* Slide Functional & AI Purpose Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#181822] p-4 rounded-xl border border-white/5 space-y-1">
                <span className="text-[11px] font-bold text-[#3cd7ff] uppercase tracking-wider">
                  Core Purpose
                </span>
                <p className="text-xs text-[#c6c5d7] leading-relaxed">
                  {activeChapter.corePurpose}
                </p>
              </div>

              <div className="bg-[#181822] p-4 rounded-xl border border-white/5 space-y-1">
                <span className="text-[11px] font-bold text-[#cdbdff] uppercase tracking-wider">
                  AI Engine Integration
                </span>
                <p className="text-xs text-[#c6c5d7] leading-relaxed">
                  {activeChapter.aiIntegration}
                </p>
              </div>
            </div>

            {/* Key Features */}
            <div className="bg-[#181822] p-4 rounded-xl border border-white/5 space-y-2">
              <span className="text-[11px] font-bold text-[#c0c1ff] uppercase tracking-wider">
                Key Features
              </span>
              <ul className="space-y-1.5">
                {activeChapter.keyFeatures.map((f, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs text-[#c6c5d7]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#3cd7ff] mt-0.5 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Section-by-Section Breakdown (Collapsible) */}
            <div className="space-y-3">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#c6c5d7] hover:text-white transition-colors cursor-pointer"
              >
                <span>Slide Component Breakdown</span>
                {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showDetails && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {activeChapter.slideBreakdown.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 bg-[#1a1a26] rounded-xl border border-white/5 hover:border-[#c0c1ff]/30 transition-all space-y-1"
                    >
                      <div className="flex items-center gap-2 text-xs font-bold text-white">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#3cd7ff]" />
                        <span>{item.label}</span>
                      </div>
                      <p className="text-[11px] text-[#c6c5d7] leading-normal">
                        {item.desc}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Video Player Bottom Controls */}
        <div className="px-6 py-4 bg-[#13131b] border-t border-white/10 space-y-3">
          
          {/* Progress Timeline Slider */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-[#c6c5d7] w-10 text-right">
              {formatTime(currentTime)}
            </span>
            <input
              type="range"
              min="0"
              max={totalDuration}
              value={currentTime}
              onChange={handleSeek}
              className="flex-1 h-2 bg-[#292932] rounded-lg appearance-none cursor-pointer accent-[#c0c1ff]"
            />
            <span className="text-xs font-mono text-[#c6c5d7] w-10">
              {formatTime(totalDuration)}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={togglePlay}
                className="w-10 h-10 rounded-full bg-[#c0c1ff] text-[#0e00aa] hover:bg-white flex items-center justify-center transition-all shadow-md font-bold cursor-pointer"
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </button>

              <button
                onClick={() => {
                  setCurrentTime(0);
                  setIsPlaying(true);
                }}
                className="p-2 text-[#c6c5d7] hover:text-white transition-colors cursor-pointer"
                title="Restart Presentation"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-[#c6c5d7] hidden sm:block font-medium">
              Playing: <span className="text-[#c0c1ff] font-bold">{activeChapter.title}</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
