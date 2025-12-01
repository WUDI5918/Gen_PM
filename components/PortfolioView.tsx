
import React, { useMemo } from 'react';
import { Project, TaskStatus } from '../types';
import { Briefcase, CheckCircle2, Clock, AlertTriangle, TrendingUp, Users, ArrowRight } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { parseDate, getDaysDiff } from '../utils';

interface PortfolioViewProps {
    projects: Project[];
    onSelectProject: (id: string) => void;
}

export const PortfolioView: React.FC<PortfolioViewProps> = ({ projects, onSelectProject }) => {
    const { t } = useLanguage();

    const stats = useMemo(() => {
        let totalTasks = 0;
        let completedTasks = 0;
        let delayedProjects = 0;
        const resourceLoad: Record<string, number> = {};

        projects.forEach(p => {
            let isDelayed = false;
            p.phases.forEach(phase => {
                phase.tasks.forEach(t => {
                    totalTasks++;
                    if (t.status === TaskStatus.Completed) completedTasks++;
                    
                    // Resource calculation
                    if (t.owner && t.status !== TaskStatus.Completed) {
                        resourceLoad[t.owner] = (resourceLoad[t.owner] || 0) + 1;
                    }

                    // Simple delay check
                    if (t.status === TaskStatus.Delayed) isDelayed = true;
                });
            });
            if (isDelayed) delayedProjects++;
        });

        const completionRate = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);
        const sortedResources = Object.entries(resourceLoad).sort((a, b) => b[1] - a[1]).slice(0, 5);

        return { totalTasks, completedTasks, completionRate, delayedProjects, sortedResources };
    }, [projects]);

    return (
        <div className="h-full flex flex-col bg-gray-50/50 animate-in fade-in duration-300 overflow-y-auto custom-scrollbar p-8">
            <div className="mb-8">
                <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-3">
                    <Briefcase className="text-indigo-600" /> {t('port.title')}
                </h1>
                <p className="text-gray-500 mt-1">{t('port.subtitle')}</p>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 flex items-center gap-4">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl"><Briefcase size={24} /></div>
                    <div>
                        <div className="text-2xl font-bold text-gray-900">{projects.length}</div>
                        <div className="text-xs font-bold text-gray-400 uppercase">{t('port.active')}</div>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 flex items-center gap-4">
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><TrendingUp size={24} /></div>
                    <div>
                        <div className="text-2xl font-bold text-emerald-600">{stats.completionRate}%</div>
                        <div className="text-xs font-bold text-gray-400 uppercase">{t('port.global_completion')}</div>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 flex items-center gap-4">
                    <div className="p-3 bg-rose-50 text-rose-600 rounded-xl"><AlertTriangle size={24} /></div>
                    <div>
                        <div className="text-2xl font-bold text-rose-600">{stats.delayedProjects}</div>
                        <div className="text-xs font-bold text-gray-400 uppercase">{t('port.risk_projects')}</div>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 flex items-center gap-4">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Clock size={24} /></div>
                    <div>
                        <div className="text-2xl font-bold text-blue-600">{stats.totalTasks - stats.completedTasks}</div>
                        <div className="text-xs font-bold text-gray-400 uppercase">{t('port.open_tasks')}</div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Project List & Timeline */}
                <div className="lg:col-span-2 space-y-6">
                    <h3 className="font-bold text-gray-700 text-lg">{t('port.timeline')}</h3>
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                        {projects.length === 0 ? (
                            <div className="p-8 text-center text-gray-400">{t('app.no_data')}</div>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {projects.map(project => {
                                    const pTasks = project.phases.flatMap(p => p.tasks);
                                    const pTotal = pTasks.length;
                                    const pDone = pTasks.filter(t => t.status === TaskStatus.Completed).length;
                                    const pPercent = pTotal === 0 ? 0 : Math.round((pDone / pTotal) * 100);
                                    const hasDelay = pTasks.some(t => t.status === TaskStatus.Delayed);

                                    return (
                                        <div 
                                            key={project.id} 
                                            onClick={() => onSelectProject(project.id)}
                                            className="p-5 hover:bg-gray-50 transition-colors cursor-pointer group"
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-bold text-gray-800 text-lg group-hover:text-indigo-600 transition-colors">{project.info.name}</h4>
                                                        {hasDelay && <span className="bg-rose-100 text-rose-600 text-[10px] font-bold px-2 py-0.5 rounded">{t('port.risk_badge')}</span>}
                                                    </div>
                                                    <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                                                        <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 font-mono">{project.info.code}</span>
                                                        <span>{t('port.manager_prefix')} {project.info.manager}</span>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-2xl font-bold text-gray-900">{pPercent}%</span>
                                                </div>
                                            </div>
                                            {/* Simple Progress Bar */}
                                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden mt-2">
                                                <div 
                                                    className={`h-full rounded-full transition-all ${pPercent === 100 ? 'bg-emerald-500' : hasDelay ? 'bg-rose-500' : 'bg-indigo-500'}`} 
                                                    style={{ width: `${pPercent}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Resource Heatmap */}
                <div className="space-y-6">
                    <h3 className="font-bold text-gray-700 text-lg">{t('port.heatmap')}</h3>
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                        <div className="space-y-5">
                            {stats.sortedResources.map(([name, count], idx) => (
                                <div key={name} className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-500">
                                        {name.charAt(0)}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between text-sm font-bold text-gray-700 mb-1">
                                            <span>{name}</span>
                                            <span>{count} {t('table.phase_tasks')}</span>
                                        </div>
                                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                            <div 
                                                className={`h-full rounded-full ${count > 5 ? 'bg-rose-500' : count > 2 ? 'bg-amber-500' : 'bg-emerald-500'}`} 
                                                style={{ width: `${Math.min(100, count * 10)}%` }} // Arbitrary scale for visual
                                            ></div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {stats.sortedResources.length === 0 && <div className="text-gray-400 text-sm text-center italic">{t('port.no_assignments')}</div>}
                        </div>
                        
                        <div className="mt-6 pt-6 border-t border-gray-100 text-xs text-gray-400 flex gap-4 justify-center">
                            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> {t('port.optimal')}</div>
                            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500"></div> {t('port.busy')}</div>
                            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-rose-500"></div> {t('port.overload')}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
