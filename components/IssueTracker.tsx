import React, { useState, useMemo } from 'react';
import { Issue, Project, TeamMember } from '../types';
import { IssueModal } from './IssueModal';
import { Search, Filter, Plus, AlertCircle, CheckCircle, Clock, FileText, Edit2, Trash2, Upload, X, Image as ImageIcon, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface IssueTrackerProps {
    projects: Project[];
    teamMembers: TeamMember[];
    onAddIssue: (issue: Issue) => void;
    onUpdateIssue: (issue: Issue) => void;
    onDeleteIssue: (issueId: string) => void;
    onImportIssues?: (issues: Issue[]) => void;
    onNavigateToDoc?: (projectId: string, docId: string) => void;
    tags?: Record<string, string[]>;
    onUpdateTags?: (tags: Record<string, string[]>) => void;
}

export const IssueTracker: React.FC<IssueTrackerProps> = ({ projects, teamMembers, onAddIssue, onUpdateIssue, onDeleteIssue, onImportIssues, onNavigateToDoc, tags, onUpdateTags }) => {
    const { t } = useLanguage();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingIssue, setEditingIssue] = useState<Issue | undefined>(undefined);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('All');
    const [projectFilter, setProjectFilter] = useState<string>('All');

    // Lightbox State
    const [viewingImages, setViewingImages] = useState<{ urls: string[], index: number } | null>(null);

    // Doc List State
    const [viewingDocList, setViewingDocList] = useState<{ projectId: string, docs: { id: string, title: string }[] } | null>(null);

    // Import State
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importText, setImportText] = useState('');

    // Flatten all issues
    const allIssues = useMemo(() => {
        return projects.flatMap(p => p.issues || []).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [projects]);

    // Filter issues
    const filteredIssues = useMemo(() => {
        return allIssues.filter(issue => {
            const matchesSearch =
                issue.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                issue.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (issue.responsiblePerson && issue.responsiblePerson.toLowerCase().includes(searchTerm.toLowerCase()));

            const matchesStatus = statusFilter === 'All' || issue.status === statusFilter;
            const matchesProject = projectFilter === 'All' || issue.projectName === projectFilter;

            return matchesSearch && matchesStatus && matchesProject;
        });
    }, [allIssues, searchTerm, statusFilter, projectFilter]);

    const handleEdit = (issue: Issue) => {
        setEditingIssue(issue);
        setIsModalOpen(true);
    };

    const handleDelete = (id: string) => {
        if (confirm(t('issue.delete_confirm'))) {
            onDeleteIssue(id);
        }
    };

    const getProjectIdByName = (name: string) => projects.find(p => p.info.name === name)?.id;

    const getDocDetails = (projectId: string, docIds: string[]) => {
        const project = projects.find(p => p.id === projectId);
        if (!project) return [];
        return docIds.map(id => {
            const doc = project.docs.find(d => d.id === id);
            return doc ? { id: doc.id, title: doc.title } : null;
        }).filter(Boolean) as { id: string, title: string }[];
    };

    const handleImport = () => {
        if (!importText.trim()) return;

        const lines = importText.trim().split('\n');
        const issues: Issue[] = [];

        lines.forEach((line, index) => {
            // Skip header if it looks like header
            if (index === 0 && line.includes('序号')) return;

            const cols = line.split('\t').map(c => c.trim());
            if (cols.length < 5) return; // Skip invalid lines

            // Map status
            let status: Issue['status'] = 'Open';
            if (cols[14]?.includes('关闭')) status = 'Closed';
            else if (cols[14]?.includes('实施') || cols[14]?.includes('In Progress')) status = 'In Progress';
            else if (cols[14]?.includes('方案') || cols[14]?.includes('Planning')) status = 'Planning';

            // Map Date (2025/11/12 -> 2025-11-12)
            let dateStr = cols[1] || new Date().toISOString().split('T')[0];
            if (dateStr.includes('/')) {
                const parts = dateStr.split('/');
                if (parts.length === 3) {
                    dateStr = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
                }
            }

            issues.push({
                id: cols[0] || `IMP-${Date.now()}-${index}`,
                date: dateStr,
                projectName: cols[2] || 'Unknown Project',
                deviceCategory: cols[3] || '',
                deviceType: cols[4] || '',
                category: cols[5] || '',
                source: cols[6] || '',
                reporter: cols[7] || '',
                tracker: cols[8] || '',
                description: cols[9] || '',
                attachments: cols[10] ? [cols[10]] : [],
                rootCause: cols[11] || '',
                responsiblePerson: cols[12] || '',
                temporarySolution: cols[13] || '',
                status: status
            });
        });

        if (issues.length > 0 && onImportIssues) {
            onImportIssues(issues);
            setIsImportModalOpen(false);
            setImportText('');
        } else {
            alert(t('issue.import.error'));
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Closed': return 'bg-green-100 text-green-700 border-green-200';
            case 'In Progress': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'Planning': return 'bg-amber-100 text-amber-700 border-amber-200';
            default: return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    return (
        <div className="flex flex-col h-full bg-gray-50/50 animate-in fade-in duration-300">
            {/* Header */}
            <div className="px-8 py-6 bg-white border-b border-gray-200 flex justify-between items-center sticky top-0 z-10">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{t('issue.title')}</h1>
                    <p className="text-sm text-gray-500 mt-1">{t('issue.subtitle')}</p>
                </div>
                <div className="flex gap-3">
                    {onImportIssues && (
                        <button
                            onClick={() => setIsImportModalOpen(true)}
                            className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors shadow-sm font-medium"
                        >
                            <Upload size={18} />
                            {t('issue.import_data')}
                        </button>
                    )}
                    <button
                        onClick={() => { setEditingIssue(undefined); setIsModalOpen(true); }}
                        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium"
                    >
                        <Plus size={18} />
                        {t('issue.report')}
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="px-8 py-4 bg-white border-b border-gray-200 flex gap-4 items-center">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder={t('issue.search_placeholder')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />
                </div>

                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                    <option value="All">{t('issue.filter.all_status')}</option>
                    <option value="Open">Open</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Planning">Planning</option>
                    <option value="Closed">Closed</option>
                </select>

                <select
                    value={projectFilter}
                    onChange={(e) => setProjectFilter(e.target.value)}
                    className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                    <option value="All">{t('issue.filter.all_projects')}</option>
                    {projects.map(p => (
                        <option key={p.id} value={p.info.name}>{p.info.name}</option>
                    ))}
                </select>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto p-8">
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                <th className="px-6 py-4 w-24">{t('issue.table.id')}</th>
                                <th className="px-6 py-4 w-32">{t('issue.table.date')}</th>
                                <th className="px-6 py-4 w-48">{t('issue.table.project')}</th>
                                <th className="px-6 py-4">{t('issue.table.description')}</th>
                                <th className="px-6 py-4 w-24">{t('issue.table.assets')}</th>
                                <th className="px-6 py-4 w-32">{t('issue.table.status')}</th>
                                <th className="px-6 py-4 w-40">{t('issue.table.responsible')}</th>
                                <th className="px-6 py-4 w-32">{t('issue.table.discovery')}</th>
                                <th className="px-6 py-4 w-32">{t('issue.table.resolution')}</th>
                                <th className="px-6 py-4 w-24 text-right">{t('issue.table.actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredIssues.length > 0 ? (
                                filteredIssues.map(issue => {
                                    const projectId = getProjectIdByName(issue.projectName);
                                    const docDetails = projectId ? getDocDetails(projectId, issue.linkedDocIds || []) : [];

                                    return (
                                        <tr
                                            key={issue.id}
                                            className="hover:bg-gray-50/50 transition-colors group cursor-pointer"
                                            onDoubleClick={() => handleEdit(issue)}
                                        >
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900">#{issue.id}</td>
                                            <td className="px-6 py-4 text-sm text-gray-500">{issue.date}</td>
                                            <td className="px-6 py-4 text-sm text-gray-700 font-medium">{issue.projectName}</td>
                                            <td className="px-6 py-4 text-sm text-gray-600 max-w-md truncate" title={issue.description}>
                                                {issue.description}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    {issue.attachments && issue.attachments.length > 0 && (
                                                        <button
                                                            onClick={() => setViewingImages({ urls: issue.attachments!, index: 0 })}
                                                            className="relative p-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors group/btn"
                                                            title={t('issue.view_images')}
                                                        >
                                                            <ImageIcon size={16} />
                                                            {issue.attachments.length > 1 && (
                                                                <span className="absolute -top-1.5 -right-1.5 bg-blue-600 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full border border-white">
                                                                    {issue.attachments.length}
                                                                </span>
                                                            )}
                                                        </button>
                                                    )}
                                                    {docDetails.length > 0 && (
                                                        <button
                                                            onClick={() => {
                                                                if (docDetails.length === 1 && projectId && onNavigateToDoc) {
                                                                    onNavigateToDoc(projectId, docDetails[0].id);
                                                                } else if (projectId) {
                                                                    setViewingDocList({ projectId, docs: docDetails });
                                                                }
                                                            }}
                                                            className="relative p-1.5 text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-md transition-colors"
                                                            title={t('issue.view_linked_docs')}
                                                        >
                                                            <FileText size={16} />
                                                            {docDetails.length > 1 && (
                                                                <span className="absolute -top-1.5 -right-1.5 bg-amber-600 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full border border-white">
                                                                    {docDetails.length}
                                                                </span>
                                                            )}
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(issue.status)}`}>
                                                    {issue.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                {issue.responsiblePerson || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500">{issue.discoveryDate || '-'}</td>
                                            <td className="px-6 py-4 text-sm text-gray-500">{issue.resolutionDate || '-'}</td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => handleEdit(issue)}
                                                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                        title={t('common.edit')}
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(issue.id)}
                                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        title={t('common.delete')}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                                        <div className="flex flex-col items-center justify-center gap-3">
                                            <div className="p-3 bg-gray-100 rounded-full">
                                                <AlertCircle size={24} className="text-gray-400" />
                                            </div>
                                            <p>{t('issue.no_issues')}</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <IssueModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={(issue) => {
                    if (editingIssue) {
                        onUpdateIssue(issue);
                    } else {
                        onAddIssue(issue);
                    }
                }}
                issueToEdit={editingIssue}
                projects={projects}
                teamMembers={teamMembers}
                existingIssues={allIssues}
                tags={tags}
                onUpdateTags={onUpdateTags}
            />

            {/* Import Modal */}
            {isImportModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-[1000] flex items-center justify-center animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col">
                        <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50">
                            <h2 className="text-xl font-bold text-gray-800">{t('issue.import.title')}</h2>
                            <button onClick={() => setIsImportModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full text-gray-500">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6">
                            <p className="text-sm text-gray-500 mb-4">
                                {t('issue.import.desc')}
                            </p>
                            <textarea
                                value={importText}
                                onChange={(e) => setImportText(e.target.value)}
                                className="w-full h-64 border border-gray-200 rounded-lg p-4 text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder={t('issue.import.placeholder')}
                            />
                        </div>
                        <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                            <button
                                onClick={() => setIsImportModalOpen(false)}
                                className="px-5 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition-colors"
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={handleImport}
                                className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-200"
                            >
                                {t('issue.import.btn')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Image Lightbox */}
            {viewingImages && (
                <div
                    className="fixed inset-0 bg-black/95 z-[2000] flex items-center justify-center animate-in fade-in duration-200"
                    onClick={() => setViewingImages(null)}
                >
                    <div className="relative w-full h-full flex items-center justify-center p-4" onClick={e => e.stopPropagation()}>
                        <img
                            src={viewingImages.urls[viewingImages.index]}
                            alt={`Attachment ${viewingImages.index + 1}`}
                            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                        />

                        {/* Close Button */}
                        <button
                            onClick={() => setViewingImages(null)}
                            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors bg-black/20 hover:bg-black/40 p-2 rounded-full backdrop-blur-sm"
                        >
                            <X size={24} />
                        </button>

                        {/* Navigation */}
                        {viewingImages.urls.length > 1 && (
                            <>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setViewingImages(prev => prev ? { ...prev, index: (prev.index - 1 + prev.urls.length) % prev.urls.length } : null);
                                    }}
                                    className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition-colors bg-black/20 hover:bg-black/40 p-3 rounded-full backdrop-blur-sm"
                                >
                                    <ChevronLeft size={32} />
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setViewingImages(prev => prev ? { ...prev, index: (prev.index + 1) % prev.urls.length } : null);
                                    }}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition-colors bg-black/20 hover:bg-black/40 p-3 rounded-full backdrop-blur-sm"
                                >
                                    <ChevronRight size={32} />
                                </button>
                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full text-white text-sm font-medium">
                                    {viewingImages.index + 1} / {viewingImages.urls.length}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Doc List Modal */}
            {viewingDocList && (
                <div
                    className="fixed inset-0 bg-black/20 z-[2000] flex items-center justify-center animate-in fade-in duration-200"
                    onClick={() => setViewingDocList(null)}
                >
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-800">{t('issue.linked_docs')}</h3>
                            <button onClick={() => setViewingDocList(null)} className="text-gray-400 hover:text-gray-600">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="max-h-80 overflow-y-auto p-2">
                            {viewingDocList.docs.map(doc => (
                                <button
                                    key={doc.id}
                                    onClick={() => {
                                        if (onNavigateToDoc) {
                                            onNavigateToDoc(viewingDocList.projectId, doc.id);
                                            setViewingDocList(null);
                                        }
                                    }}
                                    className="w-full text-left p-3 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-3 group"
                                >
                                    <div className="p-2 bg-blue-100 text-blue-600 rounded-lg group-hover:bg-blue-200 transition-colors">
                                        <FileText size={18} />
                                    </div>
                                    <span className="font-medium text-gray-700 group-hover:text-blue-700">{doc.title}</span>
                                    <ExternalLink size={14} className="ml-auto text-gray-400 group-hover:text-blue-400" />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
