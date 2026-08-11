import React, { useState, useEffect } from 'react';
import { ScreenType } from '../types';
import {
  Rocket, Sparkles, ExternalLink, CheckCircle2, Plus, X,
  FolderGit2, RefreshCw, Loader2, Search, Check
} from 'lucide-react';
import { api, DashboardProject, Skill } from '../api';

interface ProjectsScreenProps {
  onNavigate: (screen: ScreenType, transition?: 'none' | 'push' | 'slide_up') => void;
}

export const ProjectsScreen: React.FC<ProjectsScreenProps> = () => {
  const [projects, setProjects] = useState<DashboardProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'ongoing' | 'completed'>('all');
  const [showSkillModal, setShowSkillModal] = useState(false);
  const [allSkills, setAllSkills] = useState<Skill[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [selectAny, setSelectAny] = useState(false);
  const [skillSearch, setSkillSearch] = useState('');
  const [showRecommend, setShowRecommend] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<{ title: string; description: string; skillsUsed: string[]; level: string }[]>([]);
  const [err, setErr] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    repoUrl: '',
    level: 'Beginner',
    status: 'ongoing',
    progress: 0,
  });

  const load = () => {
    api.getDashboard()
      .then((res) => setProjects(res.projects || []))
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!form.title.trim() || adding) return;
    setAdding(true);
    setErr('');
    try {
      await api.addProject(form);
      setForm({ title: '', description: '', repoUrl: '', level: 'Beginner', status: 'ongoing', progress: 0 });
      setShowAddForm(false);
      load();
    } catch (e: any) {
      setErr(e.message || 'Failed to add project');
    } finally {
      setAdding(false);
    }
  };

  const getSuggestions = async (skills?: string[]) => {
    setErr('');
    setSuggestions([]);
    setSuggesting(true);
    try {
      const res = await api.suggestProjects(skills && skills.length ? skills : [], undefined);
      setSuggestions(res.suggestions || []);
      if (!(res.suggestions || []).length) setErr('No suggestions returned yet. Add skills first.');
    } catch (e: any) {
      setErr(e.message || 'Failed to get AI recommendations');
    } finally {
      setSuggesting(false);
    }
  };

  const openSkillModal = async () => {
    setErr('');
    setSkillSearch('');
    setShowSkillModal(true);
    try {
      const res = await api.getProfile();
      setAllSkills(res.skills || []);
      setSelectAny(false);
      setSelectedSkills([]);
    } catch (e: any) {
      setErr(e.message || 'Failed to load skills');
    }
  };

  const toggleAny = () => {
    setSelectedSkills([]);
    setSelectAny(!selectAny);
  };

  const toggleSkill = (name: string) => {
    if (selectAny) return;
    setSelectedSkills((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const generateRecommendations = () => {
    if (!selectAny && !selectedSkills.length) {
      setErr('Select at least one skill or choose "Any".');
      return;
    }
    if (selectAny) setSelectedSkills([]);
    setShowSkillModal(false);
    setShowRecommend(true);
    getSuggestions(selectAny ? [] : selectedSkills);
  };

  const saveSuggestion = async (s: { title: string; description: string; level: string }) => {
    try {
      await api.addProject({
        title: s.title,
        description: s.description,
        level: s.level,
        status: 'ongoing',
        progress: 0,
        recommendedByAi: true,
      });
      load();
      setShowRecommend(false);
    } catch (e: any) {
      setErr(e.message || 'Failed to save suggestion');
    }
  };

  const toggleStatus = async (p: DashboardProject) => {
    try {
      const next = p.status === 'completed'
        ? { status: 'ongoing', progress: p.progress > 0 ? p.progress : 0 }
        : { status: 'completed', progress: 100 };
      await api.updateProject(p.id, next);
      load();
    } catch (e) { console.error(e); }
  };

  const filtered = projects.filter((p) => (filter === 'all' ? true : p.status === filter));
  const ongoing = projects.filter((p) => p.status !== 'completed').length;
  const completed = projects.filter((p) => p.status === 'completed').length;

  return (
    <main className="pt-24 pb-24 px-4 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2">
            <FolderGit2 className="w-7 h-7 text-[#3cd7ff]" /> My Projects
          </h2>
          <p className="text-sm text-[#c6c5d7] mt-1">
            {ongoing} ongoing · {completed} completed
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch gap-2">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-white text-sm font-semibold hover:bg-white/10 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showAddForm ? 'Cancel' : 'Add Project'}
          </button>
          <button
            onClick={openSkillModal}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#5b5fef] to-[#3cd7ff] text-white text-sm font-semibold hover:opacity-90 transition-all cursor-pointer flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            AI Recommendations
          </button>
        </div>
      </div>

      {/* Manual add project form */}
      {showAddForm && (
        <div className="glass-card rounded-2xl p-6 mb-6 border-[#c0c1ff]/30">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-[#3cd7ff]" /> Add a Project
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#c6c5d7] mb-1">Project Title *</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Real-time Face Recognition System"
                className="w-full bg-[#13131b] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#c0c1ff]/50"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#c6c5d7] mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Briefly describe the project"
                rows={3}
                className="w-full bg-[#13131b] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#c0c1ff]/50 resize-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#c6c5d7] mb-1">Git Repository URL (optional)</label>
              <input
                value={form.repoUrl}
                onChange={(e) => setForm({ ...form, repoUrl: e.target.value })}
                placeholder="https://github.com/username/project"
                className="w-full bg-[#13131b] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#c0c1ff]/50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#c6c5d7] mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value, progress: e.target.value === 'completed' ? 100 : form.progress })}
                className="w-full bg-[#13131b] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#c0c1ff]/50 styled-select !bg-[#13131b]"
              >
                <option value="ongoing">Ongoing</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#c6c5d7] mb-1">Level</label>
              <select
                value={form.level}
                onChange={(e) => setForm({ ...form, level: e.target.value })}
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
                value={form.progress}
                onChange={(e) => setForm({ ...form, progress: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                className="w-full bg-[#13131b] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#c0c1ff]/50"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            <button
              onClick={handleAdd}
              disabled={!form.title.trim() || adding}
              className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#5b5fef] to-[#3cd7ff] text-white text-sm font-semibold hover:opacity-90 transition-all cursor-pointer disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add Project
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-[#c6c5d7] text-sm font-semibold hover:bg-white/10 transition-all cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {(['all', 'ongoing', 'completed'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              filter === f
                ? 'bg-[#5b5fef]/25 text-[#c0c1ff] border border-[#c0c1ff]/40'
                : 'bg-white/5 text-[#c6c5d7] border border-white/10 hover:text-white'
            }`}
          >
            {f === 'all' ? 'All' : f[0].toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {err && !suggesting && (
        <div className="mb-4 px-4 py-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
          {err}
        </div>
      )}

      {/* Skill selection modal */}
      {showSkillModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="bg-[#181824] border border-white/10 rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#3cd7ff]" /> Choose Your Skills
              </h3>
              <button onClick={() => setShowSkillModal(false)} className="text-[#c6c5d7] hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="px-5 py-3 text-xs text-[#c6c5d7] border-b border-white/5">
              Search or pick the skills the AI should consider. Only skills with mastery above 20% are eligible.
            </p>
            <div className="px-5 py-3 border-b border-white/5">
              <div className="relative">
                <input
                  type="text"
                  value={skillSearch}
                  onChange={(e) => setSkillSearch(e.target.value)}
                  placeholder="Search skills... (e.g. DSA, Python)"
                  className="w-full bg-[#13131b] border border-white/10 rounded-lg px-3 py-2.5 pr-9 text-sm text-white focus:outline-none focus:border-[#c0c1ff]/50 placeholder-[#6b6b7d]"
                />
                <Search className="w-4 h-4 text-[#908fa0] absolute right-3 top-3 pointer-events-none" />
              </div>
            </div>
            <div className="overflow-y-auto px-5 py-4 space-y-2 flex-1">
              <button
                onClick={toggleAny}
                className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  selectAny
                    ? 'bg-[#5b5fef]/15 border-[#c0c1ff]/40 text-white'
                    : 'bg-white/[0.03] border-white/10 text-[#c6c5d7] hover:border-white/25'
                }`}
              >
                <span className="text-sm font-semibold">Any</span>
                <span className="flex items-center gap-2 text-xs">
                  <span className="text-[#3cd7ff] font-bold">{allSkills.filter((s) => (s.mastery ?? s.percentage ?? 0) > 20).length} eligible</span>
                  <span className={`w-4 h-4 rounded border flex items-center justify-center ${selectAny ? 'bg-[#5b5fef] border-[#5b5fef]' : 'border-[#464555]'}`}>
                    {selectAny && <Check className="w-3 h-3 text-white" />}
                  </span>
                </span>
              </button>
              {allSkills.length === 0 ? (
                <p className="text-sm text-[#c6c5d7] text-center py-6">
                  No skills found. Add skills from the Compare screen first.
                </p>
              ) : (
                allSkills
                  .filter((s) => s.name.toLowerCase().includes(skillSearch.trim().toLowerCase()))
                  .map((s) => {
                    const eligible = (s.mastery ?? s.percentage ?? 0) > 20;
                    const disabled = !eligible || selectAny;
                    const checked = selectedSkills.includes(s.name);
                    return (
                      <button
                        key={s.id}
                        onClick={() => !disabled && toggleSkill(s.name)}
                        disabled={disabled}
                        className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          disabled
                            ? 'bg-white/[0.02] border-white/5 text-[#6b6b7d] opacity-60 cursor-not-allowed'
                            : checked
                              ? 'bg-[#5b5fef]/15 border-[#c0c1ff]/40 text-white'
                              : 'bg-white/[0.03] border-white/10 text-[#c6c5d7] hover:border-white/25'
                        }`}
                      >
                        <span className="text-sm font-semibold">{s.name}</span>
                        <span className="flex items-center gap-2 text-xs">
                          {!eligible && selectAny ? '' : !eligible && <span className="text-[10px] text-[#6b6b7d]">low mastery</span>}
                          {selectAny && eligible && <span className="text-[10px] text-[#6b6b7d]">deselect Any first</span>}
                          <span className="text-[#3cd7ff] font-bold">{s.mastery}%</span>
                          <span className={`w-4 h-4 rounded border flex items-center justify-center ${checked ? 'bg-[#5b5fef] border-[#5b5fef]' : 'border-[#464555]'}`}>
                            {checked && <Check className="w-3 h-3 text-white" />}
                          </span>
                        </span>
                      </button>
                    );
                  })
              )}
            </div>
            <div className="px-5 py-4 border-t border-white/10 flex items-center justify-between gap-3">
              <span className="text-xs text-[#c6c5d7]">
                {selectAny ? 'Any' : `${selectedSkills.length} selected`}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowSkillModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 border border-white/15 text-[#c6c5d7] text-xs font-semibold hover:bg-white/10 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={generateRecommendations}
                  disabled={!selectAny && !selectedSkills.length}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#5b5fef] to-[#3cd7ff] text-white text-xs font-semibold hover:opacity-90 transition-all cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Generate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI recommendation panel */}
      {showRecommend && (
        <div className="glass-card rounded-2xl p-6 mb-8 border-[#c0c1ff]/30">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#3cd7ff]" /> AI Recommended Projects
            </h3>
            <button onClick={() => setShowRecommend(false)} className="text-[#c6c5d7] hover:text-white cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
          {suggesting ? (
            <div className="flex items-center gap-3 text-sm text-[#c6c5d7] py-6 justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-[#3cd7ff]" /> Generating recommendations from your skills…
            </div>
          ) : suggestions.length === 0 ? (
            <p className="text-sm text-[#c6c5d7] py-4">No suggestions yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {suggestions.map((s, idx) => (
                <div key={idx} className="bg-white/5 rounded-xl p-4 border border-white/10 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-bold text-white leading-snug">{s.title}</h4>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#007c96]/80 text-[#edf9ff] shrink-0">{s.level}</span>
                  </div>
                  <p className="text-xs text-[#c6c5d7] leading-relaxed">{s.description}</p>
                  <div className="flex flex-wrap gap-1.5 mt-auto">
                    {(s.skillsUsed || []).slice(0, 6).map((sk) => (
                      <span key={sk} className="text-[10px] px-2 py-0.5 rounded-full bg-[#5b5fef]/15 border border-[#c0c1ff]/30 text-[#c0c1ff]">{sk}</span>
                    ))}
                  </div>
                  <button
                    onClick={() => saveSuggestion(s)}
                    className="mt-2 w-full px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add to my projects
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Projects grid */}
      {loading ? (
        <div className="text-center py-20 text-sm text-[#c6c5d7]">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="glass-card rounded-2xl p-14 flex flex-col items-center justify-center text-center border border-dashed border-[#464555]">
          <FolderGit2 className="w-14 h-14 text-[#3cd7ff] mb-4" />
          <h3 className="text-lg font-bold text-white mb-1">No projects here</h3>
          <p className="text-sm text-[#c6c5d7] max-w-sm">
            {filter === 'all' ? 'Add your first project or use AI Recommendations to get ideas.' : `No ${filter} projects.`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((p) => (
            <div key={p.id} className="glass-card rounded-2xl overflow-hidden group hover:border-[#3cd7ff]/40 transition-all">
              <div className="h-36 relative bg-gradient-to-br from-[#1b1b23] to-[#292932] overflow-hidden">
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.title} className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[#5b5fef]/25 to-[#3cd7ff]/15 flex items-center justify-center">
                    <Rocket className="w-12 h-12 text-[#c0c1ff]/40" />
                  </div>
                )}
                {p.recommendedByAi && (
                  <span className="absolute top-3 left-3 bg-[#5b5fef]/90 text-white px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> AI Recommended
                  </span>
                )}
                <span className="absolute top-3 right-3 bg-[#007c96]/80 text-[#edf9ff] px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">{p.level}</span>
              </div>
              <div className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-bold text-white text-base">{p.title}</h4>
                  {p.repoUrl && (
                    <a href={p.repoUrl} target="_blank" rel="noreferrer" className="text-[#c0c1ff] hover:text-[#3cd7ff] transition-colors shrink-0" title="View repository">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
                <p className="text-xs text-[#c6c5d7] line-clamp-2 leading-relaxed">{p.description}</p>

                {/* progress bar */}
                <div className="flex items-center gap-2 text-[10px] text-[#c6c5d7]">
                  <div className="flex-1 h-1.5 bg-[#292932] rounded-full overflow-hidden">
                    <div className={`h-full ${p.status === 'completed' ? 'bg-emerald-500' : 'bg-gradient-to-r from-[#5b5fef] to-[#3cd7ff]'}`} style={{ width: `${Math.min(100, p.progress)}%` }} />
                  </div>
                  <span>{p.progress}%</span>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[#3cd7ff] text-xs font-semibold">{p.status === 'completed' ? 'Completed' : 'Ongoing'}</span>
                  <button
                    onClick={() => toggleStatus(p)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                      p.status === 'completed'
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
                        : 'bg-[#5b5fef]/15 text-[#c0c1ff] border border-[#5b5fef]/30 hover:bg-[#5b5fef]/25'
                    }`}
                  >
                    {p.status === 'completed' ? <><CheckCircle2 className="w-3 h-3" /> Done</> : <span className="flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Mark Complete</span>}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
};