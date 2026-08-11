const BASE = '/api';

function getToken(): string | null {
  return localStorage.getItem('campusai_token');
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  const h: Record<string, string> = { ...extra };
  const token = getToken();
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

// Turn any thrown error (network failure, non-JSON response, server error) into
// a short, human-friendly message the user can actually act on.
function friendlyError(err: unknown): Error {
  if (err instanceof Error) {
    const msg = err.message || '';
    if (/failed to fetch|networkerror|load failed|socket hang up|ECONNREFUSED|timed out/i.test(msg)) {
      return new Error('Cannot reach the server. Check your connection and try again.');
    }
    return err;
  }
  return new Error('Something went wrong. Please try again.');
}

async function handleResponse(res: Response): Promise<unknown> {
  if (res.status === 401) {
    localStorage.removeItem('campusai_token');
    localStorage.removeItem('campusai_user');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = body.error || body.message || `Something went wrong (${res.status}). Please try again.`;
    throw new Error(msg);
  }
  return res.json();
}

async function getJson<T>(path: string): Promise<T> {
  try {
    return (await handleResponse(await fetch(`${BASE}${path}`, { headers: headers() }))) as T;
  } catch (err) {
    throw friendlyError(err);
  }
}

async function sendJson<T>(path: string, method: string, body?: unknown): Promise<T> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: headers({ 'Content-Type': 'application/json' }),
      body: body ? JSON.stringify(body) : undefined,
    });
    return (await handleResponse(res)) as T;
  } catch (err) {
    throw friendlyError(err);
  }
}

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  rollNo?: string;
}

export interface Skill {
  id: string;
  name: string;
  category: string;
  platform: string;
  mastery: number;
  percentage: number;
  requiredLevel: number;
  questionsSolved: number;
  totalQuestions: number;
  status: string;
  cohortAvg: number;
  topAvg: number;
}

export interface Checkpoint {
  id: string;
  label: string;
  level: number;
  done: boolean;
}

export interface ProfileProject {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  repoUrl: string;
  level: string;
  status: string;
  progress: number;
  recommendedByAi: boolean;
}

export interface Certificate {
  id: string;
  title: string;
  category: string;
  filePath: string;
  improvedSkill: string;
  organization: string;
  verified: boolean;
  summary: string;
}

export interface CertificateAnalysis {
  verified: boolean;
  summary: string;
  improvedSkill: string;
  detectedTitle: string;
  organization: string;
  studentName: string;
  topic: string;
  certType: 'Course' | 'Hackathon' | 'Competitive' | 'Internship' | 'Other';
}

export interface ProfileResponse {
  profile: {
    name: string;
    institution: string;
    branch: string;
    semester: string;
    targetRole: string;
    targetCgpa: string;
    targetCompanyType: string;
    targetCompanyName: string;
    timelineCurrent: string;
    timelineNext: string;
    workType: string;
    githubUrl: string;
    linkedinUrl: string;
    avatarUrl: string;
    photoUrl: string;
    certificatesCount: number;
    projectsCount: number;
    skillScore: number;
  };
  skills: Skill[];
  codingProfiles: { id: string; name: string; platform: string; url: string }[];
  certificates: Certificate[];
  projects: SkillProject[];
  resume: { fileName: string; filePath: string } | null;
}

export interface SkillProject {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  repoUrl: string;
  level: string;
  status: string;
  progress: number;
  recommendedByAi: boolean;
}

export interface ResumeAnalysis {
  atsScore: number;
  strengths: string[];
  additions: string[];
  summary: string;
  skills: string[];
  addedCount?: number;
  overriddenCount?: number;
}

export interface ResumeRecord {
  resumeNo: number;
  fileName: string;
  filePath: string;
  uploadedAt: string | null;
  atsScore: number | null;
  skills: string[];
  additions: string[];
  strengths: string[];
}

export interface Notification {
  id: number;
  type: string;
  title: string;
  detail: string;
  is_read: boolean;
  created_at?: string;
}

export interface DashboardProject {
  id: string;
  title: string;
  description: string;
  repoUrl: string;
  status: string;
  progress: number;
  recommendedByAi: boolean;
  aiVerified?: boolean;
  aiVerification?: string;
  imageUrl: string;
  level: string;
}

export interface DashboardResponse {
  name: string;
  branch: string;
  targetRole: string;
  targetCgpa: string;
  targetCompanyName: string;
  projectCount: number;
  certificateCount: number;
  skillGap: { id: string; name: string; category: string; current: number; required: number }[];
  skills: { name: string; mastery: number }[];
  projects: DashboardProject[];
  recommendations: { text: string; color: string; navigatesTo: string | null }[];
  notifications: Notification[];
}

export interface CompareSkill {
  id: string;
  name: string;
  category: string;
  platform: string;
  userScore: number;
  mastery: number;
  cohortAvg: number;
  top10Avg: number;
  cohortSize?: number;
  userRankInSkill?: number;
  questionsSolved: number;
  totalQuestions: number;
  status: string;
  requiredLevel: number;
  updatedAt?: string | null;
}

export interface CompareResponse {
  skills: CompareSkill[];
  cohorts: { id: string; name: string; totalStudents: number; userRank: number }[];
  sort: string;
  scope: string;
}

export interface SkillTopics {
  name: string;
  beginner: string[];
  intermediate: string[];
  advanced: string[];
}

export interface ProjectSuggestion {
  title: string;
  description: string;
  skillsUsed: string[];
  level: string;
}

