
import React, { useState, useEffect } from 'react';
import { analyzeSchedule } from '../services/geminiService';
import { ProjectPhase, ProjectInfo } from '../types';
import { Bot, X, Loader2, Sparkles } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface AIAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  phases: ProjectPhase[];
  projectInfo: ProjectInfo;
}

export const AIAssistant: React.FC<AIAssistantProps> = ({ isOpen, onClose, phases, projectInfo }) => {
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);

  // Reset state when opened
  useEffect(() => {
      if (isOpen && !response) {
          // Optional: Auto-analyze on open, or wait for user click. 
          // Currently keeping it manual start via button inside modal.
      }
  }, [isOpen]);

  const handleAnalyze = async () => {
    setIsLoading(true);
    setResponse(null);
    try {
      const result = await analyzeSchedule(phases, projectInfo);
      setResponse(result);
    } catch (e) {
      setResponse("Sorry, I encountered an error analyzing the data.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl flex flex-col max-h-[80vh]">
        
        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center bg-indigo-50 rounded-t-xl">
            <div className="flex items-center gap-2 text-indigo-900">
            <Sparkles size={20} className="text-indigo-600" />
            <h2 className="text-lg font-bold">{t('audit.title')}</h2>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={20} />
            </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
            {!response && !isLoading && (
            <div className="text-center py-8 text-gray-500">
                <Bot size={48} className="mx-auto mb-4 text-gray-300" />
                <p className="mb-4">{t('audit.intro')}</p>
                <button
                onClick={handleAnalyze}
                className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
                >
                {t('audit.start')}
                </button>
            </div>
            )}

            {isLoading && (
            <div className="flex flex-col items-center justify-center py-12">
                <Loader2 size={32} className="animate-spin text-indigo-600 mb-4" />
                <p className="text-gray-500 animate-pulse">{t('audit.analyzing')}</p>
            </div>
            )}

            {response && (
            <div className="prose prose-sm max-w-none text-gray-800">
                <div className="whitespace-pre-wrap">{response}</div>
            </div>
            )}
        </div>
            
            {/* Footer */}
        <div className="p-4 border-t bg-gray-50 rounded-b-xl flex justify-end gap-2">
                {response && (
                    <button 
                    onClick={handleAnalyze}
                    className="text-indigo-600 hover:text-indigo-800 text-sm font-medium px-4"
                    >
                        {t('audit.reanalyze')}
                    </button>
                )}
                <button 
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded text-gray-700 text-sm font-medium"
            >
                {t('common.close')}
            </button>
        </div>
        </div>
    </div>
  );
};
