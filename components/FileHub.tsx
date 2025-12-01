
import React, { useState, useMemo } from 'react';
import { Project, ProjectFile, TaskAttachment } from '../types';
import { FolderOpen, Image, FileText, Link as LinkIcon, File, Search, Filter, ExternalLink } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface FileHubProps {
    project: Project;
}

export const FileHub: React.FC<FileHubProps> = ({ project }) => {
    const { t } = useLanguage();
    const [filter, setFilter] = useState<'all'|'image'|'doc'|'link'>('all');
    const [search, setSearch] = useState('');

    // Aggregate all files from tasks + project global files (if any)
    const allFiles = useMemo(() => {
        const files: ProjectFile[] = [];
        
        // 1. From Tasks
        project.phases.forEach(phase => {
            phase.tasks.forEach(task => {
                task.attachments.forEach(att => {
                    const isImage = att.url.match(/\.(jpeg|jpg|gif|png|webp)$/i);
                    const isDoc = att.url.match(/\.(pdf|doc|docx|xls|csv)$/i);
                    
                    files.push({
                        id: att.id,
                        name: att.name,
                        url: att.url,
                        type: isImage ? 'image' : isDoc ? 'document' : 'link',
                        uploadedBy: task.owner || 'Unknown',
                        uploadedAt: new Date().toISOString(), // Fallback as we don't track attach time yet
                        source: 'task',
                        sourceId: task.id
                    });
                });
            });
        });

        // 2. Global Files (if added to project type later)
        if (project.files) {
            files.push(...project.files);
        }

        return files;
    }, [project]);

    const filteredFiles = allFiles.filter(f => {
        const matchesSearch = f.name.toLowerCase().includes(search.toLowerCase());
        const matchesType = filter === 'all' || 
                            (filter === 'image' && f.type === 'image') ||
                            (filter === 'doc' && f.type === 'document') ||
                            (filter === 'link' && f.type === 'link');
        return matchesSearch && matchesType;
    });

    const getIcon = (type: string) => {
        switch(type) {
            case 'image': return <Image size={20} className="text-purple-500" />;
            case 'document': return <FileText size={20} className="text-blue-500" />;
            case 'link': return <LinkIcon size={20} className="text-emerald-500" />;
            default: return <File size={20} className="text-gray-500" />;
        }
    };

    return (
        <div className="h-full flex flex-col bg-gray-50/50 overflow-y-auto custom-scrollbar p-8">
            <div className="max-w-7xl mx-auto w-full">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div>
                        <h2 className="text-2xl font-extrabold text-gray-900 flex items-center gap-3">
                            <FolderOpen className="text-indigo-600" /> {t('files.title')}
                        </h2>
                        <p className="text-gray-500 mt-1">{t('files.subtitle')}</p>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input 
                                className="pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-indigo-500 w-full sm:w-64"
                                placeholder={t('files.search_placeholder')}
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                        <div className="flex bg-white rounded-xl border border-gray-200 p-1">
                            {['all', 'image', 'doc', 'link'].map(f => (
                                <button 
                                    key={f}
                                    onClick={() => setFilter(f as any)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${filter === f ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:bg-gray-50'}`}
                                >
                                    {f === 'all' ? t('files.filter_all') : 
                                     f === 'image' ? t('files.filter_img') :
                                     f === 'doc' ? t('files.filter_doc') : f}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {filteredFiles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 bg-white rounded-2xl border-2 border-dashed border-gray-200 text-gray-400">
                        <FolderOpen size={48} className="opacity-20 mb-4" />
                        <p className="text-sm font-medium">{t('files.no_results')}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {filteredFiles.map((file, idx) => (
                            <div key={idx} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all group overflow-hidden flex flex-col">
                                {/* Preview Area */}
                                <div className="h-32 bg-gray-50 flex items-center justify-center border-b border-gray-100 relative">
                                    {file.type === 'image' ? (
                                        <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="scale-150 opacity-50">{getIcon(file.type)}</div>
                                    )}
                                    <a href={file.url} target="_blank" rel="noreferrer" className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <ExternalLink className="text-white" size={24} />
                                    </a>
                                </div>
                                
                                <div className="p-4 flex-1 flex flex-col">
                                    <div className="flex items-start gap-3 mb-2">
                                        <div className="mt-0.5 shrink-0">{getIcon(file.type)}</div>
                                        <div className="min-w-0">
                                            <h4 className="text-sm font-bold text-gray-800 truncate" title={file.name}>{file.name}</h4>
                                            <p className="text-[10px] text-gray-400 truncate">{file.url}</p>
                                        </div>
                                    </div>
                                    
                                    <div className="mt-auto pt-3 border-t border-gray-50 flex justify-between items-center text-[10px] text-gray-400">
                                        <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-500 font-medium capitalize">{t('files.source')}: {file.source}</span>
                                        <span>{file.uploadedBy === 'Unknown' ? t('files.unknown_user') : file.uploadedBy}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
