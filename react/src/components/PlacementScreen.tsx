import React, { useState, useEffect } from 'react';
import { Briefcase, Calendar, IndianRupee, Rocket, Users, Target, FileText, Braces, Sparkles, ArrowRight, Clock, Search, Loader2, History, BarChart3, GraduationCap, BookOpen, Building2 } from 'lucide-react';
import { api, PlacementDrive, PlacementQuestion, CompanyQuestion, CompanyQuestionMeta } from '../api';

interface PlacementScreenProps {
  onNavigate: (screen: 'chat' | 'compare' | 'resume' | 'dashboard' | 'landing' | 'profile' | 'certificates' | 'projects' | 'clubs' | 'placement', transition?: 'none' | 'push' | 'slide_up') => void;
}

const PREP_TRACKS = [
  { icon: FileText, title: 'Resume + LinkedIn', desc: 'ATS-friendly resume, quantified bullets, strong LinkedIn headline.', target: 'Week 1–2', route: 'resume' as const },
  { icon: Braces, title: 'DSA & Coding', desc: 'Arrays, strings, trees, graphs + 150 LeetCode problems for SDE roles.', target: 'Ongoing', route: 'compare' as const },
  { icon: Sparkles, title: 'AI Mock Interviews', desc: 'Practice HR + technical rounds with the AI Mentor and get instant feedback.', target: 'Week 3–4', route: 'chat' as const },
  { icon: Rocket, title: 'Apply & Track', desc: 'Aptitude tests, company drives and referral networking with seniors.', target: 'Throughout', route: 'dashboard' as const },
];

const ROUNDS = ['Online Aptitude', 'Technical Test', 'DSA / Coding Round', 'Technical Interview', 'HR + Fit Round'];

const LEVELS = [
  { key: 'basic', label: 'Basic', desc: 'HR + fundamentals' },
  { key: 'intermediate', label: 'Intermediate', desc: 'Moderate technical' },
  { key: 'hard', label: 'Hard', desc: 'Deep problem solving' },
] as const;

const DIFF_STYLE: Record<string, string> = {
  basic: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  intermediate: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
  hard: 'bg-rose-500/15 text-rose-300 border border-rose-500/30',
};

