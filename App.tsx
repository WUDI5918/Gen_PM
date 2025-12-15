
import React, { useState, useEffect } from 'react';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { ToastProvider, useToast } from './contexts/ToastContext';
import { DialogProvider, useDialog } from './contexts/DialogContext';
import { Project, TeamMember, ProjectPhase, ProjectTask, TaskStatus, Meeting, AppNotification, CalendarEvent } from './types';
import { createDefaultProject, INITIAL_TEAM } from './constants';
import { ProjectWorkspace } from './components/ProjectWorkspace';
import { ProjectLibrary } from './components/ProjectLibrary';
import { CalendarView } from './components/CalendarView';
import { WikiSystem } from './components/WikiSystem';
import { MeetingEditor } from './components/MeetingEditor';
import { TaskDetailModal } from './components/TaskDetailModal';
import { SettingsModal } from './components/SettingsModal';
import { TeamView } from './components/TeamView';
import { CommandPalette } from './components/CommandPalette';
import { NotificationCenter } from './components/NotificationCenter';
import { db } from './services/db';
import { ERPManager } from './components/ERPManager';
import { parseDate } from './utils';

import {
    LayoutGrid,
    Book,
    Users,
    CalendarDays,
    MessageSquareQuote,
    Briefcase,
    Plus,
    Clock,
    CheckCircle2,
    Search,
    Settings,
    Menu,
    ArrowRight,
    ChevronRight,
    ChevronLeft,
    PanelLeftClose,
    PanelLeftOpen,
    Trash2,
    Loader2,
    LogOut,
    Database
} from 'lucide-react';
import { EventData } from './components/EventModal';
import { IssueTracker } from './components/IssueTracker';
import { Issue } from './types';
import { AlertCircle } from 'lucide-react';

type AppView = 'projects' | 'wiki' | 'meetings' | 'calendar' | 'team' | 'issues' | 'erp';

