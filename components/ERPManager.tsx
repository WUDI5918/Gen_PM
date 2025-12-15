
import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
    Plus, Trash2, GripVertical, Code, Eye, Save, Type, List,
    CheckSquare, Calendar, Hash, ArrowDown,
    Minus, AlertCircle, Info, Table as TableIcon,
    RefreshCw, X, MoveVertical, AlertTriangle, CheckCircle, Bell,
    Filter, Search, Bookmark, Download, Upload, Copy, Grid,
    Settings2, LayoutTemplate, Circle as CircleIcon,
    ChevronRight, ChevronDown, MoreHorizontal, Database, ArrowRight,
    Maximize2, Columns, Edit3, Check, ChevronUp, Layers, BoxSelect
} from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

// --- Configuration Constants ---
const InitialSchema = [
    { id: 'f_title', type: 'divider', label: '基本信息', width: '100%' },
    { id: 'f_notice_1', type: 'notice', label: '填写说明', width: '100%', noticeType: 'info', content: '请确保所有产品数据与 ERP 物料主数据保持一致。' },
    { id: 'f1', type: 'text', label: '产品名称', required: true, width: '50%', placeholder: '请输入产品全称', helpText: '例如：304不锈钢螺丝 M4*12' },
    { id: 'f2', type: 'select', label: '产品分类', required: true, width: '50%', options: ['电子元器件', '机械结构件', '耗材'] },
    { id: 'f_stock', type: 'divider', label: '库存控制', width: '100%' },
    { id: 'f3', type: 'number', label: '安全库存', required: true, width: '50%', placeholder: '0', min: 0 },
    { id: 'f4', type: 'radio', label: '检验方式', required: true, width: '50%', options: ['全检', '抽检', '免检'] },
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

// --- Sub-Components ---

// 1. Redesigned Toolbox Item (Premium Ghost Style)
const ToolboxItem = ({ type, label, icon: Icon, onClick, colorClass = "text-slate-500" }: any) => (
    <button
        onClick={() => onClick(type)}
        className="group flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-slate-100/80 transition-all active:scale-95 text-left border border-transparent hover:border-slate-200/50"
    >
        <div className={`p-1.5 rounded-md shadow-sm border border-slate-200 bg-white group-hover:scale-105 transition-all duration-200 ${colorClass}`}>
            <Icon size={15} strokeWidth={2.5} />
        </div>
        <span className="text-xs font-semibold text-slate-600 group-hover:text-slate-900 tracking-tight">{label}</span>
    </button>
);

// 2. Left Side Field Editor (Canvas Item + Properties)
const FieldEditor = ({
    field, index, isActive, onClick, onUpdate, onRemove, onUpdateOption, onAddOption, onRemoveOption, onDragStart, onDragEnter, onDragEnd
}: any) => {
    const isLayout = ['divider', 'notice', 'spacer'].includes(field.type);
    const hasOptions = ['select', 'radio'].includes(field.type);

    const IconMap: any = {
        text: Type, number: Hash, select: List, radio: CircleIcon, checkbox: CheckSquare,
        date: Calendar, divider: Minus, notice: Bell, spacer: MoveVertical
    };
    const Icon = IconMap[field.type] || Type;

    return (
        <div
            draggable
            onDragStart={(e) => onDragStart(e, index)}
            onDragEnter={(e) => onDragEnter(e, index)}
            onDragEnd={onDragEnd}
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            className={`relative group transition-all duration-300 mb-3 rounded-xl border cursor-pointer overflow-hidden
        ${isActive
                    ? 'bg-white border-indigo-500 ring-4 ring-indigo-500/10 shadow-lg z-10'
                    : 'bg-white border-slate-200 hover:border-indigo-300 hover:shadow-md'
                }
      `}
        >
            {/* Header / Summary View */}
            <div className="p-3 pl-2 flex items-center gap-3 select-none">
                <div className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 p-1">
                    <GripVertical size={16} />
                </div>

                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isActive ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                    <Icon size={16} />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold truncate ${isActive ? 'text-slate-900' : 'text-slate-700'}`}>
                            {field.label}
                        </span>
                        {field.required && <span className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-bold">Req</span>}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono uppercase tracking-wide">
                        {field.type}
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    <button onClick={(e) => { e.stopPropagation(); onRemove(field.id); }} className="text-slate-300 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100">
                        <Trash2 size={16} />
                    </button>
                    {isActive ? <ChevronUp size={16} className="text-indigo-500" /> : <ChevronDown size={16} className="text-slate-300" />}
                </div>
            </div>

            {/* Expanded Properties Panel */}
            {isActive && (
                <div className="px-4 pb-4 pt-0 animate-in slide-in-from-top-2 duration-200" onClick={e => e.stopPropagation()}>
                    <div className="h-px bg-slate-100 w-full mb-4"></div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2 sm:col-span-1">
                            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Field Label</label>
                            <input
                                value={field.label}
                                onChange={(e) => onUpdate(field.id, 'label', e.target.value)}
                                className="w-full text-xs px-2 py-1.5 bg-slate-50 border border-slate-200 rounded focus:bg-white focus:border-indigo-500 outline-none transition-all"
                            />
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Width</label>
                            <div className="flex bg-slate-100 p-0.5 rounded border border-slate-200">
                                {['50%', '100%'].map(w => (
                                    <button
                                        key={w}
                                        onClick={() => onUpdate(field.id, 'width', w)}
                                        className={`flex-1 text-[10px] font-bold py-1 rounded-sm transition-all ${field.width === w ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        {w}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {!isLayout && (
                            <div className="col-span-2 space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Placeholder</label>
                                        <input
                                            value={field.placeholder || ''}
                                            onChange={(e) => onUpdate(field.id, 'placeholder', e.target.value)}
                                            className="w-full text-xs px-2 py-1.5 bg-slate-50 border border-slate-200 rounded focus:bg-white focus:border-indigo-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Help Text</label>
                                        <input
                                            value={field.helpText || ''}
                                            onChange={(e) => onUpdate(field.id, 'helpText', e.target.value)}
                                            className="w-full text-xs px-2 py-1.5 bg-slate-50 border border-slate-200 rounded focus:bg-white focus:border-indigo-500 outline-none"
                                        />
                                    </div>
                                </div>

                                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 font-bold select-none w-fit p-1 rounded hover:bg-slate-50">
                                    <input
                                        type="checkbox"
                                        checked={field.required}
                                        onChange={(e) => onUpdate(field.id, 'required', e.target.checked)}
                                        className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                                    />
                                    Required Field
                                </label>
                            </div>
                        )}

                        {field.type === 'notice' && (
                            <div className="col-span-2 space-y-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Alert Type</label>
                                    <div className="flex gap-2">
                                        {['info', 'warning', 'error', 'success'].map(type => (
                                            <button key={type} onClick={() => onUpdate(field.id, 'noticeType', type)} className={`px-2 py-1 rounded text-[10px] font-bold capitalize border transition-colors ${field.noticeType === type ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{type}</button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Content</label>
                                    <textarea rows={2} value={field.content || ''} onChange={(e) => onUpdate(field.id, 'content', e.target.value)} className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs focus:outline-none focus:border-indigo-500 transition-colors" />
                                </div>
                            </div>
                        )}

                        {hasOptions && (
                            <div className="col-span-2 bg-slate-50 p-3 rounded-lg border border-slate-200 mt-1">
                                <label className="block text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-wider">Options</label>
                                <div className="space-y-1.5">
                                    {field.options?.map((opt: string, idx: number) => (
                                        <div key={idx} className="flex gap-2 items-center group/opt">
                                            <div className="w-1 h-1 bg-slate-300 rounded-full group-hover/opt:bg-indigo-400 transition-colors"></div>
                                            <input value={opt} onChange={(e) => onUpdateOption(field.id, idx, e.target.value)} className="flex-1 px-2 py-1 bg-white border border-slate-200 rounded text-xs focus:border-indigo-500 outline-none transition-colors" />
                                            <button onClick={() => onRemoveOption(field.id, idx)} className="text-slate-400 hover:text-red-500 p-1 bg-white hover:bg-red-50 rounded border border-transparent hover:border-red-100 transition-all"><Trash2 size={12} /></button>
                                        </div>
                                    ))}
                                    <button onClick={() => onAddOption(field.id)} className="text-[10px] text-indigo-600 font-bold flex items-center gap-1 hover:bg-indigo-50 px-2 py-1.5 rounded transition-colors mt-2 border border-dashed border-indigo-200 hover:border-indigo-400 w-full justify-center">
                                        <Plus size={12} /> Add Option
                                    </button>
                                </div>
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

    const handleChange = (id: string, value: any) => {
        setData((prev: any) => ({ ...prev, [id]: value }));
        // Clear error if exists
        if (errors && errors[id]) {
            setErrors((prev: any) => {
                const newErrors = { ...prev };
                delete newErrors[id];
                return newErrors;
            });
        }
    };

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
                                {field.required && <span className="text-red-500 ml-1">*</span>}
                            </label>

                            {['text', 'number', 'date', 'time', 'email', 'tel'].includes(field.type) && (
                                <input
                                    type={field.type === 'text' ? 'text' : field.type}
                                    className={`w-full border rounded-xl px-4 py-3 text-sm outline-none transition-all ${isError ? 'border-red-300 bg-red-50 focus:border-red-500' : 'border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'}`}
                                    placeholder={field.placeholder}
                                    value={data[field.id] || ''}
                                    onChange={(e) => handleChange(field.id, e.target.value)}
                                />
                            )}

                            {field.type === 'select' && (
                                <div className="relative">
                                    <select
                                        className={`w-full border rounded-xl px-4 py-3 text-sm outline-none transition-all appearance-none cursor-pointer ${isError ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'}`}
                                        value={data[field.id] || ''}
                                        onChange={(e) => handleChange(field.id, e.target.value)}
                                    >
                                        <option value="">Select an option...</option>
                                        {field.options?.map((opt: string) => (
                                            <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                    <ArrowDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                </div>
                            )}

                            {field.type === 'radio' && (
                                <div className="flex flex-wrap gap-3 mt-1">
                                    {field.options?.map((opt: string) => (
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
                                            />
                                        </label>
                                    ))}
                                </div>
                            )}

                            {field.type === 'checkbox' && (
                                <label className={`flex items-center gap-3 cursor-pointer p-3 rounded-xl border transition-all ${data[field.id] ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-200 hover:bg-white'}`}>
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${data[field.id] ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300'}`}>
                                        {data[field.id] && <Check size={14} />}
                                    </div>
                                    <span className={`text-sm font-medium ${data[field.id] ? 'text-indigo-900' : 'text-slate-700'}`}>{field.label}</span>
                                    <input
                                        type="checkbox"
                                        className="hidden"
                                        checked={!!data[field.id]}
                                        onChange={(e) => handleChange(field.id, e.target.checked)}
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

// --- Main App Component ---
export const ERPManager: React.FC = () => {
    const { addToast } = useToast();

    // State
    const [activeTab, setActiveTab] = useState<'builder' | 'data'>('builder');
    const [subView, setSubView] = useState<'table' | 'preview' | 'batch'>('table'); // Data sub-views

    // Schema State
    const [schema, setSchema] = useState(InitialSchema);
    const [activeFieldId, setActiveFieldId] = useState<string | null>(null);

    // Data State
    const [records, setRecords] = useState<any[]>([]);
    const [previewData, setPreviewData] = useState<any>({});
    const [batchRows, setBatchRows] = useState<any[]>([]);

    // Advanced Filter State
    const [filters, setFilters] = useState<{ id: string, fieldId: string, operator: string, value: string }[]>([]);
    const [pendingFilter, setPendingFilter] = useState({ fieldId: '', operator: '', value: '' });
    const [savedViews, setSavedViews] = useState<{ name: string, filters: any[] }[]>([
        { name: '库存预警', filters: [{ id: 'demo_1', fieldId: 'f3', operator: 'lt', value: '10' }] }
    ]);
    const [viewName, setViewName] = useState('');

    const [globalSearch, setGlobalSearch] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    const [errors, setErrors] = useState<Record<string, string>>({});

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
    const addField = (type: string) => {
        const newField = {
            id: `f_${Date.now()}`,
            type,
            label: type === 'divider' ? 'Section' : type === 'notice' ? 'Notice' : 'New Field',
            required: false,
            width: '100%',
            options: ['Option 1', 'Option 2'],
            placeholder: '',
            helpText: ''
        };
        setSchema([...schema, newField]);
        setActiveFieldId(newField.id);

        // Scroll to bottom of canvas (simple implementation)
        setTimeout(() => {
            const el = document.getElementById('canvas-container');
            if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
        }, 100);
    };

    const removeField = (id: string) => {
        setSchema(schema.filter(f => f.id !== id));
        if (activeFieldId === id) setActiveFieldId(null);
    };

    const updateField = (id: string, key: string, value: any) => {
        setSchema(schema.map(f => f.id === id ? { ...f, [key]: value } : f));
    };

    const updateOption = (id: string, idx: number, val: string) => {
        setSchema(schema.map(f => {
            if (f.id !== id) return f;
            const newOpts = [...(f.options || [])];
            newOpts[idx] = val;
            return { ...f, options: newOpts };
        }));
    };

    const addOption = (id: string) => {
        setSchema(schema.map(f => {
            if (f.id !== id) return f;
            return { ...f, options: [...(f.options || []), 'New Option'] };
        }));
    };

    const removeOption = (id: string, idx: number) => {
        setSchema(schema.map(f => {
            if (f.id !== id) return f;
            return { ...f, options: (f.options || []).filter((_, i) => i !== idx) };
        }));
    };

    const handleDragSort = () => {
        if (dragItem.current !== null && dragOverItem.current !== null) {
            const _schema = [...schema];
            const draggedItemContent = _schema.splice(dragItem.current, 1)[0];
            _schema.splice(dragOverItem.current, 0, draggedItemContent);
            setSchema(_schema);
        }
        dragItem.current = null; dragOverItem.current = null;
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
        if (confirm('Delete this record?')) {
            setRecords(prev => prev.filter(r => r._id !== id));
        }
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

    // Data columns only
    const dataColumns = schema.filter(f => !['divider', 'notice', 'spacer'].includes(f.type));

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
                </div>

                <div className="flex items-center gap-2">
                    <button className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Bell size={18} /></button>
                    <div className="h-6 w-px bg-gray-200 mx-1"></div>
                    <div className="w-8 h-8 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-xs font-bold text-indigo-700">JS</div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 overflow-hidden relative flex flex-col">

                {/* === BUILDER MODE === */}
                {activeTab === 'builder' && (
                    <div className="flex flex-1 overflow-hidden animate-in fade-in duration-300">

                        {/* 1. New Left Sidebar Toolbox */}
                        <div className="w-16 lg:w-48 bg-white border-r border-gray-200 flex flex-col shrink-0 z-20 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)]">
                            <div className="p-4 border-b border-gray-100 hidden lg:block">
                                <h3 className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">Components</h3>
                            </div>

                            <div className="flex-1 overflow-y-auto p-2 space-y-6 custom-scrollbar">
                                {/* Group: Inputs */}
                                <div className="space-y-1">
                                    <div className="hidden lg:block px-2 text-[10px] font-bold text-gray-400 uppercase mb-2">Inputs</div>
                                    <ToolboxItem type="text" label="Text" icon={Type} onClick={addField} colorClass="text-blue-600" />
                                    <ToolboxItem type="number" label="Number" icon={Hash} onClick={addField} colorClass="text-emerald-600" />
                                    <ToolboxItem type="date" label="Date" icon={Calendar} onClick={addField} colorClass="text-orange-600" />
                                </div>

                                {/* Group: Choices */}
                                <div className="space-y-1">
                                    <div className="hidden lg:block px-2 text-[10px] font-bold text-gray-400 uppercase mb-2">Choices</div>
                                    <ToolboxItem type="select" label="Select" icon={List} onClick={addField} colorClass="text-purple-600" />
                                    <ToolboxItem type="radio" label="Radio" icon={CircleIcon} onClick={addField} colorClass="text-pink-600" />
                                    <ToolboxItem type="checkbox" label="Checkbox" icon={CheckSquare} onClick={addField} colorClass="text-teal-600" />
                                </div>

                                {/* Group: Layout */}
                                <div className="space-y-1">
                                    <div className="hidden lg:block px-2 text-[10px] font-bold text-gray-400 uppercase mb-2">Layout</div>
                                    <ToolboxItem type="divider" label="Divider" icon={Minus} onClick={addField} colorClass="text-gray-600" />
                                    <ToolboxItem type="notice" label="Notice" icon={Bell} onClick={addField} colorClass="text-amber-600" />
                                    <ToolboxItem type="spacer" label="Spacer" icon={MoveVertical} onClick={addField} colorClass="text-gray-400" />
                                </div>
                            </div>
                        </div>

                        {/* 2. Middle: Canvas (Builder List) */}
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
                                    <div className="text-xs font-mono text-gray-300 bg-gray-100 px-2 py-1 rounded">v1.0</div>
                                </div>

                                {schema.length === 0 ? (
                                    <div className="h-96 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-400 bg-white/50 hover:bg-white/80 transition-colors cursor-pointer" onClick={() => addField('text')}>
                                        <div className="p-4 bg-slate-50 rounded-full mb-4">
                                            <LayoutTemplate size={32} className="opacity-50" />
                                        </div>
                                        <p className="font-bold text-sm">Form is Empty</p>
                                        <p className="text-xs mt-1">Select a component from the left sidebar</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3 pb-20">
                                        {schema.map((field, idx) => (
                                            <FieldEditor
                                                key={field.id}
                                                field={field}
                                                index={idx}
                                                isActive={activeFieldId === field.id}
                                                onClick={() => setActiveFieldId(field.id)}
                                                onUpdate={updateField}
                                                onRemove={removeField}
                                                onUpdateOption={updateOption}
                                                onAddOption={addOption}
                                                onRemoveOption={removeOption}
                                                onDragStart={(e: any) => { dragItem.current = idx; }}
                                                onDragEnter={(e: any) => { dragOverItem.current = idx; }}
                                                onDragEnd={handleDragSort}
                                            />
                                        ))}

                                        {/* Drop Zone Hint */}
                                        <div className="h-24 border-2 border-dashed border-transparent hover:border-indigo-200 rounded-xl flex items-center justify-center text-indigo-300 text-xs font-bold transition-all">
                                            End of Form
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 3. Right: Live Preview */}
                        <div className="w-[420px] bg-white border-l border-gray-200 overflow-y-auto shadow-xl z-30 hidden xl:block custom-scrollbar">
                            <div className="p-6">
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
                )}

                {/* === DATA MODE (Restored from previous turn) === */}
                {activeTab === 'data' && (
                    <div className="flex flex-col h-full bg-white animate-in fade-in duration-300">
                        {/* Data Toolbar */}
                        <div className="px-6 py-3 border-b border-gray-200 flex flex-col sm:flex-row sm:justify-between sm:items-center bg-white shrink-0 gap-4">
                            <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg self-start sm:self-auto">
                                <button
                                    onClick={() => setSubView('table')}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${subView === 'table' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    <Grid size={14} /> Grid View
                                </button>
                                <button
                                    onClick={() => setSubView('batch')}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${subView === 'batch' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    <List size={14} /> Batch Entry
                                </button>
                                <button
                                    onClick={() => setSubView('preview')}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${subView === 'preview' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    <Plus size={14} /> New Entry
                                </button>
                            </div>

                            <div className="flex items-center gap-2 flex-1 w-full sm:w-auto">
                                <div className="relative flex-1 max-w-md">
                                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
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
                                                    {dataColumns.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
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
                                    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden min-h-[400px]">
                                        <table className="w-full text-left border-collapse">
                                            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10 shadow-sm">
                                                <tr>
                                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase w-16 text-center bg-gray-50">#</th>
                                                    {dataColumns.map(f => (
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
                                                        <td colSpan={dataColumns.length + 2} className="px-6 py-16 text-center text-gray-400">
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
                                                            {dataColumns.map(f => (
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
                                                        {dataColumns.map(f => (
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
                                                            {dataColumns.map(f => (
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
                )}

            </main>
        </div>
    );
};
