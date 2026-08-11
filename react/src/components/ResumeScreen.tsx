import React, { useState, useRef, useEffect } from 'react';
import { ScreenType } from '../types';
import { 
  ChevronRight, CheckCircle, AlertCircle, 
  TrendingUp, Download, Sparkles, FileText, ExternalLink
} from 'lucide-react';
import { api, ProfileResponse, ResumeAnalysis, ResumeRecord, SkillTopics } from '../api';

interface ResumeScreenProps {
  onNavigate: (screen: ScreenType, transition?: 'none' | 'push' | 'slide_up') => void;
}

export const ResumeScreen: React.FC<ResumeScreenProps> = ({ onNavigate }) => {
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [atsScore, setAtsScore] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedResumeNo, setUploadedResumeNo] = useState<number | null>(null);
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null);
  const [profileSkills, setProfileSkills] = useState<string[]>([]);
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(null);
  const [skillTopics, setSkillTopics] = useState<SkillTopics[]>([]);
  const [addedNote, setAddedNote] = useState<string | null>(null);
  const [analyzeError, setAnalyzeError] = useState('');
  const [resumeList, setResumeList] = useState<ResumeRecord[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadResumeList = () => {
    api.getResumes()
      .then(({ resumes }) => setResumeList(resumes))
      .catch((err) => console.error('Failed to load resume list', err));
  };

  useEffect(() => {
    loadResumeList();
    api.getProfile()
      .then((res) => {
        setProfile(res);
        setProfileSkills(res.skills.map((s) => s.name));
        setAtsScore(res.skills.length ? Math.min(99, 40 + res.skills.length * 8) : 0);
        if (res.resume) {
          setUploadedFileName(res.resume.fileName);
          setUploadedFileUrl(res.resume.filePath);
          api.getResumes()
            .then(({ resumes }) => {
              const cur = resumes.find((r) => r.filePath === res.resume?.filePath);
              if (cur) setUploadedResumeNo(cur.resumeNo);
            })
            .catch(() => {});
        }
      })
      .catch((err) => console.error('Failed to load resume data', err));
    api.getSkillTopics().then((res) => setSkillTopics(res.skills || [])).catch(() => setSkillTopics([]));
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFileName(file.name);
      uploadAndAnalyze(file);
    }
  };

  const uploadAndAnalyze = async (file: File) => {
    setIsAnalyzing(true);
    setAnalyzeError('');
    try {
      const dataUri = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onloadend = () => resolve(String(r.result));
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      const uploaded = await api.uploadFile(dataUri, file.name);
      setUploadedFileUrl(uploaded.url);
      const saved = await api.uploadResume(uploaded.url, file.name);
      setUploadedResumeNo(saved.resume_no ?? null);
      loadResumeList();
      await runAnalysis(uploaded.url);
    } catch (err: any) {
      console.error('Failed to process resume', err);
      setAtsScore(0);
      setAnalyzeError(err.message || 'Failed to process your resume. Please try again.');
    }
    setIsAnalyzing(false);
  };

  const runAnalysis = async (fileUrl?: string) => {
    const url = fileUrl || uploadedFileUrl;
    if (!url) return;
    setIsAnalyzing(true);
    setAnalyzeError('');
    try {
      const result = await api.analyzeResume(url);
      setAnalysis(result);
      setAtsScore(result.atsScore);
      if (result.skills?.length) setProfileSkills(result.skills);
    } catch (err: any) {
      console.error('Failed to analyze resume', err);
      setAnalyzeError(err.message || 'Resume analysis failed. Please try again.');
    }
    setIsAnalyzing(false);
  };

  const runAnalysisSimulation = () => runAnalysis();

  const [generatingResume, setGeneratingResume] = useState(false);

  const handleGenerateResume = async () => {
    setGeneratingResume(true);
    try {
      await api.generateResume();
    } catch (err) {
      console.error('Failed to generate resume', err);
      setAddedNote('Could not generate resume — please set your name in Profile.');
      setTimeout(() => setAddedNote(null), 3500);
    }
    setGeneratingResume(false);
  };

  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

  const PREFIX_PATTERN = /^\s*\+\s*/;

  const FILLER_WORDS = [
    'focus on', 'focus', 'learning', 'learn', 'master', 'mastering', 'improve',
    'improving', 'strengthen', 'strengthening', 'build', 'building', 'work on',
    'working on', 'practice', 'practicing', 'get started with', 'get started',
    'start', 'starting', 'add', 'adding', 'explore', 'exploring', 'study',
    'studying', 'revise', 'revision', 'upskill', 'gain', 'gaining', 'get', 'know',
    'revision of', 'strengthen skills in', 'good grasp of', 'strong foundation in',
  ];

  // turns "focus on dsa" / "Focus in machine learning" into a clean skill name
  const extractSkillName = (raw: string) => {
    let t = raw.trim().replace(PREFIX_PATTERN, '').trim();
    // strip leading filler verbs/phrases (case-insensitive)
    for (;;) {
      const prev = t;
      for (const f of FILLER_WORDS) {
        const re = new RegExp(`^${f.replace(/ /g, '\\s+')}\\b`, 'i');
        if (re.test(t)) { t = t.replace(re, '').replace(/^\s+(of|in|on|the|my|your|with|for)\b\s+/i, '').trim(); break; }
      }
      if (t === prev) break;
    }
    t = t.replace(/^\s+(of|in|on|the|my|your|with|for)\b\s*/i, '').trim();
    return t.replace(/\s{2,}/g, ' ').replace(/[.,;:!?]+$/g, '').trim();
  };

  const handleAddFromRecommendation = async (recommendation: string) => {
    const raw = extractSkillName(recommendation);
    if (!raw) return;
    try {
      // prefer the canonical syllabus skill name only when it matches exactly
      const key = normalize(raw);
      const canonical = skillTopics.find((st) => normalize(st.name) === key);
      const name = canonical ? canonical.name : raw;
      const existing = profileSkills.map((s) => s.toLowerCase());
      if (existing.includes(name.toLowerCase()) || existing.some((e) => name.toLowerCase().includes(e) && name.length >= 4)) {
        setAddedNote(`Already in your skills: ${name}`);
        setTimeout(() => setAddedNote(null), 2500);
        return;
      }
      await api.addSkill(name, 'Core CS', '', 5);
      setAddedNote(`Added to your skills: ${name}`);
      setTimeout(() => setAddedNote(null), 2500);
      const res = await api.getProfile();
      setProfile(res);
      setProfileSkills(res.skills.map((s) => s.name));
      setAtsScore(res.skills.length ? Math.min(99, 40 + res.skills.length * 8) : 0);
    } catch (err) {
      console.error('Failed to add recommended skill', err);
      setAddedNote('Failed to add skill');
      setTimeout(() => setAddedNote(null), 2500);
    }
  };

  return (
    <main className="pt-24 pb-28 px-4 max-w-7xl mx-auto">
      {/* Breadcrumb & Title */}
      <div className="mb-8">
        <div className="flex items-center gap-1.5 text-xs text-[#c6c5d7] mb-2 font-medium">
          <span 
            onClick={() => onNavigate('dashboard', 'none')} 
            className="cursor-pointer hover:text-white"
          >
            Dashboard
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-[#464555]" />
          <span className="text-[#c0c1ff]">Resume Analysis</span>
        </div>
        
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-2">
          Optimize Your Career Path
        </h2>
        <p className="text-sm sm:text-base text-[#c6c5d7]/80 max-w-2xl leading-relaxed">
          Our AI-powered engine scans your resume against thousands of industry standard benchmarks to give you actionable insights.
        </p>
      </div>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Upload Zone */}
        <section 
          onClick={() => fileInputRef.current?.click()}
          className="lg:col-span-12 glass-card rounded-2xl p-8 flex flex-col items-center justify-center min-h-[260px] border-2 border-dashed border-[#c0c1ff]/30 hover:border-[#c0c1ff] transition-all cursor-pointer group text-center relative overflow-hidden"
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept=".pdf,.docx" 
            className="hidden" 
          />

          <div className="relative mb-4">
            <div className="absolute inset-0 bg-[#5b5fef]/20 blur-2xl rounded-full group-hover:scale-125 transition-transform" />
            <div className="relative w-16 h-16 rounded-full bg-[#292932] border border-[#c0c1ff]/30 flex items-center justify-center text-[#c0c1ff] group-hover:scale-110 transition-transform">
              <FileText className="w-8 h-8" />
            </div>
          </div>

          <h3 className="text-xl font-bold text-white mb-1">
            {uploadedFileName ? (
              <>
                Loaded: {uploadedResumeNo != null ? `Resume #${uploadedResumeNo}` : ''}{uploadedResumeNo != null ? ' — ' : ''}{uploadedFileName}
              </>
            ) : 'Upload PDF/DOCX'}
          </h3>
          <p className="text-sm text-[#c6c5d7] max-w-md mb-6">
            Drag and drop your resume file here or click to browse. Max file size 5MB.
          </p>

          <div className="flex flex-wrap gap-4 justify-center" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => runAnalysisSimulation()}
              disabled={isAnalyzing}
              className="glow-button px-8 py-3 rounded-full font-semibold text-sm text-white transition-all active:scale-95 cursor-pointer flex items-center gap-2"
            >
              {isAnalyzing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Analyze Resume</span>
                </>
              )}
            </button>

            <button
              onClick={handleGenerateResume}
              disabled={generatingResume}
              className="bg-[#34343d]/60 border border-white/10 px-8 py-3 rounded-full font-semibold text-sm text-white hover:bg-[#34343d] transition-all cursor-pointer flex items-center gap-2"
            >
              {generatingResume ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Templates</span>
                </>
              )}
            </button>
          </div>

          {analyzeError && (
            <div className="mt-4 w-full flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{analyzeError}</span>
            </div>
          )}
        </section>

        {/* ATS Score Gauge */}
        <section className="lg:col-span-4 glass-card rounded-2xl p-6 flex flex-col items-center justify-center text-center relative overflow-hidden">
          <h4 className="text-xs font-semibold text-[#c6c5d7] uppercase tracking-widest mb-6">
            ATS Visibility Score
          </h4>

          {/* Circular Progress Gauge */}
          <div className="relative w-44 h-44 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="40"
                className="text-[#34343d]"
                strokeWidth="10"
                stroke="currentColor"
                fill="none"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                className="text-[#c0c1ff] transition-all duration-1000"
                strokeWidth="10"
                strokeDasharray="251.32"
                strokeDashoffset={251.32 - (251.32 * atsScore) / 100}
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-extrabold text-[#c0c1ff]">{atsScore}</span>
              <span className="text-xs text-[#c6c5d7]/60 font-medium">/ 100</span>
            </div>
          </div>

          <div className="mt-6">
            {uploadedFileName ? (
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-emerald-500/10 text-emerald-400 rounded-full mb-2">
                <TrendingUp className="w-3.5 h-3.5" />
                <span className="text-xs font-bold">Resume uploaded</span>
              </div>
            ) : null}
            <p className="text-xs text-[#c6c5d7]">Optimized for tech roles</p>
          </div>
          {analysis?.summary && (
            <p className="mt-5 text-xs text-[#c6c5d7]/90 leading-relaxed bg-[#1b1b23] border border-white/5 rounded-xl p-4 text-left">
              <span className="block font-bold text-[#c0c1ff] mb-1">AI Analysis</span>
              {analysis.summary}
            </p>
          )}
          {(analysis?.addedCount || analysis?.overriddenCount) ? (
            <p className="mt-3 text-[11px] text-[#c6c5d7] bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-xl px-3 py-2">
              {analysis.overriddenCount ? `Levels updated for ${analysis.overriddenCount} existing skill${analysis.overriddenCount > 1 ? 's' : ''}` : ''}
              {analysis.addedCount && analysis.overriddenCount ? ' · ' : ''}
              {analysis.addedCount ? `Added ${analysis.addedCount} new skill${analysis.addedCount > 1 ? 's' : ''}` : ''}
            </p>
          ) : null}
        </section>

        {/* Skill Gap Analysis */}
        <section className="lg:col-span-8 glass-card rounded-2xl p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
            <h4 className="text-xl font-bold text-white">Skill Gap Analysis</h4>
            <span className="px-3 py-1 bg-[#34343d] rounded-lg text-xs font-medium text-[#c6c5d7]">
              Role: {profile?.profile.targetRole || 'Not set'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Strengths */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[#3cd7ff]">
                <CheckCircle className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Identified Strengths
                </span>
              </div>
<div className="flex flex-wrap gap-2">
            {(analysis?.strengths?.length ? analysis.strengths : profileSkills).map((skill) => (
              <span
                key={skill}
                className="px-3 py-1.5 bg-[#007c96]/20 border border-[#007c96]/40 text-[#b4ebff] rounded-xl text-xs font-medium"
              >
                {skill}
              </span>
            ))}
            {!profileSkills?.length && !analysis?.strengths?.length && (
              <p className="text-xs text-[#c6c5d7]/70 italic">
                Upload a resume and run analysis to see your detected strengths.
              </p>
            )}
          </div>
            </div>

            {/* Recommended Additions */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[#ffb4ab]">
                <AlertCircle className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Recommended Additions
                </span>
              </div>
<div className="flex flex-wrap gap-2">
            {(analysis?.additions || []).map((skill) => (
              <button
                key={skill}
                onClick={() => handleAddFromRecommendation(skill)}
                title={`Click to add "${extractSkillName(skill)}" to your skills`}
                className="px-3 py-1.5 bg-[#93000a]/20 border border-[#93000a]/40 text-[#ffb4ab] rounded-xl text-xs font-medium hover:bg-[#93000a]/40 hover:text-white transition-all cursor-pointer text-left"
              >
                + {skill}
              </button>
            ))}
            {!analysis?.additions?.length && (
              <p className="text-xs text-[#c6c5d7]/70 italic">
                Recommended additions will appear here after you analyze your resume.
              </p>
            )}
            {addedNote && (
              <span className="w-full text-xs text-emerald-400 font-semibold">{addedNote}</span>
            )}
          </div>
            </div>
          </div>
        </section>
      </div>

      {/* Stored Resumes */}
      <section className="mt-6 glass-card rounded-2xl p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
          <h4 className="text-xl font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#c0c1ff]" />
            Stored Resumes
          </h4>
          <span className="px-3 py-1 bg-[#34343d] rounded-lg text-xs font-medium text-[#c6c5d7]">
            {resumeList.length} file{resumeList.length === 1 ? '' : 's'}
          </span>
        </div>

        {resumeList.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {resumeList.map((r) => (
              <a
                key={r.resumeNo}
                href={r.filePath}
                target="_blank"
                rel="noreferrer"
                className="group flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:border-[#c0c1ff]/50 hover:bg-[#5b5fef]/10 transition-all"
              >
                <span className="shrink-0 w-9 h-9 rounded-lg bg-[#5b5fef]/20 text-[#c0c1ff] text-sm font-extrabold flex items-center justify-center">
                  {r.resumeNo}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{r.fileName}</p>
                  <p className="text-[11px] text-[#c6c5d7]">
                    {r.atsScore != null ? `ATS ${r.atsScore}/100` : 'Not analyzed'}
                  </p>
                </div>
                <ExternalLink className="w-4 h-4 text-[#c6c5d7] group-hover:text-[#3cd7ff] shrink-0" />
              </a>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#c6c5d7]/70">
            No resumes stored yet. Upload a resume above and it will appear here.
          </p>
        )}
      </section>

      {/* Desktop Floating Action Buttons */}
      <div className="hidden md:flex fixed right-6 bottom-6 flex-col gap-3 z-40">
        <button className="w-12 h-12 rounded-full bg-[#292932] border border-white/10 flex items-center justify-center text-[#c0c1ff] hover:bg-[#c0c1ff] hover:text-[#0e00aa] transition-all shadow-xl cursor-pointer">
          <Download className="w-5 h-5" />
        </button>
        <button 
          onClick={() => runAnalysisSimulation()}
          className="w-12 h-12 rounded-full glow-button flex items-center justify-center text-white transition-all shadow-xl cursor-pointer"
        >
          <Sparkles className="w-5 h-5" />
        </button>
      </div>
    </main>
  );
};
