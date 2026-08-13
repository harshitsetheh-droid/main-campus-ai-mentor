import React, { useState, useEffect } from 'react';
import {
  Users, ShieldCheck, Briefcase, MessageSquare, Trash2, UserPlus,
  UserMinus, Plus, Search, GraduationCap, BookOpen, BarChart3, Save, X, Building2
} from 'lucide-react';
import { api, AdminUser, AdminClub, ManagerClub, ManagerMessage, Drive, CompanyQuestion, CompanyQuestionMeta, Role, FacultyStats } from '../api';

const ROLES: { value: Role; label: string }[] = [
  { value: 'student', label: 'Student' },
  { value: 'placement_officer', label: 'Placement Officer' },
  { value: 'club_manager', label: 'Club Manager' },
  { value: 'faculty', label: 'Faculty' },
  { value: 'super_admin', label: 'Super Admin' },
];

interface Props {
  role: Role;
  username: string;
}

export const AdminPanel: React.FC<Props> = ({ role, username }) => {
  const [tab, setTab] = useState<string>(role === 'super_admin' ? 'users' : role === 'placement_officer' ? 'placement' : role === 'club_manager' ? 'moderation' : 'faculty');
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 3500);
  };

  const tabs: { key: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = [];
  if (role === 'super_admin') tabs.push({ key: 'users', label: 'Users', icon: Users }, { key: 'clubs', label: 'Clubs', icon: MessageSquare }, { key: 'placement', label: 'Placement', icon: Briefcase }, { key: 'moderation', label: 'Moderation', icon: ShieldCheck }, { key: 'faculty', label: 'Faculty', icon: GraduationCap });
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
        {tab === 'users' && role === 'super_admin' && <UsersTab onToast={showToast} />}
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
  const [sub, setSub] = useState<'drives' | 'questions'>('drives');

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
  const loadQ = (company?: string) => {
    api.getCompanyQuestionCompanies().then((r) => setCompanies(r.companies || [])).catch(() => {});
    api.getCompanyQuestions(company).then((r) => setQuestions(r.questions || [])).catch(() => {});
  };
  useEffect(() => { loadDrives(); loadQ(); }, []);

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
    </div>
  );
}

// ---------------------------------------------------------------- Moderation (club manager)
function ModerationTab({ onToast }: { onToast: (m: string) => void }) {
  const [clubs, setClubs] = useState<ManagerClub[]>([]);
  const [activeClub, setActiveClub] = useState<ManagerClub | null>(null);
  const [messages, setMessages] = useState<ManagerMessage[]>([]);

  useEffect(() => {
    api.getManagerClubs().then((r) => setClubs(r.clubs || [])).catch(() => {});
  }, []);

  const loadMsgs = (clubId: number) => {
    api.getManagerMessages(clubId).then((r) => setMessages(r.messages || [])).catch(() => {});
  };

  const openClub = (c: ManagerClub) => {
    setActiveClub(c);
    loadMsgs(c.id);
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
            Tum is club ke manager ho — inappropriate message delete kar sakte ho. Sender ki identity kabhi nahi dikhti (na tumhe, na kisi ko).
          </p>
        </div>
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
              <span className="text-xs font-semibold text-white w-40 truncate">{s.name}</span>
              <div className="flex-1 h-2.5 rounded-full bg-[#13131b] overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-[#5b5fef] to-[#3cd7ff]" style={{ width: `${Math.max(4, s.avg_percentage)}%` }} />
              </div>
              <span className="text-[11px] text-[#7e7d94] w-24 text-right shrink-0">{s.avg_percentage}% · {s.students} students</span>
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