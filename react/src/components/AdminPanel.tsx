import React, { useState, useEffect } from 'react';
import {
  Users, ShieldCheck, Briefcase, MessageSquare, Trash2, UserPlus,
  UserMinus, Plus, Search, GraduationCap, BookOpen, BarChart3, Save, X, Building2,
  Ban, Eye, ExternalLink, UserCog, Loader2, Mail, Phone, Hash, Target, Globe, Award, FileText, Code2, Users2, MessagesSquare
} from 'lucide-react';
import { api, AdminUser, AdminClub, ManagerClub, ManagerMessage, Drive, CompanyQuestion, CompanyQuestionMeta, Role, FacultyStats, AdminUserDetails, AuthUser } from '../api';

const ROLES: { value: Role; label: string }[] = [
  { value: 'student', label: 'Student' },
  { value: 'placement_officer', label: 'Placement Officer' },
  { value: 'club_manager', label: 'Club Manager' },
  { value: 'faculty', label: 'Faculty' },
  { value: 'super_admin', label: 'Super Admin' },
];

const APP_STATUS_STYLE: Record<string, string> = {
  applied: 'bg-[#5b5fef]/15 text-[#c0c1ff] border border-[#5b5fef]/40',
  waiting: 'bg-amber-500/15 text-amber-300 border border-amber-500/40',
  selected: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40',
  rejected: 'bg-rose-500/15 text-rose-300 border border-rose-500/40',
};

interface AppRow {
  id: number;
  status: string;
  applied_at?: string;
  updated_at?: string;
  user_id: number;
  username: string;
  user_name: string;
  roll_no: string;
  drive_id: number;
  company: string;
  role: string;
  package: string;
  deadline: string;
  drive_status: string;
}

interface Props {
  role: Role;
  username: string;
  tab?: string;
  onTabChange?: (tab: string) => void;
}

