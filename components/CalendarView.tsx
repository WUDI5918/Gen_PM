import React, { useState } from 'react';
import { ProjectPhase, ProjectTask, TeamMember, Project, CalendarEvent } from '../types';
import { parseDate } from '../utils';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Clock, MapPin, Video, List, LayoutGrid, Columns, Maximize } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { EventModal, EventData } from './EventModal';
import { TaskDetailModal } from './TaskDetailModal';

interface CalendarViewProps {
  phases: ProjectPhase[];
  events?: (CalendarEvent & { projectCode?: string })[];
  teamMembers?: TeamMember[];
  projects?: Project[];
  onAddEvent?: (event: EventData) => void;
  onUpdateTask?: (task: ProjectTask) => void;
  onDeleteEvent?: (event: EventData) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ phases, events = [], teamMembers = [], projects = [], onAddEvent, onUpdateTask, onDeleteEvent }) => {
  const { t } = useLanguage();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'Day' | 'Week' | 'Month' | 'List'>('Month');
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<ProjectTask | null>(null);
  const [isTaskDetailOpen, setIsTaskDetailOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventData | undefined>(undefined);

  // --- Date Helpers ---
  const getStartOfWeek = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day; // Adjust when day is sunday
    return new Date(d.setDate(diff));
  };

  const addDays = (date: Date, days: number) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  };

  // --- Navigation Logic ---
  const changeDate = (delta: number) => {
    const newDate = new Date(currentDate);
    if (viewMode === 'Month') {
      newDate.setMonth(newDate.getMonth() + delta);
    } else if (viewMode === 'Week') {
      newDate.setDate(newDate.getDate() + (delta * 7));
    } else if (viewMode === 'Day') {
      newDate.setDate(newDate.getDate() + delta);
    } else {
      // List view defaults to month navigation
      newDate.setMonth(newDate.getMonth() + delta);
    }
    setCurrentDate(newDate);
  };

  const getHeaderText = () => {
    if (viewMode === 'Day') {
      return currentDate.toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }
    if (viewMode === 'Week') {
      const start = getStartOfWeek(currentDate);
      const end = addDays(start, 6);
      const startStr = start.toLocaleDateString('default', { month: 'short', day: 'numeric' });
      const endStr = end.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' });
      return `${startStr} - ${endStr}`;
    }
    return currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  // --- Data Fetching ---
  const getItemsForDay = (date: Date) => {
    const targetStr = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
    const items: { type: 'task' | 'event'; task?: ProjectTask; event?: CalendarEvent & { projectCode?: string }; color: string; title: string; time?: string }[] = [];

    phases.forEach((p, idx) => {
      const colors = ['bg-blue-50 text-blue-700 border-blue-200', 'bg-emerald-50 text-emerald-700 border-emerald-200', 'bg-amber-50 text-amber-700 border-amber-200', 'bg-rose-50 text-rose-700 border-rose-200'];
      const phaseColor = colors[idx % colors.length];

      p.tasks.forEach(t => {
        if (t.endDate === targetStr || t.startDate === targetStr) {
          items.push({ type: 'task', task: t, color: phaseColor, title: t.subTaskName });
        } else if (t.startDate !== '-' && t.endDate !== '-') {
          const s = parseDate(t.startDate);
          const e = parseDate(t.endDate);
          const current = new Date(date);
          current.setHours(0, 0, 0, 0);
          s.setHours(0, 0, 0, 0);
          e.setHours(0, 0, 0, 0);

          if (current >= s && current <= e) {
            items.push({ type: 'task', task: t, color: phaseColor, title: t.subTaskName });
          }
        }
      });
    });

    events.forEach((event) => {
      const eventStart = new Date(event.startDate);
      const eventEnd = new Date(event.endDate);
      const current = new Date(date);
      current.setHours(0, 0, 0, 0);
      eventStart.setHours(0, 0, 0, 0);
      eventEnd.setHours(0, 0, 0, 0);

      if (current >= eventStart && current <= eventEnd) {
        items.push({
          type: 'event',
          event,
          color: event.color || 'bg-purple-50 text-purple-700 border-purple-200',
          title: event.title,
          time: event.startTime
        });
      }
    });

    return items;
  };

  // --- Render Helpers ---
  const renderItemCard = (item: any, isCompact = false) => (
    <div
      key={item.type === 'task' ? item.task?.id : item.event?.id}
      className={`px-2.5 py-1.5 rounded-md text-[11px] font-medium truncate cursor-pointer transition-all mb-1.5 shadow-sm hover:shadow-md hover:-translate-y-0.5 border border-transparent
        ${item.type === 'event'
          ? 'bg-purple-50 text-purple-900 hover:border-purple-200'
          : 'bg-blue-50 text-blue-900 hover:border-blue-200'
        }
      `}
      onClick={(e) => {
        e.stopPropagation();
        if (item.type === 'task' && item.task) {
          setSelectedTask(item.task);
          setIsTaskDetailOpen(true);
        } else if (item.type === 'event' && item.event) {
          const eventData: EventData = {
            id: item.event.id,
            title: item.event.title,
            startDate: item.event.startDate,
            startTime: item.event.startTime || '',
            endDate: item.event.endDate,
            endTime: item.event.endTime || '',
            isAllDay: item.event.isAllDay || false,
            participants: item.event.participants || [],
            location: item.event.location || '',
            hasVideoMeeting: item.event.hasVideoMeeting || false,
            belongTo: item.event.projectCode || ''
          };
          setSelectedEvent(eventData);
          setIsEventModalOpen(true);
        }
      }}
      title={item.title}
    >
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${item.type === 'event' ? 'bg-purple-500' : 'bg-blue-500'}`}></div>
          <div className="flex items-center gap-1.5 min-w-0">
            {item.type === 'event' && item.event?.hasVideoMeeting && <Video size={10} className="text-purple-500 flex-shrink-0" />}
            <span className="truncate">{item.title}</span>
          </div>
        </div>
        {!isCompact && item.type === 'event' && item.event && (
          <div className="flex items-center gap-2 text-[9px] opacity-80 pl-3.5">
            {!item.event.isAllDay && item.event.startTime && (
              <div className="flex items-center gap-0.5">
                <Clock size={8} />
                <span>{item.event.startTime}</span>
              </div>
            )}
            {item.event.location && (
              <div className="flex items-center gap-0.5 truncate max-w-[60px]">
                <MapPin size={8} />
                <span className="truncate">{item.event.location}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // --- View Renderers ---
  const renderMonthView = () => {
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const startDay = startOfMonth.getDay();
    const daysInMonth = endOfMonth.getDate();
    const gridDays = [];

    // Padding days
    const prevMonthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0);
    for (let i = startDay - 1; i >= 0; i--) {
      gridDays.push({ day: prevMonthEnd.getDate() - i, isCurrentMonth: false, date: new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, prevMonthEnd.getDate() - i) });
    }
    // Current days
    for (let i = 1; i <= daysInMonth; i++) {
      gridDays.push({ day: i, isCurrentMonth: true, date: new Date(currentDate.getFullYear(), currentDate.getMonth(), i) });
    }
    // Next padding
    const remainingCells = 42 - gridDays.length;
    for (let i = 1; i <= remainingCells; i++) {
      gridDays.push({ day: i, isCurrentMonth: false, date: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, i) });
    }

    return (
      <div className="flex-1 flex flex-col overflow-hidden bg-white">
        <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50/30">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="py-3 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">{d}</div>
          ))}
        </div>
        <div className="flex-1 grid grid-cols-7 auto-rows-fr overflow-y-auto">
          {gridDays.map((item, idx) => {
            const isToday = item.date.toDateString() === new Date().toDateString();
            const items = getItemsForDay(item.date);
            return (
              <div
                key={idx}
                className={`min-h-[120px] border-b border-r border-gray-50 p-2 transition-all duration-200 group relative
                  ${!item.isCurrentMonth ? 'bg-gray-50/40' : isToday ? 'bg-blue-50/20' : 'bg-white'} 
                  hover:bg-gray-50`}
                onClick={() => { setCurrentDate(item.date); setIsEventModalOpen(true); }}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full transition-all
                    ${isToday ? 'bg-blue-600 text-white shadow-md scale-105' : !item.isCurrentMonth ? 'text-gray-300' : 'text-gray-700 group-hover:text-gray-900'}`}>
                    {item.day}
                  </span>
                </div>
                <div className="space-y-1">
                  {items.slice(0, 3).map(item => renderItemCard(item, true))}
                  {items.length > 3 && <div className="text-[10px] text-gray-400 pl-1">+{items.length - 3} more</div>}
                </div>
                <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-6 h-6 rounded-full bg-gray-100 hover:bg-blue-100 text-gray-400 hover:text-blue-600 flex items-center justify-center">
                    <Plus size={14} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const startOfWeek = getStartOfWeek(currentDate);
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek, i));

    return (
      <div className="flex-1 flex flex-col overflow-hidden bg-white">
        <div className="grid grid-cols-7 border-b border-gray-100 divide-x divide-gray-50 bg-gray-50/30">
          {weekDays.map((d, idx) => {
            const isToday = d.toDateString() === new Date().toDateString();
            return (
              <div key={idx} className={`py-4 text-center border-b-2 transition-colors ${isToday ? 'bg-blue-50/40 border-blue-500' : 'border-transparent'}`}>
                <div className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${isToday ? 'text-blue-600' : 'text-gray-400'}`}>{d.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                <div className={`text-2xl font-black tracking-tight ${isToday ? 'text-blue-600' : 'text-gray-800'}`}>{d.getDate()}</div>
              </div>
            );
          })}
        </div>
        <div className="flex-1 grid grid-cols-7 divide-x divide-gray-50 overflow-y-auto">
          {weekDays.map((d, idx) => {
            const items = getItemsForDay(d);
            const isToday = d.toDateString() === new Date().toDateString();
            return (
              <div key={idx} className={`p-2 min-h-full ${isToday ? 'bg-blue-50/5' : ''} hover:bg-gray-50 transition-colors`}
                onClick={() => { setCurrentDate(d); setIsEventModalOpen(true); }}>
                <div className="space-y-2 mt-2">
                  {items.map(item => renderItemCard(item))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderDayView = () => {
    const items = getItemsForDay(currentDate);
    // Simple timeline for now, can be enhanced
    const hours = Array.from({ length: 13 }, (_, i) => i + 8); // 8 AM to 8 PM

    return (
      <div className="flex-1 flex flex-col overflow-hidden bg-white">
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-3xl mx-auto">
            {/* All Day / Tasks Section */}
            <div className="mb-6">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">All Day / Tasks</h3>
              <div className="space-y-2">
                {items.filter(i => i.type === 'task' || (i.type === 'event' && i.event?.isAllDay)).map(item => renderItemCard(item))}
                {items.filter(i => i.type === 'task' || (i.type === 'event' && i.event?.isAllDay)).length === 0 && (
                  <div className="text-sm text-gray-400 italic">No all-day items</div>
                )}
              </div>
            </div>

            {/* Timeline */}
            <div className="relative border-l border-gray-200 ml-4 space-y-8 pb-10">
              {hours.map(hour => {
                const timeStr = `${hour.toString().padStart(2, '0')}:00`;
                // Find items starting around this hour
                const hourItems = items.filter(i => i.type === 'event' && !i.event?.isAllDay && i.event?.startTime?.startsWith(hour.toString().padStart(2, '0')));

                return (
                  <div key={hour} className="relative pl-8">
                    <div className="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full bg-gray-300 border-2 border-white"></div>
                    <span className="absolute -left-16 top-[-6px] text-xs font-medium text-gray-400 w-10 text-right">{timeStr}</span>

                    <div className="min-h-[40px]">
                      {hourItems.length > 0 ? (
                        <div className="space-y-2">
                          {hourItems.map(item => renderItemCard(item))}
                        </div>
                      ) : (
                        <div className="h-full border-b border-gray-50"></div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderListView = () => {
    // List items for the current month
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const days = [];
    for (let d = new Date(startOfMonth); d <= endOfMonth; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d));
    }

    return (
      <div className="flex-1 overflow-y-auto bg-white p-6">
        <div className="max-w-3xl mx-auto space-y-8">
          {days.map((day, idx) => {
            const items = getItemsForDay(day);
            if (items.length === 0) return null;

            const isToday = day.toDateString() === new Date().toDateString();

            return (
              <div key={idx} className="flex gap-6">
                <div className="w-24 flex-shrink-0 text-right">
                  <div className={`text-2xl font-bold ${isToday ? 'text-blue-600' : 'text-gray-800'}`}>{day.getDate()}</div>
                  <div className="text-xs font-semibold text-gray-400 uppercase">{day.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                </div>
                <div className="flex-1 space-y-2 pb-6 border-b border-gray-100 last:border-0">
                  {items.map(item => renderItemCard(item))}
                </div>
              </div>
            );
          })}
          {days.every(d => getItemsForDay(d).length === 0) && (
            <div className="text-center text-gray-400 py-20">No events or tasks for this month</div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200 font-sans">
      {/* Sidebar - Keep existing */}
      <div className="w-72 border-r border-gray-100 flex flex-col bg-gray-50/50 shrink-0">
        <div className="p-6">
          <button onClick={() => setIsEventModalOpen(true)} className="w-full bg-gray-900 hover:bg-black text-white font-medium py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-gray-200 transition-all hover:scale-[1.02] active:scale-[0.98]">
            <Plus size={18} /><span>Create Event</span>
          </button>
        </div>
        {/* Mini Calendar */}
        <div className="px-6 pb-6">
          <div className="flex justify-between items-center mb-4">
            <span className="font-bold text-gray-900 text-sm">{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
            <div className="flex gap-1">
              <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="p-1 hover:bg-gray-200 rounded-md text-gray-500"><ChevronLeft size={16} /></button>
              <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="p-1 hover:bg-gray-200 rounded-md text-gray-500"><ChevronRight size={16} /></button>
            </div>
          </div>
          <div className="grid grid-cols-7 text-center text-[10px] text-gray-400 mb-2 font-medium uppercase tracking-wider">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => <div key={d}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 text-center text-xs gap-y-2">
            {(() => {
              const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
              const startDay = start.getDay();
              const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
              const days = [];
              for (let i = 0; i < startDay; i++) days.push(null);
              for (let i = 1; i <= daysInMonth; i++) days.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), i));
              return days.map((d, i) => (
                <div key={i} className="flex justify-center">
                  {d ? (
                    <button onClick={() => setCurrentDate(d)} className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${d.toDateString() === currentDate.toDateString() ? 'bg-gray-900 text-white shadow-md' : d.toDateString() === new Date().toDateString() ? 'text-blue-600 font-bold bg-blue-50' : 'text-gray-700 hover:bg-gray-200'}`}>{d.getDate()}</button>
                  ) : <div className="w-8 h-8" />}
                </div>
              ));
            })()}
          </div>
        </div>
        <div className="flex-1 px-6">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Upcoming</div>
          <div className="text-sm text-gray-500 italic">No upcoming events</div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        {/* Header */}
        <div className="flex justify-between items-center px-8 py-6 border-b border-gray-100">
          <div className="flex items-center gap-6">
            <h2 className="text-3xl font-bold text-gray-900 tracking-tight">{getHeaderText()}</h2>
            <div className="flex items-center gap-2">
              <button onClick={() => changeDate(-1)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 border border-gray-200"><ChevronLeft size={20} /></button>
              <button onClick={() => changeDate(1)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 border border-gray-200"><ChevronRight size={20} /></button>
              <button onClick={() => setCurrentDate(new Date())} className="ml-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Today</button>
            </div>
          </div>
          <div className="flex bg-gray-100 p-1 rounded-lg">
            {['Month', 'Week', 'Day', 'List'].map(mode => (
              <button key={mode} onClick={() => setViewMode(mode as any)} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === mode ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{mode}</button>
            ))}
          </div>
        </div>

        {/* View Content */}
        {viewMode === 'Month' && renderMonthView()}
        {viewMode === 'Week' && renderWeekView()}
        {viewMode === 'Day' && renderDayView()}
        {viewMode === 'List' && renderListView()}
      </div>

      {/* Modals */}
      <EventModal isOpen={isEventModalOpen} onClose={() => { setIsEventModalOpen(false); setSelectedEvent(undefined); }} onSave={(data) => { if (onAddEvent) onAddEvent(data); }} teamMembers={teamMembers} projects={projects} initialDate={currentDate} eventToEdit={selectedEvent} onDelete={onDeleteEvent} />
      {selectedTask && (
        <TaskDetailModal
          isOpen={isTaskDetailOpen}
          onClose={() => { setIsTaskDetailOpen(false); setSelectedTask(null); }}
          task={selectedTask}
          phaseName={phases.find(p => p.tasks.some(t => t.id === selectedTask.id))?.name}
          onUpdateTask={(t) => { if (onUpdateTask) onUpdateTask(t); }}
          teamMembers={teamMembers}
          phases={phases}
        />
      )}
    </div>
  );
};
