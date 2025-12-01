
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ProjectTask, TeamMember, TaskChecklistItem, TaskComment, TaskStatus, ProjectDoc, ProjectPhase } from '../types';
import { X, CheckSquare, Square, Trash2, Sparkles, Send, User, Loader2, Clock, Paperclip, Link as LinkIcon, Save, RotateCcw, Calendar, FileText, Cloud, CheckCircle2, Circle, Timer, AlertTriangle, CalendarClock, Flag, ChevronDown, Layers, MessageSquare } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { breakdownTask } from '../services/geminiService';
import { useToast } from '../contexts/ToastContext';
import { toInputDate, fromInputDate } from '../utils';

interface TaskDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    task: ProjectTask;
    phaseName?: string;
    phases?: ProjectPhase[];
    onUpdateTask: (updatedTask: ProjectTask) => void;
    onMoveTask?: (taskId: string, newPhaseId: string) => void;
    teamMembers: TeamMember[];
    projectDocs?: ProjectDoc[];
    onOpenDoc?: (docId: string) => void;
}

// Internal CustomSelect Component
interface SelectOption {
    value: string;
    label: string;
    icon?: React.ReactNode;
    color?: string;
}

interface CustomSelectProps {
    value: string;
    onChange: (value: string) => void;
    options: SelectOption[];
    renderTrigger?: (selectedOption: SelectOption | undefined) => React.ReactNode;
}

