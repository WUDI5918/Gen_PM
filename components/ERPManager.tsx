import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import {
    Plus, Trash2, GripVertical, Code, Eye, Save, Type, List,
    CheckSquare, Calendar, Hash, ArrowDown,
    Minus, AlertCircle, Info, Table as TableIcon,
    RefreshCw, X, MoveVertical, AlertTriangle, CheckCircle, Bell,
    Filter, Search, Bookmark, Download, Upload, Copy, Grid,
    Settings2, LayoutTemplate, Circle as CircleIcon,
    ChevronRight, ChevronDown, MoreHorizontal, Database, ArrowRight,
    Maximize2, Columns, Edit3, Check, ChevronUp, Layers, BoxSelect,
    ToggleLeft, FileText, PenTool, Star, CreditCard, Clock, Link,
    ListOrdered, Folder, Sidebar, FormInput, BookOpen, Lightbulb, FunctionSquare, Calculator, Regex
} from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

// --- Configuration Constants ---
const InitialSchema = [
    { id: 'f_title', type: 'divider', label: 'Basic Info', width: '100%' },
    { id: 'f_notice_1', type: 'notice', label: 'Instructions', width: '100%', noticeType: 'info', content: 'Ensure all product data matches the ERP master data.' },
    { id: 'f1', type: 'text', label: 'Product Name', required: true, width: '50%', placeholder: 'Enter product name...' },
    { id: 'f2', type: 'select', label: 'Category', required: true, width: '50%', options: ['Electronics', 'Mechanical', 'Consumables'] },

    { id: 'f_logic_demo', type: 'divider', label: 'Logic Engine Demo', width: '100%' },
    { id: 'f_show_details', type: 'radio', label: 'Show Advanced Details?', required: true, width: '100%', options: ['Yes', 'No'] },

    // Visibility Rule Demo
    {
        id: 'f_details',
        type: 'text',
        label: 'Extra Details (Visible if Yes)',
        width: '100%',
        logic: { visibility: "{f_show_details} == 'Yes'" }
    },

    // Calculation Demo
    { id: 'f_calc_title', type: 'notice', label: 'Calculation Demo', width: '100%', noticeType: 'warning', content: 'Try changing Price or Qty to see auto-calculation.' },
    { id: 'price', type: 'number', label: 'Price', required: true, width: '33%', placeholder: '0' },
    { id: 'qty', type: 'number', label: 'Quantity', required: true, width: '33%', placeholder: '0' },
    {
        id: 'total',
        type: 'number',
        label: 'Total (Price * Qty)',
        width: '33%',
        logic: { calculation: "{price} * {qty}", readOnly: "true" }
    },

    // Regex Demo
    {
        id: 'email',
        type: 'text',
        label: 'Email (Regex Validated)',
        width: '100%',
        placeholder: 'example@domain.com',
        logic: { regex: "^[\\w-\\.]+@([\\w-]+\\.)+[\\w-]{2,4}$", errorMsg: "Invalid email format" }
    },

    { id: 'f_dates_demo', type: 'divider', label: 'Advanced Logic: Dates & Validation', width: '100%' },
    { id: 'start_date', type: 'date', label: 'Start Date', width: '50%', required: true },
    {
        id: 'end_date',
        type: 'date',
        label: 'End Date',
        width: '50%',
        required: true,
        logic: {
            customRule: "DAYS({end_date}, {start_date}) >= 0",
            customErrorMsg: "End Date must be after Start Date"
        }
    },
    {
        id: 'duration_days',
        type: 'number',
        label: 'Duration (Days)',
        width: '100%',
        logic: {
            calculation: "DAYS({end_date}, {start_date})",
            readOnly: "true"
        }
    },

    { id: 'f_string_logic', type: 'divider', label: 'String & Dynamic Logic', width: '100%' },
    {
        id: 'region',
        type: 'select',
        label: 'Region',
        width: '50%',
        options: ['North America', 'Europe', 'Asia'],
        required: true
    },
    {
        id: 'city',
        type: 'select',
        label: 'City (Dynamic Options)',
        width: '50%',
        options: [],
        logic: {
            // Example of logic-based options
            optionsRule: "IF({region} == 'North America', ['New York', 'Toronto', 'Chicago'], IF({region} == 'Europe', ['London', 'Berlin', 'Paris'], ['Tokyo', 'Beijing', 'Seoul']))"
        }
    },
    {
        id: 'sku_code',
        type: 'text',
        label: 'Generated SKU Code',
        width: '100%',
        logic: {
            calculation: "UPPER(CONCAT({region}, '-', {city}, '-', ROUND(RAND() * 1000, 0)))",
            readOnly: "true"
        },
        helpText: "Auto-generated from Region + City + Random ID"
    },

    { id: 'f_api_demo', type: 'divider', label: 'External Data (API Simulation)', width: '100%' },
    {
        id: 'user_id',
        type: 'select',
        label: 'Select User ID',
        width: '50%',
        options: ['101', '102', '103'],
        required: true
    },
    {
        id: 'user_name',
        type: 'text',
        label: 'Fetched Name',
        width: '50%',
        logic: {
            // MOCK_LOOKUP(dataset, key, field)
            apiRule: "MOCK_LOOKUP('users', {user_id}, 'name')",
            readOnly: "true"
        }
    },
    {
        id: 'user_role',
        type: 'text',
        label: 'Fetched Role',
        width: '50%',
        logic: {
            apiRule: "MOCK_LOOKUP('users', {user_id}, 'role')",
            readOnly: "true"
        }
    },
    {
        id: 'user_dept',
        type: 'text',
        label: 'Fetched Dept',
        width: '50%',
        logic: {
            apiRule: "MOCK_LOOKUP('users', {user_id}, 'dept')",
            readOnly: "true"
        }
    }
];

// --- Helper Functions ---
const getOperatorsForType = (type: string) => {
    switch (type) {
        case 'number': return [
            { val: 'eq', label: '等于 (=)' },
            { val: 'gt', label: '大于 (>)' },
            { val: 'lt', label: '小于 (<)' },
            { val: 'gte', label: '大于等于 (>=)' },
            { val: 'lte', label: '小于等于 (<=)' }
        ];
        case 'date': return [
            { val: 'eq', label: '等于' },
            { val: 'before', label: '早于' },
            { val: 'after', label: '晚于' }
        ];
        case 'select':
        case 'radio':
            return [
                { val: 'eq', label: '是' },
                { val: 'neq', label: '不是' }
            ];
        default: return [
            { val: 'contains', label: '包含' },
            { val: 'eq', label: '等于' },
            { val: 'neq', label: '不等于' }
        ];
    }
};

const safeRenderValue = (val: any) => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'object') return JSON.stringify(val);
    return val;
};

// --- Mock API Database for Simulation ---
const MOCK_DB: any = {
    users: {
        '101': { name: 'Alice Smith', role: 'Manager', dept: 'Sales' },
        '102': { name: 'Bob Jones', role: 'Engineer', dept: 'IT' },
        '103': { name: 'Charlie Day', role: 'Analyst', dept: 'Finance' }
    },
    products: {
        'P-001': { price: 1200, stock: 55 },
        'P-002': { price: 850, stock: 12 }
    }
};

// --- Logic Engine Core ---
// --- Logic Engine Core ---
const evaluateExpression = (expr: string, data: any) => {
    if (!expr) return null;
    try {
        // 1. Pre-process text markers ex: {field_id}
        const processedExpr = expr.replace(/\{(\w+)\}/g, (match, fieldId) => {
            const val = data[fieldId];
            if (val === undefined || val === null || val === '') return 'null';
            if (!isNaN(Number(val)) && typeof val !== 'boolean') return Number(val).toString(); // Number
            return `'${String(val).replace(/'/g, "\\'")}'`; // String escape quotes
        });

        // 2. Define Helper Functions directly in the evaluated string scope
        const funcBody = `
            const DAYS = (d1, d2) => {
                 if(!d1 || !d2) return 0;
                 const t1 = new Date(d1).getTime();
                 const t2 = new Date(d2).getTime();
                 if(isNaN(t1) || isNaN(t2)) return 0;
                 return Math.ceil((t1 - t2) / (1000 * 60 * 60 * 24));
            };
            const IF = (c, t, f) => c ? t : f;
            const NOW = () => new Date().toISOString().split('T')[0];
            const YEAR = (d) => new Date(d).getFullYear();
            const MONTH = (d) => new Date(d).getMonth() + 1;
            
            const CONCAT = (...args) => args.join('');
            const UPPER = (s) => String(s||'').toUpperCase();
            const LOWER = (s) => String(s||'').toLowerCase();
            const LEN = (s) => String(s||'').length;
            const ISEMPTY = (v) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
            
            const MAX = (...args) => Math.max(...args);
            const MIN = (...args) => Math.min(...args);
            const ROUND = (n, d=0) => { const m=Math.pow(10,d); return Math.round(Number(n)*m)/m; };
            const RAND = () => Math.random();
            
            // Mock API Lookup helper
            const MOCK_LOOKUP = (dataset, id, key) => {
                 // In a real app, this would be an async call. Here we simulate it sync for "calculation",
                 // but we will treat it specially in the effect hook.
                 return { __isApi: true, dataset, id, key };
            };

            return (${processedExpr});
        `;

        // Safe-ish eval
        // eslint-disable-next-line
        return new Function(funcBody)();
    } catch (error) {
        // console.warn('Logic Error:', error);
        return null;
    }
};

// Signature Pad Component

// Signature Pad Component
const SignaturePad = ({ value, onChange }: any) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    const startDrawing = (e: any) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX || e.touches[0].clientX) - rect.left;
        const y = (e.clientY || e.touches[0].clientY) - rect.top;

        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#000';
        setIsDrawing(true);
    };

    const draw = (e: any) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX || e.touches[0].clientX) - rect.left;
        const y = (e.clientY || e.touches[0].clientY) - rect.top;

        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDrawing = () => {
        if (!isDrawing) return;
        setIsDrawing(false);
        const canvas = canvasRef.current;
        if (canvas) onChange(canvas.toDataURL());
    };

    const clear = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            onChange('');
        }
    };

    return (
        <div className="border border-slate-200 rounded-xl bg-slate-50 p-3">
            {value ? (
                <div className="relative group">
                    <img src={value} alt="Signature" className="h-24 w-full object-contain bg-white border border-slate-200 rounded" />
                    <button onClick={clear} className="absolute inset-0 bg-white/90 opacity-0 group-hover:opacity-100 flex items-center justify-center font-bold text-red-500 transition-opacity">
                        Clear Signature
                    </button>
                </div>
            ) : (
                <>
                    <canvas
                        ref={canvasRef}
                        width={400}
                        height={100}
                        className="w-full h-24 bg-white border border-dashed border-slate-300 rounded cursor-crosshair touch-none"
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={stopDrawing}
                    />
                    <div className="flex justify-between items-center mt-2 px-1">
                        <span className="text-[10px] text-slate-400">Sign above</span>
                        <button onClick={clear} className="text-[10px] text-red-400 hover:text-red-500">Reset</button>
                    </div>
                </>
            )}
        </div>
    );
};

// --- Sub-Components ---

// 1. Redesigned Toolbox Item (Premium Ghost Style) - Now Draggable
const ToolboxItem = ({ type, label, icon: Icon, onClick, colorClass = "text-slate-500", onDragStart }: any) => (
    <div
        draggable
        onDragStart={(e) => {
            e.dataTransfer.setData('component-type', type);
            e.dataTransfer.effectAllowed = 'copy';
            if (onDragStart) onDragStart(type);
        }}
        onClick={() => onClick(type)}
        className="group flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-slate-100/80 transition-all active:scale-95 text-left border border-transparent hover:border-slate-200/50 cursor-grab active:cursor-grabbing"
    >
        <div className={`p-1.5 rounded-md shadow-sm border border-slate-200 bg-white group-hover:scale-105 transition-all duration-200 ${colorClass}`}>
            <Icon size={15} strokeWidth={2.5} />
        </div>
        <span className="text-xs font-semibold text-slate-600 group-hover:text-slate-900 tracking-tight hidden lg:block">{label}</span>
    </div>
);

