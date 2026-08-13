export type ScreenType = 'landing' | 'profile' | 'dashboard' | 'resume' | 'chat' | 'compare' | 'certificates' | 'projects' | 'clubs' | 'placement' | 'friends' | 'admin';

export interface ChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  timestamp?: string;
  options?: string[];
}

export interface StudentProfile {
  name: string;
  institution: string;
  semester: string;
  targetRole: string;
  avatarUrl: string;
  certificatesCount: number;
  achievementsCount: number;
  skillScore: number;
  skills: { name: string; percentage: number }[];
  recentActivities: { id: string; title: string; timeAgo: string; icon: string }[];
  codingProfiles: { name: string; url: string }[];
}

export interface ResumeAnalysisData {
  atsScore: number;
  scoreDelta: string;
  targetRole: string;
  identifiedStrengths: string[];
  recommendedAdditions: string[];
  actionableImprovements: {
    title: string;
    description: string;
    icon: string;
    type: 'links' | 'quantify' | 'certs';
  }[];
}
