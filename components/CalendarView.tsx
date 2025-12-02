import React, { useState } from 'react';
import { ProjectPhase, ProjectTask, TeamMember } from '../types';
import { parseDate } from '../utils';
import { ChevronLeft, ChevronRight, Plus, Search, MoreHorizontal, ChevronDown, CheckCircle2, Circle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { EventModal, EventData } from './EventModal';

interface CalendarViewProps {
  phases: ProjectPhase[];
  teamMembers?: TeamMember[];
  onAddEvent?: (event: EventData) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ phases, teamMembers = [], onAddEvent }) => {
  const { t } = useLanguage();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'Day' | 'Week' | 'Month' | 'List'>('Month');
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);

  const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

  // Get padding for grid (start day of week)
  const startDay = startOfMonth.getDay(); // 0 = Sunday

  // Generate dates array for grid
  const daysInMonth = endOfMonth.getDate();
  const gridDays: { day: number; isCurrentMonth: boolean; date: Date }[] = [];

  // Previous month padding
  const prevMonthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0);
  for (let i = startDay - 1; i >= 0; i--) {
    gridDays.push({
      day: prevMonthEnd.getDate() - i,
      isCurrentMonth: false,
      date: new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, prevMonthEnd.getDate() - i)
    });
  }

  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    gridDays.push({
      day: i,
      isCurrentMonth: true,
      date: new Date(currentDate.getFullYear(), currentDate.getMonth(), i)
    });
  }

  // Next month padding
  const remainingCells = 42 - gridDays.length; // 6 rows * 7 cols
  for (let i = 1; i <= remainingCells; i++) {
    gridDays.push({
      day: i,
      isCurrentMonth: false,
      date: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, i)
    });
  }

  // Helper to find tasks for a specific day
  const getTasksForDay = (date: Date) => {
    const targetStr = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
    const tasks: { task: ProjectTask; phaseColor: string }[] = [];

    phases.forEach((p, idx) => {
      const colors = ['bg-blue-100 text-blue-800', 'bg-emerald-100 text-emerald-800', 'bg-amber-100 text-amber-800', 'bg-rose-100 text-rose-800'];
      const phaseColor = colors[idx % colors.length];

      p.tasks.forEach(t => {
        if (t.endDate === targetStr || t.startDate === targetStr) {
          tasks.push({ task: t, phaseColor });
        } else if (t.startDate !== '-' && t.endDate !== '-') {
          // Check if date is within range
          const s = parseDate(t.startDate);
          const e = parseDate(t.endDate);
          // Reset hours for comparison
          const current = new Date(date);
          current.setHours(0, 0, 0, 0);
          s.setHours(0, 0, 0, 0);
          e.setHours(0, 0, 0, 0);

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

  const handleSaveEvent = (eventData: EventData) => {
    console.log("New Event Data:", eventData);
    if (onAddEvent) {
      onAddEvent(eventData);
    }
    // In a real app, we would add this to the state/backend
  };

  return (
    <div className="flex h-full bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
      {/* Sidebar */}
      <div className="w-64 border-r border-gray-200 flex flex-col bg-white shrink-0">
        <div className="p-4">
          <button
            onClick={() => setIsEventModalOpen(true)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 shadow-sm transition-colors"
          >
            <Plus size={20} /> New Event
          </button>
        </div>

        {/* Mini Calendar (Simplified) */}
        <div className="px-4 pb-4 border-b border-gray-100">
          <div className="flex justify-between items-center mb-2">
            <span className="font-bold text-gray-800">{currentDate.toLocaleString('default', { month: 'short', year: 'numeric' })}</span>
            <div className="flex gap-1">
              <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-gray-100 rounded"><ChevronLeft size={16} /></button>
              <button onClick={() => changeMonth(1)} className="p-1 hover:bg-gray-100 rounded"><ChevronRight size={16} /></button>
            </div>
          </div>
          <div className="grid grid-cols-7 text-center text-xs text-gray-400 mb-1">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => <div key={d}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 text-center text-xs gap-y-2">
            {gridDays.slice(0, 35).map((d, i) => ( // Show first 5 weeks
              <div key={i} className={`w-6 h-6 mx-auto flex items-center justify-center rounded-full ${d.date.toDateString() === new Date().toDateString() ? 'bg-blue-600 text-white' :
                  !d.isCurrentMonth ? 'text-gray-300' : 'text-gray-700 hover:bg-gray-100 cursor-pointer'
                }`}>
                {d.day}
              </div>
            ))}
          </div>
        </div>

        {/* Calendars List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div>
            <div className="flex items-center justify-between text-gray-500 mb-2">
              <span className="text-xs font-bold uppercase">Personal Calendar</span>
              <div className="flex gap-1">
                <MoreHorizontal size={14} className="cursor-pointer hover:text-gray-700" />
                <ChevronDown size={14} className="cursor-pointer hover:text-gray-700" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-50 p-1 rounded">
                <CheckCircle2 size={16} className="text-emerald-500 fill-emerald-100" />
                <span>My Calendar</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-50 p-1 rounded">
                <CheckCircle2 size={16} className="text-blue-500 fill-blue-100" />
                <span>My to-do</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-50 p-1 rounded">
                <CheckCircle2 size={16} className="text-blue-500 fill-blue-100" />
                <span>Teambition Task</span>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-gray-500 mb-2">
              <span className="text-xs font-bold uppercase">Subscription</span>
              <ChevronDown size={14} className="cursor-pointer hover:text-gray-700" />
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-200">
          <button className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
            <Settings size={16} /> Calendar Settings
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <button className="px-3 py-1.5 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700">
              Today
            </button>
            <div className="flex items-center gap-1 text-gray-600">
              <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-gray-100 rounded-full"><ChevronLeft size={20} /></button>
              <button onClick={() => changeMonth(1)} className="p-1 hover:bg-gray-100 rounded-full"><ChevronRight size={20} /></button>
            </div>
            <h2 className="text-xl font-bold text-gray-800">
              {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex bg-gray-100 p-1 rounded-lg">
              {['Day', 'Week', 'Month', 'List'].map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode as any)}
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${viewMode === mode ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                  {mode}
                </button>
              ))}
            </div>
            <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
              <Search size={20} />
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Days Header */}
          <div className="grid grid-cols-7 border-b border-gray-200">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="py-3 text-center text-sm font-semibold text-gray-500 bg-white">
                {d}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div className="flex-1 grid grid-cols-7 auto-rows-fr overflow-y-auto">
            {gridDays.map((item, idx) => {
              const isToday = item.date.toDateString() === new Date().toDateString();
              const tasks = getTasksForDay(item.date);

              return (
                <div
                  key={idx}
                  className={`min-h-[120px] border-b border-r border-gray-100 p-2 transition-colors hover:bg-gray-50/50 ${!item.isCurrentMonth ? 'bg-gray-50/30' : 'bg-white'
                    }`}
                  onClick={() => {
                    // Optional: Open modal for this date
                  }}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-blue-600 text-white' :
                        !item.isCurrentMonth ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                      {item.day}
                    </span>
                  </div>

                  <div className="space-y-1">
                    {tasks.map((t, tIdx) => (
                      <div
                        key={tIdx}
                        className={`text-[10px] px-2 py-1 rounded border-l-2 truncate cursor-pointer hover:opacity-80 shadow-sm ${t.phaseColor.replace('bg-', 'bg-opacity-20 bg-').replace('text-', 'border-')
                          }`}
                        title={`${t.task.subTaskName} (${t.task.status})`}
                      >
                        <div className="flex items-center gap-1">
                          <div className={`w-1.5 h-1.5 rounded-full ${t.phaseColor.split(' ')[1].replace('text-', 'bg-')}`}></div>
                          <span className="font-medium truncate">{t.task.subTaskName}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <EventModal
        isOpen={isEventModalOpen}
        onClose={() => setIsEventModalOpen(false)}
        onSave={handleSaveEvent}
        teamMembers={teamMembers}
        initialDate={currentDate}
      />
    </div>
  );
};

// Helper component for settings icon
function Settings({ size, className }: { size: number, className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
      <circle cx="12" cy="12" r="3"></circle>
    </svg>
  )
}
