
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { ProjectPhase, TaskStatus, ProjectTask, TeamMember, TaskRemark, TaskAttachment, ProjectDoc } from '../types';
import { AlertCircle, Trash2, Plus, CheckCircle2, Circle, AlertTriangle, Box, ChevronDown, ChevronRight, Search, Filter, X, Clock, GripVertical, Link as LinkIcon, Paperclip, ExternalLink, CalendarClock, ListChecks, FileText, Cloud, Flag, Calendar, User, Layout, Download, Upload } from 'lucide-react';
import { toInputDate, fromInputDate, parseDate, escapeCSV, parseCSV } from '../utils';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import { useDialog } from '../contexts/DialogContext';

interface ProjectTableProps {
    phases: ProjectPhase[];
    teamMembers: TeamMember[];
    isEditing: boolean;
    onUpdatePhase: (updatedPhase: ProjectPhase) => void;
    onDeletePhase: (phaseId: string) => void;
    onTaskClick?: (phaseId: string, taskId: string) => void;
    docs?: ProjectDoc[];
    onOpenDoc?: (docId: string) => void;
    onUpdatePhases?: (phases: ProjectPhase[]) => void;
}

const PriorityBadge = ({ score }: { score: string }) => {
    const { t } = useLanguage();
    const color = score === 'High' ? 'text-rose-700 bg-rose-100 border-rose-200' : score === 'Med' ? 'text-amber-700 bg-amber-100 border-amber-200' : 'text-sky-700 bg-sky-100 border-sky-200';
    const iconColor = score === 'High' ? 'text-rose-600 fill-rose-600' : score === 'Med' ? 'text-amber-600 fill-amber-600' : 'text-sky-600';

    return (
        <span className={`flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${color}`}>
            <Flag size={10} className={iconColor} />
            {t(`priority.${score}`) || score}
        </span>
    );
};

const StatusBadge = ({ status, isOverdue }: { status: TaskStatus, isOverdue?: boolean }) => {
    const { t } = useLanguage();
    const styles = {
        [TaskStatus.Completed]: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        [TaskStatus.InProgress]: 'bg-blue-100 text-blue-800 border-blue-200',
        [TaskStatus.Pending]: 'bg-slate-100 text-slate-600 border-slate-200',
        [TaskStatus.Delayed]: 'bg-rose-100 text-rose-800 border-rose-200',
    };

    const icon = {
        [TaskStatus.Completed]: <CheckCircle2 size={12} className="text-emerald-600" />,
        [TaskStatus.InProgress]: <Clock size={12} className="animate-pulse text-blue-600" />,
        [TaskStatus.Pending]: <Circle size={12} className="text-slate-400" />,
        [TaskStatus.Delayed]: <AlertTriangle size={12} className="text-rose-600" />,
    };

    return (
        <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border shadow-sm ${styles[status]}`}>
                {icon[status]}
                {t(`status.${status}`)}
            </span>
        </div>
    );
};

// Component for the Progress Bar
const PhaseProgress = ({ tasks }: { tasks: ProjectTask[] }) => {
    if (tasks.length === 0) return null;
    const completed = tasks.filter(t => t.status === TaskStatus.Completed).length;
    const percent = Math.round((completed / tasks.length) * 100);

    const colorClass = percent === 100 ? 'bg-emerald-500' : percent > 50 ? 'bg-blue-500' : 'bg-indigo-500';

    return (
        <div className="flex items-center gap-2 min-w-[100px]">
            <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-500 shadow-sm ${colorClass}`}
                    style={{ width: `${percent}%` }}
                ></div>
            </div>
            <span className="text-[10px] font-bold text-gray-500 w-8 text-right">{percent}%</span>
        </div>
    );
};

