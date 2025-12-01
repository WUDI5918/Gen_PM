
import React, { useState, useRef, useEffect } from 'react';
import { AppNotification } from '../types';
import { Bell, Check, Info, AlertTriangle, CheckCircle, AlertCircle, X } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface NotificationCenterProps {
    notifications: AppNotification[];
    onMarkRead: (id?: string) => void;
    onNavigate: (link: AppNotification['link']) => void;
    isCollapsed?: boolean;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ notifications, onMarkRead, onNavigate, isCollapsed }) => {
    const { t } = useLanguage();
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const unreadCount = notifications.filter(n => !n.read).length;

    const getIcon = (type: string) => {
        switch(type) {
            case 'warning': return <AlertTriangle size={16} className="text-amber-500" />;
            case 'error': return <AlertCircle size={16} className="text-rose-500" />;
            case 'success': return <CheckCircle size={16} className="text-emerald-500" />;
            default: return <Info size={16} className="text-blue-500" />;
        }
    };

    const handleClick = (n: AppNotification) => {
        onMarkRead(n.id);
        if (n.link) onNavigate(n.link);
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={containerRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`relative p-2 rounded-lg text-gray-500 hover:text-indigo-600 hover:bg-gray-100 transition-colors ${isOpen ? 'bg-indigo-50 text-indigo-600' : ''}`}
                title={t('notif.title')}
            >
                <Bell size={20} />
                {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white animate-pulse"></span>
                )}
            </button>

            {isOpen && (
                <div 
                    className="absolute left-full top-0 ml-3 w-80 bg-white rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.2)] border border-gray-200 z-[100] overflow-hidden animate-in fade-in slide-in-from-left-2 duration-200"
                    style={{ marginTop: -4 }} // Slight adjustment to align tops
                >
                    <div className="p-3 border-b border-gray-100 flex justify-between items-center bg-gray-50/80 backdrop-blur-sm">
                        <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                            <Bell size={12} /> {t('notif.title')}
                        </h3>
                        <div className="flex gap-2">
                            {unreadCount > 0 && (
                                <button onClick={() => onMarkRead()} className="text-[10px] font-bold text-indigo-600 hover:underline flex items-center gap-1 bg-white border border-gray-200 px-2 py-1 rounded shadow-sm hover:bg-indigo-50 transition-colors">
                                    <Check size={12} /> {t('notif.mark_read')}
                                </button>
                            )}
                            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                <X size={14} />
                            </button>
                        </div>
                    </div>
                    
                    <div className="max-h-[320px] overflow-y-auto custom-scrollbar bg-white">
                        {notifications.length === 0 ? (
                            <div className="p-8 text-center text-gray-400 flex flex-col items-center">
                                <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center mb-2">
                                    <Bell size={16} className="text-gray-300" />
                                </div>
                                <span className="text-xs font-medium">{t('notif.empty')}</span>
                            </div>
                        ) : (
                            notifications.slice().reverse().map(n => (
                                <div 
                                    key={n.id} 
                                    onClick={() => handleClick(n)}
                                    className={`p-4 border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-all flex gap-3 relative group ${!n.read ? 'bg-indigo-50/30' : ''}`}
                                >
                                    <div className="mt-0.5 shrink-0 p-1.5 bg-white rounded-full shadow-sm border border-gray-100 h-fit">{getIcon(n.type)}</div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start">
                                            <h4 className={`text-sm truncate pr-2 ${!n.read ? 'font-bold text-gray-800' : 'font-medium text-gray-600'}`}>{n.title}</h4>
                                            <span className="text-[9px] text-gray-400 whitespace-nowrap">{new Date(n.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed line-clamp-2">{n.message}</p>
                                    </div>
                                    {!n.read && <div className="absolute right-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-indigo-500 rounded-full"></div>}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