const CustomSelect: React.FC<CustomSelectProps> = ({ value, onChange, options, renderTrigger }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(o => o.value === value);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    return (
        <div className="relative w-full" ref={containerRef}>
            <div onClick={() => setIsOpen(!isOpen)}>
                {renderTrigger ? renderTrigger(selectedOption) : (
                    <div className="flex items-center justify-between border rounded px-3 py-2 cursor-pointer bg-white">
                        <span>{selectedOption?.label || value}</span>
                        <ChevronDown size={14} />
                    </div>
                )}
            </div>
            {isOpen && (
                <div className="absolute top-full left-0 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto p-1">
                    {options.map(opt => (
                        <div
                            key={opt.value}
                            onClick={() => { onChange(opt.value); setIsOpen(false); }}
                            className={`flex items-center gap-2 px-3 py-2 text-sm rounded cursor-pointer hover:bg-gray-50 ${opt.value === value ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-700'}`}
                        >
                            {opt.icon && <span className={opt.color}>{opt.icon}</span>}
                            <span>{opt.label}</span>
                            {opt.value === value && <CheckCircle2 size={14} className="ml-auto text-indigo-600" />}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({ 
    isOpen, 
    onClose, 
    task, 
    phaseName,
    phases,
    onUpdateTask, 
    onMoveTask,
    teamMembers, 
    projectDocs = [], 
    onOpenDoc 
}) => {
    const { t } = useLanguage();
    const { addToast } = useToast();

    const [editedTask, setEditedTask] = useState<ProjectTask | null>(null);
    const [hasChanges, setHasChanges] = useState(false);

    const [newItemText, setNewItemText] = useState('');
    const [newComment, setNewComment] = useState('');
    const [isBreakingDown, setIsBreakingDown] = useState(false);

    // Doc linking state
    const [isDocSearchOpen, setIsDocSearchOpen] = useState(false);
    const [docSearchQuery, setDocSearchQuery] = useState('');

    useEffect(() => {
        if (task) {
            setEditedTask(task);
            setHasChanges(false);
        }
    }, [task]);

    if (!isOpen || !editedTask) return null;

    const updateField = (updates: Partial<ProjectTask>) => {
        setEditedTask(prev => prev ? ({ ...prev, ...updates }) : null);
        setHasChanges(true);
    };

    const handleSave = () => {
        if (editedTask) {
            onUpdateTask(editedTask);
            addToast(t('common.save'), 'success');
            onClose();
        }
    };

    const handleCancel = () => {
        if (hasChanges && !confirm('Discard unsaved changes?')) {
            return;
        }
        onClose();
    };

    const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        updateField({ workContent: e.target.value });
        // Auto-grow
        e.target.style.height = 'auto';
        e.target.style.height = e.target.scrollHeight + 'px';
    };

    const handlePhaseChange = (newPhaseId: string) => {
        if (onMoveTask && task) {
            onMoveTask(task.id, newPhaseId);
        }
    };

    const toggleCheckItem = (itemId: string) => {
        if (!editedTask) return;
        const updatedChecklist = editedTask.checklist.map(item =>
            item.id === itemId ? { ...item, isCompleted: !item.isCompleted } : item
        );
        updateField({ checklist: updatedChecklist });
    };

    const addCheckItem = () => {
        if (!newItemText.trim() || !editedTask) return;
        const newItem: TaskChecklistItem = {
            id: `cl-${Date.now()}`,
            text: newItemText,
            isCompleted: false
        };
        updateField({ checklist: [...editedTask.checklist, newItem] });
        setNewItemText('');
    };

    const deleteCheckItem = (itemId: string) => {
        if (!editedTask) return;
        updateField({ checklist: editedTask.checklist.filter(i => i.id !== itemId) });
    };

    const handleAIBreakdown = async () => {
        if (!editedTask) return;
        setIsBreakingDown(true);
        try {
            const savedConfig = localStorage.getItem('project_ai_config');
            const config = savedConfig ? JSON.parse(savedConfig) : undefined;

            const subItems = await breakdownTask(editedTask.subTaskName, editedTask.workContent, config);

            const newItems: TaskChecklistItem[] = subItems.map((text, idx) => ({
                id: `ai-cl-${Date.now()}-${idx}`,
                text,
                isCompleted: false
            }));

            updateField({ checklist: [...editedTask.checklist, ...newItems] });
            addToast(t('task.ai_checklist_success'), 'success');
        } catch (error) {
            console.error(error);
            addToast(t('task.ai_checklist_fail'), 'error');
        } finally {
            setIsBreakingDown(false);
        }
    };

    const addComment = () => {
        if (!newComment.trim() || !editedTask) return;
        const comment: TaskComment = {
            id: `cm-${Date.now()}`,
            text: newComment,
            author: 'Me', // Ideally current user
            timestamp: new Date().toISOString(),
            avatar: 'ME',
            color: 'bg-indigo-100 text-indigo-700'
        };
        updateField({ comments: [...editedTask.comments, comment] });
        setNewComment('');
    };

    // Link Doc Logic
    const linkDoc = (docId: string) => {
        if (!editedTask) return;
        const currentLinks = editedTask.linkedDocIds || [];
        if (!currentLinks.includes(docId)) {
            updateField({ linkedDocIds: [...currentLinks, docId] });
        }
        setIsDocSearchOpen(false);
    };

    const unlinkDoc = (docId: string) => {
        if (!editedTask) return;
        const currentLinks = editedTask.linkedDocIds || [];
        updateField({ linkedDocIds: currentLinks.filter(id => id !== docId) });
    };

    const getProgress = () => {
        if (!editedTask || editedTask.checklist.length === 0) return 0;
        const completed = editedTask.checklist.filter(i => i.isCompleted).length;
        return Math.round((completed / editedTask.checklist.length) * 100);
    };

    const filteredDocs = projectDocs.filter(d => d.title.toLowerCase().includes(docSearchQuery.toLowerCase()));

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    const getOverdueDays = (endDate: string) => {
        if (!endDate || endDate === '-') return 0;
        // Assuming YYYY/MM/DD from utils.toInputDate/fromInputDate logic or standard date
        const endDateObj = new Date(endDate.replace(/\//g, '-')); 
        if (isNaN(endDateObj.getTime())) return 0;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        endDateObj.setHours(0, 0, 0, 0);

        if (today > endDateObj && editedTask?.status !== TaskStatus.Completed) {
            const diffTime = Math.abs(today.getTime() - endDateObj.getTime());
            return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }
        return 0;
    };

    return createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-0 md:p-6 animate-in fade-in duration-200">
            <div className="bg-white w-full h-full md:h-auto md:max-w-5xl md:rounded-2xl shadow-2xl flex flex-col md:max-h-[90vh] overflow-hidden">

                {/* Header */}
                <div className="flex items-start justify-between p-5 border-b border-gray-200 bg-gray-50 shrink-0">
                    <div className="flex-1 min-w-0 mr-4">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-mono text-gray-400 uppercase tracking-wider">{editedTask.id}</span>
                            <div className={`text-[10px] px-2 py-0.5 rounded-full font-bold border
                                ${editedTask.status === TaskStatus.Completed ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                                    editedTask.status === TaskStatus.InProgress ? 'bg-blue-50 border-blue-200 text-blue-700' :
                                        editedTask.status === TaskStatus.Delayed ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-gray-100 border-gray-200 text-gray-600'
                                }
                            `}>
                                {t(`status.${editedTask.status}`)}
                            </div>
                            {hasChanges && (
                                <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold animate-pulse">
                                    Unsaved Changes
                                </span>
                            )}
                        </div>
                        <input
                            className="text-2xl font-bold text-gray-800 bg-transparent border border-transparent hover:border-gray-300 rounded px-1 -ml-1 w-full outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                            value={editedTask.subTaskName}
                            onChange={(e) => updateField({ subTaskName: e.target.value })}
                        />
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleCancel}
                            className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!hasChanges}
                            className={`flex items-center gap-2 px-6 py-2 text-sm font-bold text-white rounded-lg shadow-md transition-all ${hasChanges
                                ? 'bg-indigo-600 hover:bg-indigo-700 hover:scale-105'
                                : 'bg-gray-400 cursor-not-allowed opacity-70'
                                }`}
                        >
                            <Save size={16} /> {t('common.save')}
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                    {/* Left Column: Description, Attachments, Checklist */}
                    <div className="flex-1 p-6 overflow-y-auto border-r border-gray-200 custom-scrollbar bg-white">
                        
                        {/* Description */}
                        <div className="mb-8">
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">{t('table.description')}</label>
                            <textarea
                                className="w-full min-h-[120px] text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-3 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none resize-y leading-relaxed"
                                value={editedTask.workContent}
                                onChange={handleContentChange}
                                placeholder={t('task.add_desc')}
                            />

                            {editedTask.attachments && editedTask.attachments.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-3">
                                    {editedTask.attachments.map(att => (
                                        <a key={att.id} href={att.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded border border-indigo-100 hover:bg-indigo-100">
                                            <Paperclip size={12} /> {att.name}
                                        </a>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Linked Docs */}
                        <div className="mb-8">
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">{t('task.linked_docs')}</label>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {(editedTask.linkedDocIds || []).map(docId => {
                                    const doc = projectDocs.find(d => d.id === docId);
                                    if (!doc) return null;
                                    return (
                                        <div
                                            key={docId}
                                            className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-sm shadow-sm hover:bg-gray-50 cursor-pointer"
                                            onClick={() => onOpenDoc && onOpenDoc(docId)}
                                        >
                                            <span>{doc.icon}</span>
                                            <span className="font-medium">{doc.title}</span>
                                            {doc.externalUrl && <Cloud size={12} className="text-gray-400" />}
                                            <button onClick={(e) => { e.stopPropagation(); unlinkDoc(docId); }} className="text-gray-400 hover:text-red-500 ml-1">
                                                <X size={14} />
                                            </button>
                                        </div>
                                    )
                                })}
                                <div className="relative">
                                    <button
                                        onClick={() => setIsDocSearchOpen(!isDocSearchOpen)}
                                        className="flex items-center gap-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-1.5 rounded-lg transition-colors"
                                    >
                                        <FileText size={14} /> Link Doc
                                    </button>

                                    {isDocSearchOpen && (
                                        <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-xl z-50 p-2">
                                            <input
                                                autoFocus
                                                className="w-full text-xs border rounded p-1 mb-2"
                                                placeholder={t('task.link_doc_placeholder')}
                                                value={docSearchQuery}
                                                onChange={e => setDocSearchQuery(e.target.value)}
                                            />
                                            <div className="max-h-40 overflow-y-auto space-y-1">
                                                {filteredDocs.map(d => (
                                                    <div
                                                        key={d.id}
                                                        onClick={() => linkDoc(d.id)}
                                                        className="flex items-center gap-2 p-1.5 hover:bg-gray-50 rounded cursor-pointer text-xs"
                                                    >
                                                        <span>{d.icon}</span>
                                                        <span className="truncate">{d.title}</span>
                                                    </div>
                                                ))}
                                                {filteredDocs.length === 0 && <div className="text-center text-gray-400 text-xs py-2">{t('task.no_docs')}</div>}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Checklist */}
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                        <CheckSquare size={18} className="text-indigo-600" />
                                        {t('task.checklist')}
                                    </h3>
                                    <span className="text-xs text-gray-400 font-medium">
                                        {getProgress()}% Done
                                    </span>
                                </div>
                                <button
                                    onClick={handleAIBreakdown}
                                    disabled={isBreakingDown}
                                    className="text-xs flex items-center gap-1 bg-gradient-to-r from-violet-500 to-indigo-500 text-white px-3 py-1.5 rounded-full hover:shadow-md transition-all disabled:opacity-50"
                                >
                                    {isBreakingDown ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} className="text-yellow-300" />}
                                    {t('task.ai_breakdown')}
                                </button>
                            </div>

                            <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden mb-4">
                                <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${getProgress()}%` }}></div>
                            </div>

                            <div className="space-y-2">
                                {editedTask.checklist.map(item => (
                                    <div key={item.id} className="group flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                                        <button
                                            onClick={() => toggleCheckItem(item.id)}
                                            className={`mt-0.5 text-gray-400 hover:text-indigo-600 transition-colors ${item.isCompleted ? 'text-emerald-500 hover:text-emerald-600' : ''}`}
                                        >
                                            {item.isCompleted ? <CheckSquare size={18} /> : <Square size={18} />}
                                        </button>
                                        <span className={`flex-1 text-sm ${item.isCompleted ? 'text-gray-400 line-through decoration-gray-300' : 'text-gray-700'}`}>
                                            {item.text}
                                        </span>
                                        <button onClick={() => deleteCheckItem(item.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}

                                <div className="flex items-center gap-3 p-2">
                                    <div className="text-gray-300"><Square size={18} /></div>
                                    <input
                                        className="flex-1 text-sm bg-transparent border-b border-gray-200 py-1 focus:border-indigo-500 outline-none placeholder-gray-400 transition-colors"
                                        placeholder={t('task.enter_item')}
                                        value={newItemText}
                                        onChange={(e) => setNewItemText(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && addCheckItem()}
                                    />
                                    <button onClick={addCheckItem} className="text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded">{t('common.add')}</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Meta Data, Comments */}
                    <div className="w-full md:w-96 flex flex-col bg-gray-50/50 shrink-0">
                        <div className="p-6 border-b border-gray-200 space-y-6 bg-white">
                            
                            {/* Phase Selector (Added back) */}
                            {phases && (
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">{t('task.phase')}</label>
                                    <CustomSelect
                                        value={phases.find(p => p.name === phaseName)?.id || ''}
                                        onChange={(val) => handlePhaseChange(val)}
                                        options={phases.map(p => ({
                                            value: p.id,
                                            label: p.name,
                                            icon: <Layers size={16} className="text-gray-500" />
                                        }))}
                                    />
                                </div>
                            )}

                            {/* Status Section */}
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">{t('table.status')}</label>
                                <CustomSelect
                                    value={editedTask.status}
                                    onChange={(val) => updateField({ status: val as TaskStatus })}
                                    options={Object.values(TaskStatus).map(s => ({
                                        value: s,
                                        label: t(`status.${s}`),
                                        icon: s === TaskStatus.Completed ? <CheckCircle2 size={16} /> :
                                            s === TaskStatus.InProgress ? <Timer size={16} /> :
                                                s === TaskStatus.Delayed ? <AlertTriangle size={16} /> :
                                                    <Circle size={16} />,
                                        color: s === TaskStatus.Completed ? 'text-emerald-600' :
                                            s === TaskStatus.InProgress ? 'text-blue-600' :
                                                s === TaskStatus.Delayed ? 'text-rose-600' :
                                                    'text-slate-600'
                                    }))}
                                    renderTrigger={(option) => (
                                        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all cursor-pointer hover:border-indigo-300 hover:bg-gray-50
                                        ${editedTask.status === TaskStatus.Completed ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                                                editedTask.status === TaskStatus.InProgress ? 'bg-blue-50 border-blue-200 text-blue-700' :
                                                    editedTask.status === TaskStatus.Delayed ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-gray-50 border-gray-200 text-gray-600'
                                            }
                                    `}>
                                            {editedTask.status === TaskStatus.Completed && <CheckCircle2 size={16} />}
                                            {editedTask.status === TaskStatus.InProgress && <Timer size={16} />}
                                            {editedTask.status === TaskStatus.Delayed && <AlertTriangle size={16} />}
                                            {editedTask.status === TaskStatus.Pending && <Circle size={16} />}
                                            <span className="flex-1">{t(`status.${editedTask.status}`)}</span>
                                            <ChevronDown size={14} className="opacity-50" />
                                        </div>
                                    )}
                                />
                            </div>

                            {/* Priority Section */}
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">{t('table.priority')}</label>
                                <CustomSelect
                                    value={editedTask.score}
                                    onChange={(val) => updateField({ score: val })}
                                    options={['Low', 'Med', 'High'].map(p => ({
                                        value: p,
                                        label: t(`priority.${p}`) || p,
                                        icon: <Flag size={16} className={p === 'High' ? 'fill-current' : ''} />,
                                        color: p === 'High' ? 'text-red-600' :
                                            p === 'Med' ? 'text-amber-600' :
                                                'text-blue-600'
                                    }))}
                                    renderTrigger={(option) => (
                                        <div className={`px-3 py-2 rounded-lg text-sm font-bold border flex items-center gap-2 transition-all cursor-pointer hover:border-indigo-300 hover:bg-gray-50
                                        ${editedTask.score === 'High' ? 'bg-red-50 border-red-100 text-red-600' :
                                                editedTask.score === 'Med' ? 'bg-amber-50 border-amber-100 text-amber-600' :
                                                    'bg-blue-50 border-blue-100 text-blue-600'}
                                        `}>
                                            <Flag size={16} className={editedTask.score === 'High' ? 'fill-current' : ''} />
                                            <span className="flex-1">{option?.label || editedTask.score}</span>
                                            <ChevronDown size={14} className="opacity-50" />
                                        </div>
                                    )}
                                />
                            </div>

                            {/* Schedule Section */}
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">{t('table.schedule')}</label>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 p-2 rounded-lg border border-transparent hover:border-gray-200 hover:bg-gray-50 transition-all group">
                                        <Calendar size={16} className="text-gray-400 shrink-0" />
                                        <div className="flex items-center gap-2 flex-1 min-w-0 text-sm">
                                            <input
                                                type="date"
                                                className="flex-1 bg-transparent border-none p-0 text-gray-600 font-mono text-xs focus:ring-0 cursor-pointer"
                                                value={toInputDate(editedTask.startDate)}
                                                onChange={e => updateField({ startDate: fromInputDate(e.target.value) })}
                                            />
                                            <span className="text-gray-400">→</span>
                                            <input
                                                type="date"
                                                className={`flex-1 bg-transparent border-none p-0 font-mono text-xs focus:ring-0 cursor-pointer ${getOverdueDays(editedTask.endDate) > 0 ? 'text-red-600 font-bold' : 'text-gray-600'}`}
                                                value={toInputDate(editedTask.endDate)}
                                                onChange={e => updateField({ endDate: fromInputDate(e.target.value) })}
                                            />
                                        </div>
                                    </div>
                                    {getOverdueDays(editedTask.endDate) > 0 && (
                                        <div className="inline-flex items-center gap-1.5 bg-red-50 text-red-600 px-2 py-1 rounded text-[10px] font-bold border border-red-100">
                                            <CalendarClock size={12} />
                                            Overdue {getOverdueDays(editedTask.endDate)} days
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Assigned To Section */}
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">{t('table.assigned_to')}</label>
                                <CustomSelect
                                    value={editedTask.owner}
                                    onChange={(val) => updateField({ owner: val })}
                                    options={teamMembers.map(m => ({
                                        value: m.name,
                                        label: m.name,
                                        icon: (
                                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold border border-white shrink-0 ${m.color}`}>
                                                {getInitials(m.name)}
                                            </div>
                                        )
                                    }))}
                                    renderTrigger={(option) => (
                                        <div className="flex items-center gap-3 px-3 py-2 rounded-lg border border-transparent group-hover:border-indigo-200 group-hover:bg-indigo-50 transition-colors cursor-pointer bg-white border-gray-200">
                                            {option?.icon || <User size={16} className="text-gray-400" />}
                                            <span className="text-sm font-medium text-gray-700 flex-1">{editedTask.owner}</span>
                                            <ChevronDown size={14} className="text-gray-400" />
                                        </div>
                                    )}
                                />
                            </div>
                        </div>

                        {/* Activity/Comments Section */}
                        <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
                            <div className="p-4 border-b border-gray-200 flex items-center gap-2">
                                <MessageSquare size={14} className="text-gray-500" />
                                <span className="text-xs font-bold text-gray-500 uppercase">{t('task.activity')}</span>
                                <span className="bg-gray-200 text-gray-600 text-[10px] px-1.5 py-0.5 rounded-full">{editedTask.comments.length}</span>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                                {editedTask.comments.length === 0 && (
                                    <div className="text-center text-gray-400 text-xs italic py-4">{t('task.no_comments')}</div>
                                )}
                                {editedTask.comments.map(comment => (
                                    <div key={comment.id} className="flex gap-2.5">
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${comment.color || 'bg-gray-200'}`}>
                                            {comment.avatar || '?'}
                                        </div>
                                        <div>
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-xs font-bold text-gray-700">{comment.author}</span>
                                                <span className="text-[9px] text-gray-400">{new Date(comment.timestamp).toLocaleDateString()}</span>
                                            </div>
                                            <p className="text-xs text-gray-600 mt-0.5 leading-relaxed bg-white p-2 rounded-r-lg rounded-bl-lg border border-gray-100 shadow-sm">
                                                {comment.text}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="p-3 bg-white border-t border-gray-200">
                                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:bg-white transition-all">
                                    <input
                                        className="flex-1 bg-transparent outline-none text-xs"
                                        placeholder={t('task.enter_comment')}
                                        value={newComment}
                                        onChange={(e) => setNewComment(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && addComment()}
                                    />
                                    <button
                                        onClick={addComment}
                                        disabled={!newComment.trim()}
                                        className="text-indigo-600 disabled:text-gray-300 hover:text-indigo-700 transition-colors"
                                    >
                                        <Send size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};
