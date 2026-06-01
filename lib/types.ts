export type Subject = "mechanics" | "electrodynamics" | "thermodynamics" | "quantum_mechanics";
export type Difficulty = "class_11" | "class_12" | "college";
export type StepType = "trap" | "identify" | "principle" | "setup" | "sanity" | "connect" | "why";
export type ProblemStatus = "draft" | "approved" | "published" | "rejected";

export interface StepOption {
  text: string;
  correct: boolean;
  feedback: string;
}

export interface Step {
  type: StepType;
  label: string;
  icon: string;
  prompt: string;
  options: StepOption[];
  tip: string;
}

export interface SolutionFlow {
  steps: Step[];
}

export interface Problem {
  id: string;
  title: string;
  subject: Subject;
  topic: string;
  difficulty: Difficulty;
  scenario: string;
  goal: string;
  final_answer: string;
  diagram_type?: string | null;
  solution_flow: SolutionFlow;
  status: ProblemStatus;
  created_at: string;
}

export interface GenerateRequest {
  subject: Subject;
  topic: string;
  difficulty: Difficulty;
  count?: number;
}

export interface Attempt {
  id: string;
  user_id: string;
  problem_id: string;
  steps_correct: number;
  steps_total: number;
  xp_earned: number;
  stars: number;
  completed_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name?: string | null;
  avatar_url?: string | null;
  total_xp: number;
  current_streak: number;
  longest_streak: number;
  last_active_date?: string | null;
  created_at: string;
}

export interface ProfileStats {
  total_xp: number;
  current_streak: number;
  problems_solved: number;
  subject_counts: Record<Subject, number>;
}