export interface ProjectSuggestResponse {
  suggestions: ProjectSuggestion[];
  role: string;
}

export const api = {
  // Auth
  register: (username: string, email: string, password: string, rollNo?: string) =>
    sendJson<{ token: string; user: AuthUser }>('/auth/register', 'POST', { username, email, password, rollNo }),
  login: (identifier: string, password: string) =>
    sendJson<{ token: string; user: AuthUser }>('/auth/login', 'POST', { identifier, password }),
  me: () => getJson<{ user: AuthUser }>('/auth/me'),

  // Profile
  getProfile: () => getJson<ProfileResponse>('/profile'),
  updateProfile: (data: Record<string, unknown>) => sendJson('/profile', 'PUT', data),
  addSkill: (name: string, category: string, platform: string, totalQuestions: number) =>
    sendJson<{ id: string }>('/profile/skills', 'POST', { name, category, platform, totalQuestions }),
  getSkill: (id: string) =>
    getJson<{ id: string; name: string; category: string; platform: string; checkpoints: Checkpoint[]; masteryPercent: number; masterered: number }>(`/profile/skills/${id}`),
  toggleCheckpoint: (id: string) =>
    sendJson(`/checkpoints/${id}/toggle`, 'POST'),
  updateSkill: (id: string, data: Record<string, unknown>) =>
    sendJson('/profile/skills/' + id, 'PATCH', data),
  deleteSkill: (id: string) => sendJson('/profile/skills/' + id, 'DELETE'),
  cleanupSkills: () =>
    sendJson<{ deleted: number; deletedSkills: string[]; totalBefore: number; totalAfter: number }>('/skills/cleanup', 'POST'),
  getPlatforms: () =>
    getJson<{ id: string; name: string; base_url: string }[]>('/platforms'),
  addCodingProfile: (name: string, url: string, platform: string) =>
    sendJson<{ id: string; name: string; platform: string; url: string }>('/profile/coding', 'POST', { name, url, platform }),
  deleteCodingProfile: (id: string) => sendJson('/profile/coding/' + id, 'DELETE'),
  addCertificate: (title: string, category: string, fileUrl: string, improvedSkill: string, organization?: string) =>
    sendJson('/profile/certificates', 'POST', { title, category, fileUrl, improvedSkill, organization }),
  analyzeCertificate: (fileUrl: string) =>
    sendJson<CertificateAnalysis>('/profile/certificates/analyze', 'POST', { fileUrl }),
  deleteCertificate: (id: string) => sendJson('/profile/certificates/' + id, 'DELETE'),
  uploadFile: (dataUri: string, filename: string) =>
    sendJson<{ url: string }>('/upload', 'POST', { data: dataUri, filename }),
  uploadResume: (fileUrl: string, fileName: string) =>
    sendJson<{ id: string; file_name: string; file_path: string; resume_no: number }>('/resume/upload', 'POST', { fileUrl, fileName }),
  analyzeResume: (fileUrl: string) =>
    sendJson<ResumeAnalysis>('/resume/analyze', 'POST', { fileUrl }),
  generateResume: async (): Promise<void> => {
    try {
      const res = await fetch(`${BASE}/resume/generate`, { method: 'POST', headers: headers() });
      await handleResponse(res);
      const content = res.headers.get('Content-Disposition') || '';
      const match = content.match(/filename="?([^"]+)"?/);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = match ? match[1] : 'resume.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      throw friendlyError(err);
    }
  },

  // Dashboard / Projects
  getDashboard: () => getJson<DashboardResponse>('/dashboard'),
  addProject: (data: Record<string, unknown>) => sendJson('/dashboard/projects', 'POST', data),
  updateProject: (id: string, data: Record<string, unknown>) => sendJson('/dashboard/projects/' + id, 'PATCH', data),
  deleteProject: (id: string) => sendJson('/dashboard/projects/' + id, 'DELETE'),
  suggestProjects: (skills: string[], role?: string) =>
    sendJson<ProjectSuggestResponse>('/projects/suggest', 'POST', { skills, role }),

  // Compare
  getCompare: (sort: string, scope?: string) => getJson<CompareResponse>(`/compare?sort=${encodeURIComponent(sort)}${scope ? `&scope=${encodeURIComponent(scope)}` : ''}`),
  addBenchmarkSkill: (name: string, category: string, platform: string) =>
    sendJson('/compare/skills', 'POST', { name, category, platform }),
  getSkillTopics: () => getJson<{ skills: SkillTopics[] }>('/skill-topics'),

  // Notifications
  getNotifications: () => getJson<{ notifications: Notification[] }>('/notifications'),
  readNotification: (id: number) => sendJson('/notifications/read/' + id, 'POST'),

  // Resume
  getResumeData: () => getJson<{ resume: { fileName: string; filePath: string } | null }>('/profile'),
  getResumes: () => getJson<{ resumes: ResumeRecord[] }>('/resume/list'),
  getResumeAnalysisByNo: (num: number) =>
    getJson<ResumeRecord>('/resume/analysis/' + num),
  deleteResume: (num: number) => sendJson('/resume/' + num, 'DELETE'),

  // Chat
  getChatMessages: () => getJson<{ messages: { id: string; sender: string; text: string }[] }>('/chat/messages'),
  saveChatMessage: (sender: string, text: string) =>
    sendJson<{ id: string; sender: string; text: string }>('/chat/messages', 'POST', { sender, text }),
  mentor: (message: string, history: { sender: string; text: string }[]) =>
    sendJson<{ reply: string }>('/mentor', 'POST', { message, history }),
};