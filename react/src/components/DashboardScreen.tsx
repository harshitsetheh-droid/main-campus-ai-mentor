import React, { useState, useEffect } from 'react';
import { ScreenType } from '../types';
import {
  Target, Users, Bell, Plus, Rocket, Sparkles, X, Check, ExternalLink,
  ChevronRight, TrendingUp, Award, FileText, FolderGit2, ArrowRight, Pencil, AlertTriangle
} from 'lucide-react';
import { api, DashboardResponse, DashboardProject, Notification, ProjectSuggestion } from '../api';

interface DashboardScreenProps {
  onNavigate: (screen: ScreenType, transition?: 'none' | 'push' | 'slide_up') => void;
}

function formatNotificationDate(value: string): string {
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${date}, ${time}`;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ onNavigate }) => {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [showAddProject, setShowAddProject] = useState(false);
  const [projectForm, setProjectForm] = useState({
    title: '',
    description: '',
    level: 'Beginner',
    repoUrl: '',
    status: 'ongoing',
    progress: 0,
  });
  const [showNotifications, setShowNotifications] = useState(false);
  const [suggestSkills, setSuggestSkills] = useState('');
  const [suggestRole, setSuggestRole] = useState('');
  const [suggestions, setSuggestions] = useState<ProjectSuggestion[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState('');

  const loadDashboard = () => {
    api.getDashboard()
      .then(setData)
      .catch((err) => console.error('Failed to load dashboard', err));
  };

  useEffect(() => { loadDashboard(); }, []);

  const handleSuggestProjects = async () => {
    setSuggestError('');
    setIsSuggesting(true);
    setSuggestions([]);
    try {
      const skills = suggestSkills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await api.suggestProjects(skills.length ? skills : [], suggestRole.trim() || undefined);
      setSuggestions(res.suggestions || []);
      if (!(res.suggestions || []).length) setSuggestError('No suggestions returned. Try again.');
    } catch (err: any) {
      setSuggestError(err.message || 'Failed to get suggestions');
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleSaveSuggestion = async (s: ProjectSuggestion) => {
    try {
      await api.addProject({
        title: s.title,
        description: s.description,
        level: s.level,
        status: 'ongoing',
        progress: 0,
        recommendedByAi: true,
      });
      loadDashboard();
    } catch (err) {
      console.error('Failed to save suggestion', err);
    }
  };

  const handleAddProject = async () => {
    if (!projectForm.title.trim()) return;
    try {
      await api.addProject(projectForm);
      setProjectForm({ title: '', description: '', level: 'Beginner', repoUrl: '', status: 'ongoing', progress: 0 });
      setShowAddProject(false);
      loadDashboard();
    } catch (err) {
      console.error('Failed to add project', err);
    }
  };

  const handleToggleProject = async (p: DashboardProject) => {
    try {
      const next = p.status === 'completed'
        ? { status: 'ongoing', progress: p.progress > 0 ? p.progress : 0 }
        : { status: 'completed', progress: 100 };
      await api.updateProject(p.id, next);
      loadDashboard();
    } catch (err) {
      console.error('Failed to update project', err);
    }
  };

  const handleReadNotification = async (n: Notification) => {
    try {
      await api.readNotification(n.id);
      loadDashboard();
    } catch { /* ignore */ }
  };

  const unreadCount = (data?.notifications || []).filter((n) => !n.is_read).length;

  return (
    <main className="pt-24 pb-28 px-4 max-w-7xl mx-auto space-y-8">
      {/* Welcome Banner */}
      <section className="relative overflow-hidden rounded-2xl p-6 sm:p-8 bg-gradient-to-br from-[#5b5fef] to-[#5203d5] shadow-xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Good Evening, {data?.name}
            </h2>
            <div className="flex flex-wrap items-center gap-3 text-white/80 font-medium text-sm">
              <span className="flex items-center gap-1.5">
                <Target className="w-4 h-4 text-[#3cd7ff]" />
                Target: {data?.targetRole || 'Not set'}
              </span>
              {data?.targetCompanyName && (
                <span className="flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-[#3cd7ff]" />
                  {data.targetCompanyName}
                </span>
              )}
            </div>
          </div>

          {/* Notifications */}
          <div className="relative shrink-0">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative w-11 h-11 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-all cursor-pointer"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-[#1b1b26] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                  <h4 className="text-sm font-bold text-white">Notifications</h4>
                  <span className="text-[10px] text-[#c6c5d7]">
                    Skills · Projects · Compare · Certificates
                  </span>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {(data?.notifications || []).length === 0 ? (
                    <p className="text-xs text-[#c6c5d7] p-4">
                      No notifications yet. Complete skills, projects and upload certificates to see updates here.
                    </p>
                  ) : (
                    (data?.notifications || []).map((n) => (
                      <button
                        key={n.id}
                        onClick={() => handleReadNotification(n)}
                        className={`w-full text-left px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-all cursor-pointer ${
                          n.is_read ? 'opacity-60' : ''
                        }`}
                      >
                        <p className="text-xs font-bold text-white flex items-center gap-2">
                          {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-[#3cd7ff]" />}
                          {n.title}
                        </p>
                        <p className="text-[11px] text-[#c6c5d7] mt-0.5">{n.detail}</p>
                        {n.created_at && (
                          <p className="text-[9px] text-[#7e7d94] mt-1 text-right">
                            {formatNotificationDate(n.created_at)}
                          </p>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Peer Skill Comparison CTA */}
      <section
        onClick={() => onNavigate('compare', 'push')}
        className="glass-card p-5 sm:p-6 rounded-2xl border border-[#3cd7ff]/30 hover:border-[#3cd7ff]/60 transition-all cursor-pointer group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-[0_0_20px_rgba(60,215,255,0.1)]"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#3cd7ff]/20 to-[#5b5fef]/30 border border-[#3cd7ff]/40 flex items-center justify-center text-[#3cd7ff] shrink-0 group-hover:scale-110 transition-transform">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white group-hover:text-[#3cd7ff] transition-colors">
                Compare Skills with Peers & Cohort
              </h3>
              <span className="text-[10px] bg-[#3cd7ff]/20 text-[#3cd7ff] px-2 py-0.5 rounded-full font-bold">NEW</span>
            </div>
            <p className="text-xs text-[#c6c5d7] mt-0.5">
              Rank formula: DSA 25% · Projects 15% · Languages 15% · Aptitude · Hackathons · Internship 5%
            </p>
          </div>
        </div>
        <button className="px-4 py-2 rounded-xl bg-[#3cd7ff]/10 text-[#3cd7ff] border border-[#3cd7ff]/30 text-xs font-bold group-hover:bg-[#3cd7ff] group-hover:text-[#0e00aa] transition-all flex items-center gap-1.5 shrink-0">
          <span>Compare Matrix</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </section>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#3cd7ff]/15 border border-[#3cd7ff]/30 flex items-center justify-center text-[#3cd7ff] shrink-0">
            <FolderGit2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-2xl font-bold text-white">{data?.projectCount ?? 0}</span>
            <p className="text-xs text-[#c6c5d7]">Projects Completed</p>
          </div>
        </div>
        <div className="glass-card rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#5b5fef]/15 border border-[#5b5fef]/30 flex items-center justify-center text-[#c0c1ff] shrink-0">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <span className="text-2xl font-bold text-white">{data?.certificateCount ?? 0}</span>
            <p className="text-xs text-[#c6c5d7]">Certificates Uploaded</p>
          </div>
        </div>
        <div className="glass-card rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#cdbdff]/15 border border-[#cdbdff]/30 flex items-center justify-center text-[#cdbdff] shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <span className="text-2xl font-bold text-white">{(data?.skillGap || []).length}</span>
            <p className="text-xs text-[#c6c5d7]">Skills Being Tracked</p>
          </div>
        </div>
      </div>

      {/* Skill Gap Analysis: required vs current bar graph */}
      <section className="glass-card rounded-2xl p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <div>
            <h3 className="text-xl font-bold text-[#c0c1ff]">Skill Mastery vs Required Level</h3>
            <p className="text-xs text-[#c6c5d7] mt-1">
              Track how close each skill is to the level your target role requires.
            </p>
          </div>
          <button
            onClick={() => onNavigate('compare', 'push')}
            className="text-[#c0c1ff] text-sm font-semibold hover:underline flex items-center gap-1 cursor-pointer"
          >
            Open full comparison <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {(data?.skillGap || []).length === 0 ? (
          <div className="text-center py-10 border border-dashed border-[#464555] rounded-xl">
            <p className="text-sm text-[#c6c5d7] mb-2">No skills added yet.</p>
            <button
              onClick={() => onNavigate('compare', 'push')}
              className="px-4 py-2 bg-[#5b5fef]/20 text-[#c0c1ff] border border-[#5b5fef]/30 text-sm rounded-lg font-medium hover:bg-[#5b5fef]/30 transition-all cursor-pointer"
            >
              Add skills in Compare
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {(data?.skillGap || []).map((s) => {
              const gap = s.current >= s.required ? 0 : s.required - s.current;
              const done = s.current >= s.required;
              return (
                <div key={s.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">{s.name}</span>
                      {done ? (
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-semibold flex items-center gap-0.5">
                          <Check className="w-3 h-3" /> Target reached
                        </span>
                      ) : (
                        <span className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-full font-semibold">
                          {gap}% to go
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[#c6c5d7] flex items-center gap-1.5">
                      <span className="font-bold text-[#3cd7ff]">{s.current}%</span>
                      <span>/</span>
                      <RequiredLevelEditor skill={s} onUpdated={loadDashboard} />
                      <span className="text-[#c6c5d7]">required</span>
                    </div>
                  </div>
                  <div className="relative h-5 bg-[#292932] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#5b5fef] to-[#3cd7ff] rounded-full transition-all duration-700"
                      style={{ width: `${Math.min(100, s.current)}%` }}
                    />
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-white/70"
                      style={{ left: `${Math.min(100, s.required)}%` }}
                      title={`Required: ${s.required}%`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* AI Recommendations */}
      {(data?.recommendations || []).length > 0 && (
        <section className="space-y-3">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#3cd7ff]" />
            Recommended Next Steps
          </h3>
          <div className="flex flex-wrap gap-2.5">
            {(data?.recommendations || []).map((rec, idx) => (
              <span
                key={idx}
                onClick={() => { if (rec.navigatesTo === 'compare') onNavigate('compare', 'push'); }}
                className="px-3.5 py-1.5 rounded-full glass-card text-xs font-medium border border-[#c0c1ff]/30 text-[#c0c1ff] transition-all cursor-pointer hover:bg-[#c0c1ff]/10"
              >
                {rec.text}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* AI Project Suggestions */}
      <section className="glass-card rounded-2xl p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
          <div>
            <h3 className="text-xl font-bold text-[#c0c1ff] flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#3cd7ff]" /> AI Project Suggestions
            </h3>
            <p className="text-xs text-[#c6c5d7] mt-1">
              Enter your target role + skills and get project ideas that use those exact skills.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <input
            type="text"
            value={suggestSkills}
            onChange={(e) => setSuggestSkills(e.target.value)}
            placeholder={`Skills (auto-filled from profile; edit if needed)`}
            className="px-4 py-2.5 bg-[#1b1b26] border border-white/10 rounded-xl text-sm text-white placeholder-[#c6c5d7]/50 focus:outline-none focus:border-[#c0c1ff]/50"
          />
          <input
            type="text"
            value={suggestRole}
            onChange={(e) => setSuggestRole(e.target.value)}
            placeholder={`Target role (default: ${data?.targetRole || 'Software Engineer'})`}
            className="px-4 py-2.5 bg-[#1b1b26] border border-white/10 rounded-xl text-sm text-white placeholder-[#c6c5d7]/50 focus:outline-none focus:border-[#c0c1ff]/50"
          />
        </div>
        <button
          onClick={handleSuggestProjects}
          disabled={isSuggesting}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#5b5fef] to-[#3cd7ff] text-white text-sm font-semibold hover:opacity-90 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
        >
          {isSuggesting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Generating…
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" /> Suggest Projects
            </>
          )}
        </button>

        {suggestError && (
          <div className="mt-4 px-4 py-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
            {suggestError}
          </div>
        )}

        {suggestions.length > 0 && (
          <div className="mt-6">
            <h4 className="text-sm font-bold text-white mb-3">Suggested Projects</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {suggestions.map((s, idx) => (
                <div key={idx} className="glass-card rounded-2xl p-5 flex flex-col gap-3 hover:border-[#c0c1ff]/40 transition-all">
                  <div className="flex items-start justify-between gap-2">
                    <h5 className="text-sm font-bold text-white leading-snug">{s.title}</h5>
                    <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#007c96]/80 text-[#edf9ff]">
                      {s.level}
                    </span>
                  </div>
                  <p className="text-xs text-[#c6c5d7] leading-relaxed">{s.description}</p>
                  <div className="mt-auto pt-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#3cd7ff] mb-1.5">Skills used</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(s.skillsUsed || []).map((sk) => (
                        <span key={sk} className="text-[10px] px-2 py-0.5 rounded-full bg-[#5b5fef]/15 border border-[#c0c1ff]/30 text-[#c0c1ff]">
                          {sk}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => handleSaveSuggestion(s)}
                    className="mt-3 w-full px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#5b5fef]/15 text-[#c0c1ff] border border-[#5b5fef]/30 hover:bg-[#5b5fef]/25 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add to my projects
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Projects */}
      <section className="space-y-4 pt-2">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-bold text-white">My Projects</h3>
          <button
            onClick={() => setShowAddProject(true)}
            className="text-[#c0c1ff] font-medium text-sm flex items-center gap-1 hover:underline cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Project
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(data?.projects || []).map((project) => (
            <div key={project.id} className="glass-card rounded-2xl overflow-hidden group hover:border-[#c0c1ff]/40 transition-all">
              <div className="h-36 relative bg-gradient-to-br from-[#1b1b23] to-[#292932] overflow-hidden">
                {project.imageUrl ? (
                  <img
                    src={project.imageUrl}
                    alt={project.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[#5b5fef]/25 to-[#3cd7ff]/15 flex items-center justify-center group-hover:scale-105 transition-transform duration-500">
                    <Rocket className="w-12 h-12 text-[#c0c1ff]/40" />
                  </div>
                )}
                {project.recommendedByAi && (
                  <span className="absolute top-3 left-3 bg-[#5b5fef]/90 text-white px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> AI Recommended
                  </span>
                )}
                {!project.recommendedByAi && project.aiVerified === false && (
                  <span className="absolute top-3 left-3 bg-rose-600/90 text-white px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1" title={project.aiVerification}>
                    <AlertTriangle className="w-3 h-3" /> Not Verified
                  </span>
                )}
                {!project.recommendedByAi && project.aiVerified !== false && (
                  <span className="absolute top-3 left-3 bg-emerald-600/80 text-white px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1" title={project.aiVerification || 'AI verified this project'}>
                    <Check className="w-3 h-3" /> AI Verified
                  </span>
                )}
                <span className="absolute top-3 right-3 bg-[#007c96]/80 text-[#edf9ff] px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider">
                  {project.level}
                </span>
              </div>
              <div className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-bold text-white text-base">{project.title}</h4>
                  {project.repoUrl && (
                    <a
                      href={project.repoUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-[#c0c1ff] hover:text-[#3cd7ff] transition-colors"
                      title="View repository"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
                <p className="text-xs text-[#c6c5d7] line-clamp-2 leading-relaxed">{project.description}</p>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[#3cd7ff] text-xs font-semibold">{project.status === 'completed' ? 'Completed' : 'Ongoing'}</span>
                  <button
                    onClick={() => handleToggleProject(project)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                      project.status === 'completed'
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
                        : 'bg-[#5b5fef]/15 text-[#c0c1ff] border border-[#5b5fef]/30 hover:bg-[#5b5fef]/25'
                    }`}
                  >
                    {project.status === 'completed' ? <><Check className="w-3 h-3" /> Done</> : 'Mark Complete'}
                  </button>
                </div>
              </div>
            </div>
          ))}

          {!data?.projects?.length && (
            <div className="md:col-span-2 lg:col-span-3 glass-card rounded-2xl p-10 flex flex-col items-center justify-center text-center border border-dashed border-[#464555]">
              <Rocket className="w-12 h-12 text-[#3cd7ff] mb-4" />
              <h4 className="text-lg font-bold text-white mb-1">No projects yet</h4>
              <p className="text-sm text-[#c6c5d7] mb-6 max-w-sm">
                Add your first project to start building a portfolio your AI mentor can recommend and analyze.
              </p>
              <button
                onClick={() => setShowAddProject(true)}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#5b5fef] to-[#3cd7ff] text-white text-sm font-semibold hover:opacity-90 transition-all cursor-pointer flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Add Project</span>
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Add Project Modal */}
      {showAddProject && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card rounded-2xl p-6 sm:p-8 w-full max-w-lg relative">
            <button
              onClick={() => setShowAddProject(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-[#c6c5d7] transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
              <Plus className="w-5 h-5 text-[#3cd7ff]" />
              <span>Add a Project</span>
            </h3>
            <p className="text-sm text-[#c6c5d7] mb-6">Track a project so your AI mentor can recommend improvements.</p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#c6c5d7] mb-1">Project Title</label>
                <input
                  value={projectForm.title}
                  onChange={(e) => setProjectForm({ ...projectForm, title: e.target.value })}
                  placeholder="e.g. Real-time Face Recognition System"
                  className="w-full bg-[#13131b] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#c0c1ff]/50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#c6c5d7] mb-1">Description</label>
                <textarea
                  value={projectForm.description}
                  onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                  placeholder="Briefly describe the project"
                  rows={3}
                  className="w-full bg-[#13131b] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#c0c1ff]/50 resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#c6c5d7] mb-1">Git Repository URL (optional)</label>
                <input
                  value={projectForm.repoUrl}
                  onChange={(e) => setProjectForm({ ...projectForm, repoUrl: e.target.value })}
                  placeholder="https://github.com/username/project"
                  className="w-full bg-[#13131b] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#c0c1ff]/50"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#c6c5d7] mb-1">Level</label>
                  <select
                    value={projectForm.level}
                    onChange={(e) => setProjectForm({ ...projectForm, level: e.target.value })}
                    className="w-full bg-[#13131b] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#c0c1ff]/50 styled-select !bg-[#13131b]"
                  >
                    <option>Beginner</option>
                    <option>Intermediate</option>
                    <option>Advanced</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#c6c5d7] mb-1">Progress (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={projectForm.progress}
                    onChange={(e) => setProjectForm({ ...projectForm, progress: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                    className="w-full bg-[#13131b] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#c0c1ff]/50"
                  />
                </div>
              </div>
              <button
                onClick={handleAddProject}
                disabled={!projectForm.title.trim()}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#5b5fef] to-[#5203d5] text-white font-semibold text-sm hover:opacity-90 transition-all active:scale-95 disabled:opacity-40 cursor-pointer"
              >
                Add Project
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Button */}
      <button
        onClick={() => setShowAddProject(true)}
        className="hidden fixed bottom-20 right-6 w-14 h-14 rounded-full bg-gradient-to-br from-[#c0c1ff] to-[#3cd7ff] shadow-[0_8px_25px_rgba(192,193,255,0.4)] flex items-center justify-center text-[#0e00aa] hover:scale-110 active:scale-95 transition-transform z-40 cursor-pointer"
        title="Add a project"
      >
        <Plus className="w-7 h-7" />
      </button>
    </main>
  );
};

interface RequiredLevelEditorProps {
  skill: { id: string; name: string; current: number; required: number };
  onUpdated: () => void;
}

const RequiredLevelEditor: React.FC<RequiredLevelEditorProps> = ({ skill, onUpdated }) => {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(skill.required));

  const save = async () => {
    const n = Math.max(0, Math.min(100, parseInt(value, 10) || 0));
    setEditing(false);
    if (n === skill.required) return;
    try {
      await api.updateSkill(skill.id, { requiredLevel: n });
      onUpdated();
    } catch (err) {
      console.error('Failed to update required level', err);
    }
  };

  if (editing) {
    return (
      <input
        type="number"
        autoFocus
        min={0}
        max={100}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
        className="w-14 px-1.5 py-0.5 rounded-md bg-[#1b1b23] border border-[#5b5fef]/50 text-[#3cd7ff] font-bold text-xs outline-none focus:ring-1 focus:ring-[#5b5fef]"
      />
    );
  }

  return (
    <button
      onClick={() => { setValue(String(skill.required)); setEditing(true); }}
      className="inline-flex items-center gap-1 text-[#c0c1ff] font-bold hover:text-white transition-colors cursor-pointer group"
      title="Click to edit required level"
    >
      {skill.required}%
      <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
};