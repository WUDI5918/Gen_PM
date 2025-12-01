
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { ProjectPhase, ProjectTask } from '../types';
import { parseDate, getDaysDiff, addDays, formatDate } from '../utils';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { useDialog } from '../contexts/DialogContext';
import { useLanguage } from '../contexts/LanguageContext';

interface GanttChartProps {
    phases: ProjectPhase[];
    onUpdatePhase?: (phase: ProjectPhase) => void;
    isEditing?: boolean;
}

const ROW_HEIGHT = 48;
const HEADER_HEIGHT = 48;

interface FlattenedItem {
    type: 'phase' | 'task';
    id: string;
    name: string;
    owner?: string;
    data?: ProjectTask;
    phaseId: string;
    startDate?: Date;
    endDate?: Date;
    top: number;
}

export const GanttChart: React.FC<GanttChartProps> = ({ phases, onUpdatePhase, isEditing = false }) => {
    const { addToast } = useToast();
    const { ask } = useDialog();
    const { t } = useLanguage();
    const containerRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Zoom State
    const [dayWidth, setDayWidth] = useState(40);

    const handleZoom = (delta: number) => {
        setDayWidth(prev => Math.max(20, Math.min(100, prev + delta)));
    };

    // --- 1. Calculation & Layout ---
    const { minDate, totalDays } = useMemo(() => {
        let min = new Date();
        let max = new Date();
        let hasDates = false;

        phases.forEach(p => {
            p.tasks.forEach(t => {
                if (t.startDate !== '-' && t.endDate !== '-') {
                    const start = parseDate(t.startDate);
                    const end = parseDate(t.endDate);
                    if (!hasDates) {
                        min = start;
                        max = end;
                        hasDates = true;
                    } else {
                        if (start < min) min = start;
                        if (end > max) max = end;
                    }
                }
            });
        });

        min = addDays(min, -3);
        max = addDays(max, 10);
        const days = getDaysDiff(min, max);
        return { minDate: min, totalDays: days };
    }, [phases]);

    const { items, taskCoordinates, totalHeight } = useMemo(() => {
        const result: FlattenedItem[] = [];
        const coords = new Map<string, { x: number, width: number, y: number, phaseId: string, task: ProjectTask }>();
        let currentTop = HEADER_HEIGHT;

        phases.forEach(phase => {
            // Phase Header
            result.push({
                type: 'phase',
                id: phase.id,
                name: phase.name,
                phaseId: phase.id,
                top: currentTop
            });
            currentTop += 32; // Smaller height for phase header

            // Tasks
            phase.tasks.forEach(task => {
                result.push({
                    type: 'task',
                    id: task.id,
                    name: task.subTaskName,
                    owner: task.owner,
                    data: task,
                    phaseId: phase.id,
                    top: currentTop
                });

                // Calculate Task Position if it has dates
                if (task.startDate !== '-' && task.endDate !== '-') {
                    const start = parseDate(task.startDate);
                    const end = parseDate(task.endDate);
                    const diffStart = getDaysDiff(minDate, start);
                    const diffDuration = Math.max(getDaysDiff(start, end), 1); // Min 1 day width

                    // Check if start is before minDate
                    const validStart = diffStart >= 0 ? diffStart : 0;

                    coords.set(task.id, {
                        x: validStart * dayWidth,
                        width: diffDuration * dayWidth,
                        y: currentTop + 8, // + padding to center in row
                        phaseId: phase.id,
                        task: task
                    });
                }

                currentTop += ROW_HEIGHT;
            });
        });
        return { items: result, taskCoordinates: coords, totalHeight: currentTop };
    }, [phases, minDate, dayWidth]); 

    const headerDates = useMemo(() => {
        const dates = [];
        for (let i = 0; i <= totalDays; i++) {
            dates.push(addDays(minDate, i));
        }
        return dates;
    }, [minDate, totalDays]);

    // Calculate Today's Position
    const todayX = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diff = getDaysDiff(minDate, today);
        if (diff < 0 || diff > totalDays) return null;
        return diff * dayWidth + (dayWidth / 2);
    }, [minDate, totalDays, dayWidth]);


    // --- 2. Interaction State ---

    // Dragging Task
    const [dragState, setDragState] = useState<{
        taskId: string;
        phaseId: string;
        startX: number;
        originalStart: Date;
        originalEnd: Date;
        currentDeltaDays: number;
    } | null>(null);

    // Linking Dependencies
    const [linkState, setLinkState] = useState<{
        sourceTaskId: string;
        sourceAnchor: 'start' | 'end'; 
        startX: number;
        startY: number;
        currentX: number;
        currentY: number;
    } | null>(null);

    // Hovering over a dependency line (for deletion)
    const [hoveredDependency, setHoveredDependency] = useState<{ source: string, target: string } | null>(null);


    // --- 3. Helper Functions ---

    // Enhanced "Smart Path" routing to avoid collisions and optimize layout
    const drawSmartPath = (startX: number, startY: number, endX: number, endY: number, offsetIndex: number = 0): { path: string, center: { x: number, y: number } } => {
        const radius = 10;
        const gap = 20;
        const verticalOffset = (offsetIndex % 5) * 3; // Prevents overlapping lines
        
        let path = `M ${startX} ${startY} `;
        let centerX = 0;
        let centerY = 0;

        // Case 1: Target is comfortably ahead (Forward Link)
        if (endX > startX + gap * 2) {
            const midX = startX + gap;
            // Simple S-Curve style with orthogonal segments
            path += `L ${midX} ${startY} `;
            
            if (Math.abs(endY - startY) > radius * 2) {
                // Vertical Step
                const midY = startY + (endY > startY ? radius : -radius);
                path += `Q ${midX + radius} ${startY} ${midX + radius} ${midY} `; // Turn down/up
                path += `L ${midX + radius} ${endY + (endY > startY ? -radius : radius)} `; // Vertical line
                path += `Q ${midX + radius} ${endY} ${midX + radius * 2} ${endY} `; // Turn to target
                path += `L ${endX} ${endY}`;
                
                centerX = midX + radius;
                centerY = (startY + endY) / 2;
            } else {
                // Direct horizontalish
                path += `L ${endX} ${endY}`;
                centerX = (startX + endX) / 2;
                centerY = startY;
            }
        }
        // Case 2: Target is behind or very close (Backward/Loop Link)
        else {
            const safeY = startY + 28 + verticalOffset; 
            const loopBackX = endX - gap - 10; 

            path += `L ${startX + gap} ${startY} `; // Out right
            path += `Q ${startX + gap + radius} ${startY} ${startX + gap + radius} ${startY + radius} `; // Turn Down
            
            // Go down to safe Y
            path += `L ${startX + gap + radius} ${safeY - radius} `;
            path += `Q ${startX + gap + radius} ${safeY} ${startX + gap} ${safeY} `; // Turn Left
            
            // Go Left past target
            path += `L ${loopBackX + radius} ${safeY} `;
            
            // Go Up/Down to Target Y
            if (endY < safeY) {
                // Target is above (typical loop back)
                path += `Q ${loopBackX} ${safeY} ${loopBackX} ${safeY - radius} `; // Turn Up
                path += `L ${loopBackX} ${endY + radius} `; // Up line
                path += `Q ${loopBackX} ${endY} ${loopBackX + radius} ${endY} `; // Turn Right
            } else {
                // Target is below (but X is behind)
                path += `Q ${loopBackX} ${safeY} ${loopBackX} ${safeY + radius} `; // Turn Down
                path += `L ${loopBackX} ${endY - radius} `; // Down line
                path += `Q ${loopBackX} ${endY} ${loopBackX + radius} ${endY} `; // Turn Right
            }
            
            path += `L ${endX} ${endY}`;

            centerX = loopBackX;
            centerY = (safeY + endY) / 2;
        }

        return { path, center: { x: centerX, y: centerY } };
    };

    // --- 4. Event Handlers ---

    const handleTaskMouseDown = (e: React.MouseEvent, task: ProjectTask, phaseId: string) => {
        if (!isEditing || !onUpdatePhase) return;
        if (task.startDate === '-' || task.endDate === '-') return;
        if ((e.target as HTMLElement).closest('.link-handle')) return;

        e.stopPropagation();

        setDragState({
            taskId: task.id,
            phaseId,
            startX: e.clientX,
            originalStart: parseDate(task.startDate),
            originalEnd: parseDate(task.endDate),
            currentDeltaDays: 0
        });
    };

    const handleLinkMouseDown = (e: React.MouseEvent, taskId: string, anchor: 'start' | 'end') => {
        if (!isEditing || !onUpdatePhase) return;
        e.stopPropagation();
        e.preventDefault();

        const coords = taskCoordinates.get(taskId);
        if (!coords) return;

        if (!scrollContainerRef.current) return;

        // Calculate anchor position based on anchor type
        const startX = anchor === 'end' ? coords.x + coords.width : coords.x;
        const startY = coords.y + 16;

        setLinkState({
            sourceTaskId: taskId,
            sourceAnchor: anchor,
            startX: startX,
            startY: startY,
            currentX: startX,
            currentY: startY
        });
    };

    const handleDeleteDependency = (targetTaskId: string, sourceTaskId: string) => {
        if (!onUpdatePhase) return;

        const targetPhase = phases.find(p => p.tasks.some(t => t.id === targetTaskId));
        if (!targetPhase) return;

        ask({
            title: t('common.delete'),
            message: t('gantt.delete_dep_msg'),
            type: 'danger',
            confirmText: t('common.delete'),
            cancelText: t('common.cancel'),
            onConfirm: () => {
                onUpdatePhase({
                    ...targetPhase,
                    tasks: targetPhase.tasks.map(t => t.id === targetTaskId ? {
                        ...t,
                        dependencies: t.dependencies.filter(d => d !== sourceTaskId)
                    } : t)
                });
                addToast(t('gantt.dep_removed'), 'info');
            }
        });
    };

    // Handle dropping a link onto a task
    const handleLinkDrop = (targetTaskId: string) => {
        if (!linkState || !onUpdatePhase) return;
        if (linkState.sourceTaskId === targetTaskId) return; // No self-loop

        const targetPhase = phases.find(p => p.tasks.some(t => t.id === targetTaskId));
        if (!targetPhase) return;

        const targetTask = targetPhase.tasks.find(t => t.id === targetTaskId);
        if (targetTask && !targetTask.dependencies.includes(linkState.sourceTaskId)) {
            const updatedTasks = targetPhase.tasks.map(t => t.id === targetTaskId ? {
                ...t,
                dependencies: [...t.dependencies, linkState.sourceTaskId]
            } : t);
            onUpdatePhase({ ...targetPhase, tasks: updatedTasks });
            addToast(t('gantt.dep_created'), 'success');
        }
        setLinkState(null);
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (dragState) {
                const deltaPixels = e.clientX - dragState.startX;
                const deltaDays = Math.round(deltaPixels / dayWidth);
                setDragState(prev => prev ? { ...prev, currentDeltaDays: deltaDays } : null);
            }

            if (linkState && scrollContainerRef.current) {
                const rect = scrollContainerRef.current.getBoundingClientRect();
                const relX = e.clientX - rect.left + scrollContainerRef.current.scrollLeft;
                const relY = e.clientY - rect.top + scrollContainerRef.current.scrollTop;

                setLinkState(prev => prev ? { ...prev, currentX: relX, currentY: relY } : null);
            }
        };

        const handleMouseUp = (e: MouseEvent) => {
            if (dragState && onUpdatePhase) {
                const { phaseId, taskId, originalStart, originalEnd, currentDeltaDays } = dragState;
                if (currentDeltaDays !== 0) {
                    const newStart = addDays(originalStart, currentDeltaDays);
                    const newEnd = addDays(originalEnd, currentDeltaDays);
                    
                    const phase = phases.find(p => p.id === phaseId);
                    if (phase) {
                        const updatedTasks = phase.tasks.map(t => 
                            t.id === taskId 
                            ? { ...t, startDate: formatDate(newStart), endDate: formatDate(newEnd) }
                            : t
                        );
                        onUpdatePhase({ ...phase, tasks: updatedTasks });
                    }
                }
                setDragState(null);
            }

            if (linkState) {
                setLinkState(null);
            }
        };

        if (dragState || linkState) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [dragState, linkState, dayWidth, onUpdatePhase, phases]);

    return (
        <div className="h-full flex flex-col bg-white" ref={containerRef}>
            
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-gray-50 shrink-0">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="font-bold">{t('gantt.task_list')}</span>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => handleZoom(-10)} className="p-1.5 rounded hover:bg-gray-200"><ZoomOut size={16} /></button>
                    <span className="text-xs font-mono">{dayWidth}px</span>
                    <button onClick={() => handleZoom(10)} className="p-1.5 rounded hover:bg-gray-200"><ZoomIn size={16} /></button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden relative">
                {/* Sidebar (Task List) */}
                <div className="w-[260px] shrink-0 border-r border-gray-200 overflow-y-hidden bg-white z-10 shadow-lg flex flex-col">
                    <div className="h-12 bg-gray-50 border-b border-gray-200 flex items-center px-4 font-bold text-xs text-gray-500 uppercase">
                        {t('table.task_name')}
                    </div>
                    <div className="flex-1 overflow-y-hidden" style={{ marginTop: -scrollContainerRef.current?.scrollTop || 0 }}> 
                        {items.map(item => (
                            <div 
                                key={item.id} 
                                className={`px-4 flex items-center border-b border-gray-100 truncate ${item.type === 'phase' ? 'bg-gray-100 font-bold text-gray-700' : 'hover:bg-indigo-50 text-sm text-gray-600'}`}
                                style={{ height: item.type === 'phase' ? 32 : ROW_HEIGHT }}
                            >
                                {item.name}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Main Chart Area */}
                <div className="flex-1 overflow-auto relative bg-white" ref={scrollContainerRef}>
                    <div style={{ height: totalHeight, width: totalDays * dayWidth, position: 'relative', minWidth: '100%' }}>
                        
                        {/* Grid Background */}
                        <div className="absolute inset-0 pointer-events-none">
                            {headerDates.map((d, i) => (
                                <div 
                                    key={i} 
                                    className={`absolute top-0 bottom-0 border-r border-gray-100 ${d.getDay() === 0 || d.getDay() === 6 ? 'bg-gray-50/50' : ''}`}
                                    style={{ left: i * dayWidth, width: dayWidth }}
                                ></div>
                            ))}
                            {todayX !== null && (
                                <div className="absolute top-0 bottom-0 border-l-2 border-red-400 z-0" style={{ left: todayX }}></div>
                            )}
                        </div>

                        {/* Header Row */}
                        <div className="sticky top-0 z-20 bg-white border-b border-gray-200 flex h-12" style={{ width: totalDays * dayWidth }}>
                            {headerDates.map((d, i) => (
                                <div key={i} className="flex-shrink-0 border-r border-gray-100 flex flex-col items-center justify-center text-xs text-gray-500" style={{ width: dayWidth }}>
                                    <span className="font-bold">{d.getDate()}</span>
                                    <span className="text-[9px] uppercase">{d.toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
                                </div>
                            ))}
                        </div>

                        {/* Content */}
                        {items.map(item => {
                            if (item.type === 'phase') {
                                return (
                                    <div 
                                        key={item.id} 
                                        className="absolute left-0 right-0 bg-gray-100/50 border-b border-gray-200 z-0"
                                        style={{ top: item.top, height: 32 }}
                                    ></div>
                                );
                            }

                            const coords = taskCoordinates.get(item.id);
                            if (!coords || !item.data) return null;

                            const isDragging = dragState?.taskId === item.id;
                            const deltaX = isDragging ? dragState.currentDeltaDays * dayWidth : 0;
                            
                            const finalX = coords.x + deltaX;
                            const finalWidth = coords.width;

                            const statusColor = item.data.status === 'Completed' ? 'bg-emerald-500' : item.data.status === 'In Progress' ? 'bg-blue-500' : item.data.status === 'Delayed' ? 'bg-rose-500' : 'bg-indigo-400';

                            return (
                                <div key={item.id} className="absolute w-full" style={{ top: item.top, height: ROW_HEIGHT }}>
                                    {/* Grid Row Highlight */}
                                    <div className="absolute inset-0 border-b border-gray-100 hover:bg-gray-50/50 pointer-events-none"></div>

                                    {/* Task Bar */}
                                    <div 
                                        className={`absolute h-8 rounded-md shadow-sm text-white text-xs flex items-center px-2 overflow-hidden cursor-pointer select-none transition-shadow ${statusColor} ${isDragging ? 'ring-2 ring-indigo-300 z-30 opacity-90' : 'hover:brightness-110 z-10'}`}
                                        style={{ left: finalX, width: finalWidth, top: 8 }}
                                        onMouseDown={(e) => handleTaskMouseDown(e, item.data!, item.phaseId)}
                                        onMouseUp={() => handleLinkDrop(item.id)} 
                                    >
                                        {/* Link Handles */}
                                        {isEditing && (
                                            <>
                                            <div 
                                                className="link-handle absolute left-0 top-0 bottom-0 w-3 hover:bg-black/20 cursor-crosshair flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                                                onMouseDown={(e) => handleLinkMouseDown(e, item.id, 'start')}
                                            ></div>
                                            <div 
                                                className="link-handle absolute right-0 top-0 bottom-0 w-3 hover:bg-black/20 cursor-crosshair flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                                                onMouseDown={(e) => handleLinkMouseDown(e, item.id, 'end')}
                                            ></div>
                                            </>
                                        )}

                                        <span className="truncate font-medium drop-shadow-md">{item.name}</span>
                                        
                                        {/* Owner Avatar */}
                                        {item.owner && item.owner !== 'Unassigned' && (
                                            <div className="absolute right-1 w-5 h-5 bg-white/20 rounded-full flex items-center justify-center text-[8px]">
                                                {item.owner.charAt(0)}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {/* Dependencies */}
                        <svg className="absolute inset-0 pointer-events-none z-0" style={{ width: totalDays * dayWidth, height: totalHeight }}>
                            <defs>
                                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                                    <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
                                </marker>
                                <marker id="arrowhead-hover" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                                    <polygon points="0 0, 10 3.5, 0 7" fill="#ef4444" />
                                </marker>
                            </defs>
                            {Array.from(taskCoordinates.values()).flatMap(target => {
                                const targetTask = target.task;
                                return targetTask.dependencies.map((sourceId, idx) => {
                                    const source = taskCoordinates.get(sourceId);
                                    if (!source) return null;

                                    // Calculate dynamic positions based on drag state if dragging
                                    let sX = source.x + source.width;
                                    let sY = source.y + 16;
                                    let tX = target.x;
                                    let tY = target.y + 16;

                                    if (dragState?.taskId === sourceId) {
                                        sX += dragState.currentDeltaDays * dayWidth;
                                    }
                                    if (dragState?.taskId === targetTask.id) {
                                        tX += dragState.currentDeltaDays * dayWidth;
                                    }

                                    const { path } = drawSmartPath(sX, sY, tX, tY, idx);
                                    const isHovered = hoveredDependency?.source === sourceId && hoveredDependency?.target === targetTask.id;

                                    return (
                                        <g 
                                            key={`${sourceId}-${targetTask.id}`} 
                                            className="pointer-events-auto cursor-pointer"
                                            onMouseEnter={() => setHoveredDependency({ source: sourceId, target: targetTask.id })}
                                            onMouseLeave={() => setHoveredDependency(null)}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteDependency(targetTask.id, sourceId);
                                            }}
                                        >
                                            {/* Invisible thick path for easier hovering */}
                                            <path d={path} stroke="transparent" strokeWidth="10" fill="none" />
                                            {/* Visible path */}
                                            <path 
                                                d={path} 
                                                stroke={isHovered ? '#ef4444' : '#cbd5e1'} 
                                                strokeWidth={isHovered ? 2 : 1.5} 
                                                fill="none" 
                                                markerEnd={isHovered ? "url(#arrowhead-hover)" : "url(#arrowhead)"}
                                                className="transition-colors"
                                            />
                                        </g>
                                    );
                                });
                            })}

                            {/* Active Linking Line */}
                            {linkState && (
                                <path 
                                    d={`M ${linkState.startX} ${linkState.startY} L ${linkState.currentX} ${linkState.currentY}`} 
                                    stroke="#6366f1" 
                                    strokeWidth="2" 
                                    strokeDasharray="4 2"
                                    fill="none" 
                                />
                            )}
                        </svg>

                    </div>
                </div>
            </div>
        </div>
    );
};
