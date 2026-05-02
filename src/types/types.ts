// 用户角色
export type UserRole = 'user' | 'admin';

// 拜访状态
export type VisitStatus = 'preparing' | 'recording' | 'processing' | 'completed';

// 用户 Profile
export interface Profile {
  id: string;
  username: string;
  email: string | null;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// PPT 幻灯片
export interface PptSlide {
  title: string;
  content: string[];
  notes?: string;
}

// PPT 内容
export interface PptContent {
  title: string;
  subtitle: string;
  slides: PptSlide[];
}

// 文字稿片段
export interface Utterance {
  text: string;
  start_time: number;
  end_time: number;
  speaker_id?: number;
}

// 结构化报告
export interface StructuredReport {
  summary: string;
  customerNeeds: string[];
  painPoints: string[];
  intentLevel: '高' | '中' | '低';
  intentAnalysis: string;
  competitors: string[];
  keyPoints: string[];
  nextActions: string[];
  keywords: string[];
}

// 客户背景调研
export interface CustomerBackground {
  companyProfile: string;
  industryAnalysis: string;
  marketPosition: string;
  potentialNeeds: string[];
  visitStrategy: string[];
  talkingPoints: string[];
  riskPoints: string[];
}

// 拜访记录
export interface Visit {
  id: string;
  user_id: string;
  customer_name: string;
  customer_industry: string | null;
  customer_contact: string | null;
  customer_size: string | null;
  customer_background: string | null;
  visit_time: string | null;
  visit_location: string | null;
  visit_purpose: string | null;
  status: VisitStatus;
  ppt_content: PptContent | null;
  transcript: string | null;
  transcript_utterances: Utterance[] | null;
  structured_report: StructuredReport | null;
  keywords: string[] | null;
  recording_url: string | null;
  recording_name: string | null;
  recording_duration: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // 关联profile（查询时join）
  profiles?: Pick<Profile, 'username' | 'full_name'>;
}

// 访问记录列表项（轻量版）
export interface VisitListItem {
  id: string;
  user_id: string;
  customer_name: string;
  customer_industry: string | null;
  visit_time: string | null;
  status: VisitStatus;
  keywords: string[] | null;
  transcript: string | null;
  structured_report: StructuredReport | null;
  created_at: string;
  profiles?: Pick<Profile, 'username' | 'full_name'>;
}

// 拜访统计数据
export interface VisitStats {
  totalVisits: number;
  completedVisits: number;
  thisMonthVisits: number;
  totalCustomers: number;
}
