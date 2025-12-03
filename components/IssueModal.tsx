import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Calendar, User, Tag, AlertTriangle, FileText, Link as LinkIcon, Image as ImageIcon, Upload, Trash2, Plus, File } from 'lucide-react';
import { Issue, Project } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface IssueModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (issue: Issue) => void;
    issueToEdit?: Issue;
    projects: Project[];
}

export const IssueModal: React.FC<IssueModalProps> = ({ isOpen, onClose, onSave, issueToEdit, projects }) => {
    const { t } = useLanguage();

    // Form State
    const [projectName, setProjectName] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
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
    const [status, setStatus] = useState<Issue['status']>('Open');

    // New Features State
    const [attachments, setAttachments] = useState<string[]>([]);
    const [linkedDocIds, setLinkedDocIds] = useState<string[]>([]);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Initialize
    useEffect(() => {
        if (isOpen) {
            if (issueToEdit) {
                setProjectName(issueToEdit.projectName);
                setDate(issueToEdit.date);
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
                setStatus(issueToEdit.status);
                setAttachments(issueToEdit.attachments || []);
                setLinkedDocIds(issueToEdit.linkedDocIds || []);
            } else {
                // Default to first project if available
                setProjectName(projects[0]?.info.name || '');
                setDate(new Date().toISOString().split('T')[0]);
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
                setStatus('Open');
                setAttachments([]);
                setLinkedDocIds([]);
            }
        }
    }, [issueToEdit, isOpen, projects]);

    if (!isOpen) return null;

    // Helpers
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.size > 5 * 1024 * 1024) {
                alert('File is too large (max 5MB)');
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

    const handleSave = () => {
        if (!description) {
            alert('Description is required');
            return;
        }

        const issue: Issue = {
            id: issueToEdit?.id || '',
            date,
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
            status,
            attachments,
            linkedDocIds
        };
        onSave(issue);
        onClose();
    };

    // Derived Data
    const currentProject = projects.find(p => p.info.name === projectName);
    const availableDocs = currentProject?.docs || [];

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center animate-in fade-in duration-200 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex justify-between items-center px-8 py-5 border-b border-gray-100 bg-white">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl ${issueToEdit ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}`}>
                            {issueToEdit ? <FileText size={24} /> : <AlertTriangle size={24} />}
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">
                                {issueToEdit ? 'Edit Issue' : 'Report New Issue'}
                            </h2>
                            <p className="text-sm text-gray-500">
                                {issueToEdit ? `ID: ${issueToEdit.id}` : 'Log a new anomaly or defect'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto bg-gray-50/50">
                    <div className="flex flex-col lg:flex-row h-full">

                        {/* LEFT COLUMN: Main Content */}
                        <div className="flex-1 p-8 space-y-8 overflow-y-auto">

                            {/* Project & Description */}
                            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Project</label>
                                        <select
                                            value={projectName}
                                            onChange={e => setProjectName(e.target.value)}
                                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                        >
                                            <option value="" disabled>Select Project</option>
                                            {projects.map(p => (
                                                <option key={p.id} value={p.info.name}>{p.info.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Issue Category</label>
                                        <input
                                            type="text"
                                            value={category}
                                            onChange={e => setCategory(e.target.value)}
                                            placeholder="e.g. Malfunction, UI Bug"
                                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Description</label>
                                    <textarea
                                        value={description}
                                        onChange={e => setDescription(e.target.value)}
                                        rows={6}
                                        className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none leading-relaxed"
                                        placeholder="Describe the issue in detail..."
                                    />
                                </div>
                            </div>

                            {/* Attachments */}
                            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-4">
                                <div className="flex justify-between items-center">
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Attachments</label>
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="text-xs flex items-center gap-1 text-blue-600 font-medium hover:text-blue-700"
                                    >
                                        <Plus size={14} /> Add Image
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
                                        <span className="text-sm font-medium">Click to upload images</span>
                                    </div>
                                )}
                            </div>

                            {/* Analysis */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-3">
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Root Cause Analysis</label>
                                    <textarea
                                        value={rootCause}
                                        onChange={e => setRootCause(e.target.value)}
                                        rows={4}
                                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                                        placeholder="Why did this happen?"
                                    />
                                </div>
                                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-3">
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Temporary Solution</label>
                                    <textarea
                                        value={temporarySolution}
                                        onChange={e => setTemporarySolution(e.target.value)}
                                        rows={4}
                                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                                        placeholder="Immediate mitigation steps..."
                                    />
                                </div>
                            </div>
                        </div>

                        {/* RIGHT COLUMN: Sidebar */}
                        <div className="w-full lg:w-80 bg-white border-l border-gray-200 p-6 space-y-8 overflow-y-auto">

                            {/* Status & Date */}
                            <div className="space-y-4">
                                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Status</h3>
                                <select
                                    value={status}
                                    onChange={e => setStatus(e.target.value as any)}
                                    className={`w-full p-3 rounded-xl text-sm font-bold outline-none border-2 transition-colors appearance-none
                                        ${status === 'Open' ? 'border-red-100 bg-red-50 text-red-600' :
                                            status === 'In Progress' ? 'border-blue-100 bg-blue-50 text-blue-600' :
                                                status === 'Planning' ? 'border-amber-100 bg-amber-50 text-amber-600' :
                                                    'border-green-100 bg-green-50 text-green-600'}`}
                                >
                                    <option value="Open">Open (待处理)</option>
                                    <option value="In Progress">In Progress (处理中)</option>
                                    <option value="Planning">Planning (方案制定中)</option>
                                    <option value="Closed">Closed (已关闭)</option>
                                </select>

                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Date Reported</label>
                                    <input
                                        type="date"
                                        value={date}
                                        onChange={e => setDate(e.target.value)}
                                        className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                            </div>

                            {/* People */}
                            <div className="space-y-4 pt-4 border-t border-gray-100">
                                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">People</h3>

                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Reporter</label>
                                        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg p-2">
                                            <User size={14} className="text-gray-400" />
                                            <input
                                                type="text"
                                                value={reporter}
                                                onChange={e => setReporter(e.target.value)}
                                                className="bg-transparent w-full text-sm outline-none"
                                                placeholder="Name"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Responsible</label>
                                        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg p-2">
                                            <User size={14} className="text-gray-400" />
                                            <input
                                                type="text"
                                                value={responsiblePerson}
                                                onChange={e => setResponsiblePerson(e.target.value)}
                                                className="bg-transparent w-full text-sm outline-none"
                                                placeholder="Name"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Tracker</label>
                                        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg p-2">
                                            <User size={14} className="text-gray-400" />
                                            <input
                                                type="text"
                                                value={tracker}
                                                onChange={e => setTracker(e.target.value)}
                                                className="bg-transparent w-full text-sm outline-none"
                                                placeholder="Name"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Device Info */}
                            <div className="space-y-4 pt-4 border-t border-gray-100">
                                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Device Info</h3>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
                                        <input
                                            type="text"
                                            value={deviceCategory}
                                            onChange={e => setDeviceCategory(e.target.value)}
                                            className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none"
                                            placeholder="Hardware/Software"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
                                        <input
                                            type="text"
                                            value={deviceType}
                                            onChange={e => setDeviceType(e.target.value)}
                                            className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none"
                                            placeholder="Specific Model"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Source</label>
                                        <input
                                            type="text"
                                            value={source}
                                            onChange={e => setSource(e.target.value)}
                                            className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none"
                                            placeholder="Origin"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Linked Docs */}
                            <div className="space-y-4 pt-4 border-t border-gray-100">
                                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                                    <LinkIcon size={14} /> Linked Docs
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
                                                <span className="truncate flex-1">{doc.title || 'Untitled Doc'}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-gray-400 italic">No docs in this project.</p>
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
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-8 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all hover:-translate-y-0.5 flex items-center gap-2"
                    >
                        <Save size={18} />
                        Save Issue
                    </button>
                </div>
            </div>
        </div>
    );
};
