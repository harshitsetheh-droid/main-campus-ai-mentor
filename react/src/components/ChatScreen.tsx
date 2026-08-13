import React, { useState, useRef, useEffect } from 'react';
import { ScreenType, ChatMessage } from '../types';
import {
  Bot, User, Sparkles, Send, MessageSquare, AlertCircle,
  FileText, Upload, ChevronRight
} from 'lucide-react';
import { api } from '../api';

interface ChatScreenProps {
  onNavigate: (screen: ScreenType, transition?: 'none' | 'push' | 'slide_up') => void;
  username?: string;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({ onNavigate, username }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputVal, setInputVal] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorNotice, setErrorNotice] = useState('');
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // resume-improvement flow
  const [resumePickerOpen, setResumePickerOpen] = useState(false);
  const [resumeNumInput, setResumeNumInput] = useState('');
  const [pickingResume, setPickingResume] = useState(false);
  const resumePanelRef = useRef<HTMLDivElement>(null);

  const openResumePicker = () => {
    setResumePickerOpen(true);
    setResumeNumInput('');
  };

  const pickResumeByNo = async (no: number) => {
    if (!no || no < 1) return;
    setPickingResume(true);
    try {
      const data = await api.getResumeAnalysisByNo(no);
      // surface it as a chat message so it is remembered in history
      const aiText =
        `Here is everything the AI found for **Resume #${data.resumeNo}** ("${data.fileName}"):\n\n` +
        `${data.atsScore != null ? `**ATS Score:** ${data.atsScore}/100\n\n` : ''}` +
        `**Skills detected on this resume:**\n${(data.skills || []).map((s) => `- ${s}`).join("\n") || '- none detected'}\n\n` +
        `**Recommended additions (to improve ATS match):**\n${(data.additions || []).map((s) => `- ${s}`).join("\n") || '- no recommendations yet — upload and analyze this resume first'}`;
      const aiMsg: ChatMessage = { id: (Date.now() + 1).toString(), sender: 'ai', text: aiText };
      setMessages((prev) => [...prev, aiMsg]);
      api.saveChatMessage('ai', aiMsg.text).catch(() => {});
    } catch (err: any) {
      setErrorNotice(err.message || 'Could not fetch that resume.');
      setTimeout(() => setErrorNotice(''), 4000);
    } finally {
      setPickingResume(false);
    }
  };

  const handleResumeNumSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const no = parseInt(resumeNumInput, 10);
    if (no >= 1) pickResumeByNo(no);
  };

  useEffect(() => {
    api.getChatMessages()
      .then((res) => {
        setMessages(
          res.messages.map((m) => ({
            id: m.id,
            sender: m.sender === 'user' ? 'user' : 'ai',
            text: m.text,
          }))
        );
      })
      .catch((err) => console.error('Failed to load chat history', err));
  }, []);

  const scrollToBottom = () => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToMessage = (msgId: string) => {
    document.getElementById('msg-' + msgId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputVal.trim();
    if (!text) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text
    };

    setMessages((prev) => [...prev, userMsg]);
    api.saveChatMessage('user', text).catch((err) => console.error('Failed to save user message', err));
    if (!textToSend) setInputVal('');
    setIsLoading(true);
    setErrorNotice('');

    try {
      const res = await api.mentor(text, messages);
      const aiReply: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: res.reply || "I'm here to help guide your academic and career goals!"
      };
      setMessages((prev) => [...prev, aiReply]);
      api.saveChatMessage('ai', aiReply.text).catch((err) => console.error('Failed to save ai reply', err));
    } catch (err: any) {
      console.error('Mentor failed', err);
      const fallbackMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: `Regarding "${text}": Focus on mastering core algorithms, building 2 verified portfolio projects, and optimizing your resume for ATS visibility!`
      };
      setMessages((prev) => [...prev, fallbackMsg]);
      setErrorNotice('The AI mentor is temporarily unavailable. Showing a generic response — please try again in a moment.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="pt-20 pb-28 px-4 max-w-7xl mx-auto flex flex-col md:flex-row gap-8 min-h-[calc(100vh-5rem)]">
      {/* Left Sidebar: Contextual Suggestions (Desktop) */}
      <aside className="hidden md:flex flex-col w-72 shrink-0 py-4 space-y-6">
        <div className="glass-panel p-5 rounded-2xl space-y-4">
          <h3 className="text-sm font-bold text-[#c0c1ff] flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#3cd7ff]" />
            <span>Contextual Insights</span>
          </h3>

          {messages.length ? (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-[#292932] border border-white/5 group">
                <p className="text-xs font-bold text-[#3cd7ff]">Personalized Roadmaps</p>
                <p className="text-[11px] text-[#c6c5d7] mt-1">
                  Ask about study plans, projects, or interview prep to get tailored guidance.
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-[#292932] border border-white/5 group">
                <p className="text-xs font-bold text-[#cdbdff]">Career Milestones</p>
                <p className="text-[11px] text-[#c6c5d7] mt-1">
                  Your mentor can help you plan your next academic and career step.
                </p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-[#c6c5d7] leading-relaxed">
              Start a conversation and your mentor will surface tailored insights here.
            </p>
          )}
        </div>

        <div className="glass-panel p-5 rounded-2xl space-y-3">
          <h3 className="text-xs font-bold text-[#c6c5d7] uppercase tracking-wider">
            Recent Chats
          </h3>

          <div className="space-y-1">
            {messages.filter((m) => m.sender === 'user').slice().reverse().map((m) => (
              <button
                key={m.id}
                onClick={() => scrollToMessage(m.id)}
                className="w-full flex items-center gap-2 p-2.5 rounded-lg text-xs text-[#c6c5d7] transition-colors hover:bg-[#5b5fef]/15 hover:text-white cursor-pointer group text-left"
              >
                <MessageSquare className="w-3.5 h-3.5 text-[#908fa0] shrink-0 group-hover:text-[#c0c1ff]" />
                <span className="truncate">{m.text}</span>
              </button>
            ))}
            {messages.filter((m) => m.sender === 'user').length === 0 && (
              <p className="text-xs text-[#c6c5d7]/70 px-2.5 py-2">No chats yet.</p>
            )}
          </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <section className="flex-1 flex flex-col py-4 max-w-3xl mx-auto w-full">
        {/* Welcome Header */}
        <div className="flex flex-col items-center justify-center text-center py-6 mb-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#5b5fef] to-[#3cd7ff] flex items-center justify-center mb-3 shadow-[0_0_20px_rgba(192,193,255,0.4)] animate-bounce">
            <Bot className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">
            Hi{username ? `, ${username}` : ''}, I'm your AI Academic Mentor.
          </h2>
          <p className="text-xs sm:text-sm text-[#c6c5d7] max-w-md">
            I can help you build study roadmaps, review code, or prepare for career milestones.
          </p>
        </div>

        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto space-y-6 pr-1 mb-4 max-h-[50vh] sm:max-h-[55vh]">
          {errorNotice && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorNotice}</span>
              <button onClick={() => setErrorNotice('')} className="ml-auto text-red-300/70 hover:text-red-300 cursor-pointer" aria-label="Dismiss">✕</button>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              id={'msg-' + msg.id}
              className={`flex items-start gap-3 max-w-[88%] sm:max-w-[82%] ${
                msg.sender === 'user' ? 'self-end flex-row-reverse ml-auto' : ''
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  msg.sender === 'user'
                    ? 'bg-[#5203d5] text-white'
                    : 'bg-[#5b5fef] text-white'
                }`}
              >
                {msg.sender === 'user' ? (
                  <User className="w-4 h-4" />
                ) : (
                  <Bot className="w-4 h-4" />
                )}
              </div>

              <div
                className={`p-4 rounded-2xl text-sm leading-relaxed ${
                  msg.sender === 'user'
                    ? 'user-bubble text-white rounded-tr-none'
                    : 'ai-bubble text-[#e4e1ed] rounded-tl-none'
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.text}</div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex items-start gap-3 max-w-[85%]">
              <div className="w-8 h-8 rounded-full bg-[#5b5fef] flex items-center justify-center text-white shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="ai-bubble p-4 rounded-2xl rounded-tl-none flex items-center gap-2 text-xs text-[#c6c5d7]">
                <div className="w-2 h-2 bg-[#c0c1ff] rounded-full animate-ping" />
                <span>Generating recommendations...</span>
              </div>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Quick Prompts Row */}
        <div className="flex gap-2 overflow-x-auto pb-3 no-scrollbar mb-2">
          <button
            onClick={openResumePicker}
            className="shrink-0 px-4 py-2 rounded-full glass-panel text-xs font-semibold text-[#c0c1ff] hover:bg-[#5b5fef]/20 transition-all border border-white/10 active:scale-95 cursor-pointer"
          >
            How do I improve my resume?
          </button>

          <button
            onClick={() => handleSendMessage('Suggest ML projects')}
            className="shrink-0 px-4 py-2 rounded-full glass-panel text-xs font-semibold text-[#c6c5d7] hover:bg-white/10 transition-all border border-white/10 active:scale-95 cursor-pointer"
          >
            Suggest ML projects
          </button>

          <button
            onClick={() => handleSendMessage('Generate roadmap')}
            className="shrink-0 px-4 py-2 rounded-full glass-panel text-xs font-semibold text-[#c6c5d7] hover:bg-white/10 transition-all border border-white/10 active:scale-95 cursor-pointer"
          >
            Generate roadmap
          </button>
        </div>

        {/* Resume Improvement Panel */}
        {resumePickerOpen && (
          <div ref={resumePanelRef} className="mb-4 glass-card rounded-2xl p-5 border border-[#c0c1ff]/30">
            <div className="flex items-start justify-between gap-3 mb-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#c0c1ff]" />
                <span>Improve a Resume</span>
              </h4>
              <button
                onClick={() => setResumePickerOpen(false)}
                className="text-[#c6c5d7] hover:text-white text-lg leading-none cursor-pointer"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <p className="text-xs text-[#c6c5d7] mb-3">
              Apne uploaded resume ka number daalo — main uski saari recommended skills dikhaunga jo pehle analyze ho chuki hain.
            </p>

            {/* Number input */}
            <form onSubmit={handleResumeNumSubmit} className="flex gap-2 mb-3">
              <input
                type="number"
                min={1}
                value={resumeNumInput}
                onChange={(e) => setResumeNumInput(e.target.value)}
                placeholder="Resume number (e.g. 1)"
                className="flex-1 px-3 py-2 bg-[#13131b] text-white text-sm rounded-lg border border-white/10 focus:outline-none focus:border-[#c0c1ff]/50"
              />
              <button
                type="submit"
                disabled={pickingResume}
                className="shrink-0 px-4 py-2 bg-[#5b5fef] text-white text-sm rounded-lg font-medium hover:opacity-90 transition-all cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
              >
                {pickingResume ? (
                  <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Loading</>
                ) : (
                  <><ChevronRight className="w-4 h-4" /> Show</>
                )}
              </button>
            </form>

            {/* Upload option */}
            <button
              onClick={() => { setResumePickerOpen(false); onNavigate('resume', 'push'); }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#3cd7ff]/10 text-[#3cd7ff] border border-[#3cd7ff]/30 text-sm rounded-lg font-medium hover:bg-[#3cd7ff]/20 transition-all cursor-pointer"
            >
              <Upload className="w-4 h-4" /> Upload a new resume
            </button>
          </div>
        )}

        {/* Input Form */}
        <div className="relative">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="glass-panel rounded-full px-5 py-2.5 flex items-center gap-3 shadow-[0_10px_30px_rgba(0,0,0,0.3)] group focus-within:ring-2 focus-within:ring-[#5b5fef]/50 transition-all"
          >
            <Sparkles className="w-5 h-5 text-[#c0c1ff] group-focus-within:animate-pulse" />
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="Ask your mentor anything..."
              className="bg-transparent border-none outline-none focus:outline-none focus:ring-0 flex-1 min-w-0 text-sm text-white placeholder-[#c6c5d7]/50"
            />
            <button
              type="submit"
              disabled={!inputVal.trim() || isLoading}
              className="w-9 h-9 rounded-full bg-gradient-to-br from-[#5b5fef] to-[#3cd7ff] flex items-center justify-center text-white shadow-md active:scale-90 transition-all disabled:opacity-40 cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </section>
    </main>
  );
};
