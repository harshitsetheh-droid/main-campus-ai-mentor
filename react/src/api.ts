const BASE = '/api';

function getToken(): string | null {
  return sessionStorage.getItem('campusai_token') || localStorage.getItem('campusai_token');
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
    sessionStorage.removeItem('campusai_token');
    sessionStorage.removeItem('campusai_user');
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
  role?: Role;
  name?: string;
}

export type Role = 'student' | 'placement_officer' | 'club_manager' | 'faculty' | 'super_admin';

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  roll_no?: string;
  role: string;
  created_at?: string;
}

export interface AdminClub {
  id: number;
  name: string;
  description: string;
  emoji: string;
  members: number;
  managers: { id: number; username: string; handle: string }[];
}

export interface ManagerClub {
  id: number;
  name: string;
  description: string;
  emoji: string;
}

export interface ManagerMessage {
  id: number;
  text: string;
  createdAt?: string;
}

export interface Drive {
  id: number;
  company: string;
  role: string;
  package: string;
  deadline: string;
  status: string;
}

export interface CompanyQuestion {
  id: number;
  company: string;
  question: string;
  frequency: number;
  skills?: string[];
  year?: string;
  pdfUrl?: string;
  createdAt?: string;
}

export interface CompanyQuestionMeta {
  company: string;
  question_count: number;
  max_frequency: number;
}

export interface FacultyStats {
  totalStudents: number;
  avgSkillPercentage: number;
  studentsWithSkills: number;
  topSkills: { name: string; students: number; avg_percentage: number }[];
  clubsActive: number;
  clubsMemberships: number;
  clubsActiveLast7d: number;
}

