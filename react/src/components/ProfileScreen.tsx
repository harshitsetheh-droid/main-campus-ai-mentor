import React, { useState, useEffect, useRef } from 'react';
import { ScreenType } from '../types';
import {
  CheckCircle2, Edit3, Award, Trophy, Terminal, Rocket,
  Code, ExternalLink, Plus, X, Save, Upload, Sparkles,
  Lock, Github, Linkedin, Check, AlertCircle
} from 'lucide-react';
import { api, ProfileResponse, SkillProject, Certificate } from '../api';

interface ProfileScreenProps {
  onNavigate: (screen: ScreenType, transition?: 'none' | 'push' | 'slide_up') => void;
}

const LOCKED_INSTITUTION = 'MBM University, Jodhpur';

const STARTER_SKILLS = [
  { category: 'Core CS' },
  { category: 'DSA' },
  { category: 'Languages' },
  { category: 'DevOps & Cloud' },
];

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ onNavigate }) => {
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [skills, setSkills] = useState<ProfileResponse['skills']>([]);
  const [projects, setProjects] = useState<SkillProject[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [codingProfiles, setCodingProfiles] = useState<ProfileResponse['codingProfiles']>([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: '', branch: '', semester: '', targetRole: '', targetCgpa: '',
    targetCompanyType: '', targetCompanyName: '', workType: '',
    timelineCurrent: '', timelineNext: '', githubUrl: '', linkedinUrl: '',
    phone: '',
  });

  // add skill
  const [showAddSkill, setShowAddSkill] = useState(false);
  const [newSkill, setNewSkill] = useState({ name: '', category: 'Core CS', platform: '', totalQuestions: 0 });
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleanupMsg, setCleanupMsg] = useState<string | null>(null);

  // coding profile
  const [showAddCoding, setShowAddCoding] = useState(false);
  const [newCoding, setNewCoding] = useState({ name: '', url: '', platform: 'coding' });

  const [photoError, setPhotoError] = useState('');
  const photoFileRef = useRef<HTMLInputElement>(null);

  const loadProfile = () => {
    api.getProfile()
      .then((res) => {
        setData(res);
        setSkills(res.skills);
        setProjects(res.projects);
        setCertificates(res.certificates);
        setCodingProfiles(res.codingProfiles);
        setForm({
          name: res.profile.name,
          branch: res.profile.branch,
          semester: res.profile.semester,
          targetRole: res.profile.targetRole,
          targetCgpa: res.profile.targetCgpa,
          targetCompanyType: res.profile.targetCompanyType,
          targetCompanyName: res.profile.targetCompanyName,
          timelineCurrent: res.profile.timelineCurrent,
          timelineNext: res.profile.timelineNext,
          workType: '',
          githubUrl: res.profile.githubUrl,
          linkedinUrl: res.profile.linkedinUrl,
          phone: (res.profile as any).phone || '',
        });
      })
      .catch((err) => console.error('Failed to load profile', err));
  };

  useEffect(() => { loadProfile(); }, []);

  const handleSaveProfile = async () => {
    try {
      await api.updateProfile(form);
      setEditing(false);
      loadProfile();
    } catch (err) {
      console.error('Failed to save profile', err);
    }
  };

  const handleAddSkill = async () => {
    if (!newSkill.name.trim()) return;
    try {
      await api.addSkill(newSkill.name.trim().toUpperCase(), newSkill.category, newSkill.platform, 4);
      setNewSkill({ name: '', category: 'Core CS', platform: '', totalQuestions: 0 });
      setShowAddSkill(false);
      loadProfile();
    } catch (err) { console.error('Failed to add skill', err); }
  };

  const handleDeleteSkill = async (id: string) => {
    try {
      await api.deleteSkill(id);
      loadProfile();
    } catch (err) { console.error('Failed to delete skill', err); }
  };

  const handleCleanupSkills = async () => {
    if (isCleaning) return;
    setIsCleaning(true);
    setCleanupMsg(null);
    try {
      const res = await api.cleanupSkills();
      setCleanupMsg(`Removed ${res.deleted} duplicate/overlapping skill(s): ${(res.deletedSkills || []).join(', ') || 'none'}`);
      loadProfile();
    } catch (err: any) {
      setCleanupMsg('Cleanup failed: ' + (err.message || 'unknown error'));
    } finally {
      setIsCleaning(false);
    }
  };

  const handleAddCoding = async () => {
    if (!newCoding.name.trim() || !newCoding.url.trim()) return;
    try {
      await api.addCodingProfile(newCoding.name.trim(), newCoding.url.trim(), newCoding.platform);
      setNewCoding({ name: '', url: '', platform: 'github' });
      setShowAddCoding(false);
      loadProfile();
    } catch (err: any) { console.error(err.message || 'Failed to add coding profile'); }
  };

  const handleDeleteCoding = async (id: string) => {
    try {
      await api.deleteCodingProfile(id);
      loadProfile();
    } catch (err) { console.error(err); }
  };

  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError('');
    try {
      const dataUri = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onloadend = () => resolve(String(r.result));
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      const uploaded = await api.uploadFile(dataUri, file.name);
      await api.updateProfile({ photoUrl: uploaded.url });
      loadProfile();
    } catch (err: any) {
      console.error('Photo upload failed', err);
      setPhotoError(err.message || 'Photo upload failed. Please try again.');
    }
  };

  const profile = data?.profile;

  return (
    <main className="pt-24 pb-24 px-4 max-w-7xl mx-auto">
      {/* Profile Header */}
      <section className="glass-card rounded-2xl p-6 md:p-8 mb-8 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-[#5b5fef]/10 rounded-full blur-[80px]" />

        <div className="flex flex-col md:flex-row items-center gap-6 relative z-10">
          {/* Avatar with upload */}
          <div className="relative">
            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full border-2 border-[#5b5fef] p-1 ring-4 ring-[#5b5fef]/20 shadow-[0_0_25px_rgba(91,95,239,0.3)]">
              {profile?.photoUrl ? (
                <img src={profile.photoUrl} alt="Profile" className="w-full h-full object-cover rounded-full" />
              ) : (
                <div className="w-full h-full rounded-full bg-gradient-to-br from-[#5b5fef] to-[#3cd7ff] flex items-center justify-center text-3xl font-bold text-white uppercase">
                  {(profile?.name || '').charAt(0)}
                </div>
              )}
            </div>
            <button
              onClick={() => photoFileRef.current?.click()}
              className="absolute bottom-1 right-1 bg-[#3cd7ff] text-[#001f27] p-2 rounded-full flex items-center justify-center hover:scale-110 transition-transform cursor-pointer"
              title="Upload photo"
            >
              <Upload className="w-3.5 h-3.5" />
            </button>
            <input type="file" ref={photoFileRef} onChange={handleUploadPhoto} accept="image/*" className="hidden" />
          </div>

          {photoError && (
            <div className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{photoError}</span>
            </div>
          )}

          <div className="text-center md:text-left flex-1">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-1 flex items-center justify-center md:justify-start gap-2">
              {profile?.name || ''}
              <CheckCircle2 className="w-5 h-5 text-[#3cd7ff] fill-current" />
            </h2>
            <p className="text-base text-[#c6c5d7] mb-3 flex items-center justify-center md:justify-start gap-1.5">
              <Lock className="w-3.5 h-3.5 text-[#5b5fef]" /> {LOCKED_INSTITUTION}
            </p>

            <div className="flex flex-wrap justify-center md:justify-start gap-2">
              {profile?.branch && (
                <span className="bg-[#292932] px-3.5 py-1 rounded-full text-xs font-semibold text-[#c6c5d7] border border-white/5">
                  {profile.branch}
                  {profile.semester ? ` · ${profile.semester}` : ''}
                </span>
              )}
              <span className="bg-[#5b5fef]/20 text-[#c0c1ff] px-3.5 py-1 rounded-full text-xs font-semibold border border-[#5b5fef]/30">
                Target: {profile?.targetRole || 'Set your target role'}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col gap-3 w-full sm:w-auto">
            <button
              onClick={() => setEditing(!editing)}
              className="primary-gradient text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:opacity-95 transition-all active:scale-95 flex items-center justify-center gap-2 shadow-md cursor-pointer"
            >
              <Edit3 className="w-4 h-4" />
              <span>{editing ? 'Cancel Edit' : 'Edit Profile'}</span>
            </button>
          </div>
        </div>

        {/* Edit form */}
        {editing && (
          <div className="relative z-10 mt-8 p-6 bg-[#1b1b26] rounded-2xl border border-white/10 space-y-4">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-[#c0c1ff]" /> <span>Edit Profile & Target Details</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Full Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
              <Field label="Branch" value={form.branch} onChange={(v) => setForm({ ...form, branch: v })} />
              <Field label="Semester" value={form.semester} onChange={(v) => setForm({ ...form, semester: v })} />
              <Field label="Target Role" value={form.targetRole} onChange={(v) => setForm({ ...form, targetRole: v })} />
              <Field label="Target CGPA" value={form.targetCgpa} onChange={(v) => setForm({ ...form, targetCgpa: v })} />
              <Field label="Target Company Type (Startup / MNC / Product)" value={form.targetCompanyType} onChange={(v) => setForm({ ...form, targetCompanyType: v })} />
              <Field label="Target Company Name" value={form.targetCompanyName} onChange={(v) => setForm({ ...form, targetCompanyName: v })} />
              <Field label="Timeline (Current Semester)" value={form.timelineCurrent} onChange={(v) => setForm({ ...form, timelineCurrent: v })} />
              <Field label="Timeline (Next Semester)" value={form.timelineNext} onChange={(v) => setForm({ ...form, timelineNext: v })} />
              <Field label="GitHub URL" value={form.githubUrl} onChange={(v) => setForm({ ...form, githubUrl: v })} />
              <Field label="LinkedIn URL" value={form.linkedinUrl} onChange={(v) => setForm({ ...form, linkedinUrl: v })} />
              <Field label="Phone Number" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
            </div>
            <button onClick={handleSaveProfile}
              className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-[#5b5fef] to-[#3cd7ff] text-white text-sm font-semibold flex items-center gap-2 hover:opacity-90 transition-all cursor-pointer">
              <Check className="w-4 h-4" /> <span>Save Changes</span>
            </button>
          </div>
        )}
      </section>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <div className="glass-card rounded-2xl p-6 flex flex-col items-center justify-center text-center">
          <Award className="w-10 h-10 text-[#3cd7ff] mb-2" />
          <span className="text-4xl font-bold text-[#3cd7ff] mb-1">{certificates.length}</span>
          <span className="text-xs text-[#c6c5d7] uppercase tracking-widest font-semibold">Certificates</span>
        </div>
        <div className="glass-card rounded-2xl p-6 flex flex-col items-center justify-center text-center">
          <Trophy className="w-10 h-10 text-[#cdbdff] mb-2" />
          <span className="text-4xl font-bold text-[#cdbdff] mb-1">{projects.filter((p) => p.status === 'completed').length}</span>
          <span className="text-xs text-[#c6c5d7] uppercase tracking-widest font-semibold">Projects Done</span>
        </div>
        <div className="glass-card rounded-2xl p-6 flex flex-col items-center justify-center text-center relative overflow-hidden">
          <Terminal className="w-10 h-10 text-[#c0c1ff] mb-2" />
          <span className="text-4xl font-bold text-[#c0c1ff] mb-1">{skills.length}</span>
          <span className="text-xs text-[#c6c5d7] uppercase tracking-widest font-semibold">Skill Score</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Technical Skills */}
          <section className="glass-card rounded-2xl p-6 sm:p-8">
            <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
              <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                <Terminal className="w-5 h-5 text-[#c0c1ff]" /> <span>Technical Skills</span>
              </h3>
              <button
                onClick={handleCleanupSkills}
                disabled={isCleaning}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#5b5fef]/20 border border-[#c0c1ff]/40 text-[#c0c1ff] hover:bg-[#5b5fef] hover:text-white transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" /> {isCleaning ? 'Cleaning…' : 'Clean duplicates'}
              </button>
            </div>

            {cleanupMsg && (
              <div className="mb-4 px-4 py-2.5 rounded-lg bg-[#5b5fef]/15 border border-[#5b5fef]/40 text-xs text-[#c6c5d7]">
                {cleanupMsg}
              </div>
            )}

            {skills.length === 0 && (
              <div className="text-center py-10 border border-dashed border-[#464555] rounded-xl">
                <p className="text-sm text-[#c6c5d7] mb-4">No skills added yet.</p>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              {skills.map((skill) => (
                <div key={skill.id} className="relative px-4 py-2.5 bg-[#292932] rounded-xl border border-white/5 hover:border-[#c0c1ff]/50 transition-all group pr-8">
                  <span className="text-sm font-medium text-white">{skill.name}</span>
                  <div className="flex items-center justify-end gap-2 mt-1 mr-6">
                    <span className="text-[10px] text-[#3cd7ff] font-bold">{skill.mastery}%</span>
                    <span className="text-[10px] text-[#c6c5d7]">{skill.category || 'Skill'}</span>
                  </div>
                  <button
                    onClick={() => handleDeleteSkill(skill.id)}
                    title={`Delete ${skill.name}`}
                    className="absolute top-1/2 -translate-y-1/2 right-2 w-6 h-6 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center cursor-pointer hover:bg-rose-500 hover:text-white transition-all"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {showAddSkill ? (
                <div className="p-3 bg-[#1b1b26] rounded-xl border border-[#c0c1ff]/30 w-full space-y-2 mt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input type="text" value={newSkill.name} onChange={(e) => setNewSkill({ ...newSkill, name: e.target.value.toUpperCase() })} placeholder="Skill name" className="px-3 py-2 bg-[#13131b] text-white text-sm rounded-lg border border-white/10 focus:outline-none uppercase" />
                    <select value={newSkill.category} onChange={(e) => setNewSkill({ ...newSkill, category: e.target.value })} className="styled-select !bg-[#13131b]">
                      {['DSA', 'Languages', 'AI & ML', 'Core CS', 'DevOps & Cloud', 'Web Development', 'Tools'].map((c) => <option key={c}>{c}</option>)}
                    </select>
                    <select value={newSkill.platform} onChange={(e) => setNewSkill({ ...newSkill, platform: e.target.value })} className="styled-select !bg-[#13131b]">
                      <option value="">No DSA platform</option>
                      {['leetcode', 'gfg', 'cf', 'cc', 'tuf'].map((p) => <option key={p} value={p}>{p.toUpperCase()}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleAddSkill} className="px-3 py-1.5 bg-[#5b5fef] text-white text-sm rounded-lg cursor-pointer">Add</button>
                    <button onClick={() => setShowAddSkill(false)} className="px-3 py-1.5 bg-white/10 text-white text-sm rounded-lg cursor-pointer">Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowAddSkill(true)} className="px-4 py-2.5 border border-dashed border-[#464555] text-[#908fa0] rounded-xl text-sm font-medium hover:text-white hover:border-white transition-all flex items-center gap-1.5 cursor-pointer">
                  <Plus className="w-4 h-4" /> <span>Add Skill</span>
                </button>
              )}
            </div>
          </section>

          {/* Projects */}
          <section className="glass-card rounded-2xl p-6 sm:p-8">
            <h3 className="text-xl font-semibold text-white flex items-center gap-2 mb-6">
              <Rocket className="w-5 h-5 text-[#3cd7ff]" /> <span>Projects</span>
            </h3>

            <div className="space-y-4">
              {projects.length === 0 && (
                <div className="text-center py-6 border border-dashed border-[#464555] rounded-xl">
                  <p className="text-sm text-[#c6c5d7]">No projects added. Track them from the Dashboard.</p>
                </div>
              )}
              {projects.map((pr) => (
                <div key={pr.id} className="p-4 bg-white/5 rounded-xl border border-white/5 hover:border-[#c0c1ff]/30 transition-all">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="bg-[#007c96]/30 p-2.5 rounded-lg text-[#3cd7ff]">
                        <Rocket className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{pr.title}</p>
                        <span className="text-[11px] text-[#c6c5d7]">
                          {pr.status === 'completed' ? 'Completed' : `${pr.progress}% in progress`} · {pr.level}
                        </span>
                      </div>
                    </div>
                    {pr.repoUrl && (
                      <a href={pr.repoUrl} target="_blank" rel="noreferrer" className="text-[#c0c1ff] hover:text-[#3cd7ff] flex items-center gap-1 text-xs font-semibold cursor-pointer">
                        Repo <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right Column */}
        <div className="space-y-8">
          {/* Coding Profiles */}
          <section className="glass-card rounded-2xl p-6">
            <h3 className="text-xl font-semibold text-white flex items-center gap-2 mb-6">
              <Code className="w-5 h-5 text-[#cdbdff]" /> <span>Coding Profiles</span>
            </h3>

            <div className="space-y-3">
              {codingProfiles.map((cp) => (
                <div key={cp.id} className="flex items-center justify-between p-3.5 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-all group">
                  <a href={cp.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${cp.platform === 'github' ? 'bg-[#292932] text-white' : cp.platform === 'linkedin' ? 'bg-[#0a66c2]/30 text-[#79b8ff]' : 'bg-[#5b5fef]/20 text-[#c0c1ff]'}`}>
                      {cp.platform === 'github' ? <Github className="w-4 h-4" /> : cp.platform === 'linkedin' ? <Linkedin className="w-4 h-4" /> : <Code className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{cp.name}</p>
                      <p className="text-[10px] text-[#c6c5d7] uppercase">{cp.platform || 'Coding'}</p>
                    </div>
                  </a>
                  <button onClick={() => handleDeleteCoding(cp.id)} className="text-[#c6c5d7] hover:text-rose-400 p-1.5 cursor-pointer" title="Remove">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {codingProfiles.length === 0 && (
                <div className="text-center py-6 border border-dashed border-[#464555] rounded-xl">
                  <p className="text-sm text-[#c6c5d7]">No coding profiles linked. (Max 3: 1 GitHub + 1 LinkedIn + 1 coding platform)</p>
                </div>
              )}
            </div>

            {showAddCoding ? (
              <div className="space-y-2 mt-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <select value={newCoding.platform} onChange={(e) => setNewCoding({ ...newCoding, platform: e.target.value })} className="styled-select !bg-[#13131b]">
                    <option value="github">GitHub</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="coding">Coding platform</option>
                  </select>
                  <input value={newCoding.name} onChange={(e) => setNewCoding({ ...newCoding, name: e.target.value })} placeholder="Profile name" className="col-span-2 px-3 py-2 bg-[#13131b] text-white text-sm rounded-lg border border-white/10 focus:outline-none" />
                </div>
                <input value={newCoding.url} onChange={(e) => setNewCoding({ ...newCoding, url: e.target.value })} placeholder="Profile URL" className="w-full px-3 py-2 bg-[#13131b] text-white text-sm rounded-lg border border-white/10 focus:outline-none" />
                <div className="flex gap-2">
                  <button onClick={handleAddCoding} className="flex-1 px-4 py-2 bg-[#5b5fef]/20 text-[#c0c1ff] border border-[#5b5fef]/30 text-sm rounded-lg font-medium hover:bg-[#5b5fef]/30 transition-all cursor-pointer">Add</button>
                  <button onClick={() => setShowAddCoding(false)} className="px-4 py-2 bg-white/10 text-white text-sm rounded-lg cursor-pointer">Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowAddCoding(!showAddCoding)} className="w-full mt-4 px-4 py-2 bg-[#5b5fef]/20 text-[#c0c1ff] border border-[#5b5fef]/30 text-sm rounded-lg font-medium hover:bg-[#5b5fef]/30 transition-all cursor-pointer flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" /> Link Profile
              </button>
            )}
          </section>
        </div>
      </div>
    </main>
  );
};

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-[#c6c5d7] mb-1">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[#13131b] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#c0c1ff]/50" />
    </div>
  );
}