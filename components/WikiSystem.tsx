import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ProjectDoc, ProjectTask, TaskStatus } from '../types';
import {
    FileText,
    Plus,
    Search,
    Trash2,
    ExternalLink,
    Cloud,
    Link as LinkIcon,
    MoreHorizontal,
    GripVertical,
    CheckSquare,
    Image as ImageIcon,
    Layout
} from 'lucide-react';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import "@blocknote/core/fonts/inter.css";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import { BlockNoteEditor, PartialBlock } from "@blocknote/core";

interface WikiSystemProps {
    docs: ProjectDoc[];
    tasks: ProjectTask[];
    activeDocId: string | null;
    onSelectDoc: (docId: string) => void;
    onUpdateDocs: (docs: ProjectDoc[]) => void;
    onOpenTask: (taskId: string) => void;
}

const DOC_ICONS = ['📄', '📝', '📊', '💡', '✅', '📁', '🚀', '🐛', '🎨', '📚'];

// Helper for Task Status Color
const getStatusColor = (s: TaskStatus) => {
    switch (s) {
        case TaskStatus.Completed: return 'text-emerald-600 bg-emerald-50 border-emerald-200';
        case TaskStatus.InProgress: return 'text-blue-600 bg-blue-50 border-blue-200';
        case TaskStatus.Delayed: return 'text-rose-600 bg-rose-50 border-rose-200';
        default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
};

interface WikiEditorProps {
    initialContent: any[];
    onContentChange: (content: any[]) => void;
}

const WikiEditor: React.FC<WikiEditorProps> = ({ initialContent, onContentChange }) => {
    const editor = useCreateBlockNote({
        initialContent: Array.isArray(initialContent) && initialContent.length > 0
            ? initialContent as PartialBlock[]
            : [{ type: "paragraph", content: "" }] as PartialBlock[],
        uploadFile: async (file: File) => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        }
    });

    return (
        <BlockNoteView
            editor={editor}
            onChange={() => onContentChange(editor.document)}
            theme="light"
        />
    );
};

