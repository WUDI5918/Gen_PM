import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Calendar, User, Tag, AlertTriangle, FileText, Link as LinkIcon, Image as ImageIcon, Upload, Trash2, Plus, File, ChevronDown, ChevronUp, Check, Settings, Edit3, Trash, Sparkles, Briefcase, AlignLeft, Search, ShieldAlert, Wrench, CheckCircle, Users, Clock } from 'lucide-react';
import { Issue, Project, TeamMember } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

import { analyzeIssue } from '../services/geminiService';
import { useDialog } from '../contexts/DialogContext';
import { db } from '../services/db';

interface IssueModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (issue: Issue) => void;
    issueToEdit?: Issue;
    projects: Project[];
    teamMembers: TeamMember[];
    existingIssues?: Issue[];
    tags?: Record<string, string[]>;
    onUpdateTags?: (tags: Record<string, string[]>) => void;
    onCreateProject?: (name?: string) => Promise<void>;
}

interface MemberSelectProps {
    value: string;
    onChange: (value: string) => void;
    teamMembers: TeamMember[];
    placeholder?: string;
}

const MemberSelect: React.FC<MemberSelectProps> = ({ value, onChange, teamMembers, placeholder }) => {
    const { t } = useLanguage();
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState(value);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setInputValue(value);
    }, [value]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredMembers = teamMembers.filter(m =>
        m.name.toLowerCase().includes(inputValue.toLowerCase()) ||
        m.role.toLowerCase().includes(inputValue.toLowerCase())
    );

    return (
        <div className="relative" ref={wrapperRef}>
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg p-2 focus-within:ring-2 focus-within:ring-blue-500 transition-all">
                <User size={14} className="text-gray-400" />
                <input
                    type="text"
                    value={inputValue}
                    onChange={e => {
                        setInputValue(e.target.value);
                        onChange(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    className="bg-transparent w-full text-sm outline-none"
                    placeholder={placeholder || t('common.name')}
                />
            </div>

            {isOpen && filteredMembers.length > 0 && (
                <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-100 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                    {filteredMembers.map(member => (
                        <button
                            key={member.id}
                            onClick={() => {
                                onChange(member.name);
                                setInputValue(member.name);
                                setIsOpen(false);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center gap-2 transition-colors"
                        >
                            <div className={`w-6 h-6 rounded-full ${member.color} flex items-center justify-center text-[10px] text-white font-bold`}>
                                {member.avatar}
                            </div>
                            <div>
                                <div className="text-sm font-medium text-gray-700">{member.name}</div>
                                <div className="text-xs text-gray-400">{member.role}</div>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const StatusSelect = ({ value, onChange }: { value: Issue['status'], onChange: (val: Issue['status']) => void }) => {
    const { t } = useLanguage();
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    const statuses: Issue['status'][] = ['Open', 'In Progress', 'Planning', 'Closed'];

    const getStatusColor = (s: string) => {
        switch (s) {
            case 'Open': return 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100';
            case 'In Progress': return 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100';
            case 'Planning': return 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100';
            case 'Closed': return 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100';
            default: return 'bg-gray-50 text-gray-600 border-gray-200';
        }
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={wrapperRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full p-3 rounded-xl text-sm font-bold border-2 transition-all flex justify-between items-center ${getStatusColor(value)}`}
            >
                <span>{t(`status.${value}`)}</span>
                <ChevronDown size={16} />
            </button>

            {isOpen && (
                <div className="absolute z-50 left-0 right-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden p-1">
                    {statuses.map(s => (
                        <button
                            key={s}
                            onClick={() => {
                                onChange(s);
                                setIsOpen(false);
                            }}
                            className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors mb-1 last:mb-0
                                ${value === s ? 'bg-gray-100' : 'hover:bg-gray-50'}
                                ${s === 'Open' ? 'text-red-600' :
                                    s === 'In Progress' ? 'text-blue-600' :
                                        s === 'Planning' ? 'text-amber-600' :
                                            'text-green-600'}
                            `}
                        >
                            {t(`status.${s}`)}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const ProjectSelect = ({ value, onChange, options, placeholder, onCreateNew }: { value: string, onChange: (val: string) => void, options: string[], placeholder: string, onCreateNew?: (val: string) => void }) => {
    const { t } = useLanguage();
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState(value);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => { setInputValue(value); }, [value]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredOptions = options.filter(o => o.toLowerCase().includes(inputValue.toLowerCase()));
    const isExactMatch = options.some(o => o.toLowerCase() === inputValue.toLowerCase());
    const displayedOptions = isExactMatch ? options : filteredOptions;
    const showCreate = inputValue && !options.some(o => o.toLowerCase() === inputValue.toLowerCase());

    return (
        <div className="relative" ref={wrapperRef}>
            <div className="relative group">
                <input
                    type="text"
                    value={inputValue}
                    onChange={e => {
                        setInputValue(e.target.value);
                        onChange(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all group-hover:bg-white group-hover:shadow-sm"
                    placeholder={placeholder}
                />
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1"
                >
                    <ChevronDown size={16} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                </button>
            </div>
            {isOpen && (
                <div className="absolute z-50 left-0 right-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
                    {displayedOptions.map(opt => (
                        <button
                            key={opt}
                            onClick={() => {
                                onChange(opt);
                                setInputValue(opt);
                                setIsOpen(false);
                            }}
                            className="w-full text-left px-4 py-3 text-sm hover:bg-blue-50 hover:text-blue-600 transition-colors flex items-center justify-between group"
                        >
                            <span className="font-medium">{opt}</span>
                            {value === opt && <Check size={14} className="text-blue-600" />}
                        </button>
                    ))}
                    {showCreate && onCreateNew && (
                        <button
                            onClick={() => {
                                onCreateNew(inputValue);
                                setIsOpen(false);
                            }}
                            className="w-full text-left px-4 py-3 text-sm text-blue-600 hover:bg-blue-50 transition-colors font-medium border-t border-gray-50 flex items-center gap-2"
                        >
                            <Plus size={14} />
                            Create "{inputValue}"
                        </button>
                    )}
                    {displayedOptions.length === 0 && !showCreate && (
                        <div className="px-4 py-3 text-sm text-gray-400 italic text-center">
                            {t('common.no_results')}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const TagSelect = ({ value, onChange, options, placeholder, title, icon: Icon }: { value: string, onChange: (val: string) => void, options: string[], placeholder: string, title: string, icon?: any }) => {
    const { t } = useLanguage();
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState(value);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => { setInputValue(value); }, [value]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredOptions = options.filter(o => o.toLowerCase().includes(inputValue.toLowerCase()));
    const isExactMatch = options.some(o => o.toLowerCase() === inputValue.toLowerCase());
    const displayedOptions = isExactMatch ? options : filteredOptions;
    const showCreate = inputValue && !options.some(o => o.toLowerCase() === inputValue.toLowerCase());

    return (
        <div className="relative" ref={wrapperRef}>
            <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                    {Icon && <Icon size={12} />}
                    {title}
                </label>
            </div>
            <div className="relative group">
                <input
                    type="text"
                    value={inputValue}
                    onChange={e => {
                        setInputValue(e.target.value);
                        onChange(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all group-hover:bg-white group-hover:shadow-sm"
                    placeholder={placeholder}
                />
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1"
                >
                    <ChevronDown size={16} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                </button>
            </div>
            {isOpen && (
                <div className="absolute z-50 left-0 right-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
                    {displayedOptions.map(opt => (
                        <button
                            key={opt}
                            onClick={() => {
                                onChange(opt);
                                setInputValue(opt);
                                setIsOpen(false);
                            }}
                            className="w-full text-left px-4 py-3 text-sm hover:bg-blue-50 hover:text-blue-600 transition-colors flex items-center justify-between group"
                        >
                            <span className="font-medium">{opt}</span>
                            {value === opt && <Check size={14} className="text-blue-600" />}
                        </button>
                    ))}
                    {showCreate && (
                        <button
                            onClick={() => {
                                onChange(inputValue);
                                setIsOpen(false);
                            }}
                            className="w-full text-left px-4 py-3 text-sm text-blue-600 hover:bg-blue-50 transition-colors font-medium border-t border-gray-50 flex items-center gap-2"
                        >
                            <Plus size={14} />
                            {t('common.create')} "{inputValue}"
                        </button>
                    )}
                    {displayedOptions.length === 0 && !showCreate && (
                        <div className="px-4 py-3 text-xs text-gray-400 italic text-center">No matching tags</div>
                    )}
                </div>
            )}
        </div>
    );
};

export const IssueModal: React.FC<IssueModalProps> = ({ isOpen, onClose, onSave, issueToEdit, projects, teamMembers, existingIssues = [], tags = {}, onUpdateTags, onCreateProject }) => {
    const { t, language } = useLanguage();
    const { ask } = useDialog();

    // Form State
    const [projectName, setProjectName] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [discoveryDate, setDiscoveryDate] = useState('');
    const [resolutionDate, setResolutionDate] = useState('');
    const [deviceCategory, setDeviceCategory] = useState('');
    const [deviceType, setDeviceType] = useState('');
    const [category, setCategory] = useState('');
    const [source, setSource] = useState('');
    const [reporter, setReporter] = useState('');
    const [tracker, setTracker] = useState('');
    const [description, setDescription] = useState('');
    const [rootCause, setRootCause] = useState('');
    const [responsiblePerson, setResponsiblePerson] = useState('');
    const [temporarySolution, setTemporarySolution] = useState('');
    const [rootSolution, setRootSolution] = useState('');
    const [status, setStatus] = useState<Issue['status']>('Open');

    // New Features State
    const [attachments, setAttachments] = useState<string[]>([]);
    const [linkedDocIds, setLinkedDocIds] = useState<string[]>([]);

    // Tag Management State
    const [isTagManagerOpen, setIsTagManagerOpen] = useState(false);
    const [activeTagCategory, setActiveTagCategory] = useState<string>('categories');
    const [newTagInput, setNewTagInput] = useState('');

    // AI Analysis State
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // Fresh Project Data (loaded from DB to get complete docs)
    const [freshProject, setFreshProject] = useState<Project | null>(null);

    // Load fresh project data from database when projectName changes
    useEffect(() => {
        const loadProjectData = async () => {
            if (!projectName || !isOpen) {
                setFreshProject(null);
                return;
            }

            try {
                const allProjects = await db.getAllProjects();
                const found = allProjects.find(p => String(p.info.name || '') === String(projectName || ''));
                setFreshProject(found || null);
            } catch (error) {
                console.error('Failed to load project from DB:', error);
                setFreshProject(null);
            }
        };

        loadProjectData();
    }, [projectName, isOpen]);

    const handleAIAnalyze = async () => {
        if (!description) return;

        const savedConfig = localStorage.getItem('project_ai_config');
        if (!savedConfig) {
            alert(t('issue.modal.ai_config_missing') || "Please configure AI settings first.");
            return;
        }

        setIsAnalyzing(true);
        try {
            const config = JSON.parse(savedConfig);
            const { rootCause: aiRootCause, rootSolution: aiRootSolution } = await analyzeIssue(description, config, language === 'zh' ? 'zh' : 'en');
            if (aiRootCause) setRootCause(aiRootCause);
            if (aiRootSolution) setRootSolution(aiRootSolution);
        } catch (error) {
            console.error("AI Analysis failed", error);
            alert(t('issue.modal.ai_error') || "AI Analysis failed. Please check your API key.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Initialize
    useEffect(() => {
        if (isOpen) {
            if (issueToEdit) {
                setProjectName(String(issueToEdit.projectName || ''));
                setDate(issueToEdit.date);
                setDiscoveryDate(issueToEdit.discoveryDate || '');
                setResolutionDate(issueToEdit.resolutionDate || '');
                setDeviceCategory(issueToEdit.deviceCategory);
                setDeviceType(issueToEdit.deviceType);
                setCategory(issueToEdit.category);
                setSource(issueToEdit.source);
                setReporter(issueToEdit.reporter);
                setTracker(issueToEdit.tracker);
                setDescription(issueToEdit.description);
                setRootCause(issueToEdit.rootCause || '');
                setResponsiblePerson(issueToEdit.responsiblePerson || '');
                setTemporarySolution(issueToEdit.temporarySolution || '');
                setRootSolution(issueToEdit.rootSolution || '');
                setStatus(issueToEdit.status);
                setAttachments(issueToEdit.attachments || []);
                setLinkedDocIds(issueToEdit.linkedDocIds || []);
            } else {
                // Default to first project if available
                setProjectName(String(projects[0]?.info.name || ''));
                setDate(new Date().toISOString().split('T')[0]);
                setDiscoveryDate('');
                setResolutionDate('');
                setDeviceCategory('');
                setDeviceType('');
                setCategory('');
                setSource('');
                setReporter('');
                setTracker('');
                setDescription('');
                setRootCause('');
                setResponsiblePerson('');
                setTemporarySolution('');
                setRootSolution('');
                setStatus('Open');
                setAttachments([]);
                setLinkedDocIds([]);
            }
        }
    }, [issueToEdit, isOpen, projects]);

    // Clear linked docs when project changes (for new issues only)
    const prevProjectNameRef = useRef<string>('');
    useEffect(() => {
        if (isOpen && !issueToEdit && prevProjectNameRef.current && prevProjectNameRef.current !== projectName) {
            // Project has changed, clear linked docs
            setLinkedDocIds([]);
        }
        prevProjectNameRef.current = projectName;
    }, [projectName, isOpen, issueToEdit]);

    if (!isOpen) return null;

    // Helpers
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.size > 5 * 1024 * 1024) {
                alert(t('issue.modal.file_too_large'));
                return;
            }

            const reader = new FileReader();
            reader.onload = (event) => {
                if (event.target?.result) {
                    setAttachments(prev => [...prev, event.target!.result as string]);
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const toggleDocLink = (docId: string) => {
        setLinkedDocIds(prev =>
            prev.includes(docId)
                ? prev.filter(id => id !== docId)
                : [...prev, docId]
        );
    };



    // Derived Data
    const currentProject = projects.find(p => String(p.info.name || '') === String(projectName || ''));
    // Use freshProject (from DB) if available, otherwise fall back to currentProject (from props)
    const projectToUse = freshProject || currentProject;
    const availableDocs = projectToUse?.docs || [];

    // Combine existing issue tags with global tags
    const getUniqueTags = (key: string, globalKey: string) => {
        const fromIssues = existingIssues.map(i => (i as any)[key]).filter(Boolean);
        const fromGlobal = tags[globalKey] || [];
        return Array.from(new Set([...fromIssues, ...fromGlobal])).sort();
    };

    const categories = getUniqueTags('category', 'categories');
    const deviceCategories = getUniqueTags('deviceCategory', 'deviceCategories');
    const deviceTypes = getUniqueTags('deviceType', 'deviceTypes');
    const sources = getUniqueTags('source', 'sources');

    // Tag Management Helpers
    const handleAddTag = (categoryKey: string, tag: string) => {
        if (!tag.trim() || !onUpdateTags) return;
        const currentTags = tags[categoryKey] || [];
        if (!currentTags.includes(tag.trim())) {
            onUpdateTags({
                ...tags,
                [categoryKey]: [...currentTags, tag.trim()]
            });
        }
        setNewTagInput('');
    };

    const openTagManager = (categoryKey: string) => {
        setActiveTagCategory(categoryKey);
        setIsTagManagerOpen(true);
    };

    const handleDeleteTag = (categoryKey: string, tag: string) => {
        if (!onUpdateTags) return;
        const currentTags = tags[categoryKey] || [];
        onUpdateTags({
            ...tags,
            [categoryKey]: currentTags.filter(t => t !== tag)
        });
    };

    // Auto-save new tags when saving issue
    const saveNewTags = (issue: Issue) => {
        if (!onUpdateTags) return;
        let newTags = { ...tags };
        let changed = false;

        const checkAndAdd = (key: string, val: string) => {
            if (val && !(newTags[key] || []).includes(val)) {
                newTags[key] = [...(newTags[key] || []), val];
                changed = true;
            }
        };

        checkAndAdd('categories', issue.category);
        checkAndAdd('deviceCategories', issue.deviceCategory);
        checkAndAdd('deviceTypes', issue.deviceType);
        checkAndAdd('sources', issue.source);

        if (changed) {
            onUpdateTags(newTags);
        }
    };

    const handleSave = () => {
        if (!description) {
            ask({
                title: t('common.attention'),
                message: t('issue.modal.desc_required'),
                type: 'info',
                confirmText: 'OK',
                showCancel: false,
                onConfirm: () => { }
            });
            return;
        }

        const issue: Issue = {
            id: issueToEdit?.id || '',
            date,
            discoveryDate,
            resolutionDate,
            projectName,
            deviceCategory,
            deviceType,
            category,
            source,
            reporter,
            tracker,
            description,
            rootCause,
            responsiblePerson,
            temporarySolution,
            rootSolution,
            status,
            attachments,
            linkedDocIds
        };

        saveNewTags(issue);
        onSave(issue);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center animate-in fade-in duration-200 p-4">
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex justify-between items-center px-8 py-5 border-b border-gray-100 bg-white">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl ${issueToEdit ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}`}>
                            {issueToEdit ? <FileText size={24} /> : <AlertTriangle size={24} />}
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">
                                {issueToEdit ? t('issue.modal.edit_title') : t('issue.modal.new_title')}
                            </h2>
                            <p className="text-sm text-gray-500">
                                {issueToEdit ? `${t('issue.modal.id_prefix')}${issueToEdit.id}` : t('issue.modal.new_desc')}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => openTagManager('categories')}
                            className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-blue-600 transition-colors"
                            title="Manage Tags"
                        >
                            <Settings size={20} />
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Tag Manager Modal Overlay */}
                {isTagManagerOpen && (
                    <div className="absolute inset-0 bg-white z-50 flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="px-8 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">{t('issue.modal.tag_manager_title')}</h3>
                                <p className="text-sm text-gray-500">{t('issue.modal.tag_manager_desc')}</p>
                            </div>
                            <button onClick={() => setIsTagManagerOpen(false)} className="p-2 hover:bg-gray-200 rounded-full text-gray-500">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="flex-1 flex overflow-hidden">
                            {/* Sidebar */}
                            <div className="w-64 border-r border-gray-200 bg-gray-50 p-4 space-y-6">
                                <div>
                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-2">{t('issue.modal.group_basic')}</h4>
                                    <div className="space-y-1">
                                        {[
                                            { id: 'categories', label: t('issue.modal.category'), icon: Tag }
                                        ].map(cat => (
                                            <button
                                                key={cat.id}
                                                onClick={() => setActiveTagCategory(cat.id)}
                                                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex justify-between items-center
                                                    ${activeTagCategory === cat.id ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    {cat.icon && <cat.icon size={14} />}
                                                    {cat.label}
                                                </div>
                                                <span className="bg-gray-100 text-gray-500 text-xs py-0.5 px-2 rounded-full">
                                                    {(tags?.[cat.id] || []).length}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-2">{t('issue.modal.group_device')}</h4>
                                    <div className="space-y-1">
                                        {[
                                            { id: 'deviceCategories', label: t('issue.modal.device_category'), icon: AlertTriangle },
                                            { id: 'deviceTypes', label: t('issue.modal.device_type'), icon: Settings },
                                            { id: 'sources', label: t('issue.modal.source'), icon: LinkIcon }
                                        ].map(cat => (
                                            <button
                                                key={cat.id}
                                                onClick={() => setActiveTagCategory(cat.id)}
                                                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex justify-between items-center
                                                    ${activeTagCategory === cat.id ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    {cat.icon && <cat.icon size={14} />}
                                                    {cat.label}
                                                </div>
                                                <span className="bg-gray-100 text-gray-500 text-xs py-0.5 px-2 rounded-full">
                                                    {(tags?.[cat.id] || []).length}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            {/* Content */}
                            <div className="flex-1 p-8 overflow-y-auto">
                                <div className="max-w-2xl mx-auto space-y-6">
                                    {/* Import Banner */}
                                    {(() => {
                                        const fieldMap: Record<string, string> = {
                                            'categories': 'category',
                                            'deviceCategories': 'deviceCategory',
                                            'deviceTypes': 'deviceType',
                                            'sources': 'source'
                                        };
                                        const issueField = fieldMap[activeTagCategory];
                                        const usedTags = Array.from(new Set(existingIssues.map(i => (i as any)[issueField]).filter(Boolean))) as string[];
                                        const currentGlobalTags = tags[activeTagCategory] || [];
                                        const missingTags = usedTags.filter(t => !currentGlobalTags.includes(t));

                                        if (missingTags.length === 0) return null;

                                        return (
                                            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-center justify-between animate-in fade-in slide-in-from-top-2">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                                                        <Tag size={16} />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-bold text-blue-900">{t('issue.modal.tags_found').replace('{n}', missingTags.length.toString())}</h4>
                                                        <p className="text-xs text-blue-600">{t('issue.modal.tags_found_desc')}</p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        if (onUpdateTags) {
                                                            onUpdateTags({
                                                                ...tags,
                                                                [activeTagCategory]: [...currentGlobalTags, ...missingTags].sort()
                                                            });
                                                        }
                                                    }}
                                                    className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors"
                                                >
                                                    {t('issue.modal.import_tags')}
                                                </button>
                                            </div>
                                        );
                                    })()}

                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={newTagInput}
                                            onChange={e => setNewTagInput(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleAddTag(activeTagCategory, newTagInput)}
                                            placeholder={t('issue.modal.add_tag_placeholder')}
                                            className="flex-1 p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                        <button
                                            onClick={() => handleAddTag(activeTagCategory, newTagInput)}
                                            disabled={!newTagInput.trim()}
                                            className="px-6 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            Add
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {(tags[activeTagCategory] || []).map(tag => (
                                            <div key={tag} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-lg group hover:border-blue-200 hover:shadow-sm transition-all">
                                                <span className="font-medium text-gray-700">{tag}</span>
                                                <button
                                                    onClick={() => handleDeleteTag(activeTagCategory, tag)}
                                                    className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        ))}
                                        {(tags?.[activeTagCategory] || []).length === 0 && (
                                            <div className="col-span-2 text-center py-12 text-gray-400 italic bg-gray-50 rounded-xl border border-dashed border-gray-200 flex flex-col items-center gap-2">
                                                <span>{t('issue.modal.no_tags_in_cat')}</span>
                                                {(() => {
                                                    const fieldMap: Record<string, string> = {
                                                        'categories': 'category',
                                                        'deviceCategories': 'deviceCategory',
                                                        'deviceTypes': 'deviceType',
                                                        'sources': 'source'
                                                    };
                                                    const issueField = fieldMap[activeTagCategory];
                                                    const usedTags = Array.from(new Set((existingIssues || []).map(i => (i as any)[issueField]).filter(Boolean))) as string[];
                                                    const currentGlobalTags = tags?.[activeTagCategory] || [];
                                                    const missingTags = usedTags.filter(t => !currentGlobalTags.includes(t));

                                                    if (missingTags.length > 0) {
                                                        return (
                                                            <button
                                                                onClick={() => {
                                                                    if (onUpdateTags) {
                                                                        onUpdateTags({
                                                                            ...(tags || {}),
                                                                            [activeTagCategory]: [...currentGlobalTags, ...missingTags].sort()
                                                                        });
                                                                    }
                                                                }}
                                                                className="text-blue-600 hover:underline text-sm font-medium"
                                                            >
                                                                {t('issue.modal.import_tags')} ({missingTags.length})
                                                            </button>
                                                        );
                                                    }
                                                    return null;
                                                })()}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Body */}
                <div className="flex-1 overflow-y-auto bg-white">
                    <div className="flex flex-col lg:flex-row h-full">

                        {/* LEFT COLUMN: Main Content */}
                        <div className="flex-1 p-8 space-y-8 overflow-y-auto">

                            {/* Project & Description */}
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                            <Briefcase size={14} />
                                            {t('issue.modal.project')}
                                        </label>
                                        <ProjectSelect
                                            value={projectName}
                                            onChange={setProjectName}
                                            options={projects.map(p => p.info.name)}
                                            placeholder={t('issue.modal.select_project')}
                                            onCreateNew={(name) => {
                                                if (confirm(`Create new project "${name}"?`)) {
                                                    if (onCreateProject) {
                                                        onCreateProject(name);
                                                    }
                                                    setProjectName(name);
                                                }
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <TagSelect
                                            title={t('issue.modal.category')}
                                            value={category}
                                            onChange={setCategory}
                                            options={categories}
                                            placeholder={t('issue.modal.category_placeholder')}
                                            icon={Tag}
                                        />
                                    </div>
                                </div>

                                {/* Description */}
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                                            <AlignLeft size={14} />
                                            {t('issue.modal.description')}
                                        </label>
                                        <button
                                            onClick={handleAIAnalyze}
                                            disabled={isAnalyzing || !description}
                                            className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg transition-colors
                                            ${isAnalyzing ? 'bg-indigo-50 text-indigo-400' : 'text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700'}
                                            ${!description ? 'opacity-50 cursor-not-allowed' : ''}
                                        `}
                                            title={t('issue.modal.ai_analyze')}
                                        >
                                            <Sparkles size={14} className={isAnalyzing ? "animate-spin" : ""} />
                                            {isAnalyzing ? t('issue.modal.ai_analyzing') : t('issue.modal.ai_analyze')}
                                        </button>
                                    </div>
                                    <div className="relative">
                                        <textarea
                                            value={description}
                                            onChange={e => setDescription(e.target.value)}
                                            rows={6}
                                            className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none leading-relaxed"
                                            placeholder={t('issue.modal.description_placeholder')}
                                        />
                                    </div>
                                </div>

                                {/* Attachments */}
                                <div className="space-y-4 pt-4 border-t border-gray-100">
                                    <div className="flex justify-between items-center">
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">{t('issue.modal.attachments')}</label>
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            className="text-xs flex items-center gap-1 text-blue-600 font-medium hover:text-blue-700"
                                        >
                                            <Plus size={14} /> {t('issue.modal.add_image')}
                                        </button>
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            className="hidden"
                                            accept="image/*"
                                            onChange={handleFileSelect}
                                        />
                                    </div>

                                    {attachments.length > 0 ? (
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            {attachments.map((src, idx) => (
                                                <div key={idx} className="group relative aspect-video bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                                                    <img src={src} alt={`Attachment ${idx}`} className="w-full h-full object-cover" />
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                        <button
                                                            onClick={() => removeAttachment(idx)}
                                                            className="p-2 bg-white/20 hover:bg-white/40 rounded-full text-white backdrop-blur-sm transition-colors"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div
                                            onClick={() => fileInputRef.current?.click()}
                                            className="border-2 border-dashed border-gray-200 rounded-xl p-8 flex flex-col items-center justify-center text-gray-400 hover:border-blue-300 hover:bg-blue-50/50 transition-all cursor-pointer"
                                        >
                                            <ImageIcon size={32} className="mb-2 opacity-50" />
                                            <span className="text-sm font-medium">{t('issue.modal.upload_placeholder')}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Analysis */}
                                <div className="space-y-6 pt-4 border-t border-gray-100">
                                    <div className="space-y-6">
                                        <div className="space-y-3">
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                                                <Search size={14} />
                                                {t('issue.modal.root_cause')}
                                            </label>
                                            <textarea
                                                value={rootCause}
                                                onChange={e => setRootCause(e.target.value)}
                                                rows={4}
                                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                                                placeholder={t('issue.modal.root_cause_placeholder')}
                                            />
                                        </div>
                                        <div className="space-y-3">
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                                                <ShieldAlert size={14} />
                                                {t('issue.modal.temp_solution')}
                                            </label>
                                            <textarea
                                                value={temporarySolution}
                                                onChange={e => setTemporarySolution(e.target.value)}
                                                rows={4}
                                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                                                placeholder={t('issue.modal.temp_solution_placeholder')}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                                            <Wrench size={14} />
                                            {t('issue.modal.root_solution')}
                                        </label>
                                        <textarea
                                            value={rootSolution}
                                            onChange={e => setRootSolution(e.target.value)}
                                            rows={4}
                                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                                            placeholder={t('issue.modal.root_solution_placeholder')}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT COLUMN: Sidebar */}
                        <div className="w-full lg:w-80 bg-white border-l border-gray-200 p-6 space-y-8 overflow-y-auto">

                            {/* Status & Date */}
                            <div className="space-y-4">
                                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                                    <CheckCircle size={14} />
                                    {t('issue.modal.status')}
                                </h3>
                                <StatusSelect value={status} onChange={setStatus} />

                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">{t('issue.modal.date_reported')}</label>
                                    <input
                                        type="date"
                                        value={date}
                                        onChange={e => setDate(e.target.value)}
                                        className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">{t('issue.modal.discovery_date')}</label>
                                    <input
                                        type="date"
                                        value={discoveryDate}
                                        onChange={e => setDiscoveryDate(e.target.value)}
                                        className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">{t('issue.modal.resolution_date')}</label>
                                    <input
                                        type="date"
                                        value={resolutionDate}
                                        onChange={e => setResolutionDate(e.target.value)}
                                        className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                            </div>

                            {/* People */}
                            <div className="space-y-4 pt-4 border-t border-gray-100">
                                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                                    <Users size={14} />
                                    {t('issue.modal.people')}
                                </h3>

                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">{t('issue.modal.reporter')}</label>
                                        <MemberSelect
                                            value={reporter}
                                            onChange={setReporter}
                                            teamMembers={teamMembers}
                                            placeholder={t('issue.modal.reporter_placeholder')}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">{t('issue.modal.responsible')}</label>
                                        <MemberSelect
                                            value={responsiblePerson}
                                            onChange={setResponsiblePerson}
                                            teamMembers={teamMembers}
                                            placeholder={t('issue.modal.responsible_placeholder')}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">{t('issue.modal.tracker')}</label>
                                        <MemberSelect
                                            value={tracker}
                                            onChange={setTracker}
                                            teamMembers={teamMembers}
                                            placeholder={t('issue.modal.tracker_placeholder')}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Device Info */}
                            <div className="space-y-4 pt-4 border-t border-gray-100">
                                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                                    <AlertTriangle size={14} />
                                    {t('issue.modal.device_info')}
                                </h3>
                                <div className="space-y-4">
                                    <TagSelect
                                        title={t('issue.modal.device_category')}
                                        value={deviceCategory}
                                        onChange={setDeviceCategory}
                                        options={deviceCategories}
                                        placeholder={t('issue.modal.device_category_placeholder')}
                                    />
                                    <TagSelect
                                        title={t('issue.modal.device_type')}
                                        value={deviceType}
                                        onChange={setDeviceType}
                                        options={deviceTypes}
                                        placeholder={t('issue.modal.device_type_placeholder')}
                                    />
                                    <TagSelect
                                        title={t('issue.modal.source')}
                                        value={source}
                                        onChange={setSource}
                                        options={sources}
                                        placeholder={t('issue.modal.source_placeholder')}
                                    />
                                </div>
                            </div>

                            {/* Linked Docs */}
                            <div className="space-y-4 pt-4 border-t border-gray-100">
                                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                                    <LinkIcon size={14} /> {t('issue.modal.linked_docs')}
                                </h3>
                                {availableDocs.length > 0 ? (
                                    <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                                        {availableDocs.map(doc => (
                                            <div
                                                key={doc.id}
                                                onClick={() => toggleDocLink(doc.id)}
                                                className={`p-2 rounded-lg text-xs cursor-pointer flex items-center gap-2 transition-colors
                                                    ${linkedDocIds.includes(doc.id)
                                                        ? 'bg-blue-50 text-blue-700 border border-blue-100'
                                                        : 'hover:bg-gray-50 text-gray-600 border border-transparent'}`}
                                            >
                                                <div className={`w-3 h-3 rounded-full border flex items-center justify-center
                                                    ${linkedDocIds.includes(doc.id) ? 'bg-blue-500 border-blue-500' : 'border-gray-300'}`}>
                                                    {linkedDocIds.includes(doc.id) && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                                </div>
                                                <span className="truncate flex-1">{String(doc.title || 'Untitled Doc')}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-gray-400 italic">{t('issue.modal.no_docs')}</p>
                                )}
                            </div>

                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-8 py-5 border-t border-gray-100 bg-white flex justify-end gap-4">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition-colors"
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-8 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all hover:-translate-y-0.5 flex items-center gap-2"
                    >
                        <Save size={18} />
                        {t('issue.modal.save')}
                    </button>
                </div>
            </div>
        </div>
    );
};
