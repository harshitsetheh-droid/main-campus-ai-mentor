import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, ChevronLeft, Send, Users, ShieldCheck, Smile, UserPlus, Check } from 'lucide-react';
import { api, Club, ClubMessage } from '../api';

const QUICK_EMOJIS = ['😂', '🔥', '💀', '😭', '👀', '🥵', '🤡', '🙏', '✅', '❌', '💯', '🤐', '😤', '🫡', '☕', '🤝'];

interface Props {
  onNavigate?: (screen: 'friends', transition: 'none' | 'push' | 'slide_up', dmTarget?: { id: number; handle: string }) => void;
}

function formatTime(value?: string): string {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export const ClubScreen: React.FC<Props> = ({ onNavigate }) => {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [activeClub, setActiveClub] = useState<Club | null>(null);
  const [messages, setMessages] = useState<ClubMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [toast, setToast] = useState('');
  const [pming, setPming] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef(messages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const loadMessages = (after?: number) => {
    if (!activeClub) return;
    api.getClubMessages(activeClub.id, after)
      .then((res) => {
        if (after) {
          setMessages((prev) => {
            const existing = new Set(prev.map((m) => m.id));
            const fresh = (res.messages || []).filter((m) => !existing.has(m.id));
            return fresh.length ? [...prev, ...fresh] : prev;
          });
        } else {
          setMessages(res.messages || []);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    api.getClubs()
      .then((res) => setClubs(res.clubs || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!activeClub) return;
    setMessages([]);
    loadMessages();
    const id = setInterval(() => {
      const last = messagesRef.current.length ? messagesRef.current[messagesRef.current.length - 1].id : undefined;
      loadMessages(last);
    }, 4000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClub?.id]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClub || !text.trim() || sending) return;
    setSending(true);
    setError('');
    try {
      const res = await api.sendClubMessage(activeClub.id, text.trim());
      setMessages((prev) => [...prev, res.message]);
      setText('');
      setShowEmoji(false);
    } catch (err: any) {
      setError(err.message || 'Could not send message');
    } finally {
      setSending(false);
    }
  };

  // PM a specific (still anonymous) student from the club room
  const pmStudent = async (m: ClubMessage) => {
    if (!m.senderUid || pming !== null) return;
    setPming(m.senderUid);
    try {
      const res = await api.sendFriendRequest({ uid: m.senderUid });
      if (res.relation === 'friends') {
        onNavigate?.('friends', 'push', res.friend);
      } else if (res.relation === 'requested') {
        setToast(`Request sent to ${res.toHandle} — approve hote hi private chat`);
      } else {
        setToast('Request already pending — unka approval wait karo');
      }
    } catch (err: any) {
      setToast(err.message || 'Could not send request');
    } finally {
      setPming(null);
      window.setTimeout(() => setToast(''), 3500);
    }
  };

  // Join/Leave keep the member count accurate: only real joins count
  const joinClub = async (c: Club) => {
    try {
      const res = await api.joinClub(c.id);
      if (activeClub && activeClub.id === c.id) setActiveClub({ ...activeClub, joined: true, members: res.members });
      setClubs((prev) => prev.map((x) => (x.id === c.id ? { ...x, joined: true, members: res.members } : x)));
      setToast(`Joined ${c.name} - members: ${res.members}`);
    } catch (err: any) {
      setToast(err.message || 'Could not join');
    }
    window.setTimeout(() => setToast(''), 3500);
  };

  const leaveClub = async (c: Club) => {
    try {
      const res = await api.leaveClub(c.id);
      if (activeClub && activeClub.id === c.id) setActiveClub({ ...activeClub, joined: false, members: res.members });
      setClubs((prev) => prev.map((x) => (x.id === c.id ? { ...x, joined: false, members: res.members } : x)));
      setToast(`Left ${c.name} - members: ${res.members}`);
    } catch (err: any) {
      setToast(err.message || 'Could not leave');
    }
    window.setTimeout(() => setToast(''), 3500);
  };

  // --- Club list view ---
  if (!activeClub) {
    return (
      <main className="pt-20 pb-28 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        <section className="glass-panel p-6 sm:p-8 rounded-3xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#5b5fef]/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#3cd7ff]/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#5b5fef]/20 border border-[#5b5fef]/40 text-[#c0c1ff] text-xs font-semibold mb-3">
              <MessageSquare className="w-3.5 h-3.5 text-[#3cd7ff]" />
              <span>MBM University · Anonymous Clubs</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight flex items-center gap-3 flex-wrap">
              Student Clubs
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-full normal-case">
                <ShieldCheck className="w-3.5 h-3.5" /> 100% anonymous
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-[#c6c5d7] mt-1 max-w-2xl">
              Apna mask pehno aur baat karo — koi nahi jaanta ki tum kaun ho. Sirf text aur emoji bhej sakte ho. Identity kabhi reveal nahi hoti.
            </p>
          </div>
        </section>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {clubs.map((c) => (
            <div
              key={c.id}
              onClick={() => setActiveClub(c)}
              className="text-left bg-[#191924] rounded-2xl border border-white/10 p-5 hover:border-[#c0c1ff]/40 hover:bg-[#1d1d2a] transition-all cursor-pointer group"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="text-3xl">{c.emoji}</span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#c6c5d7] bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
                  <Users className="w-3 h-3" /> {c.members || 0} members
                </span>
              </div>
              <h3 className="font-bold text-white text-sm mt-3 group-hover:text-[#c0c1ff] transition-colors">{c.name}</h3>
              <p className="text-xs text-[#c6c5d7] mt-1.5 leading-relaxed">{c.description}</p>
              <div className="mt-3 flex items-center justify-between gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (c.joined) leaveClub(c);
                    else joinClub(c);
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    c.joined
                      ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
                      : 'bg-gradient-to-r from-[#5b5fef] to-[#3cd7ff] text-white hover:scale-105'
                  }`}
                >
                  {c.joined ? (
                    <>
                      <Check className="w-3.5 h-3.5" /> Joined
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3.5 h-3.5" /> Join
                    </>
                  )}
                </button>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[#3cd7ff] uppercase tracking-wide">
                  Open <ChevronLeft className="w-3.5 h-3.5 rotate-180 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
            </div>
          ))}
        </div>
      </main>
    );
  }

  // --- Chat view ---
  return (
    <main className="pt-20 pb-28 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">
      <section className="rounded-3xl overflow-hidden border border-white/10 glass-panel">
        <div className="p-4 sm:p-5 border-b border-white/10 bg-[#181824]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setActiveClub(null)}
                className="shrink-0 w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all cursor-pointer"
                title="Back to clubs"
              >
                <ChevronLeft className="w-5 h-5 text-white" />
              </button>
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#5b5fef] to-[#3cd7ff] flex items-center justify-center text-xl shrink-0 shadow-md">
                {activeClub.emoji}
              </div>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-extrabold text-white truncate">{activeClub.name}</h1>
                <p className="text-[11px] text-[#c6c5d7] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Anonymous · {messages.length} messages · {activeClub.members} members
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                <ShieldCheck className="w-3.5 h-3.5" /> Identity hidden
              </span>
              <button
                onClick={() => (activeClub.joined ? leaveClub(activeClub) : joinClub(activeClub))}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeClub.joined
                    ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
                    : 'bg-gradient-to-r from-[#5b5fef] to-[#3cd7ff] text-white hover:scale-105'
                }`}
              >
                {activeClub.joined ? (
                  <>
                    <Check className="w-3.5 h-3.5" /> Joined
                  </>
                ) : (
                  <>
                    <UserPlus className="w-3.5 h-3.5" /> Join
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <div ref={listRef} className="h-[calc(100vh-380px)] min-h-[280px] max-h-[55vh] overflow-y-auto p-4 space-y-3 bg-[#13131b]">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center px-6">
              <span className="text-4xl mb-3">{activeClub.emoji}</span>
              <p className="text-sm font-semibold text-white">No messages yet</p>
              <p className="text-xs text-[#c6c5d7] mt-1 max-w-xs">
                Koi nahi jaanta ki tum ho — pehli baat karo, anonymously!
              </p>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.isMine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] sm:max-w-[75%] flex flex-col ${m.isMine ? 'items-end' : 'items-start'}`}>
                <div className={`flex items-center gap-2 mb-1 px-1 ${m.isMine ? 'flex-row-reverse' : ''}`}>
                  <span className="text-[10px] font-bold text-[#3cd7ff] uppercase tracking-wide truncate max-w-[140px]">
                    {m.isMine ? 'You' : m.handle}
                  </span>
                  <span className="text-[9px] text-[#7e7d94]">{formatTime(m.createdAt)}</span>
                </div>
                <div className="flex items-end gap-2">
                  <div
                    className={`px-3.5 py-2.5 rounded-2xl text-sm break-words whitespace-pre-wrap shadow-sm ${
                      m.isMine
                        ? 'bg-gradient-to-br from-[#5b5fef] to-[#5203d5] text-white rounded-br-md'
                        : 'bg-[#1d1d28] border border-white/10 text-white rounded-bl-md'
                    }`}
                  >
                    {m.text}
                  </div>
                  {!m.isMine && (
                    <button
                      onClick={() => pmStudent(m)}
                      disabled={pming !== null}
                      className="shrink-0 w-8 h-8 rounded-lg bg-[#181824] border border-white/10 flex items-center justify-center text-[#c6c5d7] hover:text-[#3cd7ff] hover:border-[#3cd7ff]/40 transition-all cursor-pointer"
                      title={`PM ${m.handle} (anonymous private chat)`}
                    >
                      <UserPlus className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {activeClub.joined ? (
          <>
            {showEmoji && (
              <div className="px-3 pt-3 bg-[#181824] flex flex-wrap gap-1.5 border-t border-white/10">
                {QUICK_EMOJIS.map((em) => (
                  <button
                    key={em}
                    onClick={() => setText((t) => t + em)}
                    className="text-xl hover:scale-125 transition-all cursor-pointer p-0.5"
                  >
                    {em}
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={send} className="p-3 sm:p-4 border-t border-white/10 bg-[#181824] flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setShowEmoji((v) => !v)}
                className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all cursor-pointer border ${
                  showEmoji ? 'bg-[#5b5fef]/20 border-[#5b5fef]/50 text-[#c0c1ff]' : 'bg-white/5 border-white/10 text-[#c6c5d7] hover:text-white'
                }`}
                title="Emoji"
              >
                <Smile className="w-5 h-5" />
              </button>
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Kuch bhi bolo — sirf text aur emoji…"
                maxLength={300}
                className="flex-1 min-w-0 bg-[#13131b] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#6b6b7d] focus:outline-none focus:border-[#c0c1ff]"
              />
              <button
                type="submit"
                disabled={sending || !text.trim()}
                className="shrink-0 w-11 h-11 rounded-xl bg-gradient-to-r from-[#5b5fef] to-[#3cd7ff] text-white flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-all disabled:opacity-40 disabled:hover:scale-100 cursor-pointer"
                title="Send"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </>
        ) : (
          <div className="p-4 sm:p-5 border-t border-white/10 bg-[#181824] text-center">
            <p className="text-sm font-bold text-white">{activeClub.name} mein chat karne ke liye join karo</p>
            <p className="text-xs text-[#c6c5d7] mt-1">Message send karne ke liye membership chahiye — member count bhi sirf joiners ke hisaab se.</p>
            <button
              onClick={() => joinClub(activeClub)}
              className="mt-3 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#5b5fef] to-[#3cd7ff] text-white text-sm font-bold flex items-center gap-1.5 mx-auto hover:scale-105 transition-all cursor-pointer"
            >
              <UserPlus className="w-4 h-4" /> Join {activeClub.name}
            </button>
          </div>
        )}
        {error && <p className="px-4 pb-2 text-xs text-rose-300 bg-[#181824]">{error}</p>}
      </section>

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[95] bg-[#1d1d28] border border-[#c0c1ff]/40 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-2xl">
          {toast}
        </div>
      )}
    </main>
  );
};