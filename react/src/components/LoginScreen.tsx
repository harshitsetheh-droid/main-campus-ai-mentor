import React, { useState } from 'react';
import { Sparkles, Mail, Lock, LogIn, ArrowRight, Brain } from 'lucide-react';
import { api, AuthUser } from '../api';

interface LoginScreenProps {
  onSuccess: (user: AuthUser) => void;
  onSwitchToSignup: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onSuccess, onSwitchToSignup }) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const res = await api.login(identifier, password);
      sessionStorage.setItem('campusai_token', res.token);
      sessionStorage.setItem('campusai_user', JSON.stringify(res.user));
      localStorage.removeItem('campusai_token');
      localStorage.removeItem('campusai_user');
      onSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#13131b] text-[#e4e1ed] relative overflow-hidden flex items-center justify-center px-4">
      {/* Background blobs */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#5b5fef]/15 rounded-full blur-[140px]" />
        <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-[#3cd7ff]/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <Sparkles className="w-8 h-8 text-[#c0c1ff]" />
          <span className="font-bold text-2xl bg-clip-text text-transparent bg-gradient-to-r from-[#c0c1ff] to-[#3cd7ff]">
            CampusAI Mentor
          </span>
        </div>

        <div className="glass-card rounded-3xl p-8 sm:p-10 border border-white/10 shadow-[0_0_40px_rgba(192,193,255,0.15)]">
          <div className="mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card border border-white/10 text-xs font-semibold text-[#c0c1ff]">
            <Brain className="w-4 h-4 text-[#3cd7ff] animate-pulse" />
            <span>Welcome back! Sign in to continue</span>
          </div>

          <h1 className="text-3xl font-extrabold text-white mb-2">Login</h1>
          <p className="text-sm text-[#c6c5d7] mb-8">Access your career dashboard, resume analysis and AI mentor.</p>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-[#c6c5d7] uppercase tracking-wider mb-2">
                Username, Email or Roll No
              </label>
              <div className="relative">
                <Mail className="w-5 h-5 text-[#c0c1ff] absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Enter username, email or roll number"
                  required
                  className="w-full bg-[#1b1b26] border border-white/10 rounded-xl pl-12 pr-4 py-3 text-sm text-white placeholder-[#c6c5d7]/50 focus:outline-none focus:border-[#c0c1ff]/50 focus:ring-2 focus:ring-[#5b5fef]/20 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#c6c5d7] uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="w-5 h-5 text-[#c0c1ff] absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full bg-[#1b1b26] border border-white/10 rounded-xl pl-12 pr-4 py-3 text-sm text-white placeholder-[#c6c5d7]/50 focus:outline-none focus:border-[#c0c1ff]/50 focus:ring-2 focus:ring-[#5b5fef]/20 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 rounded-full bg-gradient-to-r from-[#5b5fef] to-[#5203d5] text-white font-semibold text-sm shadow-[0_0_25px_rgba(192,193,255,0.3)] hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Login</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-[#c6c5d7]">
              Don't have an account?{' '}
              <button
                onClick={onSwitchToSignup}
                className="text-[#3cd7ff] font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <span>Sign up</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
