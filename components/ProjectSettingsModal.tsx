
import React, { useState, useEffect } from 'react';
import { Project } from '../types';
import { X, Save, Layout, User, Hash, AlignLeft, DollarSign } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';

interface ProjectSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  onUpdateProject: (project: Project) => void;
}

export const ProjectSettingsModal: React.FC<ProjectSettingsModalProps> = ({ isOpen, onClose, project, onUpdateProject }) => {
  const { t } = useLanguage();
  const { addToast } = useToast();
  
  const [formData, setFormData] = useState({
      name: '',
      code: '',
      manager: '',
      description: '',
      budgetTotal: ''
  });

  useEffect(() => {
      if (isOpen) {
          setFormData({
              name: project.info.name || '',
              code: project.info.code || '',
              manager: project.info.manager || '',
              description: project.info.description || '',
              budgetTotal: project.info.budgetTotal?.toString() || ''
          });
      }
  }, [isOpen, project]);

  if (!isOpen) return null;

  const handleSave = () => {
      onUpdateProject({
          ...project,
          info: {
              ...project.info,
              name: formData.name,
              code: formData.code,
              manager: formData.manager,
              description: formData.description,
              budgetTotal: parseFloat(formData.budgetTotal) || 0
          },
          lastModified: Date.now()
      });
      addToast(t('common.save'), 'success');
      onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[90] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
        
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <div className="flex items-center gap-2 text-gray-800">
                <Layout size={20} className="text-indigo-600" />
                <h3 className="font-bold text-lg">Project Settings</h3>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full text-gray-400 transition-colors">
                <X size={20} />
            </button>
        </div>

        <div className="p-6 space-y-5">
            
            <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Project Name</label>
                <div className="relative">
                    <input 
                        className="w-full border border-gray-200 rounded-lg pl-10 pr-3 py-2.5 text-sm font-bold text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                        value={formData.name}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                        placeholder="e.g. Q4 Marketing Campaign"
                    />
                    <Layout size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Code</label>
                    <div className="relative">
                        <input 
                            className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2.5 text-sm font-mono text-gray-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            value={formData.code}
                            onChange={e => setFormData({...formData, code: e.target.value})}
                            placeholder="PRJ-001"
                        />
                        <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Manager</label>
                    <div className="relative">
                        <input 
                            className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2.5 text-sm text-gray-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            value={formData.manager}
                            onChange={e => setFormData({...formData, manager: e.target.value})}
                            placeholder="Manager Name"
                        />
                        <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    </div>
                </div>
            </div>

            <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Total Budget</label>
                <div className="relative">
                    <input 
                        type="number"
                        className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2.5 text-sm text-gray-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        value={formData.budgetTotal}
                        onChange={e => setFormData({...formData, budgetTotal: e.target.value})}
                        placeholder="0.00"
                    />
                    <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>
            </div>

            <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Description</label>
                <div className="relative">
                    <textarea 
                        className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2.5 text-sm text-gray-600 focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                        rows={3}
                        value={formData.description}
                        onChange={e => setFormData({...formData, description: e.target.value})}
                        placeholder="Brief summary of the project goals..."
                    />
                    <AlignLeft size={16} className="absolute left-3 top-3 text-gray-400" />
                </div>
            </div>

        </div>

        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
            <button 
                onClick={onClose}
                className="px-5 py-2.5 text-sm font-bold text-gray-500 hover:bg-gray-200 rounded-xl transition-colors"
            >
                Cancel
            </button>
            <button 
                onClick={handleSave}
                className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-500/20 flex items-center gap-2 transition-all"
            >
                <Save size={16} /> Save Changes
            </button>
        </div>

      </div>
    </div>
  );
};
