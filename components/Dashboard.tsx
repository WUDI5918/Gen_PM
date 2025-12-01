
import React, { useMemo } from 'react';
import { ProjectPhase, TaskStatus } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { CheckCircle2, Circle, Clock, AlertTriangle, PieChart, TrendingUp, AlertCircle, MessageSquare, Layers } from 'lucide-react';
import { parseDate } from '../utils';

interface DashboardProps {
  phases: ProjectPhase[];
}

export const Dashboard: React.FC<DashboardProps> = ({ phases }) => {
  const { t } = useLanguage();

  const stats = useMemo(() => {
    const allTasks = phases.flatMap(p => p.tasks);
    const total = allTasks.length;
    const completed = allTasks.filter(t => t.status === TaskStatus.Completed).length;
    const pending = allTasks.filter(t => t.status === TaskStatus.Pending).length;
    const inProgress = allTasks.filter(t => t.status === TaskStatus.InProgress).length;
    
    // Calculated Delayed: Marked as Delayed OR (Not Completed AND EndDate < Today) OR Has Warning Remarks
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const delayed = allTasks.filter(t => {
        // 1. Explicit Status
        if (t.status === TaskStatus.Delayed) return true;
        
        // 2. Has Risk/Warning Remarks (Matches list view red flags)
        if (t.remarks.some(r => r.isWarning)) return true;

        // 3. Overdue Calculation
        if (t.status === TaskStatus.Completed) return false;
        if (!t.endDate || t.endDate === '-') return false;
        
        const end = parseDate(t.endDate);
        end.setHours(0, 0, 0, 0);
        
        return end < today;
    }).length;
    
    // Completion Rate
    const rate = total === 0 ? 0 : Math.round((completed / total) * 100);

    // Workload by Owner
    const workload: Record<string, number> = {};
    allTasks.forEach(t => {
      const owner = t.owner || 'Unassigned';
      workload[owner] = (workload[owner] || 0) + 1;
    });
    const sortedWorkload = Object.entries(workload).sort((a, b) => b[1] - a[1]);

    // Phase Progress Breakdown
    const phaseProgress = phases.map(p => {
        const pTotal = p.tasks.length;
        const pCompleted = p.tasks.filter(t => t.status === TaskStatus.Completed).length;
        const pPercent = pTotal === 0 ? 0 : Math.round((pCompleted / pTotal) * 100);
        return { name: p.name, percent: pPercent, total: pTotal, completed: pCompleted };
    });

    // Upcoming Deadlines (next 7 days)
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);
    
    const upcoming = allTasks
      .filter(t => t.status !== TaskStatus.Completed && t.endDate && t.endDate !== '-')
      .map(t => ({ ...t, parsedDate: parseDate(t.endDate) }))
      .filter(t => t.parsedDate >= today && t.parsedDate <= nextWeek)
      .sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime());
    
    // Recent Activity (Comments)
    const recentActivities = allTasks
        .flatMap(t => t.comments.map(c => ({ ...c, taskName: t.subTaskName })))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 5); // Top 5

    return { total, completed, pending, inProgress, delayed, rate, sortedWorkload, upcoming, recentActivities, phaseProgress };
  }, [phases]);

  // CSS Conic Gradient for Pie Chart
  const pieGradient = useMemo(() => {
    if (stats.total === 0) return 'conic-gradient(#e5e7eb 0% 100%)';
    
    const pCompleted = (stats.completed / stats.total) * 100;
    const pInProgress = (stats.inProgress / stats.total) * 100;
    const pDelayed = (stats.delayed / stats.total) * 100;
    // Pending fills the rest
    
    // Colors corresponding to statuses
    const cCompleted = '#10b981'; // emerald-500
    const cInProgress = '#3b82f6'; // blue-500
    const cDelayed = '#ef4444'; // red-500
    const cPending = '#cbd5e1'; // slate-300

    let current = 0;
    const parts = [];
    
    parts.push(`${cCompleted} 0% ${current + pCompleted}%`);
    current += pCompleted;
    
    parts.push(`${cInProgress} ${current}% ${current + pInProgress}%`);
    current += pInProgress;

    parts.push(`${cDelayed} ${current}% ${current + pDelayed}%`);
    current += pDelayed;

    parts.push(`${cPending} ${current}% 100%`);

    return `conic-gradient(${parts.join(', ')})`;
  }, [stats]);

  return (
    <div className="h-full overflow-y-auto pb-10 custom-scrollbar p-4">
      
      {/* Unified Stat Card */}
      <div className="bg-gray-200 rounded-2xl overflow-hidden mb-8 border border-gray-200 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-gray-200">
            {/* Total Tasks */}
            <div className="bg-white p-6 flex items-center gap-4 hover:bg-gray-50 transition-colors">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full">
                <PieChart size={24} />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-800">{stats.total}</div>
                <div className="text-xs text-gray-500 font-medium uppercase">{t('dash.total_tasks')}</div>
              </div>
            </div>

            {/* Completion Rate */}
            <div className="bg-white p-6 flex items-center gap-4 hover:bg-gray-50 transition-colors">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-full">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <div className="text-2xl font-bold text-emerald-700">{stats.rate}%</div>
                <div className="text-xs text-gray-500 font-medium uppercase">{t('dash.completion_rate')}</div>
              </div>
            </div>

            {/* Pending Items */}
            <div className="bg-white p-6 flex items-center gap-4 hover:bg-gray-50 transition-colors">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-full">
                <Clock size={24} />
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-700">{stats.inProgress + stats.pending}</div>
                <div className="text-xs text-gray-500 font-medium uppercase">{t('dash.pending_items')}</div>
              </div>
            </div>

            {/* Delayed / Risk */}
            <div className="bg-white p-6 flex items-center gap-4 hover:bg-gray-50 transition-colors">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-full">
                <AlertTriangle size={24} />
              </div>
              <div>
                <div className="text-2xl font-bold text-rose-600">{stats.delayed}</div>
                <div className="text-xs text-gray-500 font-medium uppercase">{t('dash.delayed')}</div>
              </div>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart Section */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center justify-center lg:col-span-1">
            <h3 className="text-sm font-bold text-gray-700 mb-6 w-full flex items-center gap-2">
                <TrendingUp size={16} /> {t('dash.status_dist')}
            </h3>
            <div className="relative w-48 h-48 rounded-full shadow-inner" style={{ background: pieGradient }}>
                <div className="absolute inset-0 m-8 bg-white rounded-full flex items-center justify-center shadow-sm">
                    <span className="text-3xl font-bold text-gray-800">{stats.rate}%</span>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 mt-6 w-full px-4">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                    <div className="w-3 h-3 bg-emerald-500 rounded-full"></div> {t('status.Completed')} ({stats.completed})
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div> {t('status.In Progress')} ({stats.inProgress})
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                    <div className="w-3 h-3 bg-rose-500 rounded-full"></div> {t('status.Delayed')} ({stats.delayed})
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                    <div className="w-3 h-3 bg-slate-300 rounded-full"></div> {t('status.Pending')} ({stats.pending})
                </div>
            </div>
        </div>

        {/* Middle Column: Workload + Phase Progress */}
        <div className="lg:col-span-1 flex flex-col gap-6">
             
             {/* Phase Progress Breakdown (New) */}
             <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex-1 flex flex-col">
                <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                    <Layers size={16} className="text-purple-500" /> {t('dash.phase_progress')}
                </h3>
                <div className="flex-1 space-y-4 overflow-y-auto custom-scrollbar pr-2 max-h-[200px]">
                    {stats.phaseProgress.map((p, idx) => (
                        <div key={idx}>
                            <div className="flex justify-between text-xs mb-1">
                                <span className="font-medium text-gray-700 truncate max-w-[70%]">{p.name}</span>
                                <span className="text-gray-500 font-bold">{p.percent}%</span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full rounded-full transition-all duration-500 ${p.percent === 100 ? 'bg-emerald-500' : 'bg-purple-500'}`} 
                                    style={{ width: `${p.percent}%` }}
                                ></div>
                            </div>
                            <div className="text-[10px] text-gray-400 mt-0.5 text-right">
                                {p.completed}/{p.total} tasks
                            </div>
                        </div>
                    ))}
                    {stats.phaseProgress.length === 0 && <div className="text-gray-400 text-xs italic">{t('app.no_data')}</div>}
                </div>
            </div>

             {/* Workload Section */}
             <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex-1 flex flex-col">
                <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                    <TrendingUp size={16} /> {t('dash.team_workload')}
                </h3>
                <div className="flex-1 space-y-4 overflow-y-auto custom-scrollbar pr-2 max-h-[200px]">
                    {stats.sortedWorkload.map(([name, count], idx) => {
                        const max = stats.sortedWorkload[0][1];
                        const percent = (count / max) * 100;
                        return (
                            <div key={name}>
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="font-medium text-gray-700">{name}</span>
                                    <span className="text-gray-500 font-bold">{count}</span>
                                </div>
                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div 
                                        className={`h-full rounded-full ${idx === 0 ? 'bg-indigo-500' : 'bg-indigo-300'}`} 
                                        style={{ width: `${percent}%` }}
                                    ></div>
                                </div>
                            </div>
                        )
                    })}
                    {stats.sortedWorkload.length === 0 && <div className="text-gray-400 text-xs italic">{t('app.no_data')}</div>}
                </div>
            </div>
        </div>

        {/* Right Column: Activity & Upcoming */}
        <div className="lg:col-span-1 flex flex-col gap-6">
            {/* Recent Activity */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex-1 flex flex-col">
                <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                    <MessageSquare size={16} className="text-blue-500" /> {t('dash.recent_activity')}
                </h3>
                <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar max-h-[200px]">
                    {stats.recentActivities.length > 0 ? (
                         stats.recentActivities.map(act => (
                             <div key={act.id} className="flex gap-3 items-start border-b border-gray-50 pb-2 last:border-0">
                                 <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${act.color}`}>
                                     {act.avatar}
                                 </div>
                                 <div className="min-w-0">
                                     <div className="flex items-center gap-2">
                                         <span className="text-xs font-bold text-gray-800">{act.author}</span>
                                         <span className="text-[9px] text-gray-400">{new Date(act.timestamp).toLocaleDateString()}</span>
                                     </div>
                                     <div className="text-[10px] font-medium text-indigo-600 truncate mb-0.5">{act.taskName}</div>
                                     <p className="text-xs text-gray-600 line-clamp-2 leading-tight">{act.text}</p>
                                 </div>
                             </div>
                         ))
                    ) : (
                        <div className="text-center text-gray-400 text-xs italic pt-4">No recent updates.</div>
                    )}
                </div>
            </div>

            {/* Upcoming Section */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex-1 flex flex-col">
                 <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                    <AlertCircle size={16} className="text-amber-500" /> {t('dash.upcoming')}
                </h3>
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3">
                    {stats.upcoming.length > 0 ? (
                        stats.upcoming.map(task => (
                            <div key={task.id} className="p-3 bg-amber-50 border border-amber-100 rounded-lg flex items-start gap-3">
                                <div className="mt-0.5 bg-white p-1 rounded-full text-amber-600 border border-amber-200">
                                    <Clock size={12} />
                                </div>
                                <div className="min-w-0">
                                    <div className="text-xs font-bold text-gray-800 truncate">{task.subTaskName}</div>
                                    <div className="text-[10px] text-gray-500 mt-0.5 flex items-center gap-1">
                                        <span>{task.endDate}</span> • <span className="text-amber-700">{task.owner}</span>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 text-xs">
                            <CheckCircle2 size={32} className="mb-2 text-gray-200" />
                            {t('dash.no_upcoming')}
                        </div>
                    )}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};
