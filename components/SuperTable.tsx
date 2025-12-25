import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import {
    Plus, Trash2, GripVertical, Code, Eye, Save, Type, List,
    CheckSquare, Calendar, Hash, ArrowDown,
    Minus, AlertCircle, Info, Table as TableIcon,
    RefreshCw, X, MoveVertical, AlertTriangle, CheckCircle, Bell,
    Filter, Search, Bookmark, Download, Upload, Copy, Grid,
    Settings2, LayoutTemplate, Circle as CircleIcon, SlidersHorizontal,
    ChevronRight, ChevronDown, MoreHorizontal, Database, ArrowRight,
    Maximize2, Columns, Edit3, Check, ChevronUp, Layers, BoxSelect,
    ToggleLeft, FileText, PenTool, Star, CreditCard, Clock, Link,
    ListOrdered, Folder, Sidebar, FormInput, BookOpen, Lightbulb, FunctionSquare, Calculator, Regex, Sparkles,
    ArrowDownUp, ArrowDownAZ, ArrowUpAZ, ArrowUp,
    Package, Box, Settings, ChevronLeft, ShoppingCart, MousePointerClick, Tag, Bot
} from 'lucide-react';
import { read, utils, writeFile } from 'xlsx';
import { generateFormSchemaFromData, generateFormFromDescription, generateFormLogic } from '../services/geminiService';
import { useToast } from '../contexts/ToastContext';
import { ConfirmDialog } from './ConfirmDialog';

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
    const commonOps = [
        { val: 'isEmpty', label: '为空' },
        { val: 'isNotEmpty', label: '非空' }
    ];

    switch (type) {
        case 'number': return [
            { val: 'eq', label: '等于 (=)' },
            { val: 'neq', label: '不等于 (≠)' },
            { val: 'gt', label: '大于 (>)' },
            { val: 'lt', label: '小于 (<)' },
            { val: 'gte', label: '大于等于 (>=)' },
            { val: 'lte', label: '小于等于 (<=)' },
            { val: 'between', label: '介于' },
            ...commonOps
        ];
        case 'date': return [
            { val: 'eq', label: '等于' },
            { val: 'before', label: '早于' },
            { val: 'after', label: '晚于' },
            { val: 'between', label: '介于' },
            ...commonOps
        ];
        case 'select':
        case 'radio':
            return [
                { val: 'eq', label: '是' },
                { val: 'neq', label: '不是' },
                ...commonOps
            ];
        default: return [
            { val: 'contains', label: '包含' },
            { val: 'notContains', label: '不包含' },
            { val: 'eq', label: '等于' },
            { val: 'neq', label: '不等于' },
            { val: 'startsWith', label: '开头是' },
            { val: 'endsWith', label: '结尾是' },
            { val: 'regex', label: '正则匹配' },
            ...commonOps
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
const evaluateExpression = (expr: string, data: any, returnError = false): any => {
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
            // Date Functions
            const DAYS = (d1, d2) => {
                 if(!d1 || !d2) return 0;
                 const t1 = new Date(d1).getTime();
                 const t2 = new Date(d2).getTime();
                 if(isNaN(t1) || isNaN(t2)) return 0;
                 return Math.ceil((t1 - t2) / (1000 * 60 * 60 * 24));
            };
            const TODAY = () => new Date().toISOString().split('T')[0];
            const NOW = () => {
                const d = new Date();
                return d.toISOString().split('T')[0] + ' ' + d.toTimeString().split(' ')[0].slice(0,5);
            };
            const YEAR = (d) => d ? new Date(d).getFullYear() : new Date().getFullYear();
            const MONTH = (d) => d ? new Date(d).getMonth() + 1 : new Date().getMonth() + 1;
            const DAY = (d) => d ? new Date(d).getDate() : new Date().getDate();
            const WEEKDAY = (d) => d ? new Date(d).getDay() : new Date().getDay();
            const ADDDAYS = (d, days) => {
                const date = new Date(d || new Date());
                date.setDate(date.getDate() + Number(days));
                return date.toISOString().split('T')[0];
            };
            
            // Conditional Functions
            const IF = (c, t, f) => c ? t : f;
            const IFS = (...args) => {
                for(let i = 0; i < args.length - 1; i += 2) {
                    if(args[i]) return args[i + 1];
                }
                return args.length % 2 === 1 ? args[args.length - 1] : null;
            };
            const SWITCH = (val, ...cases) => {
                for(let i = 0; i < cases.length - 1; i += 2) {
                    if(val === cases[i]) return cases[i + 1];
                }
                return cases.length % 2 === 1 ? cases[cases.length - 1] : null;
            };
            
            // String Functions
            const CONCAT = (...args) => args.filter(a => a !== null && a !== undefined).join('');
            const UPPER = (s) => String(s||'').toUpperCase();
            const LOWER = (s) => String(s||'').toLowerCase();
            const TRIM = (s) => String(s||'').trim();
            const LEFT = (s, n) => String(s||'').slice(0, n);
            const RIGHT = (s, n) => String(s||'').slice(-n);
            const MID = (s, start, len) => String(s||'').slice(start, start + len);
            const LEN = (s) => String(s||'').length;
            const REPLACE = (s, old, newStr) => String(s||'').replace(old, newStr);
            const CONTAINS = (s, sub) => String(s||'').includes(sub);
            const STARTSWITH = (s, sub) => String(s||'').startsWith(sub);
            const ENDSWITH = (s, sub) => String(s||'').endsWith(sub);
            
            // Validation Functions
            const ISEMPTY = (v) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
            const ISNUMBER = (v) => !isNaN(Number(v)) && v !== '' && v !== null;
            const ISEMAIL = (v) => /^[\\w-\\.]+@([\\w-]+\\.)+[\\w-]{2,4}$/.test(String(v||''));
            const ISPHONE = (v) => /^[\\d\\-\\+\\s\\(\\)]{7,20}$/.test(String(v||''));
            
            // Math Functions
            const SUM = (...args) => args.flat().reduce((a, b) => Number(a||0) + Number(b||0), 0);
            const AVG = (...args) => {
                const flat = args.flat().filter(v => v !== null && v !== undefined && !isNaN(Number(v)));
                return flat.length ? SUM(...flat) / flat.length : 0;
            };
            const MAX = (...args) => Math.max(...args.flat().filter(v => !isNaN(Number(v))).map(Number));
            const MIN = (...args) => Math.min(...args.flat().filter(v => !isNaN(Number(v))).map(Number));
            const ROUND = (n, d=0) => { const m=Math.pow(10,d); return Math.round(Number(n||0)*m)/m; };
            const FLOOR = (n) => Math.floor(Number(n||0));
            const CEIL = (n) => Math.ceil(Number(n||0));
            const ABS = (n) => Math.abs(Number(n||0));
            const RAND = () => Math.random();
            const RANDBETWEEN = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
            const MOD = (n, d) => Number(n||0) % Number(d||1);
            const POWER = (n, p) => Math.pow(Number(n||0), Number(p||1));
            
            // Mock API Lookup helper
            const MOCK_LOOKUP = (dataset, id, key) => {
                 return { __isApi: true, dataset, id, key };
            };

            return (${processedExpr});
        `;

        // Safe-ish eval
        // eslint-disable-next-line
        return new Function(funcBody)();
    } catch (error: any) {
        if (returnError) {
            return { __error: true, message: error.message || 'Expression error' };
        }
        // console.warn('Logic Error:', error);
        return null;
    }
};

/**
 * Applies all calculations defined in the schema to a data record.
 * Supports multiple passes to resolve dependencies between calculated fields.
 */
const applyRowLogic = (data: any, schema: any[]): any => {
    const newData = { ...data };
    let hasChanges = true;
    let iterations = 0;
    const maxIterations = 3; // Usually 1-2 is enough for most dependencies

    while (hasChanges && iterations < maxIterations) {
        hasChanges = false;
        iterations++;
        schema.forEach(field => {
            // 1. Calculation Logic
            if (field.logic?.calculation) {
                const result = evaluateExpression(field.logic.calculation, newData);
                if (result !== null && result !== undefined && !result.__isApi) {
                    const currentVal = newData[field.id];
                    const valChanged =
                        (typeof result === 'number' && Number(currentVal) !== result) ||
                        (typeof result !== 'number' && String(currentVal) !== String(result));

                    if (valChanged) {
                        newData[field.id] = result;
                        hasChanges = true;
                    }
                }
            }

            // 2. Options Logic - Cascading Reset
            // If the field has an optionsRule, and the options change such that the current value is no longer valid, we clear it.
            if (field.logic?.optionsRule) {
                const rawOptions = evaluateExpression(field.logic.optionsRule, newData);
                const currentOptions = Array.isArray(rawOptions) ? rawOptions.map(String) : [];
                const currentVal = newData[field.id];

                if (currentVal && currentVal !== '' && !currentOptions.includes(String(currentVal))) {
                    newData[field.id] = ''; // Clear value because it's no longer a valid option
                    hasChanges = true;
                }
            }
        });
    }
    return newData;
};

// Validate expression syntax without side effects
const validateExpression = (expr: string, schema: any[]): { valid: boolean; error?: string } => {
    if (!expr || !expr.trim()) return { valid: true };

    // Check for valid field references
    const fieldRefs = expr.match(/\{(\w+)\}/g) || [];
    const schemaIds = schema.map(f => f.id);

    for (const ref of fieldRefs) {
        const fieldId = ref.slice(1, -1);
        if (!schemaIds.includes(fieldId)) {
            return { valid: false, error: `Field "{${fieldId}}" does not exist` };
        }
    }

    // Test expression with mock data
    const mockData: any = {};
    schema.forEach(f => { mockData[f.id] = f.type === 'number' ? 0 : ''; });

    const result = evaluateExpression(expr, mockData, true);
    if (result && result.__error) {
        return { valid: false, error: result.message };
    }

    return { valid: true };
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

                                        {/* New: Disabled Rule & Default Value */}
                                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Disabled Rule</label>
                                                <input
                                                    value={field.logic?.disabledRule || ''}
                                                    onChange={(e) => onUpdate(field.id, 'logic', { ...field.logic, disabledRule: e.target.value })}
                                                    className="w-full text-xs font-mono px-2 py-1.5 bg-white border border-slate-200 rounded focus:border-indigo-500 outline-none"
                                                    placeholder="{status} == 'locked'"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Default Value Rule</label>
                                                <input
                                                    value={field.logic?.defaultValueRule || ''}
                                                    onChange={(e) => onUpdate(field.id, 'logic', { ...field.logic, defaultValueRule: e.target.value })}
                                                    className="w-full text-xs font-mono px-2 py-1.5 bg-white border border-slate-200 rounded focus:border-indigo-500 outline-none"
                                                    placeholder="TODAY() or 100"
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
const FormPreview = ({ schema, data, setData, errors, setErrors, onSubmit, onCancel, formName }: any) => {

    // --- Logic Engine Execution (Debounced to avoid input interference) ---
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            const newData = { ...data };
            let hasChanges = false;

            schema.forEach((field: any) => {
                // 1. Calculation (Sync) - Only for fields with calculations, skip user-editable fields
                if (field.logic?.calculation) {
                    const result = evaluateExpression(field.logic.calculation, data);
                    if (result !== null && result !== undefined && !result.__isApi) {
                        // Use loose comparison for numbers to avoid "10" !== 10 issues
                        if (Number(result) !== Number(data[field.id]) || (isNaN(Number(result)) && String(result) !== String(data[field.id]))) {
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
        }, 100); // 100ms debounce

        return () => clearTimeout(timeoutId);
    }, [data, schema]); // Dependency on data triggers recalculation loop. React batches updates, but care needed.

    // --- Initialize Default Values ---
    useEffect(() => {
        const newData = { ...data };
        let hasChanges = false;

        schema.forEach((field: any) => {
            // Static default value
            if (field.defaultValue !== undefined && (data[field.id] === undefined || data[field.id] === '')) {
                newData[field.id] = field.defaultValue;
                hasChanges = true;
            }

            // Dynamic default value rule
            if (field.logic?.defaultValueRule && (data[field.id] === undefined || data[field.id] === '')) {
                const result = evaluateExpression(field.logic.defaultValueRule, data);
                if (result !== null && result !== undefined) {
                    newData[field.id] = result;
                    hasChanges = true;
                }
            }
        });

        if (hasChanges) {
            setData(newData);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [schema]); // Only run on schema change, not data change

    const getVisibility = (field: any) => {
        if (!field.logic?.visibility) return true;
        const result = evaluateExpression(field.logic.visibility, data);
        return result === true;
    };

    const getReadOnly = (field: any) => {
        if (!field.logic?.readOnly) return false;
        return evaluateExpression(field.logic.readOnly, data) === true;
    };

    const getDisabled = (field: any) => {
        if (!field.logic?.disabledRule) return false;
        return evaluateExpression(field.logic.disabledRule, data) === true;
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
        const rawUpdatedData = { ...data, [id]: value };

        // Pass through central logic engine to handle cascading updates (like City clearing when Region changes)
        const updatedData = applyRowLogic(rawUpdatedData, schema);

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

        // 3. Dynamic Required Check (Simulated for feedback)
        const isReq = field.logic?.requiredRule ? (evaluateExpression(field.logic.requiredRule, updatedData) === true) : field.required;
        if (isReq && !value) {
            newErrors[id] = 'This field is required';
        } else if (newErrors[id] === 'This field is required') {
            delete newErrors[id];
        }

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
                    {formName || 'Preview Mode'}
                </h2>
                <p className="text-slate-400 text-sm mt-1">{formName ? '' : 'This is how your users will see the form.'}</p>
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

                    // Logic: ReadOnly, Required & Disabled
                    const isReadOnly = getReadOnly(field);
                    const isRequired = getRequired(field);
                    const isDisabled = getDisabled(field);
                    const commonInputClasses = `w-full border rounded-xl px-4 py-3 text-sm outline-none transition-all ${isError ? 'border-red-300 bg-red-50 focus:border-red-500' : (isReadOnly || isDisabled) ? 'bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200' : 'border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'}`;

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
                                    disabled={isReadOnly || isDisabled}
                                    onChange={(e) => handleChange(field.id, e.target.value)}
                                />
                            )}

                            {field.type === 'switch' && (
                                <label className={`flex items-center gap-3 cursor-pointer w-fit ${(isReadOnly || isDisabled) ? 'opacity-50 pointer-events-none' : ''}`}>
                                    <div className={`w-11 h-6 rounded-full transition-colors relative ${data[field.id] ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                                        <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full shadow-sm transition-transform ${data[field.id] ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                    </div>
                                    <span className="text-sm font-medium text-slate-700">{data[field.id] ? 'On' : 'Off'}</span>
                                    <input type="checkbox" className="hidden" checked={!!data[field.id]} onChange={(e) => handleChange(field.id, e.target.checked)} disabled={isReadOnly || isDisabled} />
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
                                        formName={activeDemo.title}
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
                                                <td className="px-4 py-3 font-mono font-bold text-emerald-600">SUM(...args)</td>
                                                <td className="px-4 py-3 text-gray-600">Sum of all values</td>
                                                <td className="px-4 py-3 font-mono text-xs text-gray-400">{`SUM({a}, {b}, {c})`}</td>
                                            </tr>
                                            <tr className="bg-white">
                                                <td className="px-4 py-3 font-mono font-bold text-emerald-600">AVG(...args)</td>
                                                <td className="px-4 py-3 text-gray-600">Average of all values</td>
                                                <td className="px-4 py-3 font-mono text-xs text-gray-400">{`AVG({score1}, {score2}, {score3})`}</td>
                                            </tr>
                                            <tr className="bg-white">
                                                <td className="px-4 py-3 font-mono font-bold text-emerald-600">TODAY()</td>
                                                <td className="px-4 py-3 text-gray-600">Returns current date (YYYY-MM-DD)</td>
                                                <td className="px-4 py-3 font-mono text-xs text-gray-400">{`TODAY()`}</td>
                                            </tr>
                                            <tr className="bg-white">
                                                <td className="px-4 py-3 font-mono font-bold text-emerald-600">NOW()</td>
                                                <td className="px-4 py-3 text-gray-600">Returns current date and time</td>
                                                <td className="px-4 py-3 font-mono text-xs text-gray-400">{`NOW()`}</td>
                                            </tr>
                                            <tr className="bg-white">
                                                <td className="px-4 py-3 font-mono font-bold text-indigo-600">YEAR / MONTH / DAY(d)</td>
                                                <td className="px-4 py-3 text-gray-600">Extracts part from date</td>
                                                <td className="px-4 py-3 font-mono text-xs text-gray-400">{`YEAR({start_date})`}</td>
                                            </tr>
                                            <tr className="bg-white">
                                                <td className="px-4 py-3 font-mono font-bold text-emerald-600">ADDDAYS(date, n)</td>
                                                <td className="px-4 py-3 text-gray-600">Adds n days to date</td>
                                                <td className="px-4 py-3 font-mono text-xs text-gray-400">{`ADDDAYS(TODAY(), 7)`}</td>
                                            </tr>
                                            <tr className="bg-white">
                                                <td className="px-4 py-3 font-mono font-bold text-emerald-600">IFS(cond1, val1, ...)</td>
                                                <td className="px-4 py-3 text-gray-600">Multiple conditions check</td>
                                                <td className="px-4 py-3 font-mono text-xs text-gray-400">{`IFS({x}>90,'A', {x}>60,'B', 'C')`}</td>
                                            </tr>
                                            <tr className="bg-white">
                                                <td className="px-4 py-3 font-mono font-bold text-emerald-600">SWITCH(val, case1, result1, ...)</td>
                                                <td className="px-4 py-3 text-gray-600">Switch case matching</td>
                                                <td className="px-4 py-3 font-mono text-xs text-gray-400">{`SWITCH({status},'A','Active','Inactive')`}</td>
                                            </tr>
                                            <tr className="bg-white">
                                                <td className="px-4 py-3 font-mono font-bold text-indigo-600">RAND() / RANDBETWEEN(min, max)</td>
                                                <td className="px-4 py-3 text-gray-600">Random number</td>
                                                <td className="px-4 py-3 font-mono text-xs text-gray-400">{`RANDBETWEEN(1, 100)`}</td>
                                            </tr>
                                            <tr className="bg-white">
                                                <td className="px-4 py-3 font-mono font-bold text-emerald-600">CONTAINS / STARTSWITH / ENDSWITH</td>
                                                <td className="px-4 py-3 text-gray-600">String contains/starts/ends with</td>
                                                <td className="px-4 py-3 font-mono text-xs text-gray-400">{`CONTAINS({email}, '@gmail')`}</td>
                                            </tr>
                                            <tr className="bg-white">
                                                <td className="px-4 py-3 font-mono font-bold text-emerald-600">ISEMAIL / ISPHONE / ISNUMBER</td>
                                                <td className="px-4 py-3 text-gray-600">Validation helpers</td>
                                                <td className="px-4 py-3 font-mono text-xs text-gray-400">{`ISEMAIL({email})`}</td>
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

// --- Unified Rule Builder Component ---
const UnifiedRuleBuilder: React.FC<{
    schema: any[];
    records: any[];
    onAdd: (rule: any) => void;
    onUpdate?: (rule: any) => void;
    editingRule?: any;
    onSaveAsPreset: (name: string, rule: any) => void;
    onEnableRowPicker?: (callback: (id: string) => void) => void;
    activeRuleType?: 'logic' | 'mapping';
    onRuleTypeChange?: (type: 'logic' | 'mapping') => void;
}> = ({ schema, records, onAdd, onUpdate, editingRule, onSaveAsPreset, onEnableRowPicker, activeRuleType: controlledActiveRuleType, onRuleTypeChange }) => {
    const [internalActiveRuleType, setInternalActiveRuleType] = useState<'logic' | 'mapping'>('mapping');
    const activeRuleType = controlledActiveRuleType !== undefined ? controlledActiveRuleType : internalActiveRuleType;

    const setActiveRuleType = (type: 'logic' | 'mapping') => {
        setInternalActiveRuleType(type);
        if (onRuleTypeChange) onRuleTypeChange(type);
    };

    // Logic Rule State
    const [conditions, setConditions] = useState<{ fieldId: string, operator: string, value: string }[]>([]);
    const [logicMode, setLogicMode] = useState<'AND' | 'OR'>('AND');
    const [targetField, setTargetField] = useState('');
    const [targetValue, setTargetValue] = useState('');

    // Mapping Rule State
    const [mSourceField, setMSourceField] = useState('');
    const [mSourceRowId, setMSourceRowId] = useState(''); // New: Specify a row ID
    const [mTargetField, setMTargetField] = useState('');
    const [mMappings, setMMappings] = useState<{ sourceValue: string, targetValue: string }[]>([]);
    // NEW: Multiple cascade groups support (each group can have its own sourceRowId)
    const [mCascadeGroups, setMCascadeGroups] = useState<{ sourceField: string, targetField: string, sourceRowId?: string, mappings: { sourceValue: string, targetValue: string }[] }[]>([]);
    const [mSyncMode, setMSyncMode] = useState(true); // true = 同步模式, false = 独立模式
    const [ruleDescription, setRuleDescription] = useState('');
    const [ruleTitle, setRuleTitle] = useState('');



    useEffect(() => {
        if (editingRule) {
            setActiveRuleType(editingRule.ruleType);
            if (editingRule.ruleType === 'logic') {
                setConditions(editingRule.conditions || []);
                setLogicMode(editingRule.logic || 'AND');
                setTargetField(editingRule.targetField || '');
                setTargetValue(editingRule.expression || '');
                setRuleTitle(editingRule.title || '');
                setRuleDescription(editingRule.description || '');
            } else {
                setMCascadeGroups(editingRule.cascadeGroups || []);
                setMSyncMode(editingRule.syncMode !== false);
                setRuleTitle(editingRule.title || '');
                setRuleDescription(editingRule.description || '');
            }
        }
    }, [editingRule]);

    const getRecordLabel = (r: any) => {
        // Try to find a human-readable name, otherwise use ID
        const candidate = r.name || r.title || r.label || r.product_name;
        if (candidate) return candidate;
        const stringVals = Object.values(r).filter(v => typeof v === 'string' && v.length < 30);
        return stringVals[0] || r._id;
    }

    // Filter valid fields
    const selectableFields = schema.filter(f =>
        !['divider', 'spacer', 'notice'].includes(f.type)
    );

    const handleAddCondition = () => {
        setConditions([...conditions, { fieldId: '', operator: 'eq', value: '' }]);
    };

    const handleRemoveCondition = (idx: number) => {
        setConditions(conditions.filter((_, i) => i !== idx));
    };

    const handleUpdateCondition = (idx: number, updates: any) => {
        setConditions(conditions.map((c, i) => i === idx ? { ...c, ...updates } : c));
    };

    const handleAddMappingRow = () => {
        setMMappings([...mMappings, { sourceValue: '', targetValue: '' }]);
    };

    const handleRemoveMappingRow = (idx: number) => {
        setMMappings(mMappings.filter((_, i) => i !== idx));
    };

    const handleUpdateMappingRow = (idx: number, updates: any) => {
        setMMappings(mMappings.map((m, i) => i === idx ? { ...m, ...updates } : m));
    };

    // NEW: Cascade Groups Handlers
    const handleAddCascadeGroup = () => {
        // In sync mode, copy source field, target field, and source values from the first group
        if (mSyncMode && mCascadeGroups.length > 0) {
            const firstGroup = mCascadeGroups[0];
            const copiedMappings = firstGroup.mappings.map(m => ({ sourceValue: m.sourceValue, targetValue: '' }));
            setMCascadeGroups([...mCascadeGroups, {
                sourceField: firstGroup.sourceField,
                targetField: firstGroup.targetField,
                sourceRowId: '',
                mappings: copiedMappings.length > 0 ? copiedMappings : []
            }]);
        } else {
            setMCascadeGroups([...mCascadeGroups, { sourceField: '', targetField: '', sourceRowId: '', mappings: [] }]);
        }
    };

    const handleRemoveCascadeGroup = (groupIdx: number) => {
        setMCascadeGroups(mCascadeGroups.filter((_, i) => i !== groupIdx));
    };

    const handleUpdateCascadeGroup = (groupIdx: number, updates: Partial<{ sourceField: string, targetField: string, sourceRowId: string }>) => {
        // In sync mode, sync sourceField and targetField across all groups
        if (mSyncMode && (updates.sourceField !== undefined || updates.targetField !== undefined)) {
            setMCascadeGroups(mCascadeGroups.map((g, i) => {
                const syncedUpdates: any = {};
                if (updates.sourceField !== undefined) syncedUpdates.sourceField = updates.sourceField;
                if (updates.targetField !== undefined) syncedUpdates.targetField = updates.targetField;
                // Only apply sourceRowId to the specific group
                if (i === groupIdx && updates.sourceRowId !== undefined) syncedUpdates.sourceRowId = updates.sourceRowId;
                return { ...g, ...syncedUpdates };
            }));
        } else {
            setMCascadeGroups(mCascadeGroups.map((g, i) => i === groupIdx ? { ...g, ...updates } : g));
        }
    };

    const handleAddCascadeMapping = (groupIdx: number) => {
        // In sync mode, add mapping row to ALL groups
        if (mSyncMode) {
            setMCascadeGroups(mCascadeGroups.map(g => ({
                ...g,
                mappings: [...g.mappings, { sourceValue: '', targetValue: '' }]
            })));
        } else {
            setMCascadeGroups(mCascadeGroups.map((g, i) =>
                i === groupIdx ? { ...g, mappings: [...g.mappings, { sourceValue: '', targetValue: '' }] } : g
            ));
        }
    };

    const handleRemoveCascadeMapping = (groupIdx: number, mappingIdx: number) => {
        // In sync mode, remove mapping row from ALL groups at the same index
        if (mSyncMode) {
            setMCascadeGroups(mCascadeGroups.map(g => ({
                ...g,
                mappings: g.mappings.filter((_, mi) => mi !== mappingIdx)
            })));
        } else {
            setMCascadeGroups(mCascadeGroups.map((g, i) =>
                i === groupIdx ? { ...g, mappings: g.mappings.filter((_, mi) => mi !== mappingIdx) } : g
            ));
        }
    };

    const handleUpdateCascadeMapping = (groupIdx: number, mappingIdx: number, updates: Partial<{ sourceValue: string, targetValue: string }>) => {
        // In sync mode, if sourceValue changes, sync across all groups at the same mapping index
        if (mSyncMode && updates.sourceValue !== undefined) {
            setMCascadeGroups(mCascadeGroups.map((g, gi) => ({
                ...g,
                mappings: g.mappings.map((m, mi) =>
                    mi === mappingIdx ? { ...m, sourceValue: updates.sourceValue! } : m
                )
            })));
        } else {
            setMCascadeGroups(mCascadeGroups.map((g, i) =>
                i === groupIdx ? { ...g, mappings: g.mappings.map((m, mi) => mi === mappingIdx ? { ...m, ...updates } : m) } : g
            ));
        }
    };

    const handleAddRule = () => {
        const ruleData = activeRuleType === 'logic'
            ? {
                id: `rule_${Date.now()}`,
                ruleType: 'logic',
                logic: logicMode,
                conditions,
                targetField,
                expression: targetValue,
                description: ruleDescription,
                title: ruleTitle
            }
            : {
                id: `rule_${Date.now()}`,
                ruleType: 'mapping',
                // Use first cascade group's fields as main reference
                sourceField: mCascadeGroups[0]?.sourceField || '',
                targetField: mCascadeGroups[0]?.targetField || '',
                // Include all cascade groups
                cascadeGroups: mCascadeGroups,
                syncMode: mSyncMode,
                description: ruleDescription,
                title: ruleTitle
            };

        if (editingRule && onUpdate) {
            onUpdate({ ...ruleData, id: editingRule.id });
        } else {
            onAdd(ruleData);
        }
        if (activeRuleType === 'logic') {
            setConditions([]);
            setTargetField('');
            setTargetValue('');
        } else {
            setMSourceField('');
            setMSourceRowId('');
            setMTargetField('');
            setMMappings([]);
            setMCascadeGroups([]);
            setMSyncMode(true);
        }
        setRuleDescription('');
        setRuleTitle('');
    };


    const isLogicValid = conditions.length > 0 && conditions.every(c => c.fieldId && c.operator) && targetField;
    // Only cascade groups validation (legacy mapping removed)
    const isMappingValid = mCascadeGroups.length > 0 && mCascadeGroups.every(g =>
        g.sourceField && g.targetField && g.mappings.length > 0 && g.mappings.every(m => m.sourceValue)
    );

    return (
        <div className="space-y-4">
            {/* Rule Type Tabs */}
            <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                <button
                    onClick={() => setActiveRuleType('mapping')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 text-[10px] font-bold rounded-lg transition-all ${activeRuleType === 'mapping' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <ArrowRight size={14} />
                    <span>级联映射 (Mapping)</span>
                </button>
                <button
                    onClick={() => setActiveRuleType('logic')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 text-[10px] font-bold rounded-lg transition-all ${activeRuleType === 'logic' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <Layers size={14} />
                    <span>逻辑规则 (Logic)</span>
                </button>
            </div>

            {activeRuleType === 'logic' ? (
                <div className="animate-in fade-in slide-in-from-top-2">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                逻辑条件组 (Conditions Group)
                            </span>
                            <div className="flex items-center gap-1 bg-white rounded border border-slate-200 px-1 py-0.5 shadow-sm">
                                <Database size={10} className="text-slate-400" />
                                <select
                                    value={mSourceRowId}
                                    onChange={(e) => setMSourceRowId(e.target.value)}
                                    className="text-[10px] font-bold text-slate-600 outline-none bg-transparent border-none p-0 w-[80px] cursor-pointer"
                                >
                                    <option value="">当前行 (Current)</option>
                                    {(records || []).slice(0, 10).map((r: any, i: number) => (
                                        <option key={r._id} value={r._id}>Row #{i + 1}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-1 bg-slate-100 p-0.5 rounded-md">
                            <button
                                onClick={() => setLogicMode('AND')}
                                className={`px-2 py-0.5 text-[9px] font-bold rounded ${logicMode === 'AND' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >AND</button>
                            <button
                                onClick={() => setLogicMode('OR')}
                                className={`px-2 py-0.5 text-[9px] font-bold rounded ${logicMode === 'OR' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >OR</button>
                        </div>
                    </div>

                    <div className="space-y-2 mb-4">
                        {conditions.map((cond, idx) => (
                            <div key={idx} className="flex gap-1.5 items-center p-1.5 bg-slate-50/50 rounded-xl border border-slate-100/50 group/row transition-all duration-300">
                                <select
                                    value={cond.fieldId}
                                    onChange={(e) => handleUpdateCondition(idx, { fieldId: e.target.value })}
                                    className="flex-[1.5] min-w-0 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                                >
                                    <option value="">字段...</option>
                                    {selectableFields.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                                </select>
                                <select
                                    value={cond.operator}
                                    onChange={(e) => handleUpdateCondition(idx, { operator: e.target.value })}
                                    className="flex-[0.8] min-w-0 bg-white border border-slate-200 rounded-lg px-1.5 py-1.5 text-[10px] outline-none focus:ring-2 focus:ring-indigo-500/20"
                                >
                                    {getOperatorsForType(selectableFields.find(f => f.id === cond.fieldId)?.type || 'text').map(op => (
                                        <option key={op.val} value={op.val}>{op.label}</option>
                                    ))}
                                </select>
                                <input
                                    value={cond.value}
                                    onChange={(e) => handleUpdateCondition(idx, { value: e.target.value })}
                                    placeholder="值..."
                                    className="flex-[1] min-w-0 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] font-medium outline-none focus:ring-2 focus:ring-indigo-500/20"
                                />
                                <button
                                    onClick={() => handleRemoveCondition(idx)}
                                    className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                >
                                    <Trash2 size={13} />
                                </button>
                            </div>
                        ))}
                        <button
                            onClick={handleAddCondition}
                            className="w-full py-2 border-2 border-dashed border-slate-100 rounded-lg text-[10px] font-bold text-slate-400 hover:border-indigo-100 hover:text-indigo-400 transition-all flex items-center justify-center gap-2"
                        >
                            <Plus size={12} />
                            添加条件 (Add Condition)
                        </button>
                    </div>

                    <div className="space-y-3 p-3 bg-indigo-50/30 rounded-xl border border-indigo-100/50">
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">目标字段 (Target Field)</label>
                            <select
                                value={targetField}
                                onChange={(e) => setTargetField(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-xs outline-none focus:ring-1 focus:ring-indigo-300 font-extrabold"
                            >
                                <option value="">选择生效目标...</option>
                                {selectableFields.map(f => (
                                    <option key={f.id} value={f.id}>{f.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">设定值 (Value / Expr)</label>
                            <input
                                value={targetValue}
                                onChange={(e) => setTargetValue(e.target.value)}
                                placeholder="例如: VIP, 100, {f1} * 2"
                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all"
                            />
                        </div>
                    </div>
                </div>
            ) : (
                <div className="animate-in fade-in slide-in-from-bottom-2">
                    <div className="space-y-4">
                        {/* Multiple Cascade Groups Section - Now the main UI */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest flex items-center gap-1.5">
                                    <Layers size={12} /> 多级联映射 (Multi-Cascade)
                                </span>
                                <button
                                    onClick={() => setMSyncMode(!mSyncMode)}
                                    className={`px-2 py-1 rounded-md text-[9px] font-bold transition-all flex items-center gap-1 ${mSyncMode
                                        ? 'bg-green-100 text-green-700 border border-green-200'
                                        : 'bg-slate-100 text-slate-500 border border-slate-200'
                                        }`}
                                    title={mSyncMode ? '同步模式: 所有组共享相同的选项值' : '独立模式: 每组的选项值独立设置'}
                                >
                                    {mSyncMode ? '🔗 同步模式' : '🔓 独立模式'}
                                </button>
                            </div>

                            {mSyncMode && mCascadeGroups.length > 0 && (
                                <div className="text-[9px] text-green-600 bg-green-50 px-2 py-1.5 rounded-md border border-green-100">
                                    💡 同步模式已启用: 修改任意组的"选项值"将自动同步到其他对应行
                                </div>
                            )}

                            <div className="space-y-3">
                                {mCascadeGroups.map((group, gIdx) => (
                                    <div key={gIdx} className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm relative group/cascade hover:border-indigo-300 hover:shadow-md transition-all">
                                        {/* Header Row: Title & Row Picker (Left), Delete (Right) */}
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <span className="text-[10px] font-black text-slate-500 uppercase">级联组 #{gIdx + 1}</span>

                                                {/* Compact Row Picker */}
                                                <div className="flex items-center gap-1 bg-slate-50 rounded-lg border border-slate-200 p-0.5 hover:border-indigo-200 transition-colors">
                                                    <select
                                                        value={group.sourceRowId || ''}
                                                        onChange={(e) => handleUpdateCascadeGroup(gIdx, { sourceRowId: e.target.value })}
                                                        className={`bg-transparent text-[9px] font-bold outline-none border-none py-0.5 px-1 max-w-[100px] truncate ${group.sourceRowId ? 'text-amber-600' : 'text-slate-400'}`}
                                                    >
                                                        <option value="">(当前行)</option>
                                                        {records.map(r => (
                                                            <option key={r._id} value={String(r._id)}>📍 {getRecordLabel(r)}</option>
                                                        ))}
                                                    </select>
                                                    {onEnableRowPicker && (
                                                        <button
                                                            onClick={() => onEnableRowPicker((id) => handleUpdateCascadeGroup(gIdx, { sourceRowId: id }))}
                                                            className="text-slate-400 hover:text-amber-500 hover:bg-white rounded p-0.5 transition-all"
                                                            title="Pick from Preview"
                                                        >
                                                            <MousePointerClick size={10} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => handleRemoveCascadeGroup(gIdx)}
                                                className="text-slate-300 hover:text-red-500 p-1 opacity-0 group-hover/cascade:opacity-100 transition-opacity"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>

                                        {/* Columns Grid Layout */}
                                        <div className="grid grid-cols-[1fr,16px,1fr,16px] gap-x-2 gap-y-1.5 items-center">

                                            {/* Column Headers / Selectors */}
                                            <div className="col-span-1">
                                                <select
                                                    value={group.sourceField}
                                                    onChange={(e) => handleUpdateCascadeGroup(gIdx, { sourceField: e.target.value })}
                                                    className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] font-bold text-slate-600 outline-none focus:border-indigo-400 focus:bg-white transition-all"
                                                >
                                                    <option value="">监听字段 (Source)...</option>
                                                    {selectableFields.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                                                </select>
                                            </div>
                                            <div className="col-span-1 flex justify-center">
                                                <ArrowRight size={10} className="text-slate-300" />
                                            </div>
                                            <div className="col-span-1">
                                                <select
                                                    value={group.targetField}
                                                    onChange={(e) => handleUpdateCascadeGroup(gIdx, { targetField: e.target.value })}
                                                    className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] font-bold text-slate-600 outline-none focus:border-indigo-400 focus:bg-white transition-all"
                                                >
                                                    <option value="">目标字段 (Target)...</option>
                                                    {selectableFields.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                                                </select>
                                            </div>
                                            <div className="col-span-1"></div>

                                            {/* Mapping Rows */}
                                            {group.mappings.map((m, mIdx) => (
                                                <React.Fragment key={mIdx}>
                                                    <div className="col-span-1">
                                                        <input
                                                            value={m.sourceValue}
                                                            onChange={(e) => handleUpdateCascadeMapping(gIdx, mIdx, { sourceValue: e.target.value })}
                                                            placeholder="当值为..."
                                                            className={`w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all ${mSyncMode ? 'focus:border-green-400 focus:ring-green-50' : ''}`}
                                                        />
                                                    </div>
                                                    <div className="col-span-1 flex justify-center text-slate-300">
                                                        <ArrowRight size={10} />
                                                    </div>
                                                    <div className="col-span-1">
                                                        <input
                                                            value={m.targetValue}
                                                            onChange={(e) => handleUpdateCascadeMapping(gIdx, mIdx, { targetValue: e.target.value })}
                                                            placeholder="设为..."
                                                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all"
                                                        />
                                                    </div>
                                                    <div className="col-span-1 flex justify-center">
                                                        <button
                                                            onClick={() => handleRemoveCascadeMapping(gIdx, mIdx)}
                                                            className="text-slate-300 hover:text-red-500 transition-colors"
                                                            tabIndex={-1}
                                                        >
                                                            <X size={10} />
                                                        </button>
                                                    </div>
                                                </React.Fragment>
                                            ))}
                                        </div>

                                        {/* Footer Add Button */}
                                        <button
                                            onClick={() => handleAddCascadeMapping(gIdx)}
                                            className="mt-2 w-full py-1 text-[9px] font-bold text-indigo-400 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-all flex items-center justify-center gap-1 opacity-60 hover:opacity-100"
                                        >
                                            <Plus size={10} /> 添加映射值
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={handleAddCascadeGroup}
                                className="w-full py-2.5 border-2 border-dashed border-indigo-200 rounded-xl text-[10px] font-bold text-indigo-400 hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50/50 transition-all flex items-center justify-center gap-2"
                            >
                                <Plus size={14} /> 添加级联组 (Add Cascade Group)
                            </button>
                        </div>
                    </div>



                    <div className="mt-2 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                        <label className="text-[10px] font-bold text-indigo-400 uppercase block mb-1.5 flex items-center gap-1">
                            <Tag size={12} /> 标签标题 (Tab Title - Optional)
                        </label>
                        <input
                            value={ruleTitle}
                            onChange={(e) => setRuleTitle(e.target.value)}
                            placeholder="默认使用说明文字..."
                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none focus:ring-1 focus:ring-indigo-300"
                        />
                    </div>
                </div>
            )}

            <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                    <button
                        onClick={handleAddRule}
                        disabled={activeRuleType === 'logic' ? !isLogicValid : !isMappingValid}
                        className="flex-1 py-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-30"
                    >
                        <Plus size={14} className="text-slate-400" />
                        <span>{editingRule ? '保存规则修改' : '应用到当前规则栈'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
// --- Main App Component ---
// --- Main App Component ---
interface SuperTableProps {
    activeProjects?: { id: string, info: { name: string } }[];
    activeTeamMembers?: { id: string, name: string }[];
    onAddProject?: (name: string) => void;
    onAddTeamMember?: (name: string) => void;
}

export const SuperTable: React.FC<SuperTableProps> = ({ activeProjects = [], activeTeamMembers = [], onAddProject, onAddTeamMember }) => {
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
    const [sidebarWidth, setSidebarWidth] = useState(() => loadFromStorage('erp_sidebar_width', 400));
    const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
    const [builderActiveRuleType, setBuilderActiveRuleType] = useState<'logic' | 'mapping'>('mapping');
    const [expandedRules, setExpandedRules] = useState<Record<string, boolean>>({});
    const toggleRuleExpanded = (id: string) => {
        setExpandedRules(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };
    const isResizingSidebarRef = useRef(false);

    const handleSidebarResizeStart = useCallback((e: React.MouseEvent) => {
        isResizingSidebarRef.current = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }, []);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizingSidebarRef.current) return;
            const newWidth = Math.max(300, Math.min(800, e.clientX));
            setSidebarWidth(newWidth);
        };

        const handleMouseUp = () => {
            if (isResizingSidebarRef.current) {
                isResizingSidebarRef.current = false;
                document.body.style.cursor = 'default';
                document.body.style.userSelect = 'auto';
                window.localStorage.setItem('erp_sidebar_width', JSON.stringify(sidebarWidth));
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [sidebarWidth]);

    const [activeTab, setActiveTab] = useState<'builder' | 'data' | 'library' | 'guide' | 'product_center'>(() => loadFromStorage('erp_active_tab', 'data'));
    const [productSubTab, setProductSubTab] = useState<'config' | 'library' | 'settings'>(() => loadFromStorage('erp_product_sub_tab', 'config'));
    const [subView, setSubView] = useState<'table' | 'preview' | 'batch'>(() => loadFromStorage('erp_sub_view', 'table')); // Data sub-views

    // Schema State
    const [schema, setSchema] = useState<any[]>(() => loadFromStorage('erp_schema', InitialSchema));
    const [activeFieldId, setActiveFieldId] = useState<string | null>(null);

    // Data State
    const [records, setRecords] = useState<any[]>(() => loadFromStorage('erp_records', []));
    const [previewData, setPreviewData] = useState<any>({});
    const [batchRows, setBatchRows] = useState<any[]>([]);
    const [editingCell, setEditingCell] = useState<{ rowId: any; fieldId: string } | null>(null);
    const [selectedCell, setSelectedCell] = useState<{ rowId: any; fieldId: string } | null>(null);
    const [selectedCells, setSelectedCells] = useState<{ rowId: any; fieldId: string }[]>([]);
    const [selectionAnchor, setSelectionAnchor] = useState<{ rowId: any; fieldId: string } | null>(null);
    const [hiddenColumnIds, setHiddenColumnIds] = useState<string[]>(() => loadFromStorage('erp_hidden_columns', []));
    const [columnsMenuOpen, setColumnsMenuOpen] = useState(false);
    const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => loadFromStorage('erp_column_widths', {}));
    const resizingColumnRef = useRef<{ id: string, startX: number, startWidth: number } | null>(null);

    // Sorting State
    const [sortConfig, setSortConfig] = useState<{ fieldId: string; direction: 'asc' | 'desc' }[]>([]);

    // Auto-fill State
    const [isDraggingFill, setIsDraggingFill] = useState(false);
    const [isDraggingSelection, setIsDraggingSelection] = useState(false);
    const [isDraggingRowSelection, setIsDraggingRowSelection] = useState(false);
    const [isDraggingColumnSelection, setIsDraggingColumnSelection] = useState(false);
    const [fillRange, setFillRange] = useState<{ startRowIndex: number; endRowIndex: number; minColIndex: number; maxColIndex: number } | null>(null);
    const [fillConfirmMenu, setFillConfirmMenu] = useState<{ x: number, y: number, recordsToUpdate: any[] } | null>(null);
    const [activeRowPicker, setActiveRowPicker] = useState<((id: string) => void) | null>(null);
    const [savingRuleId, setSavingRuleId] = useState<string | null>(null);
    const [newPresetName, setNewPresetName] = useState('');
    const lastLogicRef = useRef('');

    // --- Real-time Logic Update ---
    useEffect(() => {
        // Only trigger if the logic part of the schema changed (to avoid loops and unnecessary work)
        const currentLogicStr = JSON.stringify(schema.map(f => ({ id: f.id, logic: f.logic })));
        if (currentLogicStr === lastLogicRef.current) return;
        lastLogicRef.current = currentLogicStr;

        if (records.length === 0) return;

        setRecords(prev => {
            const updated = prev.map(r => applyRowLogic(r, schema));
            // Only update if something actually changed to avoid render cycles
            const isChanged = JSON.stringify(updated) !== JSON.stringify(prev);
            return isChanged ? updated : prev;
        });
    }, [schema]);

    // Advanced Filter State
    const [filterGroups, setFilterGroups] = useState<{ id: string, logic: 'AND' | 'OR', conditions: { id: string, fieldId: string, operator: string, value: string, value2?: string }[], fromPreset?: string }[]>(() =>
        loadFromStorage('erp_filter_groups', [{ id: 'g1', logic: 'AND', conditions: [] }])
    );
    const [rootFilterMode, setRootFilterMode] = useState<'AND' | 'OR'>(() => loadFromStorage('erp_root_filter_mode', 'AND'));
    const [activeGroupId, setActiveGroupId] = useState<string>('g1');

    const [pendingFilter, setPendingFilter] = useState({ fieldId: '', operator: '', value: '', value2: '' });

    const [savedViews, setSavedViews] = useState<{ name: string, filterGroups: any[], rootFilterMode: 'AND' | 'OR', datasetId?: string | null, configRules?: any[] }[]>(() => loadFromStorage('erp_saved_views_v2', [
        {
            name: '示例视图 (Example)',
            filterGroups: [{ id: 'g1', logic: 'AND', conditions: [{ id: 'demo_1', fieldId: 'f3', operator: 'lt', value: '10' }] }],
            rootFilterMode: 'AND',
            configRules: []
        }
    ]));

    // Dataset Library State
    const [savedDatasets, setSavedDatasets] = useState<{ id: string, name: string, groupId?: string, timestamp: number, schema: any[], records: any[], formId?: string }[]>(() => loadFromStorage('erp_saved_datasets', []));
    const [activeDatasetId, setActiveDatasetId] = useState<string | null>(() => loadFromStorage('erp_active_dataset_id', null));
    const [activeFormId, setActiveFormId] = useState<string | null>(() => loadFromStorage('erp_active_form_id', 'form_default'));

    // Rule Presets State
    const [savedRulePresets, setSavedRulePresets] = useState<{ id: string, name: string, rules: any[], datasetId?: string }[]>(() => loadFromStorage('erp_rule_presets', []));

    // Product Center State
    const [products, setProducts] = useState<{
        id: string;
        name: string;
        description: string;
        image: string;
        datasetId: string;
        viewNames: string[];
        timestamp: number;
        baseInfo: any;
        defaultOverrides?: any; // Saved overrides/cascading values
        configRules: {
            id: string;
            ruleType: 'logic' | 'mapping';
            logic?: 'AND' | 'OR';
            conditions?: { fieldId: string, operator: string, value: string }[];
            targetField: string;
            expression?: string;
            sourceField?: string;
            sourceRowId?: string;
            mappings?: { sourceValue: string, targetValue: string }[];
            cascadeGroups?: { sourceField: string, targetField: string, sourceRowId?: string, mappings?: { sourceValue: string, targetValue: string }[] }[];
            description?: string; // Added description field
        }[];
    }[]>(() => loadFromStorage('erp_products', []));

    const [productOrders, setProductOrders] = useState<{
        id: string;
        productId: string;
        quantity: number;
        timestamp: number;
    }[]>(() => loadFromStorage('erp_product_orders', []));

    const [configState, setConfigState] = useState({
        datasetId: '',
        viewNames: [] as string[],
        name: '',
        description: '',
        image: '',
        imageFit: 'cover' as 'cover' | 'contain' | 'fill' | 'tile',
        // Configuration Rules: Group Logic focused
        configRules: [] as {
            id: string;
            ruleType: 'logic' | 'mapping';
            logic?: 'AND' | 'OR';
            conditions?: { fieldId: string, operator: string, value: string }[];
            targetField: string;
            expression?: string;
            sourceField?: string;
            sourceRowId?: string;
            mappings?: { sourceValue: string, targetValue: string }[];
            cascadeGroups?: { sourceField: string, targetField: string, sourceRowId?: string, mappings?: { sourceValue: string, targetValue: string }[] }[];
            description?: string; // Added description field
            title?: string; // Added title field
        }[]
    });

    // Preview Overrides for BOM Table (Real-time cascading updates)
    const [previewOverrides, setPreviewOverrides] = useState<Record<string, Record<string, any>>>(() => loadFromStorage('erp_preview_overrides', {}));

    useEffect(() => {
        if (typeof window !== 'undefined') window.localStorage.setItem('erp_preview_overrides', JSON.stringify(previewOverrides));
    }, [previewOverrides]);

    const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
    const [activeRuleTab, setActiveRuleTab] = useState<number>(0);
    const [editingRuleTab, setEditingRuleTab] = useState<{ index: number, value: string } | null>(null);
    const [orderQuantity, setOrderQuantity] = useState<number>(1);

    // Naming Rules - Enhanced with custom variables
    type NamingRuleType = 'project' | 'personnel' | 'product' | 'custom' | 'date' | 'quantity' | 'separator' | 'counter' | 'variable';
    type NamingRule = { id: string; type: NamingRuleType; value: string; label?: string; variableId?: string; format?: string };
    type NamingVariable = { id: string; name: string; type: 'text' | 'select'; options: string[]; defaultValue: string };

    const [namingRules, setNamingRules] = useState<NamingRule[]>(() => loadFromStorage('erp_naming_rules', []));
    const [namingVariables, setNamingVariables] = useState<NamingVariable[]>(() => loadFromStorage('erp_naming_variables', []));
    const [namingCounter, setNamingCounter] = useState(() => loadFromStorage('erp_naming_counter', 1));
    const [namingInteractiveMode, setNamingInteractiveMode] = useState<boolean>(() => loadFromStorage('erp_naming_interactive', false));

    // UI state for Export Naming Dialog
    const [exportNamingDialog, setExportNamingDialog] = useState<{
        open: boolean;
        variableOverrides: Record<string, string>;
        exportParams: {
            datasetId: string;
            viewNames: string[];
            hiddenFields: string[];
            configRules: any[];
            quantityMultiplier: number;
        } | null;
    }>({ open: false, variableOverrides: {}, exportParams: null });

    // UI state for inline variable creator
    const [isCreatingVariable, setIsCreatingVariable] = useState(false);
    const [newVariableName, setNewVariableName] = useState('');
    const [newVariableOptions, setNewVariableOptions] = useState<string[]>([]);
    const [currentOptionInput, setCurrentOptionInput] = useState('');

    // Naming Rule Library - Save and manage naming rule templates
    type NamingRuleTemplate = {
        id: string;
        name: string;
        rules: NamingRule[];
        variables: NamingVariable[];
        createdAt: number;
    };
    const [namingRuleLibrary, setNamingRuleLibrary] = useState<NamingRuleTemplate[]>(() => loadFromStorage('erp_naming_rule_library', []));
    const [defaultNamingRuleId, setDefaultNamingRuleId] = useState<string | null>(() => loadFromStorage('erp_default_naming_rule', null));
    const [isNamingBuilderCollapsed, setIsNamingBuilderCollapsed] = useState<boolean>(() => loadFromStorage('erp_naming_builder_collapsed', false));
    const [newTemplateNameInput, setNewTemplateNameInput] = useState('');
    const [isShowingLibrary, setIsShowingLibrary] = useState(false);

    // Persist naming settings
    useEffect(() => { window.localStorage.setItem('erp_naming_rules', JSON.stringify(namingRules)); }, [namingRules]);
    useEffect(() => { window.localStorage.setItem('erp_naming_variables', JSON.stringify(namingVariables)); }, [namingVariables]);
    useEffect(() => { window.localStorage.setItem('erp_naming_counter', JSON.stringify(namingCounter)); }, [namingCounter]);
    useEffect(() => { window.localStorage.setItem('erp_naming_interactive', JSON.stringify(namingInteractiveMode)); }, [namingInteractiveMode]);
    useEffect(() => { window.localStorage.setItem('erp_naming_rule_library', JSON.stringify(namingRuleLibrary)); }, [namingRuleLibrary]);
    useEffect(() => { window.localStorage.setItem('erp_default_naming_rule', JSON.stringify(defaultNamingRuleId)); }, [defaultNamingRuleId]);
    useEffect(() => { window.localStorage.setItem('erp_naming_builder_collapsed', JSON.stringify(isNamingBuilderCollapsed)); }, [isNamingBuilderCollapsed]);

    // Auto-load default naming rule template on component mount if current rules are empty
    useEffect(() => {
        if (namingRules.length === 0 && defaultNamingRuleId && namingRuleLibrary.length > 0) {
            const defaultTemplate = namingRuleLibrary.find(t => t.id === defaultNamingRuleId);
            if (defaultTemplate) {
                setNamingRules(defaultTemplate.rules);
                setNamingVariables(defaultTemplate.variables);
            }
        }
    }, []); // Only run on mount

    // Load saved key configurations when product is selected
    useEffect(() => {
        if (selectedProductId) {
            setActiveRuleTab(0);
            const product = products.find(p => p.id === selectedProductId);
            if (product && product.defaultOverrides) {
                setPreviewOverrides(product.defaultOverrides);
            } else {
                setPreviewOverrides({});
            }
        }
    }, [selectedProductId]);

    // Dataset Groups State
    const [datasetGroups, setDatasetGroups] = useState<{ id: string, name: string }[]>(() => loadFromStorage('erp_dataset_groups', []));

    // Persist groups & products
    useEffect(() => {
        if (typeof window !== 'undefined') window.localStorage.setItem('erp_dataset_groups', JSON.stringify(datasetGroups));
    }, [datasetGroups]);

    useEffect(() => {
        if (typeof window !== 'undefined') window.localStorage.setItem('erp_products', JSON.stringify(products));
    }, [products]);

    useEffect(() => {
        if (typeof window !== 'undefined') window.localStorage.setItem('erp_product_orders', JSON.stringify(productOrders));
    }, [productOrders]);

    useEffect(() => {
        if (typeof window !== 'undefined') window.localStorage.setItem('erp_rule_presets', JSON.stringify(savedRulePresets));
    }, [savedRulePresets]);

    useEffect(() => {
        if (typeof window !== 'undefined') window.localStorage.setItem('erp_active_tab', activeTab);
    }, [activeTab]);

    useEffect(() => {
        if (typeof window !== 'undefined') window.localStorage.setItem('erp_product_sub_tab', productSubTab);
    }, [productSubTab]);

    // Group Handlers
    const handleAddDatasetGroup = () => {
        const newName = `Folder ${datasetGroups.length + 1}`;
        setDatasetGroups(prev => [...prev, { id: `g_${Date.now()}`, name: newName }]);
    };

    const [groupRenameState, setGroupRenameState] = useState<{ id: string, name: string } | null>(null);
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set(loadFromStorage('erp_collapsed_groups', [])));
    const [deleteGroupDialog, setDeleteGroupDialog] = useState({ isOpen: false, groupId: '', groupName: '' });

    const executeDeleteGroup = (action: 'delete_all' | 'move_to_root') => {
        const { groupId } = deleteGroupDialog;
        if (action === 'delete_all') {
            const datasetsToDelete = savedDatasets.filter(d => d.groupId === groupId);
            if (datasetsToDelete.some(d => d.id === activeDatasetId)) setActiveDatasetId(null);
            setSavedDatasets(prev => prev.filter(d => d.groupId !== groupId));
        } else {
            setSavedDatasets(prev => prev.map(d => d.groupId === groupId ? { ...d, groupId: undefined } : d));
        }
        setDatasetGroups(prev => prev.filter(g => g.id !== groupId));
        setDeleteGroupDialog({ isOpen: false, groupId: '', groupName: '' });
        addToast('Folder deleted', 'info');
    };

    const handleMoveDataset = (datasetId: string, targetGroupId?: string) => {
        setSavedDatasets(prev => prev.map(d => d.id === datasetId ? { ...d, groupId: targetGroupId } : d));
        addToast('Dataset moved', 'success');
    };

    const handleReorderDataset = (draggedId: string, targetId: string) => {
        if (draggedId === targetId) return;
        setSavedDatasets(prev => {
            const draggedItem = prev.find(d => d.id === draggedId);
            if (!draggedItem) return prev;

            // Remove dragged item
            const listDisplaced = prev.filter(d => d.id !== draggedId);

            // Find target index
            const targetIndex = listDisplaced.findIndex(d => d.id === targetId);
            if (targetIndex === -1) return prev; // Should not happen

            // Get target item to inherit its group (if any) or validation
            const targetItem = listDisplaced[targetIndex];

            // Should dragging onto an item adopt its group?
            // Yes, standard filesystems do this if mixed. But here we have visual groups.
            // If we drag onto an item, we likely want to be neighbors. So yes, adopt group.
            const updatedDraggedItem = { ...draggedItem, groupId: targetItem.groupId };

            const newList = [...listDisplaced];
            newList.splice(targetIndex, 0, updatedDraggedItem);
            return newList;
        });
    };

    const [datasetSortMenuOpen, setDatasetSortMenuOpen] = useState(false);

    const handleSortDatasets = (type: 'name_asc' | 'name_desc' | 'date_new' | 'date_old') => {
        setSavedDatasets(prev => {
            const sorted = [...prev].sort((a, b) => {
                if (type === 'name_asc') return a.name.localeCompare(b.name);
                if (type === 'name_desc') return b.name.localeCompare(a.name);
                if (type === 'date_new') return b.timestamp - a.timestamp;
                if (type === 'date_old') return a.timestamp - b.timestamp;
                return 0;
            });
            return sorted;
        });
        setDatasetSortMenuOpen(false);
        addToast('Datasets sorted', 'info');
    };

    const handleCommitGroupRename = () => {
        if (!groupRenameState) return;
        setDatasetGroups(prev => prev.map(g => g.id === groupRenameState.id ? { ...g, name: groupRenameState.name } : g));
        setGroupRenameState(null);
    };

    const toggleGroupCollapse = (groupId: string) => {
        setCollapsedGroups(prev => {
            const next = new Set(prev);
            if (next.has(groupId)) {
                next.delete(groupId);
            } else {
                next.add(groupId);
            }
            return next;
        });
    };

    const confirmDeleteGroup = (groupId: string, groupName: string) => {
        setDeleteGroupDialog({ isOpen: true, groupId, groupName });
    };

    const [viewName, setViewName] = useState('');

    const [globalSearch, setGlobalSearch] = useState('');
    const [showFilters, setShowFilters] = useState(() => loadFromStorage('erp_show_filters', false));

    // Quick Filter State (column header filters)
    const [quickFilters, setQuickFilters] = useState<Record<string, { open: boolean, value: string }>>({});

    const [errors, setErrors] = useState<Record<string, string>>({});

    // Track unsaved changes
    const [lastSavedSnapshot, setLastSavedSnapshot] = useState<string>(() => {
        // Create a snapshot of initial state to compare against
        const initialRecords = loadFromStorage('erp_records', []);
        const initialSchema = loadFromStorage('erp_schema', InitialSchema);
        return JSON.stringify({ records: initialRecords, schema: initialSchema });
    });

    // Compute isDirty by comparing current state with last saved snapshot
    const isDirty = useMemo(() => {
        const currentSnapshot = JSON.stringify({ records, schema });
        return currentSnapshot !== lastSavedSnapshot;
    }, [records, schema, lastSavedSnapshot]);

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
    const [currentFormName, setCurrentFormName] = useState(() => loadFromStorage('erp_current_form_name', 'Custom Form'));

    // Drag from toolbox state
    const [isDraggingFromToolbox, setIsDraggingFromToolbox] = useState(false);
    const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);

    // Dataset Library UI State
    const [saveDatasetOpen, setSaveDatasetOpen] = useState(false);
    const [datasetNameInput, setDatasetNameInput] = useState('');

    // === Comprehensive Data Persistence ===

    // Persist active tab
    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.localStorage.setItem('erp_active_tab', JSON.stringify(activeTab));
        }
    }, [activeTab]);

    // Persist sub view
    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.localStorage.setItem('erp_sub_view', JSON.stringify(subView));
        }
    }, [subView]);

    // Persist schema
    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.localStorage.setItem('erp_schema', JSON.stringify(schema));
        }
    }, [schema]);

    // Persist records
    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.localStorage.setItem('erp_records', JSON.stringify(records));
        }
    }, [records]);

    // Persist filter groups
    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.localStorage.setItem('erp_filter_groups', JSON.stringify(filterGroups));
        }
    }, [filterGroups]);

    // Persist View Settings
    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.localStorage.setItem('erp_saved_views_v2', JSON.stringify(savedViews));
            window.localStorage.setItem('erp_saved_forms', JSON.stringify(savedForms));
            window.localStorage.setItem('erp_root_filter_mode', JSON.stringify(rootFilterMode));
            window.localStorage.setItem('erp_hidden_columns', JSON.stringify(hiddenColumnIds));
        }
    }, [savedViews, savedForms, rootFilterMode, hiddenColumnIds]);

    // Persist saved datasets
    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.localStorage.setItem('erp_saved_datasets', JSON.stringify(savedDatasets));
        }
    }, [savedDatasets]);

    // Persist show filters state
    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.localStorage.setItem('erp_show_filters', JSON.stringify(showFilters));
        }
    }, [showFilters]);

    // Persist current form name
    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.localStorage.setItem('erp_current_form_name', JSON.stringify(currentFormName));
        }
    }, [currentFormName]);

    // Persist collapsed groups
    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.localStorage.setItem('erp_collapsed_groups', JSON.stringify(Array.from(collapsedGroups)));
        }
    }, [collapsedGroups]);

    // Persist active dataset id
    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.localStorage.setItem('erp_active_dataset_id', JSON.stringify(activeDatasetId));
        }
    }, [activeDatasetId]);

    const hasActiveFilters = useMemo(() => filterGroups.some(g => g.conditions.length > 0), [filterGroups]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.localStorage.setItem('erp_active_form_id', JSON.stringify(activeFormId));
            window.localStorage.setItem('erp_current_form_name', JSON.stringify(currentFormName));
        }
    }, [activeFormId, currentFormName]);

    // Sanitize filter groups when schema changes - remove conditions referencing non-existent fields
    useEffect(() => {
        const schemaFieldIds = new Set(schema.map(f => f.id));

        setFilterGroups(prev => {
            const sanitized = prev.map(group => ({
                ...group,
                conditions: group.conditions.filter(cond => schemaFieldIds.has(cond.fieldId))
            }));

            // Check if any changes were made
            const hasChanged = prev.some((group, i) =>
                group.conditions.length !== sanitized[i].conditions.length
            );

            return hasChanged ? sanitized : prev;
        });

        // Also clear pending filter if it references a non-existent field
        setPendingFilter(prev =>
            schemaFieldIds.has(prev.fieldId) ? prev : { fieldId: '', operator: '', value: '', value2: '' }
        );

        // Clear quick filters for non-existent fields
        setQuickFilters(prev => {
            const filtered = Object.fromEntries(
                Object.entries(prev).filter(([fieldId]) => schemaFieldIds.has(fieldId))
            );
            return Object.keys(filtered).length !== Object.keys(prev).length ? filtered : prev;
        });
    }, [schema]);

    // Resizing Logics
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!resizingColumnRef.current) return;
            const { id, startX, startWidth } = resizingColumnRef.current;
            const diff = e.clientX - startX;
            const newWidth = Math.max(80, startWidth + diff);
            setColumnWidths(prev => ({ ...prev, [id]: newWidth }));
        };

        const handleMouseUp = () => {
            if (resizingColumnRef.current) {
                const finalId = resizingColumnRef.current.id;
                setColumnWidths(currentWidths => {
                    const latestWidth = currentWidths[finalId];
                    if (typeof window !== 'undefined') {
                        const existing = loadFromStorage('erp_column_widths', {});
                        window.localStorage.setItem('erp_column_widths', JSON.stringify({
                            ...existing,
                            [finalId]: latestWidth
                        }));
                    }
                    return currentWidths;
                });
                resizingColumnRef.current = null;
                document.body.style.cursor = 'default';
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    const handleResizeStart = (e: React.MouseEvent, fieldId: string) => {
        e.preventDefault();
        e.stopPropagation();
        const header = (e.target as HTMLElement).closest('th');
        if (!header) return;
        const width = header.offsetWidth;
        resizingColumnRef.current = { id: fieldId, startX: e.clientX, startWidth: width };
        document.body.style.cursor = 'col-resize';
    };

    const handleUpdateActiveDataset = () => {
        if (!activeDatasetId) return;

        const currentDataset = savedDatasets.find(d => d.id === activeDatasetId);
        if (!currentDataset) return;

        setSavedDatasets(prev => prev.map(d =>
            d.id === activeDatasetId
                ? {
                    ...d,
                    schema: [...schema],
                    records: [...records],
                    timestamp: Date.now(),
                    formId: activeFormId || undefined
                }
                : d
        ));

        // Mark data as clean
        setLastSavedSnapshot(JSON.stringify({ records: [...records], schema: [...schema] }));
        addToast(`Changes saved to "${currentDataset.name}"`, 'success');
    };

    const handleSaveDataset = (saveFilteredOnly: boolean = false) => {
        if (!datasetNameInput.trim()) {
            addToast('Please enter a dataset name', 'error');
            return;
        }

        const name = datasetNameInput.trim();
        const exists = savedDatasets.some(d => d.name === name);

        const doSave = () => {
            // Use filtered records if user chose to save filtered only and there are active filters
            const recordsToSave = (saveFilteredOnly && hasActiveFilters) ? [...filteredRecords] : [...records];
            const newId = Date.now().toString();

            setSavedDatasets(prev => {
                const filtered = prev.filter(d => d.name !== name);
                return [{
                    id: newId,
                    name: name,
                    timestamp: Date.now(),
                    schema: [...schema],
                    records: recordsToSave,
                    formId: activeFormId || undefined
                }, ...filtered];
            });

            // Update current app state to reflect the saved dataset
            setRecords(recordsToSave);
            if (saveFilteredOnly && hasActiveFilters) {
                // Clear filters when switching to a subset dataset as the new "root"
                setFilterGroups([{ id: Date.now().toString(), logic: 'AND', conditions: [] }]);
                setQuickFilters({});
            }

            setActiveDatasetId(newId);
            setSaveDatasetOpen(false);
            setDatasetNameInput('');

            // Mark data as clean after saving
            setLastSavedSnapshot(JSON.stringify({ records: recordsToSave, schema }));

            if (saveFilteredOnly && hasActiveFilters) {
                addToast(`Dataset "${name}" saved with ${recordsToSave.length} filtered records`, 'success');
            } else {
                addToast(`Dataset "${name}" saved with ${recordsToSave.length} records`, 'success');
            }
        };

        if (exists) {
            triggerConfirm('Overwrite Dataset', `Dataset "${name}" already exists. Overwrite?`, doSave, 'info', 'Overwrite');
        } else {
            doSave();
        }
    };


    // Rename & Delete Logic
    const [renameDialog, setRenameDialog] = useState<{
        isOpen: boolean,
        id: string,
        name: string,
        type?: 'dataset' | 'form'
    }>({ isOpen: false, id: '', name: '', type: 'dataset' });

    const handleDeleteDataset = (e: React.MouseEvent, id: string, name: string) => {
        e.stopPropagation(); // Prevent loading
        triggerConfirm(
            'Delete Dataset',
            `Are you sure you want to delete "${name}"? This cannot be undone.`,
            () => {
                setSavedDatasets(prev => prev.filter(d => d.id !== id));
                if (id === activeDatasetId) setActiveDatasetId(null);
                addToast(`Dataset "${name}" deleted`, 'success');
            },
            'danger',
            'Delete'
        );
    };

    const handleRenameSubmit = () => {
        if (!renameDialog.name.trim()) return;

        const newName = renameDialog.name.trim();

        if (renameDialog.type === 'form') {
            const exists = savedForms.some(f => f.name === newName && f.id !== renameDialog.id);
            if (exists) {
                addToast('A form template with this name already exists', 'error');
                return;
            }

            // If the renamed form was our active template, update the label
            const oldForm = savedForms.find(f => f.id === renameDialog.id);
            if (oldForm && oldForm.name === currentFormName) {
                setCurrentFormName(newName);
            }

            setSavedForms(prev => prev.map(f => f.id === renameDialog.id ? { ...f, name: newName } : f));
            addToast('Form template renamed successfully', 'success');
        } else {
            const exists = savedDatasets.some(d => d.name === newName && d.id !== renameDialog.id);
            if (exists) {
                addToast('A dataset with this name already exists', 'error');
                return;
            }

            setSavedDatasets(prev => prev.map(d => d.id === renameDialog.id ? { ...d, name: newName } : d));
            addToast('Dataset renamed successfully', 'success');
        }

        setRenameDialog({ isOpen: false, id: '', name: '', type: 'dataset' });
    };

    const handleLoadDataset = (dataset: any) => {
        const doLoad = () => {
            setSchema(dataset.schema);
            setRecords(dataset.records || []);
            setActiveDatasetId(dataset.id);

            // 1. Try to restore by stored formId
            let formNameFound = 'Custom Form';
            if (dataset.formId) {
                const form = savedForms.find(f => f.id === dataset.formId);
                if (form) {
                    formNameFound = form.name;
                    setActiveFormId(form.id);
                }
            }

            // 2. Fallback: Schema matching (if no formId or form was deleted)
            if (formNameFound === 'Custom Form') {
                const matchedTemplate = savedForms.find(f => JSON.stringify(f.schema) === JSON.stringify(dataset.schema));
                if (matchedTemplate) {
                    formNameFound = matchedTemplate.name;
                    setActiveFormId(matchedTemplate.id);
                } else {
                    setActiveFormId(null);
                }
            }

            setCurrentFormName(formNameFound);

            setSubView('table');
            // Clear filter groups when switching datasets
            setFilterGroups([{ id: Date.now().toString(), logic: 'AND', conditions: [] }]);
            setActiveGroupId('');
            setPendingFilter({ fieldId: '', operator: '', value: '', value2: '' });
            setQuickFilters({});
            // Update snapshot to mark new data as clean
            setLastSavedSnapshot(JSON.stringify({ records: dataset.records || [], schema: dataset.schema }));
            addToast(`Loaded dataset: ${dataset.name}`, 'success');
        };

        // Check if there are unsaved changes
        if (isDirty) {
            triggerConfirm(
                '未保存的更改',
                '当前数据有未保存的更改。切换数据集将丢失这些更改。是否继续？',
                doLoad,
                'danger',
                '放弃更改并切换'
            );
        } else {
            doLoad();
        }
    };

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

    const fileInputRef = useRef<HTMLInputElement>(null);
    const dataImportInputRef = useRef<HTMLInputElement>(null);

    // AI Import Progress State
    const [importProgress, setImportProgress] = useState<{
        isOpen: boolean;
        step: number;
        message: string;
        error?: string;
    }>({ isOpen: false, step: 0, message: '' });

    // AI Builder Modal State
    const [aiBuilderModal, setAiBuilderModal] = useState<{
        isOpen: boolean;
        mode: 'generate' | 'logic';
        prompt: string;
        isLoading: boolean;
        error?: string;
    }>({ isOpen: false, mode: 'generate', prompt: '', isLoading: false });

    const handleAIGenerate = async () => {
        if (!aiBuilderModal.prompt.trim()) return;

        setAiBuilderModal(prev => ({ ...prev, isLoading: true, error: undefined }));

        try {
            const savedConfig = localStorage.getItem('project_ai_config');
            const config = savedConfig ? JSON.parse(savedConfig) : {};

            if (!config.apiKey) {
                throw new Error("Please configure your AI API Key in Settings first.");
            }

            let result: any[];

            if (aiBuilderModal.mode === 'generate') {
                result = await generateFormFromDescription(aiBuilderModal.prompt, {
                    provider: config.provider || 'gemini',
                    apiKey: config.apiKey,
                    baseUrl: config.baseUrl,
                    model: config.model
                });
            } else {
                // Logic mode - merge with existing schema
                result = await generateFormLogic(schema, aiBuilderModal.prompt, {
                    provider: config.provider || 'gemini',
                    apiKey: config.apiKey,
                    baseUrl: config.baseUrl,
                    model: config.model
                });
            }

            if (result && result.length > 0) {
                if (aiBuilderModal.mode === 'generate') {
                    setSchema(result);
                    setActiveFormId(null);
                    addToast(`Generated ${result.length} fields!`, 'success');
                } else {
                    // Merge logic into existing schema
                    const updatedSchema = schema.map(field => {
                        const updatedField = result.find(f => f.id === field.id);
                        if (updatedField && updatedField.logic) {
                            return { ...field, logic: updatedField.logic };
                        }
                        return field;
                    });
                    setSchema(updatedSchema);
                    addToast('Logic configuration updated!', 'success');
                }
                setAiBuilderModal({ isOpen: false, mode: 'generate', prompt: '', isLoading: false });
            } else {
                throw new Error("AI could not generate the requested content");
            }
        } catch (error: any) {
            console.error(error);
            setAiBuilderModal(prev => ({ ...prev, isLoading: false, error: error.message }));
        }
    };

    const handleDataImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        addToast('Processing import...', 'info');

        try {
            const buffer = await file.arrayBuffer();
            const wb = read(buffer);
            const ws = wb.Sheets[wb.SheetNames[0]];
            const data: any[] = utils.sheet_to_json(ws, { defval: '', raw: false });

            if (data.length === 0) {
                addToast('No data found in file', 'warning');
                return;
            }

            const normalize = (s: string) => s.toLowerCase().replace(/[*]/g, '').trim();

            // Map keys based on schema
            const newRecords = data.map((item, rowIdx) => {
                const record: any = { _id: Date.now() + Math.random() + rowIdx };
                schema.forEach(field => {
                    if (['divider', 'notice', 'spacer'].includes(field.type)) return;

                    const normalizedFieldLabel = normalize(field.label);
                    const normalizedFieldId = normalize(field.id);

                    // Try to find a matching key in the imported object
                    const sourceKey = Object.keys(item).find(k => {
                        const normalizedK = normalize(k);
                        return normalizedK === normalizedFieldLabel ||
                            normalizedK === normalizedFieldId ||
                            normalizedK === normalizedFieldLabel.replace(/\s+/g, '') ||
                            normalizedK === normalizedFieldId.replace(/\s+/g, '');
                    });

                    if (sourceKey !== undefined) {
                        record[field.id] = item[sourceKey];
                    }
                });
                return applyRowLogic(record, schema);
            }).filter(r => {
                // Filter out records where all schema-defined fields are empty
                return schema.some(field => {
                    if (['divider', 'notice', 'spacer'].includes(field.type)) return false;
                    const val = r[field.id];
                    return val !== undefined && val !== null && val !== '';
                });
            });

            if (subView === 'batch') {
                const newBatchRows = newRecords.map(r => ({ tempId: Date.now() + Math.random(), data: r }));
                setBatchRows(prev => [...prev.filter(r => Object.keys(r.data).length > 0), ...newBatchRows]);
                addToast(`Loaded ${newRecords.length} rows into batch editor`, 'success');
            } else {
                setRecords(prev => [...newRecords, ...prev]);
                addToast(`Successfully imported ${newRecords.length} records`, 'success');
            }
        } catch (error: any) {
            console.error(error);
            addToast(`Import failed: ${error.message}`, 'error');
        } finally {
            if (dataImportInputRef.current) dataImportInputRef.current.value = '';
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImportProgress({ isOpen: true, step: 1, message: 'Reading file...' });

        try {
            const buffer = await file.arrayBuffer();
            const wb = read(buffer);
            const ws = wb.Sheets[wb.SheetNames[0]];
            const data = utils.sheet_to_json(ws, { header: 1 });

            if (data.length < 2) throw new Error("File is empty or missing headers");

            setImportProgress({ isOpen: true, step: 2, message: 'Extracting table structure...' });

            const headers = data[0] as string[];
            const rows = data.slice(1);

            // Limit analysis rows to save tokens and context window
            const semanticRows = rows.slice(0, 10).map((row: any) => {
                const obj: any = {};
                headers.forEach((h, i) => obj[h] = row[i]);
                return obj;
            });

            // Get AI config from localStorage
            const savedConfig = localStorage.getItem('project_ai_config');
            const config = savedConfig ? JSON.parse(savedConfig) : {};

            if (!config.apiKey) {
                throw new Error("Please configure your AI API Key in Settings first.");
            }

            setImportProgress({ isOpen: true, step: 3, message: 'AI is analyzing data patterns...' });

            const schema = await generateFormSchemaFromData(headers, semanticRows, {
                provider: config.provider || 'gemini',
                apiKey: config.apiKey,
                baseUrl: config.baseUrl,
                model: config.model
            });

            setImportProgress({ isOpen: true, step: 4, message: 'Generating form components...' });

            // Small delay to show final step
            await new Promise(r => setTimeout(r, 500));

            if (schema && schema.length > 0) {
                setSchema(schema);
                setActiveFormId(null);
                setActiveTab('builder');
                setImportProgress({ isOpen: false, step: 0, message: '' });
                addToast(`Form generated with ${schema.length} fields!`, 'success');
            } else {
                throw new Error("AI could not generate schema");
            }

        } catch (error: any) {
            console.error(error);
            setImportProgress({ isOpen: true, step: 0, message: '', error: error.message || 'Import failed' });
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
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
        localStorage.setItem('erp_filter_groups', JSON.stringify(filterGroups));
    }, [filterGroups]);

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

        // Update currently active filters
        setFilterGroups(prev => prev.map(group => ({
            ...group,
            conditions: group.conditions.map(cond =>
                cond.fieldId === id ? { ...cond, fieldId: newId } : cond
            )
        })));

        // Update saved view presets
        setSavedViews(prev => prev.map(view => ({
            ...view,
            filterGroups: view.filterGroups.map(group => ({
                ...group,
                conditions: group.conditions.map(cond =>
                    cond.fieldId === id ? { ...cond, fieldId: newId } : cond
                )
            }))
        })));

        // Update pending filter
        setPendingFilter(prev => prev.fieldId === id ? { ...prev, fieldId: newId } : prev);

        // Update quick filters
        setQuickFilters(prev => {
            if (prev[id]) {
                const next = { ...prev, [newId]: prev[id] };
                delete next[id];
                return next;
            }
            return prev;
        });

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

        const newRecord = applyRowLogic({ _id: Date.now(), ...data }, schema);
        setRecords(prev => [newRecord, ...prev]);
        addToast('Record added successfully', 'success');
        setPreviewData({});
        setSubView('table');
    };

    const isCellReadOnly = (row: any, field: any) => {
        if (!field.logic?.readOnly) return false;
        // evaluateExpression handles {field_id} markers using the row's data
        return evaluateExpression(field.logic.readOnly, row) === true;
    };

    const isCellVisible = (row: any, field: any) => {
        if (!field.logic?.visibility) return true;
        return evaluateExpression(field.logic.visibility, row) === true;
    };

    const getFieldOptions = (field: any, rowData: any) => {
        if (field.logic?.optionsRule) {
            const result = evaluateExpression(field.logic.optionsRule, rowData);
            if (Array.isArray(result)) return result.map(String);
            if (result && typeof result === 'string') return result.split(',').map(s => s.trim());
        }
        return field.options || [];
    };

    const validateField = (field: any, value: any, rowData: any): string | null => {
        const id = field.id;

        // 1. Required Check
        const isReq = field.logic?.requiredRule ? (evaluateExpression(field.logic.requiredRule, rowData) === true) : field.required;
        if (isReq && (value === undefined || value === null || value === '')) {
            return 'Required';
        }

        // 2. Regex Validation
        if (field.logic?.regex && value) {
            try {
                const re = new RegExp(field.logic.regex);
                if (!re.test(String(value))) {
                    return field.logic.errorMsg || 'Invalid format';
                }
            } catch (e) {
                console.error("Invalid regex", e);
            }
        }

        // 3. Custom Rule
        if (field.logic?.customRule) {
            const isValid = evaluateExpression(field.logic.customRule, { ...rowData, [id]: value });
            if (isValid === false) {
                return field.logic.customErrorMsg || 'Invalid';
            }
        }

        return null;
    };

    const handleGridUpdate = (recordId: any, fieldId: string, value: any) => {
        setRecords(prev => prev.map(row => {
            if (row._id === recordId) {
                const updatedRowData = { ...row, [fieldId]: value };
                // Apply calculations and logic automatically
                return applyRowLogic(updatedRowData, schema);
            }
            return row;
        }));
    };

    const handleBatchUpdate = (index: number, fieldId: string, value: any) => {
        const newRows = [...batchRows];
        const updatedRowData = { ...newRows[index].data, [fieldId]: value };
        // Apply calculations and logic
        newRows[index].data = applyRowLogic(updatedRowData, schema);
        setBatchRows(newRows);
    };

    const handleBatchSubmit = () => {
        const validRows = batchRows
            .filter(r => Object.keys(r.data).length > 0 && Object.values(r.data).some(v => v !== ''))
            .map(r => applyRowLogic({ _id: Date.now() + Math.random(), ...r.data }, schema));

        if (validRows.length === 0) {
            addToast('No data to import', 'warning');
            return;
        }

        setRecords(prev => [...validRows, ...prev]);
        setBatchRows([]);
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
        if (!pendingFilter.fieldId || (!pendingFilter.value && pendingFilter.operator !== 'isEmpty' && pendingFilter.operator !== 'isNotEmpty')) return;

        const field = schema.find(f => f.id === pendingFilter.fieldId);
        const ops = field ? getOperatorsForType(field.type) : [];
        const op = pendingFilter.operator || (ops.length > 0 ? ops[0].val : 'eq');

        const newCondition = {
            id: `flt-${Date.now()}`,
            fieldId: pendingFilter.fieldId,
            operator: op,
            value: pendingFilter.value,
            value2: pendingFilter.value2 || undefined
        };

        setFilterGroups(prev => {
            if (prev.some(g => g.id === activeGroupId)) {
                return prev.map(g => g.id === activeGroupId ? { ...g, conditions: [...g.conditions, newCondition] } : g);
            }
            if (prev.length > 0) {
                return prev.map((g, i) => i === 0 ? { ...g, conditions: [...g.conditions, newCondition] } : g);
            }
            return [{ id: 'g1', logic: 'AND', conditions: [newCondition] }];
        });

        setPendingFilter({ fieldId: '', operator: '', value: '', value2: '' });
    };

    const handleRemoveFilter = (groupId: string, conditionId: string) => {
        setFilterGroups(prev => prev.map(g => {
            if (g.id !== groupId) return g;
            return { ...g, conditions: g.conditions.filter(c => c.id !== conditionId) };
        }));
    };

    const handleRemoveGroup = (groupId: string) => {
        setFilterGroups(prev => {
            const newGroups = prev.filter(g => g.id !== groupId);
            if (activeGroupId === groupId) {
                if (newGroups.length > 0) setActiveGroupId(newGroups[0].id);
                else setActiveGroupId('');
            }
            return newGroups;
        });
    };

    const handleAddGroup = () => {
        const newGroup = { id: `g-${Date.now()}`, logic: 'AND' as const, conditions: [] };
        setFilterGroups(prev => [...prev, newGroup]);
        setActiveGroupId(newGroup.id);
    };

    const handleSaveView = () => {
        if (!viewName.trim()) return;
        setSavedViews([...savedViews, {
            name: viewName,
            filterGroups: [...filterGroups],
            rootFilterMode,
            datasetId: activeDatasetId, // Associate with current dataset
            configRules: [...configState.configRules] // Capture current rules into the preset view
        }]);
        setViewName('');
        addToast(`View "${viewName}" saved to current table`, 'success');
    };

    const handleLoadView = (view: { name: string, filterGroups: any[], rootFilterMode?: 'AND' | 'OR', configRules?: any[] }, isAdditive: boolean = false) => {
        if (!isAdditive) {
            // Standard replacement logic
            const newGroups = view.filterGroups.map(g => ({
                ...JSON.parse(JSON.stringify(g)),
                id: `g-${Date.now()}-${Math.random()}`,
                fromPreset: view.name
            }));
            setFilterGroups(newGroups);
            if (view.rootFilterMode) setRootFilterMode(view.rootFilterMode);
            if (newGroups.length > 0) setActiveGroupId(newGroups[0].id);
            if (view.configRules) {
                setConfigState(prev => ({ ...prev, configRules: view.configRules || [] }));
            }
            addToast(`Applied view: ${view.name}`, 'info');
        } else {
            // Additive/Toggle logic
            const isAlreadyActive = filterGroups.some(g => g.fromPreset === view.name);

            if (isAlreadyActive) {
                // Remove groups from this preset
                const nextGroups = filterGroups.filter(g => g.fromPreset !== view.name);
                // If we removed everything and it's empty, add a default group
                if (nextGroups.length === 0) {
                    nextGroups.push({ id: `g-${Date.now()}`, logic: 'AND', conditions: [] });
                }
                setFilterGroups(nextGroups);
                addToast(`Removed view: ${view.name}`, 'info');
            } else {
                // Add groups from this preset
                const newGroupsToAdd = view.filterGroups.map(g => ({
                    ...JSON.parse(JSON.stringify(g)),
                    id: `g-${Date.now()}-${Math.random()}`,
                    fromPreset: view.name
                }));

                setFilterGroups(prev => {
                    // Filter out any default empty groups first
                    const existing = prev.filter(g => g.conditions.length > 0 || g.fromPreset);
                    return [...existing, ...newGroupsToAdd];
                });

                if (newGroupsToAdd.length > 0) setActiveGroupId(newGroupsToAdd[0].id);
                addToast(`Added view: ${view.name}`, 'success');
            }
        }
    };

    // --- Enhanced Filtering Logic ---
    const evaluateFilter = (r: any, f: { fieldId: string, operator: string, value: string, value2?: string }) => {
        const val = r[f.fieldId];
        const fieldType = schema.find(s => s.id === f.fieldId)?.type || 'text';
        const strVal = String(val ?? '');
        const lowerVal = strVal.toLowerCase();
        const filterLower = f.value.toLowerCase();

        // Common operators (all types)
        if (f.operator === 'isEmpty') return val === undefined || val === null || val === '';
        if (f.operator === 'isNotEmpty') return val !== undefined && val !== null && val !== '';
        if (f.operator === 'eq') return strVal == f.value;
        if (f.operator === 'neq') return strVal != f.value;

        // Text operators
        if (f.operator === 'contains') return lowerVal.includes(filterLower);
        if (f.operator === 'notContains') return !lowerVal.includes(filterLower);
        if (f.operator === 'startsWith') return lowerVal.startsWith(filterLower);
        if (f.operator === 'endsWith') return lowerVal.endsWith(filterLower);
        if (f.operator === 'regex') {
            try {
                const regex = new RegExp(f.value, 'i');
                return regex.test(strVal);
            } catch { return false; }
        }

        // Number operators
        if (fieldType === 'number') {
            const numVal = Number(val);
            const filterVal = Number(f.value);
            if (f.operator === 'gt') return numVal > filterVal;
            if (f.operator === 'lt') return numVal < filterVal;
            if (f.operator === 'gte') return numVal >= filterVal;
            if (f.operator === 'lte') return numVal <= filterVal;
            if (f.operator === 'between' && f.value2) {
                const min = Number(f.value);
                const max = Number(f.value2);
                return numVal >= min && numVal <= max;
            }
        }

        // Date operators
        if (fieldType === 'date') {
            const dateVal = new Date(val).getTime();
            const filterDate = new Date(f.value).getTime();
            if (f.operator === 'before') return dateVal < filterDate;
            if (f.operator === 'after') return dateVal > filterDate;
            if (f.operator === 'between' && f.value2) {
                const startDate = new Date(f.value).getTime();
                const endDate = new Date(f.value2).getTime();
                return dateVal >= startDate && dateVal <= endDate;
            }
        }

        return true;
    };

    const filteredRecords = useMemo(() => {

        const filtered = records.filter(r => {
            if (!r) return false;

            // 1. Global Search
            if (globalSearch && !Object.values(r).some(v => String(v).toLowerCase().includes(globalSearch.toLowerCase()))) {
                return false;
            }

            // 2. Quick Filters (always AND)
            const quickFilterMatches = Object.entries(quickFilters).every(([fieldId, qf]) => {
                if (!qf.value) return true;
                const val = String(r[fieldId] ?? '').toLowerCase();
                return val.includes(qf.value.toLowerCase());
            });
            if (!quickFilterMatches) return false;

            // 3. Advanced Filters with Groups Logic
            if (filterGroups.length === 0) return true;

            const groupResults = filterGroups.map(group => {
                if (group.conditions.length === 0) return true;

                if (group.logic === 'AND') {
                    return group.conditions.every(c => evaluateFilter(r, c));
                } else {
                    return group.conditions.some(c => evaluateFilter(r, c));
                }
            });

            if (rootFilterMode === 'AND') {
                return groupResults.every(r => r);
            } else {
                return groupResults.some(r => r);
            }
        });

        // Apply Sorting
        if (sortConfig.length > 0) {
            filtered.sort((a, b) => {
                if (!a || !b) return 0;
                for (const sort of sortConfig) {
                    const valA = a[sort.fieldId];
                    const valB = b[sort.fieldId];
                    if (valA === valB) continue;

                    // Treat null/undefined as less than standard values
                    if (valA === null || valA === undefined) return 1; // move to bottom
                    if (valB === null || valB === undefined) return -1;

                    if (valA < valB) return sort.direction === 'asc' ? -1 : 1;
                    if (valA > valB) return sort.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }

        return filtered;
    }, [records, globalSearch, filterGroups, rootFilterMode, quickFilters, schema, sortConfig]);

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
    const handleUpdateForm = () => {
        if (!activeFormId) return;
        setSavedForms(prev => prev.map(f =>
            f.id === activeFormId
                ? { ...f, schema: [...schema], timestamp: Date.now() }
                : f
        ));
        addToast('Template updated successfully', 'success');
    };

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
            setSchema([...form.schema]);
            setRecords([]); // Clear records when loading a new template
            setActiveDatasetId(null); // Clear active dataset as we are now on a template
            setActiveFormId(form.id);
            setCurrentFormName(form.name);

            // Clear filters
            setFilterGroups([{ id: Date.now().toString(), logic: 'AND', conditions: [] }]);
            setQuickFilters({});

            // Update snapshot to mark as clean (empty data)
            setLastSavedSnapshot(JSON.stringify({ records: [], schema: form.schema }));

            addToast(`Template loaded for modification: ${form.name}`, 'success');
            if (targetTab) setActiveTab(targetTab);
            setTemplateSelectorOpen(false);
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
    const gridColumns = allDataFields.filter(f => f.showInGrid !== false && !hiddenColumnIds.includes(f.id));
    // --- Auto-Fill Global Handler ---
    useEffect(() => {
        if (!isDraggingFill && !isDraggingSelection && !isDraggingRowSelection && !isDraggingColumnSelection) return;

        const handleMouseUp = (e: MouseEvent) => {
            if (isDraggingSelection) {
                setIsDraggingSelection(false);
                return;
            }
            if (isDraggingRowSelection) {
                setIsDraggingRowSelection(false);
                return;
            }
            if (isDraggingColumnSelection) {
                setIsDraggingColumnSelection(false);
                return;
            }

            if (!isDraggingFill) return;
            setIsDraggingFill(false);

            if (!fillRange || !selectedCells.length) {
                setFillRange(null);
                return;
            }

            // 1. Calculate source bounding box
            const sourceRowIndices = selectedCells.map(c => filteredRecords.findIndex(r => r._id === c.rowId));
            const sourceColIndices = selectedCells.map(c => gridColumns.findIndex(col => col.id === c.fieldId));
            const sourceMinRow = Math.min(...sourceRowIndices);
            const sourceMaxRow = Math.max(...sourceRowIndices);
            const sourceMinCol = Math.min(...sourceColIndices);
            const sourceMaxCol = Math.max(...sourceColIndices);

            const isRangeChanged = fillRange.startRowIndex !== sourceMinRow ||
                fillRange.endRowIndex !== sourceMaxRow ||
                fillRange.minColIndex !== sourceMinCol ||
                fillRange.maxColIndex !== sourceMaxCol;

            if (isRangeChanged) {
                const isMultiColumn = (sourceMaxCol - sourceMinCol) > 0;

                if (isMultiColumn) {
                    // Req: Multi-column selection should simply expand without menu
                    performFill('select_only');
                } else {
                    // Single column selection shows menu
                    const clientX = e.clientX;
                    const clientY = e.clientY;
                    setFillConfirmMenu({
                        x: clientX,
                        y: clientY,
                        recordsToUpdate: [],
                    });
                }
            } else {
                // If no range change, just clear state
                setFillRange(null);
            }
        };

        window.addEventListener('mouseup', handleMouseUp);
        return () => window.removeEventListener('mouseup', handleMouseUp);
    }, [isDraggingFill, isDraggingSelection, isDraggingRowSelection, isDraggingColumnSelection, fillRange, selectedCells, filteredRecords, gridColumns, records, isCellReadOnly]);

    // Perform Fill Action
    const performFill = (mode: 'copy' | 'series' | 'select_only') => {
        if (!fillRange) return;

        if (mode === 'select_only') {
            const newSelection = [];
            for (let r = fillRange.startRowIndex; r <= fillRange.endRowIndex; r++) {
                for (let c = fillRange.minColIndex; c <= fillRange.maxColIndex; c++) {
                    if (filteredRecords[r] && gridColumns[c]) {
                        newSelection.push({
                            rowId: filteredRecords[r]._id,
                            fieldId: gridColumns[c].id
                        });
                    }
                }
            }
            setSelectedCells(newSelection);
            if (newSelection.length > 0) {
                setSelectedCell(newSelection[0]);
            }
            setFillRange(null);
            setFillConfirmMenu(null);
            return;
        }

        const sourceRowIndices = selectedCells.map(c => filteredRecords.findIndex(r => r._id === c.rowId)).filter(i => i !== -1);
        const sourceMinRow = Math.min(...sourceRowIndices);
        const sourceMaxRow = Math.max(...sourceRowIndices);
        const sourceHeight = sourceMaxRow - sourceMinRow + 1;

        let newRecords = [...records];

        for (let colIdx = fillRange.minColIndex; colIdx <= fillRange.maxColIndex; colIdx++) {
            const col = gridColumns[colIdx];

            // Skip calculated columns
            if (col.logic?.calculation) continue;

            const isDate = col.type === 'date';
            const isNumber = col.type === 'number';

            for (let rIdx = fillRange.startRowIndex; rIdx <= fillRange.endRowIndex; rIdx++) {
                if (rIdx >= sourceMinRow && rIdx <= sourceMaxRow) continue;

                const targetRecord = filteredRecords[rIdx];
                if (!targetRecord) continue;
                if (isCellReadOnly(targetRecord, col)) continue;

                const offsetFromSourceStart = rIdx - sourceMinRow;
                const sourceRowOffset = offsetFromSourceStart >= 0 ? offsetFromSourceStart % sourceHeight : (sourceHeight + (offsetFromSourceStart % sourceHeight)) % sourceHeight;
                const sourceRowIdx = sourceMinRow + sourceRowOffset;

                const sourceRecord = filteredRecords[sourceRowIdx];
                const sourceValue = sourceRecord[col.id];

                let newValue = sourceValue;

                if (mode === 'series') {
                    let step = 0;
                    if (sourceHeight > 1 && (isNumber || isDate)) {
                        const firstVal = filteredRecords[sourceMinRow][col.id];
                        const lastVal = filteredRecords[sourceMaxRow][col.id];
                        const diff = isDate ? (new Date(lastVal).getTime() - new Date(firstVal).getTime()) / (1000 * 60 * 60 * 24)
                            : (Number(lastVal) - Number(firstVal));
                        step = diff / (sourceHeight - 1);
                    } else {
                        step = 1;
                    }

                    if (isNumber || isDate) {
                        const startVal = filteredRecords[sourceMinRow][col.id];
                        if (startVal !== null && startVal !== undefined) {
                            if (isNumber) {
                                newValue = Number(startVal) + (step * (rIdx - sourceMinRow));
                            } else if (isDate) {
                                const d = new Date(startVal);
                                d.setDate(d.getDate() + (step * (rIdx - sourceMinRow)));
                                newValue = d.toISOString().split('T')[0];
                            }
                        }
                    }
                }

                const realRecordIndex = records.findIndex(r => r._id === targetRecord._id);
                if (realRecordIndex !== -1) {
                    newRecords[realRecordIndex] = applyRowLogic({ ...newRecords[realRecordIndex], [col.id]: newValue }, schema);
                }
            }
        }

        setRecords(newRecords);

        // After fill, the fillRange becomes the new selection
        const finalSelection = [];
        for (let r = fillRange.startRowIndex; r <= fillRange.endRowIndex; r++) {
            for (let c = fillRange.minColIndex; c <= fillRange.maxColIndex; c++) {
                if (filteredRecords[r] && gridColumns[c]) {
                    finalSelection.push({
                        rowId: filteredRecords[r]._id,
                        fieldId: gridColumns[c].id
                    });
                }
            }
        }
        setSelectedCells(finalSelection);

        setFillRange(null);
        setFillConfirmMenu(null);
        addToast('Cells filled', 'success');
    };

    // --- Product Configuration Center Helpers ---
    const [productConfigHiddenFields, setProductConfigHiddenFields] = useState<string[]>([]);

    // UI State for Configurator
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        'datasource': true,
        'rules': true,
        'identity': true,
        'templates': true
    });
    const toggleSection = (id: string) => setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));
    const [isSavingPreset, setIsSavingPreset] = useState(false);
    const [presetNameInput, setPresetNameInput] = useState('');
    const handleSaveProduct = () => {
        // Validation with specific feedback
        if (!configState.datasetId) { addToast('Missing Dataset', 'warning'); return; }
        // View Name is now optional
        if (!configState.name) { addToast('Missing Product Name', 'warning'); return; }

        try {
            const newProduct = {
                id: `prod_${Date.now()}`,
                name: configState.name,
                description: configState.description || '',
                image: configState.image || '',
                imageFit: configState.imageFit || 'cover',
                datasetId: configState.datasetId,
                viewNames: configState.viewNames,
                configRules: configState.configRules || [],
                defaultOverrides: JSON.parse(JSON.stringify(previewOverrides || {})), // Deep copy to ensure no reference issues
                timestamp: Date.now(),
                baseInfo: {}
            };

            setProducts(prev => {
                const updated = [...prev, newProduct];
                // Force save to local storage immediately to mitigate async state issues
                if (typeof window !== 'undefined') window.localStorage.setItem('erp_products', JSON.stringify(updated));
                return updated;
            });

            addToast('Product saved successfully!', 'success');

            // Clear state and navigate
            setTimeout(() => {
                setProductSubTab('library');
                setConfigState({ datasetId: '', viewNames: [], name: '', description: '', image: '', imageFit: 'cover', configRules: [] });
            }, 100);

        } catch (e: any) {
            console.error(e);
            addToast(`Error saving product: ${e.message}`, 'error');
        }
    };

    // Helper to process BOM data for both Display and Export
    const getProcessedBOMData = (
        datasetId: string,
        viewNames: string[],
        hiddenFields: string[] = [],
        configRules: any[] = []
    ) => {
        const dataset = savedDatasets.find(d => d.id === datasetId);
        if (!dataset) return null;

        const rawRecords = [...dataset.records];

        // Filter overrides: only apply if the field is an active 'sourceField' in current rules
        const activeSourceFields = new Set<string>();
        if (configRules) {
            configRules.forEach(rule => {
                if (rule.ruleType === 'mapping') {
                    if (rule.cascadeGroups) {
                        rule.cascadeGroups.forEach((cg: any) => activeSourceFields.add(cg.sourceField));
                    }
                    if (rule.sourceField) activeSourceFields.add(rule.sourceField);
                }
            });
        }

        const processedRecords = rawRecords.map(r => {
            const overrides = previewOverrides[r._id] || {};
            const cleanOverrides: any = {};

            Object.keys(overrides).forEach(fieldId => {
                if (activeSourceFields.has(fieldId)) {
                    cleanOverrides[fieldId] = overrides[fieldId];
                }
            });

            return {
                ...r,
                ...cleanOverrides
            };
        });

        // Iterative application to handle cascading (up to 4 passes for cross-row dependencies)
        for (let i = 0; i < 4; i++) {
            let changed = false;
            const snapshot = JSON.stringify(processedRecords);

            configRules.forEach(rule => {
                if (rule.ruleType === 'mapping') {
                    // NEW: Process each cascade group independently
                    if (rule.cascadeGroups && rule.cascadeGroups.length > 0) {
                        rule.cascadeGroups.forEach((cg: any) => {
                            const { sourceField, targetField, sourceRowId, mappings } = cg;

                            if (sourceRowId) {
                                // Specific row logic for this cascade group
                                const sourceRecord = processedRecords.find(r => String(r._id) === String(sourceRowId));
                                if (sourceRecord) {
                                    const sourceVal = sourceRecord[sourceField];
                                    const match = mappings?.find((m: any) => String(m.sourceValue) === String(sourceVal));
                                    if (match && String(sourceRecord[targetField]) !== String(match.targetValue)) {
                                        sourceRecord[targetField] = match.targetValue;
                                    }
                                }
                            } else {
                                // Same Row Logic: Every row drives itself for this cascade group
                                processedRecords.forEach(r => {
                                    const sourceVal = r[sourceField];
                                    const match = mappings?.find((m: any) => String(m.sourceValue) === String(sourceVal));
                                    if (match && String(r[targetField]) !== String(match.targetValue)) {
                                        r[targetField] = match.targetValue;
                                    }
                                });
                            }
                        });
                    } else if (rule.mappings && rule.mappings.length > 0) {
                        // Legacy support for old-style mappings
                        if (rule.sourceRowId) {
                            const sourceRecord = processedRecords.find(r => String(r._id) === String(rule.sourceRowId));
                            if (sourceRecord) {
                                const sourceVal = sourceRecord[rule.sourceField];
                                const match = rule.mappings?.find((m: any) => String(m.sourceValue) === String(sourceVal));
                                if (match && String(sourceRecord[rule.targetField]) !== String(match.targetValue)) {
                                    sourceRecord[rule.targetField] = match.targetValue;
                                }
                            }
                        } else {
                            processedRecords.forEach(r => {
                                const sourceVal = r[rule.sourceField];
                                const match = rule.mappings?.find((m: any) => String(m.sourceValue) === String(sourceVal));
                                if (match && String(r[rule.targetField]) !== String(match.targetValue)) {
                                    r[rule.targetField] = match.targetValue;
                                }
                            });
                        }
                    }
                } else if (rule.ruleType === 'logic') {
                    // Logic Rule Execution
                    const applyLogic = (record: any) => {
                        const conditionResults = (rule.conditions || []).map((c: any) => evaluateFilter(record, c));
                        const match = rule.logic === 'AND' ? conditionResults.every((r: any) => r) : conditionResults.some((r: any) => r);
                        if (match) {
                            if (String(record[rule.targetField]) !== String(rule.expression)) {
                                record[rule.targetField] = rule.expression;
                            }
                        }
                    };

                    if (rule.sourceRowId) {
                        const sourceRecord = processedRecords.find(r => String(r._id) === String(rule.sourceRowId));
                        if (sourceRecord) applyLogic(sourceRecord);
                    } else {
                        processedRecords.forEach(r => applyLogic(r));
                    }
                }
            });

            if (JSON.stringify(processedRecords) === snapshot) break;
        }

        let filtered = processedRecords;

        // Apply View Filters
        if (viewNames && viewNames.length > 0) {
            viewNames.forEach(vName => {
                const view = savedViews.find(v => v.name === vName && v.datasetId === datasetId);
                if (view) {
                    view.filterGroups.forEach(group => {
                        const groupMatch = (r: any) => {
                            const results = group.conditions.map((f: any) => evaluateFilter(r, f));
                            return group.logic === 'AND' ? results.every(res => res) : results.some(res => res);
                        };
                        filtered = filtered.filter(groupMatch);
                    });
                }
            });
        }

        const displayFields = dataset.schema
            .filter(f => !['divider', 'spacer', 'notice'].includes(f.type))
            .filter(f => !hiddenFields.includes(f.id));

        return { processedRecords, filteredRecords: filtered, displayFields, dataset };
    };

    // --- Export BOM with Interactive Naming Support ---
    const generateFilename = (overrides: Record<string, string> = {}, quantityMultiplier: number = 1) => {
        if (namingRules.length === 0) {
            return `BOM_Export_${new Date().toISOString().slice(0, 10)}`;
        }
        return namingRules.map(rule => {
            switch (rule.type) {
                case 'project':
                    // Use override if provided, otherwise use default
                    if (overrides[rule.id]) return overrides[rule.id];
                    const activeProject = activeProjects.find(p => p.id === selectedProductId);
                    return activeProject?.info.name || 'UnknownProject';
                case 'personnel':
                    // Use override if provided, otherwise use placeholder
                    if (overrides[rule.id]) return overrides[rule.id];
                    return 'User';
                case 'product':
                    // Auto-fill with current product name (from the product being ordered)
                    const currentProduct = products.find(p => p.id === selectedProductId);
                    return currentProduct?.name || 'UnknownProduct';
                case 'date':
                    return new Date().toISOString().slice(0, 10);
                case 'quantity':
                    return String(quantityMultiplier);
                case 'separator':
                    return rule.value;
                case 'variable':
                    // Use override if provided, otherwise use rule's current value
                    return overrides[rule.id] || rule.value || rule.label || 'Var';
                case 'counter':
                    return String(namingCounter).padStart(3, '0');
                case 'custom':
                    return rule.value;
                default:
                    return rule.value;
            }
        }).join('');
    };

    const executeExport = (
        datasetId: string,
        viewNames: string[],
        hiddenFields: string[],
        configRules: any[],
        quantityMultiplier: number,
        variableOverrides: Record<string, string> = {}
    ) => {
        const data = getProcessedBOMData(datasetId, viewNames, hiddenFields, configRules);
        if (!data) return;
        const { filteredRecords, displayFields } = data;

        const exportBytes = filteredRecords.map(r => {
            const row: any = {};
            displayFields.forEach((f, index) => {
                const isMultiplierTarget = quantityMultiplier > 1 && index === displayFields.length - 1;
                let val = r[f.id];
                if (isMultiplierTarget && !isNaN(Number(val))) {
                    val = Number(val) * quantityMultiplier;
                }
                const headerName = f.label || f.name || f.id;
                row[headerName] = (typeof val === 'object' && val !== null) ? JSON.stringify(val) : val;
            });
            return row;
        });

        const ws = utils.json_to_sheet(exportBytes);
        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, "BOM Architecture");
        const filename = generateFilename(variableOverrides, quantityMultiplier);
        writeFile(wb, `${filename}.xlsx`);
    };

    const handleExportBOM = (
        datasetId: string,
        viewNames: string[],
        hiddenFields: string[],
        configRules: any[],
        quantityMultiplier: number
    ) => {
        // Check for rules that need user selection (system + custom variables)
        const interactiveRuleTypes = ['project', 'personnel', 'variable'];
        const interactiveRules = namingRules.filter(r => interactiveRuleTypes.includes(r.type));

        console.log('[Export Intercept]', {
            namingInteractiveMode,
            interactiveRulesCount: interactiveRules.length,
            namingRulesCount: namingRules.length,
            interactiveRules
        });

        // Interceptor: If interactive mode is ON and there are selectable placeholders
        if (namingInteractiveMode && interactiveRules.length > 0) {
            // Initialize overrides with current default values
            const initialOverrides: Record<string, string> = {};
            interactiveRules.forEach(r => {
                if (r.type === 'variable') {
                    const varDef = namingVariables.find(v => v.id === r.variableId);
                    initialOverrides[r.id] = r.value || varDef?.defaultValue || '';
                } else if (r.type === 'project') {
                    // Default to current product's project or first project
                    const currentProject = activeProjects.find(p => p.id === selectedProductId);
                    initialOverrides[r.id] = currentProject?.info.name || activeProjects[0]?.info.name || '';
                } else if (r.type === 'personnel') {
                    // Default to first team member
                    initialOverrides[r.id] = activeTeamMembers[0]?.name || '';
                }
            });

            // Open dialog and store export params for later execution
            setExportNamingDialog({
                open: true,
                variableOverrides: initialOverrides,
                exportParams: { datasetId, viewNames, hiddenFields, configRules, quantityMultiplier }
            });

            return; // Stop here - dialog will handle the rest
        }

        // Direct export: either interactive mode is OFF or no interactive rules exist
        executeExport(datasetId, viewNames, hiddenFields, configRules, quantityMultiplier);
    };

    const renderBOMTable = (
        datasetId: string,
        viewNames: string[],
        hiddenFields: string[] = [],
        configRules: any[] = [],
        quantityMultiplier: number = 1 // New Argument
    ) => {
        const data = getProcessedBOMData(datasetId, viewNames, hiddenFields, configRules);
        if (!data) return <div className="p-8 text-center text-gray-400 italic">Dataset not found</div>;

        // Destructure BOTH processedRecords (for rules lookup) and filteredRecords (for display)
        const { processedRecords, filteredRecords: filtered, displayFields } = data;

        // Determine which cells are affected by rules or are active monitors
        const getCellStatus = (record: any, fieldId: string) => {
            // Priority 1: Check if it's a source field (monitor)
            const sourceRules = configRules.filter(r => {
                if (r.ruleType !== 'mapping') return false;

                // Cascade Groups Check
                if (r.cascadeGroups && r.cascadeGroups.length > 0) {
                    return r.cascadeGroups.some((cg: any) => {
                        if (cg.sourceField !== fieldId) return false;
                        if (cg.sourceRowId) return String(record._id) === String(cg.sourceRowId);
                        return true;
                    });
                }

                // Legacy Check
                if (r.sourceField !== fieldId) return false;
                if (r.sourceRowId) return String(record._id) === String(r.sourceRowId);
                return true;
            });

            if (sourceRules.length > 0) {
                const allEnumValues = Array.from(new Set(sourceRules.flatMap(r => {
                    if (r.cascadeGroups && r.cascadeGroups.length > 0) {
                        return r.cascadeGroups
                            .filter((cg: any) => cg.sourceField === fieldId)
                            .flatMap((cg: any) => (cg.mappings || []).map((m: any) => m.sourceValue));
                    }
                    return (r.mappings || []).map((m: any) => m.sourceValue);
                })));

                return {
                    type: 'source',
                    options: allEnumValues,
                    isMaster: sourceRules.some(r => r.sourceRowId || r.cascadeGroups?.some((cg: any) => cg.sourceField === fieldId && cg.sourceRowId))
                };
            }

            // Priority 2: Check if it's a target field
            for (const rule of configRules) {
                // Cascade Targets
                if (rule.ruleType === 'mapping' && rule.cascadeGroups && rule.cascadeGroups.length > 0) {
                    const group = rule.cascadeGroups.find((cg: any) => cg.targetField === fieldId);
                    if (group) {
                        // Determine source value for this group
                        let sourceVal;
                        if (group.sourceRowId) {
                            const sourceRecord = processedRecords.find(r => String(r._id) === String(group.sourceRowId));
                            sourceVal = sourceRecord ? sourceRecord[group.sourceField] : undefined;
                        } else {
                            sourceVal = record[group.sourceField];
                        }

                        const match = (group.mappings || []).find((m: any) => String(m.sourceValue) === String(sourceVal));
                        if (match) return {
                            type: 'target',
                            subtype: 'mapping',
                            color: 'bg-emerald-50/50 text-emerald-700 font-bold border-emerald-200',
                            value: match.targetValue,
                            isFromMaster: !!group.sourceRowId
                        };
                    }
                }

                // Legacy Targets
                if (fieldId !== rule.targetField) continue;

                if (rule.ruleType === 'logic') {
                    const conditionResults = (rule.conditions || []).map((c: any) => evaluateFilter(record, c as any));
                    const match = rule.logic === 'AND' ? conditionResults.every((r: any) => r) : conditionResults.some((r: any) => r);
                    if (match) return { type: 'target', subtype: 'logic', color: 'bg-indigo-50/50 text-indigo-700 font-bold border-indigo-200', value: rule.expression };
                } else if (rule.ruleType === 'mapping') {
                    // Check logic based on source row
                    let sourceVal;
                    if (rule.sourceRowId) {
                        const sourceRecord = processedRecords.find(r => String(r._id) === String(rule.sourceRowId));
                        sourceVal = sourceRecord ? sourceRecord[rule.sourceField] : undefined;
                    } else {
                        sourceVal = record[rule.sourceField];
                    }

                    const match = (rule.mappings || []).find((m: any) => String(m.sourceValue) === String(sourceVal));
                    if (match) return {
                        type: 'target',
                        subtype: 'mapping',
                        color: 'bg-emerald-50/50 text-emerald-700 font-bold border-emerald-200',
                        value: match.targetValue,
                        isFromMaster: !!rule.sourceRowId
                    };
                }
            }
            return { type: 'normal' };
        };

        const stats = {
            affected: processedRecords.filter(r => configRules.some(rule => {
                if (rule.ruleType !== 'mapping') return false;

                if (rule.cascadeGroups && rule.cascadeGroups.length > 0) {
                    return rule.cascadeGroups.some((cg: any) => {
                        let sVal;
                        if (cg.sourceRowId) {
                            const sRec = processedRecords.find(sr => String(sr._id) === String(cg.sourceRowId));
                            sVal = sRec ? sRec[cg.sourceField] : undefined;
                        } else {
                            sVal = r[cg.sourceField];
                        }
                        return (cg.mappings || []).some((m: any) => String(m.sourceValue) === String(sVal));
                    });
                }

                let sVal;
                if (rule.sourceRowId) {
                    const sRec = processedRecords.find(sr => String(sr._id) === String(rule.sourceRowId));
                    sVal = sRec ? sRec[rule.sourceField] : undefined;
                } else {
                    sVal = r[rule.sourceField];
                }
                return (rule.mappings || []).some((m: any) => String(m.sourceValue) === String(sVal));
            })).length,
            valid: processedRecords.length
        };

        return (
            <div className="min-w-full inline-block align-middle">
                {configRules.length > 0 && (
                    <div className="bg-slate-50 border-b border-slate-200 px-6 py-2 flex items-center justify-between animate-in slide-in-from-top-2">
                        <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                                <Layers size={10} />
                                {configRules.length} 规则
                            </span>
                            <button
                                onClick={() => setPreviewOverrides({})}
                                className="text-[10px] font-bold text-slate-400 hover:text-indigo-600 flex items-center gap-1"
                            >
                                <RefreshCw size={10} /> 重置覆盖
                            </button>
                        </div>
                        <div className="flex items-center gap-3 text-[10px]">
                            <span className="text-slate-500">
                                覆盖 {stats.affected} / {filtered.length} 行
                            </span>
                        </div>
                    </div>
                )}
                <table className="min-w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-10 shadow-sm">
                        <tr>
                            {displayFields.map(f => {
                                const isRuleRelated = configRules.some(r =>
                                    r.targetField === f.id || r.sourceField === f.id || r.conditions?.some((c: any) => c.fieldId === f.id)
                                );
                                return (
                                    <th key={f.id} className={`px-4 py-3 font-extrabold uppercase text-[10px] tracking-wider bg-slate-50 ${isRuleRelated ? 'text-indigo-600' : 'text-slate-500'}`}>
                                        {f.label}
                                        {isRuleRelated && <span className="ml-1 inline-block w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>}
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {filtered.map((r, i) => (
                            <tr
                                key={i}
                                className={`transition-colors ${activeRowPicker ? 'cursor-crosshair hover:bg-indigo-50 border-2 border-transparent hover:border-indigo-500/50' : 'hover:bg-slate-50'}`}
                                onClick={() => {
                                    if (activeRowPicker) {
                                        activeRowPicker(String(r._id));
                                        setActiveRowPicker(null);
                                        addToast('Row Selected', 'success');
                                    }
                                }}
                            >
                                {displayFields.map(f => {
                                    const status = getCellStatus(r, f.id);
                                    const isMultiplierTarget = quantityMultiplier > 1 && f.id === displayFields[displayFields.length - 1].id;
                                    const finalValue = isMultiplierTarget && !isNaN(Number(r[f.id]))
                                        ? Number(r[f.id]) * quantityMultiplier
                                        : r[f.id];

                                    return (
                                        <td
                                            key={f.id}
                                            className={`px-4 py-2 max-w-[300px] truncate transition-all duration-300 ${status.type === 'target' ? (status.color || 'bg-blue-50/30 text-blue-700') : 'text-slate-600'} ${isMultiplierTarget ? 'font-black text-indigo-600 bg-indigo-50/50' : ''}`}
                                        >
                                            {status.type === 'source' ? (
                                                <div className="relative group/select">
                                                    <select
                                                        value={String(r[f.id] || '')}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setPreviewOverrides(prev => ({
                                                                ...prev,
                                                                [r._id]: { ...(prev[r._id] || {}), [f.id]: val }
                                                            }));
                                                        }}
                                                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-bold text-indigo-600 focus:ring-2 focus:ring-indigo-500/20 outline-none appearance-none cursor-pointer shadow-sm hover:border-indigo-300 transition-all"
                                                    >
                                                        <option value="">(选择选项...)</option>
                                                        {status.options?.map((opt: string) => (
                                                            <option key={opt} value={opt}>{opt}</option>
                                                        ))}
                                                    </select>
                                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none group-hover/select:text-indigo-400">
                                                        <ChevronDown size={10} />
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    {status.type === 'target' && <ArrowRight size={10} className="text-current opacity-50 shrink-0" />}
                                                    <span className="truncate" title={String(finalValue || '')}>
                                                        {safeRenderValue(finalValue) || <span className="text-gray-300 italic">-</span>}
                                                        {isMultiplierTarget && <span className="text-[8px] text-indigo-400 ml-1 font-normal">(x{quantityMultiplier})</span>}
                                                    </span>
                                                </div>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filtered.length === 0 && <div className="p-8 text-center text-slate-400 italic text-xs">No records match the current view.</div>}
            </div>
        );
    };

    const renderProductConfig = () => {
        const selectedDataset = (savedDatasets || []).find(d => d.id === configState.datasetId);
        const availableViewsForDataset = (savedViews || []).filter(v => (v as any).datasetId === configState.datasetId);

        const isConfigComplete = !!configState.datasetId && !!configState.name;
        const missingSteps = [
            !configState.datasetId && "Data Source",
            !configState.name && "Product Identity"
        ].filter(Boolean);

        return (
            <div className="flex h-full animate-in fade-in duration-500">
                {/* Left: Configuration Panel */}
                <div
                    style={{ width: sidebarWidth }}
                    className="flex-shrink-0 bg-white border-r border-slate-200 flex flex-col h-full overflow-y-auto custom-scrollbar z-10 transition-none"
                >
                    <div className="p-4 space-y-3 flex flex-col h-full overflow-hidden">
                        {/* Header: Fixed */}
                        <div className="px-2 mb-2 flex-shrink-0">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                                        <Sparkles className="text-indigo-600" size={20} />
                                        定义产品
                                    </h3>
                                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-0.5 opacity-80">Product Configurator Studio</p>
                                </div>
                                <button
                                    onClick={() => triggerConfirm(
                                        'Reset Configuration',
                                        'Clear all settings and start over?',
                                        () => {
                                            setConfigState({ datasetId: '', viewNames: [], name: '', description: '', image: '', imageFit: 'cover', configRules: [] });
                                            addToast('Configuration Reset', 'info');
                                        },
                                        'danger',
                                        'Reset'
                                    )}
                                    className="p-2 hover:bg-slate-100 text-slate-400 rounded-xl transition-all"
                                    title="Reset Config"
                                >
                                    <RefreshCw size={14} />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-4">
                            {/* Section 1: Data Source (Collapsible) */}
                            <div className="border-b border-slate-100 last:border-0">
                                <button
                                    onClick={() => toggleSection('datasource')}
                                    className="w-full flex items-center justify-between py-4 hover:opacity-70 transition-opacity text-left group"
                                >
                                    <div className="flex items-center gap-2.5 text-slate-800">
                                        <div className={`text-slate-400 group-hover:text-indigo-600 transition-colors`}>
                                            <Database size={16} />
                                        </div>
                                        <span className="text-sm font-bold tracking-tight">1. Data Source</span>
                                    </div>
                                    {expandedSections['datasource'] ? <ChevronUp size={14} className="text-slate-300" /> : <ChevronDown size={14} className="text-slate-300" />}
                                </button>

                                {expandedSections['datasource'] && (
                                    <div className="pb-6 pt-0 space-y-4 animate-in slide-in-from-top-2 duration-200">
                                        <div className="space-y-4">
                                            {/* Select Table */}
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Database</label>
                                                <div className="relative">
                                                    <select
                                                        value={configState.datasetId}
                                                        onChange={(e) => {
                                                            setConfigState({ ...configState, datasetId: e.target.value, viewNames: [], configRules: [] });
                                                            setPreviewOverrides({});
                                                        }}
                                                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 appearance-none cursor-pointer focus:ring-2 focus:ring-indigo-100 outline-none transition-all hover:border-slate-300"
                                                    >
                                                        <option value="">Choose Dataset...</option>
                                                        {(savedDatasets || []).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                                    </select>
                                                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                                </div>
                                            </div>

                                            {/* Select View (Multi-select UI) */}
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Filter Presets</label>
                                                <div className="flex flex-wrap gap-2 min-h-[40px]">
                                                    {!configState.datasetId ? (
                                                        <span className="text-[11px] text-slate-300 italic py-1">Select a database first...</span>
                                                    ) : availableViewsForDataset.length === 0 ? (
                                                        <span className="text-[11px] text-slate-300 italic py-1">No views found</span>
                                                    ) : (
                                                        (availableViewsForDataset || []).map(v => {
                                                            const isSelected = (configState.viewNames || []).includes(v.name);
                                                            return (
                                                                <button
                                                                    key={v.name}
                                                                    onClick={() => {
                                                                        const currentViewNames = configState.viewNames || [];
                                                                        const next = isSelected
                                                                            ? currentViewNames.filter(n => n !== v.name)
                                                                            : [...currentViewNames, v.name];
                                                                        setConfigState({ ...configState, viewNames: next });
                                                                    }}
                                                                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all border ${isSelected
                                                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                                                        : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700'}`}
                                                                >
                                                                    {v.name}
                                                                </button>
                                                            );
                                                        })
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Section 2: Rule Engine (Collapsible) */}
                            <div className="border-b border-slate-100 last:border-0">
                                <button
                                    onClick={() => toggleSection('rules')}
                                    className="w-full flex items-center justify-between py-4 hover:opacity-70 transition-opacity text-left group"
                                >
                                    <div className="flex items-center gap-2.5 text-slate-800">
                                        <div className={`text-slate-400 group-hover:text-indigo-600 transition-colors`}>
                                            <Layers size={16} />
                                        </div>
                                        <span className="text-sm font-bold tracking-tight">2. Rule Engine</span>
                                    </div>
                                    {expandedSections['rules'] ? <ChevronUp size={14} className="text-slate-300" /> : <ChevronDown size={14} className="text-slate-300" />}
                                </button>

                                {expandedSections['rules'] && (
                                    <div className="pb-6 pt-0 animate-in slide-in-from-top-2 duration-200">
                                        {!configState.datasetId ? (
                                            <div className="p-8 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200 m-1">
                                                <div className="p-2 w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center mx-auto mb-2 text-slate-400">
                                                    <Database size={14} />
                                                </div>
                                                <p className="text-[10px] text-slate-400 font-medium">Please select a data source first</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-6">

                                                {/* Templates Library Header (Collapsible) */}
                                                <div onClick={() => toggleSection('templates')} className="flex items-center gap-2 cursor-pointer mb-3 select-none group/tmpl opacity-70 hover:opacity-100 transition-opacity">
                                                    <LayoutTemplate size={12} className="text-slate-400" />
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wide">Rule Templates</span>
                                                    <span className="bg-slate-100 text-slate-400 text-[9px] px-1.5 rounded-full font-bold">{savedRulePresets.length}</span>
                                                    <div className="h-px bg-slate-100 flex-1 ml-2"></div>
                                                    <ChevronDown size={12} className={`text-slate-300 transition-transform duration-200 ${expandedSections['templates'] ? 'rotate-180' : ''}`} />
                                                </div>

                                                {expandedSections['templates'] && (
                                                    <div className="mb-6 animate-in slide-in-from-top-1 px-1">
                                                        {builderActiveRuleType === 'logic' ? (
                                                            <div className="grid grid-cols-2 gap-2">
                                                                {savedRulePresets.filter(p => p.datasetId === configState.datasetId && (!p.rules[0] || p.rules[0].ruleType === 'logic')).length === 0 && (
                                                                    <div className="col-span-2 text-[10px] text-slate-300 italic text-center py-2">No logic templates found</div>
                                                                )}
                                                                {savedRulePresets.filter(p => p.datasetId === configState.datasetId && (!p.rules[0] || p.rules[0].ruleType === 'logic')).map(preset => (
                                                                    <div
                                                                        key={preset.id}
                                                                        className="group/pill flex items-center justify-between bg-slate-50 hover:bg-white border border-transparent hover:border-indigo-100 hover:shadow-sm pl-2 pr-1 py-1.5 rounded-lg transition-all cursor-pointer"
                                                                        onClick={() => {
                                                                            const currentRuleSignatures = new Set((configState.configRules || []).map(r => JSON.stringify({ ...r, id: undefined })));
                                                                            const newRules = preset.rules.filter(r => !currentRuleSignatures.has(JSON.stringify({ ...r, id: undefined })));
                                                                            if (newRules.length === 0) { addToast('Skipped duplicate rules', 'info'); return; }

                                                                            const rulesWithIds = newRules.map(r => ({ ...r, id: `rule_${Date.now()}_${Math.random()}` }));
                                                                            setConfigState(prev => ({ ...prev, configRules: [...(prev.configRules || []), ...rulesWithIds] }));

                                                                            // Auto-expand all added rules
                                                                            setExpandedRules(prev => {
                                                                                const next = { ...prev };
                                                                                rulesWithIds.forEach(r => { next[r.id] = true; });
                                                                                return next;
                                                                            });

                                                                            setPreviewOverrides({});
                                                                            addToast(`Added ${preset.name}`, 'success');
                                                                        }}
                                                                    >
                                                                        <div className="flex items-center gap-2 overflow-hidden">
                                                                            <Bot size={10} className="text-indigo-400 shrink-0 opacity-70" />
                                                                            <span className="text-[10px] font-bold text-slate-600 truncate">{preset.name}</span>
                                                                        </div>
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                triggerConfirm('Delete', `Delete "${preset.name}"?`, () => setSavedRulePresets(prev => prev.filter(p => p.id !== preset.id)), 'danger', 'Confirm');
                                                                            }}
                                                                            className="text-slate-300 hover:text-red-400 opacity-0 group-hover/pill:opacity-100 p-0.5 transition-opacity"
                                                                        >
                                                                            <X size={10} />
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <div className="grid grid-cols-2 gap-2">
                                                                {savedRulePresets.filter(p => p.datasetId === configState.datasetId && p.rules[0]?.ruleType === 'mapping').length === 0 && (
                                                                    <div className="col-span-2 text-[10px] text-slate-300 italic text-center py-2">No mapping templates found</div>
                                                                )}
                                                                {savedRulePresets.filter(p => p.datasetId === configState.datasetId && p.rules[0]?.ruleType === 'mapping').map(preset => (
                                                                    <div
                                                                        key={preset.id}
                                                                        className="group/pill flex items-center justify-between bg-slate-50 hover:bg-white border border-transparent hover:border-emerald-100 hover:shadow-sm pl-2 pr-1 py-1.5 rounded-lg transition-all cursor-pointer"
                                                                        onClick={() => {
                                                                            const currentRuleSignatures = new Set((configState.configRules || []).map(r => JSON.stringify({ ...r, id: undefined })));
                                                                            const newRules = preset.rules.filter(r => !currentRuleSignatures.has(JSON.stringify({ ...r, id: undefined })));
                                                                            if (newRules.length === 0) { addToast('Skipped duplicate rules', 'info'); return; }

                                                                            const rulesWithIds = newRules.map(r => ({ ...r, id: `rule_${Date.now()}_${Math.random()}` }));
                                                                            setConfigState(prev => ({ ...prev, configRules: [...(prev.configRules || []), ...rulesWithIds] }));

                                                                            // Auto-expand all added rules
                                                                            setExpandedRules(prev => {
                                                                                const next = { ...prev };
                                                                                rulesWithIds.forEach(r => { next[r.id] = true; });
                                                                                return next;
                                                                            });

                                                                            setPreviewOverrides({});
                                                                            addToast(`Added ${preset.name}`, 'success');
                                                                        }}
                                                                    >
                                                                        <div className="flex items-center gap-2 overflow-hidden">
                                                                            <ArrowRight size={10} className="text-emerald-500 shrink-0 opacity-70" />
                                                                            <span className="text-[10px] font-bold text-slate-600 truncate">{preset.name}</span>
                                                                        </div>
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                triggerConfirm('Delete', `Delete "${preset.name}"?`, () => setSavedRulePresets(prev => prev.filter(p => p.id !== preset.id)), 'danger', 'Confirm');
                                                                            }}
                                                                            className="text-slate-300 hover:text-red-400 opacity-0 group-hover/pill:opacity-100 p-0.5 transition-opacity"
                                                                        >
                                                                            <X size={10} />
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {(configState.configRules || []).length > 0 && (
                                                    <div className="space-y-1.5 px-0.5">
                                                        <div className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-2 mb-2 px-1">
                                                            <SlidersHorizontal size={10} />
                                                            Active Rules Stack ({(configState.configRules || []).length})
                                                        </div>
                                                        {(configState.configRules || []).map((rule) => {
                                                            const isExpanded = !!expandedRules[rule.id];
                                                            const isLogic = rule.ruleType !== 'mapping';

                                                            return (
                                                                <div
                                                                    key={rule.id}
                                                                    className={`group/rule bg-white border rounded-xl overflow-hidden transition-all duration-200 ${isExpanded
                                                                        ? 'border-indigo-200 shadow-sm ring-1 ring-indigo-50'
                                                                        : 'border-slate-100 hover:border-indigo-200'
                                                                        } ${editingRuleId === rule.id ? 'ring-2 ring-indigo-500 ring-offset-2' : ''}`}
                                                                >
                                                                    {/* Collapsed Header - Always Visible */}
                                                                    <div
                                                                        className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-50 transition-colors select-none ${isExpanded ? 'bg-slate-50/80 border-b border-indigo-50' : ''}`}
                                                                        onClick={() => toggleRuleExpanded(rule.id)}
                                                                    >
                                                                        {/* Expand Icon */}
                                                                        <div className="text-slate-400 shrink-0">
                                                                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                                        </div>

                                                                        {/* Type Indicator Bar */}
                                                                        <div className={`w-1 h-3 rounded-full shrink-0 ${!isLogic ? 'bg-emerald-400' : 'bg-indigo-400'}`} />

                                                                        {/* Rule Name / Summary */}
                                                                        <div className="flex-1 min-w-0">
                                                                            {(rule.title) ? (
                                                                                <div className="text-[11px] font-bold text-slate-700 truncate">{rule.title}</div>
                                                                            ) : (
                                                                                /* Auto-Generated Summary Title */
                                                                                <div className="text-[11px] font-medium text-slate-600 truncate flex items-center gap-1.5">
                                                                                    {!isLogic ? (
                                                                                        <>
                                                                                            <span>{rule.sourceField || 'Source'}</span>
                                                                                            <ArrowRight size={10} className="text-slate-300" />
                                                                                            <span>{rule.targetField || 'Target'}</span>
                                                                                        </>
                                                                                    ) : (
                                                                                        <>
                                                                                            <span className="text-slate-400 italic text-[10px] pr-1">IF...</span>
                                                                                            <span className="font-bold text-indigo-600">SET {rule.targetField}</span>
                                                                                        </>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>

                                                                        {/* Quick Actions (Edit/Delete) - Prevent Event Propagation */}
                                                                        <div className={`flex items-center gap-1 ${isExpanded ? 'opacity-100' : 'opacity-0 group-hover/rule:opacity-100'} transition-opacity`}>
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation(); // Prevent collapse
                                                                                    setEditingRuleId(rule.id);
                                                                                    setExpandedRules(prev => ({ ...prev, [rule.id]: true })); // Ensure expanded
                                                                                }}
                                                                                className="p-1 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 rounded transition-all"
                                                                                title="Edit Rule"
                                                                            >
                                                                                <Edit3 size={12} />
                                                                            </button>
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation(); // Prevent collapse
                                                                                    setConfigState({
                                                                                        ...configState,
                                                                                        configRules: (configState.configRules || []).filter(r => r.id !== rule.id)
                                                                                    });
                                                                                    setPreviewOverrides({});
                                                                                }}
                                                                                className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                                                                                title="Delete Rule"
                                                                            >
                                                                                <X size={12} />
                                                                            </button>
                                                                        </div>
                                                                    </div>

                                                                    {/* Expanded Details Body */}
                                                                    {isExpanded && (
                                                                        <div className="p-3 bg-white animate-in slide-in-from-top-1 fade-in duration-200">

                                                                            {/* Description */}
                                                                            {rule.description && (
                                                                                <div className="mb-3 text-[10px] text-slate-500 italic bg-amber-50 px-2 py-1.5 rounded border border-amber-100 flex items-start gap-1">
                                                                                    <Info size={12} className="mt-0.5 text-amber-400 shrink-0" />
                                                                                    {rule.description}
                                                                                </div>
                                                                            )}

                                                                            {/* Rule Logic Visualization */}
                                                                            {!isLogic ? ( // Mapping
                                                                                <div className="space-y-3">
                                                                                    <div className="flex items-center flex-wrap gap-1.5 text-[10px] leading-relaxed select-none">
                                                                                        <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold uppercase text-[9px]">WHEN</span>
                                                                                        <span className="font-bold text-slate-700 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">{rule.sourceField}</span>
                                                                                        <span className="text-slate-400">changes</span>
                                                                                        <ArrowRight size={10} className="text-slate-300" />
                                                                                        <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold uppercase text-[9px]">UPDATE</span>
                                                                                        <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">{rule.targetField}</span>
                                                                                    </div>

                                                                                    {/* Mapping Table Preview */}
                                                                                    {/* Mapping Table Preview */}
                                                                                    {(rule.cascadeGroups && rule.cascadeGroups.length > 0) ? (
                                                                                        <div className="space-y-2">
                                                                                            {rule.cascadeGroups.map((group: any, gIdx: number) => (
                                                                                                <div key={gIdx} className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
                                                                                                    <div className="px-3 py-1.5 bg-slate-100/50 border-b border-slate-200 flex items-center gap-2">
                                                                                                        <span className="bg-indigo-50 text-indigo-600 px-1.5 rounded text-[9px] font-bold">#{gIdx + 1}</span>
                                                                                                        <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500 uppercase">
                                                                                                            <span className="text-slate-700">{group.sourceField}</span>
                                                                                                            <ArrowRight size={10} className="text-slate-300" />
                                                                                                            <span className="text-emerald-700">{group.targetField}</span>
                                                                                                        </div>
                                                                                                        {group.sourceRowId && (
                                                                                                            <span className="ml-auto text-[8px] bg-amber-50 text-amber-600 px-1 py-0.5 rounded border border-amber-100 flex items-center gap-1">
                                                                                                                <MousePointerClick size={8} /> Pinned
                                                                                                            </span>
                                                                                                        )}
                                                                                                    </div>
                                                                                                    <div className="divide-y divide-slate-100">
                                                                                                        {(group.mappings || []).length > 0 ? (
                                                                                                            (group.mappings || []).slice(0, 5).map((m: any, i: number) => (
                                                                                                                <div key={i} className="grid grid-cols-[1fr,auto,1fr] gap-2 px-3 py-1.5 items-center text-[10px]">
                                                                                                                    <div className="font-medium text-slate-600 truncate" title={m.sourceValue}>{m.sourceValue}</div>
                                                                                                                    <ArrowRight size={10} className="text-slate-300" />
                                                                                                                    <div className="font-bold text-emerald-700 truncate" title={m.targetValue}>{m.targetValue}</div>
                                                                                                                </div>
                                                                                                            ))
                                                                                                        ) : (
                                                                                                            <div className="p-2 text-center text-[10px] text-slate-400 italic">No mappings defined</div>
                                                                                                        )}
                                                                                                    </div>
                                                                                                    {(group.mappings?.length || 0) > 5 && (
                                                                                                        <div className="px-3 py-1.5 text-[9px] text-slate-400 bg-slate-50/50 border-t border-slate-100 text-center italic">
                                                                                                            + {(group.mappings?.length || 0) - 5} more...
                                                                                                        </div>
                                                                                                    )}
                                                                                                </div>
                                                                                            ))}
                                                                                        </div>
                                                                                    ) : (
                                                                                        <div className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
                                                                                            <div className="grid grid-cols-[1fr,auto,1fr] gap-2 px-3 py-1.5 bg-slate-100/50 border-b border-slate-200 text-[9px] font-bold text-slate-500 uppercase">
                                                                                                <div>Value</div>
                                                                                                <div></div>
                                                                                                <div>Result</div>
                                                                                            </div>
                                                                                            <div className="divide-y divide-slate-100">
                                                                                                {(rule.mappings || []).length > 0 ? (
                                                                                                    (rule.mappings || []).slice(0, 5).map((m: any, i: number) => (
                                                                                                        <div key={i} className="grid grid-cols-[1fr,auto,1fr] gap-2 px-3 py-1.5 items-center text-[10px]">
                                                                                                            <div className="font-medium text-slate-600 truncate" title={m.sourceValue}>{m.sourceValue}</div>
                                                                                                            <ArrowRight size={10} className="text-slate-300" />
                                                                                                            <div className="font-bold text-emerald-700 truncate" title={m.targetValue}>{m.targetValue}</div>
                                                                                                        </div>
                                                                                                    ))
                                                                                                ) : (
                                                                                                    <div className="p-3 text-center text-[10px] text-slate-400 italic">No mappings defined</div>
                                                                                                )}
                                                                                            </div>
                                                                                            {(rule.mappings?.length || 0) > 5 && (
                                                                                                <div className="px-3 py-1.5 text-[9px] text-slate-400 bg-slate-50/50 border-t border-slate-100 italic">
                                                                                                    + {(rule.mappings?.length || 0) - 5} more mappings...
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    )}

                                                                                    {rule.sourceRowId && (
                                                                                        <div className="flex justify-end">
                                                                                            <span className="bg-orange-50 text-orange-600 border border-orange-100 px-2 py-1 rounded-md text-[9px] font-bold uppercase flex items-center gap-1.5">
                                                                                                <MousePointerClick size={10} /> Row #{rule.sourceRowId} Pinned
                                                                                            </span>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            ) : ( // Logic
                                                                                <div className="space-y-3">
                                                                                    <div className="flex items-center flex-wrap gap-1.5 text-[10px]">
                                                                                        <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold uppercase text-[9px]">IF</span>
                                                                                        <div className="text-slate-600 font-mono text-[10px] bg-amber-50 px-2 py-1 rounded border border-amber-100">
                                                                                            {rule.conditions?.map((c: any) => `${c.fieldId} ${c.operator} ${c.value}`).join(rule.logic === 'OR' ? ' || ' : ' && ')}
                                                                                        </div>
                                                                                        <ArrowRight size={10} className="text-slate-300" />
                                                                                        <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold uppercase text-[9px]">SET</span>
                                                                                        <div className="font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded border border-indigo-100">{rule.targetField}</div>
                                                                                    </div>

                                                                                    <div className="bg-slate-900 text-slate-50 font-mono text-[10px] p-2.5 rounded-lg border border-slate-800 shadow-inner">
                                                                                        <div className="opacity-50 text-[8px] mb-1">EXPRESSION:</div>
                                                                                        = {rule.expression}
                                                                                    </div>
                                                                                </div>
                                                                            )}

                                                                            {/* Bottom Toolbar for Expanded Item */}
                                                                            <div className="mt-3 pt-2 border-t border-slate-50 flex justify-end gap-2">
                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        setSavingRuleId(rule.id);
                                                                                        setNewPresetName(rule.title || '');
                                                                                    }}
                                                                                    className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-bold text-indigo-500 hover:bg-indigo-50 transition-colors"
                                                                                >
                                                                                    <Bookmark size={10} /> Save as Template
                                                                                </button>
                                                                            </div>

                                                                            {/* Inline Preset Save Form (Reusing existing logic logic if needed, but for now just the button triggering the state is fine. The global preset dialog might be better, but I'll replicate the inline one if it was inline before. 
                                                                           Wait, existing logic (Line 4919) had inline form. 
                                                                           I should include the inline form here if savingRuleId matches.
                                                                        */}
                                                                            {savingRuleId === rule.id && (
                                                                                <div className="mt-2 text-[10px] animate-in zoom-in-95">
                                                                                    <div className="flex gap-1">
                                                                                        <input
                                                                                            autoFocus
                                                                                            value={newPresetName}
                                                                                            onChange={e => setNewPresetName(e.target.value)}
                                                                                            placeholder="Template Name..."
                                                                                            className="flex-1 border border-indigo-200 rounded px-2 py-1 outline-none ring-2 ring-indigo-100"
                                                                                        />
                                                                                        <button
                                                                                            onClick={() => {
                                                                                                if (!newPresetName.trim()) return;
                                                                                                setSavedRulePresets(prev => [...prev, { id: `preset_${Date.now()}`, name: newPresetName.trim(), rules: [rule], datasetId: configState.datasetId }]);
                                                                                                addToast('Saved as Preset', 'success');
                                                                                                setSavingRuleId(null);
                                                                                            }}
                                                                                            className="bg-indigo-600 text-white px-2 py-1 rounded font-bold hover:bg-indigo-700"
                                                                                        >Save</button>
                                                                                        <button onClick={() => setSavingRuleId(null)} className="px-2 text-slate-400 hover:text-slate-600">Cancel</button>
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}

                                                {/* Unified Rule Builder: Simplified Trigger */}
                                                <div className="pt-2 border-t border-slate-50">
                                                    <UnifiedRuleBuilder
                                                        schema={selectedDataset?.schema || []}
                                                        records={selectedDataset?.records || []}
                                                        editingRule={configState.configRules?.find(r => r.id === editingRuleId)}
                                                        onUpdate={(updatedRule: any) => {
                                                            setConfigState({
                                                                ...configState,
                                                                configRules: (configState.configRules || []).map(r => r.id === updatedRule.id ? updatedRule : r)
                                                            });
                                                            setEditingRuleId(null);
                                                            setPreviewOverrides({});
                                                            addToast('Rule updated successfully', 'success');
                                                        }}
                                                        onEnableRowPicker={(cb) => {
                                                            setActiveRowPicker(() => cb);
                                                            addToast('Please click a row in the Preview table', 'info');
                                                        }}
                                                        onAdd={(rule) => {
                                                            const newId = `rule_${Date.now()}_${Math.random()}`;
                                                            setConfigState({
                                                                ...configState,
                                                                configRules: [...(configState.configRules || []), { ...rule, id: newId }]
                                                            });
                                                            setExpandedRules(prev => ({ ...prev, [newId]: true }));
                                                            setPreviewOverrides({});
                                                            addToast('Rule added to stack', 'success');
                                                        }}
                                                        onSaveAsPreset={(name, rules) => {
                                                            const exists = savedRulePresets.some(p => p.name === name);
                                                            if (exists) {
                                                                addToast(`预设名称 "${name}" 已存在`, 'error');
                                                                return;
                                                            }
                                                            setSavedRulePresets(prev => [...prev, { id: `preset_${Date.now()}`, name, rules, datasetId: configState.datasetId }]);
                                                            addToast(`预设 "${name}" 已保存到库`, 'success');
                                                        }}
                                                        activeRuleType={builderActiveRuleType}
                                                        onRuleTypeChange={setBuilderActiveRuleType}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Section 3: Identity (Collapsible) */}
                            <div className="border-b border-slate-100 last:border-0">
                                <button
                                    onClick={() => toggleSection('identity')}
                                    className="w-full flex items-center justify-between py-4 hover:opacity-70 transition-opacity text-left group"
                                >
                                    <div className="flex items-center gap-2.5 text-slate-800">
                                        <div className={`text-slate-400 group-hover:text-indigo-600 transition-colors`}>
                                            <Box size={16} />
                                        </div>
                                        <span className="text-sm font-bold tracking-tight">3. Product Identity</span>
                                    </div>
                                    {expandedSections['identity'] ? <ChevronUp size={14} className="text-slate-300" /> : <ChevronDown size={14} className="text-slate-300" />}
                                </button>

                                {expandedSections['identity'] && (
                                    <div className="pb-6 pt-0 space-y-4 animate-in slide-in-from-top-2 duration-200">
                                        <div className="space-y-4">

                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Product Name</label>
                                                <input
                                                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-100 outline-none transition-all hover:border-slate-300 placeholder:font-normal"
                                                    value={configState.name}
                                                    onChange={e => setConfigState({ ...configState, name: e.target.value })}
                                                    placeholder="e.g. Solar Panel X500"
                                                />
                                            </div>

                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Brief Description</label>
                                                <textarea
                                                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 focus:ring-2 focus:ring-indigo-100 outline-none transition-all resize-none h-20 hover:border-slate-300 placeholder:font-normal"
                                                    value={configState.description}
                                                    onChange={e => setConfigState({ ...configState, description: e.target.value })}
                                                    placeholder="Describe the product context..."
                                                />
                                            </div>

                                            <div className="relative group/field">
                                                <div className="absolute left-3 top-2 text-[10px] font-black text-slate-500 uppercase tracking-tighter z-10">Product Image</div>
                                                <div className="w-full bg-slate-50 border-none rounded-xl px-3 pt-6 pb-3 space-y-3">
                                                    {/* Image Preview */}
                                                    {configState.image && (
                                                        <div
                                                            className="w-full h-32 rounded-lg bg-white border border-slate-100 overflow-hidden shadow-sm"
                                                            style={{
                                                                backgroundImage: `url(${configState.image})`,
                                                                backgroundSize: configState.imageFit === 'tile' ? 'auto' :
                                                                    configState.imageFit === 'fill' ? '100% 100%' : configState.imageFit,
                                                                backgroundPosition: 'center',
                                                                backgroundRepeat: configState.imageFit === 'tile' ? 'repeat' : 'no-repeat',
                                                            }}
                                                        />
                                                    )}

                                                    {/* Fit Mode Selector */}
                                                    {configState.image && (
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Fit:</span>
                                                            <div className="flex gap-1">
                                                                {[
                                                                    { value: 'cover', label: '填充', icon: 'Fill' },
                                                                    { value: 'contain', label: '合适', icon: 'Fit' },
                                                                    { value: 'fill', label: '拉伸', icon: 'Stretch' },
                                                                    { value: 'tile', label: '平铺', icon: 'Tile' },
                                                                ].map(opt => (
                                                                    <button
                                                                        key={opt.value}
                                                                        onClick={() => setConfigState({ ...configState, imageFit: opt.value as any })}
                                                                        className={`px-2 py-1 rounded-md text-[9px] font-bold transition-all ${configState.imageFit === opt.value
                                                                            ? 'bg-indigo-600 text-white shadow-sm'
                                                                            : 'bg-white text-slate-500 border border-slate-200 hover:border-indigo-200 hover:text-indigo-600'
                                                                            }`}
                                                                    >
                                                                        {opt.label}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Upload Controls */}
                                                    <div className="flex items-center gap-3">
                                                        <input
                                                            value={configState.image}
                                                            onChange={e => setConfigState({ ...configState, image: e.target.value })}
                                                            placeholder="Image URL..."
                                                            className="flex-1 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] font-mono text-slate-500 outline-none focus:ring-1 focus:ring-indigo-200"
                                                        />
                                                        <label className="text-[9px] text-indigo-500 font-bold cursor-pointer hover:underline flex items-center gap-1 px-2 py-1.5 bg-white border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors">
                                                            <Upload size={10} /> Upload
                                                            <input
                                                                type="file"
                                                                className="hidden"
                                                                accept="image/*"
                                                                onChange={(e) => {
                                                                    const file = e.target.files?.[0];
                                                                    if (file) {
                                                                        const reader = new FileReader();
                                                                        reader.onloadend = () => {
                                                                            setConfigState({ ...configState, image: reader.result as string });
                                                                        };
                                                                        reader.readAsDataURL(file);
                                                                    }
                                                                }}
                                                            />
                                                        </label>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Save Action Sticky Footer Area */}
                        <div className="pt-4 border-t border-slate-100 flex-shrink-0 min-h-[100px] flex flex-col justify-center">
                            {isConfigComplete ? (
                                <div className="animate-in zoom-in-95 duration-300">
                                    <button
                                        onClick={handleSaveProduct}
                                        className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-3 active:scale-[0.98] group border-none"
                                    >
                                        <Save size={16} className="text-white/80 group-hover:scale-110 transition-transform" />
                                        <span>Save into Library</span>
                                    </button>
                                    <p className="text-center text-[9px] text-slate-400 mt-3 font-medium flex items-center justify-center gap-1 uppercase tracking-widest opacity-60">
                                        Ready to publish
                                    </p>
                                </div>
                            ) : (
                                <div className="p-4 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                                    <div className="flex items-start gap-3">
                                        <div className="p-1.5 bg-slate-100 rounded-lg text-slate-400">
                                            <Info size={14} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-tight">Pending Configuration</p>
                                            <p className="text-[9px] text-slate-400 mt-0.5">Please complete: <span className="text-indigo-500 font-bold">{missingSteps.join(', ')}</span></p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Resize Handle */}
                <div
                    onMouseDown={handleSidebarResizeStart}
                    className="w-1.5 hover:w-2 bg-transparent hover:bg-indigo-400/30 cursor-col-resize flex-shrink-0 transition-all z-20 group relative -ml-0.5"
                >
                    <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1px] bg-slate-100 group-hover:bg-indigo-300"></div>
                </div>

                {/* Right: Live Preview */}
                <div className="flex-1 bg-slate-50/50 p-8 overflow-hidden flex flex-col">
                    <div className="flex items-center justify-between mb-6 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400">
                                <Eye size={16} />
                            </div>
                            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Live BOM Preview</h3>
                        </div>
                        <div className="flex items-center gap-3">
                            {/* Column Toggle Menu */}
                            {configState.datasetId && (
                                <div className="relative group/cols z-30">
                                    <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm">
                                        <Columns size={14} />
                                        <span>Columns</span>
                                    </button>
                                    <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 p-2 opacity-0 invisible group-hover/cols:opacity-100 group-hover/cols:visible transition-all transform origin-top-right">
                                        <div className="mb-2 px-2 py-1 border-b border-gray-50 flex justify-between items-center">
                                            <span className="text-[10px] font-bold uppercase text-gray-400">Toggle Fields</span>
                                            <button
                                                onClick={() => setProductConfigHiddenFields([])}
                                                className="text-[10px] font-bold text-indigo-500 hover:text-indigo-600"
                                            >
                                                Reset
                                            </button>
                                        </div>
                                        <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-0.5">
                                            {selectedDataset && selectedDataset.schema
                                                .filter(f => !['divider', 'spacer', 'notice'].includes(f.type))
                                                .map(f => (
                                                    <label key={f.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            className="rounded text-indigo-500 focus:ring-indigo-500/20 border-gray-300 w-3.5 h-3.5"
                                                            checked={!productConfigHiddenFields.includes(f.id)}
                                                            onChange={(e) => {
                                                                if (e.target.checked) setProductConfigHiddenFields(prev => prev.filter(id => id !== f.id));
                                                                else setProductConfigHiddenFields(prev => [...prev, f.id]);
                                                            }}
                                                        />
                                                        <span className={`text-xs font-medium truncate ${productConfigHiddenFields.includes(f.id) ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{f.label}</span>
                                                    </label>
                                                ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {configState.datasetId && (
                                <span className={`text-[10px] font-bold px-3 py-1 rounded-full border transition-all ${configState.viewNames.length > 0 ? 'text-indigo-600 bg-indigo-50 border-indigo-100' : 'text-slate-500 bg-slate-100 border-slate-200'}`}>
                                    {configState.viewNames.length > 0
                                        ? `Active Filters: ${configState.viewNames.join(' + ')}`
                                        : 'Full Dataset (Raw)'}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative min-h-0">
                        {configState.datasetId ? (
                            <div className="absolute inset-0 overflow-auto custom-scrollbar">
                                {renderBOMTable(configState.datasetId, configState.viewNames || [], productConfigHiddenFields, configState.configRules || [])}
                            </div>
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300">
                                <div className="w-20 h-20 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mb-4">
                                    <TableIcon size={32} />
                                </div>
                                <p className="font-medium text-sm">Select a Data Source to preview BOM</p>
                            </div>
                        )}
                    </div>
                    <p className="mt-4 text-center text-[10px] text-slate-400 font-medium shrink-0">BOM Engine v2.4 • Real-time Data Binding</p>
                </div>
            </div>
        );
    };

    const renderProductLibrary = () => {
        if (selectedProductId) {
            return renderProductDetail(selectedProductId);
        }

        return (
            <div className="h-full flex flex-col animate-in fade-in duration-500">
                {/* Header */}
                <div className="px-10 py-8 flex justify-between items-end bg-white border-b border-gray-100 sticky top-0 z-10">
                    <div>
                        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Product Library</h2>
                        <p className="text-xs text-slate-500 mt-2 font-medium uppercase tracking-wider">Catalog of Configured BOMs</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="relative group">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                            <input
                                className="pl-9 pr-4 py-2 bg-slate-50 border-none rounded-full text-xs font-bold text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all outline-none w-48 focus:w-64"
                                placeholder="Search products..."
                            />
                        </div>
                        <div className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-full text-[10px] font-bold">
                            {products.length} Items
                        </div>
                    </div>
                </div>

                {/* Grid */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-10">
                    {products.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {products.map(p => (
                                <div
                                    key={p.id}
                                    onClick={() => setSelectedProductId(p.id)}
                                    className="bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-xl hover:shadow-indigo-900/5 hover:-translate-y-1 hover:border-indigo-100 transition-all group cursor-pointer relative"
                                >
                                    {/* Image Area */}
                                    <div className="h-40 bg-slate-50 relative overflow-hidden flex items-center justify-center">
                                        {p.image ? (
                                            <img src={p.image} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt={p.name} />
                                        ) : (
                                            <Box size={40} className="text-slate-200 group-hover:text-indigo-200 transition-colors" />
                                        )}
                                        {/* Overlay Actions */}
                                        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-all translate-y-1 group-hover:translate-y-0">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    triggerConfirm(
                                                        '删除产品',
                                                        `确定要删除产品 "${p.name}" 吗？此操作无法撤销。`,
                                                        () => {
                                                            setProducts(products.filter(item => item.id !== p.id));
                                                            addToast(`Product "${p.name}" deleted`, 'success');
                                                        },
                                                        'danger',
                                                        '确认删除'
                                                    );
                                                }}
                                                className="p-2 bg-white/90 text-rose-500 rounded-lg shadow-sm hover:bg-rose-500 hover:text-white transition-all"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Content Area */}
                                    <div className="p-4">
                                        <h4 className="font-bold text-[13px] text-slate-800 truncate group-hover:text-indigo-600 transition-colors mb-1">{p.name}</h4>
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                                                <Layers size={10} />
                                                <span>{p.configRules?.length || 0} Rules</span>
                                            </div>
                                            <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                                                <Filter size={10} />
                                                <span>{p.viewNames?.length || 0} Views</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center pb-20">
                            <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6 text-slate-200 border-2 border-dashed border-slate-100">
                                <Package size={48} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-700">Library is Empty</h3>
                            <p className="text-sm text-slate-400 mb-8 mt-2 max-w-xs mx-auto">Configure your first product in the "Define" tab to see it here.</p>
                            <button
                                onClick={() => setProductSubTab('config')}
                                className="px-6 py-2.5 bg-indigo-600 text-white rounded-full text-xs font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95"
                            >
                                Create Product
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderProductDetail = (productId: string) => {
        const product = products.find(p => p.id === productId);
        if (!product) return null;

        return (
            <div className="h-full flex flex-col bg-white animate-in slide-in-from-right duration-500 z-20 absolute inset-0">
                {/* Navbar */}
                <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 bg-white/80 backdrop-blur-sm sticky top-0 z-30">
                    <button
                        onClick={() => setSelectedProductId(null)}
                        className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-indigo-600 hover:bg-slate-50 px-3 py-2 rounded-lg transition-all"
                    >
                        <ChevronLeft size={16} />
                        <span>Back to Library</span>
                    </button>
                    <div className="flex items-center gap-2">
                        <span className="px-2 py-1 bg-green-50 text-green-600 border border-green-100 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div> Active
                        </span>
                        <span className="text-[10px] font-mono text-slate-300">ID: {product.id}</span>
                    </div>
                </div>

                <div className="flex-1 overflow-auto custom-scrollbar">
                    {/* Hero Section */}
                    <div className="max-w-7xl mx-auto p-10">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                            {/* Left: Image */}
                            <div className="lg:col-span-5">
                                <div className="aspect-square rounded-3xl overflow-hidden relative group">
                                    {product.image ? (
                                        <img src={product.image} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" alt={product.name} />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-100 bg-slate-50/50">
                                            <Box size={80} className="" />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Right: Info & Order */}
                            <div className="lg:col-span-7 flex flex-col justify-center">
                                <h1 className="text-4xl font-black text-slate-900 mb-4 tracking-tight leading-tight">{product.name}</h1>
                                <p className="text-lg text-slate-500 mb-8 leading-relaxed font-medium max-w-2xl">
                                    {product.description || 'No description provided for this product configuration.'}
                                </p>

                                <div className="grid grid-cols-2 gap-8 mb-10 max-w-lg">
                                    <div>
                                        <div className="text-[10px] uppercase font-bold text-slate-400 mb-2 tracking-widest">Source Dataset</div>
                                        <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                            <Database size={16} className="text-indigo-500" />
                                            {savedDatasets.find(d => d.id === product.datasetId)?.name || 'Unknown'}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] uppercase font-bold text-slate-400 mb-2 tracking-widest">Configuration View</div>
                                        <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                            <Filter size={16} className="text-indigo-500" />
                                            {product.viewNames?.join(', ') || 'Full Dataset'}
                                        </div>
                                    </div>
                                </div>

                                {/* Unified Configuration Rules Display */}
                                {(product as any).configRules?.length > 0 && (
                                    <div className="mb-12 max-w-lg pl-6 border-l-4 border-indigo-500/20 hover:border-indigo-500 transition-colors duration-500">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm font-bold text-slate-900">Configuration Rules</span>
                                                <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">{(product as any).configRules.length}</span>
                                            </div>
                                        </div>

                                        {/* Minimalist Integrated Tabs */}
                                        {(product as any).configRules.length > 1 && (
                                            <div className="flex items-center gap-6 border-b border-slate-100 mb-5 overflow-x-auto no-scrollbar">
                                                {(product as any).configRules.map((r: any, idx: number) => {
                                                    const tabLabel = r.title || r.description?.substring(0, 10) || `Rule ${idx + 1}`;
                                                    const isActive = activeRuleTab === idx;
                                                    const isEditing = editingRuleTab?.index === idx;

                                                    if (isEditing) {
                                                        return (
                                                            <input
                                                                key={idx}
                                                                autoFocus
                                                                value={editingRuleTab.value}
                                                                onChange={(e) => setEditingRuleTab({ ...editingRuleTab, value: e.target.value })}
                                                                onBlur={() => {
                                                                    if (editingRuleTab.value.trim()) {
                                                                        setProducts(prev => prev.map(p => {
                                                                            if (p.id === product.id) {
                                                                                const newRules = [...(p as any).configRules];
                                                                                newRules[idx] = { ...newRules[idx], title: editingRuleTab.value.trim() };
                                                                                return { ...p, configRules: newRules };
                                                                            }
                                                                            return p;
                                                                        }));
                                                                    }
                                                                    setEditingRuleTab(null);
                                                                }}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        e.preventDefault();
                                                                        e.currentTarget.blur();
                                                                    }
                                                                }}
                                                                className="w-24 px-1 py-0.5 mt-0.5 mb-2 text-xs font-bold text-slate-900 bg-white border border-indigo-200 rounded outline-none ring-1 ring-indigo-500/20"
                                                            />
                                                        );
                                                    }

                                                    return (
                                                        <button
                                                            key={idx}
                                                            onClick={() => setActiveRuleTab(idx)}
                                                            onDoubleClick={(e) => {
                                                                e.stopPropagation();
                                                                setEditingRuleTab({ index: idx, value: r.title || tabLabel });
                                                            }}
                                                            className={`pb-2.5 text-xs font-bold whitespace-nowrap transition-all relative px-1 ${isActive
                                                                ? 'text-indigo-600'
                                                                : 'text-slate-400 hover:text-slate-600'
                                                                }`}
                                                        >
                                                            {tabLabel.length > 15 ? tabLabel.substring(0, 15) + '...' : tabLabel}
                                                            {isActive && (
                                                                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-t-full" />
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* Clean Content Area */}
                                        <div>
                                            {(product as any).configRules.map((rule: any, i: number) => {
                                                if ((product as any).configRules.length > 1 && activeRuleTab !== i) return null;
                                                return (
                                                    <div key={i} className="animate-in fade-in slide-in-from-bottom-1 duration-300">
                                                        {rule.description && (
                                                            <div className="mb-4 text-xs text-slate-500 italic flex items-start gap-2">
                                                                <Info size={14} className="mt-0.5 text-slate-400 shrink-0" />
                                                                <span>{rule.description}</span>
                                                            </div>
                                                        )}

                                                        {rule.ruleType === 'mapping' ? (
                                                            <div className="space-y-4">
                                                                {/* Rule Summary Header */}
                                                                <div className="p-3 bg-gradient-to-br from-indigo-50 to-slate-50 rounded-lg border border-indigo-100">
                                                                    <div className="flex flex-wrap items-center gap-2 text-xs mb-2">
                                                                        <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">级联映射</span>
                                                                        {rule.syncMode && (
                                                                            <span className="text-[8px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded-full">🔗 同步模式</span>
                                                                        )}
                                                                        <span className="text-[9px] text-slate-400">
                                                                            {rule.cascadeGroups?.length || 0} 个级联组
                                                                        </span>
                                                                    </div>

                                                                    {/* Quick Summary of All Groups */}
                                                                    <div className="text-[10px] text-slate-500 flex flex-wrap gap-2">
                                                                        {rule.cascadeGroups?.map((cg: any, idx: number) => (
                                                                            <span key={idx} className="bg-white px-2 py-0.5 rounded border border-slate-200 flex items-center gap-1">
                                                                                <span className="text-indigo-500 font-bold">#{idx + 1}</span>
                                                                                <span className="text-slate-600">{cg.sourceField}</span>
                                                                                <ArrowRight size={8} className="text-slate-300" />
                                                                                <span className="text-slate-600">{cg.targetField}</span>
                                                                                {cg.sourceRowId && <span className="text-amber-500">📍</span>}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                </div>

                                                                {/* Cascade Groups Display - Main Content */}
                                                                {rule.cascadeGroups && rule.cascadeGroups.length > 0 && (
                                                                    <div className="space-y-3">
                                                                        <div className="text-[10px] text-indigo-500 font-bold uppercase flex items-center gap-1.5">
                                                                            <Layers size={10} /> 点击选项应用映射
                                                                        </div>
                                                                        {rule.cascadeGroups.map((cg: any, cgIdx: number) => {
                                                                            const ds = savedDatasets.find(d => d.id === product.datasetId);
                                                                            // Use cascade group's own sourceRowId, fallback to first record
                                                                            const groupRowId = cg.sourceRowId || (ds?.records[0]?._id);

                                                                            return (
                                                                                <div key={cgIdx} className="pl-3 border-l-2 border-indigo-100 space-y-1.5">
                                                                                    <div className="text-[10px] text-indigo-400 font-bold flex items-center gap-2">
                                                                                        <span className="bg-indigo-50 px-1.5 py-0.5 rounded">#{cgIdx + 1}</span>
                                                                                        <span>{cg.sourceField}</span>
                                                                                        <ArrowRight size={10} />
                                                                                        <span>{cg.targetField}</span>
                                                                                        {cg.sourceRowId && (
                                                                                            <span className="text-[8px] bg-amber-50 text-amber-600 px-1 py-0.5 rounded border border-amber-100">📍 指定行</span>
                                                                                        )}
                                                                                    </div>
                                                                                    <div className="flex flex-wrap gap-1.5">
                                                                                        {cg.mappings?.map((cm: any, cmIdx: number) => {
                                                                                            const isSelected = groupRowId && previewOverrides[groupRowId]?.[cg.sourceField] === cm.sourceValue;

                                                                                            return (
                                                                                                <button
                                                                                                    key={cmIdx}
                                                                                                    onClick={() => {
                                                                                                        const ds = savedDatasets.find(d => d.id === product.datasetId);
                                                                                                        const defaultRowId = ds?.records[0]?._id;

                                                                                                        // Collect updates per row to handle multi-row sync correctly
                                                                                                        const updatesByRow: Record<string, any> = {};
                                                                                                        const mergeUpdate = (rId: string | undefined, update: any) => {
                                                                                                            const target = rId || defaultRowId;
                                                                                                            if (target) {
                                                                                                                updatesByRow[target] = { ...(updatesByRow[target] || {}), ...update };
                                                                                                            }
                                                                                                        };

                                                                                                        // 1. Update current group
                                                                                                        mergeUpdate(cg.sourceRowId, {
                                                                                                            [cg.sourceField]: cm.sourceValue,
                                                                                                            [cg.targetField]: cm.targetValue
                                                                                                        });

                                                                                                        // 2. Sync Mode: Update other groups
                                                                                                        if (rule.syncMode) {
                                                                                                            rule.cascadeGroups.forEach((otherCg: any) => {
                                                                                                                if (otherCg.mappings[cmIdx]) {
                                                                                                                    mergeUpdate(otherCg.sourceRowId, {
                                                                                                                        [otherCg.sourceField]: otherCg.mappings[cmIdx].sourceValue,
                                                                                                                        [otherCg.targetField]: otherCg.mappings[cmIdx].targetValue
                                                                                                                    });
                                                                                                                }
                                                                                                            });
                                                                                                        }

                                                                                                        // 3. Apply to overrides
                                                                                                        setPreviewOverrides(prev => {
                                                                                                            const next = { ...prev };
                                                                                                            Object.entries(updatesByRow).forEach(([rId, up]) => {
                                                                                                                next[rId] = { ...(next[rId] || {}), ...up };
                                                                                                            });
                                                                                                            return next;
                                                                                                        });
                                                                                                    }}
                                                                                                    className={`flex items-center rounded px-2 py-1 text-[10px] transition-all border ${isSelected
                                                                                                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200 font-bold'
                                                                                                        : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-200'
                                                                                                        }`}
                                                                                                >
                                                                                                    <span>{cm.sourceValue}</span>
                                                                                                    <ArrowRight size={8} className="mx-1 text-slate-300" />
                                                                                                    <span className="text-slate-500">{cm.targetValue}</span>
                                                                                                </button>
                                                                                            );
                                                                                        })}
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-col gap-3">
                                                                <div className="flex items-center gap-2 text-xs">
                                                                    <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase">Logic</span>
                                                                    <span className="text-slate-400">If</span>
                                                                    <div className="flex flex-wrap gap-1">
                                                                        {rule.conditions?.map((c: any, ci: number) => (
                                                                            <span key={ci} className="bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-600 font-medium text-[11px]">
                                                                                {c.fieldId} {c.operator} {c.value}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2 text-xs pt-2 border-t border-slate-100 mt-1">
                                                                    <span className="text-slate-400">Set</span>
                                                                    <b className="text-slate-800">{rule.targetField}</b>
                                                                    <span className="text-slate-400">=</span>
                                                                    <span className="text-indigo-600 font-bold bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">{rule.expression}</span>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center gap-6 w-fit">
                                    {/* Quantity Controls */}
                                    <div className="flex items-center gap-3 pl-2">
                                        <div className="flex items-center gap-1 bg-slate-50 rounded-lg p-1">
                                            <button onClick={() => setOrderQuantity(Math.max(1, orderQuantity - 1))} className="w-8 h-8 rounded-md hover:bg-white hover:shadow-sm text-slate-500 flex items-center justify-center transition-all font-bold"><Minus size={14} /></button>
                                            <input
                                                type="number"
                                                value={orderQuantity}
                                                onChange={(e) => setOrderQuantity(parseInt(e.target.value) || 1)}
                                                className="w-10 text-center text-sm font-black text-slate-700 outline-none border-none bg-transparent"
                                            />
                                            <button onClick={() => setOrderQuantity(orderQuantity + 1)} className="w-8 h-8 rounded-md hover:bg-white hover:shadow-sm text-slate-500 flex items-center justify-center transition-all font-bold"><Plus size={14} /></button>
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Quantity</span>
                                    </div>

                                    {/* Place Order Button */}
                                    <button
                                        onClick={() => {
                                            const order = { id: `ord_${Date.now()}`, productId: product.id, quantity: orderQuantity, timestamp: Date.now() };
                                            setProductOrders([...productOrders, order]);

                                            // Trigger Export
                                            handleExportBOM(
                                                product.datasetId,
                                                product.viewNames || [],
                                                [],
                                                (product as any).configRules || [],
                                                orderQuantity
                                            );

                                            addToast('Order Placed & BOM Exported', 'success');
                                        }}
                                        className="h-[48px] px-8 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl font-bold hover:bg-indigo-100 hover:border-indigo-200 transition-all active:scale-95 flex items-center gap-2"
                                    >
                                        <ShoppingCart size={18} /> Place Order
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* BOM Table Section */}
                        <div className="mt-16">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-bold text-slate-900">BOM Architecture</h3>
                                <button className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors">
                                    <Download size={14} /> Export CSV
                                </button>
                            </div>
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[300px]">
                                <div className="overflow-auto max-h-[600px] custom-scrollbar">
                                    {renderBOMTable(product.datasetId, product.viewNames || [], [], (product as any).configRules || [], orderQuantity)}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const handleExportSystemData = () => {
        const payload = {
            version: '1.0',
            timestamp: Date.now(),
            data: {
                products,
                savedDatasets,
                savedViews,
                savedRulePresets,
                activeProjects,
                activeTeamMembers,
                namingRules
            }
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `GenPM_Config_Export_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        addToast('System Data Exported Successfully', 'success');
    };



    // --- Naming Builder Handlers ---
    const handleDragStart = (e: React.DragEvent, type: NamingRuleType, value: string, label: string, variableId?: string, fromIndex?: number) => {
        e.dataTransfer.setData('application/json', JSON.stringify({ type, value, label, variableId, fromIndex }));
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: React.DragEvent, targetIndex?: number) => {
        e.preventDefault();
        e.stopPropagation(); // Prevent bubbling to the canvas if dropping on a specific capsule
        const data = e.dataTransfer.getData('application/json');
        if (!data) return;
        const item = JSON.parse(data);

        const rect = e.currentTarget.getBoundingClientRect();
        const isRightSide = e.clientX > rect.left + rect.width / 2;

        setNamingRules(prev => {
            const newRules = [...prev];
            // Determine where to insert based on side detection
            let insertIdx = targetIndex !== undefined ? (isRightSide ? targetIndex + 1 : targetIndex) : newRules.length;

            if (item.fromIndex !== undefined) {
                // Internal Move (Reordering)
                const movedItem = newRules[item.fromIndex];
                newRules.splice(item.fromIndex, 1);
                // Adjust if moving from before the insertion point
                if (item.fromIndex < insertIdx) insertIdx--;
                newRules.splice(insertIdx, 0, movedItem);
            } else {
                // External Add from Library
                newRules.splice(insertIdx, 0, { id: Date.now().toString(), ...item });
            }
            return newRules;
        });
    };

    const removeRule = (id: string) => {
        setNamingRules(prev => prev.filter(r => r.id !== id));
    };

    const handleImportSystemData = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const payload = JSON.parse(event.target?.result as string);
                if (payload.data) {
                    if (payload.data.products) setProducts(payload.data.products);
                    if (payload.data.savedDatasets) setSavedDatasets(payload.data.savedDatasets);
                    if (payload.data.savedViews) setSavedViews(payload.data.savedViews);
                    if (payload.data.savedRulePresets) setSavedRulePresets(payload.data.savedRulePresets);
                    // Projects and Teams are managed globally, skipping import to avoid conflict
                    if (payload.data.namingRules) setNamingRules(payload.data.namingRules);

                    addToast('System Data Imported Successfully', 'success');
                } else {
                    addToast('Invalid File Format', 'error');
                }
            } catch (err) {
                console.error(err);
                addToast('Failed to parse import file', 'error');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    const renderProductSettings = () => (
        <div className="p-12 max-w-5xl mx-auto animate-in fade-in duration-500 pb-32">
            <div className="mb-12">
                <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">System Settings</h2>
                <p className="text-slate-500 mt-2 font-medium">Manage global data and export configurations.</p>
            </div>

            <div className="grid grid-cols-1 gap-12">
                {/* Data Management Section */}
                <section className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-xl shadow-slate-200/50">
                    <h4 className="text-sm font-black text-indigo-600 uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
                        <Database size={14} /> Data Management
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                            <h5 className="font-bold text-slate-900 mb-2">Export Configuration</h5>
                            <p className="text-xs text-slate-500 mb-6">Backup all products, rules, datasets, and settings to a JSON file.</p>
                            <button
                                onClick={handleExportSystemData}
                                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
                            >
                                <Download size={16} /> Export JSON
                            </button>
                        </div>
                        <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                            <h5 className="font-bold text-slate-900 mb-2">Import Configuration</h5>
                            <p className="text-xs text-slate-500 mb-6">Restore system data from a backup JSON file.</p>
                            <input
                                type="file"
                                ref={dataImportInputRef}
                                className="hidden"
                                accept=".json"
                                onChange={handleImportSystemData}
                            />
                            <button
                                onClick={() => dataImportInputRef.current?.click()}
                                className="w-full py-3 bg-white border-2 border-slate-200 hover:border-indigo-400 hover:text-indigo-600 text-slate-600 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                            >
                                <Upload size={16} /> Import JSON
                            </button>
                        </div>
                    </div>
                </section>

                {/* Naming Rules Section - Visual Builder */}
                <section className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-xl shadow-slate-200/50">
                    {/* Collapsible Header */}
                    <div
                        className="flex items-center justify-between cursor-pointer group"
                        onClick={() => setIsNamingBuilderCollapsed(!isNamingBuilderCollapsed)}
                    >
                        <h4 className="text-sm font-black text-rose-600 uppercase tracking-[0.2em] flex items-center gap-2">
                            <Tag size={14} /> Naming Rule Builder
                            <ChevronDown
                                size={16}
                                className={`text-slate-400 transition-transform duration-300 ${isNamingBuilderCollapsed ? '-rotate-90' : ''}`}
                            />
                        </h4>

                        <div className="flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
                            {/* Library Toggle Button */}
                            <button
                                onClick={() => setIsShowingLibrary(!isShowingLibrary)}
                                className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 px-3 py-1.5 rounded-lg border transition-colors ${isShowingLibrary
                                    ? 'bg-amber-100 text-amber-700 border-amber-200'
                                    : 'bg-slate-50 text-slate-500 border-slate-100 hover:border-amber-200 hover:text-amber-600'
                                    }`}
                            >
                                <Bookmark size={12} /> 规则库
                            </button>

                            {/* Interactive Export Mode Toggle */}
                            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                                <span className={`text-[10px] font-bold uppercase tracking-wider transition-colors ${namingInteractiveMode ? 'text-indigo-600' : 'text-slate-400'}`}>
                                    导出时完善命名
                                </span>
                                <button
                                    onClick={() => setNamingInteractiveMode(!namingInteractiveMode)}
                                    className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${namingInteractiveMode ? 'bg-indigo-500' : 'bg-slate-300'}`}
                                >
                                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${namingInteractiveMode ? 'translate-x-4' : 'translate-x-0'}`} />
                                </button>
                            </div>

                            {/* Inline Variable Creator Toggle */}
                            {!isCreatingVariable ? (
                                <button
                                    onClick={() => setIsCreatingVariable(true)}
                                    className="text-[10px] font-bold text-indigo-500 hover:text-indigo-700 uppercase tracking-wider flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 transition-colors"
                                >
                                    <Plus size={12} /> New List Variable
                                </button>
                            ) : (
                                <div className="flex items-center gap-3 animate-in fade-in slide-in-from-right-4 duration-300">
                                    <button onClick={() => { setIsCreatingVariable(false); setNewVariableName(''); setNewVariableOptions([]); }} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">New Variable</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Collapsible Content */}
                    {!isNamingBuilderCollapsed && (
                        <div className="mt-8 animate-in fade-in slide-in-from-top-2 duration-300">

                            {/* Inline Creator Workspace */}
                            {isCreatingVariable && (
                                <div className="mb-8 p-6 bg-indigo-50/50 rounded-3xl border border-indigo-100 animate-in zoom-in-95 duration-300">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-extrabold text-indigo-400 uppercase tracking-widest block pl-1">Variable Name</label>
                                            <input
                                                type="text"
                                                value={newVariableName}
                                                onChange={(e) => setNewVariableName(e.target.value)}
                                                placeholder="e.g. Status, Phase, Model"
                                                className="w-full bg-white border border-indigo-200 rounded-xl px-4 py-2 text-sm font-bold outline-none focus:border-indigo-500 transition-colors"
                                            />
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-extrabold text-indigo-400 uppercase tracking-widest block pl-1">Add Options (Values)</label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={currentOptionInput}
                                                    onChange={(e) => setCurrentOptionInput(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' && currentOptionInput.trim()) {
                                                            setNewVariableOptions(prev => [...prev, currentOptionInput.trim()]);
                                                            setCurrentOptionInput('');
                                                        }
                                                    }}
                                                    placeholder="Type and press Enter..."
                                                    className="flex-1 bg-white border border-indigo-200 rounded-xl px-4 py-2 text-sm font-bold outline-none focus:border-indigo-500 transition-colors"
                                                />
                                                <button
                                                    onClick={() => {
                                                        if (currentOptionInput.trim()) {
                                                            setNewVariableOptions(prev => [...prev, currentOptionInput.trim()]);
                                                            setCurrentOptionInput('');
                                                        }
                                                    }}
                                                    className="px-4 py-2 bg-indigo-500 text-white rounded-xl font-bold text-xs"
                                                >Add</button>
                                            </div>
                                            {/* Option Tags */}
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                {newVariableOptions.map((opt, i) => (
                                                    <span key={i} className="flex items-center gap-1 bg-white border border-indigo-100 px-2 py-1 rounded-lg text-xs font-bold text-indigo-600">
                                                        {opt}
                                                        <button onClick={() => setNewVariableOptions(prev => prev.filter((_, idx) => idx !== i))}><X size={10} /></button>
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-6 flex justify-end">
                                        <button
                                            disabled={!newVariableName || newVariableOptions.length === 0}
                                            onClick={() => {
                                                setNamingVariables(prev => [...prev, {
                                                    id: Date.now().toString(),
                                                    name: newVariableName,
                                                    type: 'select',
                                                    options: newVariableOptions,
                                                    defaultValue: newVariableOptions[0]
                                                }]);
                                                setIsCreatingVariable(false);
                                                setNewVariableName('');
                                                setNewVariableOptions([]);
                                            }}
                                            className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
                                        >
                                            Create Variable Library Item
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Preview Area - Light Background */}
                            <div className="mb-8 bg-gradient-to-r from-slate-50 to-indigo-50 rounded-2xl p-6 relative overflow-hidden group border border-slate-200">
                                <div className="absolute top-0 right-0 p-4 opacity-20"><FileText className="text-indigo-600 w-12 h-12 rotate-12" /></div>
                                <span className="text-[10px] uppercase font-bold text-slate-500 mb-2 block tracking-widest">Real-time Preview 实时预览</span>
                                <div className="font-mono text-lg text-indigo-700 font-medium truncate">
                                    {namingRules.length > 0 ? namingRules.map(r => {
                                        if (r.type === 'project') return '[ProjectName]';
                                        if (r.type === 'personnel') return '[User]';
                                        if (r.type === 'date') return '2025-10-24';
                                        if (r.type === 'quantity') return '100';
                                        if (r.type === 'variable') return `[${r.label}]`;
                                        return r.value;
                                    }).join('') : 'Empty_Rule_Set'}.xlsx
                                </div>
                            </div>

                            {/* Naming Rule Library Panel */}
                            {isShowingLibrary && (
                                <div className="mb-8 bg-amber-50/50 rounded-2xl border border-amber-200 p-6 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="flex items-center justify-between mb-4">
                                        <h5 className="text-sm font-bold text-amber-800 flex items-center gap-2">
                                            <Bookmark size={14} /> 命名规则库 Naming Rule Library
                                        </h5>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={newTemplateNameInput}
                                                onChange={(e) => setNewTemplateNameInput(e.target.value)}
                                                placeholder="模板名称..."
                                                className="px-3 py-1.5 text-xs border border-amber-200 rounded-lg bg-white focus:outline-none focus:border-amber-400 w-40"
                                            />
                                            <button
                                                onClick={() => {
                                                    if (namingRules.length > 0 && newTemplateNameInput.trim()) {
                                                        const newTemplate = {
                                                            id: Date.now().toString(),
                                                            name: newTemplateNameInput.trim(),
                                                            rules: [...namingRules],
                                                            variables: [...namingVariables],
                                                            createdAt: Date.now()
                                                        };
                                                        setNamingRuleLibrary(prev => [...prev, newTemplate]);
                                                        setNewTemplateNameInput('');
                                                        addToast('规则模板已保存', 'success');
                                                    }
                                                }}
                                                disabled={namingRules.length === 0 || !newTemplateNameInput.trim()}
                                                className="px-3 py-1.5 text-xs font-bold bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                            >
                                                <Save size={12} /> 保存当前规则
                                            </button>
                                        </div>
                                    </div>

                                    {/* Template List */}
                                    {namingRuleLibrary.length === 0 ? (
                                        <div className="text-center py-8 text-amber-400 text-sm italic">
                                            暂无保存的规则模板，请先创建命名规则后保存
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {namingRuleLibrary.map(template => (
                                                <div
                                                    key={template.id}
                                                    className={`flex items-center justify-between p-3 rounded-xl transition-all ${defaultNamingRuleId === template.id
                                                        ? 'bg-amber-100 border-2 border-amber-400'
                                                        : 'bg-white border border-amber-100 hover:border-amber-300'
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        {defaultNamingRuleId === template.id && (
                                                            <span className="flex items-center gap-1 text-[9px] font-black text-amber-600 bg-amber-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                                                <Star size={10} /> 默认
                                                            </span>
                                                        )}
                                                        <span className="font-bold text-slate-700">{template.name}</span>
                                                        <span className="text-[10px] text-slate-400">
                                                            {template.rules.length} 条规则 · {new Date(template.createdAt).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {/* Set as Default */}
                                                        <button
                                                            onClick={() => setDefaultNamingRuleId(defaultNamingRuleId === template.id ? null : template.id)}
                                                            className={`p-1.5 rounded-lg transition-colors ${defaultNamingRuleId === template.id
                                                                ? 'text-amber-600 bg-amber-200'
                                                                : 'text-slate-400 hover:text-amber-600 hover:bg-amber-100'
                                                                }`}
                                                            title={defaultNamingRuleId === template.id ? "取消默认" : "设为默认"}
                                                        >
                                                            <Star size={14} />
                                                        </button>
                                                        {/* Load Template */}
                                                        <button
                                                            onClick={() => {
                                                                setNamingRules(template.rules);
                                                                setNamingVariables(template.variables);
                                                                addToast('已加载规则模板', 'success');
                                                            }}
                                                            className="px-3 py-1 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                                                        >
                                                            加载
                                                        </button>
                                                        {/* Delete Template */}
                                                        <button
                                                            onClick={() => {
                                                                setNamingRuleLibrary(prev => prev.filter(t => t.id !== template.id));
                                                                if (defaultNamingRuleId === template.id) {
                                                                    setDefaultNamingRuleId(null);
                                                                }
                                                                addToast('规则模板已删除', 'info');
                                                            }}
                                                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Builder Canvas (Drop Zone) */}
                            <div
                                onDragOver={handleDragOver}
                                onDrop={handleDrop}
                                className="min-h-[120px] bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 p-6 flex flex-wrap gap-3 content-start transition-colors hover:border-indigo-300 hover:bg-slate-50/80"
                            >
                                {namingRules.length === 0 && (
                                    <div className="w-full h-full flex items-center justify-center text-slate-300 text-sm font-bold italic pointer-events-none">
                                        Drag capsules here to build your naming pattern...
                                    </div>
                                )}

                                {namingRules.map((rule, idx) => {
                                    const variableDefinition = rule.type === 'variable' ? namingVariables.find(v => v.id === rule.variableId) : null;

                                    return (
                                        <div
                                            key={rule.id}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, rule.type, rule.value, rule.label || '', rule.variableId, idx)}
                                            onDragOver={handleDragOver}
                                            onDrop={(e) => handleDrop(e, idx)}
                                            className={`
                                        group relative flex items-center pl-3 pr-2 py-1.5 rounded-full text-xs font-bold animate-in zoom-in-95 cursor-grab active:cursor-grabbing border shadow-sm select-none
                                        ${rule.type === 'separator' ? 'bg-white text-slate-600 border-slate-300' :
                                                    rule.type === 'variable' ? 'bg-purple-100 text-purple-700 border-purple-200' :
                                                        'bg-indigo-100 text-indigo-700 border-indigo-200'}
                                        hover:border-indigo-400 hover:ring-2 hover:ring-indigo-400/20 transition-all
                                        [&.dragging-over-left]:border-l-4 [&.dragging-over-left]:border-l-indigo-500
                                        [&.dragging-over-right]:border-r-4 [&.dragging-over-right]:border-r-indigo-500
                                    `}
                                            onDragEnter={(e) => {
                                                const rect = e.currentTarget.getBoundingClientRect();
                                                const isRight = e.clientX > rect.left + rect.width / 2;
                                                e.currentTarget.classList.add(isRight ? 'dragging-over-right' : 'dragging-over-left');
                                            }}
                                            onDragLeave={(e) => {
                                                e.currentTarget.classList.remove('dragging-over-left', 'dragging-over-right');
                                            }}
                                            onDragOverCapture={(e) => {
                                                const rect = e.currentTarget.getBoundingClientRect();
                                                const isRight = e.clientX > rect.left + rect.width / 2;
                                                e.currentTarget.classList.toggle('dragging-over-left', !isRight);
                                                e.currentTarget.classList.toggle('dragging-over-right', isRight);
                                            }}
                                        >
                                            <span className="mr-2 flex items-center gap-1.5">
                                                {rule.type === 'separator' ? rule.value : `{${rule.label}}`}
                                                {variableDefinition && variableDefinition.type === 'select' && (
                                                    <select
                                                        className="bg-purple-50 border-none text-[10px] font-black text-purple-800 focus:ring-0 cursor-pointer p-0 h-4 rounded"
                                                        value={rule.value}
                                                        onChange={(e) => {
                                                            const newVal = e.target.value;
                                                            setNamingRules(prev => prev.map(r => r.id === rule.id ? { ...r, value: newVal } : r));
                                                        }}
                                                    >
                                                        {variableDefinition.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                    </select>
                                                )}
                                                {variableDefinition && variableDefinition.type === 'text' && (
                                                    <input
                                                        className="bg-transparent border-b border-purple-300 w-16 text-[10px] focus:outline-none focus:border-purple-500 placeholder-purple-300"
                                                        value={rule.value}
                                                        placeholder="Value..."
                                                        onChange={(e) => {
                                                            const newVal = e.target.value;
                                                            setNamingRules(prev => prev.map(r => r.id === rule.id ? { ...r, value: newVal } : r));
                                                        }}
                                                    />
                                                )}
                                            </span>
                                            <button onClick={() => removeRule(rule.id)} className="p-0.5 rounded-full hover:bg-black/10 transition-colors">
                                                <X size={10} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Component Library */}
                            <div className="mt-8 space-y-6">
                                {/* System Variables */}
                                <div>
                                    <h5 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-3 pl-1">System Variables</h5>
                                    <div className="flex flex-wrap gap-2">
                                        {[
                                            { label: 'Product Name', type: 'product', value: 'product' },
                                            { label: 'Project Name', type: 'project', value: 'project' },
                                            { label: 'User Name', type: 'personnel', value: 'user' },
                                            { label: 'Date (YYYY-MM-DD)', type: 'date', value: 'date' },
                                            { label: 'Order Qty', type: 'quantity', value: 'qty' }
                                        ].map((item, i) => (
                                            <div
                                                key={i}
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, item.type as any, item.value, item.label)}
                                                className="bg-white border border-slate-200 px-3 py-1.5 rounded-full text-xs font-bold text-slate-600 shadow-sm cursor-grab hover:border-indigo-400 hover:text-indigo-600 transition-all select-none flex items-center gap-1.5"
                                            >
                                                <Bot size={12} className="text-indigo-400" />
                                                {item.label}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Custom Variables */}
                                <div>
                                    <h5 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-3 pl-1">Custom Lists</h5>
                                    <div className="flex flex-wrap gap-2">
                                        {namingVariables.length === 0 && <span className="text-xs text-slate-300 italic pl-1">No custom lists created yet.</span>}
                                        {namingVariables.map(v => (
                                            <div
                                                key={v.id}
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, 'variable', v.defaultValue, v.name, v.id)}
                                                className="bg-purple-50 border border-purple-100 px-3 py-1.5 rounded-full text-xs font-bold text-purple-600 shadow-sm cursor-grab hover:border-purple-300 transition-all select-none flex items-center gap-1.5 group"
                                            >
                                                <List size={12} className="text-purple-400" />
                                                {v.name}
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setNamingVariables(prev => prev.filter(p => p.id !== v.id)); }}
                                                    className="ml-1 text-purple-300 hover:text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <X size={10} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Separators */}
                                <div>
                                    <h5 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-3 pl-1">Separators</h5>
                                    <div className="flex flex-wrap gap-2">
                                        {['_', '-', '.', '+', 'Space'].map((sep, i) => (
                                            <div
                                                key={i}
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, 'separator', sep === 'Space' ? ' ' : sep, sep === 'Space' ? '__' : sep)}
                                                className="bg-slate-100 border border-slate-200 w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-slate-600 hover:bg-slate-200 cursor-grab select-none"
                                            >
                                                {sep === 'Space' ? '␣' : sep}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </section>
            </div>

            {/* Export Naming Dialog - 完善导出信息 */}
            {exportNamingDialog.open && (
                <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-black tracking-tight">完善导出信息</h3>
                                    <p className="text-indigo-100 text-xs font-medium mt-1 opacity-80">请为以下自定义变量选择具体值</p>
                                </div>
                                <div className="p-2.5 bg-white/10 rounded-xl">
                                    <FileText className="text-white" size={22} />
                                </div>
                            </div>
                        </div>

                        {/* Variable Selection Forms */}
                        <div className="p-6 space-y-5 max-h-[50vh] overflow-y-auto">
                            {namingRules.filter(r => r.type === 'variable').map(rule => {
                                const variableDef = namingVariables.find(v => v.id === rule.variableId);
                                if (!variableDef) return null;

                                const currentValue = exportNamingDialog.variableOverrides[rule.id] || variableDef.defaultValue;

                                return (
                                    <div key={rule.id} className="space-y-2">
                                        <label className="text-xs font-extrabold text-slate-500 uppercase tracking-widest pl-1 flex items-center gap-2">
                                            <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                                            {variableDef.name}
                                        </label>

                                        {/* Radio buttons for <=5 options, select dropdown for more */}
                                        {variableDef.options.length <= 5 ? (
                                            <div className="flex flex-wrap gap-2">
                                                {variableDef.options.map(opt => {
                                                    const isSelected = currentValue === opt;
                                                    return (
                                                        <button
                                                            key={opt}
                                                            onClick={() => setExportNamingDialog(prev => ({
                                                                ...prev,
                                                                variableOverrides: { ...prev.variableOverrides, [rule.id]: opt }
                                                            }))}
                                                            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all border-2 ${isSelected
                                                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200'
                                                                : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-400 hover:text-indigo-600'
                                                                }`}
                                                        >
                                                            {opt}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <select
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                                                value={currentValue}
                                                onChange={(e) => setExportNamingDialog(prev => ({
                                                    ...prev,
                                                    variableOverrides: { ...prev.variableOverrides, [rule.id]: e.target.value }
                                                }))}
                                            >
                                                {variableDef.options.map(opt => (
                                                    <option key={opt} value={opt}>{opt}</option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Real-time Filename Preview - Light Background */}
                        <div className="mx-6 mb-6 bg-gradient-to-r from-slate-50 to-indigo-50 rounded-xl p-4 border border-slate-200">
                            <span className="text-[10px] uppercase font-bold text-slate-500 mb-2 block tracking-widest">预计文件名 Preview</span>
                            <div className="font-mono text-sm text-indigo-700 font-medium break-all">
                                {generateFilename(exportNamingDialog.variableOverrides, 1)}.xlsx
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
                            <button
                                onClick={() => setExportNamingDialog({ open: false, variableOverrides: {}, exportParams: null })}
                                className="px-6 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                            >
                                取消
                            </button>
                            <button
                                onClick={() => {
                                    // Execute the export with selected overrides
                                    const { exportParams, variableOverrides } = exportNamingDialog;
                                    if (exportParams) {
                                        executeExport(
                                            exportParams.datasetId,
                                            exportParams.viewNames,
                                            exportParams.hiddenFields,
                                            exportParams.configRules,
                                            exportParams.quantityMultiplier,
                                            variableOverrides
                                        );
                                    }
                                    setExportNamingDialog({ open: false, variableOverrides: {}, exportParams: null });
                                }}
                                className="px-8 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center gap-2"
                            >
                                <Download size={14} /> 确定导出
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    const renderProductCenter = () => {
        return (
            <div className="flex flex-col flex-1 overflow-hidden animate-in fade-in duration-300">
                {/* Top Navigation Bar */}
                <div className="bg-white border-b border-gray-100 flex items-center justify-between px-6 py-3 shrink-0 z-20">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2 pr-6 border-r border-gray-100">
                            <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600">
                                <BoxSelect size={18} />
                            </div>
                            <span className="text-sm font-black text-slate-800 uppercase tracking-wide">Product Center</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => { setProductSubTab('config'); setSelectedProductId(null); }}
                                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all border ${productSubTab === 'config' ? 'bg-indigo-50 border-indigo-100 text-indigo-700' : 'bg-white border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
                            >
                                <Box size={14} className={productSubTab === 'config' ? 'text-indigo-600' : 'text-slate-400'} />
                                <span>Define Product</span>
                            </button>
                            <button
                                onClick={() => { setProductSubTab('library'); setSelectedProductId(null); }}
                                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all border ${productSubTab === 'library' ? 'bg-indigo-50 border-indigo-100 text-indigo-700' : 'bg-white border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
                            >
                                <List size={14} className={productSubTab === 'library' ? 'text-indigo-600' : 'text-slate-400'} />
                                <span>Product Library</span>
                            </button>
                            <button
                                onClick={() => { setProductSubTab('settings'); setSelectedProductId(null); }}
                                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all border ${productSubTab === 'settings' ? 'bg-indigo-50 border-indigo-100 text-indigo-700' : 'bg-white border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
                            >
                                <Settings size={14} className={productSubTab === 'settings' ? 'text-indigo-600' : 'text-slate-400'} />
                                <span>Settings</span>
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Engine Active</span>
                    </div>
                </div>

                {/* Sub-Module Content */}
                <div className="flex-1 bg-slate-50 overflow-hidden relative">
                    {productSubTab === 'config' && renderProductConfig()}
                    {productSubTab === 'library' && renderProductLibrary()}
                    {productSubTab === 'settings' && <div className="h-full overflow-auto custom-scrollbar">{renderProductSettings()}</div>}
                </div>
            </div>
        );
    };

    // --- Auto-Fill Confirmation Menu ---
    const renderFillMenu = () => {
        if (!fillConfirmMenu) return null;

        return (
            <div
                className="fixed inset-0 z-50 bg-transparent flex items-start justify-start"
                onClick={() => {
                    setFillRange(null);
                    setFillConfirmMenu(null);
                }}
            >
                <div
                    className="bg-white rounded-lg shadow-xl border border-gray-200 p-1 flex flex-col min-w-[140px] animate-in fade-in zoom-in-95 duration-100"
                    style={{
                        position: 'absolute',
                        left: fillConfirmMenu.x + 10,
                        top: fillConfirmMenu.y + 10,
                    }}
                    onClick={e => e.stopPropagation()}
                >
                    <div className="text-xs font-semibold text-gray-500 px-3 py-2 border-b border-gray-100 mb-1">
                        Auto Fill Options
                    </div>

                    <button
                        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-slate-100 rounded-md transition-colors text-left"
                        onClick={() => performFill('copy')}
                    >
                        <Copy size={14} className="text-gray-400" />
                        <span>Copy Cells</span>
                    </button>

                    <button
                        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-slate-100 rounded-md transition-colors text-left"
                        onClick={() => performFill('series')}
                    >
                        <ListOrdered size={14} className="text-gray-400" />
                        <span>Fill Series</span>
                    </button>

                    <div className="h-px bg-gray-100 my-1"></div>

                    <button
                        className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors text-left"
                        onClick={() => performFill('select_only')}
                    >
                        <X size={14} />
                        <span>Cancel</span>
                    </button>
                </div>
            </div>
        );
    };

    const batchColumns = allDataFields.filter(f => f.showInBatch !== false && !hiddenColumnIds.includes(f.id));

    // --- Keyboard Navigation (Excel-like) ---
    useEffect(() => {
        if (activeTab !== 'data' || subView !== 'table' || !selectedCell) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // Helper to move selection
            const moveSelection = (deltaRow: number, deltaCol: number, isShift = false) => {
                const rowIndex = filteredRecords.findIndex(r => r._id === selectedCell.rowId);
                const colIndex = gridColumns.findIndex(c => c.id === selectedCell.fieldId);

                if (rowIndex === -1 || colIndex === -1) return;

                let newRowIndex = rowIndex + deltaRow;
                let newColIndex = colIndex + deltaCol;

                // Clamp
                if (newRowIndex < 0) newRowIndex = 0;
                if (newRowIndex >= filteredRecords.length) newRowIndex = filteredRecords.length - 1;
                if (newColIndex < 0) newColIndex = 0;
                if (newColIndex >= gridColumns.length) newColIndex = gridColumns.length - 1;

                const newRow = filteredRecords[newRowIndex];
                const newCol = gridColumns[newColIndex];

                if (isShift && selectionAnchor) {
                    // Range expansion from anchor to new target
                    const startRowIdx = filteredRecords.findIndex(r => r._id === selectionAnchor.rowId);
                    const startColIdx = gridColumns.findIndex(c => c.id === selectionAnchor.fieldId);
                    const endRowIdx = newRowIndex;
                    const endColIdx = newColIndex;

                    if (startRowIdx !== -1 && startColIdx !== -1) {
                        const minRow = Math.min(startRowIdx, endRowIdx);
                        const maxRow = Math.max(startRowIdx, endRowIdx);
                        const minCol = Math.min(startColIdx, endColIdx);
                        const maxCol = Math.max(startColIdx, endColIdx);

                        const newSelection = [];
                        for (let r = minRow; r <= maxRow; r++) {
                            for (let c = minCol; c <= maxCol; c++) {
                                newSelection.push({ rowId: filteredRecords[r]._id, fieldId: gridColumns[c].id });
                            }
                        }
                        setSelectedCells(newSelection);
                        setSelectedCell({ rowId: newRow._id, fieldId: newCol.id });
                    }
                } else {
                    setSelectedCell({ rowId: newRow._id, fieldId: newCol.id });
                    setSelectedCells([{ rowId: newRow._id, fieldId: newCol.id }]);
                    setSelectionAnchor({ rowId: newRow._id, fieldId: newCol.id });
                }
            };

            // If editing
            if (editingCell) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    setEditingCell(null);
                    moveSelection(1, 0); // Move down
                }
                if (e.key === 'Tab') {
                    e.preventDefault();
                    setEditingCell(null);
                    moveSelection(0, 1); // Move right
                }
                if (e.key === 'Escape') {
                    e.preventDefault();
                    setEditingCell(null);
                }
                return;
            }


            // Ignore if user is typing in another input (Search, etc.)
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
                return;
            }

            // Navigation Mode (Not Editing)
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
                if (e.key === 'ArrowUp') moveSelection(-1, 0, e.shiftKey);
                if (e.key === 'ArrowDown') moveSelection(1, 0, e.shiftKey);
                if (e.key === 'ArrowLeft') moveSelection(0, -1, e.shiftKey);
                if (e.key === 'ArrowRight') moveSelection(0, 1, e.shiftKey);
            }

            if (e.key === 'Enter') {
                e.preventDefault();
                // Check if read-only
                const row = filteredRecords.find(r => r._id === selectedCell.rowId);
                const col = gridColumns.find(c => c.id === selectedCell.fieldId);
                if (row && col && !isCellReadOnly(row, col)) {
                    setEditingCell(selectedCell);
                }
            }

            if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                if (selectedCells.length > 0) {
                    const newRecords = [...records];
                    let count = 0;

                    selectedCells.forEach(cell => {
                        const recordIndex = newRecords.findIndex(r => r._id === cell.rowId);
                        if (recordIndex !== -1) {
                            const col = gridColumns.find(c => c.id === cell.fieldId);
                            // Safety Check: Skip calculated columns and read-only cells
                            if (col && !col.logic?.calculation && !isCellReadOnly(newRecords[recordIndex], col)) {
                                const updatedRow = { ...newRecords[recordIndex] };
                                delete updatedRow[cell.fieldId];
                                newRecords[recordIndex] = applyRowLogic(updatedRow, schema);
                                count++;
                            }
                        }
                    });

                    if (count > 0) {
                        setRecords(newRecords);
                        addToast(`Cleared ${count} cells`, 'success');
                    }
                }
                return;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeTab, subView, selectedCell, editingCell, filteredRecords, gridColumns]);

    return (
        <div className="flex flex-col h-full bg-slate-50 font-sans text-slate-900">

            {/* Top Header */}
            <header className="bg-white border-b border-gray-200 px-6 h-16 flex items-center justify-between shrink-0 z-30">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center text-white shadow-md">
                        <Database size={18} />
                    </div>
                    <div>
                        <h1 className="font-extrabold text-lg text-gray-900 tracking-tight leading-none">Super Table</h1>
                        <p className="text-[10px] font-bold text-gray-400 uppercase mt-0.5 tracking-wider">Dynamic Schema Engine</p>
                    </div>
                </div>

                {/* Mode Switcher */}
                <div className="bg-slate-100 p-1 rounded-lg border border-slate-200 flex">
                    <button
                        onClick={() => setActiveTab('product_center')}
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'product_center' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Package size={14} /> Product Configuration Center
                    </button>
                    <div className="w-px bg-gray-200 mx-1 my-1"></div>
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
                    <button
                        onClick={() => setActiveTab('builder')}
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'builder' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Settings2 size={14} /> Schema Builder
                    </button>
                    <div className="w-px bg-gray-200 mx-1 my-1"></div>
                    <button
                        onClick={() => setActiveTab('guide')}
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'guide' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <BookOpen size={14} /> Logic Guide
                    </button>
                </div>

            </header>

            {/* Main Content Area */}
            <main className="flex-1 overflow-hidden relative flex flex-col">

                {/* === PRODUCT CENTER MODE === */}
                {
                    activeTab === 'product_center' && renderProductCenter()
                }

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

                                    {/* Group: AI Assistant */}
                                    <div className="space-y-1 pt-4 border-t border-gray-100">
                                        <h4 className="px-3 text-[10px] font-extrabold text-purple-500 uppercase tracking-wider mb-2 hidden lg:flex items-center gap-1">
                                            <Sparkles size={10} /> AI Assistant
                                        </h4>
                                        <button
                                            onClick={() => setAiBuilderModal({ isOpen: true, mode: 'generate', prompt: '', isLoading: false })}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm font-medium rounded-lg transition-all group bg-gradient-to-r from-purple-50 to-indigo-50 hover:from-purple-100 hover:to-indigo-100 border border-purple-100"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-sm">
                                                <Sparkles size={14} />
                                            </div>
                                            <div className="hidden lg:block">
                                                <span className="text-xs font-bold text-purple-700">AI Generate</span>
                                                <p className="text-[10px] text-purple-400">From description</p>
                                            </div>
                                        </button>
                                        <button
                                            onClick={() => setAiBuilderModal({ isOpen: true, mode: 'logic', prompt: '', isLoading: false })}
                                            disabled={schema.length === 0}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm font-medium rounded-lg transition-all group bg-gradient-to-r from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100 border border-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-sm">
                                                <FunctionSquare size={14} />
                                            </div>
                                            <div className="hidden lg:block">
                                                <span className="text-xs font-bold text-emerald-700">AI Logic</span>
                                                <p className="text-[10px] text-emerald-400">Configure rules</p>
                                            </div>
                                        </button>
                                    </div>
                                </div>

                                {/* Sidebar Footer */}
                                <div className="p-4 border-t border-gray-100 bg-gray-50/50 hidden lg:block">
                                    <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-center">
                                        <p className="text-[10px] text-indigo-800 font-medium mb-1">Manage Forms</p>
                                        {activeFormId ? (
                                            <>
                                                <button
                                                    onClick={() => setSaveFormOpen(true)}
                                                    className="text-[10px] bg-white border border-indigo-200 text-indigo-600 font-bold px-3 py-1.5 rounded-full hover:bg-indigo-50 transition-colors w-full shadow-sm mb-2"
                                                >
                                                    Save as New...
                                                </button>
                                                <button
                                                    onClick={handleUpdateForm}
                                                    className="text-[10px] bg-indigo-600 text-white font-bold px-3 py-1.5 rounded-full hover:bg-indigo-700 transition-colors w-full shadow-sm mb-2"
                                                >
                                                    Update Template
                                                </button>
                                            </>
                                        ) : (
                                            <button
                                                onClick={() => setSaveFormOpen(true)}
                                                className="text-[10px] bg-white border border-indigo-200 text-indigo-600 font-bold px-3 py-1.5 rounded-full hover:bg-indigo-50 transition-colors w-full shadow-sm mb-2"
                                            >
                                                Save to Library
                                            </button>
                                        )}
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
                                        formName={currentFormName}
                                    />
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* === DATA MODE (Restored from previous turn) === */}
                {
                    activeTab === 'data' && (
                        <div className="flex flex-row h-full bg-white animate-in fade-in duration-300">
                            {/* 1. Database Library Sidebar */}
                            <div className="w-64 border-r border-gray-200 flex flex-col bg-slate-50/50 shrink-0">
                                <div className="p-4 border-b border-gray-100 flex items-center justify-between relative">
                                    <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                        <Database size={14} /> Databases
                                    </h3>
                                    <div className="flex items-center gap-1">
                                        {/* Sort Menu */}
                                        <div className="relative">
                                            <button
                                                onClick={() => setDatasetSortMenuOpen(!datasetSortMenuOpen)}
                                                className={`p-1 rounded transition-colors ${datasetSortMenuOpen ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:text-indigo-600'}`}
                                                title="Sort Datasets"
                                            >
                                                <ArrowDownUp size={14} />
                                            </button>
                                            {datasetSortMenuOpen && (
                                                <>
                                                    <div className="fixed inset-0 z-30" onClick={() => setDatasetSortMenuOpen(false)}></div>
                                                    <div className="absolute right-0 top-full mt-2 w-40 bg-white border border-gray-200 rounded-lg shadow-xl z-40 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
                                                        <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase">Sort By</div>
                                                        <button onClick={() => handleSortDatasets('name_asc')} className="w-full text-left px-3 py-2 text-xs text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2">
                                                            <ArrowDownAZ size={12} /> Name (A-Z)
                                                        </button>
                                                        <button onClick={() => handleSortDatasets('name_desc')} className="w-full text-left px-3 py-2 text-xs text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2">
                                                            <ArrowUpAZ size={12} /> Name (Z-A)
                                                        </button>
                                                        <button onClick={() => handleSortDatasets('date_new')} className="w-full text-left px-3 py-2 text-xs text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2">
                                                            <Calendar size={12} /> Date (Newest)
                                                        </button>
                                                        <button onClick={() => handleSortDatasets('date_old')} className="w-full text-left px-3 py-2 text-xs text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2">
                                                            <Clock size={12} /> Date (Oldest)
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                        <button onClick={handleAddDatasetGroup} className="p-1 text-slate-400 hover:text-indigo-600 rounded transition-colors" title="New Folder">
                                            <Plus size={14} />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                                    {savedDatasets.length === 0 && datasetGroups.length === 0 && (
                                        <div className="text-center p-8 text-slate-400">
                                            <Database size={24} className="mx-auto mb-2 opacity-50" />
                                            <p className="text-[10px]">No saved datasets</p>
                                        </div>
                                    )}

                                    {/* Groups */}
                                    {datasetGroups.map(group => (
                                        <div
                                            key={group.id}
                                            className="mb-1"
                                            onDragOver={e => e.preventDefault()}
                                            onDrop={e => {
                                                e.preventDefault();
                                                const dsId = e.dataTransfer.getData('datasetId');
                                                if (dsId) handleMoveDataset(dsId, group.id);
                                            }}
                                        >
                                            <div onClick={() => toggleGroupCollapse(group.id)} className="group/header flex items-center gap-1 px-2 py-1.5 rounded hover:bg-slate-100 text-sm font-medium text-slate-700 cursor-pointer relative">
                                                <ChevronDown size={14} className={`text-slate-400 transition-transform ${collapsedGroups.has(group.id) ? '-rotate-90' : ''}`} />
                                                <Folder size={14} className="text-indigo-400 shrink-0" />
                                                {groupRenameState?.id === group.id ? (
                                                    <input
                                                        autoFocus
                                                        className="flex-1 bg-white border border-indigo-300 rounded px-1 min-w-0 outline-none text-xs h-6"
                                                        value={groupRenameState.name}
                                                        onChange={e => setGroupRenameState({ ...groupRenameState, name: e.target.value })}
                                                        onBlur={handleCommitGroupRename}
                                                        onKeyDown={e => e.key === 'Enter' && handleCommitGroupRename()}
                                                        onClick={e => e.stopPropagation()}
                                                    />
                                                ) : (
                                                    <span className="truncate flex-1 text-xs font-bold" onDoubleClick={(e) => { e.stopPropagation(); setGroupRenameState(group); }}>{group.name}</span>
                                                )}
                                                <div className="hidden group-hover/header:flex items-center absolute right-2">
                                                    <button onClick={(e) => { e.stopPropagation(); confirmDeleteGroup(group.id, group.name); }} className="p-1 text-gray-400 hover:text-red-500 rounded"><Trash2 size={12} /></button>
                                                </div>
                                            </div>

                                            {/* Group Items */}
                                            {!collapsedGroups.has(group.id) && (
                                                <div className="pl-4 space-y-1 mt-1">
                                                    {savedDatasets.filter(d => d.groupId === group.id).map(ds => (
                                                        <div
                                                            key={ds.id}
                                                            draggable
                                                            onDragStart={e => e.dataTransfer.setData('datasetId', ds.id)}
                                                            onDragOver={e => e.preventDefault()}
                                                            onDrop={e => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                const draggedId = e.dataTransfer.getData('datasetId');
                                                                if (draggedId) handleReorderDataset(draggedId, ds.id);
                                                            }}
                                                            onDoubleClick={() => handleLoadDataset(ds)}
                                                            className={`p-2 rounded-lg cursor-pointer transition-all border group relative flex items-center gap-2 ${ds.id === activeDatasetId
                                                                ? 'bg-indigo-50/80 border-transparent shadow-sm'
                                                                : 'bg-transparent border-transparent hover:bg-white hover:shadow-sm hover:border-slate-100'
                                                                }`}
                                                        >
                                                            <TableIcon size={14} className={`${ds.id === activeDatasetId ? 'text-indigo-600' : 'text-indigo-400'} shrink-0`} />
                                                            <span className={`text-xs font-medium truncate flex-1 ${ds.id === activeDatasetId ? 'text-indigo-900 font-bold' : 'text-slate-700'}`}>{ds.name}</span>

                                                            {/* Actions */}
                                                            <div className="hidden group-hover:flex items-center gap-1 absolute right-2 top-1/2 -translate-y-1/2">
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); setRenameDialog({ isOpen: true, id: ds.id, name: ds.name, type: 'dataset' }); }}
                                                                    className="p-1 text-gray-400 hover:text-indigo-600 transition-colors"
                                                                    title="Rename"
                                                                >
                                                                    <Edit3 size={12} />
                                                                </button>
                                                                <button
                                                                    onClick={(e) => handleDeleteDataset(e, ds.id, ds.name)}
                                                                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                                                                    title="Delete"
                                                                >
                                                                    <Trash2 size={12} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}

                                    {/* Root Items (Drop Zone) */}
                                    <div
                                        className="pt-2 space-y-1 min-h-[50px]"
                                        onDragOver={e => e.preventDefault()}
                                        onDrop={e => {
                                            e.preventDefault();
                                            const dsId = e.dataTransfer.getData('datasetId');
                                            if (dsId) handleMoveDataset(dsId, undefined);
                                        }}
                                    >
                                        {savedDatasets.filter(d => !d.groupId || !datasetGroups.find(g => g.id === d.groupId)).map(ds => (
                                            <div
                                                key={ds.id}
                                                draggable
                                                onDragStart={e => e.dataTransfer.setData('datasetId', ds.id)}
                                                onDragOver={e => e.preventDefault()}
                                                onDrop={e => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    const draggedId = e.dataTransfer.getData('datasetId');
                                                    if (draggedId) handleReorderDataset(draggedId, ds.id);
                                                }}
                                                onDoubleClick={() => handleLoadDataset(ds)}
                                                className={`p-3 rounded-lg cursor-pointer transition-all border group relative ${ds.id === activeDatasetId ? 'bg-indigo-50/80 border-transparent shadow-sm' : 'bg-transparent border-transparent hover:bg-white hover:shadow-sm hover:border-slate-100'}`}
                                            >
                                                <div className="flex items-center gap-2 mb-1">
                                                    <TableIcon size={14} className={`${ds.id === activeDatasetId ? 'text-indigo-600' : 'text-indigo-400'} shrink-0`} />
                                                    <span className={`text-sm truncate pr-16 ${ds.id === activeDatasetId ? 'text-indigo-900 font-extrabold' : 'text-slate-700 font-bold'}`}>{ds.name}</span>
                                                </div>

                                                <div className="hidden group-hover:flex items-center gap-1 absolute right-2 top-1/2 -translate-y-1/2">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setRenameDialog({ isOpen: true, id: ds.id, name: ds.name, type: 'dataset' }); }}
                                                        className="p-1 text-gray-400 hover:text-indigo-600 transition-colors"
                                                        title="Rename"
                                                    >
                                                        <Edit3 size={12} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => handleDeleteDataset(e, ds.id, ds.name)}
                                                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>

                                                <div className="text-[10px] text-slate-400">
                                                    {new Date(ds.timestamp).toLocaleDateString()}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 flex flex-col overflow-hidden relative">
                                {/* Data Toolbar Optimized */}
                                <div className="bg-white border-b border-gray-200 px-6 py-3 flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-20 shadow-sm/50">

                                    {/* Left Group: Nav & Context */}
                                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                                        {/* View Switcher */}
                                        <div className="flex items-center gap-1 bg-gray-100/80 p-1 rounded-lg">
                                            <button onClick={() => setSubView('table')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${subView === 'table' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                                                <TableIcon size={14} /> Grid
                                            </button>
                                            <button onClick={() => setSubView('batch')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${subView === 'batch' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                                                <Grid size={14} /> Batch
                                            </button>
                                            <button onClick={() => setSubView('preview')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${subView === 'preview' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                                                <FormInput size={14} /> Entry
                                            </button>
                                        </div>

                                        <div className="hidden sm:block h-6 w-px bg-gray-200"></div>

                                        {/* Template Selector */}
                                        <div className="relative z-30">
                                            <button
                                                onClick={() => setTemplateSelectorOpen(!templateSelectorOpen)}
                                                className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 hover:border-indigo-300 rounded-lg text-xs font-bold text-gray-700 hover:text-indigo-600 transition-all shadow-sm group min-w-[140px]"
                                            >
                                                <Folder size={14} className="text-gray-400 group-hover:text-indigo-500 transition-colors" />
                                                <span className="truncate flex-1 text-left">{currentFormName}</span>
                                                <ChevronDown size={12} className="text-gray-300 group-hover:text-indigo-500 transition-colors" />
                                            </button>

                                            {templateSelectorOpen && (
                                                <>
                                                    <div className="fixed inset-0 z-10" onClick={() => setTemplateSelectorOpen(false)}></div>
                                                    <div className="absolute top-full left-0 mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-xl z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
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
                                    </div>

                                    {/* Right Group: Search, Tools, Actions */}
                                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                                        {subView !== 'preview' && (
                                            <>
                                                {/* Search */}
                                                <div className="relative w-full sm:w-48">
                                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                                    <input
                                                        className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50 transition-all"
                                                        placeholder="Search..."
                                                        value={globalSearch}
                                                        onChange={(e) => setGlobalSearch(e.target.value)}
                                                    />
                                                </div>

                                                {/* Tools Group */}
                                                <div className="flex items-center gap-1 bg-white border border-gray-100 p-1 rounded-lg mr-2 shadow-sm">
                                                    <button
                                                        onClick={() => setShowFilters(!showFilters)}
                                                        className={`p-1.5 rounded-md transition-colors ${showFilters || hasActiveFilters ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'}`}
                                                        title="Toggle Filters"
                                                    >
                                                        <Filter size={16} className={hasActiveFilters ? "fill-indigo-600" : ""} />
                                                    </button>
                                                    <div className="w-px h-4 bg-gray-200 mx-1"></div>
                                                    <button onClick={handleGenerateMock} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors" title="Mock Data">
                                                        <RefreshCw size={16} />
                                                    </button>

                                                    {/* Columns Toggle */}
                                                    <div className="relative">
                                                        <button
                                                            onClick={() => setColumnsMenuOpen(!columnsMenuOpen)}
                                                            className={`p-1.5 rounded-md transition-colors ${columnsMenuOpen ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                                                            title="Toggle Columns"
                                                        >
                                                            <Columns size={16} />
                                                        </button>
                                                        {columnsMenuOpen && (
                                                            <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-80">
                                                                {/* Backdrop to close */}
                                                                <div className="fixed inset-0 z-40" onClick={() => setColumnsMenuOpen(false)}></div>
                                                                <div className="relative z-50 flex flex-col max-h-80">
                                                                    <div className="p-3 border-b border-gray-100 bg-gray-50 flex justify-between items-center ">
                                                                        <span className="text-xs font-bold text-gray-500 uppercase">Columns</span>
                                                                        <button onClick={() => setHiddenColumnIds([])} className="text-[10px] font-bold text-indigo-600 hover:underline">Reset</button>
                                                                    </div>
                                                                    <div className="overflow-y-auto p-2 space-y-1 custom-scrollbar">
                                                                        {schema.filter((f: any) => !['divider', 'notice', 'spacer'].includes(f.type)).map((f: any) => (
                                                                            <label key={f.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded-lg cursor-pointer">
                                                                                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${!hiddenColumnIds.includes(f.id) ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-gray-300'}`}>
                                                                                    {!hiddenColumnIds.includes(f.id) && <Check size={10} className="text-white" />}
                                                                                </div>
                                                                                <span className={`text-xs font-medium truncate ${!hiddenColumnIds.includes(f.id) ? 'text-gray-700' : 'text-gray-400'}`}>{f.label}</span>
                                                                                <input
                                                                                    type="checkbox"
                                                                                    className="hidden"
                                                                                    checked={!hiddenColumnIds.includes(f.id)}
                                                                                    onChange={() => {
                                                                                        if (hiddenColumnIds.includes(f.id)) {
                                                                                            setHiddenColumnIds(prev => prev.filter(id => id !== f.id));
                                                                                        } else {
                                                                                            setHiddenColumnIds(prev => [...prev, f.id]);
                                                                                        }
                                                                                    }}
                                                                                />
                                                                            </label>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <button onClick={() => dataImportInputRef.current?.click()} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors" title="Import CSV/Excel">
                                                        <Download size={16} />
                                                    </button>
                                                    <button onClick={handleExport} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors" title="Export CSV/Excel">
                                                        <Upload size={16} />
                                                    </button>
                                                    <input type="file" className="hidden" ref={dataImportInputRef} accept=".xlsx, .xls, .csv" onChange={handleDataImport} />
                                                </div>
                                            </>
                                        )}

                                        {/* Primary Action */}
                                        {subView === 'table' && (
                                            <button
                                                onClick={() => {
                                                    // If there are filters, we must show the modal to ask for save scope
                                                    if (hasActiveFilters) {
                                                        setSaveDatasetOpen(true);
                                                    } else if (activeDatasetId) {
                                                        handleUpdateActiveDataset();
                                                    } else {
                                                        setSaveDatasetOpen(true);
                                                    }
                                                }}
                                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-xs font-bold shadow-sm hover:shadow hover:-translate-y-0.5 active:translate-y-0"
                                            >
                                                <Save size={14} /> {hasActiveFilters ? 'Save Options' : (activeDatasetId ? 'Save' : 'Save As')}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Enhanced Filter Panel - Hide in New Entry mode */}
                                {showFilters && subView !== 'preview' && (
                                    <div className="border-x border-b border-gray-200 bg-white animate-in slide-in-from-top-2 rounded-b-3xl shadow-xl z-20 mx-6 mb-6 overflow-hidden">
                                        <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-gray-100 items-stretch">

                                            {/* Left: Filter Builder & Groups */}
                                            <div className="p-6 flex-1 space-y-4">
                                                {/* Top Controls: Root Logic & Add Group */}
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex items-center gap-2 px-1 mr-4 border-r border-gray-100 pr-4">
                                                            <div className="bg-indigo-50 p-1.5 rounded-lg text-indigo-600">
                                                                <SlidersHorizontal size={16} />
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-bold text-slate-800 leading-none">筛选配置</span>
                                                                <span className="text-[10px] text-slate-400 font-medium">Filter Rules</span>
                                                            </div>
                                                        </div>

                                                        {filterGroups.length > 1 && (
                                                            <div className="flex items-center bg-gray-100 rounded-lg p-0.5 border border-gray-200">
                                                                <button
                                                                    onClick={() => setRootFilterMode('AND')}
                                                                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${rootFilterMode === 'AND' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                                                >
                                                                    满足所有组 (AND)
                                                                </button>
                                                                <button
                                                                    onClick={() => setRootFilterMode('OR')}
                                                                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${rootFilterMode === 'OR' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                                                >
                                                                    满足任一组 (OR)
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center gap-3">
                                                        <div className="text-[10px] font-bold text-gray-400 hidden sm:block">
                                                            {filterGroups.length} 组 / {filterGroups.reduce((acc, g) => acc + g.conditions.length, 0)} 条件
                                                        </div>

                                                        {/* Inline Save View */}
                                                        {filterGroups.some(g => g.conditions.length > 0) && (
                                                            <div className="flex items-center gap-2 pl-3 ml-1 border-l border-gray-100 animate-in fade-in slide-in-from-right-2">
                                                                <input
                                                                    className="w-32 lg:w-48 text-[11px] border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-indigo-400 bg-gray-50/50 focus:bg-white transition-all"
                                                                    placeholder="预设名称..."
                                                                    value={viewName}
                                                                    onChange={(e) => setViewName(e.target.value)}
                                                                />
                                                                <button
                                                                    onClick={handleSaveView}
                                                                    disabled={!viewName.trim()}
                                                                    className="flex items-center gap-1 text-[11px] font-bold text-white bg-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-30 disabled:grayscale transition-all shadow-sm"
                                                                >
                                                                    <Bookmark size={12} /> 保存
                                                                </button>
                                                            </div>
                                                        )}

                                                        <button
                                                            onClick={handleAddGroup}
                                                            className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 border border-indigo-100 bg-white px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors shadow-sm"
                                                        >
                                                            <Plus size={12} /> 新增组
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Common Filter Input (Adds to Active Group) */}
                                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-wrap items-center gap-3 shadow-inner">
                                                    <div className="flex-1 min-w-[140px]">

                                                        <select
                                                            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-500 bg-white transition-all"
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

                                                    <div className="w-[120px]">
                                                        <select
                                                            disabled={!pendingFilter.fieldId}
                                                            className={`w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-500 bg-white transition-all ${!pendingFilter.fieldId ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : ''}`}
                                                            value={pendingFilter.operator}
                                                            onChange={(e) => setPendingFilter({ ...pendingFilter, operator: e.target.value })}
                                                        >
                                                            {!pendingFilter.fieldId && <option>条件...</option>}
                                                            {pendingFilter.fieldId && getOperatorsForType(schema.find(f => f.id === pendingFilter.fieldId)?.type || 'text').map(op => (
                                                                <option key={op.val} value={op.val}>{op.label}</option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    {/* Smart Value Input */}
                                                    {pendingFilter.operator !== 'isEmpty' && pendingFilter.operator !== 'isNotEmpty' && (
                                                        <div className="flex-1 min-w-[140px] flex gap-2">
                                                            {schema.find(f => f.id === pendingFilter.fieldId)?.type === 'select' || schema.find(f => f.id === pendingFilter.fieldId)?.type === 'radio' ? (
                                                                <div className="w-full">

                                                                    <select
                                                                        disabled={!pendingFilter.fieldId}
                                                                        className={`w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-500 bg-white transition-all ${!pendingFilter.fieldId ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : ''}`}
                                                                        value={pendingFilter.value}
                                                                        onChange={(e) => setPendingFilter({ ...pendingFilter, value: e.target.value })}
                                                                    >
                                                                        <option value="">请选择...</option>
                                                                        {schema.find(f => f.id === pendingFilter.fieldId)?.options?.map((opt: string) => (
                                                                            <option key={opt} value={opt}>{opt}</option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <div className="w-full">

                                                                        <input
                                                                            disabled={!pendingFilter.fieldId}
                                                                            type={schema.find(f => f.id === pendingFilter.fieldId)?.type === 'date' ? 'date' : 'text'}
                                                                            className={`w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-500 bg-white transition-all ${!pendingFilter.fieldId ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : ''}`}
                                                                            placeholder="请输入值..."
                                                                            value={pendingFilter.value}
                                                                            onChange={(e) => setPendingFilter({ ...pendingFilter, value: e.target.value })}
                                                                            onKeyDown={(e) => e.key === 'Enter' && handleAddPendingFilter()}
                                                                        />
                                                                    </div>
                                                                    {pendingFilter.operator === 'between' && (
                                                                        <div className="w-full">

                                                                            <input
                                                                                type={schema.find(f => f.id === pendingFilter.fieldId)?.type === 'date' ? 'date' : 'text'}
                                                                                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-500 bg-white transition-all"
                                                                                placeholder="Max / End"
                                                                                value={pendingFilter.value2 || ''}
                                                                                onChange={(e) => setPendingFilter({ ...pendingFilter, value2: e.target.value })}
                                                                                onKeyDown={(e) => e.key === 'Enter' && handleAddPendingFilter()}
                                                                            />
                                                                        </div>
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>
                                                    )}

                                                    <div className="flex items-center gap-2">
                                                        {filterGroups.length > 1 && (
                                                            <div className="flex flex-col">
                                                                <select
                                                                    value={activeGroupId}
                                                                    onChange={(e) => setActiveGroupId(e.target.value)}
                                                                    className="text-xs bg-white border border-gray-200 rounded-lg px-2 py-2.5 outline-none focus:border-indigo-500 font-mono"
                                                                >
                                                                    {filterGroups.map((g, i) => <option key={g.id} value={g.id}>Group {i + 1}</option>)}
                                                                </select>
                                                            </div>
                                                        )}
                                                        <div className="flex flex-col justify-center h-full">
                                                            <button
                                                                onClick={handleAddPendingFilter}
                                                                className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors shadow-sm"
                                                            >
                                                                添加
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Groups Display */}
                                                <div className="space-y-3">
                                                    {filterGroups.length === 0 && <div className="text-center text-gray-400 py-8 italic border-2 border-dashed border-gray-100 rounded-xl">暂无筛选组，请点击上方 "新增组" 或直接添加筛选条件</div>}
                                                    {filterGroups.map((group, groupIndex) => (
                                                        <div
                                                            key={group.id}
                                                            onClick={() => setActiveGroupId(group.id)}
                                                            className={`relative rounded-xl border transition-all duration-200 cursor-default ${activeGroupId === group.id
                                                                ? 'bg-white border-indigo-500 shadow-md ring-1 ring-indigo-500/20'
                                                                : 'bg-white border-gray-200 hover:border-indigo-300 hover:shadow-sm'
                                                                }`}
                                                        >
                                                            {/* Group Header & Logic Toggle */}
                                                            <div className="flex items-center justify-between p-3 border-b border-gray-50/50 bg-gray-50/30 rounded-t-xl">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="flex items-center justify-center w-6 h-6 rounded-md bg-white border border-gray-100 shadow-sm text-xs font-bold text-slate-500">
                                                                        {groupIndex + 1}
                                                                    </div>

                                                                    <div className="flex bg-gray-100/80 p-0.5 rounded-lg border border-gray-200/50">
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); setFilterGroups(prev => prev.map(g => g.id === group.id ? { ...g, logic: 'AND' } : g)); }}
                                                                            className={`px-3 py-0.5 text-[10px] font-bold rounded-md transition-all ${group.logic === 'AND' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                                                        >
                                                                            且 (AND)
                                                                        </button>
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); setFilterGroups(prev => prev.map(g => g.id === group.id ? { ...g, logic: 'OR' } : g)); }}
                                                                            className={`px-3 py-0.5 text-[10px] font-bold rounded-md transition-all ${group.logic === 'OR' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                                                        >
                                                                            或 (OR)
                                                                        </button>
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-center gap-2">
                                                                    {activeGroupId === group.id && (
                                                                        <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full animate-in fade-in">当前编辑组</span>
                                                                    )}
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); handleRemoveGroup(group.id); }}
                                                                        className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                                        title="删除组"
                                                                    >
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {/* Group Content */}
                                                            <div className="p-3 bg-white rounded-b-xl min-h-[60px]" onClick={() => setActiveGroupId(group.id)}>
                                                                {group.conditions.length === 0 ? (
                                                                    <div className="flex flex-col items-center justify-center py-4 text-center cursor-pointer opacity-60 hover:opacity-100 transition-opacity" onClick={() => setActiveGroupId(group.id)}>
                                                                        <div className="p-2 bg-gray-50 rounded-full mb-1">
                                                                            <Filter size={12} className="text-gray-300" />
                                                                        </div>
                                                                        <span className="text-xs text-gray-300">此组为空</span>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                        {group.conditions.map((f, i) => {
                                                                            const field = schema.find(s => s.id === f.fieldId);
                                                                            const opLabel = getOperatorsForType(field?.type || 'text').find(o => o.val === f.operator)?.label || f.operator;
                                                                            return (
                                                                                <React.Fragment key={f.id}>
                                                                                    {i > 0 && (
                                                                                        <div className={`relative px-1 text-[10px] font-bold uppercase ${group.logic === 'AND' ? 'text-emerald-300' : 'text-amber-300'}`}>
                                                                                            {group.logic === 'AND' ? '+' : '/'}
                                                                                        </div>
                                                                                    )}
                                                                                    <div className="group flex items-center gap-2 bg-white border border-gray-200 text-gray-700 pl-3 pr-1 py-1 rounded-full text-xs font-medium shadow-sm hover:border-indigo-300 hover:shadow-md transition-all cursor-default select-none">
                                                                                        <span className="font-bold text-gray-600">{field?.label}</span>
                                                                                        <span className="text-gray-400 font-mono text-[10px] uppercase">{opLabel}</span>
                                                                                        {(f.operator !== 'isEmpty' && f.operator !== 'isNotEmpty') && (
                                                                                            <span className="font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">{f.value} {f.value2 ? `- ${f.value2}` : ''}</span>
                                                                                        )}
                                                                                        <button
                                                                                            onClick={(e) => { e.stopPropagation(); handleRemoveFilter(group.id, f.id); }}
                                                                                            className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors ml-1"
                                                                                        >
                                                                                            <X size={12} />
                                                                                        </button>
                                                                                    </div>
                                                                                </React.Fragment>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Right: View Presets */}
                                            <div className="p-6 lg:w-80 space-y-4 bg-white flex flex-col">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2 text-slate-600">
                                                        <Bookmark size={16} className="text-indigo-500" />
                                                        <span className="text-sm font-bold">视图预设</span>
                                                    </div>
                                                    <div className="bg-white px-2 py-0.5 rounded-full border border-slate-200 text-[10px] font-bold text-slate-400">
                                                        PRESETS
                                                    </div>
                                                </div>

                                                <div className="space-y-1 flex-1 min-h-[160px] bg-white/50 rounded-xl border border-slate-200/60 p-2 shadow-inner">
                                                    {savedViews
                                                        .filter(view => {
                                                            // Match by datasetId specifically
                                                            if (activeDatasetId) {
                                                                return view.datasetId === activeDatasetId;
                                                            }
                                                            // For templates without activeDatasetId, use schema matching fallback
                                                            const schemaFieldIds = new Set(schema.map(f => f.id));
                                                            return !view.datasetId && view.filterGroups.every(group =>
                                                                group.conditions.every((cond: { fieldId: string }) => schemaFieldIds.has(cond.fieldId))
                                                            );
                                                        })
                                                        .map((view, idx) => {
                                                            const isActive = filterGroups.some(g => g.fromPreset === view.name);
                                                            return (
                                                                <div
                                                                    key={idx}
                                                                    className={`flex items-center justify-between group cursor-pointer p-2 rounded-lg transition-all border ${isActive
                                                                        ? 'bg-indigo-50 border-indigo-200 shadow-sm'
                                                                        : 'hover:bg-white border-transparent hover:border-gray-200'
                                                                        }`}
                                                                >
                                                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={isActive}
                                                                            onChange={() => handleLoadView(view, true)}
                                                                            className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                                            onClick={(e) => e.stopPropagation()}
                                                                        />
                                                                        <div
                                                                            className="flex items-center gap-2 text-sm flex-1 truncate"
                                                                            onClick={() => handleLoadView(view)}
                                                                        >
                                                                            <List size={14} className={isActive ? 'text-indigo-600' : 'text-gray-400'} />
                                                                            <span className={`truncate font-medium ${isActive ? 'text-indigo-700' : 'text-gray-600'}`}>{view.name}</span>
                                                                        </div>
                                                                    </div>
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); setSavedViews(savedViews.filter((_, i) => i !== idx)); }}
                                                                        className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1 ml-1"
                                                                    >
                                                                        <X size={12} />
                                                                    </button>
                                                                </div>
                                                            );
                                                        })}
                                                    {savedViews.filter(view => {
                                                        const schemaFieldIds = new Set(schema.map(f => f.id));
                                                        return view.filterGroups.every(group =>
                                                            group.conditions.every((cond: { fieldId: string }) => schemaFieldIds.has(cond.fieldId))
                                                        );
                                                    }).length === 0 && <div className="text-xs text-gray-400 italic px-2 py-4 text-center">暂无适用于当前表单的预设视图</div>}
                                                </div>

                                                {/* Save functionality moved to left column */}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Content */}
                                <div className="flex-1 overflow-hidden bg-slate-50 relative">

                                    {/* TABLE VIEW */}
                                    {subView === 'table' && (
                                        <div className="h-full flex flex-col overflow-hidden p-6">
                                            <div className="flex-1 bg-white border border-gray-200 rounded-xl shadow-sm overflow-auto min-h-0">
                                                <table className="w-full text-left border-collapse">
                                                    <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10 shadow-sm">
                                                        <tr>
                                                            <th
                                                                className="px-6 py-4 text-xs font-bold text-gray-500 w-16 text-center bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors border-b border-gray-200"
                                                                onClick={() => {
                                                                    const allCells = [];
                                                                    for (const r of filteredRecords) {
                                                                        for (const c of gridColumns) {
                                                                            allCells.push({ rowId: r._id, fieldId: c.id });
                                                                        }
                                                                    }
                                                                    setSelectedCells(allCells);
                                                                    if (filteredRecords.length > 0 && gridColumns.length > 0) {
                                                                        setSelectedCell({ rowId: filteredRecords[0]._id, fieldId: gridColumns[0].id });
                                                                    }
                                                                }}
                                                                title="Select All"
                                                            >
                                                                <div className="flex items-center justify-center">
                                                                    <Grid size={14} className="text-gray-400 group-hover:text-indigo-500" />
                                                                </div>
                                                            </th>
                                                            {gridColumns.map(f => {
                                                                const currentSort = sortConfig.find(s => s.fieldId === f.id);
                                                                return (
                                                                    <th
                                                                        key={f.id}
                                                                        onMouseDown={(e) => {
                                                                            if (e.target instanceof HTMLElement && e.target.closest('.sort-btn')) {
                                                                                return; // Handled by button
                                                                            }
                                                                            if (e.button !== 0) return; // Only left click

                                                                            const newSelection = [];
                                                                            for (const r of filteredRecords) {
                                                                                newSelection.push({ rowId: r._id, fieldId: f.id });
                                                                            }

                                                                            if (e.ctrlKey || e.metaKey) {
                                                                                // Toggle logic for entire column
                                                                                const isAlreadySelected = selectedCells.some(c => c.fieldId === f.id);
                                                                                if (isAlreadySelected) {
                                                                                    setSelectedCells(prev => prev.filter(c => c.fieldId !== f.id));
                                                                                } else {
                                                                                    setSelectedCells(prev => [...prev, ...newSelection]);
                                                                                }
                                                                                setSelectedCell({ rowId: filteredRecords[0]._id, fieldId: f.id });
                                                                                setSelectionAnchor({ rowId: filteredRecords[0]._id, fieldId: f.id });
                                                                            } else if (e.shiftKey && selectionAnchor) {
                                                                                // Shift + Click Column Range
                                                                                const startColIdx = gridColumns.findIndex(c => c.id === selectionAnchor.fieldId);
                                                                                const endColIdx = gridColumns.findIndex(c => c.id === f.id);
                                                                                const minC = Math.min(startColIdx, endColIdx);
                                                                                const maxC = Math.max(startColIdx, endColIdx);

                                                                                const multiColSelection = [];
                                                                                for (let cIdx = minC; cIdx <= maxC; cIdx++) {
                                                                                    for (const r of filteredRecords) {
                                                                                        multiColSelection.push({ rowId: r._id, fieldId: gridColumns[cIdx].id });
                                                                                    }
                                                                                }
                                                                                setSelectedCells(multiColSelection);
                                                                            } else {
                                                                                setSelectedCells(newSelection);
                                                                                if (newSelection.length > 0) {
                                                                                    setSelectedCell({ rowId: filteredRecords[0]._id, fieldId: f.id });
                                                                                }
                                                                                setSelectionAnchor({ rowId: filteredRecords[0]._id, fieldId: f.id });
                                                                                setIsDraggingColumnSelection(true);
                                                                            }
                                                                        }}
                                                                        onMouseEnter={() => {
                                                                            if (isDraggingColumnSelection && selectionAnchor) {
                                                                                const startColIdx = gridColumns.findIndex(c => c.id === selectionAnchor.fieldId);
                                                                                const endColIdx = gridColumns.findIndex(c => c.id === f.id);

                                                                                if (startColIdx !== -1) {
                                                                                    const minC = Math.min(startColIdx, endColIdx);
                                                                                    const maxC = Math.max(startColIdx, endColIdx);

                                                                                    const multiColSelection = [];
                                                                                    for (let cIdx = minC; cIdx <= maxC; cIdx++) {
                                                                                        for (const r of filteredRecords) {
                                                                                            multiColSelection.push({ rowId: r._id, fieldId: gridColumns[cIdx].id });
                                                                                        }
                                                                                    }
                                                                                    setSelectedCells(multiColSelection);
                                                                                }
                                                                            }
                                                                        }}
                                                                        className="px-6 py-4 text-xs font-bold text-gray-500 uppercase whitespace-nowrap bg-gray-50 border-l border-gray-100 group cursor-pointer hover:bg-gray-100 transition-colors relative"
                                                                        style={{ width: columnWidths[f.id] || 200, minWidth: columnWidths[f.id] || 200 }}
                                                                    >
                                                                        {/* Resize Handle */}
                                                                        <div
                                                                            onMouseDown={(e) => handleResizeStart(e, f.id)}
                                                                            className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize group-hover/resize:bg-indigo-300 transition-all hover:bg-indigo-500 group/resize z-20"
                                                                        ></div>
                                                                        <div className="flex items-center justify-between gap-2">
                                                                            <span>{f.label}</span>
                                                                            <button
                                                                                className={`sort-btn p-1 rounded hover:bg-gray-200 transition-colors ${currentSort ? 'text-indigo-600 bg-indigo-50' : 'text-gray-300 opacity-0 group-hover:opacity-100'}`}
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    // Toggle Sort
                                                                                    // None -> Asc -> Desc -> None
                                                                                    let newDirection: 'asc' | 'desc' | null = 'asc';
                                                                                    if (currentSort?.direction === 'asc') newDirection = 'desc';
                                                                                    else if (currentSort?.direction === 'desc') newDirection = null;

                                                                                    if (newDirection) {
                                                                                        // Multi-sort with Shift?
                                                                                        // For now, single column sort mostly.
                                                                                        // If Shift held, append.
                                                                                        if (e.shiftKey) {
                                                                                            setSortConfig(prev => {
                                                                                                const existing = prev.filter(s => s.fieldId !== f.id);
                                                                                                return [...existing, { fieldId: f.id, direction: newDirection! }];
                                                                                            });
                                                                                        } else {
                                                                                            setSortConfig([{ fieldId: f.id, direction: newDirection }]);
                                                                                        }
                                                                                    } else {
                                                                                        // Remove sort
                                                                                        setSortConfig(prev => prev.filter(s => s.fieldId !== f.id));
                                                                                    }
                                                                                }}
                                                                            >
                                                                                {currentSort?.direction === 'asc' ? <ArrowUp size={12} /> :
                                                                                    currentSort?.direction === 'desc' ? <ArrowDown size={12} /> :
                                                                                        <ArrowDownUp size={12} />}
                                                                            </button>
                                                                        </div>
                                                                    </th>
                                                                );
                                                            })}
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
                                                                    <td
                                                                        onMouseDown={(e) => {
                                                                            if (e.button !== 0) return; // Only left click

                                                                            const newSelection = [];
                                                                            for (const c of gridColumns) {
                                                                                newSelection.push({ rowId: row._id, fieldId: c.id });
                                                                            }

                                                                            if (e.ctrlKey || e.metaKey) {
                                                                                const isAlreadySelected = selectedCells.some(c => c.rowId === row._id);
                                                                                if (isAlreadySelected) {
                                                                                    setSelectedCells(prev => prev.filter(c => c.rowId !== row._id));
                                                                                } else {
                                                                                    setSelectedCells(prev => [...prev, ...newSelection]);
                                                                                }
                                                                            } else if (e.shiftKey && selectionAnchor) {
                                                                                // Row Range Selection
                                                                                const startRowIdx = filteredRecords.findIndex(r => r._id === selectionAnchor.rowId);
                                                                                const endRowIdx = i;
                                                                                const minR = Math.min(startRowIdx, endRowIdx);
                                                                                const maxR = Math.max(startRowIdx, endRowIdx);

                                                                                const multiRowSelection = [];
                                                                                for (let r = minR; r <= maxR; r++) {
                                                                                    for (const c of gridColumns) {
                                                                                        multiRowSelection.push({ rowId: filteredRecords[r]._id, fieldId: c.id });
                                                                                    }
                                                                                }
                                                                                setSelectedCells(multiRowSelection);
                                                                            } else {
                                                                                setSelectedCells(newSelection);
                                                                                if (newSelection.length > 0) {
                                                                                    setSelectedCell({ rowId: row._id, fieldId: gridColumns[0].id });
                                                                                }
                                                                                setSelectionAnchor({ rowId: row._id, fieldId: gridColumns[0].id });
                                                                                setIsDraggingRowSelection(true);
                                                                            }
                                                                        }}
                                                                        onMouseEnter={() => {
                                                                            if (isDraggingRowSelection && selectionAnchor) {
                                                                                const startRowIdx = filteredRecords.findIndex(r => r._id === selectionAnchor.rowId);
                                                                                const endRowIdx = i;

                                                                                if (startRowIdx !== -1) {
                                                                                    const minR = Math.min(startRowIdx, endRowIdx);
                                                                                    const maxR = Math.max(startRowIdx, endRowIdx);

                                                                                    const multiRowSelection = [];
                                                                                    for (let r = minR; r <= maxR; r++) {
                                                                                        for (const c of gridColumns) {
                                                                                            multiRowSelection.push({ rowId: filteredRecords[r]._id, fieldId: c.id });
                                                                                        }
                                                                                    }
                                                                                    setSelectedCells(multiRowSelection);
                                                                                }
                                                                            }
                                                                        }}
                                                                        className="px-6 py-4 text-xs font-mono text-gray-400 text-center group-hover:text-indigo-400 cursor-pointer hover:bg-indigo-50 transition-colors"
                                                                    >
                                                                        {i + 1}
                                                                    </td>
                                                                    {gridColumns.map(f => {
                                                                        const isEditing = editingCell?.rowId === row._id && editingCell?.fieldId === f.id;
                                                                        const isReadOnly = isCellReadOnly(row, f);
                                                                        const hasCalculation = !!f.logic?.calculation;

                                                                        const isSelected = selectedCells.some(c => c.rowId === row._id && c.fieldId === f.id);
                                                                        const isActive = selectedCell?.rowId === row._id && selectedCell?.fieldId === f.id;

                                                                        return (
                                                                            <td
                                                                                key={f.id}
                                                                                style={{ width: columnWidths[f.id] || 200, minWidth: columnWidths[f.id] || 200 }}
                                                                                onMouseDown={(e) => {
                                                                                    if (e.button !== 0) return; // Only left click (0)

                                                                                    if (e.shiftKey && selectionAnchor) {
                                                                                        // Range Selection (Keyboard or Click)
                                                                                        const startRowIdx = filteredRecords.findIndex(r => r._id === selectionAnchor.rowId);
                                                                                        const startColIdx = gridColumns.findIndex(c => c.id === selectionAnchor.fieldId);
                                                                                        const endRowIdx = filteredRecords.findIndex(r => r._id === row._id);
                                                                                        const endColIdx = gridColumns.findIndex(c => c.id === f.id);

                                                                                        if (startRowIdx !== -1 && startColIdx !== -1 && endRowIdx !== -1 && endColIdx !== -1) {
                                                                                            const minRow = Math.min(startRowIdx, endRowIdx);
                                                                                            const maxRow = Math.max(startRowIdx, endRowIdx);
                                                                                            const minCol = Math.min(startColIdx, endColIdx);
                                                                                            const maxCol = Math.max(startColIdx, endColIdx);

                                                                                            const newSelection = [];
                                                                                            for (let r = minRow; r <= maxRow; r++) {
                                                                                                for (let c = minCol; c <= maxCol; c++) {
                                                                                                    newSelection.push({ rowId: filteredRecords[r]._id, fieldId: gridColumns[c].id });
                                                                                                }
                                                                                            }
                                                                                            setSelectedCells(newSelection);
                                                                                        }
                                                                                    } else if (e.ctrlKey || e.metaKey) {
                                                                                        // Toggle Selection
                                                                                        const currentCell = { rowId: row._id, fieldId: f.id };
                                                                                        const exists = selectedCells.find(c => c.rowId === currentCell.rowId && c.fieldId === currentCell.fieldId);
                                                                                        if (exists) {
                                                                                            setSelectedCells(prev => prev.filter(c => c !== exists));
                                                                                        } else {
                                                                                            setSelectedCells(prev => [...prev, currentCell]);
                                                                                        }
                                                                                        setSelectedCell(currentCell);
                                                                                        setSelectionAnchor(currentCell);
                                                                                    } else {
                                                                                        // Single Selection and Start Drag selection
                                                                                        const currentCell = { rowId: row._id, fieldId: f.id };
                                                                                        setSelectedCell(currentCell);
                                                                                        setSelectedCells([currentCell]);
                                                                                        setSelectionAnchor(currentCell);
                                                                                        setIsDraggingSelection(true);
                                                                                    }
                                                                                }}
                                                                                onMouseEnter={() => {
                                                                                    if (isDraggingFill) {
                                                                                        // Only allow vertical fill for now, but strictly expand the EXISTING selection block.
                                                                                        if (selectedCells.length === 0) return;

                                                                                        // Get all indices
                                                                                        const rowIndices = selectedCells.map(c => filteredRecords.findIndex(r => r._id === c.rowId)).filter(i => i !== -1);
                                                                                        const colIndices = selectedCells.map(c => gridColumns.findIndex(col => col.id === c.fieldId)).filter(i => i !== -1);

                                                                                        if (rowIndices.length === 0 || colIndices.length === 0) return;

                                                                                        const minRow = Math.min(...rowIndices);
                                                                                        const maxRow = Math.max(...rowIndices);
                                                                                        const minCol = Math.min(...colIndices);
                                                                                        const maxCol = Math.max(...colIndices);

                                                                                        const currentRowIdx = i;

                                                                                        setFillRange({
                                                                                            startRowIndex: Math.min(minRow, currentRowIdx),
                                                                                            endRowIndex: Math.max(maxRow, currentRowIdx),
                                                                                            minColIndex: minCol,
                                                                                            maxColIndex: maxCol
                                                                                        });
                                                                                    } else if (isDraggingSelection && selectionAnchor) {
                                                                                        // Expand Selection based on Mouse Move
                                                                                        const startRowIdx = filteredRecords.findIndex(r => r._id === selectionAnchor.rowId);
                                                                                        const startColIdx = gridColumns.findIndex(c => c.id === selectionAnchor.fieldId);
                                                                                        const endRowIdx = i;
                                                                                        const endColIdx = gridColumns.findIndex(c => c.id === f.id);

                                                                                        if (startRowIdx !== -1 && startColIdx !== -1 && endRowIdx !== -1 && endColIdx !== -1) {
                                                                                            const minRow = Math.min(startRowIdx, endRowIdx);
                                                                                            const maxRow = Math.max(startRowIdx, endRowIdx);
                                                                                            const minCol = Math.min(startColIdx, endColIdx);
                                                                                            const maxCol = Math.max(startColIdx, endColIdx);

                                                                                            const newSelection = [];
                                                                                            for (let r = minRow; r <= maxRow; r++) {
                                                                                                for (let c = minCol; c <= maxCol; c++) {
                                                                                                    newSelection.push({ rowId: filteredRecords[r]._id, fieldId: gridColumns[c].id });
                                                                                                }
                                                                                            }
                                                                                            setSelectedCells(newSelection);
                                                                                            setSelectedCell({ rowId: filteredRecords[endRowIdx]._id, fieldId: gridColumns[endColIdx].id });
                                                                                        }
                                                                                    }
                                                                                }}
                                                                                onDoubleClick={() => !isReadOnly && setEditingCell({ rowId: row._id, fieldId: f.id })}
                                                                                className={`text-sm border-l border-transparent group-hover:border-indigo-100 max-w-xs select-none relative
                                                                                    ${isEditing ? 'bg-white px-1 py-1 z-20 shadow-inner' :
                                                                                        `px-6 py-4 whitespace-nowrap truncate ${isSelected ? 'bg-indigo-50/50 z-10 box-border' :
                                                                                            !isCellVisible(row, f) ? 'bg-slate-100/30' :
                                                                                                isReadOnly ? 'bg-slate-50/50 cursor-not-allowed' :
                                                                                                    'cursor-pointer hover:bg-white'}`}
                                                                                    ${hasCalculation && isReadOnly ? 'font-medium text-indigo-600' : 'text-gray-700'}
                                                                                    ${isActive && !isEditing ? 'ring-2 ring-indigo-500 ring-inset' : ''}
                                                                                    ${fillRange && i >= fillRange.startRowIndex && i <= fillRange.endRowIndex &&
                                                                                        gridColumns.findIndex(c => c.id === f.id) >= fillRange.minColIndex &&
                                                                                        gridColumns.findIndex(c => c.id === f.id) <= fillRange.maxColIndex
                                                                                        ? 'bg-indigo-100/50 ring-1 ring-indigo-300 ring-dashed z-20' : ''}
                                                                                `}
                                                                            >
                                                                                {/* Auto-fill Handle - Show only on the bottom-right cell of the SELECTION */}
                                                                                {(() => {
                                                                                    // Check if this cell is the bottom-right of the current selection block
                                                                                    const rowIndices = selectedCells.map(c => filteredRecords.findIndex(r => r._id === c.rowId));
                                                                                    const colIndices = selectedCells.map(c => gridColumns.findIndex(col => col.id === c.fieldId));
                                                                                    const maxRow = Math.max(...rowIndices);
                                                                                    const maxCol = Math.max(...colIndices);

                                                                                    // Current cell indices
                                                                                    const myRowIdx = i;
                                                                                    const myColIdx = gridColumns.findIndex(c => c.id === f.id);

                                                                                    const isBottomRight = myRowIdx === maxRow && myColIdx === maxCol;

                                                                                    // Protection: No fill for columns with calculations
                                                                                    if (hasCalculation) return false;

                                                                                    // Render handle if this is the bottom-right cell AND it is selected
                                                                                    return isBottomRight && isSelected && !isEditing;
                                                                                })() && (
                                                                                        <div
                                                                                            className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-indigo-600 cursor-crosshair z-30 transform translate-x-1/2 translate-y-1/2 border border-white hover:scale-125 transition-transform shadow-sm"
                                                                                            onMouseDown={(e) => {
                                                                                                e.stopPropagation();
                                                                                                e.preventDefault(); // Prevent text selection
                                                                                                setIsDraggingFill(true);
                                                                                                // Initial range is the selection itself
                                                                                                const rowIndices = selectedCells.map(c => filteredRecords.findIndex(r => r._id === c.rowId));
                                                                                                const colIndices = selectedCells.map(c => gridColumns.findIndex(col => col.id === c.fieldId));
                                                                                                setFillRange({
                                                                                                    startRowIndex: Math.min(...rowIndices),
                                                                                                    endRowIndex: Math.max(...rowIndices),
                                                                                                    minColIndex: Math.min(...colIndices),
                                                                                                    maxColIndex: Math.max(...colIndices)
                                                                                                });
                                                                                            }}
                                                                                        ></div>
                                                                                    )}

                                                                                {!isCellVisible(row, f) ? (
                                                                                    <span className="text-gray-300 italic text-[11px]">- Hidden -</span>
                                                                                ) : isEditing ? (
                                                                                    f.type === 'select' || f.type === 'radio' ? (
                                                                                        <select
                                                                                            autoFocus
                                                                                            className="w-full bg-white border-2 border-indigo-500 rounded-lg px-2 py-1 outline-none shadow-lg z-20"
                                                                                            value={row[f.id] || ''}
                                                                                            onChange={(e) => handleGridUpdate(row._id, f.id, e.target.value)}
                                                                                            onBlur={() => setEditingCell(null)}
                                                                                        >
                                                                                            <option value="">Select...</option>
                                                                                            {getFieldOptions(f, row).map((o: string) => <option key={o} value={o}>{o}</option>)}
                                                                                        </select>
                                                                                    ) : f.type === 'checkbox' ? (
                                                                                        <div className="flex items-center justify-center">
                                                                                            <input
                                                                                                type="checkbox"
                                                                                                autoFocus
                                                                                                checked={!!row[f.id]}
                                                                                                onChange={(e) => { handleGridUpdate(row._id, f.id, e.target.checked); setEditingCell(null); }}
                                                                                                onBlur={() => setEditingCell(null)}
                                                                                                className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                                                                                            />
                                                                                        </div>
                                                                                    ) : (
                                                                                        <div className="relative w-full">
                                                                                            <input
                                                                                                autoFocus
                                                                                                type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                                                                                                className={`w-full bg-white border-2 rounded-lg px-2 py-1 outline-none shadow-lg z-20 ${validateField(f, row[f.id], row) ? 'border-red-500' : 'border-indigo-500'}`}
                                                                                                value={row[f.id] || ''}
                                                                                                onChange={(e) => handleGridUpdate(row._id, f.id, e.target.value)}
                                                                                                onBlur={() => setEditingCell(null)}
                                                                                            />
                                                                                            {validateField(f, row[f.id], row) && (
                                                                                                <div className="absolute top-full left-0 mt-1 bg-red-600 text-white text-[10px] px-2 py-1 rounded shadow-xl z-30 animate-in fade-in slide-in-from-top-1 whitespace-normal min-w-[120px]">
                                                                                                    {validateField(f, row[f.id], row)}
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    )
                                                                                ) : (
                                                                                    <>
                                                                                        {f.type === 'checkbox' ? (
                                                                                            row[f.id] ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Yes</span> : <span className="text-gray-400 text-xs">No</span>
                                                                                        ) : (
                                                                                            <span className={isReadOnly ? 'opacity-70' : ''}>
                                                                                                {safeRenderValue(row[f.id]) || <span className="text-gray-300 italic">-</span>}
                                                                                            </span>
                                                                                        )}
                                                                                    </>
                                                                                )}
                                                                            </td>
                                                                        );
                                                                    })}
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
                                                        <button onClick={() => dataImportInputRef.current?.click()} className="text-xs font-bold text-gray-600 bg-white border border-gray-200 px-3 py-1.5 rounded hover:bg-gray-50 transition-colors flex items-center gap-1">
                                                            <Download size={14} /> Import
                                                        </button>
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
                                                                    <th
                                                                        key={f.id}
                                                                        className="px-4 py-3 text-xs font-bold text-gray-500 uppercase whitespace-nowrap border-l border-gray-100 relative group/resize-batch"
                                                                        style={{ width: columnWidths[f.id] || 200, minWidth: columnWidths[f.id] || 200 }}
                                                                    >
                                                                        <div
                                                                            onMouseDown={(e) => handleResizeStart(e, f.id)}
                                                                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-indigo-400 transition-colors z-20"
                                                                        ></div>
                                                                        <div className="truncate pr-2">
                                                                            {f.label} {f.required && <span className="text-red-500">*</span>}
                                                                        </div>
                                                                    </th>
                                                                ))}
                                                                <th className="px-4 py-3 w-10"></th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-100">
                                                            {batchRows.length === 0 ? (
                                                                <tr>
                                                                    <td colSpan={batchColumns.length + 2} className="px-6 py-16 text-center text-gray-400">
                                                                        <div className="flex flex-col items-center gap-3">
                                                                            <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center">
                                                                                <Download size={24} className="opacity-30" />
                                                                            </div>
                                                                            <p className="text-sm font-medium">No rows to import.</p>
                                                                            <div className="flex gap-4 justify-center mt-2">
                                                                                <button onClick={() => setBatchRows([{ tempId: Date.now(), data: {} }])} className="text-indigo-600 font-bold text-xs hover:underline">Add manually</button>
                                                                                <span className="text-gray-300">|</span>
                                                                                <button onClick={() => dataImportInputRef.current?.click()} className="text-indigo-600 font-bold text-xs hover:underline">Import from file</button>
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            ) : (
                                                                batchRows.map((row, idx) => (
                                                                    <tr key={row.tempId} className="group hover:bg-indigo-50/10">
                                                                        <td className="px-4 py-2 text-center text-xs text-gray-400 font-mono">{idx + 1}</td>
                                                                        {batchColumns.map(f => {
                                                                            const isVisible = isCellVisible(row.data, f);
                                                                            const isReadOnly = isCellReadOnly(row.data, f);

                                                                            return (
                                                                                <td
                                                                                    key={f.id}
                                                                                    className={`p-0 border-l border-gray-100 relative ${!isVisible ? 'bg-slate-50/50' : isReadOnly ? 'bg-slate-50' : ''}`}
                                                                                    style={{ width: columnWidths[f.id] || 200, minWidth: columnWidths[f.id] || 200 }}
                                                                                >
                                                                                    {!isVisible ? (
                                                                                        <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-300 font-medium italic bg-slate-100/20">
                                                                                            Hidden
                                                                                        </div>
                                                                                    ) : isReadOnly ? (
                                                                                        <div className="px-4 py-2 text-sm text-slate-400 italic flex items-center justify-between group/calc">
                                                                                            <span className="truncate">{row.data[f.id] || '-'}</span>
                                                                                        </div>
                                                                                    ) : f.type === 'select' ? (
                                                                                        <select
                                                                                            className="w-full px-4 py-2 text-sm bg-transparent outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 transition-all h-full"
                                                                                            value={row.data[f.id] || ''}
                                                                                            onChange={e => handleBatchUpdate(idx, f.id, e.target.value)}
                                                                                        >
                                                                                            <option value="">Select...</option>
                                                                                            {getFieldOptions(f, row.data).map((o: string) => <option key={o} value={o}>{o}</option>)}
                                                                                        </select>
                                                                                    ) : f.type === 'checkbox' ? (
                                                                                        <div className="flex items-center justify-center py-2 h-full">
                                                                                            <input
                                                                                                type="checkbox"
                                                                                                checked={!!row.data[f.id]}
                                                                                                onChange={e => handleBatchUpdate(idx, f.id, e.target.checked)}
                                                                                                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                                                                                            />
                                                                                        </div>
                                                                                    ) : (
                                                                                        <div className="relative w-full">
                                                                                            <input
                                                                                                type={f.type === 'number' ? 'number' : (f.type === 'date' ? 'date' : 'text')}
                                                                                                className={`w-full px-4 py-2 text-sm bg-transparent outline-none focus:bg-white focus:ring-2 transition-all placeholder-gray-300 ${validateField(f, row.data[f.id], row.data) ? 'focus:ring-red-500/20 text-red-600' : 'focus:ring-indigo-500/20'}`}
                                                                                                placeholder={f.label}
                                                                                                value={row.data[f.id] || ''}
                                                                                                onChange={e => handleBatchUpdate(idx, f.id, e.target.value)}
                                                                                            />
                                                                                            {validateField(f, row.data[f.id], row.data) && (
                                                                                                <div className="absolute right-2 top-1/2 -translate-y-1/2 text-red-500" title={validateField(f, row.data[f.id], row.data) || ''}>
                                                                                                    <AlertCircle size={14} />
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    )}
                                                                                </td>
                                                                            );
                                                                        })}
                                                                        <td className="px-2 text-center">
                                                                            <button onClick={() => setBatchRows(batchRows.filter((_, i) => i !== idx))} className="text-gray-300 hover:text-red-500 p-1 rounded hover:bg-red-50">
                                                                                <X size={14} />
                                                                            </button>
                                                                        </td>
                                                                    </tr>
                                                                ))
                                                            )}
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
                                                    formName={currentFormName}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
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
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            hidden
                                            accept=".xlsx, .xls, .csv"
                                            onChange={handleFileUpload}
                                        />
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg text-sm font-bold hover:shadow-lg transition-all shadow-md"
                                        >
                                            <Sparkles size={16} /> AI Import
                                        </button>
                                        <button
                                            onClick={() => setActiveTab('builder')}
                                            className="flex items-center gap-2 px-4 py-2 bg-white text-indigo-600 border border-indigo-200 rounded-lg text-sm font-bold hover:bg-indigo-50 hover:border-indigo-300 transition-all shadow-sm"
                                        >
                                            <ArrowRight size={16} /> Back to Builder
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {/* Create New Card */}
                                    <div
                                        onClick={() => {
                                            setSchema([]);
                                            setActiveDatasetId(null);
                                            setActiveFormId(null);
                                            setCurrentFormName('New Form');
                                            setActiveTab('builder');
                                            addToast('Created new blank form', 'info');
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
                                            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex items-center gap-1">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setRenameDialog({ isOpen: true, id: form.id, name: form.name, type: 'form' }); }}
                                                    className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                    title="Rename Template"
                                                >
                                                    <Edit3 size={16} />
                                                </button>
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
                                                Modify Template <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
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
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100">
                            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                                <h3 className="font-bold text-gray-800">Save Form Template</h3>
                                <button onClick={() => setSaveFormOpen(false)} className="p-1.5 hover:bg-gray-200 rounded-full text-gray-400 transition-colors"><X size={18} /></button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Template Name</label>
                                    <input
                                        autoFocus
                                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                                        placeholder="e.g., Q3 Survey"
                                        value={formName}
                                        onChange={e => setFormName(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Description</label>
                                    <textarea
                                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all h-24 resize-none font-medium"
                                        placeholder="Optional description..."
                                        value={formDesc}
                                        onChange={e => setFormDesc(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="px-6 py-4 bg-gray-50/80 flex justify-end gap-3 border-t border-gray-100">
                                <button onClick={() => setSaveFormOpen(false)} className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-xl transition-all">Cancel</button>
                                <button onClick={handleSaveForm} className="px-6 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-500/30 transition-all transform active:scale-95">Save Template</button>
                            </div>
                        </div>
                    </div>
                )
            }

            <ConfirmDialog
                isOpen={confirmDialog.isOpen}
                options={confirmDialog}
                onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
            />

            {/* --- AI Import Progress Modal --- */}
            {
                importProgress.isOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100">
                            <div className="p-6">
                                {importProgress.error ? (
                                    // Error State
                                    <div className="text-center">
                                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <AlertCircle size={32} className="text-red-500" />
                                        </div>
                                        <h3 className="text-lg font-bold text-gray-900 mb-2">Import Failed</h3>
                                        <p className="text-sm text-gray-600 mb-6">{importProgress.error}</p>
                                        <button
                                            onClick={() => setImportProgress({ isOpen: false, step: 0, message: '' })}
                                            className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg transition-colors"
                                        >
                                            Close
                                        </button>
                                    </div>
                                ) : (
                                    // Progress State
                                    <div>
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                                                <Sparkles size={24} className="text-white animate-pulse" />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold text-gray-900">AI Import</h3>
                                                <p className="text-xs text-gray-500">Generating form from spreadsheet</p>
                                            </div>
                                        </div>

                                        {/* Progress Bar */}
                                        <div className="mb-6">
                                            <div className="flex justify-between text-xs font-bold text-gray-500 mb-2">
                                                <span>Progress</span>
                                                <span>{Math.round((importProgress.step / 4) * 100)}%</span>
                                            </div>
                                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full transition-all duration-500 ease-out"
                                                    style={{ width: `${(importProgress.step / 4) * 100}%` }}
                                                />
                                            </div>
                                        </div>

                                        {/* Steps */}
                                        <div className="space-y-3">
                                            {[
                                                { num: 1, label: 'Reading file' },
                                                { num: 2, label: 'Extracting structure' },
                                                { num: 3, label: 'AI analyzing patterns' },
                                                { num: 4, label: 'Generating components' }
                                            ].map(s => (
                                                <div key={s.num} className={`flex items-center gap-3 p-3 rounded-lg transition-all ${importProgress.step >= s.num ? 'bg-indigo-50' : 'bg-gray-50'}`}>
                                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${importProgress.step > s.num ? 'bg-green-500 text-white' :
                                                        importProgress.step === s.num ? 'bg-indigo-500 text-white animate-pulse' :
                                                            'bg-gray-200 text-gray-400'
                                                        }`}>
                                                        {importProgress.step > s.num ? <Check size={14} /> : s.num}
                                                    </div>
                                                    <span className={`text-sm font-medium ${importProgress.step >= s.num ? 'text-gray-800' : 'text-gray-400'}`}>
                                                        {s.label}
                                                    </span>
                                                    {importProgress.step === s.num && (
                                                        <div className="ml-auto">
                                                            <RefreshCw size={14} className="text-indigo-500 animate-spin" />
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>

                                        <p className="text-center text-xs text-gray-400 mt-6">
                                            {importProgress.message}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* --- AI Builder Modal --- */}
            {
                aiBuilderModal.isOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100">
                            <div className="p-6">
                                {/* Header */}
                                <div className="flex items-center gap-3 mb-6">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${aiBuilderModal.mode === 'generate'
                                        ? 'bg-gradient-to-br from-purple-500 to-indigo-600'
                                        : 'bg-gradient-to-br from-emerald-500 to-teal-600'
                                        }`}>
                                        {aiBuilderModal.mode === 'generate'
                                            ? <Sparkles size={24} className="text-white" />
                                            : <FunctionSquare size={24} className="text-white" />
                                        }
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900">
                                            {aiBuilderModal.mode === 'generate' ? 'AI Form Generator' : 'AI Logic Configuration'}
                                        </h3>
                                        <p className="text-xs text-gray-500">
                                            {aiBuilderModal.mode === 'generate'
                                                ? 'Describe the form you need and AI will create it'
                                                : 'Describe the logic rules in natural language'
                                            }
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setAiBuilderModal({ isOpen: false, mode: 'generate', prompt: '', isLoading: false })}
                                        className="ml-auto p-2 hover:bg-gray-100 rounded-full transition-colors"
                                    >
                                        <X size={20} className="text-gray-400" />
                                    </button>
                                </div>

                                {/* Mode Toggle */}
                                <div className="flex gap-2 p-1 bg-gray-100 rounded-lg mb-4">
                                    <button
                                        onClick={() => setAiBuilderModal(prev => ({ ...prev, mode: 'generate', prompt: '' }))}
                                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-xs font-bold transition-all ${aiBuilderModal.mode === 'generate' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500'}`}
                                    >
                                        <Sparkles size={14} /> Generate Form
                                    </button>
                                    <button
                                        onClick={() => setAiBuilderModal(prev => ({ ...prev, mode: 'logic', prompt: '' }))}
                                        disabled={schema.length === 0}
                                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-xs font-bold transition-all ${aiBuilderModal.mode === 'logic' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500'} disabled:opacity-50`}
                                    >
                                        <FunctionSquare size={14} /> Configure Logic
                                    </button>
                                </div>

                                {/* Prompt Input */}
                                <div className="mb-4">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                                        {aiBuilderModal.mode === 'generate' ? 'Form Description' : 'Logic Description'}
                                    </label>
                                    <textarea
                                        value={aiBuilderModal.prompt}
                                        onChange={(e) => setAiBuilderModal(prev => ({ ...prev, prompt: e.target.value }))}
                                        placeholder={aiBuilderModal.mode === 'generate'
                                            ? 'E.g., Create a customer feedback form with name, email, satisfaction rating, and comments...'
                                            : 'E.g., When status is "approved", make the approval_date field required and quantity multiplied by price equals total...'
                                        }
                                        className="w-full h-32 border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                        disabled={aiBuilderModal.isLoading}
                                    />
                                </div>

                                {/* Example Prompts */}
                                <div className="mb-4">
                                    <p className="text-[10px] text-gray-400 uppercase font-bold mb-2">Example prompts:</p>
                                    <div className="flex flex-wrap gap-2">
                                        {(aiBuilderModal.mode === 'generate' ? [
                                            'Employee registration form',
                                            'Product inventory form',
                                            'Customer survey with rating',
                                            '订单录入表单包含商品、数量、价格'
                                        ] : [
                                            'Total = quantity × unit_price',
                                            'Show discount field when total > 1000',
                                            'Make email required when contact_method is email',
                                            '当状态为已批准时，审批日期必填'
                                        ]).map((example, i) => (
                                            <button
                                                key={i}
                                                onClick={() => setAiBuilderModal(prev => ({ ...prev, prompt: example }))}
                                                className="text-[10px] px-2 py-1 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-full transition-colors"
                                            >
                                                {example}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Error Message */}
                                {aiBuilderModal.error && (
                                    <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600 flex items-center gap-2">
                                        <AlertCircle size={16} />
                                        {aiBuilderModal.error}
                                    </div>
                                )}

                                {/* Current Schema Info (for Logic mode) */}
                                {aiBuilderModal.mode === 'logic' && schema.length > 0 && (
                                    <div className="mb-4 p-3 bg-emerald-50 border border-emerald-100 rounded-lg">
                                        <p className="text-xs text-emerald-700 font-medium">
                                            Current form has {schema.length} fields: {schema.slice(0, 5).map(f => f.label || f.id).join(', ')}{schema.length > 5 ? '...' : ''}
                                        </p>
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setAiBuilderModal({ isOpen: false, mode: 'generate', prompt: '', isLoading: false })}
                                        className="px-4 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                        disabled={aiBuilderModal.isLoading}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleAIGenerate}
                                        disabled={!aiBuilderModal.prompt.trim() || aiBuilderModal.isLoading}
                                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white rounded-lg transition-all disabled:opacity-50 ${aiBuilderModal.mode === 'generate'
                                            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:shadow-lg'
                                            : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:shadow-lg'
                                            }`}
                                    >
                                        {aiBuilderModal.isLoading ? (
                                            <>
                                                <RefreshCw size={16} className="animate-spin" />
                                                Processing...
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles size={16} />
                                                {aiBuilderModal.mode === 'generate' ? 'Generate Form' : 'Apply Logic'}
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* --- Save Dataset Modal --- */}
            {
                saveDatasetOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100">
                            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-800">保存数据选项</h3>
                                    <p className="text-xs text-gray-500 mt-1">选择如何保存当前数据</p>
                                </div>
                                <button onClick={() => setSaveDatasetOpen(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400"><X size={20} /></button>
                            </div>

                            <div className="p-6 space-y-6">
                                {/* Context Info */}
                                {hasActiveFilters ? (
                                    <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                                        <div className="flex items-center gap-2 text-indigo-700 mb-2 font-bold text-xs uppercase tracking-wider">
                                            <Filter size={14} /> 筛选模式已开启
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                                            <div className="bg-white/60 p-2 rounded-lg border border-indigo-200/50">
                                                <span className="text-gray-500 block">全部数据</span>
                                                <span className="text-indigo-600 font-bold text-sm">{records.length} 条</span>
                                            </div>
                                            <div className="bg-white/60 p-2 rounded-lg border border-indigo-200/50">
                                                <span className="text-gray-500 block">当前筛选</span>
                                                <span className="text-indigo-600 font-bold text-sm">{filteredRecords.length} 条</span>
                                            </div>
                                        </div>
                                    </div>
                                ) : activeDatasetId && (
                                    <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-3">
                                        <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600"><Database size={20} /></div>
                                        <div>
                                            <span className="text-[10px] font-bold text-emerald-600 uppercase">当前表格</span>
                                            <div className="text-sm font-bold text-gray-800">{savedDatasets.find(d => d.id === activeDatasetId)?.name}</div>
                                        </div>
                                    </div>
                                )}

                                {/* Name Input - Only show if user might save as new */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center justify-between">
                                        <span>新表格名称</span>
                                        {datasetNameInput.trim() === '' && <span className="text-red-400 capitalize normal-case font-medium">另存为必填</span>}
                                    </label>
                                    <input
                                        autoFocus
                                        value={datasetNameInput}
                                        onChange={(e) => setDatasetNameInput(e.target.value)}
                                        placeholder="例如：测试数据 2.0"
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-sm"
                                    />
                                </div>

                                {/* Action Buttons */}
                                <div className="space-y-3">
                                    {/* Option 1: Save Filtered as NEW (Only if filters active) */}
                                    {hasActiveFilters && (
                                        <div className="space-y-1">
                                            <button
                                                onClick={() => handleSaveDataset(true)}
                                                disabled={!datasetNameInput.trim()}
                                                className="w-full group relative flex items-center gap-4 p-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:bg-gray-400 text-white rounded-xl transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
                                            >
                                                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                                                    <Filter size={18} />
                                                </div>
                                                <div className="text-left flex-1 min-w-0">
                                                    <div className="text-xs font-bold leading-none mb-1">仅保存筛选结果 (另存为)</div>
                                                    <div className="text-[10px] text-white/70 truncate">将 {filteredRecords.length} 条记录保存为新数据集</div>
                                                </div>
                                                <ArrowRight size={16} className="text-white/50 group-hover:translate-x-1 transition-transform" />
                                            </button>
                                        </div>
                                    )}

                                    {/* Option 2: Save All to CURRENT (Only if activeDatasetId) */}
                                    {activeDatasetId && (
                                        <button
                                            onClick={() => { handleUpdateActiveDataset(); setSaveDatasetOpen(false); }}
                                            className="w-full group flex items-center gap-4 p-4 border-2 border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/30 text-slate-700 rounded-xl transition-all"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                                                <Save size={18} />
                                            </div>
                                            <div className="text-left flex-1">
                                                <div className="text-xs font-bold leading-none mb-1 text-slate-800">更新到当前表格</div>
                                                <div className="text-[10px] text-slate-500">仅保存全部 {records.length} 条原始数据</div>
                                            </div>
                                            <Check size={16} className="text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </button>
                                    )}

                                    {/* Option 3: Save All as NEW */}
                                    <button
                                        onClick={() => handleSaveDataset(false)}
                                        disabled={!datasetNameInput.trim()}
                                        className="w-full group flex items-center gap-4 p-4 border-2 border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 text-slate-700 rounded-xl transition-all disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:border-slate-100"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-600 flex items-center justify-center shrink-0 transition-colors">
                                            <Plus size={18} />
                                        </div>
                                        <div className="text-left flex-1">
                                            <div className="text-xs font-bold leading-none mb-1 text-slate-800">保存全部数据为新表格</div>
                                            <div className="text-[10px] text-slate-500">将全部 {records.length} 条记录另存为</div>
                                        </div>
                                        <ArrowRight size={16} className="text-slate-300 group-hover:text-indigo-400 group-hover:translate-x-1 transition-transform" />
                                    </button>

                                    <button
                                        onClick={() => setSaveDatasetOpen(false)}
                                        className="w-full py-2 text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors"
                                    >
                                        取消
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* Rename Dataset Dialog */}
            {
                renameDialog.isOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200 border border-gray-100">
                            <div className="mb-4">
                                <h3 className="text-lg font-bold text-gray-800">Rename {renameDialog.type === 'form' ? 'Template' : 'Dataset'}</h3>
                                <p className="text-xs text-gray-500 mt-1">
                                    Enter a new name for this {renameDialog.type === 'form' ? 'form template' : 'dataset'}.
                                </p>
                            </div>
                            <div className="mb-6 space-y-3">
                                <label className="text-xs font-bold text-gray-500 uppercase">New Name</label>
                                <input
                                    autoFocus
                                    value={renameDialog.name}
                                    onChange={(e) => setRenameDialog(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="Dataset Name"
                                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                                    onKeyDown={(e) => e.key === 'Enter' && handleRenameSubmit()}
                                />
                            </div>
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setRenameDialog(prev => ({ ...prev, isOpen: false }))}
                                    className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleRenameSubmit}
                                    className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm"
                                >
                                    Rename
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
            {
                deleteGroupDialog.isOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200 border border-gray-100">
                            <div className="mb-4">
                                <h3 className="text-lg font-bold text-red-600 flex items-center gap-2">
                                    <Trash2 size={20} /> Delete Folder
                                </h3>
                                <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                                    You are deleting <span className="font-bold text-gray-800">"{deleteGroupDialog.groupName}"</span>.
                                    <br />What do you want to do with the datasets inside it?
                                </p>
                            </div>
                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={() => executeDeleteGroup('move_to_root')}
                                    className="w-full px-4 py-3 text-sm font-bold text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors text-left flex items-center gap-3 group"
                                >
                                    <div className="p-2 bg-white rounded-lg border border-gray-100 text-indigo-500 group-hover:border-indigo-200 group-hover:bg-indigo-50 transition-colors">
                                        <Database size={16} />
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-bold text-gray-800">Move to Root</div>
                                        <div className="text-[10px] text-gray-400 font-normal">Keep datasets, only delete folder</div>
                                    </div>
                                </button>
                                <button
                                    onClick={() => executeDeleteGroup('delete_all')}
                                    className="w-full px-4 py-3 text-sm font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-100 rounded-xl transition-colors text-left flex items-center gap-3 group"
                                >
                                    <div className="p-2 bg-white rounded-lg border border-red-100 text-red-500 group-hover:border-red-200 group-hover:bg-red-50 transition-colors">
                                        <Trash2 size={16} />
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-bold text-red-700">Delete Everything</div>
                                        <div className="text-[10px] text-red-400 font-normal">Delete folder AND all its datasets</div>
                                    </div>
                                </button>
                                <button
                                    onClick={() => setDeleteGroupDialog({ isOpen: false, groupId: '', groupName: '' })}
                                    className="w-full px-4 py-2 text-sm font-bold text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors mt-1"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
            {renderFillMenu()}

            {/* Export Naming Dialog - Global Modal */}
            {exportNamingDialog.open && (
                <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-black tracking-tight">完善导出信息</h3>
                                    <p className="text-indigo-100 text-xs font-medium mt-1 opacity-80">请为以下自定义变量选择具体值</p>
                                </div>
                                <div className="p-2.5 bg-white/10 rounded-xl">
                                    <FileText className="text-white" size={22} />
                                </div>
                            </div>
                        </div>

                        {/* Variable Selection Forms */}
                        <div className="p-6 space-y-5 max-h-[50vh] overflow-y-auto">
                            {/* Project Selection */}
                            {namingRules.filter(r => r.type === 'project').map(rule => (
                                <div key={rule.id} className="space-y-2">
                                    <label className="text-xs font-extrabold text-slate-500 uppercase tracking-widest pl-1 flex items-center gap-2">
                                        <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                                        项目名称 Project
                                    </label>
                                    <select
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                                        value={exportNamingDialog.variableOverrides[rule.id] || ''}
                                        onChange={(e) => setExportNamingDialog(prev => ({
                                            ...prev,
                                            variableOverrides: { ...prev.variableOverrides, [rule.id]: e.target.value }
                                        }))}
                                    >
                                        {activeProjects.map(proj => (
                                            <option key={proj.id} value={proj.info.name}>{proj.info.name}</option>
                                        ))}
                                    </select>
                                </div>
                            ))}

                            {/* Personnel Selection */}
                            {namingRules.filter(r => r.type === 'personnel').map(rule => (
                                <div key={rule.id} className="space-y-2">
                                    <label className="text-xs font-extrabold text-slate-500 uppercase tracking-widest pl-1 flex items-center gap-2">
                                        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                        人员名称 Personnel
                                    </label>
                                    <select
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                                        value={exportNamingDialog.variableOverrides[rule.id] || ''}
                                        onChange={(e) => setExportNamingDialog(prev => ({
                                            ...prev,
                                            variableOverrides: { ...prev.variableOverrides, [rule.id]: e.target.value }
                                        }))}
                                    >
                                        {activeTeamMembers.map(member => (
                                            <option key={member.id} value={member.name}>{member.name}</option>
                                        ))}
                                    </select>
                                </div>
                            ))}

                            {/* Custom Variables Selection */}
                            {namingRules.filter(r => r.type === 'variable').map(rule => {
                                const variableDef = namingVariables.find(v => v.id === rule.variableId);
                                if (!variableDef) return null;

                                const currentValue = exportNamingDialog.variableOverrides[rule.id] || variableDef.defaultValue;

                                return (
                                    <div key={rule.id} className="space-y-2">
                                        <label className="text-xs font-extrabold text-slate-500 uppercase tracking-widest pl-1 flex items-center gap-2">
                                            <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                                            {variableDef.name}
                                        </label>

                                        {variableDef.options.length <= 5 ? (
                                            <div className="flex flex-wrap gap-2">
                                                {variableDef.options.map(opt => {
                                                    const isSelected = currentValue === opt;
                                                    return (
                                                        <button
                                                            key={opt}
                                                            onClick={() => setExportNamingDialog(prev => ({
                                                                ...prev,
                                                                variableOverrides: { ...prev.variableOverrides, [rule.id]: opt }
                                                            }))}
                                                            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all border-2 ${isSelected
                                                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200'
                                                                : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-400 hover:text-indigo-600'
                                                                }`}
                                                        >
                                                            {opt}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <select
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                                                value={currentValue}
                                                onChange={(e) => setExportNamingDialog(prev => ({
                                                    ...prev,
                                                    variableOverrides: { ...prev.variableOverrides, [rule.id]: e.target.value }
                                                }))}
                                            >
                                                {variableDef.options.map(opt => (
                                                    <option key={opt} value={opt}>{opt}</option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Real-time Filename Preview - Light Background */}
                        <div className="mx-6 mb-6 bg-gradient-to-r from-slate-50 to-indigo-50 rounded-xl p-4 border border-slate-200">
                            <span className="text-[10px] uppercase font-bold text-slate-500 mb-2 block tracking-widest">预计文件名 Preview</span>
                            <div className="font-mono text-sm text-indigo-700 font-medium break-all">
                                {generateFilename(exportNamingDialog.variableOverrides, exportNamingDialog.exportParams?.quantityMultiplier || 1)}.xlsx
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
                            <button
                                onClick={() => setExportNamingDialog({ open: false, variableOverrides: {}, exportParams: null })}
                                className="px-6 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                            >
                                取消
                            </button>
                            <button
                                onClick={() => {
                                    const { exportParams, variableOverrides } = exportNamingDialog;
                                    if (exportParams) {
                                        executeExport(
                                            exportParams.datasetId,
                                            exportParams.viewNames,
                                            exportParams.hiddenFields,
                                            exportParams.configRules,
                                            exportParams.quantityMultiplier,
                                            variableOverrides
                                        );
                                    }
                                    setExportNamingDialog({ open: false, variableOverrides: {}, exportParams: null });
                                }}
                                className="px-8 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center gap-2"
                            >
                                <Download size={14} /> 确定导出
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
