import React, { useState } from 'react';
import { Project, TeamMember } from '../types';
import { Plus, Trash2, FolderOpen, Clock, User, Search } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useDialog } from '../contexts/DialogContext';

interface ProjectLibraryProps {
  projects: Project[];
  teamMembers: TeamMember[];
  onUpdateTeam: (members: TeamMember[]) => void;
  onCreateProject: () => void;
  onSelectProject: (project: Project) => void;
  onDeleteProject: (projectId: string) => void;
}

export const ProjectLibrary: React.FC<ProjectLibraryProps> = ({
  projects,
  teamMembers,
  onUpdateTeam,
  onCreateProject,
  onSelectProject,
  onDeleteProject
}) => {
  const { t, language } = useLanguage();
  const { ask } = useDialog();

  const [searchQuery, setSearchQuery] = useState('');

  const handleDeleteClick = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    ask({
      title: t('common.delete') + ' Project?',
      message: language === 'en' ? 'This will permanently delete the project and all associated tasks, meetings, and documents.' : '这将永久删除该项目及其所有关联任务、会议和文档。',
      type: 'danger',
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      onConfirm: () => onDeleteProject(projectId)
    });
  };

  const filteredProjects = projects.filter(p => {
    if (!p || !p.info) return false;
    const name = String(p.info.name || '');
    const code = String(p.info.code || '');
    return name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      code.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-10 overflow-y-auto custom-scrollbar">
      <div className="max-w-7xl mx-auto">

        {/* Combined Toolbar: Search, Count, Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">

          {/* Left: Search */}
          <div className="flex items-center gap-4 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder={language === 'en' ? "Search projects..." : "搜索项目..."}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-11 pr-4 py-2.5 text-sm font-medium text-gray-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="h-8 w-px bg-gray-200 hidden md:block"></div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest hidden md:block whitespace-nowrap">
              {filteredProjects.length} {language === 'en' ? 'Projects' : '个项目'}
            </span>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={onCreateProject}
              className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 hover:shadow-indigo-500/50 hover:-translate-y-0.5 transition-all flex items-center gap-2 text-sm whitespace-nowrap"
            >
              <Plus size={18} /> {t('common.add')} Project
            </button>
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Add New Card (Visual cue) */}
          <button
            onClick={onCreateProject}
            className="group flex flex-col items-center justify-center min-h-[240px] bg-white border-2 border-dashed border-gray-300 rounded-2xl hover:border-indigo-500 hover:bg-indigo-50/50 transition-all cursor-pointer relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="relative z-10 flex flex-col items-center">
              <div className="w-14 h-14 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300 shadow-sm">
                <Plus size={28} />
              </div>
              <span className="text-sm font-bold text-gray-500 group-hover:text-indigo-700 transition-colors">{t('common.add')} Project</span>
            </div>
          </button>

          {filteredProjects.map(project => (
            <div
              key={project.id}
              className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-xl hover:shadow-indigo-500/10 hover:border-indigo-200 transition-all duration-300 group flex flex-col relative cursor-pointer min-h-[240px]"
              onClick={() => onSelectProject(project)}
            >
              {/* Card Header Gradient */}
              <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-80"></div>

              <div className="p-6 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2.5 bg-gray-50 text-gray-600 rounded-xl group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                    <FolderOpen size={20} />
                  </div>
                  <span className="text-[10px] font-mono font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded border border-gray-100">
                    {String(project.info.code || 'NO-CODE')}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-gray-800 mb-2 group-hover:text-indigo-700 transition-colors line-clamp-1">
                  {String(project.info.name || 'Untitled Project')}
                </h3>
                <p className="text-xs text-gray-500 line-clamp-2 mb-6 leading-relaxed">
                  {String(project.info.description || t('project.no_desc'))}
                </p>

                <div className="mt-auto pt-4 border-t border-gray-50 flex items-center gap-3 text-[10px] font-medium text-gray-400">
                  <div className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-md">
                    <User size={12} />
                    <span className="truncate max-w-[80px]">{String(project.info.manager || 'N/A')}</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-md">
                    <Clock size={12} />
                    <span>{new Date(project.lastModified).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              {/* Footer Stats */}
              <div className="px-6 py-3 bg-gray-50/50 border-t border-gray-100 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center min-w-[20px] h-5 bg-white border border-gray-200 rounded text-[10px] font-bold text-gray-700 px-1 shadow-sm">
                    {project.phases.flatMap(p => p.tasks).length}
                  </span>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{t('table.phase_tasks')}</span>
                </div>

                <button
                  onClick={(e) => handleDeleteClick(e, project.id)}
                  className="p-1.5 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                  title="Delete Project"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};