export const AdminPanel: React.FC<Props> = ({ role, username, tab: tabProp, onTabChange }) => {
  const [tab, setTabState] = useState<string>(tabProp ?? (role === 'super_admin' ? 'people' : role === 'placement_officer' ? 'placement' : role === 'club_manager' ? 'moderation' : 'faculty'));

  useEffect(() => {
    if (tabProp && tabProp !== tab) setTabState(tabProp);
  }, [tabProp]);

  const setTab = (t: string) => {
    setTabState(t);
    onTabChange?.(t);
  };

  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 3500);
  };

  const tabs: { key: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = [];
  if (role === 'super_admin') tabs.push(
    { key: 'placement', label: 'Placement', icon: Briefcase },
    { key: 'clubs', label: 'Clubs', icon: MessageSquare },
    { key: 'people', label: 'People', icon: Users },
    { key: 'admin', label: 'Admin', icon: ShieldCheck },
    { key: 'profile', label: 'Profile', icon: UserCog }
  );
  if (role === 'placement_officer') tabs.push({ key: 'placement', label: 'Placement', icon: Briefcase });
  if (role === 'club_manager') tabs.push({ key: 'moderation', label: 'My Clubs', icon: ShieldCheck });
  if (role === 'faculty') tabs.push({ key: 'faculty', label: 'Stats', icon: GraduationCap });

  return (
    <main className="pt-20 pb-28 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
      <section className="glass-panel p-6 sm:p-8 rounded-3xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#5b5fef]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#5b5fef]/20 border border-[#5b5fef]/40 text-[#c0c1ff] text-xs font-semibold mb-3">
            <ShieldCheck className="w-3.5 h-3.5 text-[#3cd7ff]" />
            <span>Admin Panel · MBM University</span>
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight flex items-center gap-3 flex-wrap">
            {username}
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#3cd7ff] bg-[#3cd7ff]/10 border border-[#3cd7ff]/40 px-3 py-1.5 rounded-full normal-case">
              {ROLES.find((r) => r.value === role)?.label}
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-[#c6c5d7] mt-1 max-w-2xl">
            Role ke hisaab se sirf relevant controls dikhte hain — students ko kabhi bhi admin tools nahi dikhenge.
          </p>
        </div>
      </section>

      <div className="mt-6 flex gap-2 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer border ${
              tab === t.key
                ? 'bg-[#5b5fef]/20 border-[#5b5fef]/50 text-[#c0c1ff]'
                : 'bg-white/5 border-white/10 text-[#c6c5d7] hover:text-white'
            }`}
          >
            <span className="flex items-center gap-1.5"><t.icon className="w-4 h-4" />{t.label}</span>
          </button>
        ))}
      </div>

      <div className="mt-5">
        {tab === 'people' && role === 'super_admin' && <PeopleTab onToast={showToast} />}
        {tab === 'admin' && role === 'super_admin' && <UsersTab onToast={showToast} />}
        {tab === 'profile' && <ProfileTab username={username} role={role} />}
        {tab === 'clubs' && role === 'super_admin' && <ClubsTab onToast={showToast} />}
        {tab === 'placement' && (role === 'super_admin' || role === 'placement_officer') && <PlacementTab onToast={showToast} />}
        {tab === 'moderation' && (role === 'club_manager' || role === 'super_admin') && <ModerationTab onToast={showToast} />}
        {tab === 'faculty' && (role === 'faculty' || role === 'super_admin' || role === 'placement_officer') && <FacultyTab onToast={showToast} />}
      </div>

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[95] bg-[#1d1d28] border border-[#c0c1ff]/40 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-2xl">
          {toast}
        </div>
      )}
    </main>
  );
};

// ---------------------------------------------------------------- Users (super admin)
function UsersTab({ onToast }: { onToast: (m: string) => void }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(0);

  const load = (query = '') => {
    api.getAdminUsers(query)
      .then((r) => setUsers(r.users || []))
      .catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const changeRole = async (u: AdminUser, role: string) => {
    if (role === u.role) return;
    setBusy(u.id);
    try {
      await api.setUserRole(u.id, role);
      onToast(`${u.username} → ${ROLES.find((r) => r.value === role)?.label}`);
      load(q);
    } catch (err: any) {
      onToast(err.message || 'Role change failed');
    } finally {
      setBusy(0);
    }
  };

  const remove = async (u: AdminUser) => {
    if (!window.confirm(`Delete user "${u.username}"? Ye action wapas nahi hoga (profile, skills, chat sab delete).`)) return;
    setBusy(u.id);
    try {
      await api.deleteUser(u.id);
      onToast(`${u.username} deleted`);
      load(q);
    } catch (err: any) {
      onToast(err.message || 'Delete failed');
    } finally {
      setBusy(0);
    }
  };

  return (
    <div>
      <form onSubmit={(e) => { e.preventDefault(); load(q); }} className="flex gap-2 mb-4">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Username / email / roll search…"
          className="flex-1 min-w-0 bg-[#13131b] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#6b6b7d] focus:outline-none focus:border-[#c0c1ff]"
        />
        <button type="submit" className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#5b5fef] to-[#3cd7ff] text-white text-sm font-bold flex items-center gap-1.5 cursor-pointer">
          <Search className="w-4 h-4" /> Search
        </button>
      </form>

      <div className="space-y-2">
        {users.map((u) => (
          <div key={u.id} className="glass-panel rounded-2xl p-4 flex flex-wrap items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#2a2a38] flex items-center justify-center text-sm font-extrabold text-[#c0c1ff] shrink-0">
              {u.username.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-white text-sm truncate">{u.username}</p>
              <p className="text-[11px] text-[#7e7d94] truncate">{u.email}{u.roll_no ? ` · ${u.roll_no}` : ''}</p>
            </div>
            <select
              value={u.role}
              onChange={(e) => changeRole(u, e.target.value)}
              disabled={busy === u.id}
              className="bg-[#13131b] border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-[#c0c1ff] cursor-pointer"
            >
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <button
              onClick={() => remove(u)}
              disabled={busy === u.id}
              className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-300 hover:bg-rose-500/20 transition-all cursor-pointer disabled:opacity-40"
              title="Delete user"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        {users.length === 0 && <p className="text-sm text-[#7e7d94] text-center py-8">Koi user nahi mila</p>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Clubs (super admin)
function ClubsTab({ onToast }: { onToast: (m: string) => void }) {
  const [clubs, setClubs] = useState<AdminClub[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [emoji, setEmoji] = useState('💬');
  const [assign, setAssign] = useState<{ clubId: number; userId: string } | null>(null);
  const [busy, setBusy] = useState(0);

  const load = () => {
    api.getAdminClubs().then((r) => setClubs(r.clubs || [])).catch(() => {});
    api.getAdminUsers().then((r) => setUsers(r.users || [])).catch(() => {});
  };
  useEffect(load, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await api.createClub({ name: name.trim(), description: desc.trim(), emoji: emoji.trim() || '💬' });
      onToast(`Club "${name}" ban gaya`);
      setName(''); setDesc(''); setEmoji('💬');
      load();
    } catch (err: any) {
      onToast(err.message || 'Create failed');
    }
  };

  const doAssign = async () => {
    if (!assign) return;
    const userId = parseInt(assign.userId, 10) || 0;
    if (!userId) return;
    try {
      await api.assignClubManager(assign.clubId, userId);
      onToast('Manager assign ho gaya (role auto → Club Manager)');
      load();
    } catch (err: any) {
      onToast(err.message || 'Assign failed');
    }
    setAssign(null);
  };

  const removeManager = async (clubId: number, userId: number, uname: string) => {
    try {
      await api.removeClubManager(clubId, userId);
      onToast(`${uname} ko manager se hata diya`);
      load();
    } catch (err: any) {
      onToast(err.message || 'Remove failed');
    }
  };

  const removeClub = async (c: AdminClub) => {
    if (!window.confirm(`Club "${c.name}" delete karna hai? Saare messages bhi delete honge.`)) return;
    try {
      await api.deleteClub(c.id);
      onToast(`Club "${c.name}" deleted`);
      load();
    } catch (err: any) {
      onToast(err.message || 'Delete failed');
    }
  };

  return (
    <div>
      <form onSubmit={create} className="glass-panel rounded-2xl p-4 mb-4">
        <p className="text-xs font-bold text-[#c6c5d7] uppercase tracking-wider mb-2">Naya club banao</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Club name" maxLength={80} className="bg-[#13131b] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#6b6b7d] focus:outline-none focus:border-[#c0c1ff]" />
          <input type="text" value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="Emoji (e.g. 🎯)" maxLength={10} className="bg-[#13131b] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#6b6b7d] focus:outline-none focus:border-[#c0c1ff]" />
        </div>
        <input type="text" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description" maxLength={300} className="mt-2 w-full bg-[#13131b] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#6b6b7d] focus:outline-none focus:border-[#c0c1ff]" />
        <button type="submit" disabled={!name.trim()} className="mt-3 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#5b5fef] to-[#3cd7ff] text-white text-sm font-bold flex items-center gap-1.5 disabled:opacity-40 cursor-pointer">
          <Plus className="w-4 h-4" /> Create club
        </button>
      </form>

      <div className="space-y-2">
        {clubs.map((c) => (
          <div key={c.id} className="glass-panel rounded-2xl p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-2xl">{c.emoji}</span>
                <div className="min-w-0">
                  <p className="font-bold text-white text-sm truncate">{c.name}</p>
                  <p className="text-[11px] text-[#7e7d94]">{c.members} members</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => { setBusy(c.id); setAssign({ clubId: c.id, userId: '' }); setBusy(0); }}
                  className="px-3 py-1.5 rounded-xl bg-[#5b5fef]/15 border border-[#5b5fef]/40 text-[#c0c1ff] text-[11px] font-bold flex items-center gap-1 hover:bg-[#5b5fef]/25 transition-all cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Manager
                </button>
                <button
                  onClick={() => removeClub(c)}
                  className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-300 hover:bg-rose-500/20 transition-all cursor-pointer"
                  title="Delete club"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {c.managers.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {c.managers.map((m) => (
                  <span key={m.id} className="inline-flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full px-2.5 py-1 text-[11px] text-[#c6c5d7]">
                    <ShieldCheck className="w-3 h-3 text-[#3cd7ff]" /> {m.username}
                    <button
                      onClick={() => removeManager(c.id, m.id, m.username)}
                      className="text-[#7e7d94] hover:text-rose-300 transition-all cursor-pointer"
                      title="Remove manager"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {assign && assign.clubId === c.id && (
              <div className="mt-3 flex gap-2">
                <select
                  value={assign.userId}
                  onChange={(e) => setAssign({ ...assign, userId: e.target.value })}
                  className="flex-1 min-w-0 bg-[#13131b] border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-[#c0c1ff] cursor-pointer"
                >
                  <option value="">— user chuno —</option>
                  {users.filter((u) => u.role === 'student' || u.role === 'club_manager').map((u) => (
                    <option key={u.id} value={u.id}>{u.username} (id {u.id})</option>
                  ))}
                </select>
                <button onClick={doAssign} disabled={!assign.userId} className="px-3 py-2 rounded-xl bg-emerald-500 text-white text-xs font-bold disabled:opacity-40 cursor-pointer">
                  Assign
                </button>
                <button onClick={() => setAssign(null)} className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-bold cursor-pointer">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        ))}
        {clubs.length === 0 && <p className="text-sm text-[#7e7d94] text-center py-8">Koi club nahi</p>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Placement (PO + super admin)
function PlacementTab({ onToast }: { onToast: (m: string) => void }) {
  const [drives, setDrives] = useState<Drive[]>([]);
  const [companies, setCompanies] = useState<CompanyQuestionMeta[]>([]);
  const [questions, setQuestions] = useState<CompanyQuestion[]>([]);
  const [selCompany, setSelCompany] = useState('');
  const [sub, setSub] = useState<'drives' | 'questions' | 'apps'>('drives');

  // applications
  const [apps, setApps] = useState<AppRow[]>([]);

  // drive form
  const [dCompany, setDCompany] = useState('');
  const [dRole, setDRole] = useState('');
  const [dPackage, setDPackage] = useState('');
  const [dDeadline, setDDeadline] = useState('');
  const [dStatus, setDStatus] = useState('open');
  const [editId, setEditId] = useState<number | null>(null);

  // question form
  const [qCompany, setQCompany] = useState('');
  const [qText, setQText] = useState('');
  const [qFreq, setQFreq] = useState('50');

  const loadDrives = () => api.getPlacementDrives().then((r) => setDrives(r.drives || [])).catch(() => {});
  const loadApps = () => api.getApplications().then((r) => setApps(r.applications || [])).catch(() => {});
  const loadQ = (company?: string) => {
    api.getCompanyQuestionCompanies().then((r) => setCompanies(r.companies || [])).catch(() => {});
    api.getCompanyQuestions(company).then((r) => setQuestions(r.questions || [])).catch(() => {});
  };
  useEffect(() => { loadDrives(); loadQ(); loadApps(); }, []);

  const setAppStatus = async (appId: number, status: string) => {
    try {
      await api.updateApplicationStatus(appId, status);
      onToast(`Status → ${status}`);
      loadApps();
    } catch (err: any) {
      onToast(err.message || 'Update failed');
    }
  };

  const saveDrive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dCompany.trim()) return;
    try {
      const body = { company: dCompany.trim(), role: dRole.trim(), package: dPackage.trim(), deadline: dDeadline.trim(), status: dStatus };
      if (editId) {
        await api.updateDrive(editId, body);
        onToast('Drive updated');
      } else {
        await api.createDrive(body);
        onToast(`"${dCompany}" drive add ho gayi`);
      }
      setDCompany(''); setDRole(''); setDPackage(''); setDDeadline(''); setDStatus('open'); setEditId(null);
      loadDrives();
    } catch (err: any) {
      onToast(err.message || 'Save failed');
    }
  };

  const startEdit = (d: Drive) => {
    setEditId(d.id); setDCompany(d.company); setDRole(d.role || ''); setDPackage(d.package || ''); setDDeadline(d.deadline || ''); setDStatus(d.status || 'open');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const removeDrive = async (id: number) => {
    try { await api.deleteDrive(id); loadDrives(); onToast('Drive deleted'); } catch (err: any) { onToast(err.message || 'Delete failed'); }
  };

  const saveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qCompany.trim() || !qText.trim()) return;
    try {
      await api.addCompanyQuestion({ company: qCompany.trim(), question: qText.trim(), frequency: parseInt(qFreq, 10) || 1 });
      onToast('Question add ho gaya');
      setQText(''); setQFreq('50');
      loadQ(selCompany || qCompany.trim());
      setSelCompany(qCompany.trim());
    } catch (err: any) {
      onToast(err.message || 'Save failed');
    }
  };

  const removeQuestion = async (id: number) => {
    try { await api.deleteCompanyQuestion(id); loadQ(selCompany); onToast('Question deleted'); } catch (err: any) { onToast(err.message || 'Delete failed'); }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => setSub('drives')} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer border ${sub === 'drives' ? 'bg-[#5b5fef]/20 border-[#5b5fef]/50 text-[#c0c1ff]' : 'bg-white/5 border-white/10 text-[#c6c5d7]'}`}>
          <span className="flex items-center gap-1.5"><Briefcase className="w-4 h-4" /> Drives</span>
        </button>
        <button onClick={() => setSub('questions')} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer border ${sub === 'questions' ? 'bg-[#5b5fef]/20 border-[#5b5fef]/50 text-[#c0c1ff]' : 'bg-white/5 border-white/10 text-[#c6c5d7]'}`}>
          <span className="flex items-center gap-1.5"><BookOpen className="w-4 h-4" /> Company Question Bank</span>
        </button>
        <button onClick={() => setSub('apps')} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer border ${sub === 'apps' ? 'bg-[#5b5fef]/20 border-[#5b5fef]/50 text-[#c0c1ff]' : 'bg-white/5 border-white/10 text-[#c6c5d7]'}`}>
          <span className="flex items-center gap-1.5"><Users className="w-4 h-4" /> Applications ({apps.length})</span>
        </button>
      </div>

      {sub === 'drives' && (
        <div>
          <form onSubmit={saveDrive} className="glass-panel rounded-2xl p-4 mb-4">
            <p className="text-xs font-bold text-[#c6c5d7] uppercase tracking-wider mb-2">
              {editId ? `Edit drive #${editId}` : 'Nayi drive add karo'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input type="text" value={dCompany} onChange={(e) => setDCompany(e.target.value)} placeholder="Company (e.g. TCS)" maxLength={120} className="bg-[#13131b] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#6b6b7d] focus:outline-none focus:border-[#c0c1ff]" />
              <input type="text" value={dRole} onChange={(e) => setDRole(e.target.value)} placeholder="Role (e.g. Systems Engineer)" maxLength={120} className="bg-[#13131b] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#6b6b7d] focus:outline-none focus:border-[#c0c1ff]" />
              <input type="text" value={dPackage} onChange={(e) => setDPackage(e.target.value)} placeholder="Package (e.g. 7.5 LPA)" maxLength={60} className="bg-[#13131b] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#6b6b7d] focus:outline-none focus:border-[#c0c1ff]" />
              <input type="text" value={dDeadline} onChange={(e) => setDDeadline(e.target.value)} placeholder="Deadline (e.g. This Friday)" maxLength={120} className="bg-[#13131b] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#6b6b7d] focus:outline-none focus:border-[#c0c1ff]" />
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <select value={dStatus} onChange={(e) => setDStatus(e.target.value)} className="bg-[#13131b] border border-white/10 rounded-xl px-3 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-[#c0c1ff] cursor-pointer">
                <option value="open">Open</option>
                <option value="upcoming">Upcoming</option>
                <option value="closed">Closed</option>
              </select>
              <button type="submit" disabled={!dCompany.trim()} className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#5b5fef] to-[#3cd7ff] text-white text-sm font-bold flex items-center gap-1.5 disabled:opacity-40 cursor-pointer">
                <Save className="w-4 h-4" /> {editId ? 'Update' : 'Add drive'}
              </button>
              {editId && (
                <button type="button" onClick={() => { setEditId(null); setDCompany(''); setDRole(''); setDPackage(''); setDDeadline(''); setDStatus('open'); }} className="px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-bold cursor-pointer">
                  Cancel
                </button>
              )}
            </div>
          </form>

          <div className="space-y-2">
            {drives.map((d) => (
              <div key={d.id} className="glass-panel rounded-2xl p-4 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="font-bold text-white text-sm">{d.company} <span className="text-[#3cd7ff]">· {d.package}</span></p>
                  <p className="text-[11px] text-[#7e7d94]">{d.role} · {d.deadline} · <span className={d.status === 'open' ? 'text-emerald-300' : d.status === 'upcoming' ? 'text-amber-300' : 'text-[#7e7d94]'}>{d.status}</span></p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => startEdit(d)} className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white text-[11px] font-bold hover:bg-white/10 transition-all cursor-pointer">
                    Edit
                  </button>
                  <button onClick={() => removeDrive(d.id)} className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-300 hover:bg-rose-500/20 transition-all cursor-pointer">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {sub === 'questions' && (
        <div>
          <form onSubmit={saveQuestion} className="glass-panel rounded-2xl p-4 mb-4">
            <p className="text-xs font-bold text-[#c6c5d7] uppercase tracking-wider mb-2">Company-specific question share karo</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                list="q-companies"
                type="text"
                value={qCompany}
                onChange={(e) => setQCompany(e.target.value)}
                placeholder="Company (e.g. TCS)"
                maxLength={120}
                className="sm:w-48 bg-[#13131b] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#6b6b7d] focus:outline-none focus:border-[#c0c1ff]"
              />
              <datalist id="q-companies">
                {companies.map((c) => <option key={c.company} value={c.company} />)}
              </datalist>
              <input type="number" value={qFreq} onChange={(e) => setQFreq(e.target.value)} min={1} max={100} placeholder="Frequency 1-100" className="sm:w-32 bg-[#13131b] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#6b6b7d] focus:outline-none focus:border-[#c0c1ff]" />
              <input type="text" value={qText} onChange={(e) => setQText(e.target.value)} placeholder="Question likho…" maxLength={500} className="flex-1 min-w-0 bg-[#13131b] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#6b6b7d] focus:outline-none focus:border-[#c0c1ff]" />
              <button type="submit" disabled={!qCompany.trim() || !qText.trim()} className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#5b5fef] to-[#3cd7ff] text-white text-sm font-bold flex items-center gap-1.5 disabled:opacity-40 cursor-pointer">
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>
          </form>

          <div className="flex gap-2 flex-wrap mb-4">
            <button onClick={() => { setSelCompany(''); loadQ(); }} className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all cursor-pointer ${!selCompany ? 'bg-[#5b5fef]/20 border-[#5b5fef]/50 text-[#c0c1ff]' : 'bg-white/5 border-white/10 text-[#c6c5d7]'}`}>
              Sab ({companies.length})
            </button>
            {companies.map((c) => (
              <button key={c.company} onClick={() => { setSelCompany(c.company); loadQ(c.company); }} className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all cursor-pointer ${selCompany === c.company ? 'bg-[#5b5fef]/20 border-[#5b5fef]/50 text-[#c0c1ff]' : 'bg-white/5 border-white/10 text-[#c6c5d7]'}`}>
                {c.company} · {c.question_count}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {questions.map((qn) => (
              <div key={qn.id} className="glass-panel rounded-2xl p-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-white leading-relaxed">{qn.question}</p>
                  <p className="text-[11px] text-[#c6c5d7] mt-1.5">
                    <span className="font-bold text-[#3cd7ff]">{qn.frequency}% frequency</span> · {qn.company}
                  </p>
                </div>
                <button onClick={() => removeQuestion(qn.id)} className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-300 hover:bg-rose-500/20 transition-all cursor-pointer shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {questions.length === 0 && <p className="text-sm text-[#7e7d94] text-center py-8">Abhi koi question share nahi hua — sabse upar form se add karo</p>}
          </div>
        </div>
      )}

      {sub === 'apps' && (
        <div>
          <p className="text-xs font-bold text-[#c6c5d7] uppercase tracking-wider mb-3">
            Students ke placement applications — status update karo
          </p>
          <div className="space-y-2">
            {apps.map((a) => (
              <div key={a.id} className="glass-panel rounded-2xl p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-white text-sm truncate">
                      {a.user_name || a.username} <span className="text-[#7e7d94] font-normal">@{a.username}{a.roll_no ? ` · ${a.roll_no}` : ''}</span>
                    </p>
                    <p className="text-[11px] text-[#c6c5d7] truncate">
                      {a.company} · {a.role} · <span className="text-[#3cd7ff]">{a.package}</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <span className={`text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full ${APP_STATUS_STYLE[a.status] || APP_STATUS_STYLE.applied}`}>
                      {a.status}
                    </span>
                    <button onClick={() => setAppStatus(a.id, 'waiting')} disabled={a.status === 'waiting'} className="px-2.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-bold hover:bg-amber-500/20 transition-all disabled:opacity-40 cursor-pointer">
                      Waiting
                    </button>
                    <button onClick={() => setAppStatus(a.id, 'selected')} disabled={a.status === 'selected'} className="px-2.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold hover:bg-emerald-500/20 transition-all disabled:opacity-40 cursor-pointer">
                      Selected
                    </button>
                    <button onClick={() => setAppStatus(a.id, 'rejected')} disabled={a.status === 'rejected'} className="px-2.5 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px] font-bold hover:bg-rose-500/20 transition-all disabled:opacity-40 cursor-pointer">
                      Rejected
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {apps.length === 0 && <p className="text-sm text-[#7e7d94] text-center py-8">Abhi koi application nahi aayi — students Placement screen se drives par apply karte hain</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Moderation (club manager)
function ModerationTab({ onToast }: { onToast: (m: string) => void }) {
  const [clubs, setClubs] = useState<ManagerClub[]>([]);
  const [activeClub, setActiveClub] = useState<ManagerClub | null>(null);
  const [messages, setMessages] = useState<ManagerMessage[]>([]);
  const [members, setMembers] = useState<{ id: number; username: string; joinedAt?: string | null; blocked: boolean }[]>([]);
  const [clubSub, setClubSub] = useState<'messages' | 'members'>('messages');
  const [addUser, setAddUser] = useState('');
  const [memberBusy, setMemberBusy] = useState(false);

  useEffect(() => {
    api.getManagerClubs().then((r) => setClubs(r.clubs || [])).catch(() => {});
  }, []);

  const loadMsgs = (clubId: number) => {
    api.getManagerMessages(clubId).then((r) => setMessages(r.messages || [])).catch(() => {});
  };

  const loadMembers = (clubId: number) => {
    api.getClubMembers(clubId).then((r) => setMembers(r.members || [])).catch(() => {});
  };

  const openClub = (c: ManagerClub) => {
    setActiveClub(c);
    setClubSub('messages');
    loadMsgs(c.id);
    loadMembers(c.id);
  };

  const addMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClub || !addUser.trim()) return;
    setMemberBusy(true);
    try {
      await api.addClubMember(activeClub.id, addUser.trim());
      onToast(`${addUser.trim()} club mein add ho gaya`);
      setAddUser('');
      loadMembers(activeClub.id);
    } catch (err: any) {
      onToast(err.message || 'Add failed');
    } finally {
      setMemberBusy(false);
    }
  };

  const blockMember = async (userId: number, username: string) => {
    if (!activeClub) return;
    if (!window.confirm(`"${username}" ko is club se block karna hai? Woh dubara join nahi kar payega.`)) return;
    setMemberBusy(true);
    try {
      await api.managerBlockUsers(activeClub.id, [userId]);
      onToast(`${username} → club se block ho gaya`);
      loadMembers(activeClub.id);
    } catch (err: any) {
      onToast(err.message || 'Block failed');
    } finally {
      setMemberBusy(false);
    }
  };

  const unblockMember = async (userId: number, username: string) => {
    if (!activeClub) return;
    setMemberBusy(true);
    try {
      await api.managerUnblockUsers(activeClub.id, [userId]);
      onToast(`${username} unblock ho gaya`);
      loadMembers(activeClub.id);
    } catch (err: any) {
      onToast(err.message || 'Unblock failed');
    } finally {
      setMemberBusy(false);
    }
  };

  const delMsg = async (m: ManagerMessage) => {
    if (!activeClub) return;
    try {
      await api.deleteManagerMessage(activeClub.id, m.id);
      setMessages((prev) => prev.filter((x) => x.id !== m.id));
      onToast('Message delete ho gaya — sender ko pata nahi chalega ki kisi ne report kiya');
    } catch (err: any) {
      onToast(err.message || 'Delete failed');
    }
  };

  if (activeClub) {
    return (
      <div>
        <button onClick={() => setActiveClub(null)} className="mb-3 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer">
          <X className="w-3.5 h-3.5" /> Back to clubs
        </button>
        <div className="glass-panel rounded-2xl p-4 mb-3">
          <p className="font-bold text-white text-sm">{activeClub.emoji} {activeClub.name}</p>
          <p className="text-[11px] text-[#c6c5d7] mt-1">
            Tum is club ke manager ho — sirf isi club ke members ke usernames dekh sakte ho, aur sirf isi club se add/block kar sakte ho. Dusre clubs mein koi interference nahi.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          <button onClick={() => setClubSub('messages')} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer border ${clubSub === 'messages' ? 'bg-[#5b5fef]/20 border-[#5b5fef]/50 text-[#c0c1ff]' : 'bg-white/5 border-white/10 text-[#c6c5d7]'}`}>
            <span className="flex items-center gap-1.5"><MessagesSquare className="w-4 h-4" /> Messages</span>
          </button>
          <button onClick={() => setClubSub('members')} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer border ${clubSub === 'members' ? 'bg-[#5b5fef]/20 border-[#5b5fef]/50 text-[#c0c1ff]' : 'bg-white/5 border-white/10 text-[#c6c5d7]'}`}>
            <span className="flex items-center gap-1.5"><Users className="w-4 h-4" /> Members ({members.length})</span>
          </button>
        </div>

        {clubSub === 'messages' && (
          <div className="space-y-2">
            {messages.map((m) => (
              <div key={m.id} className="glass-panel rounded-2xl p-4 flex items-center justify-between gap-3">
                <p className="text-sm text-white leading-relaxed min-w-0">{m.text}</p>
                <button onClick={() => delMsg(m)} className="shrink-0 w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-300 hover:bg-rose-500/20 transition-all cursor-pointer" title="Delete message">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {messages.length === 0 && <p className="text-sm text-[#7e7d94] text-center py-8">Is club mein abhi koi message nahi</p>}
          </div>
        )}

        {clubSub === 'members' && (
          <div>
            <form onSubmit={addMember} className="glass-panel rounded-2xl p-4 mb-3 flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={addUser}
                onChange={(e) => setAddUser(e.target.value)}
                placeholder="Username se member add karo (e.g. harsh1)"
                maxLength={30}
                className="flex-1 min-w-0 bg-[#13131b] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#6b6b7d] focus:outline-none focus:border-[#c0c1ff]"
              />
              <button type="submit" disabled={!addUser.trim() || memberBusy} className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#5b5fef] to-[#3cd7ff] text-white text-sm font-bold flex items-center gap-1.5 disabled:opacity-40 cursor-pointer">
                <UserPlus className="w-4 h-4" /> Add member
              </button>
            </form>
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.id} className="glass-panel rounded-2xl p-4 flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="font-bold text-white text-sm truncate">{m.username}</p>
                    <p className="text-[11px] text-[#7e7d94]">{m.joinedAt ? `Joined ${new Date(m.joinedAt).toLocaleDateString('en-IN')}` : ''}{m.blocked ? ' · Blocked' : ''}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {m.blocked ? (
                      <button onClick={() => unblockMember(m.id, m.username)} disabled={memberBusy} className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold hover:bg-emerald-500/20 transition-all disabled:opacity-40 cursor-pointer">
                        Unblock
                      </button>
                    ) : (
                      <button onClick={() => blockMember(m.id, m.username)} disabled={memberBusy} className="px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px] font-bold hover:bg-rose-500/20 transition-all disabled:opacity-40 cursor-pointer">
                        Block
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {members.length === 0 && <p className="text-sm text-[#7e7d94] text-center py-8">Is club mein abhi koi member nahi</p>}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs font-bold text-[#c6c5d7] uppercase tracking-wider mb-3">Mere clubs (moderation)</p>
      {clubs.length === 0 && (
        <div className="glass-panel rounded-2xl p-8 text-center">
          <ShieldCheck className="w-10 h-10 text-[#3cd7ff] mx-auto mb-3" />
          <p className="text-sm font-semibold text-white">Tum kisi club ke manager nahi ho</p>
          <p className="text-xs text-[#c6c5d7] mt-1">Super Admin hi club managers appoint karta hai.</p>
        </div>
      )}
      <div className="space-y-2">
        {clubs.map((c) => (
          <button key={c.id} onClick={() => openClub(c)} className="w-full text-left glass-panel rounded-2xl p-4 flex items-center gap-3 hover:border-[#c0c1ff]/40 transition-all cursor-pointer">
            <span className="text-2xl">{c.emoji}</span>
            <div className="min-w-0">
              <p className="font-bold text-white text-sm">{c.name}</p>
              <p className="text-[11px] text-[#7e7d94] truncate">{c.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Faculty stats
function FacultyTab({ onToast }: { onToast: (m: string) => void }) {
  const [stats, setStats] = useState<FacultyStats | null>(null);
  useEffect(() => {
    api.getFacultyStats().then((r) => setStats(r.stats)).catch(() => onToast('Stats load nahi hue'));
  }, [onToast]);

  if (!stats) return <div className="glass-panel rounded-2xl p-8 text-center text-sm text-[#7e7d94]">Loading…</div>;

  const cards = [
    { label: 'Total students', value: stats.totalStudents, icon: Users },
    { label: 'Avg skill score', value: `${stats.avgSkillPercentage}%`, icon: BarChart3 },
    { label: 'Students with skills', value: stats.studentsWithSkills, icon: BookOpen },
    { label: 'Clubs active', value: stats.clubsActive, icon: MessageSquare },
    { label: 'Club memberships', value: stats.clubsMemberships, icon: UserPlus },
    { label: 'Active last 7 days', value: stats.clubsActiveLast7d, icon: Building2 },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="glass-panel rounded-2xl p-4">
            <c.icon className="w-5 h-5 text-[#3cd7ff] mb-2" />
            <p className="text-2xl font-extrabold text-white">{c.value}</p>
            <p className="text-[11px] text-[#7e7d94] font-semibold mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>
      <div className="glass-panel rounded-2xl p-4 mt-4">
        <p className="text-xs font-bold text-[#c6c5d7] uppercase tracking-wider mb-3">Top skills (cohort level — koi identity nahi)</p>
        <div className="space-y-2">
          {stats.topSkills.map((s) => (
            <div key={s.name} className="flex items-center gap-3">
              <span className="text-xs font-semibold text-white w-28 sm:w-40 truncate">{s.name}</span>
              <div className="flex-1 h-2.5 rounded-full bg-[#13131b] overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-[#5b5fef] to-[#3cd7ff]" style={{ width: `${Math.max(4, s.avg_percentage)}%` }} />
              </div>
              <span className="text-[11px] text-[#7e7d94] w-20 sm:w-24 text-right shrink-0">{s.avg_percentage}% · {s.students} students</span>
            </div>
          ))}
        </div>
      </div>
      <p className="text-[10px] text-[#7e7d94] mt-3">
        Privacy note: faculty ko sirf aggregate numbers dikhte hain — kabhi koi naam, email, ya individual data nahi.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- People (super admin, full view)
function PeopleTab({ onToast }: { onToast: (m: string) => void }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [clubs, setClubs] = useState<AdminClub[]>([]);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [detail, setDetail] = useState<AdminUserDetails | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [blockClubId, setBlockClubId] = useState('');
  const [busy, setBusy] = useState(false);

  const load = (query = '') => {
    api.getAdminUsers(query).then((r) => setUsers(r.users || [])).catch(() => {});
  };
  useEffect(() => {
    load();
    api.getAdminClubs().then((r) => setClubs(r.clubs || [])).catch(() => {});
  }, []);

  const toggleSel = (id: number) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const openDetail = (u: AdminUser) => {
    setDetailBusy(true);
    api.getAdminUserDetails(u.id)
      .then((d) => setDetail(d))
      .catch((err: any) => onToast(err.message || 'Details load nahi hui'))
      .finally(() => setDetailBusy(false));
  };

  const doBlock = async () => {
    const clubId = Number(blockClubId);
    const ids = [...selected];
    if (!clubId || ids.length === 0) return;
    setBusy(true);
    try {
      await api.blockClubUsers(clubId, ids);
      onToast(`${ids.length} user(s) club se block ho gaye`);
      setSelected(new Set());
      setBlockClubId('');
    } catch (err: any) {
      onToast(err.message || 'Block failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <form onSubmit={(e) => { e.preventDefault(); load(q); }} className="flex gap-2 mb-4">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Username / email / roll search…"
          className="flex-1 min-w-0 bg-[#13131b] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#6b6b7d] focus:outline-none focus:border-[#c0c1ff]"
        />
        <button type="submit" className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#5b5fef] to-[#3cd7ff] text-white text-sm font-bold flex items-center gap-1.5 cursor-pointer">
          <Search className="w-4 h-4" /> Search
        </button>
      </form>

      {selected.size > 0 && (
        <div className="glass-panel rounded-2xl p-3 mb-4 flex flex-col sm:flex-row items-start sm:items-center gap-2 border-[#5b5fef]/40">
          <p className="text-xs font-bold text-[#c0c1ff] whitespace-nowrap">{selected.size} selected</p>
          <select
            value={blockClubId}
            onChange={(e) => setBlockClubId(e.target.value)}
            className="flex-1 min-w-0 w-full sm:w-auto bg-[#13131b] border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none cursor-pointer"
          >
            <option value="">— Club chuno (block ke liye) —</option>
            {clubs.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
          </select>
          <button
            onClick={doBlock}
            disabled={!blockClubId || busy}
            className="px-4 py-2 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-1.5 hover:bg-rose-500/25 transition-all cursor-pointer disabled:opacity-40"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
            Block from club
          </button>
        </div>
      )}

      <p className="text-[10px] text-[#7e7d94] mb-2">Row par click karo → full profile (skills, rank, resume, projects, certificates, clubs, friends, placement prep).</p>

      <div className="space-y-2">
        {users.map((u) => (
          <div key={u.id} className="glass-panel rounded-2xl p-4 flex items-center gap-3">
            <input
              type="checkbox"
              checked={selected.has(u.id)}
              onChange={() => toggleSel(u.id)}
              className="w-4 h-4 accent-[#5b5fef] shrink-0 cursor-pointer"
            />
            <div className="w-10 h-10 rounded-xl bg-[#2a2a38] flex items-center justify-center text-sm font-extrabold text-[#c0c1ff] shrink-0">
              {u.username.slice(0, 2).toUpperCase()}
            </div>
            <button onClick={() => openDetail(u)} className="min-w-0 flex-1 text-left cursor-pointer group">
              <p className="font-bold text-white text-sm truncate group-hover:text-[#3cd7ff] transition-colors">{u.username}</p>
              <p className="text-[11px] text-[#7e7d94] truncate">{u.email}{u.roll_no ? ` · ${u.roll_no}` : ''}</p>
            </button>
            <span className="text-[9px] font-extrabold text-[#3cd7ff] bg-[#3cd7ff]/10 border border-[#3cd7ff]/40 px-2 py-1 rounded-full uppercase tracking-wide hidden sm:inline">
              {ROLES.find((r) => r.value === u.role)?.label || u.role}
            </span>
            <button
              onClick={() => openDetail(u)}
              className="w-9 h-9 rounded-xl bg-[#5b5fef]/10 border border-[#5b5fef]/30 flex items-center justify-center text-[#c0c1ff] hover:bg-[#5b5fef]/20 transition-all cursor-pointer shrink-0"
              title="Full profile"
            >
              <Eye className="w-4 h-4" />
            </button>
          </div>
        ))}
        {users.length === 0 && <p className="text-sm text-[#7e7d94] text-center py-8">Koi user nahi mila</p>}
      </div>

      {detailBusy && (
        <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Loader2 className="w-8 h-8 text-[#3cd7ff] animate-spin" />
        </div>
      )}

      {detail && <UserDetailModal details={detail} onClose={() => setDetail(null)} onToast={onToast} />}
    </div>
  );
}

function UserDetailModal({ details: d, onClose, onToast }: { details: AdminUserDetails; onClose: () => void; onToast: (m: string) => void }) {
  const skillCount = d.skills.length;
  const completedProjects = d.projects.filter((p) => p.status === 'completed' || p.progress >= 100).length;
  const inProgress = d.projects.filter((p) => p.status !== 'completed' && p.progress < 100 && p.progress > 0).length;
  const notStarted = d.projects.filter((p) => p.progress === 0 && p.status !== 'completed').length;

  return (
    <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm overflow-hidden" onClick={onClose}>
      <div className="min-h-full flex items-start sm:items-center justify-center p-3 sm:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="w-full max-w-3xl glass-panel rounded-3xl p-5 sm:p-7 my-4 max-h-[92vh] flex flex-col overflow-hidden">
          <div className="flex items-start justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#5b5fef] to-[#3cd7ff] flex items-center justify-center text-lg font-extrabold text-white shrink-0">
                {d.user.username.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-extrabold text-white truncate">{d.user.name || d.user.username}</h3>
                <p className="text-[11px] text-[#7e7d94] truncate">
                  @{d.user.username}{d.user.email ? ` · ${d.user.email}` : ''}{d.user.rollNo ? ` · Roll: ${d.user.rollNo}` : ''}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[#c6c5d7] hover:bg-white/10 transition-all cursor-pointer shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto pr-1 mt-1">
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="text-[10px] font-extrabold text-[#3cd7ff] bg-[#3cd7ff]/10 border border-[#3cd7ff]/40 px-2.5 py-1 rounded-full uppercase">
              {ROLES.find((r) => r.value === d.user.role)?.label || d.user.role}
            </span>
            {d.user.phone && <span className="text-[10px] font-bold text-[#c6c5d7] bg-white/5 border border-white/10 px-2.5 py-1 rounded-full flex items-center gap-1"><Phone className="w-3 h-3" /> {d.user.phone}</span>}
            {d.user.workType && <span className="text-[10px] font-bold text-[#c6c5d7] bg-white/5 border border-white/10 px-2.5 py-1 rounded-full">{d.user.workType === 'job' ? 'Full-time' : d.user.workType === 'internship' ? 'Internship' : ''}</span>}
          </div>

          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: 'Overall rank', value: d.rank.userRank ? `#${d.rank.userRank} / ${d.rank.totalStudents}` : '—' },
              { label: 'Skills', value: String(skillCount) },
              { label: 'AI Mentor uses', value: String(d.mentorUses) },
              { label: 'Certificates', value: String(d.certificates.length) },
            ].map((c) => (
              <div key={c.label} className="glass-panel rounded-xl p-3 text-center">
                <p className="text-lg font-extrabold text-white">{c.value}</p>
                <p className="text-[10px] text-[#7e7d94] font-semibold mt-0.5">{c.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-3">
            <div className="glass-panel rounded-2xl p-4">
              <p className="text-[10px] font-extrabold text-[#c6c5d7] uppercase tracking-wider mb-3">Placement prep</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <div><span className="text-[#7e7d94] block">Target role</span><span className="font-bold text-white">{d.user.targetRole || '—'}</span></div>
                <div><span className="text-[#7e7d94] block">Target company</span><span className="font-bold text-white">{d.user.targetCompanyName || '—'}</span></div>
                <div><span className="text-[#7e7d94] block">Target CGPA</span><span className="font-bold text-white">{d.user.targetCgpa || '—'}</span></div>
                <div><span className="text-[#7e7d94] block">Branch</span><span className="font-bold text-white">{d.user.branch || '—'}</span></div>
                <div><span className="text-[#7e7d94] block">Semester</span><span className="font-bold text-white">{d.user.semester || '—'}</span></div>
                <div><span className="text-[#7e7d94] block">Company type</span><span className="font-bold text-white">{d.user.targetCompanyType || '—'}</span></div>
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-4">
              <p className="text-[10px] font-extrabold text-[#c6c5d7] uppercase tracking-wider mb-3">Placement applications ({d.applications.length})</p>
              {d.applications.length === 0 && <p className="text-xs text-[#7e7d94]">Kisi drive par apply nahi kiya</p>}
              <div className="space-y-2 max-h-[170px] sm:max-h-[220px] overflow-y-auto pr-1">
                {d.applications.map((a) => (
                  <div key={a.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#13131b] rounded-xl px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{a.company}{a.role ? ` · ${a.role}` : ''}</p>
                      <p className="text-[10px] text-[#7e7d94]">{a.package}{a.deadline ? ` · ${a.deadline}` : ''}</p>
                    </div>
                    <span className={`text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full self-start sm:self-auto ${APP_STATUS_STYLE[a.status] || APP_STATUS_STYLE.applied}`}>
                      {a.status}
                    </span>
                  </div>
                ))}
              </div>
              {d.applications.some((a) => a.status === 'selected') && (
                <p className="text-[10px] font-bold text-emerald-300 mt-2">
                  ✅ Baitha hua hai: {d.applications.filter((a) => a.status === 'selected').map((a) => a.company).join(', ')}
                </p>
              )}
              {d.applications.some((a) => a.status === 'waiting') && (
                <p className="text-[10px] font-bold text-amber-300 mt-1">
                  ⏳ Wait kar raha hai: {d.applications.filter((a) => a.status === 'waiting').map((a) => a.company).join(', ')}
                </p>
              )}
            </div>

            <div className="glass-panel rounded-2xl p-4">
              <p className="text-[10px] font-extrabold text-[#c6c5d7] uppercase tracking-wider mb-3">Skills ({skillCount})</p>
              {skillCount === 0 && <p className="text-xs text-[#7e7d94]">Abhi koi skill nahi ja</p>}
              <div className="space-y-2 max-h-[170px] sm:max-h-[220px] overflow-y-auto pr-1">
                {d.skills.map((s) => (
                  <div key={s.id}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white truncate">{s.name}</span>
                      <span className="text-[10px] text-[#7e7d94] shrink-0">{s.mastery}%{s.platform ? ` · ${s.platform}` : ''}{s.questionsSolved ? ` · ${s.questionsSolved}/${s.totalQuestions} Q` : ''}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#13131b] overflow-hidden mt-1">
                      <div className="h-full rounded-full bg-gradient-to-r from-[#5b5fef] to-[#3cd7ff]" style={{ width: `${Math.max(3, s.mastery)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-4">
              <p className="text-[10px] font-extrabold text-[#c6c5d7] uppercase tracking-wider mb-3">Projects ({completedProjects} done · {inProgress} ongoing · {notStarted} not started)</p>
              {d.projects.length === 0 && <p className="text-xs text-[#7e7d94]">Abhi koi project nahi</p>}
              <div className="space-y-2 max-h-[170px] sm:max-h-[220px] overflow-y-auto pr-1">
                {d.projects.map((p) => (
                  <div key={p.id} className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${p.progress >= 100 ? 'bg-emerald-400' : p.progress > 0 ? 'bg-amber-400' : 'bg-[#4a4a5c]'}`} />
                    <span className="text-xs font-semibold text-white truncate flex-1">{p.title}</span>
                    <span className="text-[10px] text-[#7e7d94] shrink-0">{p.status === 'completed' ? 'Completed ✓' : `${p.progress}%`}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="glass-panel rounded-2xl p-4">
                <p className="text-[10px] font-extrabold text-[#c6c5d7] uppercase tracking-wider mb-3">Clubs ({d.clubs.length})</p>
                {d.clubs.length === 0 && <p className="text-xs text-[#7e7d94]">Kisi club mein join nahi</p>}
                <div className="space-y-1.5 max-h-[170px] sm:max-h-[220px] overflow-y-auto pr-1">
                  {d.clubs.map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-white truncate">{c.emoji} {c.name}</span>
                      {c.blocked ? (
                        <span className="text-[9px] font-bold text-rose-300 bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded-full shrink-0">Blocked</span>
                      ) : (
                        <button
                          onClick={async () => {
                            try {
                              await api.blockClubUsers(c.id, [d.user.id]);
                              onToast(`${d.user.username} → ${c.name} se block ho gaya`);
                              onClose();
                            } catch (err: any) {
                              onToast(err.message || 'Block failed');
                            }
                          }}
                          className="text-[9px] font-bold text-rose-300 bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded-full hover:bg-rose-500/20 transition-all cursor-pointer shrink-0"
                        >
                          Block
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass-panel rounded-2xl p-4">
                <p className="text-[10px] font-extrabold text-[#c6c5d7] uppercase tracking-wider mb-3">Coding profiles ({d.codingProfiles.length})</p>
                {d.codingProfiles.length === 0 && <p className="text-xs text-[#7e7d94]">Koi profile link nahi</p>}
                <div className="space-y-1.5 max-h-[170px] sm:max-h-[220px] overflow-y-auto pr-1">
                  {d.codingProfiles.map((c, i) => (
                    <div key={i} className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-white truncate">{c.platform}: {c.name}</span>
                      {c.url && (
                        <a href={c.url} target="_blank" rel="noreferrer" className="text-[#3cd7ff] hover:underline shrink-0"><ExternalLink className="w-3.5 h-3.5" /></a>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {d.user.githubUrl && <a href={d.user.githubUrl} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-[#3cd7ff] bg-[#3cd7ff]/10 border border-[#3cd7ff]/30 px-2.5 py-1 rounded-full hover:bg-[#3cd7ff]/20 transition-all">GitHub</a>}
                  {d.user.linkedinUrl && <a href={d.user.linkedinUrl} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-[#3cd7ff] bg-[#3cd7ff]/10 border border-[#3cd7ff]/30 px-2.5 py-1 rounded-full hover:bg-[#3cd7ff]/20 transition-all">LinkedIn</a>}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="glass-panel rounded-2xl p-4">
                <p className="text-[10px] font-extrabold text-[#c6c5d7] uppercase tracking-wider mb-3">Resumes ({d.resumes.length})</p>
                {d.resumes.length === 0 && <p className="text-xs text-[#7e7d94]">Resume upload nahi kiya</p>}
                <div className="space-y-1.5 max-h-[170px] sm:max-h-[220px] overflow-y-auto pr-1">
                  {d.resumes.map((r) => (
                    <div key={r.id} className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-white truncate flex items-center gap-1.5"><FileText className="w-3.5 h-3.5 text-[#3cd7ff] shrink-0" /> {r.fileName || 'Resume'}</span>
                      {r.filePath && <a href={r.filePath} target="_blank" rel="noreferrer" className="text-[#3cd7ff] hover:underline shrink-0"><ExternalLink className="w-3.5 h-3.5" /></a>}
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass-panel rounded-2xl p-4">
                <p className="text-[10px] font-extrabold text-[#c6c5d7] uppercase tracking-wider mb-3">Friends ({d.friends.length})</p>
                {d.friends.length === 0 && <p className="text-xs text-[#7e7d94]">Abhi koi friend nahi</p>}
                <div className="flex flex-wrap gap-1.5 max-h-[170px] sm:max-h-[220px] overflow-y-auto pr-1">
                  {d.friends.map((f) => (
                    <span key={f.id} className="text-[10px] font-bold text-white bg-white/5 border border-white/10 px-2.5 py-1 rounded-full">{f.handle}</span>
                  ))}
                </div>
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-4">
              <p className="text-[10px] font-extrabold text-[#c6c5d7] uppercase tracking-wider mb-3">Certificates ({d.certificates.length})</p>
              {d.certificates.length === 0 && <p className="text-xs text-[#7e7d94]">Koi certificate nahi</p>}
              <div className="flex flex-wrap gap-1.5 max-h-[170px] sm:max-h-[220px] overflow-y-auto pr-1">
                {d.certificates.map((c) => (
                  <span key={c.id} className="text-[10px] font-bold text-white bg-white/5 border border-white/10 px-2.5 py-1 rounded-full">{c.category ? `${c.category}: ` : ''}{c.title}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 text-[10px] text-[#7e7d94]">
            Joined: {d.user.createdAt ? new Date(d.user.createdAt).toLocaleDateString('en-IN') : '—'} · Handle: use hona chahiye? — identity anonymous hoti hai
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Profile (own admin card)
function ProfileTab({ username, role }: { username: string; role: Role }) {
  const [me, setMe] = useState<AuthUser | null>(null);
  useEffect(() => {
    api.me().then((r) => setMe(r.user)).catch(() => {});
  }, []);

  return (
    <div className="max-w-xl">
      <div className="glass-panel rounded-2xl p-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#5b5fef] to-[#3cd7ff] flex items-center justify-center text-lg font-extrabold text-white">
            {username.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-extrabold text-white">{username}</h3>
            <p className="text-[11px] text-[#7e7d94] truncate">{me?.email || '…'}</p>
          </div>
        </div>
        <div className="mt-4 space-y-2 text-sm">
          <div className="flex items-center gap-2 text-[#c6c5d7]"><Hash className="w-4 h-4 text-[#3cd7ff]" /> User ID: {me?.id ?? '—'}</div>
          <div className="flex items-center gap-2 text-[#c6c5d7]"><ShieldCheck className="w-4 h-4 text-[#3cd7ff]" /> Role: {ROLES.find((r) => r.value === role)?.label || role}</div>
          <div className="flex items-center gap-2 text-[#c6c5d7]"><Mail className="w-4 h-4 text-[#3cd7ff]" /> {me?.email || '—'}</div>
        </div>
        <p className="text-[10px] text-[#7e7d94] mt-4">
          Yeh account type (role) sirf Super Admin assign kar sakta hai. Roles Admin → Users tab se manage hote hain, aur club managers Clubs tab se.
        </p>
      </div>
      <p className="text-[10px] text-[#7e7d94] mt-3">
        Note: moderators/managers ko users ka personal data (email, phone, skills, resume) nahi dikhta — sirf Super Admin ko.
      </p>
    </div>
  );
}