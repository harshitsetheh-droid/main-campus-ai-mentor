import React from 'react';
import { ScreenType } from '../types';
import { FileText, BarChart2, Bot, Map, Briefcase, CheckCircle, Brain, PlayCircle } from 'lucide-react';

interface LandingScreenProps {
  onNavigate: (screen: ScreenType, transition?: 'none' | 'push' | 'slide_up') => void;
  onOpenWalkthrough?: () => void;
}

export const LandingScreen: React.FC<LandingScreenProps> = ({ onNavigate, onOpenWalkthrough }) => {
  return (
    <main className="relative pt-24 pb-20">
      {/* Background Animated Gradient Blobs */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#5b5fef]/15 rounded-full blur-[140px]" />
        <div className="absolute top-1/3 right-10 w-[400px] h-[400px] bg-[#3cd7ff]/10 rounded-full blur-[120px]" />
      </div>

      {/* Hero Section */}
      <section className="relative z-10 min-h-[75vh] flex flex-col items-center justify-center text-center px-4 max-w-5xl mx-auto">
        <div className="mb-6 inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full glass-card border border-white/10 text-[11px] sm:text-xs font-semibold text-[#c0c1ff]">
          <Brain className="w-4 h-4 text-[#3cd7ff] animate-pulse" />
          <span>Next-Gen Academic & Career Platform</span>
        </div>

        <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold hero-gradient-text max-w-4xl leading-tight mb-6 tracking-tight">
          Your Personal AI Career Mentor
        </h1>

        <p className="text-base sm:text-lg text-[#c6c5d7] max-w-2xl mb-10 leading-relaxed font-normal">
          Unlock your professional potential with intelligent resume analysis, personalized career roadmaps, and 24/7 mentoring tailored to the modern job market.
        </p>

        {/* Hero CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 items-center flex-wrap justify-center">
          <button
            onClick={() => onNavigate('resume', 'slide_up')}
            className="w-full sm:w-auto glass-card text-white font-medium text-base px-8 py-3.5 rounded-full hover:bg-white/10 active:scale-95 transition-all border border-white/20 cursor-pointer"
          >
            Upload Resume
          </button>

          {onOpenWalkthrough && (
            <button
              onClick={onOpenWalkthrough}
              className="w-full sm:w-auto bg-[#3cd7ff]/10 border border-[#3cd7ff]/40 text-[#3cd7ff] font-medium text-base px-7 py-3.5 rounded-full hover:bg-[#3cd7ff]/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <PlayCircle className="w-5 h-5" />
              <span>2-Min Demo Video</span>
            </button>
          )}
        </div>
      </section>

      {/* Features Bento Grid */}
      <section className="relative z-10 py-16 px-4 max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white mb-3">Intelligent Toolset</h2>
          <p className="text-[#c6c5d7] text-base">Everything you need to navigate your career journey.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Feature 1: Resume Parser (Navigates to Resume AI Analysis) */}
          <div
            onClick={() => onNavigate('resume', 'push')}
            className="glass-card p-6 rounded-2xl group hover:-translate-y-1 transition-all duration-300 cursor-pointer border border-white/10 hover:border-[#c0c1ff]/50"
          >
            <div className="w-12 h-12 rounded-xl bg-[#c0c1ff]/10 flex items-center justify-center mb-4 border border-[#c0c1ff]/20 group-hover:shadow-[0_0_15px_rgba(192,193,255,0.4)]">
              <FileText className="w-6 h-6 text-[#c0c1ff]" />
            </div>
            <h3 className="text-xl font-bold text-[#c0c1ff] mb-2">Resume Parser</h3>
            <p className="text-sm text-[#c6c5d7] leading-relaxed">
              Deep scan your CV to identify keywords and ATS optimization gaps instantly.
            </p>
          </div>

          {/* Feature 2: Skill Gap Analyzer */}
          <div
            onClick={() => onNavigate('compare', 'push')}
            className="glass-card p-6 rounded-2xl group hover:-translate-y-1 transition-all duration-300 cursor-pointer border border-white/10 hover:border-[#3cd7ff]/50"
          >
            <div className="w-12 h-12 rounded-xl bg-[#3cd7ff]/10 flex items-center justify-center mb-4 border border-[#3cd7ff]/20 group-hover:shadow-[0_0_15px_rgba(60,215,255,0.4)]">
              <BarChart2 className="w-6 h-6 text-[#3cd7ff]" />
            </div>
            <h3 className="text-xl font-bold text-[#3cd7ff] mb-2">Skill Gap Analyzer</h3>
            <p className="text-sm text-[#c6c5d7] leading-relaxed">
              Compare your skills against industry standards for your dream role.
            </p>
          </div>

          {/* Feature 3: AI Mentor Chat (Navigates to AI Mentor Chat) */}
          <div
            onClick={() => onNavigate('chat', 'push')}
            className="glass-card p-6 rounded-2xl group hover:-translate-y-1 transition-all duration-300 cursor-pointer border border-white/10 hover:border-[#cdbdff]/50"
          >
            <div className="w-12 h-12 rounded-xl bg-[#cdbdff]/10 flex items-center justify-center mb-4 border border-[#cdbdff]/20 group-hover:shadow-[0_0_15px_rgba(205,189,255,0.4)]">
              <Bot className="w-6 h-6 text-[#cdbdff]" />
            </div>
            <h3 className="text-xl font-bold text-[#cdbdff] mb-2">AI Mentor Chat</h3>
            <p className="text-sm text-[#c6c5d7] leading-relaxed">
              Real-time interview prep and career advice powered by advanced LLMs.
            </p>
          </div>

          {/* Feature 4: Career Roadmap */}
          <div
            onClick={() => onNavigate('dashboard', 'push')}
            className="glass-card p-6 rounded-2xl group hover:-translate-y-1 transition-all duration-300 cursor-pointer border border-white/10 hover:border-[#c0c1ff]/50"
          >
            <div className="w-12 h-12 rounded-xl bg-[#5b5fef]/10 flex items-center justify-center mb-4 border border-[#5b5fef]/20 group-hover:shadow-[0_0_15px_rgba(91,95,239,0.4)]">
              <Map className="w-6 h-6 text-[#e1e0ff]" />
            </div>
            <h3 className="text-xl font-bold text-[#e1e0ff] mb-2">Career Roadmap</h3>
            <p className="text-sm text-[#c6c5d7] leading-relaxed">
              Dynamic milestones and learning paths tailored to your career goals.
            </p>
          </div>

          {/* Feature 5: Smart Job Match */}
          <div
            onClick={() => onNavigate('resume', 'push')}
            className="glass-card p-6 rounded-2xl group hover:-translate-y-1 transition-all duration-300 cursor-pointer border border-white/10 hover:border-[#3cd7ff]/50"
          >
            <div className="w-12 h-12 rounded-xl bg-[#3cd7ff]/10 flex items-center justify-center mb-4 border border-[#3cd7ff]/20 group-hover:shadow-[0_0_15px_rgba(60,215,255,0.4)]">
              <Briefcase className="w-6 h-6 text-[#3cd7ff]" />
            </div>
            <h3 className="text-xl font-bold text-[#3cd7ff] mb-2">Smart Job Match</h3>
            <p className="text-sm text-[#c6c5d7] leading-relaxed">
              Directly discover job openings that align with your verified skill profile.
            </p>
          </div>

          {/* Feature 6: AI Verification */}
          <div
            onClick={() => onNavigate('profile', 'push')}
            className="glass-card p-6 rounded-2xl group hover:-translate-y-1 transition-all duration-300 cursor-pointer border border-white/10 hover:border-[#ffb4ab]/50"
          >
            <div className="w-12 h-12 rounded-xl bg-[#ffb4ab]/10 flex items-center justify-center mb-4 border border-[#ffb4ab]/20 group-hover:shadow-[0_0_15px_rgba(255,180,171,0.4)]">
              <CheckCircle className="w-6 h-6 text-[#ffb4ab]" />
            </div>
            <h3 className="text-xl font-bold text-[#ffb4ab] mb-2">AI Verification</h3>
            <p className="text-sm text-[#c6c5d7] leading-relaxed">
              Get your projects and skills validated by AI to stand out to employers.
            </p>
          </div>
        </div>
      </section>

      {/* SEO Content Section — visible text for crawlers */}
      <section className="relative z-10 py-16 px-4 max-w-5xl mx-auto">
        <div className="space-y-12">
          {/* What is CampusAI Mentor */}
          <div>
            <h2 className="text-2xl font-bold text-white mb-4">What is CampusAI Mentor?</h2>
            <p className="text-[#c6c5d7] leading-relaxed text-sm sm:text-base">
              CampusAI Mentor is a free AI-powered academic and career mentorship platform designed exclusively for college students in India. Whether you are preparing for placements, building your resume, tracking skills, or exploring anonymous peer discussions — CampusAI Mentor provides personalized guidance powered by advanced AI models, completely free of cost. Students from universities across India use CampusAI Mentor to prepare for company placements, analyze their resumes for ATS scoring, compare skills with peers, and get AI-driven career roadmaps tailored to their target roles.
            </p>
          </div>

          {/* How It Works */}
          <div>
            <h2 className="text-2xl font-bold text-white mb-4">How Does CampusAI Mentor Work?</h2>
            <ol className="list-decimal list-inside text-[#c6c5d7] leading-relaxed space-y-3 text-sm sm:text-base">
              <li><strong className="text-white">Create Your Free Profile</strong> — Sign up with your college email, set your target role, target company, and current semester. Your profile powers all AI recommendations.</li>
              <li><strong className="text-white">Upload Your Resume</strong> — Get an instant ATS score, keyword analysis, strengths breakdown, and personalized improvement suggestions — all powered by AI resume analysis.</li>
              <li><strong className="text-white">Track Your Skills</strong> — Add technical skills like DSA, React, Python, and track your progress with mastery percentages, checkpoints, and peer benchmarks.</li>
              <li><strong className="text-white">Chat with AI Mentor</strong> — Ask your personal AI mentor anything — career advice, placement strategies, skill roadmaps, interview prep, or project guidance — available 24/7.</li>
              <li><strong className="text-white">Compare with Peers</strong> — See how your skills stack up against other students targeting the same roles. Get ranked and discover skill gaps.</li>
              <li><strong className="text-white">Apply for Placements</strong> — Browse placement drives, apply directly, and track your application status from applied to selected.</li>
              <li><strong className="text-white">Join Anonymous Clubs</strong> — Participate in college-wide anonymous discussion clubs for DSA, placement tips, doubts, memes, and more.</li>
            </ol>
          </div>

          {/* FAQ Section */}
          <div>
            <h2 className="text-2xl font-bold text-white mb-6">Frequently Asked Questions</h2>
            <div className="space-y-6">
              <div className="border border-white/10 rounded-xl p-5">
                <h3 className="text-base font-bold text-white mb-2">Is CampusAI Mentor really free?</h3>
                <p className="text-[#c6c5d7] text-sm leading-relaxed">Yes, CampusAI Mentor is 100% free for all college students. There are no hidden charges, no premium tiers, and no subscription required. All features including AI mentor chat, resume analysis, skill tracking, peer comparison, and anonymous clubs are completely free.</p>
              </div>
              <div className="border border-white/10 rounded-xl p-5">
                <h3 className="text-base font-bold text-white mb-2">What is the AI Mentor feature?</h3>
                <p className="text-[#c6c5d7] text-sm leading-relaxed">The AI Mentor is a personalized career advisor powered by Google Gemini AI. It analyzes your profile — skills, resume, projects, certificates, and target role — to provide tailored career advice, skill roadmaps, placement preparation strategies, and interview tips specific to your career goals.</p>
              </div>
              <div className="border border-white/10 rounded-xl p-5">
                <h3 className="text-base font-bold text-white mb-2">How does the resume ATS analysis work?</h3>
                <p className="text-[#c6c5d7] text-sm leading-relaxed">Upload your resume PDF and CampusAI Mentor's AI analyzes it against ATS (Applicant Tracking System) standards. You receive an ATS score out of 100, keyword detection results, strengths analysis, and specific actionable improvements to boost your resume's chances of passing automated screening.</p>
              </div>
              <div className="border border-white/10 rounded-xl p-5">
                <h3 className="text-base font-bold text-white mb-2">What are anonymous student clubs?</h3>
                <p className="text-[#c6c5d7] text-sm leading-relaxed">Anonymous clubs are college-wide discussion groups where students can chat without revealing their identity. Topics include DSA discussions, placement preparation, exam tips, memes, doubts, and more. Your identity is never exposed — only an anonymous handle is shown.</p>
              </div>
              <div className="border border-white/10 rounded-xl p-5">
                <h3 className="text-base font-bold text-white mb-2">Can I compare my skills with other students?</h3>
                <p className="text-[#c6c5d7] text-sm leading-relaxed">Yes! The peer comparison feature lets you compare your skill levels and progress with other students targeting similar roles. You can see cohort averages, top 10% scores, and discover which skills you need to improve for your dream job.</p>
              </div>
              <div className="border border-white/10 rounded-xl p-5">
                <h3 className="text-base font-bold text-white mb-2">Is my data private and secure?</h3>
                <p className="text-[#c6c5d7] text-sm leading-relaxed">Absolutely. CampusAI Mentor uses encrypted data storage, secure authentication, and role-based access control. Your personal data is never shared with third parties. Club chats are fully anonymous — even administrators cannot see who sent which message.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 py-16 px-4 max-w-4xl mx-auto text-center">
        <div className="glass-card relative overflow-hidden rounded-3xl p-6 sm:p-14 border border-[#5b5fef]/30">
          <div className="absolute inset-0 bg-gradient-to-br from-[#5b5fef]/10 via-transparent to-[#3cd7ff]/10 pointer-events-none" />
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 relative z-10">
            Ready to fast-track your career?
          </h2>
          <p className="text-[#c6c5d7] mb-8 max-w-xl mx-auto relative z-10">
            Join 50,000+ graduates using CampusAI Mentor to land roles at top tech companies.
          </p>
          <button
            onClick={() => onNavigate('dashboard', 'push')}
            className="bg-[#c0c1ff] text-[#0e00aa] font-semibold text-base px-10 py-3.5 rounded-full shadow-lg hover:shadow-[#c0c1ff]/30 active:scale-95 transition-all cursor-pointer relative z-10"
          >
            Get Started Now
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 bg-[#0d0d16] py-10 mt-12">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-6 text-sm text-[#c6c5d7]">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-[#c0c1ff]" />
            <span className="font-bold text-white">CampusAI Mentor</span>
          </div>

          <div className="flex items-center gap-6">
            <a
              href="#dashboard"
              onClick={(e) => { e.preventDefault(); onNavigate('dashboard', 'none'); }}
              className="hover:text-white transition-colors"
            >
              <span>Dashboard</span>
            </a>
            <a
              href="#chat"
              onClick={(e) => { e.preventDefault(); onNavigate('chat', 'none'); }}
              className="hover:text-white transition-colors"
            >
              <span>AI Mentor</span>
            </a>
            <a
              href="#profile"
              onClick={(e) => { e.preventDefault(); onNavigate('profile', 'none'); }}
              className="hover:text-white transition-colors"
            >
              <span>Profile</span>
            </a>
            <a
              href="#clubs"
              onClick={(e) => { e.preventDefault(); onNavigate('clubs', 'none'); }}
              className="hover:text-white transition-colors"
            >
              <span>Clubs</span>
            </a>
            <a
              href="#placement"
              onClick={(e) => { e.preventDefault(); onNavigate('placement', 'none'); }}
              className="hover:text-white transition-colors"
            >
              <span>Placement</span>
            </a>
            <a
              href="#compare"
              onClick={(e) => { e.preventDefault(); onNavigate('compare', 'none'); }}
              className="hover:text-white transition-colors"
            >
              <span>Compare</span>
            </a>
          </div>

          <p className="text-xs text-[#c6c5d7]/50">
            © 2026 CampusAI Mentor. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
};