export const PlacementScreen: React.FC<PlacementScreenProps> = ({ onNavigate }) => {
  const [drives, setDrives] = useState<PlacementDrive[]>([]);
  const [loading, setLoading] = useState(true);
  const [myApps, setMyApps] = useState<Record<number, { id: number; status: string }>>({});
  const [appBusy, setAppBusy] = useState<number | null>(null);
  const [appMsg, setAppMsg] = useState('');

  // Question suggester state
  const [company, setCompany] = useState('');
  const [level, setLevel] = useState<'basic' | 'intermediate' | 'hard'>('basic');
  const [questions, setQuestions] = useState<PlacementQuestion[]>([]);
  const [qCompany, setQCompany] = useState('');
  const [qLoading, setQLoading] = useState(false);
  const [qError, setQError] = useState('');
  const [autoLoaded, setAutoLoaded] = useState(false);

  // Shared question bank state (questions shared by placement cell / admin)
  const [bankCompanies, setBankCompanies] = useState<CompanyQuestionMeta[]>([]);
  const [bankCompany, setBankCompany] = useState('');
  const [bankQuestions, setBankQuestions] = useState<CompanyQuestion[]>([]);

  useEffect(() => {
    api.getCompanyQuestionCompanies().then((r) => setBankCompanies(r.companies || [])).catch(() => {});
    api.getCompanyQuestions().then((r) => setBankQuestions(r.questions || [])).catch(() => {});
  }, []);

  const openBank = (c: string) => {
    setBankCompany(c);
    api.getCompanyQuestions(c).then((r) => setBankQuestions(r.questions || [])).catch(() => {});
  };

  useEffect(() => {
    api.getPlacementDrives()
      .then((res) => setDrives(res.drives || []))
      .catch(() => {})
      .finally(() => setLoading(false));

    api.getMyApplications()
      .then((res) => {
        const m: Record<number, { id: number; status: string }> = {};
        for (const a of res.applications || []) m[a.drive_id] = { id: a.id, status: a.status };
        setMyApps(m);
      })
      .catch(() => {});

    // Auto-suggest questions for the user's AI target company
    api.getProfile()
      .then((res) => {
        const target = res.profile.targetCompanyName || '';
        if (target && !autoLoaded) {
          setCompany(target);
          setQCompany(target);
          setAutoLoaded(true);
          fetchQuestions(target, 'basic');
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchQuestions = async (c: string, lvl: 'basic' | 'intermediate' | 'hard') => {
    if (!c.trim()) return;
    setQLoading(true);
    setQError('');
    try {
      const res = await api.getPlacementQuestions(c.trim(), lvl);
      setQuestions(res.questions || []);
      setQCompany(c.trim());
      setCompany(c);
    } catch (err: any) {
      setQError(err.message || 'Could not generate questions. Try again.');
      setQuestions([]);
    } finally {
      setQLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchQuestions(company, level);
  };

  const applyToDrive = async (driveId: number) => {
    setAppBusy(driveId);
    setAppMsg('');
    try {
      const res = await api.applyToDrive(driveId);
      setMyApps((m) => ({ ...m, [driveId]: { id: res.application.id, status: 'applied' } }));
      setAppMsg('Applied ho gaya ✓ — PO jab status update karega woh yahan dikhega.');
    } catch (err: any) {
      setAppMsg(err.message || 'Apply failed. Try again.');
    } finally {
      setAppBusy(null);
    }
  };

  const withdrawApplication = async (driveId: number) => {
    setAppBusy(driveId);
    setAppMsg('');
    try {
      await api.withdrawApplication(driveId);
      setMyApps((m) => {
        const n = { ...m };
        delete n[driveId];
        return n;
      });
      setAppMsg('Application withdraw kar diya.');
    } catch (err: any) {
      setAppMsg(err.message || 'Withdraw failed. Try again.');
    } finally {
      setAppBusy(null);
    }
  };

  const APP_STATUS_STYLE: Record<string, string> = {
    applied: 'bg-[#5b5fef]/15 text-[#c0c1ff] border border-[#5b5fef]/40',
    waiting: 'bg-amber-500/15 text-amber-300 border border-amber-500/40',
    selected: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40',
    rejected: 'bg-rose-500/15 text-rose-300 border border-rose-500/40',
  };

  const switchLevel = (k: 'basic' | 'intermediate' | 'hard') => {
    setLevel(k);
    if (qCompany) fetchQuestions(qCompany, k);
  };

  const openDrives = drives.filter((d) => d.status === 'open');
  const upcomingDrives = drives.filter((d) => d.status === 'upcoming');
  const bestPackage = drives.reduce((mx, d) => {
    const n = parseInt(d.package, 10) || 0;
    return n > mx ? n : mx;
  }, 0);

  return (
    <main className="pt-20 pb-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <section className="glass-panel p-6 sm:p-8 rounded-3xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#5b5fef]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#3cd7ff]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#5b5fef]/20 border border-[#5b5fef]/40 text-[#c0c1ff] text-xs font-semibold mb-3">
            <Briefcase className="w-3.5 h-3.5 text-[#3cd7ff]" />
            <span>MBM University · Training & Placement Cell</span>
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
            Placement Hub
          </h1>
          <p className="text-xs sm:text-sm text-[#c6c5d7] mt-1 max-w-2xl">
            Live on-campus drives, prep roadmap and interview rounds — everything organised for your placement season.
          </p>
        </div>
      </section>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-[#191924] p-4 rounded-2xl border border-white/10 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#5b5fef] to-[#5203d5] flex items-center justify-center shrink-0 shadow-md">
            <Briefcase className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-xl font-extrabold text-white leading-none">{drives.length}</p>
            <p className="text-[10px] font-bold text-[#c6c5d7] uppercase tracking-wider mt-1">Total Drives</p>
          </div>
        </div>
        <div className="bg-[#191924] p-4 rounded-2xl border border-white/10 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#3cd7ff]/15 border border-[#3cd7ff]/40 flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5 text-[#3cd7ff]" />
          </div>
          <div className="min-w-0">
            <p className="text-xl font-extrabold text-white leading-none">{openDrives.length}</p>
            <p className="text-[10px] font-bold text-[#c6c5d7] uppercase tracking-wider mt-1">Open Now</p>
          </div>
        </div>
        <div className="bg-[#191924] p-4 rounded-2xl border border-white/10 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#292932] flex items-center justify-center shrink-0">
            <IndianRupee className="w-5 h-5 text-[#c0c1ff]" />
          </div>
          <div className="min-w-0">
            <p className="text-xl font-extrabold text-white leading-none">{bestPackage ? bestPackage + ' LPA' : '—'}</p>
            <p className="text-[10px] font-bold text-[#c6c5d7] uppercase tracking-wider mt-1">Best Package</p>
          </div>
        </div>
        <div className="bg-[#191924] p-4 rounded-2xl border border-white/10 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#292932] flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-[#c0c1ff]" />
          </div>
          <div className="min-w-0">
            <p className="text-xl font-extrabold text-white leading-none">{upcomingDrives.length}</p>
            <p className="text-[10px] font-bold text-[#c6c5d7] uppercase tracking-wider mt-1">Upcoming</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Drives */}
        <section className="lg:col-span-2 glass-panel rounded-3xl p-5 sm:p-6 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-[#3cd7ff]" /> On-Campus Drives
            </h2>
            {loading && <span className="text-xs text-[#c6c5d7]">Loading…</span>}
          </div>
          {!loading && drives.length === 0 && (
            <p className="text-sm text-[#c6c5d7]">No drives announced yet. Check back soon!</p>
          )}
          {appMsg && <p className="text-xs font-semibold text-[#3cd7ff]">{appMsg}</p>}
          <div className="space-y-3">
            {drives.map((d) => {
              const app = myApps[d.id];
              return (
                <div key={d.id} className="bg-[#191924] rounded-2xl border border-white/10 p-4 flex flex-col sm:flex-row sm:items-center gap-3 hover:border-[#c0c1ff]/40 transition-all">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#5b5fef]/30 to-[#3cd7ff]/20 border border-[#3cd7ff]/30 flex items-center justify-center shrink-0">
                    <Target className="w-5 h-5 text-[#3cd7ff]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white truncate">{d.company}</p>
                    <p className="text-xs text-[#c6c5d7] truncate">{d.role}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <span className="text-xs font-bold text-[#3cd7ff] whitespace-nowrap">{d.package}</span>
                    <span className="flex items-center gap-1 text-[11px] text-[#c6c5d7] whitespace-nowrap">
                      <Clock className="w-3.5 h-3.5" /> {d.deadline}
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full whitespace-nowrap ${
                        d.status === 'open'
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          : 'bg-[#3cd7ff]/10 text-[#3cd7ff] border border-[#3cd7ff]/30'
                      }`}
                    >
                      {d.status}
                    </span>
                    {app && (
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full whitespace-nowrap ${APP_STATUS_STYLE[app.status] || APP_STATUS_STYLE.applied}`}>
                        {app.status}
                      </span>
                    )}
                    {d.status === 'open' && (
                      app ? (
                        <button
                          onClick={() => withdrawApplication(d.id)}
                          disabled={appBusy === d.id}
                          className="px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-bold hover:bg-rose-500/20 transition-all disabled:opacity-50 cursor-pointer"
                        >
                          {appBusy === d.id ? '…' : 'Withdraw'}
                        </button>
                      ) : (
                        <button
                          onClick={() => applyToDrive(d.id)}
                          disabled={appBusy === d.id}
                          className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#5b5fef] to-[#3cd7ff] text-white text-xs font-bold hover:opacity-90 transition-all disabled:opacity-50 cursor-pointer"
                        >
                          {appBusy === d.id ? '…' : 'Apply'}
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Rounds + Prep tracks */}
        <section className="space-y-6">
          <div className="glass-panel rounded-3xl p-5 sm:p-6">
            <h2 className="text-lg font-extrabold text-white mb-3 flex items-center gap-2">
              <Rocket className="w-5 h-5 text-[#3cd7ff]" /> Selection Rounds
            </h2>
            <ol className="space-y-2.5">
              {ROUNDS.map((r, i) => (
                <li key={r} className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-[#5b5fef]/20 border border-[#5b5fef]/40 text-[#c0c1ff] text-xs font-extrabold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-sm text-white">{r}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </div>

      {/* AI Company Question Suggester */}
      <section className="glass-panel rounded-3xl p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#3cd7ff]" /> Company Interview Questions
            </h2>
            <p className="text-xs text-[#c6c5d7] mt-1 max-w-2xl">
              AI janta hai ki kaunse question kaunsi company mein kab-kab aaye hain — frequency, years aur required skills ke saath. Apni target company search karo.
            </p>
          </div>
          {qCompany && questions.length > 0 && (
            <span className="text-[11px] font-bold text-[#c0c1ff] bg-[#5b5fef]/15 border border-[#5b5fef]/30 px-3 py-1.5 rounded-full self-start lg:self-auto whitespace-nowrap">
              Showing questions for <span className="text-white">{qCompany}</span>
            </span>
          )}
        </div>

        {/* Search + level */}
        <form onSubmit={handleSearch} className="mt-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#c6c5d7] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Type a company — e.g. TCS, Infosys, Microsoft, Amazon"
              className="w-full bg-[#181824] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-[#6b6b7d] focus:outline-none focus:border-[#c0c1ff]"
            />
          </div>
          <button
            type="submit"
            disabled={qLoading || !company.trim()}
            className="shrink-0 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#5b5fef] to-[#3cd7ff] text-white text-sm font-semibold shadow-md hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2"
          >
            {qLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>{qLoading ? 'Generating…' : 'Get Questions'}</span>
          </button>
        </form>

        {/* Level chips (independent of skill mastery levels) */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-[#c6c5d7] uppercase tracking-wider mr-1">Difficulty:</span>
          {LEVELS.map((l) => (
            <button
              key={l.key}
              onClick={() => switchLevel(l.key)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer border ${
                level === l.key
                  ? 'bg-[#5b5fef]/25 border-[#5b5fef]/60 text-[#c0c1ff]'
                  : 'bg-white/5 border-white/10 text-[#c6c5d7] hover:border-white/25'
              }`}
              title={l.desc}
            >
              {l.label}
            </button>
          ))}
          <span className="text-[10px] text-[#7e7d94] ml-1">
            Yeh difficulty aapke skill mastery ke beginner/intermediate/advanced se alag hai — sirf question level.
          </span>
        </div>

        {qError && (
          <p className="mt-4 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm font-medium">{qError}</p>
        )}

        {qLoading && (
          <div className="mt-5 flex flex-col items-center justify-center py-10 text-center">
            <Loader2 className="w-7 h-7 text-[#3cd7ff] animate-spin mb-3" />
            <p className="text-sm font-semibold text-white">AI is preparing {company.trim() || 'company'} questions…</p>
            <p className="text-xs text-[#c6c5d7] mt-1">Frequency, years aur skills ke saath — sabse relevant pehle.</p>
          </div>
        )}

        {!qLoading && questions.length === 0 && !qError && (
          <div className="mt-5 flex flex-col items-center justify-center py-8 text-center">
            <GraduationCap className="w-9 h-9 text-[#3cd7ff]/40 mb-3" />
            <p className="text-sm font-semibold text-white">Pehle ek company choose karo</p>
            <p className="text-xs text-[#c6c5d7] mt-1 max-w-sm">
              Target company search karo (ya profile mein set kiya gaya target auto-load hoga) — AI sabse relevant questions dega.
            </p>
          </div>
        )}

        {!qLoading && questions.length > 0 && (
          <div className="mt-5 space-y-4">
            {questions.map((q, idx) => (
              <article key={idx} className="bg-[#191924] rounded-2xl border border-white/10 p-4 sm:p-5 hover:border-[#c0c1ff]/40 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <span className={`text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full shrink-0 ${DIFF_STYLE[q.difficulty] || DIFF_STYLE.basic}`}>
                    {q.difficulty}
                  </span>
                  <span className="text-[10px] font-bold text-[#7e7d94] shrink-0">#{idx + 1} most relevant</span>
                </div>
                <p className="text-sm text-white font-medium mt-3 leading-relaxed">{q.question}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#3cd7ff] bg-[#3cd7ff]/10 border border-[#3cd7ff]/25 px-2.5 py-1 rounded-full">
                    <BarChart3 className="w-3.5 h-3.5" /> Asked {q.frequency} times
                  </span>
                  {q.years.length > 0 && (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#c6c5d7] bg-white/5 border border-white/10 px-2.5 py-1 rounded-full">
                      <History className="w-3.5 h-3.5" /> {q.years.join(' · ')}
                    </span>
                  )}
                </div>
                {q.skills.length > 0 && (
                  <div className="mt-3 flex items-start flex-wrap gap-1.5">
                    <span className="text-[10px] font-bold text-[#c6c5d7] uppercase tracking-wider mt-1">Skills needed:</span>
                    {q.skills.map((s) => (
                      <span key={s} className="text-[11px] font-medium text-[#c0c1ff] bg-[#5b5fef]/15 border border-[#5b5fef]/30 px-2.5 py-0.5 rounded-full">
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Shared Question Bank (placement cell ne share kiya) */}
      <section className="glass-panel rounded-3xl p-5 sm:p-6">
        <div>
          <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#3cd7ff]" /> Shared Question Bank
          </h2>
          <p className="text-xs text-[#c6c5d7] mt-1 max-w-2xl">
            Placement cell / admin ne in company-specific questions ko frequency ke saath share kiya hai — ye AI se nahi, seniors aur trainers se aaye hain.
          </p>
        </div>

        <div className="mt-4 flex gap-2 flex-wrap">
          <button
            onClick={() => { setBankCompany(''); api.getCompanyQuestions().then((r) => setBankQuestions(r.questions || [])).catch(() => {}); }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer ${
              !bankCompany ? 'bg-[#5b5fef]/25 border-[#5b5fef]/60 text-[#c0c1ff]' : 'bg-white/5 border-white/10 text-[#c6c5d7] hover:border-white/25'
            }`}
          >
            Sab ({bankCompanies.length} companies)
          </button>
          {bankCompanies.map((c) => (
            <button
              key={c.company}
              onClick={() => openBank(c.company)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                bankCompany === c.company ? 'bg-[#5b5fef]/25 border-[#5b5fef]/60 text-[#c0c1ff]' : 'bg-white/5 border-white/10 text-[#c6c5d7] hover:border-white/25'
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" /> {c.company} · {c.question_count}
              </span>
            </button>
          ))}
          {bankCompanies.length === 0 && (
            <p className="text-xs text-[#7e7d94]">Abhi koi shared question nahi — placement cell jald hi add karega.</p>
          )}
        </div>

        <div className="mt-4 space-y-3">
          {bankQuestions.map((q) => (
            <article key={q.id} className="bg-[#191924] rounded-2xl border border-white/10 p-4 sm:p-5 hover:border-[#c0c1ff]/40 transition-all">
              <div className="flex items-start justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#3cd7ff] bg-[#3cd7ff]/10 border border-[#3cd7ff]/25 px-2.5 py-1 rounded-full shrink-0">
                  <BarChart3 className="w-3.5 h-3.5" /> Frequency: {q.frequency}/100
                </span>
                {bankCompany && (
                  <span className="text-[10px] font-bold text-[#7e7d94] shrink-0">{q.company}</span>
                )}
              </div>
              <p className="text-sm text-white font-medium mt-3 leading-relaxed">{q.question}</p>
            </article>
          ))}
          {bankQuestions.length > 0 && bankCompany && (
            <p className="text-[10px] text-[#7e7d94]">Frequency = placement cell ne bataya kitni baar ye question us company mein aata hai.</p>
          )}
        </div>
      </section>

      {/* Prep tracks */}
      <section>
        <h2 className="text-lg font-extrabold text-white mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-[#3cd7ff]" /> Placement Prep Roadmap
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PREP_TRACKS.map((t) => (
            <button
              key={t.title}
              onClick={() => onNavigate(t.route)}
              className="text-left bg-[#191924] rounded-2xl border border-white/10 p-5 hover:border-[#c0c1ff]/40 hover:bg-[#1d1d2a] transition-all cursor-pointer group"
            >
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#5b5fef]/30 to-[#3cd7ff]/20 border border-[#3cd7ff]/30 flex items-center justify-center mb-3">
                <t.icon className="w-5 h-5 text-[#3cd7ff]" />
              </div>
              <h3 className="font-bold text-white text-sm">{t.title}</h3>
              <p className="text-xs text-[#c6c5d7] mt-1.5 leading-relaxed">{t.desc}</p>
              <div className="flex items-center justify-between mt-3">
                <span className="text-[10px] font-bold text-[#c0c1ff] uppercase tracking-wide">{t.target}</span>
                <ArrowRight className="w-4 h-4 text-[#c6c5d7] group-hover:text-[#3cd7ff] group-hover:translate-x-0.5 transition-all" />
              </div>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
};