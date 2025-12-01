
import React, { useState } from 'react';
import { Project, Goal, TaskStatus } from '../types';
import { Target, Plus, Trash2, Calendar, User, CheckCircle2, AlertTriangle, XCircle, Activity, Link as LinkIcon } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';

interface GoalsViewProps {
    project: Project;
    onUpdate: (project: Project) => void;
}

export const GoalsView: React.FC<GoalsViewProps> = ({ project, onUpdate }) => {
    const { t } = useLanguage();
    const { addToast } = useToast();
    const [isAdding, setIsAdding] = useState(false);
    const [newGoal, setNewGoal] = useState<Partial<Goal>>({ status: 'On Track', progress: 0, priority: 'Medium' });

    const goals = project.goals || [];

    const handleAddGoal = () => {
        if (!newGoal.title) return;
        const goal: Goal = {
            id: `goal-${Date.now()}`,
            title: newGoal.title,
            description: newGoal.description || '',
            progress: Number(newGoal.progress),
            status: newGoal.status as any,
            owner: newGoal.owner || 'Unassigned',
            dueDate: newGoal.dueDate || '-',
            priority: newGoal.priority as any || 'Medium',
            linkedTaskIds: []
        };
        onUpdate({ ...project, goals: [...goals, goal] });
        setNewGoal({ status: 'On Track', progress: 0, priority: 'Medium', title: '', description: '' });
        setIsAdding(false);
        addToast(t('goals.created'), 'success');
    };

    const handleDeleteGoal = (id: string) => {
        onUpdate({ ...project, goals: goals.filter(g => g.id !== id) });
    };

    const handleUpdateGoal = (id: string, updates: Partial<Goal>) => {
        onUpdate({ ...project, goals: goals.map(g => g.id === id ? { ...g, ...updates } : g) });
    };

    // Calculate progress based on tasks linked to this goal
    const getCalculatedProgress = (goal: Goal) => {
        // Find tasks that point to this goal
        const linkedTasks = project.phases.flatMap(p => p.tasks).filter(t => t.linkedGoalId === goal.id);
        
        if (linkedTasks.length === 0) return goal.progress;

        const completed = linkedTasks.filter(t => t.status === TaskStatus.Completed).length;
        return Math.round((completed / linkedTasks.length) * 100);
    };

    const getStatusColor = (s: string) => {
        switch(s) {
            case 'On Track': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'At Risk': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'Off Track': return 'bg-rose-100 text-rose-700 border-rose-200';
            case 'Completed': return 'bg-blue-100 text-blue-700 border-blue-200';
            default: return 'bg-gray-100';
        }
    };

    return (
        <div className="h-full flex flex-col p-8 bg-gray-50/50 overflow-y-auto custom-scrollbar">
            <div className="max-w-6xl mx-auto w-full">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h2 className="text-2xl font-extrabold text-gray-900 flex items-center gap-3">
                            <Target className="text-indigo-600" /> {t('goals.title')}
                        </h2>
                        <p className="text-gray-500 mt-1">{t('goals.subtitle')}</p>
                    </div>
                    <button 
                        onClick={() => setIsAdding(!isAdding)}
                        className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2"
                    >
                        <Plus size={18} /> {t('goals.add')}
                    </button>
                </div>

                {isAdding && (
                    <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200 mb-6 animate-in slide-in-from-top-2">
                        <div className="grid grid-cols-1 gap-4 mb-4">
                            <input 
                                className="w-full text-lg font-bold border-b border-gray-200 pb-2 outline-none focus:border-indigo-500 transition-all" 
                                placeholder={t('goals.title_placeholder')} 
                                value={newGoal.title} 
                                onChange={e => setNewGoal({...newGoal, title: e.target.value})} 
                                autoFocus
                            />
                            <textarea 
                                className="w-full border p-3 rounded-lg text-sm outline-none focus:border-indigo-500 resize-none" 
                                placeholder={t('goals.desc_placeholder')} 
                                rows={2}
                                value={newGoal.description} 
                                onChange={e => setNewGoal({...newGoal, description: e.target.value})} 
                            />
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">{t('table.status')}</label>
                                <select className="w-full border p-2 rounded-lg text-sm bg-white" value={newGoal.status} onChange={e => setNewGoal({...newGoal, status: e.target.value as any})}>
                                    <option value="On Track">{t('goals.status_ontrack')}</option>
                                    <option value="At Risk">{t('goals.status_atrisk')}</option>
                                    <option value="Off Track">{t('goals.status_offtrack')}</option>
                                    <option value="Completed">{t('goals.status_completed')}</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">{t('goals.progress')} (%)</label>
                                <input type="number" className="w-full border p-2 rounded-lg text-sm" value={newGoal.progress} onChange={e => setNewGoal({...newGoal, progress: Number(e.target.value)})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">{t('table.assigned_to')}</label>
                                <input className="w-full border p-2 rounded-lg text-sm" value={newGoal.owner} onChange={e => setNewGoal({...newGoal, owner: e.target.value})} placeholder={t('goals.owner_placeholder')} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">{t('table.priority')}</label>
                                <select className="w-full border p-2 rounded-lg text-sm bg-white" value={newGoal.priority} onChange={e => setNewGoal({...newGoal, priority: e.target.value as any})}>
                                    <option value="High">{t('priority.High')}</option>
                                    <option value="Medium">{t('priority.Med')}</option>
                                    <option value="Low">{t('priority.Low')}</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setIsAdding(false)} className="px-4 py-2 text-gray-500 font-bold hover:bg-gray-50 rounded-lg transition-colors">{t('common.cancel')}</button>
                            <button onClick={handleAddGoal} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors">{t('goals.create')}</button>
                        </div>
                    </div>
                )}

                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    {goals.length === 0 ? (
                        <div className="p-12 text-center text-gray-400">
                            <Target size={48} className="mx-auto mb-3 text-gray-300" />
                            <p className="text-sm font-medium">{t('goals.no_goals')}</p>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase text-gray-500 font-bold tracking-wider">
                                    <th className="p-5 w-[40%]">{t('goals.title')}</th>
                                    <th className="p-5">{t('goals.progress')}</th>
                                    <th className="p-5">{t('table.status')}</th>
                                    <th className="p-5 hidden md:table-cell">{t('table.assigned_to')}</th>
                                    <th className="p-5 hidden md:table-cell">{t('table.end_date')}</th>
                                    <th className="p-5 hidden md:table-cell text-center">{t('goals.linked_tasks')}</th>
                                    <th className="p-5 w-12"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {goals.map(goal => {
                                    const linkedTaskCount = project.phases.flatMap(p => p.tasks).filter(t => t.linkedGoalId === goal.id).length;
                                    const calculatedProgress = getCalculatedProgress(goal);
                                    const isAutoProgress = linkedTaskCount > 0;

                                    return (
                                        <tr key={goal.id} className="group hover:bg-gray-50 transition-colors">
                                            <td className="p-5">
                                                <div className="font-bold text-gray-800 text-base">{goal.title}</div>
                                                {goal.description && <div className="text-xs text-gray-500 mt-1 line-clamp-1">{goal.description}</div>}
                                                <div className="mt-2 md:hidden flex items-center gap-2">
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getStatusColor(goal.status)}`}>
                                                        {t(`goals.status_${goal.status.toLowerCase().replace(' ', '')}`)}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden min-w-[80px]">
                                                        <div 
                                                            className={`h-full rounded-full transition-all duration-500 ${calculatedProgress === 100 ? 'bg-emerald-500' : calculatedProgress < 30 ? 'bg-rose-500' : 'bg-indigo-500'}`}
                                                            style={{ width: `${calculatedProgress}%` }}
                                                        ></div>
                                                    </div>
                                                    <span className="text-xs font-bold text-gray-600 w-8 text-right">{calculatedProgress}%</span>
                                                </div>
                                                {isAutoProgress && (
                                                    <div className="text-[9px] text-gray-400 mt-1 flex items-center gap-1">
                                                        <Activity size={10} /> {t('goals.auto_progress')}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-5">
                                                <select 
                                                    className={`text-xs font-bold px-2 py-1 rounded-lg border outline-none cursor-pointer transition-colors ${getStatusColor(goal.status)}`}
                                                    value={goal.status}
                                                    onChange={(e) => handleUpdateGoal(goal.id, { status: e.target.value as any })}
                                                >
                                                    <option value="On Track">{t('goals.status_ontrack')}</option>
                                                    <option value="At Risk">{t('goals.status_atrisk')}</option>
                                                    <option value="Off Track">{t('goals.status_offtrack')}</option>
                                                    <option value="Completed">{t('goals.status_completed')}</option>
                                                </select>
                                            </td>
                                            <td className="p-5 hidden md:table-cell">
                                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                                    <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-500">
                                                        {goal.owner.charAt(0)}
                                                    </div>
                                                    {goal.owner}
                                                </div>
                                            </td>
                                            <td className="p-5 hidden md:table-cell">
                                                <div className="text-xs text-gray-500 flex items-center gap-1">
                                                    <Calendar size={14} /> {t('goals.due_prefix')} {goal.dueDate}
                                                </div>
                                            </td>
                                            <td className="p-5 hidden md:table-cell text-center">
                                                {linkedTaskCount > 0 ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold">
                                                        <LinkIcon size={12} /> {linkedTaskCount}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-300">-</span>
                                                )}
                                            </td>
                                            <td className="p-5 text-right">
                                                <button 
                                                    onClick={() => handleDeleteGoal(goal.id)}
                                                    className="text-gray-300 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};