export interface AdminUserDetails {
  user: {
    id: number;
    username: string;
    email: string;
    rollNo: string;
    phone: string;
    role: string;
    name: string;
    branch: string;
    semester: string;
    targetRole: string;
    targetCgpa: string;
    targetCompanyType: string;
    targetCompanyName: string;
    workType: string;
    githubUrl: string;
    linkedinUrl: string;
    createdAt?: string | null;
  };
  skills: {
    id: number;
    name: string;
    category: string;
    platform: string;
    questionsSolved: number;
    totalQuestions: number;
    mastery: number;
    status: string;
    updatedAt?: string | null;
  }[];
  rank: { userRank: number; totalStudents: number };
  resumes: { id: number; fileName: string; filePath: string; resumeNo: number; createdAt?: string | null }[];
  certificates: { id: number; title: string; category: string; createdAt?: string | null }[];
  projects: { id: number; title: string; status: string; progress: number; level: string }[];
  codingProfiles: { platform: string; name: string; url: string }[];
  clubs: { id: number; name: string; emoji: string; joinedAt?: string | null; blocked: boolean }[];
  friends: { id: number; handle: string }[];
  mentorUses: number;
  applications: {
    id: number;
    driveId: number;
    company: string;
    role: string;
    package: string;
    deadline: string;
    status: string;
    driveStatus: string;
    appliedAt?: string | null;
    updatedAt?: string | null;
  }[];
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
  checkedTopics?: string[];
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

export interface Club {
  id: number;
  name: string;
  description: string;
  emoji: string;
  members: number;
  joined?: boolean;
}

export interface ClubMessage {
  id: number;
  text: string;
  handle: string;
  senderUid?: number;
  isMine: boolean;
  createdAt?: string;
}

export interface Friend {
  id: number;
  handle: string;
}

export interface ChatRequestItem {
  id: number;
  fromHandle?: string;
  toHandle?: string;
  status?: string;
  createdAt?: string;
}

export interface DmMessage {
  id: number;
  text: string;
  handle: string;
  isMine: boolean;
  createdAt?: string;
}

export type FriendRequestResult =
  | { relation: 'friends'; friend: Friend }
  | { relation: 'requested' | 'pending'; requestId: number; toHandle?: string };

export interface PlacementDrive {
  id: number;
  company: string;
  role: string;
  package: string;
  deadline: string;
  status: 'open' | 'closed' | 'upcoming';
}

export interface PlacementQuestion {
  question: string;
  frequency: number;
  years: string[];
  skills: string[];
  difficulty: 'basic' | 'intermediate' | 'hard';
}

export const api = {
  // Auth
  register: (username: string, email: string, password: string, rollNo?: string, name?: string) =>
    sendJson<{ token: string; user: AuthUser }>('/auth/register', 'POST', { username, email, password, rollNo, name }),
  login: (identifier: string, password: string, role?: string) =>
    sendJson<{ token: string; user: AuthUser }>('/auth/login', 'POST', { identifier, password, role }),
  checkUsername: (username: string) =>
    getJson<{ available: boolean; suggestions: string[] }>(`/auth/check-username?u=${encodeURIComponent(username)}`),
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

  // Clubs (anonymous)
  getClubs: () => getJson<{ clubs: Club[]; me?: string }>('/clubs'),
  joinClub: (clubId: number) => sendJson<{ joined: boolean; members: number }>(`/club/${clubId}/join`, 'POST', {}),
  leaveClub: (clubId: number) => sendJson<{ joined: boolean; members: number }>(`/club/${clubId}/leave`, 'POST', {}),
  getClubMessages: (clubId: number, after?: number) =>
    getJson<{ messages: ClubMessage[] }>(`/club/${clubId}/messages${after ? `?after=${after}` : ''}`),
  sendClubMessage: (clubId: number, text: string) =>
    sendJson<{ message: ClubMessage }>(`/club/${clubId}/messages`, 'POST', { text }),

  // Friends & anonymous DMs
  getFriends: () => getJson<{ friends: Friend[] }>('/friends'),
  getChatRequests: () => getJson<{ incoming: ChatRequestItem[]; outgoing: ChatRequestItem[] }>('/friends/requests'),
  sendFriendRequest: (body: { username?: string; uid?: number; code?: string }) =>
    sendJson<FriendRequestResult>('/friends/request', 'POST', body),
  acceptFriendRequest: (id: number) => sendJson<{ friend: Friend }>(`/friends/requests/${id}/accept`, 'POST', {}),
  declineFriendRequest: (id: number) => sendJson<{ success: boolean }>(`/friends/requests/${id}/decline`, 'POST', {}),
  blockFriend: (id: number) => sendJson<{ success: boolean }>(`/friends/${id}/block`, 'POST', {}),
  unblockFriend: (id: number) => sendJson<{ success: boolean }>(`/friends/${id}/unblock`, 'POST', {}),
  getBlockedFriends: () => getJson<{ blocked: Friend[] }>('/friends/blocked'),
  getDmMessages: (friendId: number, after?: number) =>
    getJson<{ messages: DmMessage[] }>(`/dms/${friendId}/messages${after ? `?after=${after}` : ''}`),
  sendDmMessage: (friendId: number, text: string) =>
    sendJson<{ message: DmMessage }>(`/dms/${friendId}/messages`, 'POST', { text }),
  getMyQrCode: () => getJson<{ code: string }>('/me/qrcode'),

  // Placement admin (PO + super admin)
  createDrive: (body: { company: string; role?: string; package?: string; deadline?: string; status?: string }) =>
    sendJson<{ drive: Drive }>('/placement/drives', 'POST', body),
  updateDrive: (id: number, body: { company: string; role?: string; package?: string; deadline?: string; status?: string }) =>
    sendJson<{ drive: Drive }>(`/placement/drives/${id}`, 'PATCH', body),
  deleteDrive: (id: number) => sendJson<{ success: boolean }>(`/placement/drives/${id}`, 'DELETE', {}),
  getCompanyQuestions: (company?: string) =>
    getJson<{ questions: CompanyQuestion[] }>(`/placement/company-questions${company ? `?company=${encodeURIComponent(company)}` : ''}`),
  getCompanyQuestionCompanies: () => getJson<{ companies: CompanyQuestionMeta[] }>('/placement/company-questions/companies'),
  addCompanyQuestion: (body: { company: string; question: string; frequency?: number; skills?: string; year?: string; pdfUrl?: string }) =>
    sendJson<{ question: CompanyQuestion }>('/placement/company-questions', 'POST', body),
  deleteCompanyQuestion: (id: number) => sendJson<{ success: boolean }>(`/placement/company-questions/${id}`, 'DELETE', {}),

  // Super admin
  getAdminUsers: (q?: string) => getJson<{ users: AdminUser[] }>(`/admin/users${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  getAdminUserDetails: (id: number) => getJson<AdminUserDetails>(`/admin/users/${id}`),
  blockClubUsers: (clubId: number, userIds: number[]) =>
    sendJson<{ success: boolean }>(`/admin/clubs/${clubId}/block`, 'POST', { userIds }),
  unblockClubUsers: (clubId: number, userIds: number[]) =>
    sendJson<{ success: boolean }>(`/admin/clubs/${clubId}/unblock`, 'POST', { userIds }),
  setUserRole: (id: number, role: string) => sendJson<{ user: AdminUser }>(`/admin/users/${id}/role`, 'POST', { role }),
  deleteUser: (id: number) => sendJson<{ success: boolean }>(`/admin/users/${id}`, 'DELETE', {}),
  getAdminClubs: () => getJson<{ clubs: AdminClub[] }>('/admin/clubs'),
  createClub: (body: { name: string; description: string; emoji: string }) => sendJson<{ club: AdminClub }>('/admin/clubs', 'POST', body),
  deleteClub: (id: number) => sendJson<{ success: boolean }>(`/admin/clubs/${id}`, 'DELETE', {}),
  assignClubManager: (clubId: number, userId: number) =>
    sendJson<{ success: boolean }>(`/admin/clubs/${clubId}/managers`, 'POST', { userId }),
  removeClubManager: (clubId: number, userId: number) =>
    sendJson<{ success: boolean }>(`/admin/clubs/${clubId}/managers/${userId}`, 'DELETE', {}),

  // Club manager
  getManagerClubs: () => getJson<{ clubs: ManagerClub[] }>('/manager/clubs'),
  getManagerMessages: (clubId: number) => getJson<{ messages: ManagerMessage[] }>(`/manager/clubs/${clubId}/messages`),
  deleteManagerMessage: (clubId: number, messageId: number) =>
    sendJson<{ success: boolean }>(`/manager/clubs/${clubId}/messages/${messageId}`, 'DELETE', {}),

  // Faculty
  getFacultyStats: () => getJson<{ stats: FacultyStats }>('/faculty/stats'),

  // Placement
  getPlacementDrives: () => getJson<{ drives: PlacementDrive[] }>('/placement/drives'),
  getPlacementQuestions: (company: string, level: string) =>
    sendJson<{ company: string; level: string; questions: PlacementQuestion[] }>('/placement/questions', 'POST', { company, level }),
  applyToDrive: (driveId: number) =>
    sendJson<{ application: { id: number; status: string; applied_at?: string } }>(`/placement/drives/${driveId}/apply`, 'POST', {}),
  withdrawApplication: (driveId: number) =>
    sendJson<{ success: boolean }>(`/placement/drives/${driveId}/apply`, 'DELETE', {}),
  getMyApplications: () =>
    getJson<{
      applications: {
        id: number; status: string; applied_at?: string; updated_at?: string;
        drive_id: number; company: string; role: string; package: string; deadline: string; drive_status: string;
      }[];
    }>('/placement/my-applications'),
  getApplications: () =>
    getJson<{
      applications: {
        id: number; status: string; applied_at?: string; updated_at?: string;
        user_id: number; username: string; user_name: string; roll_no: string;
        drive_id: number; company: string; role: string; package: string; deadline: string; drive_status: string;
      }[];
    }>('/placement/applications'),
  updateApplicationStatus: (appId: number, status: string) =>
    sendJson<{ application: { id: number; status: string } }>(`/placement/applications/${appId}`, 'PATCH', { status }),

  // Club manager (own clubs only)
  getClubMembers: (clubId: number) =>
    getJson<{ members: { id: number; username: string; joinedAt?: string | null; blocked: boolean }[] }>(`/manager/clubs/${clubId}/members`),
  addClubMember: (clubId: number, username: string) =>
    sendJson<{ success: boolean; member: { id: number; username: string } }>(`/manager/clubs/${clubId}/members`, 'POST', { username }),
  managerBlockUsers: (clubId: number, userIds: number[]) =>
    sendJson<{ success: boolean; blocked: number }>(`/manager/clubs/${clubId}/block`, 'POST', { userIds }),
  managerUnblockUsers: (clubId: number, userIds: number[]) =>
    sendJson<{ success: boolean; unblocked: number }>(`/manager/clubs/${clubId}/unblock`, 'POST', { userIds }),
};