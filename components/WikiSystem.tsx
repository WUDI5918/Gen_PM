import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense, useRef } from 'react';
import { ProjectDoc, ProjectTask, TaskStatus } from '../types';
import {
    FileText,
    Plus,
    Search,
    Trash2,
    ExternalLink,
    Cloud,
    Link as LinkIcon,
    Loader2,
    X,
    Wand2,
    PenLine
} from 'lucide-react';
import { performWikiAI } from '../services/geminiService';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import "@blocknote/core/fonts/inter.css";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import { BlockNoteEditor, PartialBlock } from "@blocknote/core";
import "@excalidraw/excalidraw/index.css";

// Lazy load Excalidraw for performance
const Excalidraw = lazy(() => import('@excalidraw/excalidraw').then(module => ({ default: module.Excalidraw })));

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

const SimpleMarkdownRenderer = ({ content }: { content: string }) => {
    // Parse and render markdown content with table support
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];

        // Code blocks (multi-line)
        if (line.trim().startsWith('```')) {
            const codeLines: string[] = [];
            const lang = line.trim().slice(3);
            i++;
            while (i < lines.length && !lines[i].trim().startsWith('```')) {
                codeLines.push(lines[i]);
                i++;
            }
            elements.push(
                <pre key={i} className="bg-gray-900 text-gray-100 p-4 rounded-lg my-4 overflow-x-auto">
                    <code className="text-sm font-mono">{codeLines.join('\n')}</code>
                </pre>
            );
            i++;
            continue;
        }

        // Tables
        if (line.includes('|') && line.trim().startsWith('|')) {
            const tableRows: string[][] = [];
            let hasHeader = false;

            // Collect all table rows
            while (i < lines.length && lines[i].includes('|')) {
                const row = lines[i].trim();
                // Check if this is separator row (|---|---|)
                if (row.match(/^\|[\s\-:]+\|$/)) {
                    hasHeader = true;
                    i++;
                    continue;
                }
                // Parse cells
                const cells = row.split('|').filter((_, idx, arr) => idx > 0 && idx < arr.length - 1).map(c => c.trim());
                if (cells.length > 0) {
                    tableRows.push(cells);
                }
                i++;
            }

            if (tableRows.length > 0) {
                elements.push(
                    <div key={`table-${i}`} className="overflow-x-auto my-4">
                        <table className="w-full border-collapse border border-gray-300 text-sm">
                            {hasHeader && tableRows.length > 0 && (
                                <thead className="bg-gray-100">
                                    <tr>
                                        {tableRows[0].map((cell, ci) => (
                                            <th key={ci} className="border border-gray-300 px-3 py-2 text-left font-bold text-gray-800">
                                                {cell}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                            )}
                            <tbody>
                                {tableRows.slice(hasHeader ? 1 : 0).map((row, ri) => (
                                    <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                        {row.map((cell, ci) => (
                                            <td key={ci} className="border border-gray-300 px-3 py-2 text-gray-700"
                                                dangerouslySetInnerHTML={{ __html: cell.replace(/<br>/gi, '<br/>') }} />
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                );
            }
            continue;
        }

        // Headers
        if (line.startsWith('# ')) {
            elements.push(<h1 id={`md-${i}`} key={i} className="text-3xl font-bold mb-4 text-gray-900">{line.slice(2)}</h1>);
            i++; continue;
        }
        if (line.startsWith('## ')) {
            elements.push(<h2 id={`md-${i}`} key={i} className="text-2xl font-bold mb-3 mt-6 text-gray-800 border-b pb-1">{line.slice(3)}</h2>);
            i++; continue;
        }
        if (line.startsWith('### ')) {
            elements.push(<h3 id={`md-${i}`} key={i} className="text-xl font-bold mb-2 mt-4 text-gray-800">{line.slice(4)}</h3>);
            i++; continue;
        }
        if (line.startsWith('#### ')) {
            elements.push(<h4 id={`md-${i}`} key={i} className="text-lg font-bold mb-2 mt-3 text-gray-700">{line.slice(5)}</h4>);
            i++; continue;
        }

        // Lists
        if (line.trim().startsWith('- ')) {
            elements.push(<li key={i} className="ml-5 list-disc text-gray-700 mb-1">{line.trim().slice(2)}</li>);
            i++; continue;
        }
        if (line.trim().match(/^\d+\./)) {
            elements.push(<li key={i} className="ml-5 list-decimal text-gray-700 mb-1">{line.trim().replace(/^\d+\.\s*/, '')}</li>);
            i++; continue;
        }

        // Blockquotes
        if (line.startsWith('> ')) {
            elements.push(<blockquote key={i} className="border-l-4 border-indigo-300 pl-4 italic text-gray-600 my-2 bg-indigo-50 py-2 rounded-r">{line.slice(2)}</blockquote>);
            i++; continue;
        }

        // Horizontal Rule
        if (line.trim() === '---' || line.trim() === '***') {
            elements.push(<hr key={i} className="my-6 border-gray-300" />);
            i++; continue;
        }

        // Empty lines
        if (line.trim() === '') {
            elements.push(<div key={i} className="h-3"></div>);
            i++; continue;
        }

        // Regular paragraphs with inline formatting
        const processed = line
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono text-red-600">$1</code>')
            .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" class="text-indigo-600 hover:underline" target="_blank">$1</a>');

        elements.push(<p key={i} className="text-gray-700 leading-relaxed mb-2" dangerouslySetInnerHTML={{ __html: processed }} />);
        i++;
    }

    return (
        <div className="prose prose-indigo max-w-none p-8">
            {elements}
        </div>
    );
};

const MarkdownEditor = ({
    content,
    onChange,
    onFormatOptimize,
    isFormatting = false
}: {
    content: string,
    onChange: (val: string) => void,
    onFormatOptimize?: () => void,
    isFormatting?: boolean
}) => {
    const [mode, setMode] = useState<'edit' | 'preview'>('edit');

    return (
        <div className="flex h-full flex-col">
            <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 flex justify-between items-center shrink-0">
                <div className="flex bg-gray-200 rounded-lg p-1 gap-1">
                    <button
                        onClick={() => setMode('edit')}
                        className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${mode === 'edit' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Edit
                    </button>
                    <button
                        onClick={() => setMode('preview')}
                        className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${mode === 'preview' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Preview
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    {onFormatOptimize && (
                        <button
                            onClick={onFormatOptimize}
                            disabled={isFormatting || !content.trim()}
                            className="flex items-center gap-1.5 text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Auto-format and optimize markdown"
                        >
                            {isFormatting ? (
                                <Loader2 size={14} className="animate-spin" />
                            ) : (
                                <Wand2 size={14} />
                            )}
                            {isFormatting ? 'Formatting...' : 'Format'}
                        </button>
                    )}
                    <div className="text-xs text-gray-400 font-mono">Markdown</div>
                </div>
            </div>

            <div className="flex-1 overflow-hidden relative">
                {mode === 'edit' ? (
                    <textarea
                        className="w-full h-full p-8 resize-none outline-none font-mono text-sm bg-white text-gray-800 leading-relaxed custom-scrollbar"
                        value={content}
                        onChange={e => onChange(e.target.value)}
                        placeholder="# Title\n\nStart writing your markdown here..."
                        spellCheck={false}
                    />
                ) : (
                    <div className="w-full h-full overflow-y-auto bg-white custom-scrollbar">
                        <div className="max-w-3xl mx-auto">
                            <SimpleMarkdownRenderer content={content} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// Excalidraw Editor Wrapper
const ExcalidrawEditor = ({
    data,
    onChange
}: {
    data: any,
    onChange: (data: any) => void
}) => {
    // Memoize initialData so it doesn't change on every render. 
    // The parent component MUST use a key={docId} to force remount on doc change.
    const initialData = useMemo(() => ({
        elements: data?.elements || [],
        appState: data?.appState || { viewBackgroundColor: "#ffffff" },
        files: data?.files || {}
    }), []); // Empty dependency array - only set on mount

    // Ref for debounce timeout
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    // Debounce onChange to prevent excessive updates and infinite loops
    const handleChange = useCallback((elements: any, appState: any, files: any) => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
            onChange({ elements, appState, files });
        }, 500); // 500ms debounce
    }, [onChange]);

    return (
        <div className="w-full h-full">
            <Suspense fallback={
                <div className="w-full h-full flex items-center justify-center bg-gray-50">
                    <div className="flex flex-col items-center gap-2 text-gray-500">
                        <Loader2 size={32} className="animate-spin" />
                        <span className="text-sm">Loading Excalidraw...</span>
                    </div>
                </div>
            }>
                <Excalidraw
                    initialData={initialData}
                    onChange={handleChange}
                />
            </Suspense>
        </div>
    );
};

export const WikiSystem: React.FC<WikiSystemProps> = ({ docs, tasks, activeDocId, onSelectDoc, onUpdateDocs, onOpenTask }) => {
    const { t, language } = useLanguage();
    const { addToast } = useToast();

    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'tasks' | 'outline'>('outline');
    const [iconMenuOpen, setIconMenuOpen] = useState<string | null>(null);
    const [deleteDocId, setDeleteDocId] = useState<string | null>(null);
    const [isNewDocMenuOpen, setIsNewDocMenuOpen] = useState(false);
    const [showExternalLinkModal, setShowExternalLinkModal] = useState(false);
    const [externalLinkUrl, setExternalLinkUrl] = useState('');
    const [externalLinkTitle, setExternalLinkTitle] = useState('');
    const [isFormatting, setIsFormatting] = useState(false);



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
        setExternalLinkUrl('');
        setExternalLinkTitle('');
        setShowExternalLinkModal(true);
    };

    const confirmCreateExternalDoc = () => {
        if (!externalLinkUrl) return;

        // Ensure URL has protocol
        let url = externalLinkUrl;
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }

        const newDoc: ProjectDoc = {
            id: `ext-${Date.now()}`,
            title: externalLinkTitle || 'External Resource',
            icon: '🔗',
            content: [],
            externalUrl: url,
            lastModified: Date.now()
        };
        onUpdateDocs([...docs, newDoc]);
        onSelectDoc(newDoc.id);
        setShowExternalLinkModal(false);
    };

    const handleCreateMarkdownDoc = () => {
        const newDoc: ProjectDoc = {
            id: `md-${Date.now()}`,
            title: 'Untitled Markdown',
            icon: '📝',
            content: [],
            markdownContent: '# Untitled Markdown\n\nStart writing...',
            type: 'markdown',
            lastModified: Date.now()
        };
        onUpdateDocs([...docs, newDoc]);
        onSelectDoc(newDoc.id);
    };

    const handleCreateExcalidrawDoc = () => {
        const newDoc: ProjectDoc = {
            id: `draw-${Date.now()}`,
            title: 'Untitled Diagram',
            icon: '🎨',
            content: [],
            type: 'excalidraw',
            excalidrawData: {
                elements: [],
                appState: { viewBackgroundColor: "#ffffff" },
                files: {}
            },
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

    // Format and optimize markdown content using AI
    const handleFormatOptimize = async () => {
        if (!activeDoc || activeDoc.type !== 'markdown' || !activeDoc.markdownContent?.trim()) return;

        setIsFormatting(true);
        try {
            const savedConfig = localStorage.getItem('project_ai_config');
            const config = savedConfig ? JSON.parse(savedConfig) : undefined;

            const result = await performWikiAI('custom', {
                context: activeDoc.markdownContent,
                userPrompt: `You are a Markdown formatting expert. Clean up and optimize this markdown:

Rules:
- Fix heading hierarchy (# for title, ## for sections, etc.)
- Ensure proper line breaks between paragraphs
- Use consistent list formatting (- for bullets)
- Fix code blocks with proper syntax
- Remove extra blank lines
- DO NOT change the content meaning

Return ONLY clean markdown. No code fences, no explanations.`,
                language: language === 'zh' ? 'Chinese' : 'English'
            }, config);

            // Clean up the result
            let cleanResult = result
                .replace(/\\n/g, '\n')           // Convert literal \n to newlines
                .replace(/^```markdown\n?/i, '') // Remove opening markdown fence
                .replace(/^```\n?/i, '')         // Remove opening fence
                .replace(/\n?```$/i, '')         // Remove closing fence
                .trim();

            // Update the document with formatted content
            const updatedDoc = { ...activeDoc, markdownContent: cleanResult, lastModified: Date.now() };
            onUpdateDocs(docs.map(d => d.id === activeDoc.id ? updatedDoc : d));
            addToast(t('wiki.format_success') || 'Format optimized successfully', 'success');
        } catch (error: any) {
            addToast(error.message || t('wiki.format_error') || 'Format optimization failed', 'error');
        } finally {
            setIsFormatting(false);
        }
    };

    const filteredDocs = docs.filter(d => d.title.toLowerCase().includes(searchQuery.toLowerCase()));

    // Generate Outline from Editor Blocks (simple approach)
    const outline = useMemo(() => {
        if (!activeDoc) return [];

        if (activeDoc.type === 'markdown' && activeDoc.markdownContent) {
            const lines = activeDoc.markdownContent.split('\n');
            const headings: any[] = [];
            lines.forEach((line, index) => {
                if (line.startsWith('# ')) headings.push({ id: `md-${index}`, text: line.slice(2), level: 1 });
                else if (line.startsWith('## ')) headings.push({ id: `md-${index}`, text: line.slice(3), level: 2 });
                else if (line.startsWith('### ')) headings.push({ id: `md-${index}`, text: line.slice(4), level: 3 });
            });
            return headings;
        }

        if (!Array.isArray(activeDoc.content)) return [];
        // Filter headings from content
        return activeDoc.content.filter((b: any) => b.type === 'heading').map((b: any) => ({
            id: b.id,
            text: Array.isArray(b.content) ? b.content.map((c: any) => c.text).join('') : '',
            level: b.props.level
        }));
    }, [activeDoc]);

    const scrollToBlock = (blockId: string) => {
        // Try to find by ID (Markdown) or data-id (BlockNote)
        const el = document.getElementById(blockId) || document.querySelector(`[data-id="${blockId}"]`);
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
                    <div className="space-y-2 relative">
                        <button
                            onClick={() => setIsNewDocMenuOpen(!isNewDocMenuOpen)}
                            className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white text-xs font-bold py-2.5 rounded-lg hover:bg-indigo-700 transition-all shadow-sm hover:shadow-md"
                        >
                            <Plus size={16} strokeWidth={2.5} /> {t('wiki.new_page') || 'New Page'}
                        </button>

                        {isNewDocMenuOpen && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setIsNewDocMenuOpen(false)}></div>
                                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 p-1 z-20 animate-in fade-in zoom-in-95 duration-100">
                                    <button
                                        onClick={() => { handleCreateDoc(); setIsNewDocMenuOpen(false); }}
                                        className="w-full text-left px-3 py-2 text-xs font-medium text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg flex items-center gap-2 transition-colors"
                                    >
                                        <span className="text-lg">📄</span> Standard Page
                                    </button>
                                    <button
                                        onClick={() => { handleCreateMarkdownDoc(); setIsNewDocMenuOpen(false); }}
                                        className="w-full text-left px-3 py-2 text-xs font-medium text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg flex items-center gap-2 transition-colors"
                                    >
                                        <span className="text-lg">📝</span> Markdown Page
                                    </button>
                                    <button
                                        onClick={() => { handleCreateExcalidrawDoc(); setIsNewDocMenuOpen(false); }}
                                        className="w-full text-left px-3 py-2 text-xs font-medium text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg flex items-center gap-2 transition-colors"
                                    >
                                        <span className="text-lg">🎨</span> Excalidraw Diagram
                                    </button>
                                    <div className="h-px bg-gray-100 my-1"></div>
                                    <button
                                        onClick={() => { handleCreateExternalDoc(); setIsNewDocMenuOpen(false); }}
                                        className="w-full text-left px-3 py-2 text-xs font-medium text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg flex items-center gap-2 transition-colors"
                                    >
                                        <span className="text-lg">🔗</span> External Link
                                    </button>
                                </div>
                            </>
                        )}
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
                        <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50">
                            {/* Header with Title and Link */}
                            <div className="p-4 border-b border-gray-200 bg-white flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-3 flex-1">
                                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-xl shrink-0">
                                        {activeDoc.icon}
                                    </div>
                                    <input
                                        className="text-xl font-bold text-gray-900 placeholder-gray-300 outline-none bg-transparent w-full"
                                        value={activeDoc.title}
                                        onChange={(e) => updateDocTitle(e.target.value)}
                                        placeholder="Document Title"
                                    />
                                </div>
                                <a
                                    href={activeDoc.externalUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors text-xs font-bold"
                                >
                                    Open in New Tab <ExternalLink size={14} />
                                </a>
                            </div>

                            {/* Iframe Content */}
                            <div className="flex-1 relative w-full h-full">
                                <iframe
                                    src={activeDoc.externalUrl}
                                    className="w-full h-full border-none"
                                    title="External Content"
                                    sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                                />
                                {/* Overlay for when iframe fails to load or is blocked */}
                                <div className="absolute inset-0 -z-10 flex flex-col items-center justify-center text-gray-400">
                                    <Loader2 size={32} className="animate-spin mb-2" />
                                    <p className="text-sm">Loading content...</p>
                                    <p className="text-xs mt-2 max-w-md text-center">If content doesn't load, it might be blocked by the website. Use the "Open in New Tab" button.</p>
                                </div>
                            </div>
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


                            {/* Editor Area */}
                            <div className={`flex-1 overflow-y-auto custom-scrollbar ${activeDoc.type === 'markdown' || activeDoc.type === 'excalidraw' ? 'p-0' : 'p-4'}`}>
                                {activeDoc.type === 'markdown' ? (
                                    <MarkdownEditor
                                        content={activeDoc.markdownContent || ''}
                                        onChange={(val) => {
                                            const updated = { ...activeDoc, markdownContent: val, lastModified: Date.now() };
                                            onUpdateDocs(docs.map(d => d.id === activeDoc.id ? updated : d));
                                        }}
                                        onFormatOptimize={handleFormatOptimize}
                                        isFormatting={isFormatting}
                                    />
                                ) : activeDoc.type === 'excalidraw' ? (
                                    <ExcalidrawEditor
                                        key={activeDoc.id}
                                        data={activeDoc.excalidrawData}
                                        onChange={(data) => {
                                            const updated = { ...activeDoc, excalidrawData: data, lastModified: Date.now() };
                                            onUpdateDocs(docs.map(d => d.id === activeDoc.id ? updated : d));
                                        }}
                                    />
                                ) : (
                                    <div className="max-w-3xl mx-auto pb-32">
                                        <WikiEditor
                                            key={activeDoc.id}
                                            initialContent={activeDoc.content}
                                            onContentChange={handleContentChange}
                                        />
                                    </div>
                                )}
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
            {/* External Link Modal */}
            {showExternalLinkModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <ExternalLink size={20} className="text-indigo-600" />
                            Add External Resource
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Title</label>
                                <input
                                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                    placeholder="e.g., Product Requirements"
                                    value={externalLinkTitle}
                                    onChange={e => setExternalLinkTitle(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">URL</label>
                                <input
                                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                    placeholder="https://example.com/doc"
                                    value={externalLinkUrl}
                                    onChange={e => setExternalLinkUrl(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && confirmCreateExternalDoc()}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 mt-6">
                            <button
                                onClick={() => setShowExternalLinkModal(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmCreateExternalDoc}
                                disabled={!externalLinkUrl}
                                className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                Add Link
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
