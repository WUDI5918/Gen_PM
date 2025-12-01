import React, { useState, useEffect } from 'react';
import { generateProjectPlan, AIConfig, GenerationOptions } from '../services/geminiService';
import { ProjectPhase, Project, TeamMember } from '../types';
import { Sparkles, X, Loader2, ArrowRight, CheckCircle, Settings, Save, Sliders, Clock, Layers, Briefcase, Folder, Layout, CalendarClock } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';

interface AIGeneratorProps {
    isOpen: boolean;
    onClose: () => void;
    onPlanGenerated: (phases: ProjectPhase[], targetProjectId?: string) => void;
    projects?: Project[]; // Optional list of existing projects to choose from
    defaultProjectId?: string;
    teamMembers?: TeamMember[];
}

export const AIGenerator: React.FC<AIGeneratorProps> = ({ isOpen, onClose, onPlanGenerated, projects = [], defaultProjectId, teamMembers }) => {
    const { t, language } = useLanguage();
    const { addToast } = useToast();
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [generatedPhases, setGeneratedPhases] = useState<ProjectPhase[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Settings State
    const [showSettings, setShowSettings] = useState(false);
    const [config, setConfig] = useState<AIConfig>({
        provider: 'gemini',
        apiKey: '',
        baseUrl: '',
        model: ''
    });

    // Advanced Options State
    const [genOptions, setGenOptions] = useState<GenerationOptions>({
        duration: '',
        detailLevel: 'Standard',
        domain: 'General',
        language: language, // Default to system language
        structure: 'full', // Default to full project
        autoSchedule: true // Default on
    });

    const [targetProjectId, setTargetProjectId] = useState<string>(defaultProjectId || '');

    // Load config from local storage on mount
    useEffect(() => {
        const savedConfig = localStorage.getItem('project_ai_config');
        if (savedConfig) {
            setConfig(JSON.parse(savedConfig));
        }
    }, []);

    // Update target when default changes or opens
    useEffect(() => {
        if (isOpen && defaultProjectId) {
            setTargetProjectId(defaultProjectId);
        }
    }, [isOpen, defaultProjectId]);

    useEffect(() => {
        // Sync language
        setGenOptions(prev => ({ ...prev, language }));
    }, [language]);

    const saveConfig = () => {
        localStorage.setItem('project_ai_config', JSON.stringify(config));
        setShowSettings(false);
        addToast("AI Configuration Saved", 'success');
    };

    if (!isOpen) return null;

    const handleGenerate = async () => {
        if (!prompt.trim()) return;

        setIsLoading(true);
        setError(null);
        setGeneratedPhases(null);

        try {
            // If user hasn't set an API key for the selected provider, we might rely on env for Gemini
            // For DeepSeek, it's mandatory.
            if (config.provider === 'deepseek' && !config.apiKey) {
                throw new Error("Please enter your DeepSeek API Key in Settings.");
            }

            const result = await generateProjectPlan(prompt, config, genOptions, teamMembers);
            if (result) {
                setGeneratedPhases(result);
                addToast("Plan generated successfully!", 'success');
            } else {
                setError("AI returned an empty response. Please try again.");
                addToast("AI Generation failed", 'error');
            }
        } catch (e: any) {
            setError(e.message || "Failed to generate plan.");
            addToast(e.message || "Failed to generate plan.", 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleApply = () => {
        if (generatedPhases) {
            onPlanGenerated(generatedPhases, targetProjectId);
            handleClose();
        }
    };

    const handleClose = () => {
        setPrompt('');
        setGeneratedPhases(null);
        setError(null);
        setShowSettings(false);
        // Keep some options sticky, reset simple ones
        setGenOptions(prev => ({ ...prev, duration: '', detailLevel: 'Standard', domain: 'General' }));
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden relative">

                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white flex justify-between items-start relative z-10">
                    <div>
                        <h2 className="text-2xl font-bold flex items-center gap-2">
                            <Sparkles className="text-yellow-300" fill="currentColor" />
                            {t('ai.title')}
                        </h2>
                        <p className="text-indigo-100 text-sm mt-1 opacity-90">
                            {showSettings ? t('ai.subtitle.settings') : t('ai.subtitle')}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowSettings(!showSettings)}
                            className={`p-2 rounded-full transition-colors ${showSettings ? 'bg-white text-indigo-600' : 'bg-white/10 hover:bg-white/20 text-white/80 hover:text-white'}`}
                            title={t('ai.settings')}
                        >
                            <Settings size={20} />
                        </button>
                        <button onClick={handleClose} className="text-white/70 hover:text-white p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto flex flex-col bg-gray-50/50">
                    {showSettings ? (
                        <div className="p-6 animate-in slide-in-from-right-4 duration-300 flex flex-col gap-6 max-w-xl mx-auto w-full mt-4">
                            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-5">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">{t('ai.provider')}</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={() => setConfig({ ...config, provider: 'gemini' })}
                                            className={`py-3 px-4 rounded-lg border text-sm font-bold flex items-center justify-center gap-2 transition-all ${config.provider === 'gemini' ? 'bg-indigo-50 border-indigo-500 text-indigo-700 ring-1 ring-indigo-500' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                                        >
                                            Google Gemini
                                        </button>
                                        <button
                                            onClick={() => setConfig({ ...config, provider: 'deepseek' })}
                                            className={`py-3 px-4 rounded-lg border text-sm font-bold flex items-center justify-center gap-2 transition-all ${config.provider === 'deepseek' ? 'bg-indigo-50 border-indigo-500 text-indigo-700 ring-1 ring-indigo-500' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                                        >
                                            DeepSeek (OpenAI)
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">{t('ai.api_key')}</label>
                                    <input
                                        type="password"
                                        placeholder={config.provider === 'gemini' ? "Default (Env) or Custom Key" : "sk-..."}
                                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                        value={config.apiKey}
                                        onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        {config.provider === 'gemini'
                                            ? "Leave empty to use the demo default key (if available)."
                                            : "Required for DeepSeek."}
                                    </p>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setShowSettings(false)}
                                    className="px-5 py-2.5 rounded-lg font-bold text-gray-600 hover:bg-gray-200 transition-colors"
                                >
                                    {t('ai.cancel')}
                                </button>
                                <button
                                    onClick={saveConfig}
                                    className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-indigo-700 shadow-lg flex items-center gap-2"
                                >
                                    <Save size={18} /> {t('ai.save_config')}
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* Main Generator UI */
                        !generatedPhases ? (
                            <div className="flex-1 flex flex-col p-6 md:p-8 animate-in slide-in-from-left-4 duration-300">
                                <div className="w-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-8 h-full">

                                    {/* Left Column: Prompt */}
                                    <div className="flex flex-col h-full">
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Project Prompt</label>
                                        <div className="relative flex-1 min-h-[200px]">
                                            <textarea
                                                className="w-full h-full border border-gray-300 rounded-xl p-5 text-lg focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all shadow-sm resize-none bg-white"
                                                placeholder={t('ai.placeholder')}
                                                value={prompt}
                                                onChange={(e) => setPrompt(e.target.value)}
                                                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !isLoading) { e.preventDefault(); handleGenerate(); } }}
                                            />
                                            {isLoading && (
                                                <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center rounded-xl backdrop-blur-[2px] z-10">
                                                    <Loader2 size={32} className="animate-spin text-indigo-600 mb-2" />
                                                    <span className="text-sm font-bold text-indigo-600 animate-pulse">
                                                        {t('ai.thinking')}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {error && (
                                            <div className="mt-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 flex items-center gap-2 animate-in slide-in-from-top-1">
                                                <X size={16} /> {error}
                                            </div>
                                        )}

                                        <div className="mt-6">
                                            <button
                                                onClick={handleGenerate}
                                                disabled={isLoading || !prompt.trim()}
                                                className="w-full bg-indigo-600 text-white text-lg font-bold py-4 px-6 rounded-xl shadow-xl shadow-indigo-500/20 hover:bg-indigo-700 hover:shadow-indigo-500/40 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                                            >
                                                {isLoading ? t('ai.btn.generating') : t('ai.btn.generate')}
                                                {!isLoading && <ArrowRight size={20} />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Right Column: Advanced Options */}
                                    <div className="flex flex-col gap-4">
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                                <Sliders size={16} /> Configuration
                                            </label>
                                        </div>

                                        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-5">

                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 mb-1.5 flex items-center gap-1.5">
                                                    <Layout size={12} /> {t('ai.structure_type')}
                                                </label>
                                                <div className="grid grid-cols-1 gap-2">
                                                    <button
                                                        onClick={() => setGenOptions({ ...genOptions, structure: 'full' })}
                                                        className={`text-left px-3 py-2 rounded-lg text-xs font-bold border transition-all ${genOptions.structure === 'full'
                                                            ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                                                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                                            }`}
                                                    >
                                                        {t('ai.structure.full')}
                                                    </button>
                                                    <button
                                                        onClick={() => setGenOptions({ ...genOptions, structure: 'single' })}
                                                        className={`text-left px-3 py-2 rounded-lg text-xs font-bold border transition-all ${genOptions.structure === 'single'
                                                            ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                                                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                                            }`}
                                                    >
                                                        {t('ai.structure.single')}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Auto Schedule Toggle */}
                                            <div className="flex items-center justify-between gap-2 py-1">
                                                <label htmlFor="autoSchedule" className="text-xs font-bold text-gray-500 flex items-center gap-1.5 cursor-pointer select-none">
                                                    <CalendarClock size={12} /> Auto-schedule dates
                                                </label>
                                                <div className="relative inline-block w-9 h-5 align-middle select-none">
                                                    <input
                                                        type="checkbox"
                                                        id="autoSchedule"
                                                        className="peer appearance-none h-5 w-9 bg-gray-200 rounded-full cursor-pointer checked:bg-indigo-600 transition-colors duration-200 focus:outline-none"
                                                        checked={genOptions.autoSchedule}
                                                        onChange={e => setGenOptions({ ...genOptions, autoSchedule: e.target.checked })}
                                                    />
                                                    <span className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full transition-transform duration-200 peer-checked:translate-x-4 pointer-events-none"></span>
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 mb-1.5 flex items-center gap-1.5">
                                                    <Clock size={12} /> Target Duration
                                                </label>
                                                <input
                                                    className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none transition-all focus:bg-white"
                                                    placeholder="e.g. 2 weeks, 3 months"
                                                    value={genOptions.duration}
                                                    onChange={e => setGenOptions({ ...genOptions, duration: e.target.value })}
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 mb-1.5 flex items-center gap-1.5">
                                                    <Layers size={12} /> Detail Level
                                                </label>
                                                <div className="grid grid-cols-3 gap-2">
                                                    {['Brief', 'Standard', 'Detailed'].map((level) => (
                                                        <button
                                                            key={level}
                                                            onClick={() => setGenOptions({ ...genOptions, detailLevel: level as any })}
                                                            className={`py-2 px-1 rounded-lg text-xs font-bold border transition-all ${genOptions.detailLevel === level
                                                                ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                                                                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                                                }`}
                                                        >
                                                            {level}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Target Project Selector (Replaced Project Domain) */}
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 mb-1.5 flex items-center gap-1.5">
                                                    <Folder size={12} /> {t('ai.target_project')}
                                                </label>
                                                <select
                                                    className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none transition-all focus:bg-white"
                                                    value={targetProjectId}
                                                    onChange={(e) => setTargetProjectId(e.target.value)}
                                                >
                                                    {projects.length === 0 && <option value="">No projects available</option>}
                                                    {projects.map(p => (
                                                        <option key={p.id} value={p.id}>{p.info.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 text-xs text-indigo-800 leading-relaxed">
                                            <p className="font-bold mb-1">Note:</p>
                                            {genOptions.autoSchedule
                                                ? "Auto-scheduling starts from today. Tasks will be assigned based on available team roles."
                                                : "Dates will be left empty for manual scheduling. Tasks will still be assigned to team roles."
                                            }
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="p-6 flex-1 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300">
                                <div className="flex items-center justify-between mb-4 shrink-0">
                                    <h3 className="text-lg font-bold text-gray-800">{t('ai.preview')}</h3>
                                    <button onClick={() => setGeneratedPhases(null)} className="text-sm text-gray-500 hover:text-indigo-600 underline">
                                        {t('ai.start_over')}
                                    </button>
                                </div>

                                <div className="flex-1 border border-gray-200 rounded-xl overflow-y-auto bg-white p-4 space-y-4 custom-scrollbar shadow-inner">
                                    {generatedPhases.map((phase, i) => (
                                        <div key={i} className="bg-white border border-gray-100 rounded-lg p-4 shadow-sm hover:border-indigo-100 transition-colors">
                                            <h4 className="font-bold text-indigo-700 mb-3 flex items-center gap-2">
                                                <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded font-mono">{t('ai.phase')} {i + 1}</span>
                                                {phase.name}
                                            </h4>
                                            <div className="space-y-2 pl-2 border-l-2 border-indigo-50">
                                                {phase.tasks.map((task, j) => (
                                                    <div key={j} className="text-sm grid grid-cols-1 sm:grid-cols-[1fr_120px_100px] gap-2 items-start py-1">
                                                        <div>
                                                            <div className="font-medium text-gray-800">{task.subTaskName}</div>
                                                            <div className="text-xs text-gray-500 truncate">{task.workContent}</div>
                                                        </div>
                                                        <div className="flex flex-col gap-1">
                                                            <div className="text-xs bg-gray-100 rounded px-2 py-1 text-center text-gray-600 border border-gray-200 truncate" title={task.owner}>
                                                                {task.owner}
                                                            </div>
                                                            <div className="text-[10px] text-gray-400 text-center">
                                                                {task.startDate}
                                                            </div>
                                                        </div>
                                                        <div className="text-xs font-mono text-right text-gray-500">
                                                            {task.duration} {t('table.days')}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-6 flex gap-3 shrink-0">
                                    <button
                                        onClick={() => setGeneratedPhases(null)}
                                        className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-bold hover:bg-gray-50 transition-colors"
                                    >
                                        {t('ai.cancel')}
                                    </button>
                                    <button
                                        onClick={handleApply}
                                        className="flex-[2] py-3 rounded-xl bg-emerald-500 text-white font-bold shadow-lg hover:bg-emerald-600 hover:shadow-emerald-500/30 transition-all flex items-center justify-center gap-2"
                                    >
                                        <CheckCircle size={20} />
                                        {t('ai.btn.import')}
                                    </button>
                                </div>
                            </div>
                        )
                    )}
                </div>
            </div>
        </div >
    );
};