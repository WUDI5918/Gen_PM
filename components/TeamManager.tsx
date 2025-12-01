
import React, { useState } from 'react';
import { TeamMember } from '../types';
import { X, Plus, Trash2, User } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useDialog } from '../contexts/DialogContext';

interface TeamManagerProps {
  isOpen: boolean;
  onClose: () => void;
  teamMembers: TeamMember[];
  onUpdateTeam: (members: TeamMember[]) => void;
}

export const TeamManager: React.FC<TeamManagerProps> = ({ isOpen, onClose, teamMembers, onUpdateTeam }) => {
  const { t } = useLanguage();
  const { ask } = useDialog();
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('');

  if (!isOpen) return null;

  const handleAdd = () => {
    if (!newName.trim()) return;
    
    const colors = [
      'bg-blue-100 text-blue-700',
      'bg-green-100 text-green-700',
      'bg-purple-100 text-purple-700', 
      'bg-yellow-100 text-yellow-700',
      'bg-pink-100 text-pink-700',
      'bg-indigo-100 text-indigo-700'
    ];
    
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    const initials = newName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

    const newMember: TeamMember = {
      id: `tm-${Date.now()}`,
      name: newName,
      role: newRole || 'Member',
      avatar: initials,
      color: randomColor
    };

    onUpdateTeam([...teamMembers, newMember]);
    setNewName('');
    setNewRole('');
  };

  const handleDelete = (id: string) => {
    ask({
        title: 'Remove Team Member?',
        message: 'Are you sure you want to remove this person from the team library?',
        type: 'danger',
        confirmText: 'Remove',
        onConfirm: () => onUpdateTeam(teamMembers.filter(m => m.id !== id))
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl flex flex-col max-h-[80vh] animate-in fade-in zoom-in duration-200">
        <div className="p-5 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl">
          <h3 className="font-bold text-lg text-gray-800">{t('team.title')}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          
          {/* Add New */}
          <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 space-y-3">
            <h4 className="text-xs font-bold text-indigo-600 uppercase">{t('team.add_new')}</h4>
            <div className="flex gap-2">
              <div className="space-y-2 flex-1">
                <input 
                  className="w-full text-sm border border-indigo-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder={t('team.name_placeholder')}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
                <input 
                  className="w-full text-sm border border-indigo-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder={t('team.role_placeholder')}
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                />
              </div>
            </div>
            <button 
              onClick={handleAdd}
              disabled={!newName}
              className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
            >
              <Plus size={16} /> {t('team.add_btn')}
            </button>
          </div>

          {/* List */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-gray-500 uppercase">{t('team.current')} ({teamMembers.length})</h4>
            {teamMembers.map(member => (
              <div key={member.id} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl hover:shadow-sm transition-shadow">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold ${member.color}`}>
                    {member.avatar}
                  </div>
                  <div>
                    <div className="font-bold text-sm text-gray-800">{member.name}</div>
                    <div className="text-xs text-gray-500">{member.role}</div>
                  </div>
                </div>
                {member.name !== 'Unassigned' && (
                    <button 
                        onClick={() => handleDelete(member.id)}
                        className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"
                    >
                        <Trash2 size={16} />
                    </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
