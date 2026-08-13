import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Mail, Lock, UserPlus, ArrowRight, Brain, Github, Linkedin, Target, Hash, Check, X, Clock, Loader2 } from 'lucide-react';
import { api, AuthUser } from '../api';

interface SignupScreenProps {
  onSuccess: (user: AuthUser) => void;
  onSwitchToLogin: () => void;
}

const BRANCHES = ['CSE', 'CSE (AI/ML)', 'ECE', 'Electrical', 'Mechanical', 'Civil', 'IT'];
const SEMESTERS = ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4', 'Sem 5', 'Sem 6', 'Sem 7', 'Sem 8'];

const LiveClock: React.FC = () => {
  const [t, setT] = useState(() => new Date());
  useEffect(() => {
    const i = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(i);
  }, []);
  return (
    <div className="flex items-center justify-center gap-2 mb-5">
      <Clock className="w-4 h-4 text-[#3cd7ff]" />
      <span className="text-[11px] text-[#c6c5d7] font-semibold tabular-nums">
        {t.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
      </span>
      <span className="w-px h-3 bg-white/15" />
      <span className="text-sm font-bold text-[#3cd7ff] tabular-nums">
        {t.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
      </span>
    </div>
  );
};

export const SignupScreen: React.FC<SignupScreenProps> = ({ onSuccess, onSwitchToLogin }) => {
  const [form, setForm] = useState({
    username: '', email: '', password: '', confirm: '',
    rollNo: '',
    name: '', branch: 'CSE', semester: 'Sem 1', targetRole: '',
    targetCgpa: '', targetCompanyType: '', targetCompanyName: '',
    workType: '', timelineCurrent: 'This Semester', timelineNext: 'Next Semester',
    githubUrl: '', linkedinUrl: '', resumeFileName: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'invalid' | 'checking' | 'available' | 'taken'>('idle');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const resumeRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const u = form.username.trim();
    if (!u) { setUsernameStatus('idle'); setSuggestions([]); return; }
    if (!/^[A-Za-z0-9_.-]{3,30}$/.test(u)) { setUsernameStatus('invalid'); setSuggestions([]); return; }
    setUsernameStatus('checking');
    const t = setTimeout(async () => {
      try {
        const r = await api.checkUsername(u);
        if (form.username.trim() !== u) return;
        setUsernameStatus(r.available ? 'available' : 'taken');
        setSuggestions(r.suggestions || []);
      } catch {
        setUsernameStatus('idle');
      }
    }, 400);
    return () => clearTimeout(t);
  }, [form.username]);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim());
  const emailTyped = form.email.trim().length > 0;

  const pw = form.password;
  const pwChecks = [
    { ok: pw.length >= 8 && pw.length <= 128, label: 'Min 8 characters' },
    { ok: /[A-Z]/.test(pw), label: '1 capital letter (A-Z)' },
    { ok: /[a-z]/.test(pw), label: '1 small letter (a-z)' },
    { ok: /[0-9]/.test(pw), label: '1 number (0-9)' },
    { ok: /[^A-Za-z0-9]/.test(pw), label: '1 symbol (!@#$...) ' },
  ];
  const pwTyped = pw.length > 0;
  const confirmTyped = form.confirm.length > 0;
  const confirmOk = confirmTyped && form.confirm === pw;

  const showError = (msg: string) => {
    setError(msg);
    setTimeout(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleResume = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setForm((f) => ({ ...f, resumeFileName: file.name }));
    try {
      const dataUri = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onloadend = () => resolve(String(r.result));
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      const uploaded = await api.uploadFile(dataUri, file.name);
      await api.uploadResume(uploaded.url, file.name);
    } catch (err) {
      console.error('Resume upload failed (you can add it later)', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) { showError('Passwords do not match'); return; }
    if (form.password.length < 8) { showError('Password must be at least 8 characters'); return; }
    if (!/[A-Z]/.test(form.password)) { showError('Password must contain at least 1 capital letter'); return; }
    if (!/[a-z]/.test(form.password)) { showError('Password must contain at least 1 small letter'); return; }
    if (!/[0-9]/.test(form.password)) { showError('Password must contain at least 1 number'); return; }
    if (!/[^A-Za-z0-9]/.test(form.password)) { showError('Password must contain at least 1 symbol (e.g. !@#$%^&*)'); return; }
    if (!form.targetRole.trim()) { showError('Set your target role to get better recommendations'); return; }

    setIsLoading(true);
    try {
      const res = await api.register(form.username, form.email, form.password, form.rollNo);
      sessionStorage.setItem('campusai_token', res.token);
      sessionStorage.setItem('campusai_user', JSON.stringify(res.user));
      localStorage.removeItem('campusai_token');
      localStorage.removeItem('campusai_user');
      // persist the captured profile details
      await api.updateProfile({
        name: form.username, branch: form.branch, semester: form.semester,
        targetRole: form.targetRole, targetCgpa: form.targetCgpa,
        targetCompanyType: form.targetCompanyType, targetCompanyName: form.targetCompanyName,
        timelineCurrent: form.timelineCurrent, timelineNext: form.timelineNext,
        workType: form.workType, githubUrl: form.githubUrl, linkedinUrl: form.linkedinUrl,
      }).catch((err: any) => console.error('Profile save (proceed anyway):', err.message));
      onSuccess(res.user);
    } catch (err: any) {
      showError(err.message || 'Signup failed');
    } finally {
      setIsLoading(false);
    }
  };

  const subtitle =
    form.workType === 'job'
      ? `Aim for: ${form.targetRole || 'your role'} · CGPA ${form.targetCgpa || '—'} · ${form.targetCompanyName || 'top tech firms'}`
      : 'Set your targets to personalize your AI roadmap.';

  return (
    <div className="min-h-screen bg-[#13131b] text-[#e4e1ed] relative overflow-hidden flex items-start justify-center px-4 py-10">
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#5b5fef]/15 rounded-full blur-[140px]" />
        <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-[#3cd7ff]/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-2xl">
        <div className="flex items-center justify-center gap-2 mb-6">
          <Sparkles className="w-8 h-8 text-[#c0c1ff]" />
          <span className="font-bold text-2xl bg-clip-text text-transparent bg-gradient-to-r from-[#c0c1ff] to-[#3cd7ff]">
            CampusAI Mentor
          </span>
        </div>

        <LiveClock />

        <div className="glass-card rounded-3xl p-8 sm:p-10 border border-white/10 shadow-[0_0_40px_rgba(192,193,255,0.15)]">
          <div className="mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card border border-white/10 text-xs font-semibold text-[#c0c1ff]">
            <Brain className="w-4 h-4 text-[#3cd7ff] animate-pulse" />
            <span>MBM University · Create your student account</span>
          </div>

          <h1 className="text-3xl font-extrabold text-white mb-2">Sign Up</h1>
          <p className="text-sm text-[#c6c5d7] mb-8">Set up your academic profile and career targets to get personalized mentoring.</p>

          {error && (
            <div ref={errorRef} className="mb-4 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm font-medium scroll-mt-24">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Account */}
            <fieldset className="space-y-4">
              <legend className="text-xs font-bold uppercase tracking-wider text-[#3cd7ff] mb-1">Account</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Username *</Label>
                  <div className="relative">
                    <UserIcon />
                    <input type="text" value={form.username} onChange={set('username')} placeholder="Unique username" required className="input" />
                    {usernameStatus === 'checking' && (
                      <Loader2 className="w-4 h-4 text-[#3cd7ff] absolute right-4 top-1/2 -translate-y-1/2 animate-spin" />
                    )}
                    {usernameStatus === 'available' && (
                      <Check className="w-4 h-4 text-emerald-400 absolute right-4 top-1/2 -translate-y-1/2" />
                    )}
                    {usernameStatus === 'taken' && (
                      <X className="w-4 h-4 text-rose-400 absolute right-4 top-1/2 -translate-y-1/2" />
                    )}
                  </div>
                  {usernameStatus === 'invalid' && (
                    <p className="text-[10px] text-amber-400 mt-1.5">3-30 characters, sirf letters, numbers, _ . -</p>
                  )}
                  {usernameStatus === 'available' && (
                    <p className="text-[10px] text-emerald-400 mt-1.5">Username available ✓</p>
                  )}
                  {usernameStatus === 'taken' && (
                    <div className="mt-1.5">
                      <p className="text-[10px] text-rose-400">Username already taken — try one of these:</p>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {suggestions.map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setForm((f) => ({ ...f, username: s }))}
                            className="px-2.5 py-1 rounded-full bg-[#5b5fef]/15 border border-[#5b5fef]/40 text-[10px] font-bold text-[#c0c1ff] hover:bg-[#5b5fef]/30 transition-all cursor-pointer"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <Label>Email *</Label>
                  <div className="relative">
                    <MailIcon />
                    <input type="email" value={form.email} onChange={set('email')} placeholder="you@example.com" required className="input" />
                    {emailTyped && (
                      emailOk
                        ? <Check className="w-4 h-4 text-emerald-400 absolute right-4 top-1/2 -translate-y-1/2" />
                        : <X className="w-4 h-4 text-rose-400 absolute right-4 top-1/2 -translate-y-1/2" />
                    )}
                  </div>
                  {emailTyped && !emailOk && (
                    <p className="text-[10px] text-rose-400 mt-1.5">Email format galat hai — e.g. name@college.edu</p>
                  )}
                </div>
                <div>
                  <Label>Roll Number *</Label>
                  <div className="relative">
                    <HashIcon />
                    <input type="text" value={form.rollNo} onChange={set('rollNo')} placeholder="e.g. 21CS1234" required className="input" />
                  </div>
                </div>
                <div>
                  <Label>Password *</Label>
                  <div className="relative">
                    <LockIcon />
                    <input type="password" value={form.password} onChange={set('password')} placeholder="Min 8 chars · Aa1@ symbol" required className="input" />
                  </div>
                  {pwTyped && (
                    <div className="mt-1.5 space-y-0.5">
                      {pwChecks.map((c) => (
                        <p key={c.label} className={`text-[10px] flex items-center gap-1 ${c.ok ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {c.ok ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                          {c.label}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <Label>Confirm Password *</Label>
                  <div className="relative">
                    <LockIcon />
                    <input type="password" value={form.confirm} onChange={set('confirm')} placeholder="Re-enter password" required className="input" />
                    {confirmTyped && (
                      confirmOk
                        ? <Check className="w-4 h-4 text-emerald-400 absolute right-4 top-1/2 -translate-y-1/2" />
                        : <X className="w-4 h-4 text-rose-400 absolute right-4 top-1/2 -translate-y-1/2" />
                    )}
                  </div>
                  {confirmTyped && !confirmOk && (
                    <p className="text-[10px] text-rose-400 mt-1.5">Passwords match nahi kar rahe</p>
                  )}
                </div>
              </div>
            </fieldset>

            {/* Academic */}
            <fieldset className="space-y-4">
              <legend className="text-xs font-bold uppercase tracking-wider text-[#3cd7ff]">Academic</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Branch</Label>
                  <select value={form.branch} onChange={set('branch')} className="styled-select w-full !py-3">
                    {BRANCHES.map((b) => <option key={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Semester</Label>
                  <select value={form.semester} onChange={set('semester')} className="styled-select w-full !py-3">
                    {SEMESTERS.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </fieldset>

            {/* Targets */}
            <fieldset className="space-y-4">
              <legend className="text-xs font-bold uppercase tracking-wider text-[#3cd7ff] flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5" /> Career Targets
              </legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Label>Target Role *</Label>
                  <input type="text" value={form.targetRole} onChange={set('targetRole')} placeholder="e.g. Software Engineer, Data Scientist" className="input" />
                </div>
                <div>
                  <Label>Target CGPA</Label>
                  <input type="text" value={form.targetCgpa} onChange={set('targetCgpa')} placeholder="e.g. 8.5" className="input" />
                </div>
                <div>
                  <Label>Target Company Type</Label>
                  <input type="text" value={form.targetCompanyType} onChange={set('targetCompanyType')} placeholder="Startup / MNC / Product" className="input" />
                </div>
                <div>
                  <Label>Target Company Name (optional)</Label>
                  <input type="text" value={form.targetCompanyName} onChange={set('targetCompanyName')} placeholder="e.g. Microsoft" className="input" />
                </div>
                <div>
                  <Label>Internship or Full-time?</Label>
                  <select value={form.workType} onChange={set('workType')} className="styled-select w-full !py-3">
                    <option value="">Not sure yet</option>
                    <option value="internship">Internship</option>
                    <option value="job">Full-time job</option>
                  </select>
                </div>
              </div>

              <div className="px-4 py-3 rounded-xl bg-[#5b5fef]/10 border border-[#5b5fef]/20 text-xs text-[#c6c5d7]">
                {subtitle}
              </div>
            </fieldset>

            {/* Links + Resume */}
            <fieldset className="space-y-4">
              <legend className="text-xs font-bold uppercase tracking-wider text-[#3cd7ff]">Links & Resume (optional)</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>GitHub URL</Label>
                  <div className="relative">
                    <GitHubIcon />
                    <input type="text" value={form.githubUrl} onChange={set('githubUrl')} placeholder="https://github.com/you" className="input" />
                  </div>
                </div>
                <div>
                  <Label>LinkedIn URL</Label>
                  <div className="relative">
                    <LinkedInIcon />
                    <input type="text" value={form.linkedinUrl} onChange={set('linkedinUrl')} placeholder="https://linkedin.com/in/you" className="input" />
                  </div>
                </div>
              </div>

              <button type="button" onClick={() => resumeRef.current?.click()} className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-left text-xs text-[#c6c5d7] hover:bg-white/10 transition-all cursor-pointer">
                <span className="font-semibold text-white">{form.resumeFileName || 'Upload resume (PDF/DOCX)'} · optional</span>
              </button>
              <input type="file" ref={resumeRef} onChange={handleResume} accept=".pdf,.docx" className="hidden" />
            </fieldset>

            <button type="submit" disabled={isLoading} className="w-full py-3.5 rounded-full bg-gradient-to-r from-[#5b5fef] to-[#3cd7ff] text-white font-semibold text-sm shadow-[0_0_25px_rgba(192,193,255,0.3)] hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer">
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Creating account...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Create Free Account</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-[#c6c5d7]">
              Already have an account?{' '}
              <button onClick={onSwitchToLogin} className="text-[#3cd7ff] font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer">
                <span>Login</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-semibold text-[#c6c5d7] uppercase tracking-wider mb-2">{children}</label>;
}
function UserIcon() { return <UserPlus className="w-5 h-5 text-[#c0c1ff] absolute left-4 top-1/2 -translate-y-1/2" />; }
function MailIcon() { return <Mail className="w-5 h-5 text-[#c0c1ff] absolute left-4 top-1/2 -translate-y-1/2" />; }
function HashIcon() { return <Hash className="w-5 h-5 text-[#c0c1ff] absolute left-4 top-1/2 -translate-y-1/2" />; }
function LockIcon() { return <Lock className="w-5 h-5 text-[#c0c1ff] absolute left-4 top-1/2 -translate-y-1/2" />; }
function GitHubIcon() { return <Github className="w-5 h-5 text-[#c0c1ff] absolute left-4 top-1/2 -translate-y-1/2" />; }
function LinkedInIcon() { return <Linkedin className="w-5 h-5 text-[#c0c1ff] absolute left-4 top-1/2 -translate-y-1/2" />; }