export const ProjectTable: React.FC<ProjectTableProps> = ({ phases, teamMembers, isEditing, onUpdatePhase, onDeletePhase, onTaskClick, docs = [], onOpenDoc, onUpdatePhases }) => {

    const { t } = useLanguage();
    const { addToast } = useToast();
    const { ask } = useDialog();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [addingRemarkTo, setAddingRemarkTo] = useState<string | null>(null);
    const [newRemarkText, setNewRemarkText] = useState('');
    const [newRemarkType, setNewRemarkType] = useState(false);

    const [collapsedPhases, setCollapsedPhases] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<TaskStatus | 'All'>('All');

    // Fixed Popup State (Date, Status, Owner, Priority) to avoid clipping
    const [activePopup, setActivePopup] = useState<{
        type: 'status' | 'date' | 'owner' | 'priority';
        taskId: string;
        phaseId: string;
        rect: DOMRect;
    } | null>(null);

    // State for Attachment/Dependency Popovers (Inline mostly)
    const [activeAttachmentTask, setActiveAttachmentTask] = useState<string | null>(null);
    const [attachTab, setAttachTab] = useState<'link' | 'doc'>('link'); // Switch between external and internal

    const [newAttachName, setNewAttachName] = useState('');
    const [newAttachUrl, setNewAttachUrl] = useState('');

    const [activeDepTask, setActiveDepTask] = useState<string | null>(null);

    // Drag and Drop State
    const dragItem = useRef<{ phaseId: string, taskIndex: number } | null>(null);
    const dragOverItem = useRef<{ phaseId: string, taskIndex: number } | null>(null);

    // Derived active task for attachments modal
    const getAllTasks = () => phases.flatMap(p => p.tasks);
    const activeTaskForAttachments = useMemo(() => {
        if (!activeAttachmentTask) return null;
        return getAllTasks().find(t => t.id === activeAttachmentTask);
    }, [activeAttachmentTask, phases]);

    const activePhaseForAttachments = useMemo(() => {
        if (!activeAttachmentTask) return null;
        return phases.find(p => p.tasks.some(t => t.id === activeAttachmentTask));
    }, [activeAttachmentTask, phases]);

    const togglePhase = (phaseId: string) => {
        const newSet = new Set(collapsedPhases);
        if (newSet.has(phaseId)) {
            newSet.delete(phaseId);
        } else {
            newSet.add(phaseId);
        }
        setCollapsedPhases(newSet);
    };

    const handleTaskChange = (phase: ProjectPhase, taskId: string, field: keyof ProjectTask, value: any) => {
        const updatedTasks = phase.tasks.map(t =>
            t.id === taskId ? { ...t, [field]: value } : t
        );
        onUpdatePhase({ ...phase, tasks: updatedTasks });
    };

    const handlePhaseNameChange = (phase: ProjectPhase, newName: string) => {
        onUpdatePhase({ ...phase, name: newName });
    };

    const handleAddTask = (phase: ProjectPhase) => {
        const todayStr = new Date().toISOString().split('T')[0].replace(/-/g, '/');
        const newTask: ProjectTask = {
            id: `new-${Date.now()}`,
            subTaskName: 'New Task',
            deliverables: 'Deliverable',
            workContent: 'Task description...',
            owner: 'Unassigned',
            duration: 1,
            startDate: todayStr,
            endDate: todayStr,
            status: TaskStatus.Pending,
            score: 'Med',
            remarks: [],
            dependencies: [],
            attachments: [],
            checklist: [],
            comments: []
        };
        onUpdatePhase({ ...phase, tasks: [...phase.tasks, newTask] });
        if (collapsedPhases.has(phase.id)) {
            togglePhase(phase.id);
        }
        addToast(t('common.add') + " Task", 'success');
    };

    const handleDeleteTask = (phase: ProjectPhase, taskId: string) => {
        ask({
            title: 'Delete Task?',
            message: t('table.delete_task_confirm'),
            type: 'danger',
            confirmText: t('common.delete'),
            cancelText: t('common.cancel'),
            onConfirm: () => {
                const updatedTasks = phase.tasks.filter(t => t.id !== taskId);
                onUpdatePhase({ ...phase, tasks: updatedTasks });
                addToast("Task deleted", 'warning');
            }
        });
    };

    // --- Drag & Drop Logic ---
    const onDragStart = (e: React.DragEvent, phaseId: string, index: number) => {
        dragItem.current = { phaseId, taskIndex: index };
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/html", e.currentTarget.innerHTML);
        e.currentTarget.classList.add('opacity-50');
    };

    const onDragEnter = (e: React.DragEvent, phaseId: string, index: number) => {
        if (dragItem.current && dragItem.current.phaseId === phaseId) {
            dragOverItem.current = { phaseId, taskIndex: index };
        }
    };

    const onDragEnd = (e: React.DragEvent) => {
        e.currentTarget.classList.remove('opacity-50');

        if (!dragItem.current || !dragOverItem.current) {
            dragItem.current = null;
            dragOverItem.current = null;
            return;
        }

        if (dragItem.current.phaseId === dragOverItem.current.phaseId) {
            const phaseId = dragItem.current.phaseId;
            const phase = phases.find(p => p.id === phaseId);
            if (phase) {
                const tasks = [...phase.tasks];
                const dragTaskContent = tasks[dragItem.current.taskIndex];
                tasks.splice(dragItem.current.taskIndex, 1);
                tasks.splice(dragOverItem.current.taskIndex, 0, dragTaskContent);

                onUpdatePhase({ ...phase, tasks });
            }
        }

        dragItem.current = null;
        dragOverItem.current = null;
    };


    // --- Remarks Logic ---
    const addRemark = (phase: ProjectPhase, taskId: string) => {
        if (!newRemarkText.trim()) return;
        const newRemark: TaskRemark = {
            id: `rm-${Date.now()}`,
            text: newRemarkText,
            isWarning: newRemarkType
        };
        const updatedTasks = phase.tasks.map(t => {
            if (t.id === taskId) {
                return { ...t, remarks: [...t.remarks, newRemark] };
            }
            return t;
        });
        onUpdatePhase({ ...phase, tasks: updatedTasks });
        setNewRemarkText('');
        setAddingRemarkTo(null);
    };

    const deleteRemark = (phase: ProjectPhase, taskId: string, remarkId: string) => {
        const updatedTasks = phase.tasks.map(t => {
            if (t.id === taskId) {
                return { ...t, remarks: t.remarks.filter(r => r.id !== remarkId) };
            }
            return t;
        });
        onUpdatePhase({ ...phase, tasks: updatedTasks });
    };

    // --- Attachments Logic (Now used by Modal) ---
    const addAttachment = () => {
        if (!newAttachName || !newAttachUrl || !activeTaskForAttachments || !activePhaseForAttachments) return;
        const newAtt: TaskAttachment = {
            id: `att-${Date.now()}`,
            name: newAttachName,
            url: newAttachUrl
        };
        const updatedTasks = activePhaseForAttachments.tasks.map(t => {
            if (t.id === activeTaskForAttachments.id) return { ...t, attachments: [...t.attachments, newAtt] };
            return t;
        });
        onUpdatePhase({ ...activePhaseForAttachments, tasks: updatedTasks });
        setNewAttachName('');
        setNewAttachUrl('');
    };

    const deleteAttachment = (attachId: string) => {
        if (!activeTaskForAttachments || !activePhaseForAttachments) return;
        const updatedTasks = activePhaseForAttachments.tasks.map(t => {
            if (t.id === activeTaskForAttachments.id) return { ...t, attachments: t.attachments.filter(a => a.id !== attachId) };
            return t;
        });
        onUpdatePhase({ ...activePhaseForAttachments, tasks: updatedTasks });
    };

    // --- Doc Linking Logic (Now used by Modal) ---
    const toggleDocLink = (docId: string) => {
        if (!activeTaskForAttachments || !activePhaseForAttachments) return;
        const updatedTasks = activePhaseForAttachments.tasks.map(t => {
            if (t.id === activeTaskForAttachments.id) {
                const current = t.linkedDocIds || [];
                const exists = current.includes(docId);
                return {
                    ...t,
                    linkedDocIds: exists ? current.filter(id => id !== docId) : [...current, docId]
                };
            }
            return t;
        });
        onUpdatePhase({ ...activePhaseForAttachments, tasks: updatedTasks });
    };

    // --- Dependency Logic ---
    const toggleDependency = (phase: ProjectPhase, taskId: string, targetTaskId: string) => {
        const updatedTasks = phase.tasks.map(t => {
            if (t.id === taskId) {
                const exists = t.dependencies.includes(targetTaskId);
                const newDeps = exists
                    ? t.dependencies.filter(d => d !== targetTaskId)
                    : [...t.dependencies, targetTaskId];
                return { ...t, dependencies: newDeps };
            }
            return t;
        });
        onUpdatePhase({ ...phase, tasks: updatedTasks });
    };

    const getOwnerDetails = (name: string) => {
        return teamMembers.find(m => m.name === name) || { color: 'bg-gray-100 text-gray-600', avatar: '?' };
    };

    const getFilteredTasks = (tasks: ProjectTask[]) => {
        return tasks.filter(task => {
            const matchesSearch =
                task.subTaskName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                task.workContent.toLowerCase().includes(searchQuery.toLowerCase()) ||
                task.owner.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesStatus = statusFilter === 'All' || task.status === statusFilter;

            return matchesSearch && matchesStatus;
        });
    };

    // Automatic Overdue Calculation
    const getOverdueDays = (task: ProjectTask) => {
        if (task.status === TaskStatus.Completed) return null;
        if (!task.endDate || task.endDate === '-') return null;

        const end = parseDate(task.endDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);

        if (today > end) {
            const diffTime = Math.abs(today.getTime() - end.getTime());
            return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }
        return null;
    };

    // Get active popup task data
    const popupTaskData = useMemo(() => {
        if (!activePopup) return null;
        const phase = phases.find(p => p.id === activePopup.phaseId);
        const task = phase?.tasks.find(t => t.id === activePopup.taskId);
        return { phase, task };
    }, [activePopup, phases]);

    // --- Export / Import Logic ---
    const getStatusFromTranslation = (translated: string): TaskStatus => {
        for (const status of Object.values(TaskStatus)) {
            if (t(`status.${status}`) === translated || status === translated) {
                return status;
            }
        }
        return TaskStatus.Pending;
    };

    const getPriorityFromTranslation = (translated: string): string => {
        const priorities = ['High', 'Med', 'Low'];
        for (const p of priorities) {
            if (t(`priority.${p}`) === translated || p === translated) {
                return p;
            }
        }
        return 'Med';
    };

    const handleExportCSV = () => {
        const headers = [
            t('table.serial_number'),
            t('ai.phase'),
            t('table.task_name'),
            t('table.description'),
            t('table.assigned_to'),
            t('table.start_date'),
            t('table.end_date'),
            t('table.status'),
            t('table.priority')
        ];

        let csvContent = '\uFEFF' + headers.map(escapeCSV).join(',') + '\n';

        let serialNumber = 1;
        phases.forEach(phase => {
            phase.tasks.forEach(task => {
                const row = [
                    serialNumber.toString(),
                    phase.name,
                    task.subTaskName,
                    task.workContent,
                    task.owner,
                    task.startDate,
                    task.endDate,
                    t(`status.${task.status}`) || task.status,
                    t(`priority.${task.score}`) || task.score
                ];
                csvContent += row.map(escapeCSV).join(',') + '\n';
                serialNumber++;
            });
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `project_tasks_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            if (!text) return;

            const rows = parseCSV(text);
            // Skip header
            const dataRows = rows.slice(1);

            // Clone existing phases to map for merging
            // We want to preserve existing phases and tasks, and append imported ones
            // Strategy: 
            // 1. Create a map of existing phases by name
            // 2. Iterate rows, find or create phase, add task

            const updatedPhases = phases.map(p => ({ ...p, tasks: [...p.tasks] }));

            dataRows.forEach(cols => {
                if (cols.length < 2) return;

                // #, Phase, Task Name, Desc, Owner, Start, End, Status, Priority
                // We ignore the first column (#)
                const [_, phaseName, taskName, desc, owner, start, end, statusStr, priorityStr] = cols;

                if (!phaseName || !taskName) return;

                const status = getStatusFromTranslation(statusStr);
                const score = getPriorityFromTranslation(priorityStr);

                const newTask: ProjectTask = {
                    id: `imp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    subTaskName: taskName,
                    workContent: desc || '',
                    owner: owner || 'Unassigned',
                    startDate: start || new Date().toISOString().split('T')[0].replace(/-/g, '/'),
                    endDate: end || new Date().toISOString().split('T')[0].replace(/-/g, '/'),
                    status: status,
                    score: score,
                    deliverables: '', // Default empty as it's no longer in CSV
                    duration: 1,
                    remarks: [],
                    dependencies: [],
                    attachments: [],
                    checklist: [],
                    comments: []
                };

                // Find phase
                let phase = updatedPhases.find(p => p.name === phaseName);
                if (!phase) {
                    phase = {
                        id: `ph-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        name: phaseName,
                        tasks: []
                    };
                    updatedPhases.push(phase);
                }
                phase.tasks.push(newTask);
            });

            if (onUpdatePhases) {
                onUpdatePhases(updatedPhases);
                addToast(t('settings.import_success') || 'Import Successful', 'success');
            } else {
                addToast('Import not supported in this view', 'error');
            }
        };
        reader.readAsText(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="h-full flex flex-col p-6 bg-gray-50/50">
            {/* Search & Filter Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6 items-center justify-between shrink-0">
                <div className="relative w-full sm:w-80 group">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors" size={16} />
                    <input
                        type="text"
                        placeholder={t('common.search')}
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all shadow-sm"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept=".csv"
                        onChange={handleFileChange}
                    />
                    <div className="flex items-center gap-1">
                        <button
                            onClick={handleExportCSV}
                            className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-gray-200 hover:border-indigo-200"
                            title={t('app.export')}
                        >
                            <Download size={16} />
                        </button>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-gray-200 hover:border-indigo-200"
                            title={t('settings.import')}
                        >
                            <Upload size={16} />
                        </button>
                    </div>
                    <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm hover:border-gray-300 transition-colors">
                        <Filter size={14} className="text-gray-400" />
                        <select
                            className="text-sm bg-transparent border-none outline-none text-gray-700 font-bold py-0.5 pr-2 cursor-pointer"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as TaskStatus | 'All')}
                        >
                            <option value="All">{t('status.All')}</option>
                            {Object.values(TaskStatus).map(s => (
                                <option key={s} value={s}>{t(`status.${s}`)}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 pb-20 custom-scrollbar space-y-0">
                {phases.map((phase, phaseIndex) => {
                    const isCollapsed = collapsedPhases.has(phase.id);
                    const filteredTasks = getFilteredTasks(phase.tasks);

                    return (
                        <div
                            key={phase.id}
                            // REMOVED overflow-hidden to fix popup clipping issue
                            className="bg-white shadow-sm border-x border-b first:border-t border-gray-200 first:rounded-t-xl last:rounded-b-xl transition-all duration-300"
                        >
                            {/* Phase Header - REMOVED sticky to let it scroll normally */}
                            <div className="bg-gray-50 px-6 py-3 border-b border-gray-100 flex items-center justify-between group/header cursor-pointer select-none" onClick={() => togglePhase(phase.id)}>
                                <div className="flex items-center gap-3 flex-1">
                                    <div className={`text-gray-400 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : 'rotate-0'}`}>
                                        <ChevronDown size={20} />
                                    </div>

                                    {/* Blue Vertical Bar Removed Here */}

                                    {isEditing ? (
                                        <input
                                            className="text-lg font-bold bg-transparent border border-transparent hover:border-indigo-200 rounded px-2 py-0.5 text-gray-800 w-full max-w-md focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all focus:bg-white"
                                            value={phase.name}
                                            onClick={(e) => e.stopPropagation()}
                                            onChange={(e) => handlePhaseNameChange(phase, e.target.value)}
                                        />
                                    ) : (
                                        <h3 className="text-lg font-bold text-gray-800">{phase.name}</h3>
                                    )}

                                    <span className="ml-2 bg-indigo-50 text-indigo-600 text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full font-extrabold border border-indigo-100">
                                        {phase.tasks.length} {t('table.phase_tasks')}
                                    </span>
                                </div>

                                <div className="flex items-center gap-5">
                                    <div className="hidden sm:block opacity-60 group-hover/header:opacity-100 transition-opacity">
                                        <PhaseProgress tasks={phase.tasks} />
                                    </div>

                                    {isEditing && (
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleAddTask(phase); }}
                                                className="flex items-center gap-1.5 text-xs bg-white text-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-50 hover:text-indigo-700 font-bold transition-colors border border-gray-200 hover:border-indigo-200 shadow-sm"
                                            >
                                                <Plus size={14} /> {t('table.add_task')}
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onDeletePhase(phase.id); }}
                                                className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Delete Phase"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Tasks List */}
                            {!isCollapsed && (
                                <div className="divide-y divide-gray-50 animate-in slide-in-from-top-1 duration-200">
                                    {phase.tasks.length === 0 ? (
                                        <div className="p-12 text-center text-gray-400 flex flex-col items-center justify-center bg-gray-50/30">
                                            <div className="bg-white w-12 h-12 rounded-xl shadow-sm border border-gray-100 flex items-center justify-center mb-3">
                                                <Box size={20} className="text-gray-300" />
                                            </div>
                                            <p className="text-sm font-medium text-gray-500">{t('app.no_data')}</p>
                                        </div>
                                    ) : filteredTasks.length === 0 ? (
                                        <div className="p-8 text-center text-gray-400 italic text-sm bg-gray-50/30">
                                            No tasks match your current search or filter.
                                        </div>
                                    ) : (
                                        filteredTasks.map((task, taskIndex) => {
                                            const ownerInfo = getOwnerDetails(task.owner);
                                            const isDepOpen = activeDepTask === task.id;
                                            const overdueDays = getOverdueDays(task);

                                            const totalLinks = task.attachments.length + (task.linkedDocIds?.length || 0);
                                            const hasDeps = task.dependencies.length > 0;

                                            return (
                                                <div
                                                    key={task.id}
                                                    className="group hover:bg-indigo-50/30 transition-colors p-5 relative"
                                                    draggable={isEditing}
                                                    onDragStart={(e) => onDragStart(e, phase.id, taskIndex)}
                                                    onDragEnter={(e) => onDragEnter(e, phase.id, taskIndex)}
                                                    onDragEnd={onDragEnd}
                                                    onDragOver={(e) => e.preventDefault()}
                                                >
                                                    <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 pl-4 relative">
                                                        {/* Drag Handle */}
                                                        {isEditing && (
                                                            <div className="absolute -left-3 top-1 text-gray-300 hover:text-indigo-400 cursor-grab active:cursor-grabbing p-1">
                                                                <GripVertical size={16} />
                                                            </div>
                                                        )}

                                                        {/* Left Column: Main Info */}
                                                        <div className="flex-1 space-y-2 min-w-0">
                                                            <div className="flex items-start gap-3">

                                                                <div className="flex-1 min-w-0">
                                                                    {isEditing ? (
                                                                        <input
                                                                            className="w-full font-bold text-gray-800 text-base bg-transparent border border-transparent hover:border-gray-200 rounded-lg px-2 py-0.5 -ml-2 mb-1 focus:ring-2 focus:ring-indigo-500/20 outline-none focus:bg-white transition-all"
                                                                            value={task.subTaskName}
                                                                            placeholder={t('table.task_name')}
                                                                            onChange={(e) => handleTaskChange(phase, task.id, 'subTaskName', e.target.value)}
                                                                        />
                                                                    ) : (
                                                                        <button
                                                                            onClick={() => onTaskClick && onTaskClick(phase.id, task.id)}
                                                                            className="text-left font-bold text-gray-800 text-base leading-tight mb-1 hover:text-indigo-600 transition-colors"
                                                                        >
                                                                            {task.subTaskName}
                                                                        </button>
                                                                    )}

                                                                    {isEditing ? (
                                                                        <div className="space-y-2 px-0">
                                                                            <textarea
                                                                                className="w-full text-sm text-gray-500 bg-transparent border border-transparent hover:border-gray-200 rounded-lg px-2 py-1 -ml-2 focus:ring-2 focus:ring-indigo-500/20 outline-none focus:bg-white transition-all resize-y"
                                                                                value={task.workContent}
                                                                                rows={1}
                                                                                placeholder={t('table.description')}
                                                                                onChange={(e) => handleTaskChange(phase, task.id, 'workContent', e.target.value)}
                                                                            />
                                                                        </div>
                                                                    ) : (
                                                                        <p
                                                                            className="text-sm text-gray-500 leading-relaxed cursor-pointer hover:text-gray-700 line-clamp-2"
                                                                            onClick={() => onTaskClick && onTaskClick(phase.id, task.id)}
                                                                        >
                                                                            {task.workContent}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Remarks & Links Row */}
                                                            <div className="flex flex-wrap gap-2 items-center mt-1 ml-0">
                                                                {task.remarks.map(remark => (
                                                                    <div
                                                                        key={remark.id}
                                                                        className={`flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-medium ${remark.isWarning ? 'bg-rose-50 border-rose-100 text-rose-600' : 'bg-blue-50 border-blue-100 text-blue-600'}`}
                                                                    >
                                                                        {remark.isWarning ? <AlertCircle size={10} /> : <AlertCircle size={10} className="rotate-180" />}
                                                                        <span>{remark.text}</span>
                                                                        {isEditing && (
                                                                            <button onClick={() => deleteRemark(phase, task.id, remark.id)} className="text-gray-400 hover:text-rose-600 ml-0.5">
                                                                                <X size={10} />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                ))}

                                                                {/* Quick Actions (Edit Mode) */}
                                                                {isEditing && (
                                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                                                        {addingRemarkTo === task.id ? (
                                                                            <div className="flex gap-1 items-center animate-in fade-in duration-200 bg-white border border-indigo-200 rounded p-1 shadow-lg z-20 absolute">
                                                                                <select className="text-[10px] border rounded bg-gray-50 p-1 h-6 outline-none" value={newRemarkType ? 'warn' : 'note'} onChange={(e) => setNewRemarkType(e.target.value === 'warn')}>
                                                                                    <option value="note">Note</option>
                                                                                    <option value="warn">Warn</option>
                                                                                </select>
                                                                                <input
                                                                                    autoFocus
                                                                                    className="w-32 text-[10px] border rounded p-1 h-6 outline-none focus:border-indigo-500"
                                                                                    placeholder="Remark..."
                                                                                    value={newRemarkText}
                                                                                    onChange={(e) => setNewRemarkText(e.target.value)}
                                                                                    onKeyDown={(e) => { if (e.key === 'Enter') addRemark(phase, task.id); }}
                                                                                />
                                                                                <button onClick={() => addRemark(phase, task.id)} className="bg-indigo-600 text-white p-1 rounded h-6 w-6 flex items-center justify-center hover:bg-indigo-700"><Plus size={10} /></button>
                                                                                <button onClick={() => setAddingRemarkTo(null)} className="text-gray-400 hover:text-gray-600 p-1"><X size={10} /></button>
                                                                            </div>
                                                                        ) : (
                                                                            <button onClick={() => setAddingRemarkTo(task.id)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Add Remark">
                                                                                <Plus size={14} />
                                                                            </button>
                                                                        )}

                                                                        <div className="h-3 w-px bg-gray-200 mx-1"></div>

                                                                        <div className="relative">
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setActiveAttachmentTask(task.id);
                                                                                }}
                                                                                className={`p-1.5 rounded-lg transition-all duration-200 border ${activeAttachmentTask === task.id
                                                                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md scale-105'
                                                                                    : totalLinks > 0
                                                                                        ? 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:border-indigo-300'
                                                                                        : 'bg-transparent text-gray-400 border-transparent hover:bg-gray-100'
                                                                                    }`}
                                                                                title={`Attachments / Links (${totalLinks})`}
                                                                            >
                                                                                <Paperclip size={14} />
                                                                            </button>
                                                                        </div>

                                                                        <div className="relative">
                                                                            <button
                                                                                onClick={() => setActiveDepTask(isDepOpen ? null : task.id)}
                                                                                className={`p-1.5 rounded-lg transition-all duration-200 border ${isDepOpen
                                                                                    ? 'bg-amber-500 text-white border-amber-500 shadow-md scale-105'
                                                                                    : hasDeps
                                                                                        ? 'bg-amber-50 text-amber-600 border-amber-200 hover:border-amber-300'
                                                                                        : 'bg-transparent text-gray-400 border-transparent hover:bg-gray-100'
                                                                                    }`}
                                                                                title="Dependencies"
                                                                            >
                                                                                <LinkIcon size={14} />
                                                                            </button>
                                                                            {isDepOpen && (
                                                                                <div className="absolute bottom-full left-0 mb-2 w-64 bg-white rounded-xl shadow-xl border border-gray-200 z-50 p-3 animate-in fade-in zoom-in-95">
                                                                                    <h5 className="text-xs font-bold mb-2 text-gray-700">{t('table.wait_tasks')}</h5>
                                                                                    <div className="max-h-40 overflow-y-auto space-y-1 custom-scrollbar">
                                                                                        {getAllTasks().filter(t => t.id !== task.id).map(t => (
                                                                                            <div key={t.id} onClick={() => toggleDependency(phase, task.id, t.id)} className={`text-xs p-1.5 rounded cursor-pointer flex items-center gap-2 ${task.dependencies.includes(t.id) ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'hover:bg-gray-50 text-gray-600'}`}>
                                                                                                <div className={`w-3 h-3 rounded border flex items-center justify-center ${task.dependencies.includes(t.id) ? 'bg-amber-500 border-amber-500' : 'border-gray-300'}`}>{task.dependencies.includes(t.id) && <CheckCircle2 size={10} className="text-white" />}</div>
                                                                                                <span className="truncate">{t.subTaskName}</span>
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Total Links Badge - Visible when not editing to give overview */}
                                                                {totalLinks > 0 && !isEditing && (
                                                                    <span className="flex items-center gap-1 px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[10px] font-bold border border-indigo-100">
                                                                        <Paperclip size={10} /> {totalLinks}
                                                                    </span>
                                                                )}
                                                                {hasDeps && !isEditing && (
                                                                    <span className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded text-[10px] font-bold border border-amber-100">
                                                                        <LinkIcon size={10} /> {task.dependencies.length}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Right Column: Meta Data Grid */}
                                                        <div className="w-full lg:w-[420px] shrink-0 border-l border-gray-100 pl-6 lg:pl-8 flex flex-col justify-center">
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">

                                                                {/* Status */}
                                                                <div className="group/field relative rounded-lg p-1.5 -m-1.5 hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-200">
                                                                    <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">{t('table.status')}</label>
                                                                    <div
                                                                        className={`${isEditing ? 'cursor-pointer' : ''} flex items-center justify-between`}
                                                                        onClick={(e) => {
                                                                            if (!isEditing) return;
                                                                            e.stopPropagation();
                                                                            setActivePopup({ type: 'status', taskId: task.id, phaseId: phase.id, rect: e.currentTarget.getBoundingClientRect() });
                                                                        }}
                                                                    >
                                                                        <StatusBadge status={task.status} />
                                                                        {isEditing && <ChevronDown size={14} className="text-gray-400 opacity-0 group-hover/field:opacity-100 transition-opacity" />}
                                                                    </div>
                                                                </div>

                                                                {/* Assigned To */}
                                                                <div className="group/field relative rounded-lg p-1.5 -m-1.5 hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-200">
                                                                    <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">{t('table.assigned_to')}</label>

                                                                    <div
                                                                        className={`flex items-center gap-2 justify-between ${isEditing ? 'cursor-pointer' : ''}`}
                                                                        onClick={(e) => {
                                                                            if (!isEditing) return;
                                                                            e.stopPropagation();
                                                                            setActivePopup({ type: 'owner', taskId: task.id, phaseId: phase.id, rect: e.currentTarget.getBoundingClientRect() });
                                                                        }}
                                                                    >
                                                                        <div className="flex items-center gap-2">
                                                                            {ownerInfo.avatar !== '?' ? (
                                                                                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shadow-sm ${ownerInfo.color}`}>
                                                                                    {ownerInfo.avatar}
                                                                                </div>
                                                                            ) : (
                                                                                <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 border border-gray-200">
                                                                                    <User size={12} />
                                                                                </div>
                                                                            )}
                                                                            <span className="text-xs font-semibold text-gray-700 truncate">{task.owner}</span>
                                                                        </div>
                                                                        {isEditing && <ChevronDown size={14} className="text-gray-400 opacity-0 group-hover/field:opacity-100 transition-opacity" />}
                                                                    </div>
                                                                </div>

                                                                {/* Priority */}
                                                                <div className="group/field relative rounded-lg p-1.5 -m-1.5 hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-200">
                                                                    <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">{t('table.priority')}</label>
                                                                    <div
                                                                        className={`flex items-center justify-between ${isEditing ? 'cursor-pointer' : ''}`}
                                                                        onClick={(e) => {
                                                                            if (!isEditing) return;
                                                                            e.stopPropagation();
                                                                            setActivePopup({ type: 'priority', taskId: task.id, phaseId: phase.id, rect: e.currentTarget.getBoundingClientRect() });
                                                                        }}
                                                                    >
                                                                        <PriorityBadge score={task.score} />
                                                                        {isEditing && <ChevronDown size={14} className="text-gray-400 opacity-0 group-hover/field:opacity-100 transition-opacity" />}
                                                                    </div>
                                                                </div>

                                                                {/* Schedule */}
                                                                <div className="group/field relative rounded-lg p-1.5 -m-1.5 hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-200 flex flex-col gap-1.5">
                                                                    <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">{t('table.schedule')}</label>

                                                                    <button
                                                                        onClick={(e) => {
                                                                            if (!isEditing) return;
                                                                            e.stopPropagation();
                                                                            setActivePopup({ type: 'date', taskId: task.id, phaseId: phase.id, rect: e.currentTarget.getBoundingClientRect() });
                                                                        }}
                                                                        className={`w-full text-left flex items-center gap-2 outline-none justify-between ${isEditing ? 'cursor-pointer' : 'cursor-default'}`}
                                                                    >
                                                                        <div className="flex items-center gap-2">
                                                                            <Calendar size={14} className={`${overdueDays ? 'text-rose-500' : 'text-gray-400'}`} />
                                                                            <span className={`text-xs font-mono ${overdueDays ? 'text-rose-600 font-bold' : 'text-gray-600 font-medium'}`}>
                                                                                {task.startDate} <span className="text-gray-300 mx-1">→</span> {task.endDate}
                                                                            </span>
                                                                        </div>
                                                                    </button>

                                                                    {/* Overdue Badge Below Date */}
                                                                    {overdueDays && (
                                                                        <span className="flex items-center gap-1 text-[9px] text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100 w-fit animate-pulse">
                                                                            <AlertCircle size={10} /> {overdueDays}d late
                                                                        </span>
                                                                    )}
                                                                </div>

                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Delete Task (Hover) */}
                                                    {isEditing && (
                                                        <button
                                                            onClick={() => handleDeleteTask(phase, task.id)}
                                                            className="absolute top-4 right-4 p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                            title={t('common.delete')}
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            )
                                        })
                                    )}
                                </div>
                            )}
                        </div>
                    )
                })}

                {/* Fixed Overlay for Attachments */}
                {activeTaskForAttachments && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={() => setActiveAttachmentTask(null)}>
                        <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-80 overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[60vh]" onClick={e => e.stopPropagation()}>
                            {/* Header */}
                            <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
                                <div>
                                    <h3 className="text-xs font-bold uppercase text-gray-500 tracking-wider">Manage Links</h3>
                                    <p className="text-[10px] text-gray-400 truncate max-w-[200px]">{activeTaskForAttachments.subTaskName}</p>
                                </div>
                                <button onClick={() => setActiveAttachmentTask(null)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
                            </div>

                            {/* Tabs */}
                            <div className="flex border-b border-gray-100 shrink-0">
                                <button onClick={() => setAttachTab('link')} className={`flex-1 py-2 text-xs font-bold ${attachTab === 'link' ? 'bg-white text-indigo-600 border-b-2 border-indigo-500' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>External Link</button>
                                <button onClick={() => setAttachTab('doc')} className={`flex-1 py-2 text-xs font-bold ${attachTab === 'doc' ? 'bg-white text-indigo-600 border-b-2 border-indigo-500' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>Wiki Doc</button>
                            </div>

                            {/* Content */}
                            <div className="p-4 overflow-y-auto custom-scrollbar flex-1">
                                <div className="space-y-2 mb-4">
                                    {activeTaskForAttachments.attachments.length === 0 && activeTaskForAttachments.linkedDocIds?.length === 0 && (
                                        <div className="text-center py-4 text-xs text-gray-400 italic">No links added yet.</div>
                                    )}

                                    {activeTaskForAttachments.attachments.map(att => (
                                        <div key={att.id} className="flex items-center justify-between text-xs bg-white border border-gray-200 p-2 rounded group/item">
                                            <a href={att.url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline truncate flex-1 flex items-center gap-1">
                                                <ExternalLink size={10} /> {att.name}
                                            </a>
                                            <button onClick={() => deleteAttachment(att.id)} className="text-gray-300 hover:text-red-500"><X size={12} /></button>
                                        </div>
                                    ))}
                                    {activeTaskForAttachments.linkedDocIds?.map(docId => {
                                        const doc = docs.find(d => d.id === docId);
                                        if (!doc) return null;
                                        return (
                                            <div
                                                key={docId}
                                                className="flex items-center justify-between text-xs bg-white border border-gray-200 p-2 rounded group/item cursor-pointer hover:border-indigo-300 hover:shadow-sm transition-all"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (onOpenDoc) onOpenDoc(docId);
                                                }}
                                            >
                                                <span className="text-gray-700 flex-1 flex items-center gap-1 truncate"><FileText size={10} className="text-indigo-500" /> {doc.title}</span>
                                                <button onClick={(e) => { e.stopPropagation(); toggleDocLink(docId); }} className="text-gray-300 hover:text-red-500"><X size={12} /></button>
                                            </div>
                                        )
                                    })}
                                </div>

                                {attachTab === 'link' ? (
                                    <div className="space-y-2 border-t border-gray-100 pt-3">
                                        <input className="w-full text-xs border rounded p-2 outline-none focus:border-indigo-500" placeholder={t('table.link_name')} value={newAttachName} onChange={e => setNewAttachName(e.target.value)} />
                                        <input className="w-full text-xs border rounded p-2 outline-none focus:border-indigo-500" placeholder={t('table.link_url')} value={newAttachUrl} onChange={e => setNewAttachUrl(e.target.value)} />
                                        <button onClick={addAttachment} className="w-full bg-indigo-600 text-white text-xs rounded py-2 hover:bg-indigo-700 font-bold shadow-sm mt-1">{t('table.add_link')}</button>
                                    </div>
                                ) : (
                                    <div className="border-t border-gray-100 pt-2 space-y-1">
                                        {docs.map(doc => (
                                            <div key={doc.id} onClick={() => toggleDocLink(doc.id)} className={`flex items-center gap-2 p-1.5 rounded cursor-pointer text-xs ${activeTaskForAttachments.linkedDocIds?.includes(doc.id) ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-50 text-gray-600'}`}>
                                                <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${activeTaskForAttachments.linkedDocIds?.includes(doc.id) ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-gray-300'}`}>{activeTaskForAttachments.linkedDocIds?.includes(doc.id) && <CheckCircle2 size={8} />}</div>
                                                <span className="truncate">{doc.icon} {doc.title}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Fixed Portal Popup for Date/Status/Owner to prevent clipping */}
                {activePopup && popupTaskData?.phase && popupTaskData?.task && (
                    <div className="fixed inset-0 z-[100]" onClick={() => setActivePopup(null)}>
                        <div
                            className="absolute bg-white shadow-2xl border border-gray-200 rounded-xl animate-in fade-in zoom-in-95 overflow-hidden p-1"
                            style={{
                                top: Math.min(window.innerHeight - 300, activePopup.rect.bottom + 4), // Prevent falling off screen
                                left: Math.min(window.innerWidth - 250, activePopup.rect.left),
                                minWidth: Math.max(200, activePopup.rect.width)
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {activePopup.type === 'status' && (
                                <div className="p-1 space-y-1">
                                    {Object.values(TaskStatus).map(s => (
                                        <div
                                            key={s}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${popupTaskData.task.status === s ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
                                            onClick={() => {
                                                handleTaskChange(popupTaskData.phase!, popupTaskData.task!.id, 'status', s);
                                                setActivePopup(null);
                                            }}
                                        >
                                            <StatusBadge status={s} />
                                            {popupTaskData.task.status === s && <CheckCircle2 size={14} className="ml-auto text-indigo-600" />}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {activePopup.type === 'owner' && (
                                <div className="p-1 space-y-1 max-h-60 overflow-y-auto custom-scrollbar">
                                    {teamMembers.map(m => (
                                        <div
                                            key={m.id}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${popupTaskData.task.owner === m.name ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
                                            onClick={() => {
                                                handleTaskChange(popupTaskData.phase!, popupTaskData.task!.id, 'owner', m.name);
                                                setActivePopup(null);
                                            }}
                                        >
                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm ${m.color}`}>
                                                {m.avatar}
                                            </div>
                                            <span className="text-xs font-bold text-gray-700">{m.name}</span>
                                            {popupTaskData.task.owner === m.name && <CheckCircle2 size={14} className="ml-auto text-indigo-600" />}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {activePopup.type === 'priority' && (
                                <div className="p-1 space-y-1">
                                    {['High', 'Med', 'Low'].map(s => (
                                        <div
                                            key={s}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${popupTaskData.task.score === s ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
                                            onClick={() => {
                                                handleTaskChange(popupTaskData.phase!, popupTaskData.task!.id, 'score', s);
                                                setActivePopup(null);
                                            }}
                                        >
                                            <PriorityBadge score={s} />
                                            {popupTaskData.task.score === s && <CheckCircle2 size={14} className="ml-auto text-indigo-600" />}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {activePopup.type === 'date' && (
                                <div className="p-3 w-64">
                                    <div className="space-y-3">
                                        <div>
                                            <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Start</span>
                                            <input type="date" className="w-full text-xs border rounded p-2 bg-gray-50 focus:bg-white outline-none focus:border-indigo-500 transition-colors" value={toInputDate(popupTaskData.task.startDate)} onChange={e => handleTaskChange(popupTaskData.phase!, popupTaskData.task!.id, 'startDate', fromInputDate(e.target.value))} />
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">End</span>
                                            <input type="date" className="w-full text-xs border rounded p-2 bg-gray-50 focus:bg-white outline-none focus:border-indigo-500 transition-colors" value={toInputDate(popupTaskData.task.endDate)} onChange={e => handleTaskChange(popupTaskData.phase!, popupTaskData.task!.id, 'endDate', fromInputDate(e.target.value))} />
                                        </div>
                                        <button onClick={() => setActivePopup(null)} className="w-full bg-indigo-600 text-white text-xs font-bold py-2 rounded-lg hover:bg-indigo-700 shadow-sm mt-1">Done</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};