export const WikiSystem: React.FC<WikiSystemProps> = ({ docs, tasks, activeDocId, onSelectDoc, onUpdateDocs, onOpenTask }) => {
    const { t } = useLanguage();
    const { addToast } = useToast();

    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'tasks' | 'outline'>('outline');
    const [iconMenuOpen, setIconMenuOpen] = useState<string | null>(null);
    const [deleteDocId, setDeleteDocId] = useState<string | null>(null);

    const activeDoc = docs.find(d => d.id === activeDocId);
    const linkedTasks = activeDoc ? tasks.filter(t => t.linkedDocIds?.includes(activeDoc.id)) : [];

    // Handle Content Change
    const handleContentChange = (newContent: any[]) => {
        if (!activeDoc) return;
        const updatedDoc = { ...activeDoc, content: newContent, lastModified: Date.now() };
        const newDocs = docs.map(d => d.id === activeDoc.id ? updatedDoc : d);
        onUpdateDocs(newDocs);
    };

    // Document Management
    const handleCreateDoc = () => {
        const newDoc: ProjectDoc = {
            id: `doc-${Date.now()}`,
            title: 'Untitled',
            icon: '📄',
            content: [{ type: "paragraph", content: "" }],
            lastModified: Date.now()
        };
        onUpdateDocs([...docs, newDoc]);
        onSelectDoc(newDoc.id);
    };

    const handleCreateExternalDoc = () => {
        const url = prompt("Enter URL (Google Doc, Notion, etc.):");
        if (!url) return;

        const newDoc: ProjectDoc = {
            id: `ext-${Date.now()}`,
            title: 'External Resource',
            icon: '🔗',
            content: [],
            externalUrl: url,
            lastModified: Date.now()
        };
        onUpdateDocs([...docs, newDoc]);
        onSelectDoc(newDoc.id);
    };

    const executeDeleteDoc = (id: string) => {
        const newDocs = docs.filter(d => d.id !== id);
        onUpdateDocs(newDocs);
        if (activeDocId === id) onSelectDoc(newDocs[0]?.id || '');
        setDeleteDocId(null);
    };

    const updateDocTitle = (title: string) => {
        if (!activeDoc) return;
        const updated = { ...activeDoc, title, lastModified: Date.now() };
        onUpdateDocs(docs.map(d => d.id === activeDoc.id ? updated : d));
    };

    const changeDocIcon = (docId: string, icon: string) => {
        const updatedDocs = docs.map(d => d.id === docId ? { ...d, icon, lastModified: Date.now() } : d);
        onUpdateDocs(updatedDocs);
        setIconMenuOpen(null);
    };

    const filteredDocs = docs.filter(d => d.title.toLowerCase().includes(searchQuery.toLowerCase()));

    // Generate Outline from Editor Blocks (simple approach)
    const outline = useMemo(() => {
        if (!activeDoc || !Array.isArray(activeDoc.content)) return [];
        // Filter headings from content
        return activeDoc.content.filter((b: any) => b.type === 'heading').map((b: any) => ({
            id: b.id,
            text: Array.isArray(b.content) ? b.content.map((c: any) => c.text).join('') : '',
            level: b.props.level
        }));
    }, [activeDoc]);

    const scrollToBlock = (blockId: string) => {
        // BlockNote doesn't expose easy scroll-to-block ID in the view directly without DOM manipulation
        // But we can try to find the element
        const el = document.querySelector(`[data-id="${blockId}"]`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    return (
        <div className="flex h-full bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
            {/* Sidebar */}
            <div className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col shrink-0">
                <div className="p-4 border-b border-gray-200">
                    <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">{t('wiki.title')}</h2>
                    <div className="relative mb-3">
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            className="w-full text-xs bg-white border border-gray-200 rounded-lg pl-8 pr-2 py-1.5 outline-none focus:border-indigo-400 transition-colors"
                            placeholder={t('wiki.search')}
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <button
                            onClick={handleCreateDoc}
                            className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white text-xs font-bold py-2.5 rounded-lg hover:bg-indigo-700 transition-all shadow-sm hover:shadow-md"
                        >
                            <Plus size={16} strokeWidth={2.5} /> {t('wiki.new_page') || 'New Page'}
                        </button>
                        <button
                            onClick={handleCreateExternalDoc}
                            className="w-full flex items-center justify-center gap-2 bg-white border-2 border-gray-300 text-gray-700 hover:border-indigo-300 hover:bg-gray-50 rounded-lg py-2 text-xs font-medium transition-all"
                        >
                            <ExternalLink size={14} /> External Link
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-0.5 custom-scrollbar">
                    {filteredDocs.length === 0 && <div className="text-center text-gray-400 text-xs py-4">No docs found.</div>}
                    {filteredDocs.map(doc => (
                        <div
                            key={doc.id}
                            className={`group relative flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors ${activeDocId === doc.id ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
                        >
                            <div
                                className="flex items-center gap-2 flex-1 min-w-0"
                                onClick={() => onSelectDoc(doc.id)}
                                onContextMenu={(e) => { e.preventDefault(); setIconMenuOpen(doc.id); }}
                            >
                                <span className="text-lg leading-none shrink-0">{doc.icon}</span>
                                <span className="truncate flex-1">{doc.title}</span>
                                {doc.externalUrl && <ExternalLink size={10} className="text-gray-400" />}
                            </div>

                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setDeleteDocId(doc.id);
                                }}
                                className={`relative p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all z-20 shrink-0 ${deleteDocId === doc.id ? 'opacity-100 text-red-500 bg-red-50' : 'opacity-0 group-hover:opacity-100'}`}
                                title="Delete document"
                            >
                                <Trash2 size={14} />
                            </button>

                            {/* Delete Confirmation Modal */}
                            <DeleteConfirmationModal
                                isOpen={deleteDocId === doc.id}
                                onClose={() => setDeleteDocId(null)}
                                onConfirm={() => executeDeleteDoc(doc.id)}
                                title="Delete Document?"
                                description="Are you sure you want to delete this document? This action cannot be undone."
                                itemTitle={doc.title}
                            />

                            {/* Icon Menu */}
                            {iconMenuOpen === doc.id && (
                                <>
                                    <div className="fixed inset-0 z-50" onClick={(e) => { e.stopPropagation(); setIconMenuOpen(null); }}></div>
                                    <div className="absolute left-16 mt-8 z-[60] bg-white rounded-lg shadow-xl border border-gray-200 p-2 grid grid-cols-5 gap-1 animate-in zoom-in-95 duration-100">
                                        {DOC_ICONS.map(icon => (
                                            <button
                                                key={icon}
                                                onClick={(e) => { e.stopPropagation(); changeDocIcon(doc.id, icon); }}
                                                className="w-8 h-8 flex items-center justify-center text-lg hover:bg-gray-100 rounded hover:scale-110 transition-all"
                                            >
                                                {icon}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Editor Area */}
            <div className="flex-1 flex flex-col relative overflow-hidden">
                {activeDoc ? (
                    activeDoc.externalUrl ? (
                        <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 text-center p-10">
                            <div className="w-20 h-20 bg-white rounded-2xl shadow-sm flex items-center justify-center text-4xl mb-4">
                                {activeDoc.icon}
                            </div>
                            <h2 className="text-2xl font-bold text-gray-800 mb-2">{activeDoc.title}</h2>
                            <div className="flex items-center gap-2 text-gray-500 text-sm mb-8">
                                <Cloud size={16} />
                                External Resource
                            </div>
                            <a
                                href={activeDoc.externalUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-lg hover:shadow-xl transition-all"
                            >
                                Open in Browser <ExternalLink size={16} />
                            </a>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col h-full overflow-hidden">
                            {/* Doc Header */}
                            <div className="p-8 pb-4 border-b border-gray-100 bg-white z-10">
                                <input
                                    className="w-full text-4xl font-bold text-gray-900 placeholder-gray-300 outline-none bg-transparent"
                                    placeholder={t('wiki.untitled')}
                                    value={activeDoc.title}
                                    onChange={(e) => updateDocTitle(e.target.value)}
                                />
                                <div className="flex items-center gap-4 text-xs text-gray-400 mt-2">
                                    <span>Updated {new Date(activeDoc.lastModified).toLocaleDateString()}</span>
                                    {linkedTasks.length > 0 && <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded font-medium">{linkedTasks.length} Linked Tasks</span>}
                                </div>
                            </div>

                            {/* BlockNote Editor */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                                <div className="max-w-3xl mx-auto pb-32">
                                    <WikiEditor
                                        key={activeDoc.id}
                                        initialContent={activeDoc.content}
                                        onContentChange={handleContentChange}
                                    />
                                </div>
                            </div>
                        </div>
                    )
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-300">
                        <FileText size={64} className="mb-4 opacity-20" />
                        <p>Select a page to edit</p>
                    </div>
                )}
            </div>

            {/* Right Sidebar (Outline & Backlinks) */}
            {activeDoc && !activeDoc.externalUrl && (
                <div className="w-64 bg-white border-l border-gray-200 flex flex-col shrink-0">
                    <div className="flex border-b border-gray-200">
                        <button
                            onClick={() => setActiveTab('outline')}
                            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${activeTab === 'outline' ? 'border-indigo-500 text-indigo-600 bg-indigo-50/50' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                        >
                            Outline
                        </button>
                        <button
                            onClick={() => setActiveTab('tasks')}
                            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${activeTab === 'tasks' ? 'border-indigo-500 text-indigo-600 bg-indigo-50/50' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                        >
                            Linked Tasks
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4">
                        {activeTab === 'outline' ? (
                            <div className="space-y-1">
                                {outline.length === 0 && <div className="text-center text-gray-400 text-xs italic py-4">No headings yet.</div>}
                                {outline.map((item: any) => (
                                    <button
                                        key={item.id}
                                        onClick={() => scrollToBlock(item.id)}
                                        className={`w-full text-left text-sm text-gray-600 hover:text-indigo-600 hover:bg-gray-50 rounded px-2 py-1 truncate transition-colors
                                    ${item.level === 1 ? 'font-bold pl-0' : ''}
                                    ${item.level === 2 ? 'pl-3' : ''}
                                    ${item.level === 3 ? 'pl-6 text-xs' : ''}
                                `}
                                    >
                                        {item.text || 'Untitled Section'}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="text-[10px] text-gray-400 font-bold uppercase mb-2">{t('wiki.linked_tasks')}</div>
                                {linkedTasks.length === 0 && <div className="text-center text-gray-400 text-xs italic py-4">No linked tasks.</div>}
                                {linkedTasks.map(task => (
                                    <div
                                        key={task.id}
                                        onClick={() => onOpenTask(task.id)}
                                        className="bg-gray-50 border border-gray-200 rounded-lg p-3 cursor-pointer hover:border-indigo-300 hover:shadow-sm transition-all group"
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getStatusColor(task.status)}`}>
                                                {task.status}
                                            </span>
                                            <LinkIcon size={12} className="text-gray-300 group-hover:text-indigo-400" />
                                        </div>
                                        <div className="text-xs font-bold text-gray-800 mb-1">{task.subTaskName}</div>
                                        <div className="text-[10px] text-gray-500 truncate">{task.owner}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
