
import React, { useState, useEffect, useRef } from 'react';
import { Search, ArrowRight, LayoutGrid, BookOpen, Users, Calendar, Briefcase, Plus, Moon, Sun, Settings } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { Project } from '../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  onNavigate: (view: string, projectId?: string) => void;
  onAction: (action: string) => void;
}

type CommandItem = {
  id: string;
  title: string;
  category: 'Navigation' | 'Projects' | 'Actions';
  icon: React.ReactNode;
  action: () => void;
  shortcut?: string;
};

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, projects, onNavigate, onAction }) => {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Define commands
  const commands: CommandItem[] = [
    // Navigation
    { id: 'nav-dash', title: t('app.view.dashboard'), category: 'Navigation', icon: <LayoutGrid size={16} />, action: () => onNavigate('projects') },
    { id: 'nav-wiki', title: t('app.view.wiki'), category: 'Navigation', icon: <BookOpen size={16} />, action: () => onNavigate('wiki') },
    { id: 'nav-mtg', title: t('app.view.meetings'), category: 'Navigation', icon: <Users size={16} />, action: () => onNavigate('meetings') },
    { id: 'nav-cal', title: t('app.view.calendar'), category: 'Navigation', icon: <Calendar size={16} />, action: () => onNavigate('calendar') },

    // Actions
    { id: 'act-new-proj', title: 'Create New Project', category: 'Actions', icon: <Plus size={16} />, action: () => onAction('create_project'), shortcut: 'C' },
    { id: 'act-settings', title: 'Open Settings', category: 'Actions', icon: <Settings size={16} />, action: () => onAction('settings'), shortcut: 'S' },
    { id: 'act-theme', title: 'Toggle Theme (Coming Soon)', category: 'Actions', icon: <Moon size={16} />, action: () => { } },
  ];

  // Add Projects dynamically
  const projectCommands: CommandItem[] = projects
    .filter(p => p && p.info)
    .map(p => ({
      id: `proj-${p.id}`,
      title: p.info.name || 'Untitled Project',
      category: 'Projects',
      icon: <Briefcase size={16} />,
      action: () => onNavigate('projects', p.id)
    }));

  const allItems = [...commands, ...projectCommands].filter(item =>
    String(item.title || '').toLowerCase().includes(query.toLowerCase())
  );

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Focus input on open
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
    if (!isOpen) {
      setQuery('');
    }
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % allItems.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + allItems.length) % allItems.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (allItems[selectedIndex]) {
          allItems[selectedIndex].action();
          onClose();
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, allItems, onClose]);

  // Auto-scroll to selected item
  useEffect(() => {
    if (listRef.current && isOpen) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={onClose}></div>

      {/* Modal */}
      <div className="relative w-full max-w-xl bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 ring-1 ring-gray-200">

        {/* Search Input */}
        <div className="flex items-center px-4 py-4 border-b border-gray-100">
          <Search size={20} className="text-gray-400 mr-3" />
          <input
            ref={inputRef}
            className="flex-1 bg-transparent outline-none text-lg text-gray-800 placeholder-gray-400"
            placeholder={t('common.search') + "..."}
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <div className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded border border-gray-200">Esc</div>
        </div>

        {/* Results List */}
        <div className="max-h-[300px] overflow-y-auto p-2 space-y-1 custom-scrollbar" ref={listRef}>
          {allItems.length === 0 ? (
            <div className="py-8 text-center text-gray-400 text-sm">No results found.</div>
          ) : (
            allItems.map((item, index) => (
              <div
                key={item.id}
                onClick={() => { item.action(); onClose(); }}
                className={`flex items-center justify-between px-3 py-3 rounded-lg cursor-pointer transition-colors ${index === selectedIndex ? 'bg-indigo-50 text-indigo-900' : 'text-gray-700 hover:bg-gray-50'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-md ${index === selectedIndex ? 'bg-white text-indigo-600 shadow-sm' : 'bg-gray-100 text-gray-500'}`}>
                    {item.icon}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold">{item.title}</span>
                    <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">{item.category}</span>
                  </div>
                </div>
                {index === selectedIndex && <ArrowRight size={16} className="text-indigo-500" />}
                {item.shortcut && index !== selectedIndex && (
                  <span className="text-xs text-gray-400 font-mono bg-gray-50 px-1.5 py-0.5 rounded border">{item.shortcut}</span>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-4 py-2 text-[10px] text-gray-400 border-t border-gray-100 flex justify-between">
          <span>ProTip: Use arrow keys to navigate</span>
          <span className="font-mono">Gen-PM v1.2</span>
        </div>
      </div>
    </div>
  );
};
