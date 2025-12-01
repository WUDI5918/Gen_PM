
import React, { useState } from 'react';
import { ProjectPhase, ProjectTask } from '../types';
import { parseDate, formatDate } from '../utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface CalendarViewProps {
  phases: ProjectPhase[];
}

export const CalendarView: React.FC<CalendarViewProps> = ({ phases }) => {
  const { t } = useLanguage();
  const [currentDate, setCurrentDate] = useState(new Date());

  const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  
  // Get padding for grid (start day of week)
  const startDay = startOfMonth.getDay(); // 0 = Sunday
  
  // Generate dates array for grid
  const daysInMonth = endOfMonth.getDate();
  const gridDays: (number | null)[] = [];
  for (let i = 0; i < startDay; i++) gridDays.push(null);
  for (let i = 1; i <= daysInMonth; i++) gridDays.push(i);

  // Helper to find tasks for a specific day
  const getTasksForDay = (day: number) => {
    const targetStr = `${currentDate.getFullYear()}/${String(currentDate.getMonth() + 1).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
    const tasks: { task: ProjectTask; phaseColor: string }[] = [];
    
    phases.forEach((p, idx) => {
      const colors = ['bg-indigo-100 text-indigo-800', 'bg-emerald-100 text-emerald-800', 'bg-amber-100 text-amber-800', 'bg-rose-100 text-rose-800'];
      const phaseColor = colors[idx % colors.length];

      p.tasks.forEach(t => {
        if (t.endDate === targetStr || t.startDate === targetStr) {
            tasks.push({ task: t, phaseColor });
        } else if (t.startDate !== '-' && t.endDate !== '-') {
             // Check if date is within range
             const s = parseDate(t.startDate);
             const e = parseDate(t.endDate);
             const current = parseDate(targetStr);
             if (current >= s && current <= e) {
                 tasks.push({ task: t, phaseColor });
             }
        }
      });
    });
    return tasks;
  };

  const changeMonth = (delta: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + delta, 1));
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm h-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b border-gray-200 shrink-0">
        <h2 className="text-xl font-bold text-gray-800">
          {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
        </h2>
        <div className="flex gap-2">
          <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-gray-100 rounded-full"><ChevronLeft /></button>
          <button className="px-3 py-1 text-sm border rounded hover:bg-gray-50" onClick={() => setCurrentDate(new Date())}>{t('cal.today')}</button>
          <button onClick={() => changeMonth(1)} className="p-2 hover:bg-gray-100 rounded-full"><ChevronRight /></button>
        </div>
      </div>

      {/* Days Header */}
      <div className="grid grid-cols-7 border-b bg-gray-50 shrink-0">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="py-2 text-center text-sm font-semibold text-gray-500">{d}</div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 flex-1 auto-rows-fr overflow-y-auto">
         {gridDays.map((day, idx) => (
            <div key={idx} className={`min-h-[100px] border-b border-r border-gray-100 p-1 ${day ? 'bg-white' : 'bg-gray-50/50'}`}>
               {day && (
                 <>
                   <div className={`text-right text-xs font-medium mb-1 ${
                       day === new Date().getDate() && 
                       currentDate.getMonth() === new Date().getMonth() && 
                       currentDate.getFullYear() === new Date().getFullYear() 
                       ? 'text-white bg-indigo-600 rounded-full w-6 h-6 flex items-center justify-center ml-auto' 
                       : 'text-gray-500'
                   }`}>
                     {day}
                   </div>
                   <div className="space-y-1">
                      {getTasksForDay(day).map((item, tIdx) => (
                        <div 
                            key={tIdx} 
                            className={`text-[10px] px-1.5 py-0.5 rounded truncate cursor-pointer hover:opacity-80 ${item.phaseColor}`}
                            title={`${item.task.subTaskName} (${item.task.status})`}
                        >
                           {item.task.subTaskName}
                        </div>
                      ))}
                   </div>
                 </>
               )}
            </div>
         ))}
      </div>
    </div>
  );
};
