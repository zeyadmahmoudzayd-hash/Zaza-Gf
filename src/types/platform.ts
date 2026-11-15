export interface SectionConfigItem {
  id: string;
  label: string;
  visible: boolean;
}

export interface SiteSettings {
  platform_name: string;
  tagline: string;
  logo_url: string;
  hero_kicker: string;
  hero_headline: string;
  hero_subheadline: string;
  hero_cta_label: string;
  hero_image_url: string;
  teacher_name: string;
  teacher_title: string;
  teacher_subject: string;
  teacher_bio: string;
  teacher_photo_url: string;
  teacher_credentials: string;
  theme_navy: string;
  theme_blue: string;
  theme_gold: string;
  theme_bg: string;
  whatsapp_number: string;
  contact_email: string;
  contact_phone: string;
  contact_address: string;
  contact_hours: string;
  footer_credit: string;
  sections_config: string;
  [key: string]: string;
}

export interface NavLink {
  id: number;
  label: string;
  target: string;
  sort_order: number;
  is_visible: number;
}

export interface CustomPage {
  id: number;
  slug: string;
  title: string;
  subtitle: string;
  content: string;
  is_published: number;
  updated_at: string;
}

export interface SubscriptionPlan {
  id: number;
  name: string;
  duration_days: number;
  price_egp: number;
  billing_label: string;
  description: string;
  features: string[];
  is_featured: number;
  is_active: number;
  sort_order: number;
}

export interface PaymentMethod {
  id: number;
  code: string;
  name: string;
  account_label: string;
  account_value: string;
  instructions: string;
  is_active: number;
  sort_order: number;
}

export interface CourseSummary {
  id: number;
  title: string;
  subject: string;
  grade: string;
  description: string;
  thumbnail_url: string;
  is_featured: number;
  is_published: number;
  sort_order: number;
  lesson_count?: number;
  total_minutes?: number;
  quiz_count?: number;
}

export interface LessonMaterial {
  id: number;
  lesson_id: number;
  title: string;
  material_type: string;
  file_url?: string;
  file_size: string;
}

export interface Lesson {
  id: number;
  unit_id: number;
  course_id: number;
  title: string;
  description: string;
  duration_minutes: number;
  video_url: string;
  video_type: 'upload' | 'external';
  access_type: 'free' | 'subscription' | 'restricted';
  sort_order: number;
  has_access?: boolean;
  completed?: boolean;
  watch_percent?: number;
  is_saved?: boolean;
  materials?: LessonMaterial[];
}

export interface Unit {
  id: number;
  course_id: number;
  title: string;
  description: string;
  sort_order: number;
  lessons: Lesson[];
}

export interface Quiz {
  id: number;
  course_id: number;
  lesson_id: number | null;
  title: string;
  description: string;
  time_limit_minutes: number;
  passing_score: number;
  randomize_questions: number;
  is_published: number;
  question_count?: number;
  course_title?: string;
  questions?: QuizQuestion[];
}

export interface QuizQuestion {
  id: number;
  quiz_id: number;
  question_type: 'multiple_choice' | 'true_false' | 'short_answer';
  question_text: string;
  options: string[];
  correct_index?: number;
  accepted_answer?: string;
  explanation?: string;
  sort_order: number;
}

export interface QuizFeedbackItem {
  question_id: number;
  question_type: string;
  question_text: string;
  is_correct: boolean;
  student_answer: string;
  correct_answer: string;
  explanation: string;
}

export interface QuizResult {
  score: number;
  total_questions: number;
  percentage: number;
  passed: boolean;
  passing_score: number;
  feedback: QuizFeedbackItem[];
  xp_awarded: number;
  newly_unlocked_badges: BadgeItem[];
}

export interface Assignment {
  id: number;
  course_id: number;
  lesson_id: number | null;
  title: string;
  instructions: string;
  due_date: string;
  max_score: number;
  my_submission?: {
    id: number;
    answer_text: string;
    file_url: string;
    score: number | null;
    feedback: string;
    status: 'submitted' | 'graded';
    submitted_at: string;
  } | null;
}

export interface Announcement {
  id: number;
  title: string;
  body: string;
  target_grade: string;
  is_pinned: number;
  is_published: number;
  created_at: string;
}

export interface Review {
  id: number;
  user_id: number | null;
  student_name: string;
  student_grade: string;
  rating: number;
  comment: string;
  outcome_metric: string;
  status: 'approved' | 'pending' | 'hidden';
  created_at: string;
}

export interface BadgeItem {
  id: number;
  code: string;
  title: string;
  description: string;
  icon_name: string;
  xp_reward: number;
  earned?: boolean;
  earned_at?: string | null;
}

export interface LeaderboardEntry {
  id: number;
  rank: number;
  full_name: string;
  grade: string;
  school: string;
  avatar_url: string;
  xp_points: number;
  badges_count: number;
  lessons_completed: number;
  avg_quiz_score: number;
  level: number;
  title: string;
}

export interface AuthUser {
  id: number;
  full_name: string;
  email: string;
  role: 'admin' | 'student';
  phone: string;
  grade: string;
  school: string;
  bio: string;
  avatar_url: string;
  xp_points: number;
  status: 'active' | 'suspended';
  level?: number;
  title?: string;
  currentLevelMin?: number;
  nextLevelMin?: number;
  progressPercent?: number;
}

export interface BootstrapData {
  settings: SiteSettings;
  navLinks: NavLink[];
  pages: CustomPage[];
  plans: SubscriptionPlan[];
  paymentMethods: PaymentMethod[];
  courses: CourseSummary[];
  announcements: Announcement[];
  reviews: Review[];
  leaderboard: LeaderboardEntry[];
  user: AuthUser | null;
}
