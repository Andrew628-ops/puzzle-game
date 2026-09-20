export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';
export type Page =
  | 'home'
  | 'games'
  | 'play'
  | 'daily'
  | 'leaderboard'
  | 'achievements'
  | 'dashboard'
  | 'profile'
  | 'settings'
  | 'admin'
  | 'support'
  | 'reset-password';
export interface GameResult {
  id: string;
  difficulty: Difficulty;
  seconds: number;
  moves: number;
  hints: number;
  score: number;
  xp: number;
  daily: string | null;
  date: string;
}
export interface Player {
  id: string;
  role: 'admin' | 'player';
  username: string;
  email: string;
  avatar: string;
  bio: string;
  created_at: string;
  xp: number;
  level: number;
  history: GameResult[];
  achievements: { id: string; date: string }[];
}
export interface Preferences {
  sound: boolean;
  music: boolean;
  dark: boolean;
  animations: boolean;
  notifications: boolean;
  difficulty: Difficulty;
  theme: string;
}
export interface Leader {
  id: string;
  username: string;
  avatar: string;
  score: number;
  level: number;
  fastest: number;
  fewest: number;
  rank: number;
}
export interface GameDefinition {
  id: string;
  name: string;
  description: string;
  tag: string;
  color: string;
  available: boolean;
}
export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  goal: number;
  metric?: string;
}
export interface Announcement {
  id: string;
  title: string;
  body: string;
  updated_at: string;
  published?: number;
  created_at?: string;
}
export interface PlayerReport {
  id: string;
  category: string;
  subject: string;
  body: string;
  status: 'open' | 'resolved';
  response: string;
  created_at: string;
  updated_at: string;
  username?: string;
}
export interface DailyChallenge {
  date: string;
  difficulty: Difficulty;
  board: number[];
  solution: number[];
}