// 2. Left Side Field Editor (Canvas Item + Properties)
const FieldEditor = ({
    field, index, isActive, onClick, onUpdate, onRemove, onUpdateOption, onAddOption, onRemoveOption, onRename, onDragStart, onDragEnter, onDragEnd
}: any) => {
    const isLayout = ['divider', 'notice', 'spacer'].includes(field.type);
    const hasOptions = ['select', 'radio', 'steps', 'tabs'].includes(field.type);
    const [isLogicOpen, setIsLogicOpen] = useState(!!field.logic);
    const [tempId, setTempId] = useState(field.id);

    // Sync tempId when field.id changes externally
    useEffect(() => {
        setTempId(field.id);
    }, [field.id]);

    const handleIdSubmit = () => {
        if (tempId !== field.id && onRename) {
            onRename(field.id, tempId);
        }
    };

    const IconMap: any = {
        text: Type, number: Hash, select: List, radio: CircleIcon, checkbox: CheckSquare,
        date: Calendar, divider: Minus, notice: Bell, spacer: MoveVertical,
        time: Clock, switch: ToggleLeft, richtext: FileText, file: Upload,
        signature: PenTool, rating: Star, card: CreditCard,
        grid: Grid, tabs: Folder, collapse: ChevronRight, steps: ListOrdered
    };
    const Icon = IconMap[field.type] || Type;

    const widthOptions = [
        { label: '50%', value: '50%', icon: Columns },
        { label: '100%', value: '100%', icon: Maximize2 },
    ];

    const typeColors: any = {
        text: 'bg-blue-500', number: 'bg-emerald-500', select: 'bg-purple-500', radio: 'bg-pink-500',
        checkbox: 'bg-teal-500', date: 'bg-orange-500', divider: 'bg-slate-400', notice: 'bg-amber-500', spacer: 'bg-slate-300',
        time: 'bg-lime-500', switch: 'bg-indigo-500', richtext: 'bg-violet-500', file: 'bg-sky-500',
        signature: 'bg-gray-600', rating: 'bg-yellow-500', card: 'bg-indigo-600',
        grid: 'bg-slate-400', tabs: 'bg-slate-400', collapse: 'bg-slate-400', steps: 'bg-slate-400'
    };
    const accentColor = typeColors[field.type] || 'bg-slate-500';

    return (
        <div
            draggable
            onDragStart={(e) => onDragStart(e, index)}
            onDragEnter={(e) => onDragEnter(e, index)}
            onDragEnd={onDragEnd}
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            className={`relative group transition-all duration-300 mb-3 rounded-xl border cursor-pointer overflow-hidden
                ${isActive
                    ? 'bg-white ring-2 ring-indigo-500/20 shadow-lg z-10 border-indigo-500'
                    : 'bg-white border-slate-200 hover:border-indigo-300 hover:shadow-md'
                }
            `}
        >
            {/* Left Color Strip */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${isActive ? accentColor : 'bg-transparent group-hover:bg-slate-200'} transition-colors`}></div>

            {/* Header / Summary View */}
            <div className="p-3 pl-4 flex items-center gap-3 select-none">
                <div className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-600 p-1 -ml-1">
                    <GripVertical size={16} />
                </div>

                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isActive ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-400'}`}>
                    <Icon size={16} strokeWidth={2.5} />
                </div>

                <div className="flex-1 min-w-0 flex items-center gap-3">
                    <span className={`text-sm font-bold truncate ${isActive ? 'text-slate-900' : 'text-slate-700'}`}>
                        {field.label}
                    </span>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/50">
                            {field.type}
                        </span>
                        {field.required && (
                            <span className="flex items-center gap-0.5 text-[10px] text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-100 font-bold uppercase tracking-wider">
                                <span className="w-1 h-1 rounded-full bg-red-500"></span> Req
                            </span>
                        )}
                        <span className="text-[10px] text-slate-400 hidden group-hover:inline-block transition-opacity">
                            • {field.width === '50%' ? 'Half Width' : 'Full Width'}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    <button onClick={(e) => { e.stopPropagation(); onRemove(field.id); }} className="text-slate-300 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100">
                        <Trash2 size={16} />
                    </button>
                    <div className={`transition-transform duration-300 ${isActive ? 'rotate-180' : ''} text-slate-400`}>
                        <ChevronDown size={16} />
                    </div>
                </div>
            </div>

            {/* Expanded Properties Panel */}
            {isActive && (
                <div className="px-4 pb-4 pt-0 animate-in slide-in-from-top-1 duration-200" onClick={e => e.stopPropagation()}>
                    <div className="h-px bg-slate-100 w-full mb-4"></div>

                    <div className="space-y-4">

                        {/* 1. General Settings */}
                        <div className="space-y-3">
                            <div>
                                <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                    <Type size={10} /> Field Label
                                </label>
                                <input
                                    autoFocus
                                    value={field.label}
                                    onChange={(e) => onUpdate(field.id, 'label', e.target.value)}
                                    className="w-full text-xs font-medium px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-indigo-500 outline-none transition-all shadow-sm"
                                    placeholder="Enter label..."
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                        <Code size={10} /> Variable ID
                                    </label>
                                    <div className="relative group/id">
                                        <input
                                            value={tempId}
                                            onChange={(e) => setTempId(e.target.value)}
                                            onBlur={handleIdSubmit}
                                            onKeyDown={(e) => e.key === 'Enter' && handleIdSubmit()}
                                            className="w-full text-xs font-mono px-2.5 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 focus:bg-white focus:border-indigo-500 focus:text-indigo-600 outline-none transition-colors"
                                            placeholder="Variable Name"
                                            title="Variable Name for Logic Formulas (Alphanumeric only)"
                                        />
                                        {tempId !== field.id && (
                                            <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-amber-500 font-bold animate-pulse">Save</div>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                        <Columns size={10} /> Width
                                    </label>
                                    <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                                        {widthOptions.map(opt => (
                                            <button
                                                key={opt.value}
                                                onClick={() => onUpdate(field.id, 'width', opt.value)}
                                                className={`flex-1 flex items-center justify-center py-1.5 rounded-md transition-all ${field.width === opt.value ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                                                title={opt.label}
                                            >
                                                <opt.icon size={14} />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 2. Specific Settings */}
                        {!isLayout && (
                            <div className="bg-slate-50/50 rounded-xl border border-slate-100 p-3 space-y-3">
                                {/* Validation Row */}
                                <div className="flex items-center justify-between">
                                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Configuration</h4>
                                    <label className="flex items-center gap-2 cursor-pointer group/toggle">
                                        <span className="text-xs font-semibold text-slate-600 group-hover/toggle:text-indigo-600 transition-colors">Required</span>
                                        <div className={`relative w-8 h-4 rounded-full transition-colors ${field.required ? 'bg-indigo-500' : 'bg-slate-200'}`}>
                                            <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-transform ${field.required ? 'translate-x-4' : 'translate-x-0'}`}></div>
                                            <input type="checkbox" className="hidden" checked={field.required} onChange={(e) => onUpdate(field.id, 'required', e.target.checked)} />
                                        </div>
                                    </label>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <input
                                            value={field.placeholder || ''}
                                            onChange={(e) => onUpdate(field.id, 'placeholder', e.target.value)}
                                            className="w-full text-xs px-2.5 py-2 bg-white border border-slate-200 rounded-lg focus:border-indigo-500 outline-none transition-colors"
                                            placeholder="Placeholder text..."
                                        />
                                    </div>
                                    <div>
                                        <input
                                            value={field.helpText || ''}
                                            onChange={(e) => onUpdate(field.id, 'helpText', e.target.value)}
                                            className="w-full text-xs px-2.5 py-2 bg-white border border-slate-200 rounded-lg focus:border-indigo-500 outline-none transition-colors"
                                            placeholder="Help / Hint text..."
                                        />
                                    </div>
                                </div>

                                {/* Display Visibility Settings */}
                                <div className="flex gap-4 pt-2 border-t border-slate-100">
                                    <label className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase cursor-pointer hover:text-indigo-600 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={field.showInGrid !== false}
                                            onChange={(e) => onUpdate(field.id, 'showInGrid', e.target.checked)}
                                            className="rounded text-indigo-500 w-3 h-3 focus:ring-0"
                                        /> Show in Grid
                                    </label>
                                    <label className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase cursor-pointer hover:text-indigo-600 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={field.showInBatch !== false}
                                            onChange={(e) => onUpdate(field.id, 'showInBatch', e.target.checked)}
                                            className="rounded text-indigo-500 w-3 h-3 focus:ring-0"
                                        /> Show in Batch
                                    </label>
                                </div>
                            </div>
                        )}

                        {/* 3. Type Specific: Options */}
                        {hasOptions && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                        <List size={10} /> Options
                                    </label>
                                    <span className="text-[10px] text-slate-400 font-mono">{field.options?.length || 0} items</span>
                                </div>

                                <div className="space-y-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200">
                                    {field.options?.map((opt: string, idx: number) => (
                                        <div key={idx} className="flex gap-2 items-center group/opt p-1">
                                            <div className="w-5 h-5 bg-white border border-slate-200 rounded flex items-center justify-center text-xs font-mono text-slate-400 shadow-sm shrink-0">{idx + 1}</div>
                                            <input
                                                value={opt}
                                                onChange={(e) => onUpdateOption(field.id, idx, e.target.value)}
                                                className="flex-1 px-2 py-1.5 bg-transparent border-b border-transparent focus:border-indigo-300 focus:bg-white rounded-sm text-xs outline-none transition-all placeholder-slate-300"
                                                placeholder={`Option ${idx + 1}`}
                                            />
                                            <button onClick={() => onRemoveOption(field.id, idx)} className="text-slate-300 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors opacity-0 group-hover/opt:opacity-100"><X size={14} /></button>
                                        </div>
                                    ))}
                                    <button onClick={() => onAddOption(field.id)} className="w-full py-1.5 text-xs font-bold text-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center justify-center gap-1">
                                        <Plus size={12} /> Add New Option
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* 4. Type Specific: Notice, Card, Collapse */}
                        {['notice', 'card', 'collapse'].includes(field.type) && (
                            <div className="bg-slate-50/50 rounded-xl border border-slate-100 p-3 space-y-3">
                                {field.type === 'notice' && (
                                    <div className="flex gap-2 p-1 bg-slate-100 rounded-lg w-fit">
                                        {['info', 'warning', 'error', 'success'].map(type => (
                                            <button
                                                key={type}
                                                onClick={() => onUpdate(field.id, 'noticeType', type)}
                                                className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${field.noticeType === type ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                            >
                                                {type}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                <textarea
                                    rows={3}
                                    value={field.content || ''}
                                    onChange={(e) => onUpdate(field.id, 'content', e.target.value)}
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-500 transition-colors shadow-sm"
                                    placeholder={field.type === 'notice' ? "Enter notice content..." : "Enter default content..."}
                                />
                            </div>
                        )}

                        {/* 5. Logic & Rules Section */}
                        {!isLayout && (
                            <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                                <div
                                    className="bg-slate-100/50 px-3 py-2 border-b border-slate-200 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors"
                                    onClick={() => setIsLogicOpen(!isLogicOpen)}
                                >
                                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                        <RefreshCw size={10} /> Logic Engine <span className="normal-case font-mono bg-slate-200 px-1 rounded text-slate-600 ml-1 opacity-70">var: {'{' + field.id + '}'}</span>
                                    </h4>
                                    {isLogicOpen ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                                </div>
                                {isLogicOpen && (
                                    <div className="p-3 space-y-3 animate-in slide-in-from-top-1">
                                        {/* Visibility Rule */}
                                        <div>
                                            <div className="flex justify-between mb-1">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase">Visibility Rule (Show ...)</label>
                                                <span className="text-[10px] text-slate-300 font-mono">e.g. {'{f1}'} == 'Yes'</span>
                                            </div>
                                            <input
                                                value={field.logic?.visibility || ''}
                                                onChange={(e) => onUpdate(field.id, 'logic', { ...field.logic, visibility: e.target.value })}
                                                className="w-full text-xs font-mono px-2 py-1.5 bg-white border border-slate-200 rounded focus:border-indigo-500 outline-none"
                                                placeholder="Expression..."
                                            />
                                        </div>

                                        {/* Calculation Formula */}
                                        <div>
                                            <div className="flex justify-between mb-1">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase">Calculated Value (=)</label>
                                                <span className="text-[10px] text-slate-300 font-mono">e.g. CONCAT({'{f1}'}, '-', {'{f2}'})</span>
                                            </div>
                                            <input
                                                value={field.logic?.calculation || ''}
                                                onChange={(e) => onUpdate(field.id, 'logic', { ...field.logic, calculation: e.target.value })}
                                                className="w-full text-xs font-mono px-2 py-1.5 bg-white border border-slate-200 rounded focus:border-indigo-500 outline-none"
                                                placeholder="Formula..."
                                            />
                                        </div>

                                        {/* Dynamic Options Rule */}
                                        {['select', 'radio', 'tabs'].includes(field.type) && (
                                            <div>
                                                <div className="flex justify-between mb-1">
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Dynamic Options Rule</label>
                                                    <span className="text-[10px] text-slate-300 font-mono">Returns Array</span>
                                                </div>
                                                <input
                                                    value={field.logic?.optionsRule || ''}
                                                    onChange={(e) => onUpdate(field.id, 'logic', { ...field.logic, optionsRule: e.target.value })}
                                                    className="w-full text-xs font-mono px-2 py-1.5 bg-white border border-slate-200 rounded focus:border-indigo-500 outline-none"
                                                    placeholder="IF({region} == 'US', ['NY', 'LA'], ['London'])"
                                                />
                                            </div>
                                        )}

                                        {/* API Fetch Rule */}
                                        <div>
                                            <div className="flex justify-between mb-1">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase">External Data Logic</label>
                                                <span className="text-[10px] text-slate-300 font-mono">Simulated API</span>
                                            </div>
                                            <input
                                                value={field.logic?.apiRule || ''}
                                                onChange={(e) => onUpdate(field.id, 'logic', { ...field.logic, apiRule: e.target.value })}
                                                className="w-full text-xs font-mono px-2 py-1.5 bg-white border border-slate-200 rounded focus:border-indigo-500 outline-none"
                                                placeholder="MOCK_LOOKUP('users', {user_id}, 'name')"
                                            />
                                        </div>

                                        {/* Validation Regex */}
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Regex Validation</label>
                                            <div className="flex gap-2">
                                                <input
                                                    value={field.logic?.regex || ''}
                                                    onChange={(e) => onUpdate(field.id, 'logic', { ...field.logic, regex: e.target.value })}
                                                    className="flex-1 text-xs font-mono px-2 py-1.5 bg-white border border-slate-200 rounded focus:border-indigo-500 outline-none"
                                                    placeholder="Regex Pattern..."
                                                />
                                                <input
                                                    value={field.logic?.errorMsg || ''}
                                                    onChange={(e) => onUpdate(field.id, 'logic', { ...field.logic, errorMsg: e.target.value })}
                                                    className="w-1/3 text-xs px-2 py-1.5 bg-white border border-slate-200 rounded focus:border-indigo-500 outline-none"
                                                    placeholder="Error Msg"
                                                />
                                            </div>
                                        </div>

                                        {/* Cross-Field Validation Rule */}
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Custom Logic Validation</label>
                                            <div className="flex gap-2">
                                                <input
                                                    value={field.logic?.customRule || ''}
                                                    onChange={(e) => onUpdate(field.id, 'logic', { ...field.logic, customRule: e.target.value })}
                                                    className="flex-1 text-xs font-mono px-2 py-1.5 bg-white border border-slate-200 rounded focus:border-indigo-500 outline-none"
                                                    placeholder="{val} > {other_field}"
                                                />
                                                <input
                                                    value={field.logic?.customErrorMsg || ''}
                                                    onChange={(e) => onUpdate(field.id, 'logic', { ...field.logic, customErrorMsg: e.target.value })}
                                                    className="w-1/3 text-xs px-2 py-1.5 bg-white border border-slate-200 rounded focus:border-indigo-500 outline-none"
                                                    placeholder="Error Msg"
                                                />
                                            </div>
                                        </div>

                                        {/* Advanced Rules */}
                                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Read-Only Rule</label>
                                                <input
                                                    value={field.logic?.readOnly || ''}
                                                    onChange={(e) => onUpdate(field.id, 'logic', { ...field.logic, readOnly: e.target.value })}
                                                    className="w-full text-xs font-mono px-2 py-1.5 bg-white border border-slate-200 rounded focus:border-indigo-500 outline-none"
                                                    placeholder="{f1} == 'Lock'"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Required Rule</label>
                                                <input
                                                    value={field.logic?.requiredRule || ''}
                                                    onChange={(e) => onUpdate(field.id, 'logic', { ...field.logic, requiredRule: e.target.value })}
                                                    className="w-full text-xs font-mono px-2 py-1.5 bg-white border border-slate-200 rounded focus:border-indigo-500 outline-none"
                                                    placeholder="{val} > 100"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// 3. Right Side Live Preview
const FormPreview = ({ schema, data, setData, errors, setErrors, onSubmit, onCancel }: any) => {

    // --- Logic Engine Execution ---
    useEffect(() => {
        const newData = { ...data };
        let hasChanges = false;

        schema.forEach((field: any) => {
            // 1. Calculation (Sync)
            if (field.logic?.calculation) {
                const result = evaluateExpression(field.logic.calculation, data);
                if (result !== null && result !== undefined && !result.__isApi) {
                    if (String(result) !== String(data[field.id])) {
                        newData[field.id] = result;
                        hasChanges = true;
                    }
                }
            }

            // 2. API Logic (Simulated Async)
            if (field.logic?.apiRule) {
                const meta = evaluateExpression(field.logic.apiRule, data);
                // Check if we have a valid lookup instruction object
                if (meta && meta.__isApi && meta.id) {
                    // Check MOCK_DB
                    const record = MOCK_DB[meta.dataset]?.[meta.id];
                    const fetchedValue = record ? record[meta.key] : '';

                    if (fetchedValue !== undefined && fetchedValue !== data[field.id]) {
                        newData[field.id] = fetchedValue;
                        hasChanges = true;
                    }
                } else if (data[field.id]) {
                    // API Rule exists but invalid ID (e.g. empty), clear field
                    if (data[field.id] !== '') {
                        newData[field.id] = '';
                        hasChanges = true;
                    }
                }
            }
        });

        if (hasChanges) {
            setData(newData);
        }
    }, [data, schema]); // Dependency on data triggers recalculation loop. React batches updates, but care needed.

    const getVisibility = (field: any) => {
        if (!field.logic?.visibility) return true;
        const result = evaluateExpression(field.logic.visibility, data);
        return result === true;
    };

    const getReadOnly = (field: any) => {
        if (!field.logic?.readOnly) return false;
        return evaluateExpression(field.logic.readOnly, data) === true;
    };

    const getRequired = (field: any) => {
        if (field.logic?.requiredRule) {
            return evaluateExpression(field.logic.requiredRule, data) === true;
        }
        return field.required;
    };

    const getOptions = (field: any) => {
        if (field.logic?.optionsRule) {
            const result = evaluateExpression(field.logic.optionsRule, data);
            if (Array.isArray(result)) return result;
        }
        return field.options;
    };

    const handleChange = (id: string, value: any) => {
        // ... (Update local data)
        const updatedData = { ...data, [id]: value };

        // Inline Validation Logic
        const newErrors = { ...errors };
        const field = schema.find((f: any) => f.id === id);

        // 1. Regex Validation
        if (field?.logic?.regex) {
            try {
                const regex = new RegExp(field.logic.regex);
                if (!regex.test(value)) {
                    newErrors[id] = field.logic.errorMsg || 'Format invalid';
                } else {
                    delete newErrors[id];
                }
            } catch (e) {
                // Ignore bad regex
            }
        } else {
            delete newErrors[id];
        }

        // 2. Custom Logic Validation (Cross-field)
        if (field?.logic?.customRule) {
            const isValid = evaluateExpression(field.logic.customRule, updatedData);
            if (isValid === false) { // Strict false check
                newErrors[id] = field.logic.customErrorMsg || 'Validation failed';
            } else if (newErrors[id] === (field.logic.customErrorMsg || 'Validation failed')) {
                delete newErrors[id];
            }
        }

        // 2. Dynamic Required Check (Simulated for feedback)
        // In a real form library like React Hook Form, this would be cleaner.
        const isReq = field.logic?.requiredRule ? (evaluateExpression(field.logic.requiredRule, updatedData) === true) : field.required;
        if (isReq && !value) {
            newErrors[id] = 'This field is required';
        } else if (newErrors[id] === 'This field is required') {
            delete newErrors[id];
        }

        setErrors(newErrors);
        setErrors(newErrors);
        setData(updatedData);
    };

    // Re-validate all fields when data changes (for cross-field dependencies)
    useEffect(() => {
        const newErrors = { ...errors };
        let hasValidationChanges = false;

        schema.forEach((field: any) => {
            if (field.logic?.customRule) {
                const isValid = evaluateExpression(field.logic.customRule, data);
                const errorMsg = field.logic.customErrorMsg || 'Validation failed';

                if (isValid === false) {
                    if (newErrors[field.id] !== errorMsg) {
                        newErrors[field.id] = errorMsg;
                        hasValidationChanges = true;
                    }
                } else {
                    if (newErrors[field.id] === errorMsg) {
                        delete newErrors[field.id];
                        hasValidationChanges = true;
                    }
                }
            }
        });

        if (hasValidationChanges) {
            setErrors(newErrors);
        }
    }, [data, schema]);

    return (
        <div className="bg-white p-8 min-h-[800px] shadow-2xl shadow-slate-200/50 rounded-2xl border border-slate-200 relative overflow-hidden flex flex-col">
            {/* Fake Window Header for visual flair */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>

            <div className="mb-8 pb-6 border-b border-slate-100">
                <h2 className="text-2xl font-extrabold text-slate-800 flex items-center gap-3">
                    Preview Mode
                </h2>
                <p className="text-slate-400 text-sm mt-1">This is how your users will see the form.</p>
            </div>

            <div className="flex flex-wrap -mx-3">
                {schema.length === 0 && (
                    <div className="w-full py-20 flex flex-col items-center justify-center text-slate-300 border-2 border-dashed border-slate-100 rounded-xl m-3 bg-slate-50/50">
                        <LayoutTemplate size={48} className="mb-4 opacity-50" />
                        <p className="font-bold">Empty Form</p>
                        <p className="text-xs">Add components from the top bar.</p>
                    </div>
                )}

                {schema.map((field: any) => {
                    const widthClass = field.width === '50%' ? 'w-1/2' : 'w-full';
                    const isError = !!errors?.[field.id];

                    // Logic: Visibility Check
                    if (!getVisibility(field)) return null;

                    // Logic: ReadOnly & Required
                    const isReadOnly = getReadOnly(field);
                    const isRequired = getRequired(field);
                    const commonInputClasses = `w-full border rounded-xl px-4 py-3 text-sm outline-none transition-all ${isError ? 'border-red-300 bg-red-50 focus:border-red-500' : isReadOnly ? 'bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200' : 'border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'}`;

                    if (field.type === 'divider') {
                        return (
                            <div key={field.id} className="w-full px-3 mt-6 mb-4">
                                <div className="flex items-center gap-4">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">{field.label}</h3>
                                    <div className="h-px bg-slate-100 flex-1"></div>
                                </div>
                            </div>
                        );
                    }

                    if (field.type === 'notice') {
                        const styles: any = {
                            info: 'bg-blue-50 text-blue-700 border-blue-100',
                            warning: 'bg-amber-50 text-amber-700 border-amber-100',
                            error: 'bg-red-50 text-red-700 border-red-100',
                            success: 'bg-emerald-50 text-emerald-700 border-emerald-100'
                        };
                        const icons: any = { info: Info, warning: AlertTriangle, error: AlertCircle, success: CheckCircle };
                        const Icon = icons[field.noticeType || 'info'];

                        return (
                            <div key={field.id} className="w-full px-3 mb-6">
                                <div className={`p-4 rounded-xl border text-sm flex gap-3 ${styles[field.noticeType || 'info']}`}>
                                    <Icon size={18} className="shrink-0 mt-0.5" />
                                    <div>
                                        <div className="font-bold mb-1">{field.label}</div>
                                        <div className="opacity-90 leading-relaxed">{field.content}</div>
                                    </div>
                                </div>
                            </div>
                        );
                    }

                    if (field.type === 'spacer') {
                        return <div key={field.id} className="w-full h-8"></div>;
                    }

                    return (
                        <div key={field.id} className={`${widthClass} px-3 mb-5 transition-all`}>
                            <label className="block text-sm font-bold text-slate-700 mb-2">
                                {field.label}
                                {isRequired && <span className="text-red-500 ml-1">*</span>}
                            </label>

                            {['text', 'number', 'date', 'time', 'email', 'tel'].includes(field.type) && (
                                <input
                                    type={field.type === 'text' ? 'text' : field.type}
                                    className={commonInputClasses}
                                    placeholder={field.placeholder}
                                    value={data[field.id] || ''}
                                    disabled={isReadOnly}
                                    onChange={(e) => handleChange(field.id, e.target.value)}
                                />
                            )}

                            {field.type === 'switch' && (
                                <label className={`flex items-center gap-3 cursor-pointer w-fit ${isReadOnly ? 'opacity-50 pointer-events-none' : ''}`}>
                                    <div className={`w-11 h-6 rounded-full transition-colors relative ${data[field.id] ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                                        <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full shadow-sm transition-transform ${data[field.id] ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                    </div>
                                    <span className="text-sm font-medium text-slate-700">{data[field.id] ? 'On' : 'Off'}</span>
                                    <input type="checkbox" className="hidden" checked={!!data[field.id]} onChange={(e) => handleChange(field.id, e.target.checked)} disabled={isReadOnly} />
                                </label>
                            )}

                            {field.type === 'richtext' && (
                                <div className={`border rounded-xl overflow-hidden bg-white ${isError ? 'border-red-300' : 'border-slate-200'} ${isReadOnly ? 'opacity-60 pointer-events-none bg-slate-50' : ''}`}>
                                    <div className="bg-slate-50 border-b border-slate-200 px-2 py-1.5 flex gap-1 shadow-sm">
                                        {['bold', 'italic', 'underline', 'insertUnorderedList'].map((cmd) => (
                                            <button
                                                key={cmd}
                                                onClick={(e) => { e.preventDefault(); document.execCommand(cmd, false); }}
                                                className="p-1.5 hover:bg-slate-200 rounded text-slate-600 transition-colors"
                                                title={cmd}
                                            >
                                                {cmd === 'bold' && <Type size={14} strokeWidth={3} />}
                                                {cmd === 'italic' && <Type size={14} className="italic" />}
                                                {cmd === 'underline' && <Type size={14} className="underline" />}
                                                {cmd === 'insertUnorderedList' && <List size={14} />}
                                            </button>
                                        ))}
                                    </div>
                                    <div
                                        contentEditable
                                        className="w-full h-32 px-4 py-3 text-sm outline-none overflow-y-auto prose prose-sm max-w-none"
                                        onBlur={(e) => handleChange(field.id, e.currentTarget.innerHTML)}
                                        dangerouslySetInnerHTML={{ __html: data[field.id] || '' }}
                                        data-placeholder="Start typing..."
                                    />
                                    {/* Small hint for reactivity */}
                                    <div className="px-2 py-1 text-[10px] text-slate-300 text-right border-t border-slate-50">Editor updates on blur</div>
                                </div>
                            )}

                            {field.type === 'file' && (
                                <div>
                                    <label className={`border-2 border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center justify-center text-slate-400 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-300 transition-all cursor-pointer group relative overflow-hidden ${isReadOnly ? 'opacity-60 pointer-events-none' : ''}`}>
                                        <input
                                            type="file"
                                            multiple
                                            disabled={isReadOnly}
                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                            onChange={(e) => {
                                                const files = Array.from(e.target.files || []);
                                                const current = data[field.id] || [];
                                                const newFiles = files.map((f: any) => ({ name: f.name, size: (f.size / 1024).toFixed(1) + ' KB', type: f.type }));
                                                handleChange(field.id, [...current, ...newFiles]);
                                            }}
                                        />
                                        <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center mb-3 group-hover:scale-110 group-hover:shadow-md transition-all">
                                            <Upload size={24} className="text-indigo-500" />
                                        </div>
                                        <p className="text-sm font-bold text-slate-600 group-hover:text-indigo-600 transition-colors">Click or drag properties</p>
                                        <p className="text-xs text-slate-400 mt-1">SVG, PNG, JPG or GIF (max. 10MB)</p>
                                    </label>

                                    {/* File List */}
                                    {(data[field.id] && data[field.id].length > 0) && (
                                        <div className="mt-3 space-y-2 animate-in slide-in-from-top-2">
                                            {data[field.id].map((f: any, idx: number) => (
                                                <div key={idx} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
                                                    <div className="flex items-center gap-3 overflow-hidden">
                                                        <div className="w-8 h-8 rounded bg-indigo-50 flex items-center justify-center text-indigo-500 shrink-0">
                                                            <FileText size={16} />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-bold text-slate-700 truncate">{f.name}</p>
                                                            <p className="text-[10px] text-slate-400">{f.size}</p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            const newFiles = [...data[field.id]];
                                                            newFiles.splice(idx, 1);
                                                            handleChange(field.id, newFiles);
                                                        }}
                                                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {field.type === 'signature' && (
                                <SignaturePad value={data[field.id]} onChange={(val: string) => handleChange(field.id, val)} />
                            )}

                            {field.type === 'rating' && (
                                <div className={`flex items-center gap-1 ${isReadOnly ? 'pointer-events-none opacity-60' : ''}`}>
                                    {[1, 2, 3, 4, 5].map(star => (
                                        <button key={star} onClick={() => handleChange(field.id, star)} className="transition-transform hover:scale-110">
                                            <Star
                                                size={24}
                                                className={`${(data[field.id] || 0) >= star ? 'fill-yellow-400 text-yellow-400' : 'text-slate-200'}`}
                                            />
                                        </button>
                                    ))}
                                    <span className="ml-2 text-sm font-bold text-slate-500">{data[field.id] ? `${data[field.id]} Stars` : ''}</span>
                                </div>
                            )}

                            {field.type === 'card' && (
                                <div className="p-5 rounded-2xl border border-slate-200 shadow-sm bg-white mt-4 relative overflow-hidden group hover:shadow-md transition-all">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <CreditCard size={18} className="text-indigo-600" />
                                        <h4 className="font-bold text-lg text-slate-800">{field.label}</h4>
                                    </div>
                                    <p className="text-sm text-slate-500 leading-relaxed">
                                        {field.content || 'This is a content card. You can edit this text in the builder.'}
                                    </p>
                                </div>
                            )}

                            {field.type === 'collapse' && (
                                <details className="group border border-slate-200 rounded-xl bg-white open:ring-2 open:ring-indigo-500/10 open:border-indigo-200 transition-all mt-4">
                                    <summary className="flex items-center justify-between p-4 cursor-pointer list-none text-slate-700 font-bold select-none hover:bg-slate-50 rounded-xl group-open:rounded-b-none transition-colors">
                                        <div className="flex items-center gap-2">
                                            <ChevronRight size={18} className="text-slate-400 group-open:rotate-90 transition-transform group-open:text-indigo-600" />
                                            {field.label}
                                        </div>
                                    </summary>
                                    <div className="p-4 pt-0 text-sm text-slate-500 leading-relaxed border-t border-transparent group-open:border-slate-100 animate-in slide-in-from-top-1">
                                        {field.content || 'Hidden content details go here...'}
                                    </div>
                                </details>
                            )}

                            {/* Tabs as Segmented Control */}
                            {field.type === 'tabs' && (
                                <div className="bg-slate-100 p-1 rounded-xl flex items-center mb-2">
                                    {(getOptions(field) || ['Tab 1', 'Tab 2']).map((tab: string) => (
                                        <button
                                            key={tab}
                                            onClick={() => handleChange(field.id, tab)}
                                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${data[field.id] === tab ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                        >
                                            {tab}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {field.type === 'steps' && (
                                <div className="w-full overflow-x-auto py-4">
                                    <div className="flex items-center min-w-max">
                                        {(getOptions(field) || ['Step 1', 'Step 2', 'Step 3']).map((step: string, idx: number) => (
                                            <div key={idx} className="flex items-center">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-sm ${idx === 0 ? 'bg-indigo-600 text-white ring-4 ring-indigo-50' : 'bg-white border border-slate-200 text-slate-500'}`}>
                                                        {idx + 1}
                                                    </div>
                                                    <span className={`text-sm font-bold ${idx === 0 ? 'text-indigo-600' : 'text-slate-500'}`}>{step}</span>
                                                </div>
                                                {idx < (getOptions(field)?.length || 3) - 1 && (
                                                    <div className="h-0.5 w-12 bg-slate-200 mx-3"></div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Layout Visualizers */}


                            {field.type === 'select' && (
                                <div className="relative">
                                    <select
                                        className={`w-full border rounded-xl pl-4 pr-10 py-3 text-sm outline-none transition-all appearance-none cursor-pointer ${isError ? 'border-red-300 bg-red-50' : isReadOnly ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed' : 'border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'}`}
                                        value={data[field.id] || ''}
                                        onChange={(e) => handleChange(field.id, e.target.value)}
                                        disabled={isReadOnly}
                                    >
                                        <option value="">Select an option...</option>
                                        {getOptions(field)?.map((opt: string) => (
                                            <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                    <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none opacity-70" />
                                </div>
                            )}

                            {field.type === 'radio' && (
                                <div className={`flex flex-wrap gap-3 mt-1 ${isReadOnly ? 'opacity-60 pointer-events-none' : ''}`}>
                                    {getOptions(field)?.map((opt: string) => (
                                        <label key={opt} className={`flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border transition-all ${data[field.id] === opt ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${data[field.id] === opt ? 'border-indigo-600' : 'border-slate-300'}`}>
                                                {data[field.id] === opt && <div className="w-2 h-2 bg-indigo-600 rounded-full"></div>}
                                            </div>
                                            <span className="text-sm font-medium">{opt}</span>
                                            <input
                                                type="radio"
                                                className="hidden"
                                                name={field.id}
                                                checked={data[field.id] === opt}
                                                onChange={() => handleChange(field.id, opt)}
                                                disabled={isReadOnly}
                                            />
                                        </label>
                                    ))}
                                </div>
                            )}

                            {field.type === 'checkbox' && (
                                <label className={`flex items-center gap-3 cursor-pointer p-3 rounded-xl border transition-all ${isReadOnly ? 'opacity-60 pointer-events-none' : ''} ${data[field.id] ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-200 hover:bg-white'}`}>
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${data[field.id] ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300'}`}>
                                        {data[field.id] && <Check size={14} />}
                                    </div>
                                    <span className={`text-sm font-medium ${data[field.id] ? 'text-indigo-900' : 'text-slate-700'}`}>{field.label}</span>
                                    <input
                                        type="checkbox"
                                        className="hidden"
                                        checked={!!data[field.id]}
                                        onChange={(e) => handleChange(field.id, e.target.checked)}
                                        disabled={isReadOnly}
                                    />
                                </label>
                            )}

                            {field.helpText && <p className="text-xs text-slate-400 mt-2 ml-1">{field.helpText}</p>}
                            {isError && <p className="text-xs text-red-500 mt-1 flex items-center gap-1 font-bold"><AlertCircle size={12} /> {errors[field.id]}</p>}
                        </div>
                    );
                })}
            </div>

            {/* Footer Buttons */}
            <div className="mt-auto pt-8 border-t border-slate-100 flex justify-end gap-3">
                {onCancel ? (
                    <button
                        onClick={onCancel}
                        className="px-6 py-3 rounded-xl border border-gray-200 text-slate-600 font-bold text-sm hover:bg-gray-50 transition-colors"
                    >
                        Cancel
                    </button>
                ) : (
                    <div className="px-6 py-3 rounded-xl bg-slate-100 text-slate-400 font-bold text-sm cursor-not-allowed">Cancel</div>
                )}

                {onSubmit ? (
                    <button
                        onClick={onSubmit}
                        className="px-8 py-3 rounded-xl bg-indigo-600 text-white font-bold text-sm shadow-lg shadow-indigo-500/20 flex items-center gap-2 hover:bg-indigo-700 transition-all hover:-translate-y-0.5"
                    >
                        <CheckCircle size={16} /> Save Record
                    </button>
                ) : (
                    <div className="px-8 py-3 rounded-xl bg-indigo-600 text-white font-bold text-sm shadow-lg shadow-indigo-500/20 flex items-center gap-2 cursor-not-allowed opacity-80">
                        <Save size={16} /> Submit
                    </div>
                )}
            </div>
        </div>
    );
};

// 4. Logic Guide & Documentation Component
const LogicGuide = () => {
    const [subTab, setSubTab] = useState<'demo' | 'reference'>('demo');
    const [scenario, setScenario] = useState('visibility');
    const [localData, setLocalData] = useState<any>({ has_details: 'Yes' });
    const [localErrors, setLocalErrors] = useState<any>({});

    const SCENARIOS: any = {
        visibility: {
            title: "Conditional Visibility",
            description: "Hide or show fields dynamically based on user input. Use the 'visibility' logic property.",
            defaultData: { has_details: 'Yes' },
            schema: [
                { id: 'l_viz_notice', type: 'notice', label: 'Try toggling the switch below.', width: '100%', noticeType: 'info', content: 'The details field will appear only when you select Yes.' },
                { id: 'has_details', type: 'radio', label: 'Do you have extra details?', options: ['Yes', 'No'], width: '100%', required: true },
                { id: 'details_field', type: 'text', label: 'Please enter details:', width: '100%', logic: { visibility: "{has_details} == 'Yes'" } }
            ]
        },
        calculation: {
            title: "Auto-Calculation",
            description: "Perform real-time math operations. The target field automatically updates.",
            defaultData: { price: 25, qty: 4, tax_rate: 10 },
            schema: [
                { id: 'price', type: 'number', label: 'Unit Price ($)', width: '50%', placeholder: '0' },
                { id: 'qty', type: 'number', label: 'Quantity', width: '50%', placeholder: '0' },
                { id: 'subtotal', type: 'number', label: 'Subtotal (Price * Qty)', width: '100%', logic: { calculation: "{price} * {qty}", readOnly: "true" } },
                { id: 'tax_rate', type: 'number', label: 'Tax Rate (%)', width: '50%', placeholder: '10' },
                { id: 'total', type: 'number', label: 'Total w/ Tax', width: '50%', logic: { calculation: "{subtotal} * (1 + {tax_rate}/100)", readOnly: "true" } }
            ]
        },
        dates: {
            title: "Date Logic",
            description: "Calculate duration or validate date ranges using the DAYS() helper.",
            defaultData: { start_date: new Date().toISOString().split('T')[0], end_date: new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0] },
            schema: [
                { id: 'start_date', type: 'date', label: 'Start Date', width: '50%' },
                { id: 'end_date', type: 'date', label: 'End Date', width: '50%' },
                { id: 'duration', type: 'number', label: 'Duration (Days)', width: '100%', logic: { calculation: "DAYS({end_date}, {start_date})", readOnly: "true" } },
                { id: 'is_valid', type: 'text', label: 'Validation Status', width: '100%', logic: { calculation: "IF(DAYS({end_date}, {start_date}) >= 0, 'Valid Range', 'End Date must be after Start')" } }
            ]
        },
        text_logic: {
            title: "Text Manipulation",
            description: "Combine text or change case using helper functions like CONCAT, UPPER, LOWER, LEN.",
            defaultData: { first_name: 'James', last_name: 'Bond' },
            schema: [
                { id: 'first_name', type: 'text', label: 'First Name', width: '50%', placeholder: 'John' },
                { id: 'last_name', type: 'text', label: 'Last Name', width: '50%', placeholder: 'Doe' },
                { id: 'full_name', type: 'text', label: 'Full Name (Auto)', width: '100%', logic: { calculation: "CONCAT({first_name}, ' ', {last_name})", readOnly: "true" } },
                { id: 'username_suggestion', type: 'text', label: 'Username (LOWER)', width: '100%', logic: { calculation: "LOWER(CONCAT({first_name}, '.', {last_name}))", readOnly: "true" } },
                { id: 'length_calc', type: 'text', label: 'Name Length', width: '100%', logic: { calculation: "LEN({full_name})" } }
            ]
        },
        advanced_math: {
            title: "Advanced Math",
            description: "Use MAX, MIN, ROUND and other math functions for complex calculations.",
            defaultData: { score1: 78, score2: 92, score3: 88 },
            schema: [
                { id: 'score1', type: 'number', label: 'Score A', width: '33%', placeholder: '0' },
                { id: 'score2', type: 'number', label: 'Score B', width: '33%', placeholder: '0' },
                { id: 'score3', type: 'number', label: 'Score C', width: '33%', placeholder: '0' },
                { id: 'best_score', type: 'number', label: 'Highest Score (MAX)', width: '50%', logic: { calculation: "MAX({score1}, {score2}, {score3})", readOnly: "true" } },
                { id: 'avg_score', type: 'number', label: 'Average (ROUND)', width: '50%', logic: { calculation: "ROUND(({score1} + {score2} + {score3}) / 3, 2)", readOnly: "true" } }
            ]
        },
        regex: {
            title: "Regex Validation",
            description: "Validate inputs against custom patterns (e.g., Email, Phone, Codes).",
            defaultData: { email_test: 'invalid-email', sku_test: 'A-123' },
            schema: [
                { id: 'email_test', type: 'text', label: 'Email Address', width: '100%', placeholder: 'user@example.com', logic: { regex: "^[\\w-\\.]+@([\\w-]+\\.)+[\\w-]{2,4}$", errorMsg: "Invalid Email Format" } },
                { id: 'sku_test', type: 'text', label: 'SKU Code (XX-000)', width: '100%', placeholder: 'AB-123', logic: { regex: "^[A-Z]{2}-\\d{3}$", errorMsg: "Must be format XX-000" } },
                { id: 'regex_notice', type: 'notice', label: 'Note', width: '100%', noticeType: 'warning', content: 'Regex patterns must be double-escaped in JSON strings (e.g. \\\\d instead of \\d).' }
            ]
        },
        dynamic_options: {
            title: "Dynamic Options",
            description: "Change dropdown options based on other fields using optionsRule.",
            defaultData: { continent: 'Europe' },
            schema: [
                { id: 'continent', type: 'select', label: 'Continent', width: '100%', options: ['America', 'Europe', 'Asia'] },
                {
                    id: 'country', type: 'select', label: 'Country (Updates automatically)', width: '100%', options: [], logic: {
                        optionsRule: "IF({continent} == 'America', ['USA', 'Canada', 'Brazil'], IF({continent} == 'Europe', ['UK', 'France', 'Germany'], ['China', 'Japan', 'India']))"
                    }
                }
            ]
        }
    };

    const activeDemo = SCENARIOS[scenario];

    return (
        <div className="flex flex-col lg:flex-row h-full bg-slate-50 overflow-hidden animate-in fade-in">
            {/* Sidebar Guide Nav */}
            <div className="w-full lg:w-64 bg-white border-r border-gray-200 flex flex-col shrink-0 h-full overflow-y-auto">
                <div className="p-4 border-b border-gray-100">
                    <h2 className="font-bold text-gray-800 flex items-center gap-2">
                        <BookOpen size={18} className="text-indigo-600" /> Logic Guide
                    </h2>
                    <p className="text-xs text-gray-500 mt-1">Master dynamic forms</p>
                </div>

                <div className="p-2 space-y-1">
                    <div className="px-3 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider mt-2">Interactive Examples</div>
                    {Object.keys(SCENARIOS).map(key => (
                        <button
                            key={key}
                            onClick={() => { setScenario(key); setSubTab('demo'); setLocalData(SCENARIOS[key].defaultData || {}); }}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${scenario === key && subTab === 'demo' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
                        >
                            <Lightbulb size={14} /> {SCENARIOS[key].title}
                        </button>
                    ))}

                    <div className="px-3 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider mt-4">Documentation</div>
                    <button
                        onClick={() => setSubTab('reference')}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${subTab === 'reference' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        <FunctionSquare size={14} /> Syntax Reference
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                {subTab === 'demo' ? (
                    <div className="flex flex-col md:flex-row h-full">
                        {/* Demo Left: Description & Code */}
                        <div className="w-full md:w-1/2 p-6 overflow-y-auto border-b md:border-b-0 md:border-r border-gray-200 bg-white">
                            <div className="mb-6">
                                <h3 className="text-xl font-bold text-gray-900 mb-2">{activeDemo.title}</h3>
                                <p className="text-gray-600 text-sm leading-relaxed">{activeDemo.description}</p>
                            </div>

                            <div className="bg-slate-900 rounded-xl overflow-hidden shadow-lg">
                                <div className="bg-slate-800/50 px-4 py-2 flex items-center justify-between border-b border-slate-700">
                                    <span className="text-xs font-mono text-slate-400">Logic Definition (JSON)</span>
                                    <Code size={14} className="text-slate-500" />
                                </div>
                                <div className="p-4 overflow-x-auto">
                                    <pre className="text-xs font-mono text-emerald-400 whitespace-pre-wrap">
                                        {JSON.stringify(activeDemo.schema.filter((f: any) => f.logic), null, 2)}
                                    </pre>
                                </div>
                            </div>

                            <div className="mt-6 p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                                <h4 className="font-bold text-indigo-900 text-sm mb-2 flex items-center gap-2">
                                    <Info size={16} /> How it works
                                </h4>
                                <ul className="text-xs text-indigo-800 space-y-2 list-disc pl-4">
                                    <li>Variables are referenced using curly braces: <code>{`{field_id}`}</code></li>
                                    <li>Logic is evaluated in real-time as you type.</li>
                                    <li>Try changing values in the preview to see the magic!</li>
                                </ul>
                            </div>
                        </div>

                        {/* Demo Right: Live Preview */}
                        <div className="w-full md:w-1/2 bg-slate-50/50 flex flex-col relative">
                            <div className="absolute top-4 right-4 bg-white/80 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-indigo-600 border border-indigo-100 shadow-sm z-10">
                                Live Preview
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar">
                                <div className="max-w-md mx-auto bg-white rounded-xl shadow-sm border border-gray-200 min-h-[400px]">
                                    <FormPreview
                                        schema={activeDemo.schema}
                                        data={localData}
                                        setData={setLocalData}
                                        errors={localErrors}
                                        setErrors={setLocalErrors}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    // Reference Tab
                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-white">
                        <div className="max-w-4xl mx-auto space-y-10">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 mb-4">Logic Syntax Reference</h2>
                                <p className="text-gray-600">The Logic Engine uses a simple expression syntax similar to Excel or JavaScript. All expressions act on the current form data.</p>
                            </div>

                            {/* Section: Variables */}
                            <section>
                                <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                                    <div className="w-8 h-8 rounded bg-blue-100 text-blue-600 flex items-center justify-center"><Hash size={16} /></div>
                                    Variables
                                </h3>
                                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                    <p className="text-sm text-gray-700 mb-2">Reference other fields by their <strong>ID</strong> wrapped in curly braces.</p>
                                    <code className="bg-white px-2 py-1 rounded border border-gray-300 text-sm font-mono">{`{price} * {quantity}`}</code>
                                </div>
                            </section>

                            {/* Section: Operators */}
                            <section>
                                <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                                    <div className="w-8 h-8 rounded bg-purple-100 text-purple-600 flex items-center justify-center"><Calculator size={16} /></div>
                                    Operators
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                                        <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 font-bold text-xs text-gray-500 uppercase">Arithmetic</div>
                                        <div className="p-4 space-y-2">
                                            <div className="flex justify-between text-sm"><code className="font-bold">+</code> <span>Add</span></div>
                                            <div className="flex justify-between text-sm"><code className="font-bold">-</code> <span>Subtract</span></div>
                                            <div className="flex justify-between text-sm"><code className="font-bold">*</code> <span>Multiply</span></div>
                                            <div className="flex justify-between text-sm"><code className="font-bold">/</code> <span>Divide</span></div>
                                            <div className="flex justify-between text-sm"><code className="font-bold">%</code> <span>Modulus</span></div>
                                        </div>
                                    </div>
                                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                                        <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 font-bold text-xs text-gray-500 uppercase">Comparison</div>
                                        <div className="p-4 space-y-2">
                                            <div className="flex justify-between text-sm"><code className="font-bold">==</code> <span>Equal</span></div>
                                            <div className="flex justify-between text-sm"><code className="font-bold">!=</code> <span>Not Equal</span></div>
                                            <div className="flex justify-between text-sm"><code className="font-bold">&gt;</code> <span>Greater Than</span></div>
                                            <div className="flex justify-between text-sm"><code className="font-bold">&lt;</code> <span>Less Than</span></div>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Section: Functions */}
                            <section>
                                <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                                    <div className="w-8 h-8 rounded bg-emerald-100 text-emerald-600 flex items-center justify-center"><FunctionSquare size={16} /></div>
                                    Helper Functions
                                </h3>
                                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-50 text-gray-500 font-bold">
                                            <tr>
                                                <th className="px-4 py-3">Function</th>
                                                <th className="px-4 py-3">Description</th>
                                                <th className="px-4 py-3">Example</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            <tr className="bg-white">
                                                <td className="px-4 py-3 font-mono font-bold text-indigo-600">IF(cond, true, false)</td>
                                                <td className="px-4 py-3 text-gray-600">Conditional logic (like Excel)</td>
                                                <td className="px-4 py-3 font-mono text-xs text-gray-400">{`IF({age} >= 18, 'Adult', 'Minor')`}</td>
                                            </tr>
                                            <tr className="bg-white">
                                                <td className="px-4 py-3 font-mono font-bold text-indigo-600">DAYS(date1, date2)</td>
                                                <td className="px-4 py-3 text-gray-600">Difference in days between two dates</td>
                                                <td className="px-4 py-3 font-mono text-xs text-gray-400">{`DAYS({end}, {start})`}</td>
                                            </tr>
                                            <tr className="bg-white">
                                                <td className="px-4 py-3 font-mono font-bold text-indigo-600">LEN(string)</td>
                                                <td className="px-4 py-3 text-gray-600">Length of a string</td>
                                                <td className="px-4 py-3 font-mono text-xs text-gray-400">{`LEN({zip_code})`}</td>
                                            </tr>
                                            <tr className="bg-white">
                                                <td className="px-4 py-3 font-mono font-bold text-indigo-600">ISEMPTY(value)</td>
                                                <td className="px-4 py-3 text-gray-600">Returns true if value is null/empty</td>
                                                <td className="px-4 py-3 font-mono text-xs text-gray-400">{`ISEMPTY({name})`}</td>
                                            </tr>
                                            <tr className="bg-white">
                                                <td className="px-4 py-3 font-mono font-bold text-indigo-600">CONCAT(...args)</td>
                                                <td className="px-4 py-3 text-gray-600">Joins strings together</td>
                                                <td className="px-4 py-3 font-mono text-xs text-gray-400">{`CONCAT('ID-', {id})`}</td>
                                            </tr>
                                            <tr className="bg-white">
                                                <td className="px-4 py-3 font-mono font-bold text-indigo-600">UPPER / LOWER(s)</td>
                                                <td className="px-4 py-3 text-gray-600">Converts string to uppercase or lowercase</td>
                                                <td className="px-4 py-3 font-mono text-xs text-gray-400">{`UPPER({city})`}</td>
                                            </tr>
                                            <tr className="bg-white">
                                                <td className="px-4 py-3 font-mono font-bold text-indigo-600">MAX / MIN(...args)</td>
                                                <td className="px-4 py-3 text-gray-600">Returns largest or smallest value</td>
                                                <td className="px-4 py-3 font-mono text-xs text-gray-400">{`MAX({score1}, {score2})`}</td>
                                            </tr>
                                            <tr className="bg-white">
                                                <td className="px-4 py-3 font-mono font-bold text-indigo-600">ROUND(n, d)</td>
                                                <td className="px-4 py-3 text-gray-600">Rounds number n to d decimals</td>
                                                <td className="px-4 py-3 font-mono text-xs text-gray-400">{`ROUND({total}, 2)`}</td>
                                            </tr>
                                            <tr className="bg-white">
                                                <td className="px-4 py-3 font-mono font-bold text-indigo-600">NOW()</td>
                                                <td className="px-4 py-3 text-gray-600">Returns current date (YYYY-MM-DD)</td>
                                                <td className="px-4 py-3 font-mono text-xs text-gray-400">{`NOW()`}</td>
                                            </tr>
                                            <tr className="bg-white">
                                                <td className="px-4 py-3 font-mono font-bold text-indigo-600">YEAR / MONTH(d)</td>
                                                <td className="px-4 py-3 text-gray-600">Extracts year or month from date</td>
                                                <td className="px-4 py-3 font-mono text-xs text-gray-400">{`YEAR({start_date})`}</td>
                                            </tr>
                                            <tr className="bg-white">
                                                <td className="px-4 py-3 font-mono font-bold text-indigo-600">RAND()</td>
                                                <td className="px-4 py-3 text-gray-600">Random number (0-1)</td>
                                                <td className="px-4 py-3 font-mono text-xs text-gray-400">{`RAND()`}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </section>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- Main App Component ---
export const ERPManager: React.FC = () => {
    const { addToast } = useToast();

    // Helper to load from localStorage
    const loadFromStorage = <T,>(key: string, defaultValue: T): T => {
        if (typeof window === 'undefined') return defaultValue;
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.warn(`Error reading localStorage key "${key}":`, error);
            return defaultValue;
        }
    };

    // State
    const [activeTab, setActiveTab] = useState<'builder' | 'data' | 'library' | 'guide'>(() => loadFromStorage('erp_active_tab', 'builder'));
    const [subView, setSubView] = useState<'table' | 'preview' | 'batch'>(() => loadFromStorage('erp_sub_view', 'table')); // Data sub-views

    // Schema State
    const [schema, setSchema] = useState<any[]>(() => loadFromStorage('erp_schema', InitialSchema));
    const [activeFieldId, setActiveFieldId] = useState<string | null>(null);

    // Data State
    const [records, setRecords] = useState<any[]>(() => loadFromStorage('erp_records', []));
    const [previewData, setPreviewData] = useState<any>({});
    const [batchRows, setBatchRows] = useState<any[]>([]);

    // Advanced Filter State
    const [filters, setFilters] = useState<{ id: string, fieldId: string, operator: string, value: string }[]>(() => loadFromStorage('erp_filters', []));
    const [pendingFilter, setPendingFilter] = useState({ fieldId: '', operator: '', value: '' });
    const [savedViews, setSavedViews] = useState<{ name: string, filters: any[] }[]>(() => loadFromStorage('erp_saved_views', [
        { name: '库存预警', filters: [{ id: 'demo_1', fieldId: 'f3', operator: 'lt', value: '10' }] }
    ]));
    const [viewName, setViewName] = useState('');

    const [globalSearch, setGlobalSearch] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    const [errors, setErrors] = useState<Record<string, string>>({});

    // Preview Resizing Logic
    const [previewWidth, setPreviewWidth] = useState(450);
    const [showPreview, setShowPreview] = useState(true);
    const [isResizing, setIsResizing] = useState(false);

    // --- Form Library State ---
    const [savedForms, setSavedForms] = useState<{ id: string, name: string, description: string, schema: any[], timestamp: number }[]>(() => loadFromStorage('erp_saved_forms', [
        { id: 'form_default', name: 'Product Inventory', description: 'Standard product entry form', schema: InitialSchema, timestamp: Date.now() }
    ]));
    // showLibrary removed in favor of activeTab === 'library'
    const [saveFormOpen, setSaveFormOpen] = useState(false);
    const [formName, setFormName] = useState('');
    const [formDesc, setFormDesc] = useState('');
    const [templateSelectorOpen, setTemplateSelectorOpen] = useState(false);
    const [currentFormName, setCurrentFormName] = useState('Custom Form');

    // Drag from toolbox state
    const [isDraggingFromToolbox, setIsDraggingFromToolbox] = useState(false);
    const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);

    // Confirmation Modal State
    const [confirmDialog, setConfirmDialog] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        type: 'danger' | 'info';
        confirmText: string;
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { },
        type: 'info',
        confirmText: 'Confirm'
    });

    const triggerConfirm = (title: string, message: string, onConfirm: () => void, type: 'danger' | 'info' = 'info', confirmText = 'Confirm') => {
        setConfirmDialog({ isOpen: true, title, message, onConfirm, type, confirmText });
    };

    // Update current form name when schema matches a saved form
    useEffect(() => {
        const matchedForm = savedForms.find(f => JSON.stringify(f.schema) === JSON.stringify(schema));
        setCurrentFormName(matchedForm ? matchedForm.name : 'Custom Form');
    }, [schema, savedForms]);

    // --- Persistence Effects ---
    useEffect(() => {
        localStorage.setItem('erp_active_tab', JSON.stringify(activeTab));
    }, [activeTab]);

    useEffect(() => {
        localStorage.setItem('erp_sub_view', JSON.stringify(subView));
    }, [subView]);

    useEffect(() => {
        localStorage.setItem('erp_schema', JSON.stringify(schema));
    }, [schema]);

    useEffect(() => {
        localStorage.setItem('erp_records', JSON.stringify(records));
    }, [records]);

    useEffect(() => {
        localStorage.setItem('erp_saved_forms', JSON.stringify(savedForms));
    }, [savedForms]);

    useEffect(() => {
        localStorage.setItem('erp_saved_views', JSON.stringify(savedViews));
    }, [savedViews]);

    useEffect(() => {
        localStorage.setItem('erp_filters', JSON.stringify(filters));
    }, [filters]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing) return;
            const newWidth = document.body.clientWidth - e.clientX;
            if (newWidth >= 300 && newWidth <= 800) {
                setPreviewWidth(newWidth);
            }
        };
        const handleMouseUp = () => {
            setIsResizing(false);
        };
        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        } else {
            document.body.style.cursor = 'default';
            document.body.style.userSelect = 'auto';
        }
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'default';
            document.body.style.userSelect = 'auto';
        };
    }, [isResizing]);

    // DnD Refs
    const dragItem = useRef<number | null>(null);
    const dragOverItem = useRef<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Initialize batch rows
    useEffect(() => {
        if (batchRows.length === 0) {
            setBatchRows(Array(10).fill(null).map(() => ({ tempId: Date.now() + Math.random(), data: {} })));
        }
    }, []);

    // --- Builder Actions ---
    const addField = (type: string, insertAt?: number) => {
        const newField: any = {
            id: `f_${Date.now()}`,
            type,
            label: type === 'divider' ? 'Section' : type === 'notice' ? 'Notice' : 'New Field',
            required: false,
            width: '100%',
            options: ['Option 1', 'Option 2'],
            placeholder: '',
            helpText: '',
            showInGrid: true,
            showInBatch: true
        };

        if (insertAt !== undefined && insertAt >= 0 && insertAt <= schema.length) {
            const newSchema = [...schema];
            newSchema.splice(insertAt, 0, newField);
            setSchema(newSchema);
        } else {
            setSchema([...schema, newField]);
        }
        setActiveFieldId(newField.id);
        setDropTargetIndex(null);

        // Scroll to the new field
        setTimeout(() => {
            const el = document.getElementById('canvas-container');
            if (el && insertAt === undefined) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
        }, 100);
    };

    const removeField = (id: string) => {
        setSchema(schema.filter(f => f.id !== id));
        if (activeFieldId === id) setActiveFieldId(null);
    };

    const updateField = (id: string, key: string, value: any) => {
        setSchema(schema.map(f => f.id === id ? { ...f, [key]: value } : f));
    };

    const renameField = (id: string, newId: string) => {
        // Valdiation
        if (!newId || newId === id) return;
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(newId)) {
            addToast('Variable Name must start with a letter and contain only alphanumeric characters', 'error');
            return;
        }
        if (schema.some(f => f.id === newId)) {
            addToast('Variable Name must be unique', 'error');
            return;
        }

        // Smart Update: Update references in logic & Rename field
        const updatedSchema = schema.map(f => {
            // 1. Rename the target field
            if (f.id === id) return { ...f, id: newId };

            // 2. Update references in other fields' logic
            if (f.logic) {
                const newLogic: any = { ...f.logic };
                let modified = false;
                const logicKeys = ['visibility', 'calculation', 'readOnly', 'requiredRule', 'regex', 'errorMsg']; // regex/errorMsg usually don't reference others, but good to inspect if extended

                // Specific Check for keys that use variables
                ['visibility', 'calculation', 'readOnly', 'requiredRule'].forEach(key => {
                    if (newLogic[key] && typeof newLogic[key] === 'string' && newLogic[key].includes(`{${id}}`)) {
                        newLogic[key] = newLogic[key].split(`{${id}}`).join(`{${newId}}`);
                        modified = true;
                    }
                });

                if (modified) return { ...f, logic: newLogic };
            }
            return f;
        });

        setSchema(updatedSchema);

        // Update Active Selection
        if (activeFieldId === id) setActiveFieldId(newId);

        // Update DataRefs
        setPreviewData(prev => {
            const next = { ...prev };
            if (next[id] !== undefined) {
                next[newId] = next[id];
                delete next[id];
            }
            return next;
        });

        addToast(`Renamed variable to ${newId} and updated references`, 'success');
    };

    const updateOption = (id: string, idx: number, val: string) => {
        setSchema(schema.map((f: any) => {
            if (f.id !== id) return f;
            const newOpts = [...(f.options || [])];
            newOpts[idx] = val;
            return { ...f, options: newOpts };
        }));
    };

    const addOption = (id: string) => {
        setSchema(schema.map((f: any) => {
            if (f.id !== id) return f;
            const currentOpts = f.options || [];
            let nextNum = currentOpts.length + 1;
            // Simple heuristics to find next number
            while (currentOpts.includes(`Option ${nextNum}`)) {
                nextNum++;
            }
            return { ...f, options: [...currentOpts, `Option ${nextNum}`] };
        }));
    };

    const removeOption = (id: string, idx: number) => {
        setSchema(schema.map((f: any) => {
            if (f.id !== id) return f;
            return { ...f, options: (f.options || []).filter((_: any, i: number) => i !== idx) };
        }));
    };

    const handleDragSort = () => {
        if (dragItem.current !== null && dragOverItem.current !== null) {
            const _schema = [...schema];
            const draggedItemContent = _schema.splice(dragItem.current, 1)[0];
            _schema.splice(dragOverItem.current, 0, draggedItemContent);
            setSchema(_schema);
        }
        dragItem.current = null;
        dragOverItem.current = null;
    };

    // --- Data Actions ---
    const handleRecordSubmit = (data: any) => {
        // Validate
        const newErrors: Record<string, string> = {};
        schema.forEach((f: any) => {
            if (f.required && !['divider', 'notice', 'spacer'].includes(f.type)) {
                if (data[f.id] === undefined || data[f.id] === '' || data[f.id] === null) {
                    newErrors[f.id] = 'This field is required';
                }
            }
        });

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            addToast('Please fill in all required fields', 'error');
            return;
        }

        setRecords(prev => [{ _id: Date.now(), ...data }, ...prev]);
        addToast('Record added successfully', 'success');
        setPreviewData({});
        setSubView('table');
    };

    const handleBatchUpdate = (index: number, fieldId: string, value: any) => {
        const newRows = [...batchRows];
        newRows[index].data = { ...newRows[index].data, [fieldId]: value };
        setBatchRows(newRows);
    };

    const handleBatchSubmit = () => {
        const validRows = batchRows
            .filter(r => Object.keys(r.data).length > 0 && Object.values(r.data).some(v => v !== ''))
            .map(r => ({ _id: Date.now() + Math.random(), ...r.data }));

        if (validRows.length === 0) {
            addToast('No data to import', 'warning');
            return;
        }

        setRecords(prev => [...validRows, ...prev]);
        setBatchRows(Array(10).fill(null).map(() => ({ tempId: Date.now() + Math.random(), data: {} })));
        addToast(`Imported ${validRows.length} records`, 'success');
        setSubView('table');
    };

    const handleDeleteRecord = (id: number) => {
        triggerConfirm(
            'Delete Record',
            'Are you sure you want to delete this record? This action cannot be undone.',
            () => setRecords(prev => prev.filter(r => r._id !== id)),
            'danger',
            'Delete'
        );
    };

    // --- Filter Management ---
    const handleAddPendingFilter = () => {
        if (!pendingFilter.fieldId) {
            addToast('Please select a field', 'warning');
            return;
        }

        const field = schema.find(f => f.id === pendingFilter.fieldId);
        const ops = field ? getOperatorsForType(field.type) : [];
        const op = pendingFilter.operator || (ops.length > 0 ? ops[0].val : 'eq');

        setFilters([...filters, {
            id: `flt-${Date.now()}`,
            fieldId: pendingFilter.fieldId,
            operator: op,
            value: pendingFilter.value
        }]);

        setPendingFilter({ fieldId: '', operator: '', value: '' });
    };

    const handleRemoveFilter = (id: string) => {
        setFilters(prev => prev.filter(f => f.id !== id));
    };

    const handleSaveView = () => {
        if (!viewName.trim()) return;
        setSavedViews([...savedViews, { name: viewName, filters: [...filters] }]);
        setViewName('');
        addToast('View saved successfully', 'success');
    };

    const handleLoadView = (viewFilters: any[]) => {
        // Deep copy to avoid reference issues
        setFilters(JSON.parse(JSON.stringify(viewFilters)));
        addToast('View loaded', 'info');
    };

    // --- Filtering Logic ---
    const filteredRecords = useMemo(() => {
        return records.filter(r => {
            // 1. Global Search
            if (globalSearch && !Object.values(r).some(v => String(v).toLowerCase().includes(globalSearch.toLowerCase()))) {
                return false;
            }

            // 2. Advanced Filters
            return filters.every(f => {
                const val = r[f.fieldId];
                const fieldType = schema.find(s => s.id === f.fieldId)?.type || 'text';

                if (f.operator === 'eq') return String(val) == f.value;
                if (f.operator === 'neq') return String(val) != f.value;
                if (f.operator === 'contains') return String(val).toLowerCase().includes(f.value.toLowerCase());

                if (fieldType === 'number') {
                    const numVal = Number(val);
                    const filterVal = Number(f.value);
                    if (f.operator === 'gt') return numVal > filterVal;
                    if (f.operator === 'lt') return numVal < filterVal;
                    if (f.operator === 'gte') return numVal >= filterVal;
                    if (f.operator === 'lte') return numVal <= filterVal;
                }

                if (fieldType === 'date') {
                    const dateVal = new Date(val).getTime();
                    const filterDate = new Date(f.value).getTime();
                    if (f.operator === 'before') return dateVal < filterDate;
                    if (f.operator === 'after') return dateVal > filterDate;
                }

                return true;
            });
        });
    }, [records, globalSearch, filters, schema]);

    // --- Import/Export ---
    const handleExport = () => {
        const dataColumns = schema.filter(f => !['divider', 'notice', 'spacer'].includes(f.type));
        const headers = dataColumns.map(c => c.label);
        const rows = records.map(r => dataColumns.map(c => `"${r[c.id] || ''}"`).join(','));
        const csv = [headers.join(','), ...rows].join('\n');
        const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'erp_export.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleGenerateMock = () => {
        const mock: any = { _id: Date.now() };
        schema.forEach(f => {
            if (['text'].includes(f.type)) mock[f.id] = `Item ${Math.floor(Math.random() * 1000)}`;
            if (['number'].includes(f.type)) mock[f.id] = Math.floor(Math.random() * 100);
            if (['select', 'radio'].includes(f.type) && f.options) mock[f.id] = f.options[Math.floor(Math.random() * f.options.length)];
        });
        setRecords(prev => [mock, ...prev]);
        addToast('Generated mock record', 'info');
    };

    // --- Form Library Actions ---
    const handleSaveForm = () => {
        if (!formName.trim()) {
            addToast('Please enter a form name', 'error');
            return;
        }
        const newForm = {
            id: `form_${Date.now()}`,
            name: formName,
            description: formDesc,
            schema: [...schema], // Deep copy needed in real app, simplistic here
            timestamp: Date.now()
        };
        setSavedForms([newForm, ...savedForms]);
        setSaveFormOpen(false);
        setFormName('');
        setFormDesc('');
        addToast('Form saved to library', 'success');
    };

    const handleLoadForm = (formId: string, targetTab: 'builder' | 'data' = 'builder') => {
        const form = savedForms.find(f => f.id === formId);
        if (form) {
            triggerConfirm(
                'Load Template',
                'Loading a new form will overwrite your current workspace. Continue?',
                () => {
                    setSchema([...form.schema]);
                    addToast(`Loaded form: ${form.name}`, 'success');
                    setActiveTab(targetTab);
                    setTemplateSelectorOpen(false);
                },
                'info',
                'Load Template'
            );
        }
    };

    const handleDeleteForm = (formId: string) => {
        triggerConfirm(
            'Delete Template',
            'Are you sure you want to delete this form template?',
            () => {
                setSavedForms(prev => prev.filter(f => f.id !== formId));
                addToast('Form template deleted', 'info');
            },
            'danger',
            'Delete'
        );
    };

    // Data columns only
    const layoutTypes = ['divider', 'notice', 'spacer'];
    const allDataFields = schema.filter(f => !layoutTypes.includes(f.type));
    const gridColumns = allDataFields.filter(f => f.showInGrid !== false);
    const batchColumns = allDataFields.filter(f => f.showInBatch !== false);

    return (
        <div className="flex flex-col h-full bg-slate-50 font-sans text-slate-900">

            {/* Top Header */}
            <header className="bg-white border-b border-gray-200 px-6 h-16 flex items-center justify-between shrink-0 z-30">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center text-white shadow-md">
                        <Database size={18} />
                    </div>
                    <div>
                        <h1 className="font-extrabold text-lg text-gray-900 tracking-tight leading-none">ERP Data Manager</h1>
                        <p className="text-[10px] font-bold text-gray-400 uppercase mt-0.5 tracking-wider">Dynamic Schema Engine</p>
                    </div>
                </div>

                {/* Mode Switcher */}
                <div className="bg-slate-100 p-1 rounded-lg border border-slate-200 flex">
                    <button
                        onClick={() => setActiveTab('builder')}
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'builder' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Settings2 size={14} /> Schema Builder
                    </button>
                    <button
                        onClick={() => setActiveTab('data')}
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'data' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <TableIcon size={14} /> Data Manager
                    </button>
                    <div className="w-px bg-gray-200 mx-1 my-1"></div>
                    <button
                        onClick={() => setActiveTab('library')}
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'library' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Folder size={14} /> Form Library
                    </button>
                    <div className="w-px bg-gray-200 mx-1 my-1"></div>
                    <button
                        onClick={() => setActiveTab('guide')}
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'guide' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <BookOpen size={14} /> Logic Guide
                    </button>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleGenerateMock}
                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-md hover:bg-slate-200 transition-colors text-xs font-bold"
                    >
                        <ListOrdered size={14} /> Mock Data
                    </button>
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-md hover:bg-indigo-100 transition-colors text-xs font-bold"
                    >
                        <ArrowDown size={14} /> Export CSV
                    </button>

                    <div className="h-6 w-px bg-gray-200 mx-1"></div>

                    <button className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                        <Bell size={18} />
                    </button>
                    <div className="w-8 h-8 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-xs font-bold text-indigo-700">
                        JS
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 overflow-hidden relative flex flex-col">

                {/* === BUILDER MODE === */}
                {
                    activeTab === 'builder' && (
                        <div className="flex flex-1 overflow-hidden animate-in fade-in duration-300">

                            {/* 1. New Left Sidebar Toolbox (Sleek) */}
                            <div className="w-16 lg:w-56 bg-white border-r border-gray-200 flex flex-col shrink-0 z-20">
                                <div className="p-5 pb-2 border-b border-gray-50 bg-white">
                                    <h3 className="text-xs font-bold text-slate-800 hidden lg:block">Components</h3>
                                    <p className="text-[10px] text-slate-400 mt-0.5 hidden lg:block">Drag or click to add</p>
                                    <LayoutTemplate size={20} className="lg:hidden mx-auto text-slate-400" />
                                </div>

                                <div className="flex-1 overflow-y-auto p-3 space-y-6 custom-scrollbar">
                                    {/* Group: Inputs */}
                                    <div className="space-y-1">
                                        <h4 className="px-3 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2 hidden lg:block">Basic Inputs</h4>
                                        <ToolboxItem type="text" label="Text Input" icon={Type} onClick={addField} colorClass="text-blue-500 group-hover:text-blue-600" />
                                        <ToolboxItem type="number" label="Number" icon={Hash} onClick={addField} colorClass="text-emerald-500 group-hover:text-emerald-600" />
                                        <ToolboxItem type="date" label="Date Picker" icon={Calendar} onClick={addField} colorClass="text-orange-500 group-hover:text-orange-600" />
                                    </div>

                                    {/* Group: Choices */}
                                    <div className="space-y-1">
                                        <h4 className="px-3 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2 hidden lg:block">Selection</h4>
                                        <ToolboxItem type="select" label="Dropdown" icon={List} onClick={addField} colorClass="text-purple-500 group-hover:text-purple-600" />
                                        <ToolboxItem type="radio" label="Radio Group" icon={CircleIcon} onClick={addField} colorClass="text-pink-500 group-hover:text-pink-600" />
                                        <ToolboxItem type="checkbox" label="Checkbox" icon={CheckSquare} onClick={addField} colorClass="text-teal-500 group-hover:text-teal-600" />
                                    </div>

                                    {/* Group: Layout */}
                                    <div className="space-y-1">
                                        <h4 className="px-3 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2 hidden lg:block">Structure</h4>
                                        <ToolboxItem type="divider" label="Divider Line" icon={Minus} onClick={addField} colorClass="text-slate-500 group-hover:text-slate-700" />
                                        <ToolboxItem type="notice" label="Warning / Notice" icon={Bell} onClick={addField} colorClass="text-amber-500 group-hover:text-amber-600" />
                                        <ToolboxItem type="spacer" label="Empty Space" icon={MoveVertical} onClick={addField} colorClass="text-slate-400 group-hover:text-slate-600" />
                                    </div>

                                    {/* Group: Advanced & Layout */}
                                    <div className="space-y-1">
                                        <h4 className="px-3 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2 hidden lg:block">Advanced & Layout</h4>
                                        <ToolboxItem type="richtext" label="Rich Text" icon={FileText} onClick={addField} colorClass="text-violet-500 group-hover:text-violet-600" />
                                        <ToolboxItem type="file" label="File Upload" icon={Upload} onClick={addField} colorClass="text-sky-500 group-hover:text-sky-600" />
                                        <ToolboxItem type="signature" label="Signature" icon={PenTool} onClick={addField} colorClass="text-gray-500 group-hover:text-gray-700" />
                                        <ToolboxItem type="rating" label="Star Rating" icon={Star} onClick={addField} colorClass="text-yellow-500 group-hover:text-yellow-600" />
                                        <ToolboxItem type="card" label="Card Container" icon={CreditCard} onClick={addField} colorClass="text-indigo-600 group-hover:text-indigo-700" />
                                        <ToolboxItem type="time" label="Time Picker" icon={Clock} onClick={addField} colorClass="text-lime-500 group-hover:text-lime-600" />
                                        <ToolboxItem type="switch" label="Switch" icon={ToggleLeft} onClick={addField} colorClass="text-indigo-500 group-hover:text-indigo-600" />
                                        <ToolboxItem type="steps" label="Steps Flow" icon={ListOrdered} onClick={addField} colorClass="text-slate-500 group-hover:text-slate-600" />
                                    </div>
                                </div>

                                {/* Sidebar Footer */}
                                <div className="p-4 border-t border-gray-100 bg-gray-50/50 hidden lg:block">
                                    <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-center">
                                        <p className="text-[10px] text-indigo-800 font-medium mb-1">Manage Forms</p>
                                        <button
                                            onClick={() => setSaveFormOpen(true)}
                                            className="text-[10px] bg-white border border-indigo-200 text-indigo-600 font-bold px-3 py-1.5 rounded-full hover:bg-indigo-50 transition-colors w-full shadow-sm mb-2"
                                        >
                                            Save to Library
                                        </button>
                                        <button
                                            onClick={() => setActiveTab('library')}
                                            className="text-[10px] bg-indigo-600 text-white font-bold px-3 py-1.5 rounded-full hover:bg-indigo-700 transition-colors w-full shadow-sm"
                                        >
                                            Open Library
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div className="flex-1 bg-slate-50/50 overflow-y-auto p-4 md:p-8 custom-scrollbar relative" id="canvas-container" onClick={() => setActiveFieldId(null)}>
                                <div className="max-w-xl mx-auto">
                                    {/* Canvas Header / Title */}
                                    <div className="mb-6 flex items-center justify-between">
                                        <div>
                                            <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                                <Settings2 size={16} className="text-gray-400" /> Form Structure
                                            </h3>
                                            <p className="text-xs text-gray-400 mt-1">Drag to reorder. Click to edit.</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {!showPreview && (
                                                <button
                                                    onClick={() => setShowPreview(true)}
                                                    className="flex items-center gap-2 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors border border-indigo-200 animate-in fade-in zoom-in duration-200"
                                                >
                                                    <Columns size={14} /> Open Preview
                                                </button>
                                            )}
                                            <div className="text-xs font-mono text-gray-300 bg-gray-100 px-2 py-1 rounded">v1.0</div>
                                        </div>
                                    </div>

                                    {schema.length === 0 ? (
                                        <div
                                            className={`h-96 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center bg-white/50 transition-colors cursor-pointer ${isDraggingFromToolbox ? 'border-indigo-400 bg-indigo-50/50' : 'border-slate-200 hover:bg-white/80'}`}
                                            onClick={() => addField('text')}
                                            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
                                            onDragEnter={() => setIsDraggingFromToolbox(true)}
                                            onDragLeave={() => setIsDraggingFromToolbox(false)}
                                            onDrop={(e) => {
                                                e.preventDefault();
                                                const type = e.dataTransfer.getData('component-type');
                                                if (type) addField(type);
                                                setIsDraggingFromToolbox(false);
                                            }}
                                        >
                                            <div className="p-4 bg-slate-50 rounded-full mb-4">
                                                <LayoutTemplate size={32} className="opacity-50 text-slate-400" />
                                            </div>
                                            <p className="font-bold text-sm text-slate-400">Form is Empty</p>
                                            <p className="text-xs mt-1 text-slate-400">{isDraggingFromToolbox ? 'Drop component here' : 'Drag or click a component from the left sidebar'}</p>

                                        </div>
                                    ) : (
                                        <div className="space-y-1 pb-20">
                                            {/* Drop zone before first item */}
                                            <div
                                                className={`h-2 rounded transition-all ${dropTargetIndex === 0 ? 'bg-indigo-400 h-3' : 'bg-transparent'}`}
                                                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
                                                onDragEnter={() => { setIsDraggingFromToolbox(true); setDropTargetIndex(0); }}
                                                onDragLeave={() => setDropTargetIndex(null)}
                                                onDrop={(e) => {
                                                    e.preventDefault();
                                                    const type = e.dataTransfer.getData('component-type');
                                                    if (type) addField(type, 0);
                                                    setIsDraggingFromToolbox(false);
                                                    setDropTargetIndex(null);
                                                }}
                                            />
                                            {schema.map((field, idx) => (
                                                <React.Fragment key={field.id}>
                                                    <FieldEditor
                                                        field={field}
                                                        index={idx}
                                                        isActive={activeFieldId === field.id}
                                                        onClick={() => setActiveFieldId(field.id)}
                                                        onUpdate={updateField}
                                                        onRemove={removeField}
                                                        onRename={renameField}
                                                        onUpdateOption={updateOption}
                                                        onAddOption={addOption}
                                                        onRemoveOption={removeOption}
                                                        onDragStart={(e: any) => { dragItem.current = idx; }}
                                                        onDragEnter={(e: any) => { dragOverItem.current = idx; }}
                                                        onDragEnd={handleDragSort}
                                                    />
                                                    {/* Drop zone after each item */}
                                                    <div
                                                        className={`h-2 rounded transition-all ${dropTargetIndex === idx + 1 ? 'bg-indigo-400 h-3' : 'bg-transparent'}`}
                                                        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
                                                        onDragEnter={() => { setIsDraggingFromToolbox(true); setDropTargetIndex(idx + 1); }}
                                                        onDragLeave={() => setDropTargetIndex(null)}
                                                        onDrop={(e) => {
                                                            e.preventDefault();
                                                            const type = e.dataTransfer.getData('component-type');
                                                            if (type) addField(type, idx + 1);
                                                            setIsDraggingFromToolbox(false);
                                                            setDropTargetIndex(null);
                                                        }}
                                                    />
                                                </React.Fragment>
                                            ))}

                                            {/* Drop Zone Hint */}
                                            <div
                                                className={`h-24 border-2 border-dashed rounded-xl flex items-center justify-center text-xs font-bold transition-all ${isDraggingFromToolbox ? 'border-indigo-400 bg-indigo-50/50 text-indigo-500' : 'border-transparent text-indigo-300 hover:border-indigo-200'}`}
                                                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
                                                onDragEnter={() => setIsDraggingFromToolbox(true)}
                                                onDragLeave={() => setIsDraggingFromToolbox(false)}
                                                onDrop={(e) => {
                                                    e.preventDefault();
                                                    const type = e.dataTransfer.getData('component-type');
                                                    if (type) addField(type);
                                                    setIsDraggingFromToolbox(false);
                                                }}
                                            >
                                                {isDraggingFromToolbox ? 'Drop component here' : 'End of Form'}
                                            </div>

                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 3. Right: Live Preview */}
                            <div
                                style={{ width: showPreview ? previewWidth : 0, opacity: showPreview ? 1 : 0 }}
                                className={`z-30 hidden xl:flex flex-col relative transition-[opacity] duration-300 ${!showPreview ? 'pointer-events-none' : ''}`}
                            >
                                {/* Resize Handle */}
                                <div
                                    onMouseDown={(e) => { e.preventDefault(); setIsResizing(true); }}
                                    className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-indigo-500 hover:w-1.5 transition-all z-50"
                                ></div>

                                {/* Collapse Button */}
                                <div className="absolute top-6 right-6 z-50">
                                    <button
                                        onClick={() => setShowPreview(false)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/80 backdrop-blur border border-slate-200 shadow-sm rounded-full text-xs font-bold text-slate-500 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition-all group"
                                        title="Close Preview"
                                    >
                                        <span>Hide</span>
                                        <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                                    <FormPreview
                                        schema={schema}
                                        data={previewData}
                                        setData={setPreviewData}
                                        errors={errors}
                                        setErrors={setErrors}
                                    />
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* === DATA MODE (Restored from previous turn) === */}
                {
                    activeTab === 'data' && (
                        <div className="flex flex-col h-full bg-white animate-in fade-in duration-300">
                            {/* Data Toolbar */}
                            <div className="bg-white border-b border-gray-200 px-6 py-3 flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-20 shadow-sm/50">
                                {/* Sub-View Switcher (Left) */}
                                <div className="flex items-center gap-1 bg-gray-100/80 p-1 rounded-lg self-start md:self-auto">
                                    <button onClick={() => setSubView('table')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${subView === 'table' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                                        <TableIcon size={14} /> Grid View
                                    </button>
                                    <button onClick={() => setSubView('batch')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${subView === 'batch' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                                        <Grid size={14} /> Batch Entry
                                    </button>
                                    <button onClick={() => setSubView('preview')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${subView === 'preview' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                                        <FormInput size={14} /> New Entry
                                    </button>
                                </div>

                                {/* Actions (Right) */}
                                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                                    {/* Template Selector */}
                                    <div className="relative">
                                        <button
                                            onClick={() => setTemplateSelectorOpen(!templateSelectorOpen)}
                                            className="w-full sm:w-auto flex items-center justify-between gap-2 px-3 py-2 bg-indigo-50 border border-indigo-100 rounded-lg text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                <Folder size={14} />
                                                <span className="truncate max-w-[100px]">{currentFormName}</span>
                                            </div>
                                            <ChevronDown size={12} />
                                        </button>

                                        {templateSelectorOpen && (
                                            <>
                                                <div className="fixed inset-0 z-10" onClick={() => setTemplateSelectorOpen(false)}></div>
                                                <div className="absolute top-full right-0 mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-xl z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                                    <div className="p-2 border-b border-gray-100 bg-gray-50">
                                                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider px-2">Select Template</span>
                                                    </div>
                                                    <div className="max-h-60 overflow-y-auto p-1">
                                                        {savedForms.length === 0 ? (
                                                            <div className="text-xs text-gray-400 p-3 text-center italic">No saved templates</div>
                                                        ) : (
                                                            savedForms.map(form => (
                                                                <div
                                                                    key={form.id}
                                                                    onClick={() => handleLoadForm(form.id, 'data')}
                                                                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-indigo-50 cursor-pointer group"
                                                                >
                                                                    <div className="w-6 h-6 rounded bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-bold uppercase shrink-0">
                                                                        {form.name.substring(0, 2)}
                                                                    </div>
                                                                    <div className="overflow-hidden">
                                                                        <div className="text-xs font-bold text-gray-700 truncate group-hover:text-indigo-700">{form.name}</div>
                                                                        <div className="text-[10px] text-gray-400 truncate">{new Date(form.timestamp).toLocaleDateString()}</div>
                                                                    </div>
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                    <div className="p-2 border-t border-gray-100 bg-gray-50">
                                                        <button
                                                            onClick={() => { setActiveTab('library'); setTemplateSelectorOpen(false); }}
                                                            className="w-full text-xs font-bold text-indigo-600 hover:underline text-center"
                                                        >
                                                            Manage Library
                                                        </button>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    <div className="relative flex-1 sm:flex-none">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                                            placeholder="Search records..."
                                            value={globalSearch}
                                            onChange={(e) => setGlobalSearch(e.target.value)}
                                        />
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setShowFilters(!showFilters)}
                                            className={`p-2 rounded-lg border transition-colors ${showFilters ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                                            title="Toggle Filters"
                                        >
                                            <Filter size={16} />
                                        </button>
                                        <div className="h-6 w-px bg-gray-200 mx-1 hidden sm:block"></div>
                                        <button onClick={handleGenerateMock} className="hidden sm:flex items-center gap-2 px-3 py-2 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors">
                                            <RefreshCw size={14} /> Mock
                                        </button>
                                        <button onClick={handleExport} className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-gray-50 rounded-lg transition-colors" title="Export CSV">
                                            <Download size={16} />
                                        </button>
                                        <button onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-gray-50 rounded-lg transition-colors" title="Import CSV">
                                            <Upload size={16} />
                                        </button>
                                        <input type="file" className="hidden" ref={fileInputRef} onChange={(e) => { /* Import Logic Here if simple */ addToast('Import simulated', 'info'); }} />
                                    </div>
                                </div>
                            </div>

                            {/* Enhanced Filter Panel */}
                            {showFilters && (
                                <div className="border-b border-gray-200 bg-white animate-in slide-in-from-top-2">
                                    <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-gray-100">

                                        {/* Left: Filter Builder */}
                                        <div className="p-5 flex-1 space-y-4">
                                            <div className="flex items-center gap-2 text-indigo-600 mb-2">
                                                <Filter size={16} />
                                                <span className="text-sm font-bold">添加筛选条件</span>
                                            </div>

                                            <div className="flex flex-wrap items-end gap-3">
                                                <div className="flex-1 min-w-[140px]">
                                                    <select
                                                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-500 bg-gray-50 focus:bg-white transition-all"
                                                        value={pendingFilter.fieldId}
                                                        onChange={(e) => {
                                                            const field = schema.find(f => f.id === e.target.value);
                                                            const defaultOp = field ? getOperatorsForType(field.type)[0].val : '';
                                                            setPendingFilter({ ...pendingFilter, fieldId: e.target.value, operator: defaultOp });
                                                        }}
                                                    >
                                                        <option value="">选择字段...</option>
                                                        {allDataFields.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                                                    </select>
                                                </div>

                                                {pendingFilter.fieldId && (
                                                    <div className="w-[120px]">
                                                        <select
                                                            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-500 bg-gray-50 focus:bg-white transition-all"
                                                            value={pendingFilter.operator}
                                                            onChange={(e) => setPendingFilter({ ...pendingFilter, operator: e.target.value })}
                                                        >
                                                            {getOperatorsForType(schema.find(f => f.id === pendingFilter.fieldId)?.type || 'text').map(op => (
                                                                <option key={op.val} value={op.val}>{op.label}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                )}

                                                <div className="flex-1 min-w-[140px]">
                                                    <input
                                                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-500 bg-gray-50 focus:bg-white transition-all"
                                                        placeholder="值..."
                                                        value={pendingFilter.value}
                                                        onChange={(e) => setPendingFilter({ ...pendingFilter, value: e.target.value })}
                                                        onKeyDown={(e) => e.key === 'Enter' && handleAddPendingFilter()}
                                                    />
                                                </div>

                                                <button
                                                    onClick={handleAddPendingFilter}
                                                    className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors shadow-sm"
                                                >
                                                    添加
                                                </button>
                                            </div>

                                            {/* Active Filters Chips */}
                                            <div className="flex flex-wrap gap-2 pt-2">
                                                {filters.length === 0 && <span className="text-xs text-gray-400 italic">暂无筛选条件</span>}
                                                {filters.map((f, i) => {
                                                    const field = schema.find(s => s.id === f.fieldId);
                                                    const opLabel = getOperatorsForType(field?.type || 'text').find(o => o.val === f.operator)?.label || f.operator;
                                                    return (
                                                        <div key={f.id} className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1.5 rounded-full text-xs font-medium animate-in zoom-in-95">
                                                            <span className="font-bold">{field?.label}</span>
                                                            <span className="text-indigo-400">{opLabel}</span>
                                                            <span className="font-bold">{f.value}</span>
                                                            <button onClick={() => handleRemoveFilter(f.id)} className="hover:text-red-500 ml-1"><X size={12} /></button>
                                                        </div>
                                                    );
                                                })}
                                                {filters.length > 0 && (
                                                    <button onClick={() => setFilters([])} className="text-xs text-red-500 hover:underline self-center ml-2">
                                                        清除所有
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Right: View Presets */}
                                        <div className="p-5 lg:w-80 space-y-4 bg-gray-50/50">
                                            <div className="flex items-center gap-2 text-gray-600 mb-2">
                                                <Bookmark size={16} />
                                                <span className="text-sm font-bold">视图预设</span>
                                            </div>

                                            <div className="space-y-2">
                                                {savedViews.map((view, idx) => (
                                                    <div
                                                        key={idx}
                                                        className="flex items-center justify-between text-sm group cursor-pointer hover:bg-white p-2 rounded-lg transition-colors border border-transparent hover:border-gray-200"
                                                        onClick={() => handleLoadView(view.filters)}
                                                    >
                                                        <div className="flex items-center gap-2 text-gray-600 group-hover:text-indigo-600">
                                                            <List size={14} />
                                                            <span>{view.name}</span>
                                                        </div>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setSavedViews(savedViews.filter((_, i) => i !== idx)); }}
                                                            className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        >
                                                            <X size={12} />
                                                        </button>
                                                    </div>
                                                ))}
                                                {savedViews.length === 0 && <div className="text-xs text-gray-400 italic px-2">暂无预设视图</div>}
                                            </div>

                                            <div className="pt-3 border-t border-gray-200 flex gap-2">
                                                <input
                                                    className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 outline-none focus:border-indigo-500"
                                                    placeholder="视图名称..."
                                                    value={viewName}
                                                    onChange={(e) => setViewName(e.target.value)}
                                                />
                                                <button
                                                    onClick={handleSaveView}
                                                    disabled={!viewName.trim() || filters.length === 0}
                                                    className="text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    保存
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Content */}
                            <div className="flex-1 overflow-hidden bg-slate-50 relative">

                                {/* TABLE VIEW */}
                                {subView === 'table' && (
                                    <div className="h-full overflow-auto custom-scrollbar p-6">
                                        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-x-auto min-h-[400px]">
                                            <table className="w-full text-left border-collapse">
                                                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10 shadow-sm">
                                                    <tr>
                                                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase w-16 text-center bg-gray-50">#</th>
                                                        {gridColumns.map(f => (
                                                            <th key={f.id} className="px-6 py-4 text-xs font-bold text-gray-500 uppercase whitespace-nowrap min-w-[150px] bg-gray-50 border-l border-gray-100">
                                                                {f.label}
                                                            </th>
                                                        ))}
                                                        <th className="px-6 py-4 w-20 text-center bg-gray-50 border-l border-gray-100">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {filteredRecords.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={gridColumns.length + 2} className="px-6 py-16 text-center text-gray-400">
                                                                <div className="flex flex-col items-center gap-3">
                                                                    <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center">
                                                                        <Search size={24} className="opacity-30" />
                                                                    </div>
                                                                    <p className="text-sm font-medium">No records found.</p>
                                                                    <button onClick={() => setSubView('preview')} className="text-indigo-600 font-bold text-xs hover:underline mt-1">Add your first record</button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        filteredRecords.map((row, i) => (
                                                            <tr key={row._id} className="hover:bg-indigo-50/30 transition-colors group">
                                                                <td className="px-6 py-4 text-xs font-mono text-gray-400 text-center group-hover:text-indigo-400">{i + 1}</td>
                                                                {gridColumns.map(f => (
                                                                    <td key={f.id} className="px-6 py-4 text-sm text-gray-700 whitespace-nowrap border-l border-transparent group-hover:border-indigo-100 max-w-xs truncate">
                                                                        {f.type === 'checkbox' ? (
                                                                            row[f.id] ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Yes</span> : <span className="text-gray-400 text-xs">No</span>
                                                                        ) : (
                                                                            safeRenderValue(row[f.id]) || <span className="text-gray-300">-</span>
                                                                        )}
                                                                    </td>
                                                                ))}
                                                                <td className="px-6 py-4 text-center border-l border-transparent group-hover:border-indigo-100">
                                                                    <button
                                                                        onClick={() => handleDeleteRecord(row._id)}
                                                                        className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1.5 hover:bg-red-50 rounded"
                                                                    >
                                                                        <Trash2 size={16} />
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                        <div className="mt-4 flex justify-between items-center text-xs text-gray-500 px-2">
                                            <span>Showing {filteredRecords.length} records</span>
                                            <span>Page 1 of 1</span>
                                        </div>
                                    </div>
                                )}

                                {/* BATCH VIEW */}
                                {subView === 'batch' && (
                                    <div className="h-full flex flex-col p-6">
                                        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex-1 flex flex-col">
                                            <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                                                <h3 className="font-bold text-gray-700 text-sm flex items-center gap-2"><Grid size={16} /> Batch Entry Mode</h3>
                                                <div className="flex gap-2">
                                                    <button onClick={() => setBatchRows([...batchRows, { tempId: Date.now(), data: {} }])} className="text-xs font-bold text-indigo-600 bg-white border border-indigo-200 px-3 py-1.5 rounded hover:bg-indigo-50 transition-colors">+ Add Row</button>
                                                    <button onClick={handleBatchSubmit} className="text-xs font-bold text-white bg-indigo-600 px-3 py-1.5 rounded hover:bg-indigo-700 transition-colors shadow-sm">Save All</button>
                                                </div>
                                            </div>
                                            <div className="overflow-auto flex-1">
                                                <table className="w-full text-left border-collapse">
                                                    <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                                                        <tr>
                                                            <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase w-12 text-center">#</th>
                                                            {batchColumns.map(f => (
                                                                <th key={f.id} className="px-4 py-3 text-xs font-bold text-gray-500 uppercase whitespace-nowrap min-w-[150px] border-l border-gray-100">
                                                                    {f.label} {f.required && <span className="text-red-500">*</span>}
                                                                </th>
                                                            ))}
                                                            <th className="px-4 py-3 w-10"></th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-100">
                                                        {batchRows.map((row, idx) => (
                                                            <tr key={row.tempId} className="group hover:bg-indigo-50/10">
                                                                <td className="px-4 py-2 text-center text-xs text-gray-400 font-mono">{idx + 1}</td>
                                                                {batchColumns.map(f => (
                                                                    <td key={f.id} className="p-0 border-l border-gray-100">
                                                                        {f.type === 'select' ? (
                                                                            <select
                                                                                className="w-full px-4 py-2 text-sm bg-transparent outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 transition-all h-full"
                                                                                value={row.data[f.id] || ''}
                                                                                onChange={e => handleBatchUpdate(idx, f.id, e.target.value)}
                                                                            >
                                                                                <option value="">Select...</option>
                                                                                {f.options?.map((o: string) => <option key={o} value={o}>{o}</option>)}
                                                                            </select>
                                                                        ) : f.type === 'checkbox' ? (
                                                                            <div className="flex items-center justify-center py-2">
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={!!row.data[f.id]}
                                                                                    onChange={e => handleBatchUpdate(idx, f.id, e.target.checked)}
                                                                                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                                                                                />
                                                                            </div>
                                                                        ) : (
                                                                            <input
                                                                                type={f.type === 'number' ? 'number' : 'text'}
                                                                                className="w-full px-4 py-2 text-sm bg-transparent outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder-gray-300"
                                                                                placeholder={f.label}
                                                                                value={row.data[f.id] || ''}
                                                                                onChange={e => handleBatchUpdate(idx, f.id, e.target.value)}
                                                                            />
                                                                        )}
                                                                    </td>
                                                                ))}
                                                                <td className="px-2 text-center">
                                                                    <button onClick={() => setBatchRows(batchRows.filter((_, i) => i !== idx))} className="text-gray-300 hover:text-red-500 p-1 rounded hover:bg-red-50">
                                                                        <X size={14} />
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* FORM VIEW (Single Entry) */}
                                {subView === 'preview' && (
                                    <div className="h-full overflow-y-auto custom-scrollbar p-8 flex justify-center">
                                        <div className="w-full max-w-4xl animate-in slide-in-from-bottom-4 duration-300">
                                            <FormPreview
                                                schema={schema}
                                                data={previewData}
                                                setData={setPreviewData}
                                                errors={errors}
                                                setErrors={setErrors}
                                                onSubmit={() => handleRecordSubmit(previewData)}
                                                onCancel={() => setSubView('table')}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                }

                {/* --- Form Library Tab Content --- */}
                {
                    activeTab === 'library' && (
                        <div className="flex-1 bg-slate-50 p-8 overflow-y-auto animate-in fade-in duration-300">
                            <div className="max-w-5xl mx-auto">
                                <div className="flex justify-between items-center mb-8">
                                    <div>
                                        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                                            <Folder size={28} className="text-indigo-600" /> Form Library
                                        </h2>
                                        <p className="text-sm text-gray-500 mt-2">Manage your collection of saved form templates and schemas.</p>
                                    </div>
                                    <button
                                        onClick={() => setActiveTab('builder')}
                                        className="flex items-center gap-2 px-4 py-2 bg-white text-indigo-600 border border-indigo-200 rounded-lg text-sm font-bold hover:bg-indigo-50 hover:border-indigo-300 transition-all shadow-sm"
                                    >
                                        <ArrowRight size={16} /> Back to Builder
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {/* Create New Card */}
                                    <div
                                        onClick={() => {
                                            triggerConfirm(
                                                'Create New Form',
                                                'Create a blank new form? Current changes will be lost.',
                                                () => {
                                                    setSchema([]);
                                                    setActiveTab('builder');
                                                    addToast('Created new blank form', 'info');
                                                },
                                                'info',
                                                'Create New'
                                            );
                                        }}
                                        className="bg-white p-6 rounded-2xl border-2 border-dashed border-gray-200 hover:border-indigo-400 hover:bg-indigo-50/10 cursor-pointer transition-all group flex flex-col items-center justify-center text-center h-48 shadow-sm hover:shadow-md"
                                    >
                                        <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform text-indigo-600">
                                            <Plus size={24} />
                                        </div>
                                        <h4 className="font-bold text-gray-700">Create New Form</h4>
                                        <p className="text-xs text-gray-400 mt-2">Start from a blank canvas</p>
                                    </div>

                                    {savedForms.map(form => (
                                        <div key={form.id} className="bg-white p-6 rounded-2xl border border-gray-100 hover:border-indigo-200 hover:shadow-lg transition-all group relative flex flex-col h-48">
                                            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteForm(form.id); }}
                                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Delete Template"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>

                                            <div className="flex items-start gap-4 mb-4">
                                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm uppercase shadow-md shrink-0">
                                                    {form.name.substring(0, 2)}
                                                </div>
                                                <div className="overflow-hidden">
                                                    <h4 className="font-bold text-gray-800 truncate" title={form.name}>{form.name}</h4>
                                                    <span className="text-xs text-gray-400 mt-1 block flex items-center gap-1">
                                                        <Clock size={10} /> {new Date(form.timestamp).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            </div>

                                            <p className="text-sm text-gray-500 line-clamp-2 mb-auto flex-1">{form.description || 'No description provided.'}</p>

                                            <button
                                                onClick={() => handleLoadForm(form.id)}
                                                className="w-full py-2.5 mt-4 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-100 flex items-center justify-center gap-2 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-transparent"
                                            >
                                                Load Template <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* === LOGIC GUIDE TAB === */}
                {
                    activeTab === 'guide' && <LogicGuide />
                }

            </main>

            {/* --- Save Form Modal --- */}
            {
                saveFormOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
                        <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100">
                                <h3 className="font-bold text-gray-800">Save Form Template</h3>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Form Name</label>
                                    <input
                                        autoFocus
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 transition-all"
                                        placeholder="e.g., Q3 Survey"
                                        value={formName}
                                        onChange={e => setFormName(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description</label>
                                    <textarea
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 transition-all h-20 resize-none"
                                        placeholder="Optional description..."
                                        value={formDesc}
                                        onChange={e => setFormDesc(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-2">
                                <button onClick={() => setSaveFormOpen(false)} className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors">Cancel</button>
                                <button onClick={handleSaveForm} className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors">Save Form</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* --- Generic Confirmation Modal --- */}
            {
                confirmDialog.isOpen && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
                        <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100">
                                <h3 className={`font-bold ${confirmDialog.type === 'danger' ? 'text-red-600' : 'text-gray-800'}`}>{confirmDialog.title}</h3>
                            </div>
                            <div className="p-6 text-sm text-gray-600 leading-relaxed">
                                {confirmDialog.message}
                            </div>
                            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-2">
                                <button
                                    onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                                    className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        confirmDialog.onConfirm();
                                        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                                    }}
                                    className={`px-4 py-2 text-xs font-bold text-white rounded-lg transition-colors ${confirmDialog.type === 'danger' ? 'bg-red-500 hover:bg-red-600' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                                >
                                    {confirmDialog.confirmText}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

        </div >
    );
};
