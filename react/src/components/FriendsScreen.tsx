import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageSquare, ChevronLeft, Send, Smile, ShieldCheck, UserPlus,
  QrCode, ScanLine, Check, X, Ban, Users, Camera, Search, UserCheck
} from 'lucide-react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { api, Friend, ChatRequestItem, DmMessage } from '../api';

const QUICK_EMOJIS = ['😂', '🔥', '💀', '😭', '👀', '🥵', '🤡', '🙏', '✅', '❌', '💯', '🤐', '😤', '🫡', '☕', '🤝'];

type Tab = 'friends' | 'requests' | 'qr';

interface Props {
  onNavigate?: (screen: 'friends', transition: 'none' | 'push' | 'slide_up', dmTarget?: { id: number; handle: string }) => void;
  initialDmTarget?: { id: number; handle: string } | null;
}

function formatTime(value?: string): string {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export const FriendsScreen: React.FC<Props> = ({ onNavigate, initialDmTarget }) => {
  const [tab, setTab] = useState<Tab>('friends');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [blocked, setBlocked] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<ChatRequestItem[]>([]);
  const [outgoing, setOutgoing] = useState<ChatRequestItem[]>([]);
  const [searchName, setSearchName] = useState('');
  const [searchBusy, setSearchBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [blockTarget, setBlockTarget] = useState<Friend | null>(null);

  const [activeDm, setActiveDm] = useState<Friend | null>(null);
  const [dmMessages, setDmMessages] = useState<DmMessage[]>([]);
  const [dmText, setDmText] = useState('');
  const [dmSending, setDmSending] = useState(false);
  const [dmError, setDmError] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const dmMessagesRef = useRef<DmMessage[]>([]);
  useEffect(() => { dmMessagesRef.current = dmMessages; }, [dmMessages]);

  const [qrDataUrl, setQrDataUrl] = useState('');
  const [scanning, setScanning] = useState(false);
  const [camError, setCamError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 3500);
  };

  const initialConsumedRef = useRef(false);

  const refreshAll = useCallback(() => {
    api.getFriends().then((r) => {
      const list = r.friends || [];
      setFriends(list);
      if (!initialConsumedRef.current && initialDmTarget) {
        const match = list.find((f) => f.id === initialDmTarget.id);
        if (match) {
          initialConsumedRef.current = true;
          setActiveDm(match);
        }
      }
    }).catch(() => {});
    api.getChatRequests().then((r) => {
      setIncoming(r.incoming || []);
      setOutgoing(r.outgoing || []);
    }).catch(() => {});
    api.getBlockedFriends().then((r) => setBlocked(r.blocked || [])).catch(() => {});
  }, [initialDmTarget]);

  useEffect(() => {
    refreshAll();
    const id = setInterval(refreshAll, 8000);
    return () => clearInterval(id);
  }, [refreshAll]);

  // ---- QR ----
  useEffect(() => {
    if (tab !== 'qr') return;
    api.getMyQrCode()
      .then((r) => QRCode.toDataURL(r.code, { margin: 1, width: 230, color: { dark: '#13131b', light: '#ffffff' } }))
      .then((url) => setQrDataUrl(url))
      .catch(() => setQrDataUrl(''));
  }, [tab]);

  const stopCamera = useCallback(() => {
    if (scanTimerRef.current) { clearInterval(scanTimerRef.current); scanTimerRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    setScanning(false);
  }, []);

  const startScan = async () => {
    setCamError('');
    setScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      scanTimerRef.current = window.setInterval(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || !video.videoWidth) return;
        const w = video.videoWidth;
        const h = video.videoHeight;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(video, 0, 0, w, h);
        try {
          const code = jsQR(ctx.getImageData(0, 0, w, h).data, w, h);
          if (code && code.data) {
            stopCamera();
            api.sendFriendRequest({ code: code.data })
              .then((res) => {
                if (res.relation === 'friends') {
                  setFriends((prev) => (prev.some((f) => f.id === res.friend.id) ? prev : [...prev, res.friend]));
                  showToast(`Already friends with ${res.friend.handle}`);
                } else if (res.relation === 'requested') {
                  showToast(`Request sent to ${res.toHandle} — friend after approval`);
                } else {
                  showToast('Request already pending — waiting for their approval');
                }
                refreshAll();
              })
              .catch((err) => showToast(err.message || 'Could not send request'));
          }
        } catch {
          /* frame too early — ignore */
        }
      }, 180);
    } catch (err) {
      setCamError('Camera access denied or unavailable. Use username search or QR share instead.');
      setScanning(false);
    }
  };

  useEffect(() => () => stopCamera(), [stopCamera]);

  // ---- DMs ----
  const loadDm = (after?: number) => {
    if (!activeDm) return;
    api.getDmMessages(activeDm.id, after)
      .then((r) => {
        if (after) {
          setDmMessages((prev) => {
            const existing = new Set(prev.map((m) => m.id));
            const fresh = (r.messages || []).filter((m) => !existing.has(m.id));
            return fresh.length ? [...prev, ...fresh] : prev;
          });
        } else {
          setDmMessages(r.messages || []);
        }
      })
      .catch((err) => { if (!after) setDmError(err.message || ''); });
  };

  useEffect(() => {
    if (!activeDm) return;
    setDmMessages([]);
    setDmError('');
    setDmText('');
    loadDm();
    const id = setInterval(() => {
      const last = dmMessagesRef.current.length ? dmMessagesRef.current[dmMessagesRef.current.length - 1].id : undefined;
      loadDm(last);
    }, 3500);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDm?.id]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [dmMessages]);

  const sendDm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDm || !dmText.trim() || dmSending) return;
    setDmSending(true);
    setDmError('');
    try {
      const res = await api.sendDmMessage(activeDm.id, dmText.trim());
      setDmMessages((prev) => [...prev, res.message]);
      setDmText('');
      setShowEmoji(false);
    } catch (err: any) {
      setDmError(err.message || 'Could not send');
    } finally {
      setDmSending(false);
    }
  };

  const sendRequestByName = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = searchName.trim();
    if (!name || searchBusy) return;
    setSearchBusy(true);
    try {
      const res = await api.sendFriendRequest({ username: name });
      if (res.relation === 'friends') {
        setFriends((prev) => (prev.some((f) => f.id === res.friend.id) ? prev : [...prev, res.friend]));
        showToast(`Already friends with ${res.friend.handle}`);
      } else if (res.relation === 'requested') {
        showToast(`Request sent to ${res.toHandle}`);
        refreshAll();
      } else {
        showToast('Request already pending — waiting for their approval');
      }
      setSearchName('');
    } catch (err: any) {
      showToast(err.message || 'Request failed');
    } finally {
      setSearchBusy(false);
    }
  };

  const acceptReq = async (id: number) => {
    try {
      const res = await api.acceptFriendRequest(id);
      setFriends((prev) => [...prev, res.friend]);
      refreshAll();
      showToast(`You can now chat with ${res.friend.handle}`);
    } catch (err: any) {
      showToast(err.message || 'Could not accept');
    }
  };

  const declineReq = async (id: number) => {
    try {
      await api.declineFriendRequest(id);
      refreshAll();
      showToast('Request rejected — sender can try again after 5 minutes');
    } catch (err: any) {
      showToast(err.message || 'Could not decline');
    }
  };

  const doBlock = async () => {
    if (!blockTarget) return;
    try {
      await api.blockFriend(blockTarget.id);
      setFriends((prev) => prev.filter((f) => f.id !== blockTarget.id));
      setBlocked((prev) => (prev.some((b) => b.id === blockTarget!.id) ? prev : [...prev, blockTarget!]));
      if (activeDm && activeDm.id === blockTarget.id) setActiveDm(null);
      showToast(`${blockTarget.handle} blocked`);
    } catch (err: any) {
      showToast(err.message || 'Could not block');
    }
    setBlockTarget(null);
  };

  const doUnblock = async (id: number) => {
    try {
      await api.unblockFriend(id);
      setBlocked((prev) => prev.filter((b) => b.id !== id));
      showToast('Unblocked — you can send a request again');
    } catch (err: any) {
      showToast(err.message || 'Could not unblock');
    }
  };

  // ---- DM chat view ----
  if (activeDm) {
    return (
      <main className="pt-20 pb-28 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">
        <section className="rounded-3xl overflow-hidden border border-white/10 glass-panel">
          <div className="p-4 sm:p-5 border-b border-white/10 bg-[#181824]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => setActiveDm(null)}
                  className="shrink-0 w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all cursor-pointer"
                  title="Back to friends"
                >
                  <ChevronLeft className="w-5 h-5 text-white" />
                </button>
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#5b5fef] to-[#3cd7ff] flex items-center justify-center text-lg font-extrabold text-white shrink-0 shadow-md">
                  {activeDm.handle.split(' ')[1] || '?'}
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-xl font-extrabold text-white truncate">{activeDm.handle}</h1>
                  <p className="text-[11px] text-[#c6c5d7] flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Anonymous DM · friend
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                  <ShieldCheck className="w-3.5 h-3.5" /> Identity hidden
                </span>
                <button
                  onClick={() => setBlockTarget(activeDm)}
                  className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-300 hover:bg-rose-500/20 transition-all cursor-pointer"
                  title="Block"
                >
                  <Ban className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div ref={listRef} className="h-[calc(100vh-380px)] min-h-[280px] max-h-[55vh] overflow-y-auto p-4 space-y-3 bg-[#13131b]">
            {dmMessages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center px-6">
                <UserCheck className="w-10 h-10 text-[#3cd7ff] mb-3" />
                <p className="text-sm font-semibold text-white">You're now friends</p>
                <p className="text-xs text-[#c6c5d7] mt-1 max-w-xs">
                  Start messaging — {activeDm.handle} won't see your name either, only your anonymous handle.
                </p>
              </div>
            )}
            {dmMessages.map((m) => (
              <div key={m.id} className={`flex ${m.isMine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] sm:max-w-[75%] flex flex-col ${m.isMine ? 'items-end' : 'items-start'}`}>
                  <div className={`flex items-center gap-2 mb-1 px-1 ${m.isMine ? 'flex-row-reverse' : ''}`}>
                    <span className="text-[10px] font-bold text-[#3cd7ff] uppercase tracking-wide truncate max-w-[140px]">
                      {m.isMine ? 'You' : m.handle}
                    </span>
                    <span className="text-[9px] text-[#7e7d94]">{formatTime(m.createdAt)}</span>
                  </div>
                  <div
                    className={`px-3.5 py-2.5 rounded-2xl text-sm break-words whitespace-pre-wrap shadow-sm ${
                      m.isMine
                        ? 'bg-gradient-to-br from-[#5b5fef] to-[#5203d5] text-white rounded-br-md'
                        : 'bg-[#1d1d28] border border-white/10 text-white rounded-bl-md'
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {showEmoji && (
            <div className="px-3 pt-3 bg-[#181824] flex flex-wrap gap-1.5 border-t border-white/10">
              {QUICK_EMOJIS.map((em) => (
                <button
                  key={em}
                  onClick={() => setDmText((t) => t + em)}
                  className="text-xl hover:scale-125 transition-all cursor-pointer p-0.5"
                >
                  {em}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={sendDm} className="p-3 sm:p-4 border-t border-white/10 bg-[#181824] flex items-center gap-2 sm:gap-3">
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
              value={dmText}
              onChange={(e) => setDmText(e.target.value)}
              placeholder="Send an anonymous message — text + emoji only…"
              maxLength={300}
              className="flex-1 min-w-0 bg-[#13131b] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#6b6b7d] focus:outline-none focus:border-[#c0c1ff]"
            />
            <button
              type="submit"
              disabled={dmSending || !dmText.trim()}
              className="shrink-0 w-11 h-11 rounded-xl bg-gradient-to-r from-[#5b5fef] to-[#3cd7ff] text-white flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-all disabled:opacity-40 disabled:hover:scale-100 cursor-pointer"
              title="Send"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
          {dmError && <p className="px-4 pb-2 text-xs text-rose-300 bg-[#181824]">{dmError}</p>}
        </section>

        {/* Block confirm */}
        {blockTarget && (
          <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#1d1d28] border border-white/10 rounded-2xl p-6 max-w-sm w-full">
              <div className="flex items-center gap-2 mb-2">
                <Ban className="w-5 h-5 text-rose-400" />
                <h3 className="font-extrabold text-white">Block {blockTarget.handle}?</h3>
              </div>
              <p className="text-sm text-[#c6c5d7]">
                Blocking removes the friendship, stops messages, and they can't send you another request. You can unblock anytime.
              </p>
              <div className="mt-5 flex gap-3">
                <button
                  onClick={() => setBlockTarget(null)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-semibold hover:bg-white/10 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={doBlock}
                  className="flex-1 py-2.5 rounded-xl bg-rose-500 text-white text-sm font-semibold hover:bg-rose-400 transition-all cursor-pointer"
                >
                  Block
                </button>
              </div>
            </div>
          </div>
        )}

        {toast && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[95] bg-[#1d1d28] border border-[#c0c1ff]/40 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-2xl">
            {toast}
          </div>
        )}
      </main>
    );
  }

  // ---- Main view ----
  return (
    <main className="pt-20 pb-28 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      <section className="glass-panel p-6 sm:p-8 rounded-3xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#5b5fef]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#3cd7ff]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#5b5fef]/20 border border-[#5b5fef]/40 text-[#c0c1ff] text-xs font-semibold mb-3">
            <Users className="w-3.5 h-3.5 text-[#3cd7ff]" />
            <span>Anonymous Network · MBM University</span>
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight flex items-center gap-3 flex-wrap">
            Friends
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-full normal-case">
              <ShieldCheck className="w-3.5 h-3.5" /> Names never shown
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-[#c6c5d7] mt-1 max-w-2xl">
            Send a chat request — once approved, you're both in each other's friend list, no repeat requests. Real names are never shown, and QR scans send the request instantly.
          </p>
        </div>
      </section>

      {/* Tabs */}
      <div className="mt-6 flex flex-wrap gap-2">
        {([
          ['friends', 'Friends', Users],
          ['requests', `Requests${incoming.length ? ` (${incoming.length})` : ''}`, UserPlus],
          ['qr', 'QR', QrCode],
        ] as [Tab, string, React.ComponentType<{ className?: string }>][]).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer border ${
              tab === key
                ? 'bg-[#5b5fef]/20 border-[#5b5fef]/50 text-[#c0c1ff]'
                : 'bg-white/5 border-white/10 text-[#c6c5d7] hover:text-white'
            }`}
          >
            <span className="flex items-center gap-1.5"><Icon className="w-4 h-4" />{label}</span>
          </button>
        ))}
      </div>

      {/* Friends tab */}
      {tab === 'friends' && (
        <div className="mt-5 space-y-4">
          {friends.length === 0 && blocked.length === 0 && (
            <div className="glass-panel rounded-2xl p-8 text-center">
              <Users className="w-10 h-10 text-[#3cd7ff] mx-auto mb-3" />
              <p className="text-sm font-semibold text-white">No friends yet</p>
              <p className="text-xs text-[#c6c5d7] mt-1 max-w-md mx-auto">
                Tap PM on any club message, send a request by username, or scan a QR — once approved, they appear in your friend list.
              </p>
            </div>
          )}
          {friends.map((f) => (
            <div key={f.id} className="glass-panel rounded-2xl p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#5b5fef] to-[#3cd7ff] flex items-center justify-center text-lg font-extrabold text-white shrink-0">
                  {f.handle.split(' ')[1] || '?'}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-white text-sm truncate">{f.handle}</p>
                  <p className="text-[11px] text-emerald-300 font-semibold">Friend · anonymous</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setActiveDm(f)}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#5b5fef] to-[#3cd7ff] text-white text-xs font-bold flex items-center gap-1.5 hover:scale-105 transition-all cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5" /> Chat
                </button>
                <button
                  onClick={() => setBlockTarget(f)}
                  className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[#c6c5d7] hover:text-rose-300 hover:border-rose-500/40 transition-all cursor-pointer"
                  title="Block"
                >
                  <Ban className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          {blocked.length > 0 && (
            <div className="mt-6">
              <p className="text-[11px] font-bold text-[#7e7d94] uppercase tracking-wider mb-2">Blocked</p>
              {blocked.map((b) => (
                <div key={b.id} className="glass-panel rounded-2xl p-4 flex items-center justify-between gap-3 opacity-80">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-[#2a2a38] flex items-center justify-center text-lg font-extrabold text-[#7e7d94] shrink-0">
                      {b.handle.split(' ')[1] || '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-white text-sm truncate">{b.handle}</p>
                      <p className="text-[11px] text-rose-300 font-semibold">Blocked</p>
                    </div>
                  </div>
                  <button
                    onClick={() => doUnblock(b.id)}
                    className="px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-bold hover:bg-white/10 transition-all cursor-pointer shrink-0"
                  >
                    Unblock
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Requests tab */}
      {tab === 'requests' && (
        <div className="mt-5 space-y-5">
          <form onSubmit={sendRequestByName} className="glass-panel rounded-2xl p-4">
            <p className="text-xs font-bold text-[#c6c5d7] uppercase tracking-wider mb-2">Send request by username</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                placeholder="Enter username (e.g. rahul_joshi)"
                maxLength={60}
                className="flex-1 min-w-0 bg-[#13131b] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#6b6b7d] focus:outline-none focus:border-[#c0c1ff]"
              />
              <button
                type="submit"
                disabled={searchBusy || !searchName.trim()}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#5b5fef] to-[#3cd7ff] text-white text-sm font-bold flex items-center gap-1.5 disabled:opacity-40 transition-all cursor-pointer"
              >
                <Search className="w-4 h-4" /> Send
              </button>
            </div>
            <p className="text-[10px] text-[#7e7d94] mt-2">
              After approval you're both in each other's friend list — no need to send repeated requests.
            </p>
          </form>

          {incoming.length === 0 && outgoing.length === 0 && (
            <div className="glass-panel rounded-2xl p-8 text-center">
              <UserPlus className="w-10 h-10 text-[#3cd7ff] mx-auto mb-3" />
              <p className="text-sm font-semibold text-white">No pending requests</p>
            </div>
          )}

          {incoming.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-[#7e7d94] uppercase tracking-wider mb-2">Incoming ({incoming.length})</p>
              {incoming.map((r) => (
                <div key={r.id} className="glass-panel rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#5b5fef] to-[#3cd7ff] flex items-center justify-center text-lg font-extrabold text-white shrink-0">
                      {r.fromHandle?.split(' ')[1] || '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-white text-sm truncate">{r.fromHandle} wants to chat with you</p>
                      <p className="text-[11px] text-[#7e7d94]">Adds them to your friend list when approved</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    <button
                      onClick={() => acceptReq(r.id)}
                      className="px-3.5 py-2 rounded-xl bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 hover:bg-emerald-400 transition-all cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" /> Accept
                    </button>
                    <button
                      onClick={() => declineReq(r.id)}
                      className="px-3.5 py-2 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-1.5 hover:bg-rose-500/25 transition-all cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" /> Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {outgoing.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-[#7e7d94] uppercase tracking-wider mb-2">Outgoing</p>
              {outgoing.map((r) => (
                <div key={r.id} className="glass-panel rounded-2xl p-4 flex items-center gap-3 mb-3 opacity-85">
                  <div className="w-11 h-11 rounded-2xl bg-[#2a2a38] flex items-center justify-center text-lg font-extrabold text-[#7e7d94] shrink-0">
                    {r.toHandle?.split(' ')[1] || '?'}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-white text-sm truncate">{r.toHandle}</p>
                    <p className="text-[11px] text-amber-300 font-semibold">
                      {r.status === 'pending' ? 'Pending — waiting for approval' : 'Rejected · 5 min cooldown'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* QR tab */}
      {tab === 'qr' && (
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="glass-panel rounded-2xl p-6 text-center">
            <p className="text-xs font-bold text-[#c6c5d7] uppercase tracking-wider mb-3">My QR Code</p>
            <div className="w-52 h-52 mx-auto rounded-2xl overflow-hidden border-4 border-white/20 bg-white p-2">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="My QR code" className="w-full h-full rounded-lg" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[#7e7d94] text-xs">Loading…</div>
              )}
            </div>
            <p className="text-[11px] text-[#7e7d94] mt-3">
              This QR is unique and permanent. Anyone who scans it automatically sends you a chat request — your name is never shown.
            </p>
          </div>
          <div className="glass-panel rounded-2xl p-6 flex flex-col">
            <p className="text-xs font-bold text-[#c6c5d7] uppercase tracking-wider mb-3">Scan someone else's QR</p>
            <p className="text-sm text-[#c6c5d7] mb-4">
              Open the camera and point it at their QR — the request is sent instantly and they appear in your friend list once approved.
            </p>
            <button
              onClick={startScan}
              disabled={scanning}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-[#5b5fef] to-[#3cd7ff] text-white text-sm font-bold shadow-md hover:scale-105 transition-all disabled:opacity-40 cursor-pointer"
            >
              <ScanLine className="w-4 h-4" /> {scanning ? 'Scanning…' : 'Scan QR'}
            </button>
            {camError && <p className="text-xs text-rose-300 mt-3">{camError}</p>}

            {scanning && (
              <div className="mt-4 relative rounded-2xl overflow-hidden bg-black">
                <video ref={videoRef} className="w-full h-64 object-cover" muted playsInline />
                <canvas ref={canvasRef} className="hidden" />
                <div className="absolute inset-0 border-4 border-[#3cd7ff]/70 rounded-2xl pointer-events-none" />
                <div className="absolute bottom-2 inset-x-0 text-center text-[11px] font-bold text-white bg-black/50 py-1">
                  Hold the QR inside the frame…
                </div>
              </div>
            )}
            {scanning && (
              <button
                onClick={stopCamera}
                className="mt-3 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-semibold hover:bg-white/10 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" /> Cancel scan
              </button>
            )}
          </div>
        </div>
      )}

      {/* Block confirm (main view) */}
      {blockTarget && (
        <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1d1d28] border border-white/10 rounded-2xl p-6 max-w-sm w-full">
            <div className="flex items-center gap-2 mb-2">
              <Ban className="w-5 h-5 text-rose-400" />
              <h3 className="font-extrabold text-white">Block {blockTarget.handle}?</h3>
            </div>
            <p className="text-sm text-[#c6c5d7]">
              Blocking removes the friendship, stops messages, and they can't send you another request. You can unblock anytime.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setBlockTarget(null)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-semibold hover:bg-white/10 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={doBlock}
                className="flex-1 py-2.5 rounded-xl bg-rose-500 text-white text-sm font-semibold hover:bg-rose-400 transition-all cursor-pointer"
              >
                Block
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[95] bg-[#1d1d28] border border-[#c0c1ff]/40 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-2xl">
          {toast}
        </div>
      )}
    </main>
  );
};