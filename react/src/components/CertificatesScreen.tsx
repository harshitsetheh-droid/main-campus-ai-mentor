import React, { useState, useEffect, useRef } from 'react';
import { ScreenType } from '../types';
import {
  FileText, Award, CheckCircle2, X, ShieldCheck, Building2,
  Brain, Sparkles, ExternalLink, Upload, Loader2
} from 'lucide-react';
import { api, Certificate } from '../api';

interface CertificatesScreenProps {
  onNavigate: (screen: ScreenType, transition?: 'none' | 'push' | 'slide_up') => void;
}

export const CertificatesScreen: React.FC<CertificatesScreenProps> = () => {
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [pendingUrl, setPendingUrl] = useState('');
  const [newCert, setNewCert] = useState({ title: '', category: '', improvedSkill: '', organization: '' });
  const [certError, setCertError] = useState('');
  const certFileRef = useRef<HTMLInputElement>(null);

  const load = () => {
    api.getProfile()
      .then((res) => setCerts(res.certificates || []))
      .catch(() => setCerts([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setNewCert({ title: '', category: '', improvedSkill: '', organization: '' });
    setPendingUrl('');
    setCertError('');
  };

  const handleCertFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsAnalyzing(true);
    setCertError('');
    setPendingUrl('');
    try {
      const dataUri = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onloadend = () => resolve(String(r.result));
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      const uploaded = await api.uploadFile(dataUri, file.name);
      const analysis = await api.analyzeCertificate(uploaded.url);
      setPendingUrl(uploaded.url);
      setNewCert({
        title: analysis.detectedTitle || file.name.replace(/\.[^.]+$/, ''),
        category: analysis.certType || '',
        improvedSkill: analysis.improvedSkill || '',
        organization: analysis.organization || '',
      });
      setCertError(`AI verified this certificate! Issued by: ${analysis.organization || 'unknown'} · Type: ${analysis.certType || 'Other'}${analysis.improvedSkill ? ` · Skill: ${analysis.improvedSkill}` : ''}`);
    } catch (err: any) {
      setCertError(err.message || 'Certificate upload failed. The image could not be verified as a valid certificate.');
      setPendingUrl('');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSave = async () => {
    if (!newCert.title.trim()) { setCertError('Please enter a certificate title.'); return; }
    if (!pendingUrl || isAnalyzing) return;
    setIsAnalyzing(true);
    setCertError('');
    try {
      await api.addCertificate(newCert.title.trim(), newCert.category, pendingUrl, newCert.improvedSkill, newCert.organization);
      resetForm();
      setShowAdd(false);
      load();
    } catch (err: any) {
      setCertError(err.message || 'Failed to save certificate.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteCertificate(id);
      load();
    } catch (err) {
      console.error('Failed to delete certificate', err);
    }
  };

  return (
    <main className="pt-24 pb-24 px-4 max-w-7xl mx-auto">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2">
            <Award className="w-7 h-7 text-[#ffd700]" /> My Certificates
          </h2>
          <p className="text-sm text-[#c6c5d7] mt-1">
            All your AI-verified certificates in one place.
          </p>
        </div>
        <button
          onClick={() => { const next = !showAdd; setShowAdd(next); if (next) resetForm(); }}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#ffd700] to-[#f59e0b] text-[#13131b] text-sm font-bold hover:opacity-90 transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          {showAdd ? <X className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
          {showAdd ? 'Cancel' : 'Upload Certificate'}
        </button>
      </div>

      {/* AI-verified upload form */}
      {showAdd && (
        <div className="glass-card rounded-2xl p-6 mb-8 border-[#ffd700]/30">
          <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" /> Add a Certificate
          </h3>
          <p className="text-xs text-[#c6c5d7] mb-5">
            Upload the certificate image — the AI checks it's genuinely a certificate, extracts the title, type, skill and issuing company, then auto-fills below. Fake uploads are rejected.
          </p>

          {certError && (
            <div className={`mb-4 px-3 py-2.5 rounded-lg text-xs border ${pendingUrl ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'}`}>
              {certError}
            </div>
          )}

          <div className="space-y-3">
            <input value={newCert.title} onChange={(e) => setNewCert({ ...newCert, title: e.target.value })} placeholder="Certificate title (auto-filled)" className="w-full px-3 py-2 bg-[#13131b] text-white text-sm rounded-lg border border-white/10 focus:outline-none" />
            <select value={newCert.category} onChange={(e) => setNewCert({ ...newCert, category: e.target.value })} className="styled-select w-full !bg-[#13131b]">
              <option value="">Certificate type (auto-filled)</option>
              {['Course', 'Hackathon', 'Competitive', 'Internship', 'Other'].map((c) => <option key={c}>{c}</option>)}
            </select>
            <input value={newCert.improvedSkill} onChange={(e) => setNewCert({ ...newCert, improvedSkill: e.target.value })} placeholder="Skill improved (auto-filled, e.g. DSA)" className="w-full px-3 py-2 bg-[#13131b] text-white text-sm rounded-lg border border-white/10 focus:outline-none" />
            <input value={newCert.organization} onChange={(e) => setNewCert({ ...newCert, organization: e.target.value })} placeholder="Issuing organization/company (auto-filled)" className="w-full px-3 py-2 bg-[#13131b] text-white text-sm rounded-lg border border-white/10 focus:outline-none" />

            <button
              onClick={() => certFileRef.current?.click()}
              disabled={isAnalyzing}
              className="w-full px-4 py-2.5 bg-[#5b5fef] text-white text-sm rounded-lg font-medium hover:opacity-90 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {isAnalyzing && !pendingUrl ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</> : <><Upload className="w-4 h-4" /> {pendingUrl ? 'Re-analyze certificate' : 'Choose certificate image'}</>}
            </button>
            <input type="file" ref={certFileRef} onChange={handleCertFile} accept="image/*,.pdf" className="hidden" />

            {pendingUrl && (
              <button
                onClick={handleSave}
                disabled={isAnalyzing}
                className="w-full px-4 py-2.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 text-sm rounded-lg font-medium hover:bg-emerald-500/25 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <CheckCircle2 className="w-4 h-4" /> Save verified certificate
              </button>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-20 text-sm text-[#c6c5d7]">Loading...</div>
      ) : certs.length === 0 ? (
        <div className="glass-card rounded-2xl p-14 flex flex-col items-center justify-center text-center border border-dashed border-[#464555]">
          <FileText className="w-14 h-14 text-[#c6c5d7] mb-4" />
          <h3 className="text-lg font-bold text-white mb-1">No certificates yet</h3>
          <p className="text-sm text-[#c6c5d7] max-w-sm mb-5">
            Upload a certificate — the AI verifies it's genuine, extracts the skill, type and issuing company, then it appears here.
          </p>
          <button
            onClick={() => setShowAdd(true)}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#ffd700] to-[#f59e0b] text-[#13131b] text-sm font-bold hover:opacity-90 transition-all cursor-pointer flex items-center gap-2"
          >
            <Upload className="w-4 h-4" /> Upload Certificate
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {certs.map((c) => (
            <div key={c.id} className="glass-card rounded-2xl overflow-hidden group hover:border-[#ffb4ab]/40 transition-all">
              <div className="h-40 relative bg-gradient-to-br from-[#ffb4ab]/15 via-[#13131b] to-[#5b5fef]/15 overflow-hidden flex items-center justify-center">
                {c.filePath ? (
                  <img
                    src={c.filePath}
                    alt={c.title}
                    className="w-full h-full object-cover opacity-70 group-hover:opacity-90 group-hover:scale-105 transition-all duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <FileText className="w-12 h-12 text-[#ffb4ab]/40" />
                  </div>
                )}
                <span className={`absolute top-3 left-3 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                  c.verified ? 'bg-emerald-500/90 text-white' : 'bg-amber-500/90 text-white'
                }`}>
                  {c.verified ? <><CheckCircle2 className="w-3 h-3" /> Verified</> : <><Sparkles className="w-3 h-3" /> Pending</>}
                </span>
                {c.category && (
                  <span className="absolute top-3 right-3 bg-[#13131b]/70 text-[#cdbdff] px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider border border-white/10">
                    {c.category}
                  </span>
                )}
              </div>
              <div className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-white text-base leading-snug">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" /> {c.title}
                    </span>
                  </h3>
                  <button
                    onClick={() => handleDelete(c.id)}
                    className="text-[#c6c5d7] hover:text-rose-400 p-1 shrink-0 cursor-pointer"
                    title="Delete certificate"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-1.5 text-xs text-[#c6c5d7]">
                  {c.organization && (
                    <div className="flex items-center gap-2">
                      <Award className="w-3.5 h-3.5 text-[#ffb4ab]" />
                      <span><span className="text-white font-semibold">{c.organization}</span></span>
                    </div>
                  )}
                  {c.improvedSkill && (
                    <div className="flex items-center gap-2">
                      <Brain className="w-3.5 h-3.5 text-[#3cd7ff]" />
                      <span>Skill: <span className="text-[#3cd7ff] font-semibold">{c.improvedSkill}</span></span>
                    </div>
                  )}
                  {c.category && (
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-[#c0c1ff]" />
                      <span>Type: <span className="text-[#c0c1ff] font-semibold">{c.category}</span></span>
                    </div>
                  )}
                </div>

                {c.summary && (
                  <p className="text-xs text-[#c6c5d7]/80 leading-relaxed border-t border-white/5 pt-2.5">
                    {c.summary}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
};