
import React, { useState, useMemo } from 'react';
import { TeamMember, Project, TaskStatus } from '../types';
import { Plus, Trash2, User, Mail, Briefcase, Layers, Search, CheckCircle2, BarChart3, X, Save } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useDialog } from '../contexts/DialogContext';
import { useToast } from '../contexts/ToastContext';

interface TeamViewProps {
    teamMembers: TeamMember[];
    projects: Project[];
    onUpdateTeam: (members: TeamMember[]) => void;
}

export const TeamView: React.FC<TeamViewProps> = ({ teamMembers, projects, onUpdateTeam }) => {
    const { t } = useLanguage();
    const { ask } = useDialog();
    const { addToast } = useToast();

    const [searchQuery, setSearchQuery] = useState('');
    const [isEditing, setIsEditing] = useState<string | null>(null); // ID of member being edited, or 'new'

    // Edit Form State
    const [editForm, setEditForm] = useState<Partial<TeamMember>>({});

    // --- Statistics Calculation ---
    const stats = useMemo(() => {
        const workload: Record<string, { total: number, active: number, completed: number }> = {};
        const departments: Record<string, number> = {};

        // Initialize for all members
        teamMembers.forEach(m => {
            workload[m.name] = { total: 0, active: 0, completed: 0 };
            if (m.department) {
                departments[m.department] = (departments[m.department] || 0) + 1;
            }
        });

        // Aggregate from Projects
        projects.forEach(p => {
            p.phases.forEach(phase => {
                phase.tasks.forEach(task => {
                    const owner = task.owner;
                    if (workload[owner]) {
                        workload[owner].total++;
                        if (task.status === TaskStatus.Completed) {
                            workload[owner].completed++;
                        } else {
                            workload[owner].active++;
                        }
                    }
                });
            });
        });

        return { workload, departments };
    }, [teamMembers, projects]);

    // --- Handlers ---

    const handleSave = () => {
        if (!editForm.name || !editForm.role) {
            addToast(t('team.required_error'), 'error');
            return;
        }

        if (isEditing === 'new') {
            // Create
            const colors = ['bg-blue-100 text-blue-700', 'bg-green-100 text-green-700', 'bg-purple-100 text-purple-700', 'bg-yellow-100 text-yellow-700', 'bg-pink-100 text-pink-700'];
            const randomColor = colors[Math.floor(Math.random() * colors.length)];
            const initials = editForm.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

            const newMember: TeamMember = {
                id: crypto.randomUUID(),
                name: editForm.name,
                role: editForm.role,
                email: editForm.email,
                department: editForm.department || 'General',
                skills: editForm.skills,
                avatar: initials,
                color: randomColor,
                lastModified: Date.now()
            };
            onUpdateTeam([...teamMembers, newMember]);
            addToast(t('team.added'), 'success');
        } else {
            // Update
            onUpdateTeam(teamMembers.map(m => m.id === isEditing ? { ...m, ...editForm, lastModified: Date.now() } as TeamMember : m));
            addToast(t('team.updated'), 'success');
        }
        setIsEditing(null);
        setEditForm({});
    };

    const handleDelete = (member: TeamMember) => {
        const activeTasks = stats.workload[member.name]?.active || 0;

        ask({
            title: t('team.remove_title'),
            message: activeTasks > 0
                ? t('team.remove_warning')
                : t('team.remove_confirm'),
            type: 'danger',
            confirmText: t('common.delete'),
            onConfirm: () => {
                onUpdateTeam(teamMembers.filter(m => m.id !== member.id));
                addToast(t('team.removed'), 'info');
            }
        });
    };

    const startEdit = (member: TeamMember) => {
        setEditForm({ ...member });
        setIsEditing(member.id);
    };

    const startNew = () => {
        setEditForm({ name: '', role: '', department: '', email: '', skills: [] });
        setIsEditing('new');
    };

    const filteredMembers = teamMembers.filter(m =>
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.department?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex h-full flex-col bg-gray-50/30 animate-in fade-in duration-300">
            {/* Header & Stats */}
            <div className="bg-white border-b border-gray-200 px-8 py-6 sticky top-0 z-20">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h1 className="text-2xl font-extrabold text-gray-900">{t('team.title')}</h1>
                        <p className="text-sm text-gray-500 mt-1">{t('team.subtitle')}</p>
                    </div>
                    <button
                        onClick={startNew}
                        className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all flex items-center gap-2"
                    >
                        <Plus size={18} /> {t('team.add_new')}
                    </button>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100 flex items-center gap-4">
                        <div className="p-3 bg-white rounded-full text-indigo-600 shadow-sm"><User size={20} /></div>
                        <div>
                            <div className="text-2xl font-bold text-indigo-900">{teamMembers.length}</div>
                            <div className="text-xs font-bold text-indigo-400 uppercase">{t('team.total')}</div>
                        </div>
                    </div>
                    {Object.entries(stats.departments).slice(0, 3).map(([dept, count], idx) => (
                        <div key={dept} className="bg-white rounded-xl p-4 border border-gray-200 flex items-center gap-4 shadow-sm">
                            <div className={`p-3 rounded-full text-gray-600 shadow-sm ${idx === 0 ? 'bg-purple-50 text-purple-600' : idx === 1 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                <Briefcase size={20} />
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-gray-800">{count}</div>
                                <div className="text-xs font-bold text-gray-400 uppercase">{dept}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                {/* Filter */}
                <div className="mb-6 relative max-w-md">
                    <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                        placeholder={t('common.search')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                {/* Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredMembers.map(member => {
                        const mStats = stats.workload[member.name] || { total: 0, active: 0, completed: 0 };
                        const workloadPercent = mStats.total > 0 ? Math.round((mStats.active / mStats.total) * 100) : 0;

                        return (
                            <div key={member.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-lg hover:border-indigo-200 transition-all group relative overflow-hidden">
                                <div className="h-2 bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 group-hover:from-indigo-400 group-hover:to-purple-400 transition-all"></div>

                                <div className="p-6">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold text-white shadow-md ${member.color.replace('text-', 'bg-').replace('bg-', 'bg-opacity-100 bg-')}`}>
                                                {member.avatar}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-gray-800 text-lg">{member.name}</h3>
                                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                                    <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600 font-medium">{member.role}</span>
                                                    {member.department && <span className="text-gray-400">• {member.department}</span>}
                                                </div>
                                            </div>
                                        </div>
                                        {member.name !== 'Unassigned' && (
                                            <button onClick={() => startEdit(member)} className="text-gray-300 hover:text-indigo-600 p-1.5 hover:bg-indigo-50 rounded-lg transition-colors">
                                                <User size={16} />
                                            </button>
                                        )}
                                    </div>

                                    <div className="space-y-3 mb-6">
                                        {member.email && (
                                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                                <Mail size={14} className="text-gray-300" /> {member.email}
                                            </div>
                                        )}
                                        {member.skills && member.skills.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5">
                                                {member.skills.map(skill => (
                                                    <span key={skill} className="text-[10px] bg-gray-50 text-gray-500 px-2 py-0.5 rounded border border-gray-100">
                                                        {skill}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Workload Bar */}
                                    <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1"><BarChart3 size={12} /> {t('team.workload')}</span>
                                            <span className="text-xs font-bold text-indigo-600">{mStats.active} {t('team.active_tasks')}</span>
                                        </div>
                                        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden flex">
                                            <div className="h-full bg-emerald-400" style={{ width: `${(mStats.completed / (mStats.total || 1)) * 100}%` }}></div>
                                            <div className="h-full bg-indigo-500" style={{ width: `${(mStats.active / (mStats.total || 1)) * 100}%` }}></div>
                                        </div>
                                        <div className="flex justify-between mt-1 text-[9px] text-gray-400 font-medium">
                                            <span>{mStats.completed} {t('common.done')}</span>
                                            <span>{mStats.total} {t('team.total_suffix')}</span>
                                        </div>
                                    </div>
                                </div>

                                {member.name !== 'Unassigned' && (
                                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDelete(member); }}
                                            className="p-2 bg-white text-red-500 border border-red-100 rounded-lg hover:bg-red-50 shadow-sm"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Edit Modal */}
            {isEditing && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-lg text-gray-800">{isEditing === 'new' ? t('team.add_new') : t('common.edit')}</h3>
                            <button onClick={() => setIsEditing(null)}><X size={20} className="text-gray-400 hover:text-gray-600" /></button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">{t('team.name_placeholder').split(' (')[0]}</label>
                                    <input className="w-full text-sm border rounded-lg p-2.5 outline-none focus:border-indigo-500" value={editForm.name || ''} onChange={e => setEditForm({ ...editForm, name: e.target.value })} placeholder="John Doe" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">{t('team.role_placeholder').split(' (')[0]}</label>
                                    <input className="w-full text-sm border rounded-lg p-2.5 outline-none focus:border-indigo-500" value={editForm.role || ''} onChange={e => setEditForm({ ...editForm, role: e.target.value })} placeholder="Developer" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">{t('team.department')}</label>
                                    <input className="w-full text-sm border rounded-lg p-2.5 outline-none focus:border-indigo-500" value={editForm.department || ''} onChange={e => setEditForm({ ...editForm, department: e.target.value })} placeholder="Engineering" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">{t('team.email')}</label>
                                    <input className="w-full text-sm border rounded-lg p-2.5 outline-none focus:border-indigo-500" value={editForm.email || ''} onChange={e => setEditForm({ ...editForm, email: e.target.value })} placeholder="john@company.com" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">{t('team.skills')}</label>
                                <input
                                    className="w-full text-sm border rounded-lg p-2.5 outline-none focus:border-indigo-500"
                                    value={editForm.skills?.join(', ') || ''}
                                    onChange={e => setEditForm({ ...editForm, skills: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                                    placeholder="React, Design, SQL"
                                />
                            </div>
                        </div>

                        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-2">
                            <button onClick={() => setIsEditing(null)} className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-200 rounded-lg transition-colors">{t('common.cancel')}</button>
                            <button onClick={handleSave} className="px-6 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm flex items-center gap-2 transition-all">
                                <Save size={16} /> {t('common.save')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
