
export enum TaskStatus {
  Pending = 'Pending',
  InProgress = 'In Progress',
  Completed = 'Completed',
  Delayed = 'Delayed',
}

export interface TaskRemark {
  id: string;
  text: string;
  isWarning: boolean; // true for warning (red), false for note (blue/gray)
}

export interface TaskAttachment {
  id: string;
  name: string;
  url: string;
}

export interface TaskChecklistItem {
  id: string;
  text: string;
  isCompleted: boolean;
}

export interface TaskComment {
  id: string;
  author: string; // Name of team member
  text: string;
  timestamp: string; // ISO string
  avatar?: string; // Optional avatar fallback
  color?: string; // Optional color fallback
}

export interface ProjectTask {
  id: string;
  subTaskName: string;
  deliverables: string;
  workContent: string; // Description
  owner: string; // Stores the ID or Name of the team member
  duration: number | string;
  startDate: string;
  endDate: string;
  status: TaskStatus;
  score: string; // Priority or Score
  remarks: TaskRemark[];
  dependencies: string[]; // IDs of tasks this task depends on
  attachments: TaskAttachment[];
  checklist: TaskChecklistItem[];
  comments: TaskComment[];
  linkedDocIds?: string[]; // IDs of Wiki Docs linked to this task
  linkedGoalId?: string; // New: Link to a strategic goal
}

export interface ProjectPhase {
  id: string;
  name: string;
  tasks: ProjectTask[];
}

export interface Milestone {
  id: string;
  phaseName: string;
  milestoneName: string;
  completionDate: string;
  durationDiff: number | string;
  remarks: string;
}

// --- New: Finance Types ---
export interface ProjectExpense {
  id: string;
  title: string;
  amount: number;
  category: string; // 'Labor', 'Software', 'Hardware', 'Marketing', 'Other'
  date: string;
  notes?: string;
}

// --- New: Risk Types ---
export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';

export interface ProjectRisk {
  id: string;
  description: string;
  probability: 'Low' | 'Medium' | 'High';
  impact: 'Low' | 'Medium' | 'High';
  level: RiskLevel; // Calculated
  mitigationPlan: string;
  status: 'Open' | 'Mitigated' | 'Closed';
  owner?: string;
}

// --- New: Goal / OKR Types ---
export interface Goal {
  id: string;
  title: string;
  description: string;
  progress: number; // 0-100, can be auto-calculated
  status: 'On Track' | 'At Risk' | 'Off Track' | 'Completed';
  owner: string;
  dueDate: string;
  priority: 'High' | 'Medium' | 'Low';
  linkedTaskIds?: string[]; // Added: IDs of tasks contributing to this goal
}

// --- New: File Hub Types ---
export interface ProjectFile {
  id: string;
  name: string;
  type: 'image' | 'document' | 'link' | 'other';
  url: string;
  size?: string;
  uploadedBy: string;
  uploadedAt: string; // ISO Date
  source?: 'task' | 'wiki' | 'direct'; // Where did this file come from?
  sourceId?: string; // ID of the task/doc
}

// --- New: Notification Types ---
export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  timestamp: number;
  read: boolean;
  link?: { view: string, projectId: string, itemId?: string }; // Navigation target
}

export interface ProjectInfo {
  name: string;
  code: string;
  manager: string;
  description: string;
  // New fields
  budgetTotal?: number;
  currency?: string;
  expenseCategories?: string[];
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  avatar: string; // Initials or URL
  color: string; // Background color class
  email?: string; // New: Contact info
  department?: string; // New: Grouping
  skills?: string[]; // New: Skill tags
  lastModified?: number; // For LWW Sync
}

// --- Meeting Types ---
export type MeetingType = 'General' | 'Standup' | 'Review' | 'Retrospective' | 'Planning';

export interface Meeting {
  id: string;
  title: string;
  date: string; // ISO Date string
  type: MeetingType;
  attendees: string[]; // IDs of TeamMembers
  content: string; // Rich text content (simplified as markdown/text for now)
  relatedTaskIds: string[]; // IDs of tasks created from or linked to this meeting
  status: 'Planned' | 'In Progress' | 'Completed';
}

// --- Wiki / Doc Types ---
// Added 'html'
export type BlockType = 'text' | 'h1' | 'h2' | 'h3' | 'bullet' | 'number' | 'todo' | 'image' | 'divider' | 'code' | 'quote' | 'grid' | 'task_card' | 'doc_link' | 'html';

export interface DocBlock {
  id: string;
  type: BlockType;
  content: string; // HTML or Text content. For Grid, this might be ignored or used for metadata
  properties?: Record<string, any>; // For images (url), check status (checked), grid columns (cells[]), etc.
}

export interface ProjectDoc {
  id: string;
  title: string;
  icon: string; // Emoji or Icon URL
  blocks?: DocBlock[];
  content?: any[]; // BlockNote blocks
  parentId?: string; // For nesting
  externalUrl?: string; // If set, acts as a link to Google Drive/etc
  type?: 'block' | 'external' | 'markdown' | 'excalidraw'; // Doc type
  markdownContent?: string; // For markdown docs
  excalidrawData?: any; // For excalidraw diagrams (stores Excalidraw scene data)
  lastModified: number;
}

export interface Project {
  id: string;
  lastModified: number;
  info: ProjectInfo;
  phases: ProjectPhase[];
  teamMembers: TeamMember[];
  milestones: Milestone[];
  meetings: Meeting[];
  docs: ProjectDoc[]; // Knowledge Base

  // New Modules
  expenses?: ProjectExpense[];
  risks?: ProjectRisk[];
  goals?: Goal[];
  files?: ProjectFile[]; // Direct uploads not attached to tasks
  events?: CalendarEvent[]; // Calendar Events
  issues?: Issue[]; // Issue Tracking
}

export interface CalendarEvent {
  id: string;
  title: string;
  startDate: string; // ISO Date YYYY-MM-DD
  endDate: string;   // ISO Date YYYY-MM-DD
  startTime?: string; // HH:mm
  endTime?: string;   // HH:mm
  isAllDay: boolean;
  participants: string[]; // IDs of TeamMembers
  location?: string;
  hasVideoMeeting: boolean;
  description?: string;
  projectId?: string; // Link to project
  color?: string; // Visual color preference
}

export interface Issue {
  id: string; // 序号
  date: string; // 异常反馈发起时间 (Report Date)
  discoveryDate?: string; // 问题发现时间
  resolutionDate?: string; // 问题解决时间
  projectName: string; // 项目
  deviceCategory: string; // 设备大类
  deviceType: string; // 设备类别
  category: string; // 异常分类
  source: string; // 异常问题来源
  reporter: string; // 反馈人
  tracker: string; // 追踪人
  description: string; // 问题描述
  attachments?: string[]; // 图片/视频/备注 (Base64 or URL)
  linkedDocIds?: string[]; // 关联的知识库文档 ID
  rootCause?: string; // 原因分析
  responsiblePerson?: string; // 责任人
  temporarySolution?: string; // 临时解决措施
  rootSolution?: string; // 根本解决措施
  status: 'Open' | 'In Progress' | 'Closed' | 'Planning'; // 问题处理状态
}
