
import React, { useState, useEffect, useRef } from 'react';
import { X, User, Globe, Database, Save, LogOut, Cpu, Key, Download, Upload, Info, CheckCircle2, AlertTriangle, FileJson, Keyboard, Zap, LayoutTemplate, Bell, Cloud } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import { useDialog } from '../contexts/DialogContext';
import { testAIConfiguration } from '../services/geminiService';
import { db } from '../services/db';
import { getSupabaseConfig, saveSupabaseConfig } from '../services/supabase';
import { syncService } from '../services/sync';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentUser: { name: string; role: string; avatar: string };
    onUpdateUser: (name: string, role: string) => void;
}

type SettingsTab = 'general' | 'ai' | 'database' | 'data' | 'shortcuts' | 'about';

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, currentUser, onUpdateUser }) => {
    const { t, language, setLanguage } = useLanguage();
    const { addToast } = useToast();
    const { ask } = useDialog();

    const [activeTab, setActiveTab] = useState<SettingsTab>('general');

    // Profile State
    const [name, setName] = useState(currentUser.name);
    const [role, setRole] = useState(currentUser.role);

    // Appearance State
    const [density, setDensity] = useState('standard'); // compact, standard, comfortable

    // AI Config State
    const [aiProvider, setAiProvider] = useState<'gemini' | 'deepseek'>('gemini');
    const [apiKey, setApiKey] = useState('');
    const [aiBaseUrl, setAiBaseUrl] = useState('');
    const [aiModel, setAiModel] = useState('');
    const [isTestingAI, setIsTestingAI] = useState(false);

    // Database Config State
    const [supabaseUrl, setSupabaseUrl] = useState('');
    const [supabaseKey, setSupabaseKey] = useState('');
    const [isSyncing, setIsSyncing] = useState(false);

    // File Input Ref
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setName(currentUser.name);
            setRole(currentUser.role);

            // Load Preferences
            const storedDensity = localStorage.getItem('gen_pm_density');
            if (storedDensity) setDensity(storedDensity);

            // Load AI Config
            const savedConfig = localStorage.getItem('project_ai_config');
            if (savedConfig) {
                const config = JSON.parse(savedConfig);
                setAiProvider(config.provider || 'gemini');
                setApiKey(config.apiKey || '');
                setAiBaseUrl(config.baseUrl || '');
                setAiModel(config.model || '');
            }

            // Load Supabase Config
            const { url, key } = getSupabaseConfig();
            setSupabaseUrl(url);
            setSupabaseKey(key);
        }
    }, [isOpen, currentUser]);

    if (!isOpen) return null;

    // --- Handlers ---

    const handleSaveProfile = () => {
        onUpdateUser(name, role);
        localStorage.setItem('gen_pm_density', density);
        addToast(t('settings.pref_updated'), 'success');
        onClose();
    };

    const handleSaveAI = () => {
        const config = {
            provider: aiProvider,
            apiKey,
            baseUrl: aiBaseUrl,
            model: aiModel
        };
        localStorage.setItem('project_ai_config', JSON.stringify(config));
        addToast(t('settings.ai_saved'), 'success');
    };

    const handleTestConnection = async () => {
        setIsTestingAI(true);
        const config = { provider: aiProvider, apiKey, baseUrl: aiBaseUrl, model: aiModel };
        const result = await testAIConfiguration(config);
        setIsTestingAI(false);

        if (result.success) {
            addToast(result.message, 'success');
        } else {
            addToast(result.message, 'error');
        }
    };

    const handleResetData = () => {
        ask({
            title: t('settings.reset_title'),
            message: t('settings.reset_desc'),
            type: 'danger',
            confirmText: t('settings.reset_confirm'),
            onConfirm: async () => {
                await db.clearAll();
                localStorage.clear();
                window.location.reload();
            }
        });
    };

    const handleExportData = async () => {
        try {
            const data = await db.exportData();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const filename = `gen_pm_backup_${new Date().toISOString().slice(0, 10)}.json`.replace(/[\\/:*?"<>|]/g, '_');
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            // Delay URL revocation to ensure download starts
            setTimeout(() => URL.revokeObjectURL(url), 100);
            addToast(t('settings.export_success'), 'success');
        } catch (e) {
            addToast(t('settings.export_fail'), 'error');
        }
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);

                ask({
                    title: t('settings.import_title'),
                    message: t('settings.import_desc'),
                    type: 'danger',
                    confirmText: t('settings.import_confirm'),
                    onConfirm: async () => {
                        await db.importData(json);
                        window.location.reload();
                    }
                });

            } catch (err) {
                addToast(t('settings.invalid_backup'), 'error');
            }
        };
        reader.readAsText(file);
        // Reset input
        e.target.value = '';
    };

    const handleSaveDatabase = () => {
        saveSupabaseConfig(supabaseUrl, supabaseKey);
        addToast(t('settings.db_saved_reloading'), 'success');
        setTimeout(() => {
            window.location.reload();
        }, 1000);
    };

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            await syncService.sync();
            addToast(t('settings.sync_success'), 'success');
            window.location.reload(); // Reload to show new data
        } catch (e) {
            console.error(e);
            addToast(t('settings.sync_fail'), 'error');
        } finally {
            setIsSyncing(false);
        }
    };

    // --- Render Components ---

    const TabButton = ({ id, label, icon: Icon }: { id: SettingsTab, label: string, icon: any }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-bold rounded-lg transition-all w-full text-left mb-1 ${activeTab === id
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                }`}
        >
            <Icon size={16} />
            {label}
        </button>
    );

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col md:flex-row h-[650px] max-h-[90vh]">

                {/* Sidebar */}
                <div className="w-full md:w-64 bg-gray-50 border-r border-gray-100 p-4 shrink-0 flex flex-col">
                    <div className="mb-6 px-2">
                        <h2 className="text-lg font-extrabold text-gray-800">{t('ai.settings')}</h2>
                        <p className="text-[10px] font-bold text-gray-400 uppercase">{t('settings.workspace')}</p>
                    </div>
                    <nav className="space-y-1 flex-1">
                        <TabButton id="general" label={t('settings.profile')} icon={User} />
                        <TabButton id="ai" label={t('settings.ai_config')} icon={Cpu} />
                        <TabButton id="database" label="Database" icon={Cloud} />
                        <TabButton id="data" label={t('settings.data')} icon={Database} />
                        <TabButton id="shortcuts" label={t('settings.shortcuts')} icon={Keyboard} />
                        <TabButton id="about" label={t('settings.about')} icon={Info} />
                    </nav>
                    <div className="mt-auto pt-4 border-t border-gray-200 text-[10px] text-gray-400 text-center">
                        {t('settings.version')}
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 flex flex-col min-w-0 bg-white relative">
                    <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors z-10">
                        <X size={20} />
                    </button>

                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">

                        {/* --- GENERAL TAB --- */}
                        {activeTab === 'general' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <section>
                                    <h3 className="text-sm font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100 flex items-center gap-2">
                                        <User size={16} className="text-indigo-500" />
                                        {t('settings.profile')}
                                    </h3>
                                    <div className="flex gap-5 items-start">
                                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-2xl shadow-md shrink-0">
                                            {name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex-1 space-y-4">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 mb-1">{t('settings.display_name')}</label>
                                                    <input
                                                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-gray-50 focus:bg-white"
                                                        value={name}
                                                        onChange={(e) => setName(e.target.value)}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 mb-1">{t('settings.role_title')}</label>
                                                    <input
                                                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-gray-50 focus:bg-white"
                                                        value={role}
                                                        onChange={(e) => setRole(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                <section>
                                    <h3 className="text-sm font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100 flex items-center gap-2">
                                        <LayoutTemplate size={16} className="text-pink-500" />
                                        {t('settings.appearance')}
                                    </h3>
                                    <div className="grid grid-cols-3 gap-3 mb-4">
                                        {['compact', 'standard', 'comfortable'].map((d) => (
                                            <button
                                                key={d}
                                                onClick={() => setDensity(d)}
                                                className={`px-3 py-2 rounded-lg border text-xs font-bold capitalize transition-all ${density === d ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                                            >
                                                {t(`settings.appearance_${d}` as any)}
                                            </button>
                                        ))}
                                    </div>
                                </section>

                                <section>
                                    <h3 className="text-sm font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100 flex items-center gap-2">
                                        <Globe size={16} className="text-emerald-500" />
                                        {t('settings.language')}
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4 mb-6">
                                        <button
                                            onClick={() => setLanguage('en')}
                                            className={`relative py-3 px-4 rounded-xl text-sm font-bold border transition-all text-left flex items-center justify-between ${language === 'en' ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                                        >
                                            <span>English</span>
                                            {language === 'en' && <CheckCircle2 size={16} />}
                                        </button>
                                        <button
                                            onClick={() => setLanguage('zh')}
                                            className={`relative py-3 px-4 rounded-xl text-sm font-bold border transition-all text-left flex items-center justify-between ${language === 'zh' ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                                        >
                                            <span>中文 (Chinese)</span>
                                            {language === 'zh' && <CheckCircle2 size={16} />}
                                        </button>
                                    </div>

                                    <button
                                        onClick={handleSaveProfile}
                                        className="w-full text-xs font-bold bg-indigo-600 text-white px-4 py-2.5 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm flex items-center justify-center gap-2"
                                    >
                                        <Save size={14} /> {t('settings.save')}
                                    </button>
                                </section>
                            </div>
                        )}

                        {/* --- AI TAB --- */}
                        {activeTab === 'ai' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 text-sm text-indigo-800 leading-relaxed flex gap-3">
                                    <Info size={20} className="shrink-0 mt-0.5 text-indigo-600" />
                                    <div>
                                        {t('settings.ai_desc')}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">{t('ai.provider')}</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={() => setAiProvider('gemini')}
                                            className={`py-3 px-4 rounded-lg border text-sm font-bold flex items-center justify-center gap-2 transition-all ${aiProvider === 'gemini' ? 'bg-indigo-50 border-indigo-500 text-indigo-700 ring-1 ring-indigo-500' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                                        >
                                            Google Gemini
                                        </button>
                                        <button
                                            onClick={() => setAiProvider('deepseek')}
                                            className={`py-3 px-4 rounded-lg border text-sm font-bold flex items-center justify-center gap-2 transition-all ${aiProvider === 'deepseek' ? 'bg-indigo-50 border-indigo-500 text-indigo-700 ring-1 ring-indigo-500' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                                        >
                                            DeepSeek / OpenAI
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider flex items-center gap-1">
                                        <Key size={12} /> {t('ai.api_key')}
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="password"
                                            placeholder="sk-..."
                                            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono"
                                            value={apiKey}
                                            onChange={(e) => setApiKey(e.target.value)}
                                        />
                                        <button
                                            onClick={handleTestConnection}
                                            disabled={isTestingAI || !apiKey}
                                            className="px-4 py-2 bg-white border border-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-50 disabled:opacity-50 text-xs flex items-center gap-2 min-w-[100px] justify-center"
                                        >
                                            {isTestingAI ? <Zap size={14} className="animate-pulse text-amber-500" /> : <Zap size={14} />}
                                            {isTestingAI ? 'Testing' : 'Test'}
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-gray-400 mt-1">
                                        {aiProvider === 'gemini'
                                            ? (language === 'en' ? 'Optional if using environment variables.' : '如果使用环境变量则可选。')
                                            : (language === 'en' ? 'Required for DeepSeek.' : 'DeepSeek 必填。')}
                                    </p>
                                </div>

                                {aiProvider === 'deepseek' && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-gray-50">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">{t('ai.base_url')}</label>
                                            <input
                                                type="text"
                                                placeholder="https://api.deepseek.com"
                                                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-gray-600"
                                                value={aiBaseUrl}
                                                onChange={(e) => setAiBaseUrl(e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">{t('ai.model')}</label>
                                            <input
                                                type="text"
                                                placeholder="deepseek-chat"
                                                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-gray-600"
                                                value={aiModel}
                                                onChange={(e) => setAiModel(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className="pt-4 border-t border-gray-100">
                                    <button
                                        onClick={handleSaveAI}
                                        className="w-full bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-sm flex items-center justify-center gap-2"
                                    >
                                        <Save size={16} /> {t('ai.save_config')}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* --- DATABASE TAB --- */}
                        {activeTab === 'database' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 text-sm text-indigo-800 leading-relaxed flex gap-3">
                                    <Cloud size={20} className="shrink-0 mt-0.5 text-indigo-600" />
                                    <div>
                                        {t('settings.db_configure_desc')}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">{t('settings.db_url')}</label>
                                    <input
                                        type="text"
                                        placeholder="https://your-project.supabase.co"
                                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-gray-600"
                                        value={supabaseUrl}
                                        onChange={(e) => setSupabaseUrl(e.target.value)}
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">{t('settings.db_key')}</label>
                                    <input
                                        type="password"
                                        placeholder="your-anon-key"
                                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-gray-600"
                                        value={supabaseKey}
                                        onChange={(e) => setSupabaseKey(e.target.value)}
                                    />
                                </div>

                                <div className="pt-4 border-t border-gray-100 flex gap-3">
                                    <button
                                        onClick={handleSaveDatabase}
                                        className="flex-1 bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-sm flex items-center justify-center gap-2"
                                    >
                                        <Save size={16} /> {t('settings.db_save')}
                                    </button>
                                </div>

                                <div className="pt-4 border-t border-gray-100">
                                    <h3 className="text-sm font-bold text-gray-900 mb-4">{t('settings.sync_actions')}</h3>
                                    <div className="grid grid-cols-1 gap-3">
                                        <button
                                            onClick={handleSync}
                                            disabled={isSyncing || !supabaseUrl || !supabaseKey}
                                            className="px-4 py-3 bg-white border border-gray-200 text-indigo-600 font-bold rounded-xl hover:bg-indigo-50 disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
                                        >
                                            <Upload size={16} /> {t('settings.sync_btn')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* --- DATA TAB --- */}
                        {activeTab === 'data' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <section>
                                    <h3 className="text-sm font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100 flex items-center gap-2">
                                        <FileJson size={16} className="text-amber-500" />
                                        {t('settings.backup')}
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <button
                                            onClick={handleExportData}
                                            className="flex flex-col items-center justify-center gap-2 p-4 border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-indigo-300 transition-all group"
                                        >
                                            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full group-hover:scale-110 transition-transform">
                                                <Download size={24} />
                                            </div>
                                            <span className="text-sm font-bold text-gray-700">{t('settings.export')}</span>
                                            <span className="text-[10px] text-gray-400">{t('settings.export_json_format')}</span>
                                        </button>

                                        <button
                                            onClick={handleImportClick}
                                            className="flex flex-col items-center justify-center gap-2 p-4 border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-indigo-300 transition-all group"
                                        >
                                            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-full group-hover:scale-110 transition-transform">
                                                <Upload size={24} />
                                            </div>
                                            <span className="text-sm font-bold text-gray-700">{t('settings.import')}</span>
                                            <span className="text-[10px] text-gray-400">{t('settings.import_json_file')}</span>
                                        </button>
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            className="hidden"
                                            accept=".json"
                                            onChange={handleFileChange}
                                        />
                                    </div>
                                </section>

                                <section className="pt-4 border-t border-gray-100">
                                    <div className="bg-red-50 border border-red-100 rounded-xl p-5">
                                        <h4 className="text-sm font-bold text-red-700 mb-2 flex items-center gap-2">
                                            <AlertTriangle size={16} /> {t('settings.danger')}
                                        </h4>
                                        <p className="text-xs text-red-600 mb-4 opacity-80 leading-relaxed">
                                            {t('settings.reset_desc')}
                                        </p>
                                        <button
                                            onClick={handleResetData}
                                            className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-white bg-red-500 rounded-lg hover:bg-red-600 shadow-sm transition-colors"
                                        >
                                            <LogOut size={16} /> {t('settings.reset_btn')}
                                        </button>
                                    </div>
                                </section>
                            </div>
                        )}

                        {/* --- SHORTCUTS TAB --- */}
                        {activeTab === 'shortcuts' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <h3 className="text-sm font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100 flex items-center gap-2">
                                    <Keyboard size={16} className="text-gray-600" />
                                    {t('settings.shortcuts')}
                                </h3>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {[
                                        { key: 'Ctrl + S', desc: language === 'en' ? 'Save Changes (Editors)' : '保存更改 (编辑器)' },
                                        { key: 'Enter', desc: language === 'en' ? 'Send Message / Add Item' : '发送消息 / 添加项目' },
                                        { key: '/', desc: language === 'en' ? 'Wiki Command Menu' : '知识库命令菜单' },
                                        { key: 'Esc', desc: language === 'en' ? 'Close Modals' : '关闭弹窗' },
                                        { key: 'Double Click', desc: language === 'en' ? 'Edit Task / Open Link' : '编辑任务 / 打开链接' },
                                    ].map((sc, i) => (
                                        <div key={i} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-100">
                                            <span className="text-sm text-gray-600 font-medium">{sc.desc}</span>
                                            <kbd className="px-2 py-1 bg-white border border-gray-200 rounded-md text-xs font-bold text-gray-500 font-mono shadow-sm">
                                                {sc.key}
                                            </kbd>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* --- ABOUT TAB --- */}
                        {activeTab === 'about' && (
                            <div className="flex flex-col items-center justify-center h-full animate-in fade-in slide-in-from-bottom-2 duration-300 text-center">
                                <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-6 shadow-sm rotate-3">
                                    <Cpu size={40} />
                                </div>
                                <h3 className="text-xl font-extrabold text-gray-900 mb-2">Gen-Project Manager</h3>
                                <p className="text-sm text-gray-500 max-w-xs mb-8 leading-relaxed">
                                    {t('settings.app_desc')}
                                </p>

                                <div className="grid grid-cols-2 gap-x-12 gap-y-4 text-left text-xs text-gray-600 border-t border-gray-100 pt-6">
                                    <div>
                                        <span className="block font-bold text-gray-400 uppercase text-[10px]">{t('settings.meta_version')}</span>
                                        {t('settings.version')}
                                    </div>
                                    <div>
                                        <span className="block font-bold text-gray-400 uppercase text-[10px]">{t('settings.meta_license')}</span>
                                        MIT
                                    </div>
                                    <div>
                                        <span className="block font-bold text-gray-400 uppercase text-[10px]">{t('settings.meta_stack')}</span>
                                        React + Tailwind
                                    </div>
                                    <div>
                                        <span className="block font-bold text-gray-400 uppercase text-[10px]">{t('settings.meta_ai_model')}</span>
                                        Gemini 2.5 Flash
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
