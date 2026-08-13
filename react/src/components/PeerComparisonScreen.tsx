import React, { useState, useEffect } from 'react';
import { ScreenType } from '../types';
import {
  Users, Award, TrendingUp, Sparkles, ChevronRight, Bot, Zap,
  ArrowUpRight, ArrowDownRight, RefreshCw, BarChart3, Target,
  Plus, Check, ExternalLink, Trophy, Menu, X, Search, ChevronDown
} from 'lucide-react';
import { api, CompareResponse, CompareSkill, SkillTopics } from '../api';

interface PeerComparisonScreenProps {
  onNavigate: (screen: ScreenType, transition?: 'none' | 'push' | 'slide_up') => void;
}

const DSA_PLATFORMS = [
  { id: 'leetcode', name: 'LeetCode' },
  { id: 'gfg', name: 'GeeksforGeeks' },
  { id: 'cf', name: 'Codeforces' },
  { id: 'cc', name: 'CodeChef' },
  { id: 'tuf', name: 'Take U Forward' },
];

export const PeerComparisonScreen: React.FC<PeerComparisonScreenProps> = ({ onNavigate }) => {
  const [data, setData] = useState<CompareResponse | null>(null);
  const [sortBy, setSortBy] = useState<string>('recent');
  const [selectedPlatform, setSelectedPlatform] = useState('leetcode');
  const [simulatedScore, setSimulatedScore] = useState<number>(60);
  const [showAddSkill, setShowAddSkill] = useState(false);
  const [newSkill, setNewSkill] = useState({ name: '', category: 'DSA', platform: '' });
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [simSearch, setSimSearch] = useState('');
  const [simSelected, setSimSelected] = useState<CompareSkill | null>(null);
  const [simModalOpen, setSimModalOpen] = useState(false);
  const [simTopics, setSimTopics] = useState<Record<string, boolean>>({});
  const [simOpenLevel, setSimOpenLevel] = useState<string>('beginner');
  const [savingSim, setSavingSim] = useState(false);
  const [skillTopics, setSkillTopics] = useState<SkillTopics[]>([]);
  const [skillFilter, setSkillFilter] = useState('');
  const [scopeBy, setScopeBy] = useState<string>('all');

  const loadCompare = async (sort: string, scope?: string) => {
    try {
      const res = await api.getCompare(sort, scope || scopeBy);
      setData(res);
      syncCheckedTopics(res.skills);
    } catch (err: any) {
      setError(err.message || 'Failed to load comparison data');
    }
  };

  // Seed the per-skill topic checklist from each skill's stored mastery so that
  // opening the expanded view shows previously selected topics as checked.
  // Existing (already toggled) state is preserved; only unknown skills are added.
  const syncCheckedTopics = (skills: CompareSkill[]) => {
    if (!skills?.length) return;
    setCheckedTopics((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const s of skills) {
        if (next[s.id] !== undefined) continue;
        next[s.id] = topicsForMastery(s, s.mastery);
        changed = true;
      }
      return changed ? next : prev;
    });
  };

  useEffect(() => {
    loadCompare(sortBy);
    api.getSkillTopics().then((res) => setSkillTopics(res.skills || [])).catch(() => setSkillTopics([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeSort = (s: string) => {
    setSortBy(s);
    loadCompare(s, scopeBy);
  };

  const changeScope = (s: string) => {
    setScopeBy(s);
    loadCompare(sortBy, s);
  };

  const handleAddBenchmarkSkill = async () => {
    if (!newSkill.name.trim()) return;
    try {
      await api.addBenchmarkSkill(newSkill.name.trim().toUpperCase(), newSkill.category || 'Core CS', newSkill.platform || '');
      setNewSkill({ name: '', category: 'DSA', platform: '' });
      setShowAddSkill(false);
      loadCompare(sortBy);
    } catch (err: any) {
      setError(err.message || 'Failed to add skill');
    }
  };

  const handleDeleteSkill = async (id: string) => {
    if (!window.confirm('Delete this skill?')) return;
    try {
      await api.deleteSkill(id);
      loadCompare(sortBy);
    } catch (err: any) {
      setError(err.message || 'Failed to delete skill');
    }
  };

  const handleExpand = (skill: CompareSkill) => {
    setExpandedSkill(expandedSkill === skill.id ? null : skill.id);
  };


  // topic-checklist state per expanded skill (mirrors the Skill Mastery modal)
  const [checkedTopics, setCheckedTopics] = useState<Record<string, Record<string, boolean>>>({});

  const topicTotalFor = (skill: CompareSkill, checked: Record<string, boolean>) => {
    const topics = getTopics(skill);
    const weights = {
      beginner: 33.33 / Math.max(1, topics.beginner.length),
      intermediate: 33.33 / Math.max(1, topics.intermediate.length),
      advanced: 33.33 / Math.max(1, topics.advanced.length),
    };
    return Math.round(
      (['beginner', 'intermediate', 'advanced'] as const).reduce((acc, key) => {
        const arr = topics[key] || [];
        const done = arr.filter((t) => checked[t]).length;
        return acc + done * weights[key];
      }, 0)
    );
  };

  const toggleCardTopic = async (skill: CompareSkill, topic: string) => {
    const prev = checkedTopics[skill.id] || {};
    const next = { ...prev, [topic]: !prev[topic] };
    setCheckedTopics((s) => ({ ...s, [skill.id]: next }));
    try {
      await api.updateSkill(skill.id, { masteryScore: topicTotalFor(skill, next) });
      loadCompare(sortBy);
    } catch (err) { console.error(err); }
  };

  // Select All / Deselect All for one level in the expanded skill checklist.
  const toggleLevelCardTopics = async (skill: CompareSkill, levelKey: 'beginner' | 'intermediate' | 'advanced') => {
    const prev = checkedTopics[skill.id] || {};
    const arr = getTopics(skill)[levelKey] || [];
    const allChecked = arr.length > 0 && arr.every((t) => prev[t]);
    const next = { ...prev };
    arr.forEach((t) => { next[t] = !allChecked; });
    setCheckedTopics((s) => ({ ...s, [skill.id]: next }));
    try {
      await api.updateSkill(skill.id, { masteryScore: topicTotalFor(skill, next) });
      loadCompare(sortBy);
    } catch (err) { console.error(err); }
  };

  // Select All / Deselect All for one level in the simulator modal (local only).
  const toggleLevelSimTopics = (levelKey: 'beginner' | 'intermediate' | 'advanced') => {
    if (!simSelected) return;
    const arr = getTopics(simSelected)[levelKey] || [];
    const allChecked = arr.length > 0 && arr.every((t) => simTopics[t]);
    setSimTopics((prev) => {
      const next = { ...prev };
      arr.forEach((t) => { next[t] = !allChecked; });
      return next;
    });
  };

  // ---- Skill Simulator: topic checklist per level ----
  const LEVELS = [
    { key: 'beginner', label: 'Beginner', color: 'text-[#3cd7ff]', border: 'border-[#3cd7ff]/30', bg: 'bg-[#3cd7ff]/10' },
    { key: 'intermediate', label: 'Intermediate', color: 'text-amber-300', border: 'border-amber-400/30', bg: 'bg-amber-400/10' },
    { key: 'advanced', label: 'Advanced', color: 'text-rose-300', border: 'border-rose-400/30', bg: 'bg-rose-400/10' },
  ];

  const TOPICS: Record<string, { beginner: string[]; intermediate: string[]; advanced: string[] }> = {
    default: {
      beginner: ['Core concepts', 'Basic syntax', 'Simple functions', 'Data structures intro', 'Loops & conditionals', 'Input/output', 'Debugging basics', 'Version control intro', 'Documentation', 'Simple projects'],
      intermediate: ['Advanced syntax', 'OOP principles', 'API design', 'Testing & debugging', 'Performance basics', 'SQL & databases', 'Component architecture', 'Security basics', 'Deployment basics', 'Team workflows'],
      advanced: ['System design', 'Scalability', 'Performance tuning', 'Advanced algorithms', 'Microservices', 'CI/CD pipelines', 'Distributed systems', 'Security hardening', 'Observability', 'Production incidents', 'Mentoring juniors'],
    },
    DSA: {
      beginner: ['Arrays & Strings', 'Linked Lists', 'Stacks & Queues', 'Hashing', 'Recursion & backtracking', 'Sorting', 'Binary Search', 'Sliding window', 'Two pointers', 'Greedy basics', 'Brute force optimization'],
      intermediate: ['Trees & BST', 'Heaps', 'Graphs & DFS/BFS', 'Topological sort', 'DP fundamentals', 'Knapsack & LCS', 'Dijkstra', 'Union-Find', 'Bit manipulation', 'Matrix problems', 'Monotonic stack'],
      advanced: ['Segment trees', 'Fenwick trees', 'Trie', 'Fenwick advanced', 'DP on trees', 'Graph advanced', 'Flows & matchings', 'Game theory', 'String algorithms', 'Hard greedy/Ad-hoc'],
    },
    'Languages': {
      beginner: ['Syntax & variables', 'Conditionals & loops', 'Functions', 'Lists/Dictionaries', 'Error handling', 'File I/O', 'Modules & imports', 'String manipulation', 'Basic debugging', 'CLP basics'],
      intermediate: ['OOP (classes)', 'Inheritance/polymorphism', 'Functional programming', 'Decorators/lambdas', 'Generics', 'Collections', 'Error strategy', 'Packages & env', 'Testing & mocks', 'Concurrency intro'],
      advanced: ['Meta-programming', 'Performance tuning', 'Memory management', 'Design patterns', 'Async/await advanced', 'Compiler fundamentals', 'Higher-order functions', 'Refactoring', 'Framework internals', 'Open-source contribution'],
    },
    'AI & ML': {
      beginner: ['Python basics', 'NumPy', 'Pandas', 'Data cleaning', 'Matplotlib', 'Regression', 'Classification', 'Intro to neural nets', 'Train/val/test splits', 'Model evaluation'],
      intermediate: ['CNNs', 'RNNs/LSTMs', 'NLP & embeddings', 'Modern transformers', 'Libraries fastai', 'Feature engineering', 'Hyperparameters', 'Regularization', 'Autoencoders', 'Model serialization'],
      advanced: ['Transformers in depth', 'LLM fine-tuning', 'RL', 'Distributed training', 'MLOps pipelines', 'Model monitoring', 'Vision architectures', 'Optimizations', 'Cutting edge papers', 'Deployment at scale'],
    },
    'Core CS': {
      beginner: ['Logic & proofs', 'Number systems', 'Basic complexity', 'Data types', 'Functions & flow', 'Simple recursion', 'Introduction to OS', 'Basics networking', 'Boolean logic', 'Simple data structures'],
      intermediate: ['OS processes', 'Memory management', 'Computer networks', 'TCP/IP', 'DBMS models', 'SQL', 'Design patterns', 'Algorithmic analysis', 'Multithreading', 'Sockets'],
      advanced: ['Compiler design', 'Architecture', 'Distributed DBs', 'Advanced networks', 'Cryptography', 'System-level tools', 'Cache & coherence', 'Virtualization', 'Quantum basics', 'Research methods'],
    },
    'DevOps & Cloud': {
      beginner: ['Linux commands', 'Git & branches', 'Bash scripting', 'Container basics', 'Intro to cloud', 'CI/CD intro', 'Server basics', 'Monitoring basics', 'Networking basics', 'Artifact management'],
      intermediate: ['Docker in depth', 'Kubernetes basics', 'AWS services', 'Terraform', 'Ansible', 'CI/CD pipelines', 'Logging & tracing', 'Secrets management', 'Multi-cloud patterns', 'Cost optimization'],
      advanced: ['K8s clusters', 'Infra as code', 'Service mesh', 'Edge/severless', 'SRE practices', 'Compliance & controls', 'Disaster recovery', 'Autoscaling', 'Zero-downtime deploys', 'Cloud architecture'],
    },
  };

  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

  const SKILL_ALIASES: Record<string, string> = {
    c: 'C Programming Language & System Concepts',
    cpp: 'C++ Programming',
    os: 'Operating Systems (OS) & System Architecture',
    'operating systems': 'Operating Systems (OS) & System Architecture',
    cn: 'Computer Networks & Network Protocols',
    networks: 'Computer Networks & Network Protocols',
    networking: 'Computer Networks & Network Protocols',
    aptitude: 'Quantitative Aptitude & Logical Reasoning (Placement / Competitive)',
    quant: 'Quantitative Aptitude & Logical Reasoning (Placement / Competitive)',
    reasoning: 'Quantitative Aptitude & Logical Reasoning (Placement / Competitive)',
    'video editing': 'Video Editing & Post-Production',
    vfx: 'Visual Effects (VFX) & Compositing',
    ui: 'User Interface (UI) Design & Design Systems',
    'ui design': 'User Interface (UI) Design & Design Systems',
    ux: 'Human-Computer Interaction (HCI) & UX Research',
    'graphic design': 'Graphic Design & Brand Identity',
    'motion graphics': 'Motion Graphics & 2D/3D Animation',
    js: 'JavaScript (JS)',
    javascript: 'JavaScript (JS)',
    node: 'Node.js & Express',
    nodejs: 'Node.js & Express',
    express: 'Node.js & Express',
    expressjs: 'Node.js & Express',
    sql: 'Databases, SQL & PostgreSQL',
    dbms: 'Databases, SQL & PostgreSQL',
    postgresql: 'Databases, SQL & PostgreSQL',
    mongodb: 'Databases, SQL & PostgreSQL',
    mysql: 'Databases, SQL & PostgreSQL',
    react: 'React Framework',
    next: 'Next.js Framework',
    nextjs: 'Next.js Framework',
    dsa: 'Data Structures & Algorithms (DSA)',
    ds: 'Data Structures & Algorithms (DSA)',
    python: 'Python Programming',
    java: 'Java & Core Ecosystem',
    spring: 'Spring Framework & Spring Boot',
    django: 'Django & Django REST Framework',
    flask: 'Django & Django REST Framework',
    fastapi: 'FastAPI',
    html: 'HTML & CSS Basics',
    html5: 'HTML & CSS Basics',
    css: 'HTML & CSS Basics',
    css3: 'HTML & CSS Basics',
    numpy: 'Machine Learning & Data Science',
    pandas: 'Machine Learning & Data Science',
    tensorflow: 'Machine Learning & Data Science',
    pytorch: 'Machine Learning & Data Science',
    keras: 'Machine Learning & Data Science',
    ml: 'Machine Learning & Data Science',
    'machine learning': 'Machine Learning & Data Science',
    deeplearning: 'Deep Learning Core',
    cv: 'Computer Vision (CV)',
    nlp: 'Natural Language Processing (NLP)',
    genai: 'Generative AI & Large Language Models (LLMs)',
    llm: 'Generative AI & Large Language Models (LLMs)',
    rag: 'RAG & Autonomous AI Agents',
    cloud: 'Cloud Computing, Linux & Bash',
    linux: 'Cloud Computing, Linux & Bash',
    devops: 'DevOps, Docker, Kubernetes & IaC',
    docker: 'DevOps, Docker, Kubernetes & IaC',
    kubernetes: 'DevOps, Docker, Kubernetes & IaC',
    k8s: 'DevOps, Docker, Kubernetes & IaC',
    cyber: 'Cybersecurity & Ethical Hacking',
    security: 'Cybersecurity & Ethical Hacking',
    iot: 'IoT & IoT Analytics',
    flutter: 'Flutter, Dart & Firebase',
    blockchain: 'Blockchain, Ethereum & Solidity',
    solidity: 'Blockchain, Ethereum & Solidity',
    ethereum: 'Blockchain, Ethereum & Solidity',
  };

  const findTopics = (skill: CompareSkill) => {
    if (!skill?.name) return null;
    const alias = SKILL_ALIASES[normalize(skill.name)] || SKILL_ALIASES[skill.name.toLowerCase()];
    if (alias) {
      const hit = skillTopics.find((st) => normalize(st.name) === normalize(alias));
      if (hit) return hit;
    }
    const key = normalize(skill.name);
    let exact = skillTopics.find((st) => normalize(st.name) === key);
    if (exact) return exact;
    if (key.length >= 3) {
      const byContains = skillTopics
        .filter((st) => normalize(st.name).includes(key))
        .sort((a, b) => normalize(a.name).length - normalize(b.name).length)[0];
      if (byContains) return byContains;
    }
    return null;
  };

  const getTopics = (skill: CompareSkill) => {
    const match = findTopics(skill);
    if (match) {
      return {
        beginner: match.beginner,
        intermediate: match.intermediate,
        advanced: match.advanced,
      };
    }
    return TOPICS[skill.category] || TOPICS.default;
  };

  // Reverse of topicTotalFor: given a stored mastery %, work out which topics
  // are considered "checked" so the checklist opens showing what was selected.
  // Levels are filled in order (Beginner -> Intermediate -> Advanced), each
  // contributing up to ~33.33%.
  const topicsForMastery = (skill: CompareSkill, mastery: number) => {
    const topics = getTopics(skill);
    const checked: Record<string, boolean> = {};
    let remaining = Math.max(0, Math.min(100, mastery || 0));
    for (const lvl of ['beginner', 'intermediate', 'advanced'] as const) {
      const arr = topics[lvl] || [];
      if (!arr.length) continue;
      const perTopic = 33.33 / arr.length;
      const share = Math.min(33.33, Math.max(0, remaining));
      const toCheck = Math.round(share / perTopic);
      for (let i = 0; i < Math.min(arr.length, toCheck); i++) checked[arr[i]] = true;
      remaining -= 33.33;
    }
    return checked;
  };

  const getSimSearchResults = (skillsList: CompareSkill[]) =>
    simSearch.trim()
      ? skillsList.filter((s) => s.name.toLowerCase().includes(simSearch.toLowerCase())).slice(0, 5)
      : [];

  const openSimModal = (skill: CompareSkill) => {
    setSimSelected(skill);
    const all = {} as Record<string, boolean>;
    const topics = getTopics(skill);
    Object.values(topics).forEach((arr) => arr.forEach((t) => { all[t] = false; }));
    // restore previously selected topics from the stored mastery so the modal
    // reopens showing what was selected last time
    const fromMastery = topicsForMastery(skill, skill.mastery);
    Object.keys(fromMastery).forEach((t) => { if (fromMastery[t]) all[t] = true; });
    setSimTopics(all);
    setSimOpenLevel('beginner');
    setSimModalOpen(true);
  };

  // weightage: each level = 33.33%, per-topic = 33.33 / topicCount
  const simWeights = simSelected
    ? (() => {
        const topics = getTopics(simSelected);
        return {
          beginner: 33.33 / Math.max(1, topics.beginner.length),
          intermediate: 33.33 / Math.max(1, topics.intermediate.length),
          advanced: 33.33 / Math.max(1, topics.advanced.length),
        };
      })()
    : { beginner: 0, intermediate: 0, advanced: 0 };

  const simTotal = simSelected
    ? Math.round(
        LEVELS.reduce((acc, lvl) => {
          const topics = getTopics(simSelected);
          const checked = topics[lvl.key as keyof typeof topics].filter((t) => simTopics[t]).length;
          return acc + checked * simWeights[lvl.key as keyof typeof simWeights];
        }, 0)
      )
    : 0;

  const saveSimulation = async () => {
    if (!simSelected) return;
    setSavingSim(true);
    try {
      await api.updateSkill(simSelected.id, { masteryScore: simTotal });
      setSimModalOpen(false);
      await loadCompare(sortBy);
    } catch (err: any) {
      setError(err.message || 'Failed to update skill');
    } finally {
      setSavingSim(false);
    }
  };

  if (error && !data) {
    return <main className="pt-24 px-4 max-w-7xl mx-auto text-[#c6c5d7]">{error}</main>;
  }
  if (!data) {
    return <main className="pt-24 px-4 max-w-7xl mx-auto text-[#c6c5d7]">Loading comparison data...</main>;
  }

  const { skills, cohorts } = data;
  const selectedCohort = cohorts[0];

  const weakest = skills.length ? [...skills].sort((a, b) => a.mastery - b.mastery)[0] : null;

  const avgUserScore = skills.length
    ? Math.round(skills.reduce((acc, s) => acc + s.mastery, 0) / skills.length)
    : 0;
  const avgCohortScore = skills.length
    ? Math.round(skills.reduce((acc, s) => acc + s.cohortAvg, 0) / skills.length)
    : 0;
  const avgTop10Score = skills.length
    ? Math.round(skills.reduce((acc, s) => acc + s.top10Avg, 0) / skills.length)
    : 0;

  const estimatedPercentile = skills.length
    ? Math.min(99, Math.max(50, Math.round(80 + (avgUserScore - avgCohortScore) * 0.8)))
    : 0;

  // optional skill filter for the summary cards: empty = all skills
  const normalizedFilter = skillFilter.trim().toLowerCase();
  const matchedSkill = normalizedFilter
    ? skills.find((s) => s.name.toLowerCase() === normalizedFilter) ||
      skills.find((s) => s.name.toLowerCase().includes(normalizedFilter))
    : undefined;

  const sc = (fn: (s: CompareSkill) => number) => {
    if (matchedSkill) return fn(matchedSkill);
    const arr = skills;
    return arr.length ? Math.round(arr.reduce((acc, s) => acc + fn(s), 0) / arr.length) : 0;
  };

  const displayUserScore = sc((s) => s.mastery);
  const displayCohortScore = sc((s) => s.cohortAvg);
  const displayTop10Score = sc((s) => s.top10Avg);
  const displayPercentile = matchedSkill
    ? Math.min(99, Math.max(1, Math.round(50 + (matchedSkill.mastery - matchedSkill.cohortAvg) * 2)))
    : estimatedPercentile;
  const displayRank = matchedSkill
    ? matchedSkill.userRankInSkill ?? null
    : (selectedCohort.userRank || null);
  const displayRankTotal = matchedSkill
    ? matchedSkill.cohortSize ?? null
    : (selectedCohort.totalStudents || null);

  const topSorted = [...skills].sort((a, b) => b.mastery - a.mastery).slice(0, 10);

  const sortedLabel = sortBy === 'mastery' ? 'Mastery (highest first)'
    : sortBy === 'category' ? 'Category'
    : sortBy === 'recent' ? 'Recently updated (first)'
    : 'Weakest first';

  return (
    <main className="pt-20 pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <section className="glass-panel p-6 sm:p-8 rounded-3xl relative overflow-hidden space-y-6">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#5b5fef]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#3cd7ff]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#5b5fef]/20 border border-[#5b5fef]/40 text-[#c0c1ff] text-xs font-semibold mb-3">
              <Users className="w-3.5 h-3.5 text-[#3cd7ff]" />
              <span>MBM University · Peer & Cohort Analytics</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
              Skill Comparison & Rank
            </h1>
            <p className="text-xs sm:text-sm text-[#c6c5d7] mt-1 max-w-2xl">
              Rank formula: DSA 25% · Projects &amp; complexity 15% · Languages 15% · Aptitude · Hackathons · Internship 5%.
            </p>
          </div>
        </div>

          {/* Skill filter for summary */}
        <div className="flex flex-wrap items-center gap-3 pt-2 relative z-10">
          <div className="flex items-center gap-2 flex-1 min-w-[220px] max-w-md">
            <Search className="w-4 h-4 text-[#c6c5d7] shrink-0" />
            <input
              type="text"
              value={skillFilter}
              onChange={(e) => setSkillFilter(e.target.value)}
              placeholder="Type a skill name (e.g. SQL) — or leave blank for all skills"
              className="flex-1 bg-[#181824] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#c0c1ff] placeholder-[#6b6b7d]"
            />
            {skillFilter && (
              <button
                onClick={() => setSkillFilter('')}
                className="text-[#c6c5d7] hover:text-white text-lg leading-none cursor-pointer shrink-0"
                title="Clear filter"
              >
                ×
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#3cd7ff] shrink-0" />
            <select
              value={scopeBy}
              onChange={(e) => changeScope(e.target.value)}
              className="styled-select !bg-[#181824] !py-2"
              title="Benchmark scope"
            >
              <option value="all">All</option>
              <option value="department">Department</option>
              <option value="branch">Branch</option>
              <option value="semester">Semester</option>
            </select>
          </div>
          <span className="text-[11px] text-[#c6c5d7]">
            {matchedSkill
              ? `Showing stats for "${matchedSkill.name}"`
              : normalizedFilter ? 'No matching skill — showing all skills' : 'Showing all skills'}
          </span>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2 relative z-10">
          <div className="bg-[#181824] p-4 rounded-2xl border border-white/10 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#5b5fef] to-[#5203d5] flex items-center justify-center text-white shrink-0 shadow-md">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-[#c6c5d7] uppercase tracking-wider">Your Rank</span>
              <p className="text-xl font-extrabold text-white">
                {displayRank && displayRank > 0 ? (
                  <>#{displayRank} <span className="text-xs text-[#c6c5d7] font-normal">/ {displayRankTotal}</span></>
                ) : (
                  '—'
                )}
              </p>
            </div>
          </div>

          <div className="bg-[#181824] p-4 rounded-2xl border border-white/10 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#3cd7ff]/20 to-[#5b5fef]/20 border border-[#3cd7ff]/40 flex items-center justify-center text-[#3cd7ff] shrink-0">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-[#c6c5d7] uppercase tracking-wider">Cohort Percentile</span>
              <p className="text-xl font-extrabold text-[#3cd7ff]">{displayPercentile}th</p>
            </div>
          </div>

          <div className="bg-[#181824] p-4 rounded-2xl border border-white/10 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#292932] flex items-center justify-center text-[#c0c1ff] shrink-0">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-[#c6c5d7] uppercase tracking-wider">Your Mastery Avg</span>
              <p className="text-xl font-extrabold text-white">
                {displayUserScore} <span className="text-xs text-emerald-400 font-bold">{displayCohortScore ? `+${displayUserScore - displayCohortScore} vs avg` : ''}</span>
              </p>
            </div>
          </div>

          <div className="bg-[#181824] p-4 rounded-2xl border border-white/10 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#292932] flex items-center justify-center text-[#cdbdff] shrink-0">
              <Target className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-[#c6c5d7] uppercase tracking-wider">Top 10% Goal</span>
              <p className="text-xl font-extrabold text-[#cdbdff]">
                {displayTop10Score} <span className="text-xs text-amber-400 font-bold">{displayUserScore ? `-${displayTop10Score - displayUserScore} gap` : ''}</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Skill Matrix */}
        <section className="lg:col-span-2 glass-panel p-6 sm:p-8 rounded-3xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[#3cd7ff]" />
                <span>Skill Breakdown vs Cohort &amp; Top 10%</span>
              </h2>
              <p className="text-xs text-[#c6c5d7]">Ordered: {sortedLabel}. Click a skill to toggle its checkpoints.</p>
            </div>
            {/* Sort Control */}
            <div className="bg-[#191924] p-3 rounded-2xl border border-white/10 shrink-0">
              <label className="text-[10px] font-bold text-[#c6c5d7] uppercase tracking-wider block mb-1">
                Sort skills by
              </label>
              <select
                value={sortBy}
                onChange={(e) => changeSort(e.target.value)}
                className="styled-select w-full text-xs font-semibold !bg-[#292932] !py-2"
              >
                <option value="recent">Recently updated</option>
                <option value="branch">Weakest first (default)</option>
                <option value="mastery">Highest mastery first</option>
                <option value="category">By category</option>
              </select>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-6 text-xs font-medium bg-[#181824] p-3 rounded-xl border border-white/5">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm bg-gradient-to-r from-[#5b5fef] to-[#3cd7ff]" />
              <span className="text-white">Your Mastery</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm bg-rose-500/80" />
              <span className="text-rose-300">Cohort Avg</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm bg-amber-500/80" />
              <span className="text-amber-300">Top 10%</span>
            </div>
          </div>

          <div className="space-y-4">
            {skills.length === 0 ? (
              <div className="text-center py-14 border border-dashed border-[#464555] rounded-2xl">
                <Plus className="w-12 h-12 text-[#3cd7ff] mx-auto mb-4" />
                <h4 className="text-lg font-bold text-white mb-1">No skills yet</h4>
                <p className="text-sm text-[#c6c5d7] mb-6 max-w-sm mx-auto">
                  Add a skill with its DSA platform to start benchmarking against the cohort.
                </p>
                <button
                  onClick={() => setShowAddSkill(true)}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#5b5fef] to-[#3cd7ff] text-white text-sm font-semibold hover:opacity-90 transition-all cursor-pointer flex items-center gap-2 mx-auto"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Skill</span>
                </button>
              </div>
            ) : (
              skills.map((skill) => {
                const displayUserScore = skill.mastery;
                const isLeading = displayUserScore >= skill.cohortAvg;
                const gapToTop10 = skill.top10Avg - displayUserScore;
                const expanded = expandedSkill === skill.id;

                return (
                  <div key={skill.id} className="p-4 bg-[#181824] rounded-2xl border border-white/5 hover:border-white/20 transition-all space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-[#3cd7ff] uppercase tracking-wider block">
                          {skill.category}{skill.platform ? ` · ${skill.platform}` : ''}
                        </span>
                        <h4 className="text-sm font-bold text-white flex items-center gap-2">
                          <button
                            onClick={() => { setSimSearch(''); setSimSelected(skill); setTimeout(() => document.getElementById('skill-simulator')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50); }}
                            title={`Update "${skill.name}" mastery in the simulator`}
                            className="text-left hover:text-[#3cd7ff] transition-colors cursor-pointer"
                          >
                            {skill.name}
                          </button>
                          {isLeading ? (
                            <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-semibold flex items-center gap-0.5">
                              <ArrowUpRight className="w-3 h-3" />+{Math.max(0, displayUserScore - skill.cohortAvg)}% vs avg
                            </span>
                          ) : (
                            <span className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-full font-semibold flex items-center gap-0.5">
                              <ArrowDownRight className="w-3 h-3" />-{skill.cohortAvg - displayUserScore}% vs avg
                            </span>
                          )}
                        </h4>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <span className="text-base font-extrabold text-white">{displayUserScore}</span>
                          <span className="text-xs text-[#c6c5d7]"> / 100</span>
                        </div>
                        <button
                          onClick={() => handleDeleteSkill(skill.id)}
                          title={`Delete ${skill.name}`}
                          className="w-7 h-7 rounded-full bg-rose-500/15 border border-rose-500/40 text-rose-400 flex items-center justify-center cursor-pointer hover:bg-rose-500 hover:text-white transition-all"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-[#c6c5d7] w-16 shrink-0">You</span>
                        <div className="flex-1 h-3 bg-[#292932] rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-[#5b5fef] to-[#3cd7ff] rounded-full transition-all duration-500" style={{ width: `${displayUserScore}%` }} />
                        </div>
                        <span className="text-[11px] font-bold text-[#3cd7ff] w-8 text-right">{displayUserScore}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-rose-300 w-16 shrink-0">
                          Cohort{skill.cohortSize != null ? ` (${skill.cohortSize})` : ''}
                        </span>
                        <div className="flex-1 h-2 bg-[#292932] rounded-full overflow-hidden">
                          <div className="h-full bg-rose-500/80 rounded-full" style={{ width: `${skill.cohortAvg}%` }} />
                        </div>
                        <span className="text-[11px] font-semibold text-rose-300 w-8 text-right">{skill.cohortAvg}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-amber-300 w-16 shrink-0 font-medium">Top 10%</span>
                        <div className="flex-1 h-2 bg-[#292932] rounded-full overflow-hidden">
                          <div className="h-full bg-amber-500/80 rounded-full" style={{ width: `${skill.top10Avg}%` }} />
                        </div>
                        <span className="text-[11px] font-semibold text-amber-300 w-8 text-right">{skill.top10Avg}%</span>
                      </div>
                      {skill.userRankInSkill != null && skill.cohortSize != null && skill.cohortSize > 1 && (
                        <p className="pt-1 text-[10px] text-[#c6c5d7]">
                          Your rank in this skill: <span className="text-[#3cd7ff] font-bold">#{skill.userRankInSkill}</span> of {skill.cohortSize}
                        </p>
                      )}
                    </div>

                    {/* Checkpoints */}
                    <button
                      onClick={() => handleExpand(skill)}
                      className="w-full mt-1 text-left flex items-center gap-1.5 px-3 py-2 bg-[#13131b] rounded-lg border border-white/5 hover:border-[#c0c1ff]/30 transition-all cursor-pointer"
                    >
                      <Menu className="w-3.5 h-3.5 text-[#c0c1ff]" />
                      <span className="text-[11px] font-semibold text-[#c6c5d7]">
                        Skill checkpoints (topic checklist)
                      </span>
                      <span className="ml-auto text-[#c6c5d7]">{expanded ? <X className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}</span>
                    </button>
                    {expanded && (
                      <div className="space-y-2 pl-2">
                        <div className="flex items-center justify-between px-1 pb-0.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#c6c5d7]">
                            {skill.name} Mastery
                          </span>
                          <span className={`text-[11px] font-extrabold ${skill.mastery >= 60 ? 'text-[#3cd7ff]' : skill.mastery >= 30 ? 'text-amber-300' : 'text-rose-300'}`}>
                            {skill.mastery}%
                          </span>
                        </div>
                        {(() => {
                          const topics = getTopics(skill);
                          const checked = checkedTopics[skill.id] || {};
                          return LEVELS.map((lvl) => {
                            const arr = topics[lvl.key as keyof typeof topics] || [];
                            if (!arr.length) return null;
                            const perTopic = 33.33 / arr.length;
                            return (
                              <div key={lvl.key} className="rounded-xl border border-white/10 bg-[#181824] overflow-hidden">
                                <div className="px-3 py-2 flex items-center justify-between">
                                  <span className={`text-[11px] font-bold ${lvl.color}`}>{lvl.label}</span>
                                  <div className="flex items-center gap-2">
                                    {arr.length > 0 && (
                                      <button
                                        onClick={() => toggleLevelCardTopics(skill, lvl.key as 'beginner' | 'intermediate' | 'advanced')}
                                        className={`text-[9px] px-2 py-0.5 rounded-full border font-bold transition-all cursor-pointer ${
                                          arr.every((t) => checked[t])
                                            ? `${lvl.bg} ${lvl.border} ${lvl.color}`
                                            : 'border-white/10 text-[#c6c5d7] hover:border-white/30'
                                        }`}
                                      >
                                        {arr.every((t) => checked[t]) ? 'Selected' : 'Select All'}
                                      </button>
                                    )}
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${lvl.bg} ${lvl.color} font-bold`}>
                                      {arr.filter((t) => checked[t]).length}/{arr.length}
                                    </span>
                                  </div>
                                </div>
                                <div className="px-3 pb-3 space-y-1">
                                  {arr.map((t) => {
                                    const isChecked = !!checked[t];
                                    return (
                                      <button
                                        key={t}
                                        onClick={() => toggleCardTopic(skill, t)}
                                        className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer text-left ${
                                          isChecked ? `${lvl.bg} ${lvl.border}` : 'border-white/5 hover:border-white/20'
                                        }`}
                                      >
                                        <span className={`w-4 h-4 shrink-0 rounded-md border flex items-center justify-center ${isChecked ? 'bg-[#3cd7ff] border-[#3cd7ff] text-[#001f27]' : 'border-white/30'}`}>
                                          {isChecked && <Check className="w-3 h-3" />}
                                        </span>
                                        <span className={`text-[11px] flex-1 ${isChecked ? 'text-white' : 'text-[#c6c5d7]'}`}>{t}</span>
                                        <span className={`text-[10px] font-bold ${lvl.color}`}>{perTopic.toFixed(1)}%</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    )}

                    {gapToTop10 > 15 && (
                      <div className="pt-1 flex items-center justify-between text-[11px] text-[#c6c5d7]">
                        <span className="text-amber-400 font-medium">💡 Gap to Top 10%: {gapToTop10} pts needed</span>
                        <button onClick={() => onNavigate('chat', 'push')} className="text-[#c0c1ff] hover:underline font-semibold flex items-center gap-1 cursor-pointer">
                          <span>Ask AI mentor</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Add Skill */}
          <div className="glass-panel p-6 rounded-3xl space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#c6c5d7]">Add Skill</h4>
              <button onClick={() => setShowAddSkill(!showAddSkill)} className="text-[11px] font-semibold text-[#c0c1ff] hover:underline cursor-pointer flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" />
                {showAddSkill ? 'Close' : 'New'}
              </button>
            </div>

            {showAddSkill ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-[#c6c5d7] uppercase tracking-wider mb-1">Skill Name</label>
                  <input
                    value={newSkill.name}
                    onChange={(e) => setNewSkill({ ...newSkill, name: e.target.value.toUpperCase() })}
                    placeholder="e.g. PyTorch, SQL, Kubernetes"
                    className="w-full bg-[#181824] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#c0c1ff] uppercase"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#c6c5d7] uppercase tracking-wider mb-1">Category</label>
                  <select
                    value={newSkill.category}
                    onChange={(e) => setNewSkill({ ...newSkill, category: e.target.value })}
                    className="styled-select w-full !bg-[#181824]"
                  >
                    <option value="DSA">DSA</option>
                    <option value="Languages">Languages</option>
                    <option value="AI & ML">AI & ML</option>
                    <option value="Core CS">Core CS</option>
                    <option value="DevOps & Cloud">DevOps & Cloud</option>
                    <option value="Web Development">Web Development</option>
                    <option value="Tools">Tools</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#c6c5d7] uppercase tracking-wider mb-1">DSA Platform</label>
                  <select
                    value={newSkill.platform}
                    onChange={(e) => setNewSkill({ ...newSkill, platform: e.target.value })}
                    className="styled-select w-full !bg-[#181824]"
                  >
                    <option value="">None</option>
                    {DSA_PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <button
                  onClick={handleAddBenchmarkSkill}
                  disabled={!newSkill.name.trim()}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#5b5fef] to-[#3cd7ff] text-white text-xs font-semibold hover:opacity-90 transition-all disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" /> <span>Track This Skill</span>
                </button>
              </div>
            ) : (
              <p className="text-xs text-[#c6c5d7]">
                Add a skill with a DSA platform and work through its checkpoints to grow your mastery and rank.
              </p>
            )}
          </div>

          {/* Platform Quick Links */}
          <div className="glass-panel p-6 rounded-3xl space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#c6c5d7] flex items-center gap-2">
              <Target className="w-4 h-4 text-[#3cd7ff]" /> DSA Practice Platforms
            </h4>
            <div className="flex flex-wrap gap-2">
              {DSA_PLATFORMS.map((p) => (
                <a
                  key={p.id}
                  href={`https://${p.id === 'tuf' ? 'takeuforward.org' : p.id === 'leetcode' ? 'leetcode.com' : p.id === 'gfg' ? 'geeksforgeeks.org' : p.id === 'cf' ? 'codeforces.com' : 'codechef.com'}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-[#181824] border border-white/10 text-[#c6c5d7] text-xs font-semibold hover:border-[#3cd7ff]/40 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {p.name}
                  <ExternalLink className="w-3 h-3" />
                </a>
              ))}
            </div>
          </div>

          {/* Skill Simulator */}
          <div id="skill-simulator" className="glass-panel p-6 rounded-3xl space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-white border-b border-white/10 pb-3">
              <Search className="w-4 h-4 text-[#3cd7ff]" />
              <span>Skill Mastery Simulator</span>
            </div>

            <p className="text-xs text-[#c6c5d7]">
              Search a skill and update its mastery by ticking the topics you've covered at each level.
            </p>

            <div className="relative">
              <input
                type="text"
                value={simSearch}
                onChange={(e) => setSimSearch(e.target.value)}
                placeholder="Search your skills... (e.g. DSA, Python)"
                className="w-full bg-[#181824] border border-white/10 rounded-xl px-3 py-2.5 pr-9 text-sm text-white focus:outline-none focus:border-[#c0c1ff] placeholder-[#c6c5d7]/50"
              />
              <Search className="w-4 h-4 text-[#908fa0] absolute right-3 top-3" />
              {simSearch.trim() && (
                <div className="absolute z-20 mt-1 w-full bg-[#191924] border border-white/10 rounded-xl overflow-hidden shadow-xl">
                  {getSimSearchResults(skills).length === 0 && (
                    <p className="px-3 py-2.5 text-xs text-[#c6c5d7]">No matching skills. Add the skill first.</p>
                  )}
                  {getSimSearchResults(skills).map((s) => (
                    <button
                      key={s.id}
                      onClick={() => { setSimSelected(s); setSimSearch(''); }}
                      className="w-full text-left px-3 py-2.5 text-xs text-white hover:bg-[#5b5fef]/15 transition-colors flex items-center justify-between cursor-pointer"
                    >
                      <span>{s.name}</span>
                      <span className="text-[#3cd7ff] font-bold">{s.mastery}%</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {simSelected && (
              <div className="flex items-center justify-between bg-[#5b5fef]/10 border border-[#5b5fef]/30 rounded-xl px-3 py-2">
                <div>
                  <p className="text-xs font-bold text-white">{simSelected.name}</p>
                  <p className="text-[10px] text-[#c6c5d7]">{simSelected.category}{simSelected.platform ? ` · ${simSelected.platform}` : ''} · current {simSelected.mastery}%</p>
                </div>
                <button
                  onClick={() => { setSimSelected(null); setSimSearch(''); }}
                  className="text-[#c6c5d7] hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <button
              onClick={() => simSelected && openSimModal(simSelected)}
              disabled={!simSelected}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#5b5fef] to-[#3cd7ff] text-white text-xs font-semibold hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Update Skill Mastery</span>
            </button>
          </div>

          {/* Top 10 by sort */}
          <div className="glass-panel p-6 rounded-3xl space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#c6c5d7] flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-300" />
              Top Skills {sortBy === 'branch' ? '(weakest → strongest)' : '(by mastery)'}
            </h4>
            <div className="space-y-2">
              {topSorted.map((skill, i) => (
                <div key={skill.id} className={`p-3 rounded-xl border flex items-center justify-between ${i === 0 ? 'border-amber-500/30 bg-[#181824]' : 'border-white/5 bg-[#181824]'}`}>
                  <div className="flex items-center gap-2.5">
                    <span className={`w-6 h-6 rounded-full font-bold text-xs flex items-center justify-center ${i === 0 ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-500/20 text-slate-300'}`}>{i + 1}</span>
                    <div>
                      <p className="text-xs font-bold text-white">{skill.name}</p>
                      <p className="text-[10px] text-[#c6c5d7]">{skill.category || 'Skill'}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-extrabold ${i === 0 ? 'text-amber-300' : 'text-[#3cd7ff]'}`}>{skill.mastery}%</span>
                </div>
              ))}
              {skills.length === 0 && <p className="text-[11px] text-[#c6c5d7]">No skills to rank yet.</p>}
            </div>
          </div>

          {/* AI Mentor */}
          <div className="glass-panel p-6 rounded-3xl space-y-4 border border-[#3cd7ff]/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#5b5fef] to-[#3cd7ff] flex items-center justify-center text-white shadow-md">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Ask AI Mentor</h4>
                <p className="text-xs text-[#c6c5d7]">Tailored advice based on peer gaps</p>
              </div>
            </div>
            <button
              onClick={() => onNavigate('chat', 'push')}
              className="w-full bg-gradient-to-r from-[#5b5fef] to-[#3cd7ff] text-white font-medium text-xs py-3 rounded-full shadow-md hover:scale-[1.02] active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Build a Skill Growth Plan in AI Chat</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Skill Update Modal */}
      {simModalOpen && simSelected && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setSimModalOpen(false)}>
          <div className="w-full max-w-lg glass-panel rounded-3xl overflow-hidden max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-[#5b5fef] to-[#5203d5]">
              <div>
                <h3 className="text-lg font-bold text-white">{simSelected.name}</h3>
                <p className="text-xs text-white/70">{simSelected.category}{simSelected.platform ? ` · ${simSelected.platform}` : ''} · Current {simSelected.mastery}%</p>
              </div>
              <button onClick={() => setSimModalOpen(false)} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <p className="text-xs text-[#c6c5d7]">
                Weightage is split equally across all 3 levels (~33.3% each). Each level's share is divided among its topics — tick the ones you know.
              </p>

              {(() => {
                const topics = getTopics(simSelected);
                return LEVELS.map((lvl) => {
                  const arr = topics[lvl.key as keyof typeof topics] || [];
                  const perTopic = 33.33 / Math.max(1, arr.length);
                  const checkedCount = arr.filter((t) => simTopics[t]).length;
                  const open = simOpenLevel === lvl.key;
                  return (
                    <div key={lvl.key} className="rounded-2xl border border-white/10 bg-[#181824] overflow-hidden">
                      <button
                        onClick={() => setSimOpenLevel(open ? '' : lvl.key)}
                        className="w-full px-4 py-3 flex flex-wrap items-center gap-2 justify-between text-left cursor-pointer hover:bg-white/5 transition-all"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className={`text-xs font-bold ${lvl.color}`}>{lvl.label}</span>
                          {arr.length > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleLevelSimTopics(lvl.key as 'beginner' | 'intermediate' | 'advanced');
                              }}
                              className={`text-[9px] px-2 py-0.5 rounded-full border font-bold transition-all cursor-pointer ${
                                arr.every((t) => simTopics[t])
                                  ? `${lvl.bg} ${lvl.border} ${lvl.color}`
                                  : 'border-white/10 text-[#c6c5d7] hover:border-white/30'
                              }`}
                            >
                              {arr.every((t) => simTopics[t]) ? 'Selected' : 'Select All'}
                            </button>
                          )}
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${lvl.bg} ${lvl.color} font-bold`}>
                            {checkedCount}/{arr.length}
                          </span>
                          <span className="hidden min-[420px]:inline text-[10px] text-[#c6c5d7]">~{33.33.toFixed(1)}% level · {perTopic.toFixed(1)}%/topic</span>
                        </div>
                        <ChevronDown className={`w-4 h-4 shrink-0 text-[#c6c5d7] transition-transform ${open ? 'rotate-180' : ''}`} />
                      </button>

                      {open && (
                        <div className="px-4 pb-4 space-y-1.5">
                          {(topics[lvl.key as keyof typeof topics] || []).map((t) => {
                            const checked = !!simTopics[t];
                            return (
                              <button
                                key={t}
                                onClick={() => setSimTopics((prev) => ({ ...prev, [t]: !prev[t] }))}
                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border transition-all cursor-pointer text-left ${
                                  checked ? `${lvl.bg} ${lvl.border}` : 'border-white/5 hover:border-white/20'
                                }`}
                              >
                                <span className={`w-4 h-4 shrink-0 rounded-md border flex items-center justify-center ${checked ? 'bg-[#3cd7ff] border-[#3cd7ff] text-[#001f27]' : 'border-white/30'}`}>
                                  {checked && <Check className="w-3 h-3" />}
                                </span>
                                <span className={`text-xs flex-1 ${checked ? 'text-white' : 'text-[#c6c5d7]'}`}>{t}</span>
                                <span className={`text-[10px] font-bold ${lvl.color}`}>{perTopic.toFixed(1)}%</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-[10px] text-[#c6c5d7] uppercase tracking-wider font-bold">New Mastery</p>
                <p className="text-2xl font-extrabold text-[#3cd7ff]">{simTotal}%</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setSimModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-[#292932] border border-white/10 text-xs font-semibold text-[#c6c5d7] hover:text-white transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={saveSimulation}
                  disabled={savingSim}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#5b5fef] to-[#3cd7ff] text-white text-xs font-semibold hover:opacity-90 transition-all disabled:opacity-50 cursor-pointer flex items-center gap-2"
                >
                  {savingSim ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>{savingSim ? 'Saving...' : 'Apply Change'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};