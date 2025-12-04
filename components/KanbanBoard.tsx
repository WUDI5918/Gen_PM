
import React, { useState, useRef } from 'react';
import { ProjectPhase, ProjectTask, TaskStatus, TeamMember } from '../types';
import { Calendar, AlertCircle, ListChecks, Clock, Flag, Paperclip, MessageSquare, User, GripHorizontal, Circle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { parseDate } from '../utils';

interface KanbanBoardProps {
  phases: ProjectPhase[];
  isEditing: boolean;
  onUpdateTaskStatus: (phaseId: string, taskId: string, newStatus: TaskStatus) => void;
  onTaskClick?: (phaseId: string, taskId: string) => void;
  teamMembers?: TeamMember[];
}

const STATUS_COLUMNS = [
  { id: TaskStatus.Pending, labelKey: 'status.Pending', color: 'border-gray-200 bg-gray-50/50', headerColor: 'border-t-4 border-t-gray-400' },
  { id: TaskStatus.InProgress, labelKey: 'status.In Progress', color: 'border-blue-100 bg-blue-50/30', headerColor: 'border-t-4 border-t-blue-500' },
  { id: TaskStatus.Completed, labelKey: 'status.Completed', color: 'border-emerald-100 bg-emerald-50/30', headerColor: 'border-t-4 border-t-emerald-500' },
  { id: TaskStatus.Delayed, labelKey: 'status.Delayed', color: 'border-rose-100 bg-rose-50/30', headerColor: 'border-t-4 border-t-rose-500' },
];

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ phases = [], isEditing, onUpdateTaskStatus, onTaskClick, teamMembers = [] }) => {
  const { t } = useLanguage();
  const [draggedItem, setDraggedItem] = useState<{ taskId: string, phaseId: string } | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);

  // Track drag state and position to prevent click after drag
  const isDraggingRef = useRef(false);
  const ignoreClickRef = useRef(false);
  const dragStartPos = useRef<{ x: number, y: number } | null>(null);

  // Flatten tasks to process them easily
  const getAllTasks = () => {
    const tasks: { task: ProjectTask; phaseId: string; phaseName: string }[] = [];
    phases.forEach(p => {
      p.tasks.forEach(t => {
        tasks.push({ task: t, phaseId: p.id, phaseName: p.name });
      });
    });
    return tasks;
  };

  const allTasks = getAllTasks();

  // --- Drag & Drop Handlers ---
  const handleDragStart = (e: React.DragEvent, taskId: string, phaseId: string) => {
    if (!isEditing) return;
    isDraggingRef.current = true;
    ignoreClickRef.current = true; // Block subsequent clicks for this interaction cycle
    setDraggedItem({ taskId, phaseId });
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.classList.add('opacity-50');
  };

  const handleDragEnd = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('opacity-50');
    setDraggedItem(null);
    setDragOverColumn(null);

    // We reset isDraggingRef immediately
    isDraggingRef.current = false;
    // ignoreClickRef remains true until the next mouse interaction clears it, 
    // ensuring the 'click' event triggered by mouseup doesn't fire the modal.
    setTimeout(() => { ignoreClickRef.current = false; }, 100);
  };

  const handleDragOver = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    if (draggedItem && dragOverColumn !== status) {
      setDragOverColumn(status);
    }
  };

  const handleDrop = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    setDragOverColumn(null);

    if (draggedItem) {
      if (draggedItem.taskId) {
        const currentTask = allTasks.find(t => t.task.id === draggedItem.taskId);
        if (currentTask && currentTask.task.status !== status) {
          onUpdateTaskStatus(draggedItem.phaseId, draggedItem.taskId, status);
        }
      }
    }
    setDraggedItem(null);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // New interaction started
    isDraggingRef.current = false;
    ignoreClickRef.current = false;
    dragStartPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleCardDoubleClick = (e: React.MouseEvent, phaseId: string, taskId: string) => {
    // 1. Check if we are in preview mode
    if (!isEditing) return;

    // 2. Check flags explicitly set by drag handlers
    if (isDraggingRef.current || ignoreClickRef.current) {
      e.stopPropagation();
      return;
    }

    // 3. Check coordinate delta to catch native drags or sloppy clicks that didn't fire dragStart
    if (dragStartPos.current) {
      const dx = Math.abs(e.clientX - dragStartPos.current.x);
      const dy = Math.abs(e.clientY - dragStartPos.current.y);
      // If moved more than 5px, assume it was a drag/select action, not a clean click
      if (dx > 5 || dy > 5) return;
    }

    if (onTaskClick) onTaskClick(phaseId, taskId);
  };

  const getPriorityIcon = (score: string) => {
    const color = score === 'High' ? 'text-rose-500 fill-rose-500' : score === 'Med' ? 'text-amber-500 fill-amber-500' : 'text-blue-400';
    return <Flag size={14} className={color} />;
  };

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

  const getOwnerAvatar = (name: string) => {
    const member = teamMembers?.find(m => m.name === name);
    if (member) {
      return (
        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white border border-white shadow-sm ${member.color.replace('text-', 'bg-').replace('bg-', 'bg-opacity-100 bg-')}`} title={member.name}>
          {member.avatar}
        </div>
      );
    }
    return (
      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold bg-gray-100 text-gray-500 border border-white" title={t('kanban.unassigned')}>
        <User size={10} />
      </div>
    );
  };

  return (
    <div className="flex overflow-x-auto gap-4 pb-4 h-full min-h-[500px] custom-scrollbar p-4 bg-gray-50">
      {STATUS_COLUMNS.map((col) => (
        <div
          key={col.id}
          className={`flex-shrink-0 w-80 flex flex-col rounded-xl border transition-all duration-200 ${col.color} ${dragOverColumn === col.id ? 'ring-2 ring-indigo-400 ring-offset-2 bg-indigo-50' : ''}`}
          onDragOver={(e) => handleDragOver(e, col.id)}
          onDrop={(e) => handleDrop(e, col.id)}
        >
          {/* Column Header */}
          <div className={`p-4 font-bold text-gray-700 bg-white rounded-t-xl border-b border-gray-100 flex justify-between items-center shadow-sm ${col.headerColor}`}>
            <span className="flex items-center gap-2 text-sm">
              {col.id === TaskStatus.Pending && <Circle size={16} className="text-gray-400" />}
              {col.id === TaskStatus.Delayed && <AlertCircle size={16} className="text-rose-500" />}
              {col.id === TaskStatus.Completed && <ListChecks size={16} className="text-emerald-500" />}
              {col.id === TaskStatus.InProgress && <Clock size={16} className="text-blue-500" />}
              {t(col.labelKey)}
            </span>
            <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full text-xs font-mono">
              {allTasks.filter(item => item.task.status === col.id).length}
            </span>
          </div>

          {/* Cards Container */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
            {allTasks
              .filter(item => item.task.status === col.id)
              .map(({ task, phaseId, phaseName }) => {
                const overdueDays = getOverdueDays(task);
                const completedChecks = task.checklist.filter(c => c.isCompleted).length;
                const totalChecks = task.checklist.length;

                return (
                  <div
                    key={task.id}
                    draggable={isEditing}
                    onDragStart={(e) => handleDragStart(e, task.id, phaseId)}
                    onDragEnd={handleDragEnd}
                    onMouseDown={handleMouseDown}
                    onDoubleClick={(e) => handleCardDoubleClick(e, phaseId, task.id)}
                    className={`bg-white p-4 rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-indigo-200 transition-all group relative flex flex-col gap-3 select-none ${isEditing ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
                  >
                    {/* Header: Phase + Priority */}
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md truncate max-w-[140px]">
                        {phaseName}
                      </span>
                      <div className="flex items-center gap-1" title={`Priority: ${task.score}`}>
                        {getPriorityIcon(task.score)}
                      </div>
                    </div>

                    {/* Content */}
                    <div>
                      <h4 className="text-sm font-bold text-gray-800 leading-snug mb-1.5">{task.subTaskName}</h4>
                      {task.workContent && (
                        <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed text-opacity-80">
                          {task.workContent}
                        </p>
                      )}
                    </div>

                    {/* Tags / Remarks */}
                    {(task.remarks || []).length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {(task.remarks || []).slice(0, 2).map(r => (
                          <span key={r.id} className={`text-[9px] px-1.5 py-0.5 rounded border font-medium flex items-center gap-1 ${r.isWarning ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                            {r.isWarning ? <AlertCircle size={8} /> : <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>}
                            {r.text}
                          </span>
                        ))}
                        {(task.remarks || []).length > 2 && <span className="text-[9px] text-gray-400 px-1">+{(task.remarks || []).length - 2}</span>}
                      </div>
                    )}

                    {/* Footer: Date, Stats, Avatar */}
                    <div className="flex items-center justify-between pt-2 mt-1 border-t border-gray-50">
                      <div className={`flex items-center gap-1.5 text-[10px] font-medium ${overdueDays ? 'text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded' : 'text-gray-400'}`}>
                        <Calendar size={12} className={overdueDays ? 'text-rose-500' : 'text-gray-300'} />
                        <span>{task.endDate && task.endDate !== '-' ? task.endDate.slice(5).replace('-', '/') : ''}</span>
                      </div>

                      <div className="flex items-center gap-3">
                        {(task.comments.length > 0 || task.attachments.length > 0 || totalChecks > 0) && (
                          <div className="flex items-center gap-2 text-gray-400">
                            {totalChecks > 0 && (
                              <div className="flex items-center gap-0.5" title="Checklist">
                                <ListChecks size={12} /> <span className="text-[9px]">{completedChecks}/{totalChecks}</span>
                              </div>
                            )}
                            {(task.attachments.length > 0 || task.comments.length > 0) && (
                              <div className="flex items-center gap-0.5">
                                {task.attachments.length > 0 && <Paperclip size={12} />}
                                {task.comments.length > 0 && <MessageSquare size={12} />}
                                <span className="text-[9px]">{task.attachments.length + task.comments.length}</span>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="pl-1">
                          {getOwnerAvatar(task.owner)}
                        </div>
                      </div>
                    </div>

                    {/* Drag Handle Visual */}
                    {isEditing && (
                      <div className="absolute top-2 right-2 text-gray-200 opacity-0 group-hover:opacity-100 transition-opacity">
                        <GripHorizontal size={14} />
                      </div>
                    )}
                  </div>
                )
              })}

            {allTasks.filter(item => item.task.status === col.id).length === 0 && (
              <div className="h-full min-h-[100px] flex flex-col items-center justify-center text-gray-400 text-xs italic border-2 border-dashed border-gray-200 rounded-xl bg-white/50 hover:bg-indigo-50/50 transition-colors">
                {t('kanban.drop')}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
