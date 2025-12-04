
import { ProjectPhase, TaskStatus, Milestone, ProjectInfo, TeamMember, Project, Meeting, ProjectDoc } from './types';

export const DEFAULT_PROJECT_INFO: ProjectInfo = {
  name: 'Generic Project Plan',
  code: 'PROJ-2025-001',
  manager: 'Project Manager',
  description: 'General Purpose Project Schedule',
};

export const INITIAL_TEAM: TeamMember[] = [
  {
    id: 'tm1',
    name: 'Analyst A',
    role: 'Business Analyst',
    avatar: 'AN',
    color: 'bg-blue-100 text-blue-700',
    email: 'analyst.a@company.com',
    department: 'Product',
    skills: ['Requirements', 'SQL', 'Market Research'],
    lastModified: Date.now()
  },
  {
    id: 'tm2',
    name: 'Product Owner',
    role: 'Product',
    avatar: 'PO',
    color: 'bg-purple-100 text-purple-700',
    email: 'po@company.com',
    department: 'Product',
    skills: ['Roadmap', 'Stakeholder Mgmt', 'Agile'],
    lastModified: Date.now()
  },
  {
    id: 'tm3',
    name: 'Designer B',
    role: 'UI/UX',
    avatar: 'DE',
    color: 'bg-pink-100 text-pink-700',
    email: 'designer.b@company.com',
    department: 'Design',
    skills: ['Figma', 'Prototyping', 'User Testing'],
    lastModified: Date.now()
  },
  {
    id: 'tm4',
    name: 'Dev Lead',
    role: 'Engineering',
    avatar: 'DL',
    color: 'bg-emerald-100 text-emerald-700',
    email: 'tech.lead@company.com',
    department: 'Engineering',
    skills: ['React', 'Node.js', 'System Design'],
    lastModified: Date.now()
  },
  {
    id: 'tm5',
    name: 'Unassigned',
    role: 'Pending',
    avatar: '?',
    color: 'bg-gray-100 text-gray-600',
    department: 'General',
    lastModified: Date.now()
  },
];

export const INITIAL_PHASES: ProjectPhase[] = [
  {
    id: 'p1',
    name: 'Phase 1: Planning',
    tasks: [
      {
        id: 't1-1',
        subTaskName: 'Market Analysis',
        deliverables: 'Market Report',
        workContent: 'Analyze target demographics and competitors.',
        owner: 'Analyst A',
        duration: 5,
        startDate: '2025/10/01',
        endDate: '2025/10/06',
        status: TaskStatus.Completed,
        score: 'High',
        remarks: [],
        dependencies: [],
        attachments: [],
        checklist: [],
        comments: [],
        linkedDocIds: ['doc-1']
      },
      {
        id: 't1-2',
        subTaskName: 'Requirement Gathering',
        deliverables: 'PRD v1.0',
        workContent: 'Interview stakeholders and document core requirements.',
        owner: 'Product Owner',
        duration: 3,
        startDate: '2025/10/07',
        endDate: '2025/10/10',
        status: TaskStatus.InProgress,
        score: 'Med',
        remarks: [],
        dependencies: ['t1-1'],
        attachments: [],
        checklist: [],
        comments: []
      },
    ],
  },
  {
    id: 'p2',
    name: 'Phase 2: Execution',
    tasks: [
      {
        id: 't2-1',
        subTaskName: 'Design & Prototyping',
        deliverables: 'Figma Mockups',
        workContent: 'Create high-fidelity designs for approval.',
        owner: 'Designer B',
        duration: 10,
        startDate: '2025/10/11',
        endDate: '2025/10/21',
        status: TaskStatus.Pending,
        score: 'High',
        remarks: [
          { id: 'r1', text: 'Waiting for requirements sign-off', isWarning: true },
          { id: 'r2', text: 'Need access to icon library', isWarning: false }
        ],
        dependencies: ['t1-2'],
        attachments: [
          { id: 'a1', name: 'Figma Link', url: 'https://figma.com' }
        ],
        checklist: [
          { id: 'cl1', text: 'Wireframes', isCompleted: true },
          { id: 'cl2', text: 'Visual Design', isCompleted: false },
          { id: 'cl3', text: 'Prototype Interaction', isCompleted: false }
        ],
        comments: []
      },
    ],
  },
];

export const INITIAL_MILESTONES: Milestone[] = [
  { id: 'm1', phaseName: 'Planning', milestoneName: 'Kickoff Meeting', completionDate: '2025/10/01', durationDiff: 0, remarks: 'Completed' },
  { id: 'm2', phaseName: 'Execution', milestoneName: 'Design Sign-off', completionDate: '2025/10/21', durationDiff: 2, remarks: 'Delayed start' }
];

export const INITIAL_MEETINGS: Meeting[] = [
  {
    id: 'mtg-1',
    title: 'Project Kickoff',
    date: '2025-10-01T09:00:00.000Z',
    type: 'General',
    attendees: ['tm1', 'tm2', 'tm4'],
    status: 'Completed',
    relatedTaskIds: ['t1-1'],
    content: "## Agenda\n1. Introduction\n2. Scope Definition\n3. Timeline Review\n\n## Minutes\n- Defined the core objectives.\n- Analyst A agreed to start market analysis immediately.\n- Agreed on bi-weekly syncs."
  }
];

export const INITIAL_DOCS: ProjectDoc[] = [
  {
    id: 'doc-1',
    title: 'Product Requirements (PRD)',
    icon: '📄',
    lastModified: Date.now(),
    blocks: [
      { id: 'b1', type: 'h1', content: 'Product Requirements Document' },
      { id: 'b2', type: 'text', content: 'This document outlines the core specifications for the new project.' },
      { id: 'b3', type: 'h2', content: '1. Objectives' },
      { id: 'b4', type: 'bullet', content: 'Increase user engagement by 20%' },
      { id: 'b5', type: 'bullet', content: 'Reduce load time to under 2s' },
      { id: 'b6', type: 'h2', content: '2. Scope' },
      { id: 'b7', type: 'text', content: 'The scope includes the mobile app and the web dashboard.' },
    ]
  },
  {
    id: 'doc-2',
    title: 'Design System Assets',
    icon: '🎨',
    lastModified: Date.now(),
    externalUrl: 'https://www.figma.com',
    blocks: []
  }
];

export const createDefaultProject = (withSampleData: boolean = false, customTeam?: TeamMember[], name?: string): Project => {
  const baseInfo: ProjectInfo = {
    name: name || (withSampleData ? 'Generic Project Plan' : 'New Project'),
    code: withSampleData ? 'PROJ-2025-001' : `PROJ-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`,
    manager: 'Project Manager',
    description: withSampleData ? 'General Purpose Project Schedule' : 'Description of the new project...',
  };

  return {
    id: `proj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    lastModified: Date.now(),
    info: baseInfo,
    phases: withSampleData ? JSON.parse(JSON.stringify(INITIAL_PHASES)) : [],
    teamMembers: customTeam ? [...customTeam] : [...INITIAL_TEAM],
    milestones: withSampleData ? [...INITIAL_MILESTONES] : [],
    meetings: withSampleData ? [...INITIAL_MEETINGS] : [],
    docs: withSampleData ? [...INITIAL_DOCS] : [],
    issues: []
  };
};