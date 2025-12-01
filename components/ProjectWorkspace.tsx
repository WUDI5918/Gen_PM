
import React, { useState } from 'react';
import { Project, TeamMember, ProjectPhase, ProjectTask, TaskStatus } from '../types';
import {
    LayoutGrid, List, Trello, Calendar, DollarSign, ShieldAlert,
    ArrowLeft, MoreVertical, Bot, Sparkles, Share2, ChevronLeft, ChevronRight, Settings
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import { Dashboard } from './Dashboard';
import { ProjectTable } from './ProjectTable';
import { KanbanBoard } from './KanbanBoard';
import { GanttChart } from './GanttChart';
import { FinanceManager } from './FinanceManager';
import { RiskRegister } from './RiskRegister';
import { ProjectChat } from './ProjectChat';
import { AIAssistant } from './AIAssistant';
import { AIGenerator } from './AIGenerator';
import { TaskDetailModal } from './TaskDetailModal';
import { ProjectSettingsModal } from './ProjectSettingsModal';

interface ProjectWorkspaceProps {
    project: Project;
    projects: Project[];
    globalTeamMembers: TeamMember[];
    onUpdate: (project: Project) => void;
    onBack: () => void;
    onOpenWiki: (docId: string) => void;
}

type ProjectView = 'dashboard' | 'list' | 'board' | 'gantt' | 'finance' | 'risks';

export const ProjectWorkspace: React.FC<ProjectWorkspaceProps> = ({
    project,
    projects,
    globalTeamMembers,
    onUpdate,
    onBack,
    onOpenWiki
}) => {
    const { t } = useLanguage();
    const { addToast } = useToast();

    const [currentView, setCurrentView] = useState<ProjectView>('dashboard');
    const [isEditing, setIsEditing] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);
    const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
    const [isProjectSettingsOpen, setIsProjectSettingsOpen] = useState(false);

    // Active Task State with Phase Context
    const [activeTaskContext, setActiveTaskContext] = useState<{ task: ProjectTask, phaseName: string } | null>(null);

    // --- Handlers ---

    const handleUpdatePhases = (updatedPhases: ProjectPhase[]) => {
        onUpdate({ ...project, phases: updatedPhases, lastModified: Date.now() });
    };

    const handleUpdatePhase = (updatedPhase: ProjectPhase) => {
        const newPhases = project.phases.map(p => p.id === updatedPhase.id ? updatedPhase : p);
        handleUpdatePhases(newPhases);
    };

    const handleDeletePhase = (phaseId: string) => {
        const newPhases = project.phases.filter(p => p.id !== phaseId);
        handleUpdatePhases(newPhases);
    };

    const handleCreatePhase = () => {
        const newPhase: ProjectPhase = {
            id: `ph-${Date.now()}`,
            name: 'New Phase',
            tasks: []
        };
        handleUpdatePhases([...project.phases, newPhase]);
        setIsEditing(true);
    };

    const handleTaskClick = (phaseId: string, taskId: string) => {
        const phase = project.phases.find(p => p.id === phaseId);
        const task = phase?.tasks.find(t => t.id === taskId);
        if (task && phase) setActiveTaskContext({ task, phaseName: phase.name });
    };

    const handleTaskUpdate = (updatedTask: ProjectTask) => {
        const newPhases = project.phases.map(p => ({
            ...p,
            tasks: p.tasks.map(t => t.id === updatedTask.id ? updatedTask : t)
        }));
        handleUpdatePhases(newPhases);
        // Keep the modal open with updated data, preserving phase context
        setActiveTaskContext(prev => prev ? { ...prev, task: updatedTask } : null);
    };

    const handleMoveTask = (taskId: string, newPhaseId: string) => {
        const newPhases = [...project.phases];
        let taskToMove: ProjectTask | undefined;

        // 1. Find and Remove from old phase
        for (const phase of newPhases) {
            const taskIndex = phase.tasks.findIndex(t => t.id === taskId);
            if (taskIndex > -1) {
                taskToMove = phase.tasks[taskIndex];
                phase.tasks.splice(taskIndex, 1);
                break;
            }
        }

        // 2. Add to new phase
        if (taskToMove) {
            const targetPhase = newPhases.find(p => p.id === newPhaseId);
            if (targetPhase) {
                targetPhase.tasks.push(taskToMove);
                handleUpdatePhases(newPhases);
                addToast(`Task moved to ${targetPhase.name}`, 'success');

                // Update modal context
                setActiveTaskContext({ task: taskToMove, phaseName: targetPhase.name });
            }
        }
    };

    const handleImportPlan = (newPhases: ProjectPhase[]) => {
        if (project.phases.length === 0) {
            handleUpdatePhases(newPhases);
        } else {
            handleUpdatePhases([...project.phases, ...newPhases]);
        }
    };

    const NavTab = ({ id, icon: Icon, label }: { id: ProjectView, icon: any, label: string }) => (
        <button
            onClick={() => setCurrentView(id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${currentView === id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
        >
            <Icon size={16} />
            {label}
        </button>
    );

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Top Header Navigation */}
            <header className="bg-white border-b border-gray-200 shrink-0 flex flex-col">
                {/* Top Row: Context & Actions */}
                <div className="px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={onBack}
                            className="p-2 rounded-full text-gray-500 hover:bg-gray-100 transition-colors"
                            title={t('project.back')}
                        >
                            <ArrowLeft size={20} />
                        </button>

                        <div className="flex flex-col">
                            <h1 className="text-xl font-bold text-gray-900 leading-none">
                                {project.info.name}
                            </h1>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs font-mono text-gray-500 bg-gray-100 px-1.5 rounded">
                                    {project.info.code}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsChatOpen(true)}
                            className="flex items-center gap-2 text-gray-600 hover:text-indigo-600 bg-gray-50 hover:bg-indigo-50 px-3 py-2 rounded-lg transition-colors text-sm font-medium"
                        >
                            <Bot size={18} /> <span className="hidden sm:inline">AI Assistant</span>
                        </button>
                        <div className="h-6 w-px bg-gray-200 mx-1"></div>
                        <button
                            onClick={() => setIsProjectSettingsOpen(true)}
                            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Project Settings"
                        >
                            <Settings size={20} />
                        </button>
                    </div>
                </div>

                {/* Bottom Row: Navigation Tabs */}
                <div className="px-6 flex items-center gap-2 overflow-x-auto custom-scrollbar hide-scrollbar">
                    <NavTab id="dashboard" icon={LayoutGrid} label={t('app.view.dashboard')} />
                    <NavTab id="list" icon={List} label={t('app.view.list')} />
                    <NavTab id="board" icon={Trello} label={t('app.view.board')} />
                    <NavTab id="gantt" icon={Calendar} label={t('app.view.gantt')} />
                    <NavTab id="finance" icon={DollarSign} label={t('app.view.finance')} />
                    <NavTab id="risks" icon={ShieldAlert} label={t('app.view.risks')} />
                </div>
            </header>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 bg-gray-50/30 relative overflow-hidden">

                {/* Content Toolbar (conditional) */}
                {(currentView === 'list' || currentView === 'board' || currentView === 'gantt') && (
                    <div className="h-12 border-b border-gray-200 flex items-center justify-between px-6 bg-white shrink-0">
                        <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 text-xs font-bold text-gray-600 cursor-pointer select-none hover:text-indigo-600 transition-colors">
                                <input type="checkbox" checked={isEditing} onChange={(e) => setIsEditing(e.target.checked)} className="accent-indigo-600" />
                                Edit Mode
                            </label>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setIsGeneratorOpen(true)}
                                className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
                            >
                                <Sparkles size={14} /> {t('app.ai_generate')}
                            </button>
                            {isEditing && (
                                <button
                                    onClick={handleCreatePhase}
                                    className="flex items-center gap-1.5 text-xs font-bold bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors"
                                >
                                    {t('app.new_phase')}
                                </button>
                            )}
                            <button
                                onClick={() => setIsAIAssistantOpen(true)}
                                className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-gray-100 rounded-lg transition-colors"
                                title="Audit Schedule"
                            >
                                <Share2 size={16} />
                            </button>
                        </div>
                    </div>
                )}

                {/* Content Body */}
                <div className="flex-1 overflow-hidden relative">
                    {currentView === 'dashboard' && <Dashboard phases={project.phases || []} />}

                    {currentView === 'list' && (
                        <ProjectTable
                            phases={project.phases || []}
                            teamMembers={globalTeamMembers || []}
                            isEditing={isEditing}
                            onUpdatePhase={handleUpdatePhase}
                            onDeletePhase={handleDeletePhase}
                            onTaskClick={handleTaskClick}
                            docs={project.docs}
                            onOpenDoc={onOpenWiki}
                            onUpdatePhases={handleUpdatePhases}
                        />
                    )}

                    {currentView === 'board' && (
                        <KanbanBoard
                            phases={project.phases || []}
                            isEditing={isEditing}
                            teamMembers={globalTeamMembers || []}
                            onUpdateTaskStatus={(phaseId, taskId, newStatus) => {
                                const phase = project.phases.find(p => p.id === phaseId);
                                if (phase) {
                                    const task = phase.tasks.find(t => t.id === taskId);
                                    if (task) handleTaskUpdate({ ...task, status: newStatus });
                                }
                            }}
                            onTaskClick={handleTaskClick}
                        />
                    )}

                    {currentView === 'gantt' && (
                        <GanttChart
                            phases={project.phases || []}
                            isEditing={isEditing}
                            onUpdatePhase={handleUpdatePhase}
                        />
                    )}

                    {currentView === 'finance' && <FinanceManager project={project} onUpdate={onUpdate} />}

                    {currentView === 'risks' && <RiskRegister project={project} onUpdate={onUpdate} />}

                </div>

                {/* Overlays */}

                {/* Project Chat (Right Panel) */}
                {isChatOpen && (
                    <div className="absolute top-0 right-0 bottom-0 w-[400px] bg-white shadow-2xl border-l border-gray-200 z-30 animate-in slide-in-from-right duration-300">
                        <ProjectChat project={project} onClose={() => setIsChatOpen(false)} />
                    </div>
                )}

                <AIAssistant
                    isOpen={isAIAssistantOpen}
                    onClose={() => setIsAIAssistantOpen(false)}
                    phases={project.phases}
                    projectInfo={project.info}
                />

                <AIGenerator
                    isOpen={isGeneratorOpen}
                    onClose={() => setIsGeneratorOpen(false)}
                    onPlanGenerated={handleImportPlan}
                    projects={projects}
                    defaultProjectId={project.id}
                />

                {activeTaskContext && (
                    <TaskDetailModal
                        isOpen={!!activeTaskContext}
                        onClose={() => setActiveTaskContext(null)}
                        task={activeTaskContext.task}
                        phaseName={activeTaskContext.phaseName}
                        phases={project.phases}
                        onUpdateTask={handleTaskUpdate}
                        onMoveTask={handleMoveTask}
                        teamMembers={globalTeamMembers || []}
                        projectDocs={project.docs}
                        onOpenDoc={(docId) => {
                            setActiveTaskContext(null);
                            onOpenWiki(docId);
                        }}
                    />
                )}

                <ProjectSettingsModal
                    isOpen={isProjectSettingsOpen}
                    onClose={() => setIsProjectSettingsOpen(false)}
                    project={project}
                    onUpdateProject={onUpdate}
                />
            </div>
        </div>
    );
};
