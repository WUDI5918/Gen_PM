
import React, { useState, useRef, useEffect } from 'react';
import { Project } from '../types';
import { chatStreamProject } from '../services/geminiService';
import { Send, Bot, User, X, Loader2, Sparkles, Eraser } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';

interface ProjectChatProps {
    project: Project;
    onClose: () => void;
}

interface ChatMessage {
    id: string;
    role: 'user' | 'ai';
    text: string;
    isStreaming?: boolean;
}

export const ProjectChat: React.FC<ProjectChatProps> = ({ project, onClose }) => {
    const { t, language } = useLanguage();
    const { addToast } = useToast();
    
    const [messages, setMessages] = useState<ChatMessage[]>([
        { 
            id: 'intro', 
            role: 'ai', 
            text: t('chat.intro').replace('{projectName}', project.info.name)
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        // Create placeholder for AI response
        const aiMsgId = (Date.now() + 1).toString();
        setMessages(prev => [...prev, { id: aiMsgId, role: 'ai', text: '', isStreaming: true }]);

        try {
            const savedConfig = localStorage.getItem('project_ai_config');
            const config = savedConfig ? JSON.parse(savedConfig) : undefined;

            const stream = chatStreamProject(userMsg.text, project, config, language);
            let fullText = '';

            for await (const chunk of stream) {
                fullText += chunk;
                setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: fullText } : m));
            }
            
            setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, isStreaming: false } : m));

        } catch (error: any) {
            console.error(error);
            setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: t('chat.error_response'), isStreaming: false } : m));
            addToast(`${t('chat.error')}: ` + (error.message || "Unknown"), 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleClear = () => {
        setMessages([{ 
            id: 'intro', 
            role: 'ai', 
            text: t('chat.cleared')
        }]);
    };

    // Simple Markdown Renderer for Chat
    const renderMarkdown = (text: string) => {
        // Basic formatting: bold, list, line breaks
        let html = text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br/>')
            .replace(/- (.*?)(<br\/>|$)/g, '• $1$2');
        return { __html: html };
    };

    return (
        <div className="flex flex-col h-full bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
            {/* Header */}
            <div className="p-4 bg-indigo-50 border-b border-indigo-100 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg">
                        <Sparkles size={16} />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-gray-800">{t('chat.title')}</h3>
                        <p className="text-[10px] text-gray-500">{t('chat.powered')}</p>
                    </div>
                </div>
                <div className="flex gap-1">
                     <button onClick={handleClear} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-100 rounded transition-colors" title={t('chat.clear')}>
                        <Eraser size={16} />
                    </button>
                    <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors">
                        <X size={16} />
                    </button>
                </div>
            </div>

            {/* Messages Area */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50 custom-scrollbar">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-indigo-600'}`}>
                            {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                        </div>
                        <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                            msg.role === 'user' 
                            ? 'bg-indigo-600 text-white rounded-tr-none' 
                            : 'bg-white border border-gray-100 text-gray-700 rounded-tl-none'
                        }`}>
                            {msg.text ? (
                                <div dangerouslySetInnerHTML={renderMarkdown(msg.text)} />
                            ) : (
                                <div className="flex items-center gap-1 h-5">
                                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
                                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-100"></span>
                                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-200"></span>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-gray-100 shrink-0">
                <div className="relative flex items-center">
                    <input 
                        className="w-full bg-gray-100 border-transparent focus:bg-white focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50 rounded-xl pl-4 pr-12 py-3 text-sm transition-all outline-none"
                        placeholder={t('chat.placeholder')}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        disabled={isLoading}
                    />
                    <button 
                        onClick={handleSend}
                        disabled={!input.trim() || isLoading}
                        className="absolute right-2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:bg-gray-300 transition-colors shadow-sm"
                    >
                        {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    </button>
                </div>
            </div>
        </div>
    );
};