const AppContent: React.FC = () => {
    const { t } = useLanguage();

    // State
    const [isLoading, setIsLoading] = useState(true);
    const [projects, setProjects] = useState<Project[]>([]);
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>(INITIAL_TEAM);
    const [userProfile, setUserProfile] = useState<{ name: string, role: string, avatar: string }>({ name: 'Project Manager', role: 'Admin', avatar: 'PM' });
    const [tags, setTags] = useState<Record<string, string[]>>({});

    // Notification State
    const [notifications, setNotifications] = useState<AppNotification[]>([]);

    // Navigation State
    const [currentView, setCurrentView] = useState<AppView>(() => (localStorage.getItem('gen_pm_view') as AppView) || 'projects');
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => localStorage.getItem('gen_pm_sidebar') === 'true');

    // Project Workspace State
    const [activeProjectId, setActiveProjectId] = useState<string | null>(() => localStorage.getItem('gen_pm_active_project'));

    // Global Selection State (for Wiki/Meetings)
    const [globalSelectedProjectId, setGlobalSelectedProjectId] = useState<string | null>(() => localStorage.getItem('gen_pm_global_project'));

    // Wiki State
    const [globalWikiDocId, setGlobalWikiDocId] = useState<string | null>(null);

    // Meeting State
    const [activeMeeting, setActiveMeeting] = useState<Meeting | null>(null);
    const [isMeetingEditorOpen, setIsMeetingEditorOpen] = useState(false);

    // Settings State
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Command Palette State
    const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

    // Sync State
    const [isSyncing, setIsSyncing] = useState(false);

    // Global Active Task (for opening modal from Wiki/Meetings views)
    const [globalActiveTask, setGlobalActiveTask] = useState<{ task: ProjectTask, project: Project, phaseName?: string } | null>(null);

    const { addToast } = useToast();
    const { ask } = useDialog();

    // --- Persistence Effects ---
    useEffect(() => {
        localStorage.setItem('gen_pm_view', currentView);
    }, [currentView]);

    useEffect(() => {
        localStorage.setItem('gen_pm_sidebar', String(isSidebarCollapsed));
    }, [isSidebarCollapsed]);

    useEffect(() => {
        if (activeProjectId) localStorage.setItem('gen_pm_active_project', activeProjectId);
        else localStorage.removeItem('gen_pm_active_project');
    }, [activeProjectId]);

    useEffect(() => {
        if (globalSelectedProjectId) localStorage.setItem('gen_pm_global_project', globalSelectedProjectId);
        else localStorage.removeItem('gen_pm_global_project');
    }, [globalSelectedProjectId]);

    // --- Initialization & Refresh Logic ---
    const refreshData = async (showLoading = false) => {
        if (showLoading) setIsLoading(true);
        try {
            if (showLoading) await db.init();

            let [loadedProjects, loadedTeam, loadedUser, loadedTags] = await Promise.all([
                db.getAllProjects(),
                db.getTeam(),
                db.getUser(),
                db.getTags()
            ]);

            // Fallback: Check LocalStorage Backup if DB is empty
            if (loadedProjects.length === 0) {
                const backup = localStorage.getItem('gen_pm_projects_backup');
                if (backup) {
                    try {
                        loadedProjects = JSON.parse(backup);
                        // Restore to DB
                        for (const p of loadedProjects) await db.saveProject(p);
                    } catch (e) { console.error("Backup restore failed", e); }
                }
            }

            // --- Enable Auto-Sync ---
            // DISABLED: User requested manual sync only.
            // const { syncService } = await import('./services/sync');
            // syncService.enableAutoPush();
            // ...

            if (loadedProjects.length > 0) {
                // --- Migration: Convert old Wiki blocks to BlockNote content ---
                const migratedProjects = loadedProjects.map(p => ({
                    ...p,
                    docs: (p.docs || []).map(d => {
                        // If content exists, use it. If not, and blocks exist, migrate.
                        if (d.content && d.content.length > 0) return d;
                        if ((d as any).blocks && (d as any).blocks.length > 0) {
                            const newContent = (d as any).blocks.map((b: any) => {
                                // Simple mapping
                                if (b.type === 'h1') return { type: 'heading', props: { level: 1 }, content: [{ type: 'text', text: b.content || '', styles: {} }] };
                                if (b.type === 'h2') return { type: 'heading', props: { level: 2 }, content: [{ type: 'text', text: b.content || '', styles: {} }] };
                                if (b.type === 'h3') return { type: 'heading', props: { level: 3 }, content: [{ type: 'text', text: b.content || '', styles: {} }] };
                                if (b.type === 'bullet') return { type: 'bulletListItem', content: [{ type: 'text', text: b.content || '', styles: {} }] };
                                if (b.type === 'todo') return { type: 'checkListItem', props: { checked: b.properties?.checked || false }, content: [{ type: 'text', text: b.content || '', styles: {} }] };
                                // Default to paragraph
                                return { type: 'paragraph', content: [{ type: 'text', text: b.content || '', styles: {} }] };
                            });
                            return { ...d, content: newContent };
                        }
                        return d;
                    })
                }));
                setProjects(migratedProjects);
            } else if (showLoading) {
                // Initialize with Default Project if completely empty (only on initial load)
                const defaultProject = createDefaultProject(true, (loadedTeam && loadedTeam.length > 0) ? loadedTeam : INITIAL_TEAM);
                await db.saveProject(defaultProject);
                setProjects([defaultProject]);
            }

            if (loadedTeam) setTeamMembers(loadedTeam);
            if (loadedUser) setUserProfile(loadedUser);
            if (loadedTags) setTags(loadedTags);

            if (!showLoading) addToast(t('app.refreshed'), 'success');

        } catch (error) {
            console.error("Failed to load data", error);
            addToast(t('app.load_error'), 'error');
        } finally {
            if (showLoading) setIsLoading(false);
        }
    };

    useEffect(() => {
        refreshData(true);
    }, []);

    // Global Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // F5 Soft Refresh
            if (e.key === 'F5') {
                e.preventDefault();
                refreshData(false);
                return;
            }

            // Command Palette (Cmd+K)
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsCommandPaletteOpen(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const activeProject = projects.find(p => p.id === activeProjectId);
    const globalTargetProject = projects.find(p => p.id === globalSelectedProjectId) || projects[0];

    // --- Handlers (Updated for DB) ---

    // Issue Handlers
    const handleCreateIssue = (issue: Issue) => {
        const targetProject = projects.find(p => p.info.name === issue.projectName) || projects[0];
        if (!targetProject) return;

        const newIssue = { ...issue, id: issue.id || `ISSUE-${Date.now()}` };
        const updatedProject = {
            ...targetProject,
            issues: [...(targetProject.issues || []), newIssue],
            lastModified: Date.now()
        };
        handleUpdateProject(updatedProject);

        // Add System Notification
        const notification: AppNotification = {
            id: `notif-${Date.now()}`,
            title: t('app.issue_reported'),
            message: `${issue.description.substring(0, 30)}...`,
            type: 'success',
            timestamp: Date.now(),
            read: false,
            link: { view: 'issues', projectId: targetProject.id, itemId: newIssue.id }
        };
        setNotifications(prev => [notification, ...prev]);
        addToast(t('app.issue_reported'), 'success');
    };

    const handleUpdateIssue = (issue: Issue) => {
        const oldProject = projects.find(p => p.issues?.some(i => i.id === issue.id));
        const newProject = projects.find(p => p.info.name === issue.projectName);

        if (oldProject && newProject && oldProject.id !== newProject.id) {
            const updatedOld = {
                ...oldProject,
                issues: oldProject.issues?.filter(i => i.id !== issue.id),
                lastModified: Date.now()
            };
            const updatedNew = {
                ...newProject,
                issues: [...(newProject.issues || []), issue],
                lastModified: Date.now()
            };
            setProjects(prev => prev.map(p => {
                if (p.id === oldProject.id) return updatedOld;
                if (p.id === newProject.id) return updatedNew;
                return p;
            }));
            db.saveProject(updatedOld);
            db.saveProject(updatedNew);
        } else if (newProject) {
            const updatedProject = {
                ...newProject,
                issues: (newProject.issues || []).map(i => i.id === issue.id ? issue : i),
                lastModified: Date.now()
            };
            handleUpdateProject(updatedProject);
        }

        // Add System Notification
        const notification: AppNotification = {
            id: `notif-${Date.now()}`,
            title: t('app.issue_updated'),
            message: `${issue.description.substring(0, 30)}...`,
            type: 'info',
            timestamp: Date.now(),
            read: false,
            link: { view: 'issues', projectId: newProject?.id || '', itemId: issue.id }
        };
        setNotifications(prev => [notification, ...prev]);
        addToast(t('app.issue_updated'), 'success');
    };

    const handleDeleteIssue = (issueId: string) => {
        const project = projects.find(p => p.issues?.some(i => i.id === issueId));
        if (project) {
            const updatedProject = {
                ...project,
                issues: project.issues?.filter(i => i.id !== issueId),
                lastModified: Date.now()
            };
            handleUpdateProject(updatedProject);
            addToast(t('app.issue_deleted'), 'info');
        }
    };

    const handleImportIssues = (newIssues: Issue[]) => {
        const issuesByProject: Record<string, Issue[]> = {};
        newIssues.forEach(issue => {
            const pName = issue.projectName;
            if (!issuesByProject[pName]) issuesByProject[pName] = [];
            issuesByProject[pName].push(issue);
        });

        setProjects(prev => {
            const updatedProjects = prev.map(p => {
                const pName = p.info.name;
                if (issuesByProject[pName]) {
                    const issuesToAdd = issuesByProject[pName].map((i, idx) => ({
                        ...i,
                        id: i.id || `ISSUE-${Date.now()}-${idx}`
                    }));
                    return {
                        ...p,
                        issues: [...(p.issues || []), ...issuesToAdd],
                        lastModified: Date.now()
                    };
                }
                return p;
            });

            updatedProjects.forEach(p => {
                if (issuesByProject[p.info.name]) {
                    db.saveProject(p);
                }
            });

            return updatedProjects;
        });
        addToast(`${t('app.issues_imported')}: ${newIssues.length}`, 'success');
    };

    const handleCreateProject = async (name?: string) => {
        // Ensure name is a string, not an event object
        const projectName = (typeof name === 'string' && name.trim()) ? name : undefined;
        let newProject = createDefaultProject(false, teamMembers, projectName);

        // Auto-generate unique name if duplicate exists
        let baseName = newProject.info.name;
        let counter = 1;

        while (projects.some(p =>
            String(p.info.name || '').toLowerCase() === String(newProject.info.name || '').toLowerCase()
        )) {
            counter++;
            newProject.info.name = `${baseName} ${counter}`;
        }

        setProjects(prev => [...prev, newProject]);
        setActiveProjectId(newProject.id);
        await db.saveProject(newProject);
        addToast(t('app.project_created'), 'success');
    };

    const handleDeleteProject = (id: string) => {
        const newProjects = projects.filter(p => p.id !== id);
        setProjects(newProjects);
        if (activeProjectId === id) setActiveProjectId(null);
        if (globalSelectedProjectId === id) setGlobalSelectedProjectId(newProjects[0]?.id || null);
        db.deleteProject(id);
        addToast(t('app.project_deleted'), 'info');
    };

    const handleUpdateProject = async (updatedProject: Project) => {
        // Check if another project with the same name already exists (excluding the current project)
        const duplicateProject = projects.find(p =>
            p.id !== updatedProject.id &&
            String(p.info.name || '').toLowerCase() === String(updatedProject.info.name || '').toLowerCase()
        );

        if (duplicateProject) {
            addToast(
                `${t('common.error')}: ${t('app.project_name_exists')}`,
                'error'
            );
            return;
        }

        setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
        await db.saveProject(updatedProject);
    };

    const handleUpdateTeam = async (newMembers: TeamMember[]) => {
        setTeamMembers(newMembers);
        await db.saveTeam(newMembers);
    };

    // Wrapper to update the *global target project* when in Global Views
    const handleGlobalProjectUpdate = (updatedProject: Project) => {
        handleUpdateProject(updatedProject);
    };

    const handleUpdateUserProfile = async (name: string, role: string) => {
        const newProfile = { ...userProfile, name, role, avatar: name.charAt(0).toUpperCase() };
        setUserProfile(newProfile);
        await db.saveUser(newProfile);
    };

    // Navigation Handler for Wiki from inside Project Workspace
    const handleNavigateToWiki = (docId: string) => {
        const targetProjectId = activeProjectId || globalSelectedProjectId;
        if (targetProjectId) {
            setGlobalSelectedProjectId(targetProjectId);
            setGlobalWikiDocId(docId);
            setCurrentView('wiki');
            setActiveProjectId(null);
            setGlobalActiveTask(null);
        }
    };

    const handleNavigateToDoc = (projectId: string, docId: string) => {
        setGlobalSelectedProjectId(projectId);
        setGlobalWikiDocId(docId);
        setCurrentView('wiki');
        setActiveProjectId(null);
    };

    // Notification Navigation
    const handleNotificationNavigate = (link: AppNotification['link']) => {
        if (!link) return;
        if (link.view === 'projects') {
            setCurrentView('projects');
            setActiveProjectId(link.projectId);

            if (link.itemId) {
                // Deep link to task modal
                const targetProject = projects.find(p => p.id === link.projectId);
                if (targetProject) {
                    const phase = targetProject.phases.find(p => p.tasks.some(t => t.id === link.itemId));
                    const task = phase?.tasks.find(t => t.id === link.itemId);
                    if (task && phase) {
                        setGlobalActiveTask({ task, project: targetProject, phaseName: phase.name });
                    }
                }
            }
        }
    };

    const handleMarkRead = (id?: string) => {
        if (id) {
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
        } else {
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        }
    };

    // Command Palette Handlers
    const handleCommandNavigation = (view: string, projectId?: string) => {
        if (projectId) {
            setActiveProjectId(projectId);
            setCurrentView('projects');
        } else {
            setCurrentView(view as AppView);
            if (view !== 'projects') setActiveProjectId(null);
        }
    };

    const handleCommandAction = (action: string) => {
        if (action === 'create_project') handleCreateProject();
        if (action === 'settings') setIsSettingsOpen(true);
    };


    // Wrapper to create a task from the global modal / meeting editor
    const handleGlobalCreateTask = (taskName: string): ProjectTask | null => {
        if (!globalTargetProject) return null;

        const newTask: ProjectTask = {
            id: `t-${Date.now()}`,
            subTaskName: taskName,
            deliverables: 'Action Item',
            workContent: 'Created from meeting minutes.',
            owner: 'Unassigned',
            duration: 1,
            startDate: '-',
            endDate: '-',
            status: TaskStatus.Pending,
            score: 'Med',
            remarks: [],
            dependencies: [],
            attachments: [],
            checklist: [],
            comments: []
        };

        const newPhases = [...globalTargetProject.phases];
        if (newPhases.length > 0) {
            // Add to the first phase by default
            newPhases[0] = {
                ...newPhases[0],
                tasks: [newTask, ...newPhases[0].tasks]
            };
        } else {
            newPhases.push({
                id: `p-${Date.now()}`,
                name: 'General',
                tasks: [newTask]
            });
        }

        const updatedProject = {
            ...globalTargetProject,
            phases: newPhases,
            lastModified: Date.now()
        };

        handleGlobalProjectUpdate(updatedProject);
        return newTask;
    };

    // Wrapper to update a task from the global modal
    const handleGlobalTaskUpdate = (updatedTask: ProjectTask) => {
        if (!globalActiveTask) return;
        const { project } = globalActiveTask;

        const updatedProject = {
            ...project,
            phases: project.phases.map(p => ({
                ...p,
                tasks: p.tasks.map(t => t.id === updatedTask.id ? updatedTask : t)
            })),
            lastModified: Date.now()
        };

        handleUpdateProject(updatedProject);
        setGlobalActiveTask(prev => prev ? { ...prev, task: updatedTask, project: updatedProject } : null);
    };

    const handleGlobalMoveTask = (taskId: string, newPhaseId: string) => {
        if (!globalActiveTask) return;
        const { project } = globalActiveTask;
        const newPhases = [...project.phases];
        let taskToMove: ProjectTask | undefined;

        // Find and remove
        for (const phase of newPhases) {
            const idx = phase.tasks.findIndex(t => t.id === taskId);
            if (idx > -1) {
                taskToMove = phase.tasks[idx];
                phase.tasks.splice(idx, 1);
                break;
            }
        }

        if (taskToMove) {
            const targetPhase = newPhases.find(p => p.id === newPhaseId);
            if (targetPhase) {
                targetPhase.tasks.push(taskToMove);
                const updatedProject = { ...project, phases: newPhases, lastModified: Date.now() };
                handleUpdateProject(updatedProject);
                setGlobalActiveTask({ task: taskToMove, project: updatedProject, phaseName: targetPhase.name });
                addToast(`${t('kanban.move_to')} ${targetPhase.name}`, 'success');
            }
        }
    };

    const handleCreateMeeting = () => {
        setActiveMeeting(null);
        setIsMeetingEditorOpen(true);
    };

    const handleSelectMeeting = (meeting: Meeting) => {
        setActiveMeeting(meeting);
        setIsMeetingEditorOpen(true);
    };

    const handleDeleteMeeting = (meetingId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!globalTargetProject) return;
        ask({
            title: t('common.delete') + ' Meeting?',
            message: t('app.delete_meeting_confirm'),
            type: 'danger',
            confirmText: t('common.delete'),
            onConfirm: () => {
                const newMeetings = (globalTargetProject.meetings || []).filter(m => m.id !== meetingId);
                handleGlobalProjectUpdate({ ...globalTargetProject, meetings: newMeetings });
                addToast(t('app.meeting_deleted'), 'info');
            }
        });
    };

    const SidebarItem = ({ id, icon: Icon, label }: { id: AppView, icon: any, label: string }) => (
        <button
            onClick={() => {
                setCurrentView(id);
                if (id !== 'projects') setActiveProjectId(null);
                if (id !== 'meetings') setIsMeetingEditorOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative ${currentView === id
                ? 'bg-indigo-50 text-indigo-600 font-medium shadow-sm'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                } ${isSidebarCollapsed ? 'justify-center' : ''}`}
        >
            <Icon size={20} className={`shrink-0 transition-colors ${currentView === id ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-600'}`} />

            <div className={`flex-1 text-left whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
                <span className="text-sm font-medium">{label}</span>
            </div>

            {isSidebarCollapsed && (
                <div className="absolute left-14 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                    {label}
                </div>
            )}
        </button>
    );

    if (isLoading) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-white">
                <Loader2 size={48} className="text-indigo-600 animate-spin mb-4" />
                <h2 className="text-lg font-bold text-gray-700">{t('app.loading_title')}</h2>
                <p className="text-sm text-gray-400 mt-1">{t('app.loading_desc')}</p>
            </div>
        );
    }

    const handleCreateEvent = (eventData: EventData) => {
        const targetProjectName = eventData.belongTo;
        let targetProject = projects.find(p => p.info.name === targetProjectName) || projects[0];
        if (!targetProject) return;

        if (eventData.id) {
            // UPDATE existing event
            const sourceProject = projects.find(p => (p.events || []).some(e => e.id === eventData.id));

            if (sourceProject && sourceProject.id !== targetProject.id) {
                // MOVE: Delete from source, Add to target

                // 1. Remove from source
                const updatedSource = {
                    ...sourceProject,
                    events: sourceProject.events.filter(e => e.id !== eventData.id),
                    lastModified: Date.now()
                };
                handleUpdateProject(updatedSource);

                // 2. Add to target
                const newEvent: CalendarEvent = {
                    id: eventData.id,
                    title: eventData.title,
                    startDate: eventData.startDate,
                    endDate: eventData.endDate,
                    startTime: eventData.startTime,
                    endTime: eventData.endTime,
                    isAllDay: eventData.isAllDay,
                    participants: eventData.participants,
                    location: eventData.location,
                    hasVideoMeeting: eventData.hasVideoMeeting,
                    projectId: targetProject.id,
                    color: 'bg-blue-100 text-blue-700'
                };
                const updatedTarget = {
                    ...targetProject,
                    events: [...(targetProject.events || []), newEvent],
                    lastModified: Date.now()
                };
                // Small delay to ensure state updates don't conflict if batching is an issue (though functional update handles it)
                setTimeout(() => handleUpdateProject(updatedTarget), 50);
            } else {
                // UPDATE in place
                const projectToUpdate = sourceProject || targetProject;
                const events = [...(projectToUpdate.events || [])];
                const index = events.findIndex(e => e.id === eventData.id);

                const updatedEvent: CalendarEvent = {
                    id: eventData.id,
                    title: eventData.title,
                    startDate: eventData.startDate,
                    endDate: eventData.endDate,
                    startTime: eventData.startTime,
                    endTime: eventData.endTime,
                    isAllDay: eventData.isAllDay,
                    participants: eventData.participants,
                    location: eventData.location,
                    hasVideoMeeting: eventData.hasVideoMeeting,
                    projectId: projectToUpdate.id,
                    color: index !== -1 ? events[index].color : 'bg-blue-100 text-blue-700'
                };

                if (index !== -1) {
                    events[index] = updatedEvent;
                } else {
                    events.push(updatedEvent);
                }

                handleUpdateProject({
                    ...projectToUpdate,
                    events,
                    lastModified: Date.now()
                });
            }
            addToast(t('app.event_updated'), 'success');
        } else {
            // CREATE new event
            const newEvent: CalendarEvent = {
                id: `ev-${Date.now()}`,
                title: eventData.title,
                startDate: eventData.startDate,
                endDate: eventData.endDate,
                startTime: eventData.startTime,
                endTime: eventData.endTime,
                isAllDay: eventData.isAllDay,
                participants: eventData.participants,
                location: eventData.location,
                hasVideoMeeting: eventData.hasVideoMeeting,
                projectId: targetProject.id,
                color: 'bg-blue-100 text-blue-700'
            };

            const updatedProject = {
                ...targetProject,
                events: [...(targetProject.events || []), newEvent],
                lastModified: Date.now()
            };

            handleUpdateProject(updatedProject);
            addToast(t('app.event_created'), 'success');
        }
    };

    const handleUpdateTask = (updatedTask: ProjectTask) => {
        // Find the project containing this task
        const project = projects.find(p => p.phases.some(ph => ph.tasks.some(t => t.id === updatedTask.id)));
        if (!project) return;

        const updatedProject = {
            ...project,
            phases: project.phases.map(p => ({
                ...p,
                tasks: p.tasks.map(t => t.id === updatedTask.id ? updatedTask : t)
            })),
            lastModified: Date.now()
        };

        handleUpdateProject(updatedProject);
    };

    const handleDeleteEvent = (eventData: EventData) => {
        if (!eventData.id) return;

        // Find project containing the event
        const project = projects.find(p => (p.events || []).some(e => e.id === eventData.id));
        if (!project) return;

        const updatedProject = {
            ...project,
            events: (project.events || []).filter(e => e.id !== eventData.id),
            lastModified: Date.now()
        };

        handleUpdateProject(updatedProject);
        addToast(t('app.event_deleted'), 'info');
    };

    const handleQuickSync = async () => {
        setIsSyncing(true);
        try {
            const { syncService } = await import('./services/sync');
            // Perform LWW Sync
            await syncService.sync();

            // Refresh UI
            await refreshData(false);
            addToast(t('app.sync_success'), 'success');
        } catch (e) {
            console.error("Quick Sync failed", e);
            addToast(t('app.sync_fail'), 'error');
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <div className="flex h-screen bg-gray-50/30 font-sans text-gray-900 overflow-hidden selection:bg-indigo-100 selection:text-indigo-900">

            {/* Global Sidebar (Rail) - Light Theme */}
            <aside
                className={`${isSidebarCollapsed ? 'w-20' : 'w-64'} bg-white border-r border-gray-200 flex flex-col shrink-0 z-40 transition-all duration-300 ease-in-out relative shadow-sm`}
            >
                <div className={`p-4 flex items-center ${isSidebarCollapsed ? 'justify-center flex-col gap-4' : 'justify-between'} transition-all duration-300`}>
                    <div className={`flex items-center gap-3 overflow-hidden flex-1 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
                        <div className="bg-indigo-600 p-2 rounded-xl shadow-md text-white shrink-0">
                            <LayoutGrid size={20} />
                        </div>
                        <div className={`min-w-0 transition-all duration-300 ${isSidebarCollapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100'}`}>
                            <h1 className="text-sm font-extrabold text-gray-800 tracking-tight leading-none truncate">
                                Gen-PM
                            </h1>
                            <p className="text-[10px] text-gray-400 font-bold mt-0.5">{t('app.workspace')}</p>
                        </div>
                    </div>

                    <div className={`flex items-center ${isSidebarCollapsed ? 'flex-col gap-3' : 'gap-1'}`}>
                        {/* Quick Sync Button */}
                        <button
                            onClick={handleQuickSync}
                            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all relative group"
                            title={t('app.quick_sync')}
                            disabled={isSyncing}
                        >
                            <div className={isSyncing ? "animate-spin" : ""}>
                                <div className="relative">
                                    <div className="absolute inset-0 bg-indigo-400 blur-[2px] opacity-0 group-hover:opacity-20 rounded-full transition-opacity"></div>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-refresh-cw"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M3 21v-5h5" /></svg>
                                </div>
                            </div>
                        </button>

                        <NotificationCenter
                            notifications={notifications}
                            onMarkRead={handleMarkRead}
                            onNavigate={handleNotificationNavigate}
                            isCollapsed={isSidebarCollapsed}
                        />
                    </div>
                </div>

                <div className="h-px bg-gray-100 mx-4 mb-4"></div>

                <div className={`px-4 mb-2 transition-all duration-300 ${isSidebarCollapsed ? 'opacity-0 pointer-events-none h-0 mb-0' : 'opacity-100 h-auto'}`}>
                    <button
                        onClick={() => setIsCommandPaletteOpen(true)}
                        className="w-full flex items-center justify-between bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-gray-600 text-xs px-3 py-2 rounded-lg transition-colors border border-gray-200"
                    >
                        <div className="flex items-center gap-2">
                            <Search size={14} />
                            <span>{t('app.search_placeholder')}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="bg-white border border-gray-200 rounded px-1 py-0.5 text-[10px] font-bold shadow-sm">⌘K</span>
                        </div>
                    </button>
                </div>

                <nav className="flex-1 px-3 space-y-1 overflow-y-auto custom-scrollbar overflow-x-hidden pt-2">
                    <SidebarItem id="projects" icon={LayoutGrid} label={t('app.view.projects')} />
                    <SidebarItem id="wiki" icon={Book} label={t('app.view.wiki')} />
                    <SidebarItem id="meetings" icon={MessageSquareQuote} label={t('app.view.meetings')} />
                    <SidebarItem id="calendar" icon={CalendarDays} label={t('app.view.calendar')} />
                    <SidebarItem id="team" icon={Users} label={t('app.team')} />
                    <SidebarItem id="issues" icon={AlertCircle} label={t('app.view.issues')} />
                    <SidebarItem id="erp" icon={Database} label="ERP Data" />
                </nav>

                <div className="p-3 mt-auto border-t border-gray-100 bg-white flex flex-col gap-2">

                    {/* User Profile */}
                    <div
                        onClick={() => setIsSettingsOpen(true)}
                        className={`rounded-xl p-2 hover:bg-gray-50 transition-all group cursor-pointer flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'}`}
                    >
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white font-bold text-xs shadow-md shrink-0 ring-2 ring-white">
                            {userProfile.avatar}
                        </div>

                        <div className={`flex-1 min-w-0 transition-all duration-300 overflow-hidden ${isSidebarCollapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100'}`}>
                            <p className="text-xs font-bold text-gray-700 group-hover:text-indigo-600 transition-colors truncate">{userProfile.name}</p>
                            <p className="text-[9px] text-gray-400 truncate">{userProfile.role}</p>
                        </div>

                        {!isSidebarCollapsed && (
                            <Settings size={16} className="text-gray-400 group-hover:text-gray-600 transition-colors shrink-0" />
                        )}
                    </div>

                    {/* Sidebar Toggle */}
                    <button
                        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                        className={`w-full flex items-center justify-center p-2 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all mt-1`}
                        title={isSidebarCollapsed ? "Expand" : "Collapse"}
                    >
                        {isSidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
                    </button>
                </div>
            </aside>

            {/* Content Area */}
            <main className="flex-1 flex flex-col min-w-0 bg-white overflow-hidden relative shadow-2xl shadow-gray-200 z-0">

                {/* PROJECTS VIEW (Default) */}
                {currentView === 'projects' && (
                    activeProjectId && activeProject ? (
                        <ProjectWorkspace
                            project={activeProject}
                            projects={projects}
                            globalTeamMembers={teamMembers}
                            onUpdate={handleUpdateProject}
                            onBack={() => setActiveProjectId(null)}
                            onOpenWiki={handleNavigateToWiki}
                        />
                    ) : (
                        <ProjectLibrary
                            projects={projects}
                            teamMembers={teamMembers}
                            onUpdateTeam={handleUpdateTeam}
                            onCreateProject={handleCreateProject}
                            onSelectProject={(p) => setActiveProjectId(p.id)}
                            onDeleteProject={handleDeleteProject}
                        />
                    )
                )}

                {/* KNOWLEDGE BASE VIEW */}
                {currentView === 'wiki' && (
                    <div className="flex h-full flex-col animate-in fade-in duration-300 bg-white">
                        <header className="px-8 py-5 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-20">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                                    <Book size={20} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-gray-800 leading-tight">{t('app.view.wiki')}</h2>
                                    <p className="text-xs text-gray-400 font-medium">Knowledge Management</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="relative group">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                                        <Briefcase size={12} />
                                    </span>
                                    <select
                                        value={globalSelectedProjectId || ''}
                                        onChange={(e) => {
                                            setGlobalSelectedProjectId(e.target.value);
                                            setGlobalWikiDocId(null);
                                        }}
                                        className="pl-8 pr-8 py-2 bg-gray-50 border border-gray-200 text-sm font-bold text-gray-700 rounded-lg outline-none cursor-pointer hover:bg-white hover:border-gray-300 transition-all appearance-none min-w-[220px]"
                                    >
                                        {projects.map(p => (
                                            <option key={p.id} value={p.id}>{p.info.name}</option>
                                        ))}
                                    </select>
                                    <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 rotate-90 pointer-events-none" size={14} />
                                </div>
                            </div>
                        </header>

                        <div className="flex-1 overflow-hidden">
                            {globalTargetProject ? (
                                <WikiSystem
                                    docs={globalTargetProject.docs || []}
                                    tasks={globalTargetProject.phases.flatMap(p => p.tasks)}
                                    activeDocId={globalWikiDocId}
                                    onSelectDoc={setGlobalWikiDocId}
                                    onUpdateDocs={(newDocs) => handleGlobalProjectUpdate({ ...globalTargetProject, docs: newDocs })}
                                    onOpenTask={(taskId) => {
                                        const phase = globalTargetProject.phases.find(p => p.tasks.some(t => t.id === taskId));
                                        const task = phase?.tasks.find(t => t.id === taskId);
                                        if (task && phase) {
                                            setGlobalActiveTask({ task, project: globalTargetProject, phaseName: phase.name });
                                        }
                                    }}
                                />
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-gray-400 bg-gray-50/30">
                                    <div className="w-16 h-16 bg-white rounded-full shadow-sm border border-gray-100 flex items-center justify-center mb-4">
                                        <Book size={32} className="text-gray-300" />
                                    </div>
                                    <p className="font-medium">Select a project to view its knowledge base.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* MEETINGS VIEW */}
                {currentView === 'meetings' && (
                    <div className="flex h-full flex-col animate-in fade-in duration-300 bg-gray-50/30">
                        {isMeetingEditorOpen ? (
                            <div className="flex-1 overflow-hidden bg-white">
                                <MeetingEditor
                                    meeting={activeMeeting}
                                    teamMembers={teamMembers}
                                    linkedTasks={activeMeeting ? (activeMeeting.relatedTaskIds || []).map(id =>
                                        globalTargetProject.phases.flatMap(p => p.tasks).find(t => t.id === id)
                                    ).filter(t => t !== undefined) as ProjectTask[] : []}
                                    onSave={(m) => {
                                        const current = globalTargetProject.meetings || [];
                                        const exists = current.find(ex => ex.id === m.id);
                                        const newMeetings = exists ? current.map(ex => ex.id === m.id ? m : ex) : [...current, m];
                                        handleGlobalProjectUpdate({ ...globalTargetProject, meetings: newMeetings });
                                        setIsMeetingEditorOpen(false);
                                    }}
                                    onClose={() => setIsMeetingEditorOpen(false)}
                                    onCreateTask={handleGlobalCreateTask}
                                    onOpenTask={(taskId) => {
                                        const phase = globalTargetProject.phases.find(p => p.tasks.some(t => t.id === taskId));
                                        const task = phase?.tasks.find(t => t.id === taskId);
                                        if (task && phase) {
                                            setGlobalActiveTask({ task, project: globalTargetProject, phaseName: phase.name });
                                        }
                                    }}
                                />
                            </div>
                        ) : (
                            <>
                                <header className="px-8 py-5 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-20">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                                            <MessageSquareQuote size={20} />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold text-gray-800 leading-tight">{t('app.view.meetings')}</h2>
                                            <p className="text-xs text-gray-400 font-medium">Team Syncs & Notes</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <div className="relative group">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                                                <Briefcase size={12} />
                                            </span>
                                            <select
                                                value={globalSelectedProjectId || ''}
                                                onChange={(e) => setGlobalSelectedProjectId(e.target.value)}
                                                className="pl-8 pr-8 py-2 bg-gray-50 border border-gray-200 text-sm font-bold text-gray-700 rounded-lg outline-none cursor-pointer hover:bg-white hover:border-gray-300 transition-all appearance-none min-w-[220px]"
                                            >
                                                {projects.map(p => (
                                                    <option key={p.id} value={p.id}>{p.info.name}</option>
                                                ))}
                                            </select>
                                            <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 rotate-90 pointer-events-none" size={14} />
                                        </div>
                                        <button
                                            onClick={handleCreateMeeting}
                                            className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-lg hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:-translate-y-0.5 transition-all font-bold text-sm"
                                        >
                                            <Plus size={18} /> {t('mtg.add')}
                                        </button>
                                    </div>
                                </header>

                                <div className="flex-1 overflow-y-auto p-8">
                                    {globalTargetProject ? (
                                        <div className="max-w-6xl mx-auto">
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                {(globalTargetProject.meetings || []).map(meeting => (
                                                    <div
                                                        key={meeting.id}
                                                        onClick={() => handleSelectMeeting(meeting)}
                                                        className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 cursor-pointer hover:shadow-xl hover:shadow-emerald-500/5 hover:-translate-y-1 hover:border-emerald-200 transition-all group flex flex-col relative overflow-hidden h-full min-h-[13rem]"
                                                    >
                                                        <div className="absolute top-0 left-0 w-1 h-full bg-gray-100 group-hover:bg-emerald-400 transition-colors"></div>

                                                        <div className="flex justify-between items-start mb-4 pl-2">
                                                            <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide ${meeting.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                                                meeting.status === 'In Progress' ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-gray-50 text-gray-600 border border-gray-100'
                                                                }`}>
                                                                {meeting.status}
                                                            </span>
                                                            <span className="text-[10px] text-gray-500 font-medium bg-gray-50 px-2 py-1 rounded-full border border-gray-100">{meeting.type}</span>
                                                        </div>

                                                        <h3 className="text-lg font-bold text-gray-800 mb-2 group-hover:text-emerald-700 transition-colors line-clamp-1 pl-2">
                                                            {meeting.title}
                                                        </h3>

                                                        <div className="flex items-center gap-2 text-xs text-gray-400 mb-6 pl-2">
                                                            <Clock size={14} />
                                                            {new Date(meeting.date).toLocaleDateString()} {new Date(meeting.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </div>

                                                        <div className="mt-auto pt-4 border-t border-gray-50 flex items-center justify-between pl-2">
                                                            <div className="flex -space-x-2">
                                                                {meeting.attendees.slice(0, 3).map((attId, idx) => {
                                                                    const member = teamMembers.find(m => m.id === attId);
                                                                    return member ? (
                                                                        <div key={idx} className={`w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-[9px] text-white font-bold shadow-sm ${member.color.replace('text-', 'bg-').replace('bg-', 'bg-')}`}>
                                                                            {member.avatar}
                                                                        </div>
                                                                    ) : null;
                                                                })}
                                                                {meeting.attendees.length > 3 && (
                                                                    <div className="w-7 h-7 rounded-full border-2 border-white bg-gray-50 flex items-center justify-center text-[9px] text-gray-500 font-bold shadow-sm">
                                                                        +{meeting.attendees.length - 3}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    onClick={(e) => handleDeleteMeeting(meeting.id, e)}
                                                                    className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                                                                    title="Delete Meeting"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                                <div className="flex items-center gap-1 text-xs font-bold text-emerald-600 opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all">
                                                                    Open <ArrowRight size={14} />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-full text-gray-400 bg-gray-50/30 rounded-3xl border border-dashed border-gray-200 m-8">
                                            <p>Select a project to manage meetings.</p>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* GLOBAL CALENDAR VIEW */}
                {currentView === 'calendar' && (
                    <div className="flex h-full flex-col animate-in fade-in duration-300 bg-white">
                        <header className="px-8 py-5 border-b border-gray-100 flex items-center gap-3 bg-white sticky top-0 z-20">
                            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                                <CalendarDays size={20} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-gray-800 leading-tight">{t('app.view.calendar')}</h2>
                                <p className="text-xs text-gray-400 font-medium">Global Timeline</p>
                            </div>
                        </header>
                        <div className="flex-1 overflow-hidden p-6 bg-gray-50/30">
                            <CalendarView
                                phases={projects.flatMap(p => p.phases.map(ph => ({ ...ph, name: `[${p.info.code}] ${ph.name}` })))}
                                events={projects.flatMap(p => (p.events || []).map(e => ({ ...e, projectCode: p.info.code })))}
                                teamMembers={teamMembers}
                                onAddEvent={handleCreateEvent}
                                onUpdateTask={handleUpdateTask}
                                onDeleteEvent={handleDeleteEvent}
                                projects={projects}
                            />
                        </div>
                    </div>
                )}

                {/* ERP MANAGER VIEW */}
                {currentView === 'erp' && (
                    <ERPManager />
                )}

                {/* ISSUES VIEW */}
                {currentView === 'issues' && (
                    <IssueTracker
                        projects={projects}
                        teamMembers={teamMembers}
                        onAddIssue={handleCreateIssue}
                        onUpdateIssue={handleUpdateIssue}
                        onDeleteIssue={handleDeleteIssue}
                        onImportIssues={handleImportIssues}
                        onNavigateToDoc={handleNavigateToDoc}
                        tags={tags}
                        onUpdateTags={async (newTags) => {
                            await db.saveTags(newTags);
                            setTags(newTags);
                        }}
                        onCreateProject={handleCreateProject}
                    />
                )}

                {/* TEAM VIEW */}
                {currentView === 'team' && (
                    <TeamView
                        teamMembers={teamMembers}
                        projects={projects}
                        onUpdateTeam={handleUpdateTeam}
                    />
                )}

                {/* Global Task Modal */}
                {globalActiveTask && (
                    <TaskDetailModal
                        isOpen={!!globalActiveTask}
                        onClose={() => setGlobalActiveTask(null)}
                        task={globalActiveTask.task}
                        phaseName={globalActiveTask.phaseName}
                        phases={globalActiveTask.project.phases}
                        onUpdateTask={handleGlobalTaskUpdate}
                        onMoveTask={handleGlobalMoveTask}
                        teamMembers={teamMembers}
                        projectDocs={globalActiveTask.project.docs || []}
                        onOpenDoc={(docId) => {
                            handleNavigateToWiki(docId);
                        }}
                    />
                )}

                <SettingsModal
                    isOpen={isSettingsOpen}
                    onClose={() => setIsSettingsOpen(false)}
                    currentUser={userProfile}
                    onUpdateUser={handleUpdateUserProfile}
                />

                <CommandPalette
                    isOpen={isCommandPaletteOpen}
                    onClose={() => setIsCommandPaletteOpen(false)}
                    projects={projects}
                    onNavigate={handleCommandNavigation}
                    onAction={handleCommandAction}
                />

            </main>
        </div>
    );
};

const App: React.FC = () => {
    return (
        <LanguageProvider>
            <ToastProvider>
                <DialogProvider>
                    <AppContent />
                </DialogProvider>
            </ToastProvider>
        </LanguageProvider>
    );
};

export default App;
