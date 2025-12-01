
import React, { useState } from 'react';
import { Project, ProjectRisk, RiskLevel } from '../types';
import { AlertTriangle, ShieldAlert, Plus, Bot, Loader2, Trash2, CheckSquare } from 'lucide-react';
import { generateRisks } from '../services/geminiService';
import { useToast } from '../contexts/ToastContext';
import { useLanguage } from '../contexts/LanguageContext';

interface RiskRegisterProps {
    project: Project;
    onUpdate: (project: Project) => void;
}

export const RiskRegister: React.FC<RiskRegisterProps> = ({ project, onUpdate }) => {
    const { addToast } = useToast();
    const { t } = useLanguage();
    const [isGenerating, setIsGenerating] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [newRisk, setNewRisk] = useState<Partial<ProjectRisk>>({ probability: 'Medium', impact: 'Medium', status: 'Open' });

    const risks = project.risks || [];

    const handleGenerateRisks = async () => {
        setIsGenerating(true);
        try {
            const savedConfig = localStorage.getItem('project_ai_config');
            const config = savedConfig ? JSON.parse(savedConfig) : undefined;
            const aiRisks = await generateRisks(project, config);
            onUpdate({ ...project, risks: [...risks, ...aiRisks] });
            addToast(`${aiRisks.length} ${t('risk.ai_success')}`, 'success');
        } catch (e) {
            addToast(t('risk.ai_fail'), 'error');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleAddManual = () => {
        if (!newRisk.description) return;

        // Calc Level
        let level: RiskLevel = 'Low';
        if (newRisk.impact === 'High' && newRisk.probability === 'High') level = 'Critical';
        else if (newRisk.impact === 'High' || newRisk.probability === 'High') level = 'High';
        else if (newRisk.impact === 'Medium' && newRisk.probability === 'Medium') level = 'Medium';

        const risk: ProjectRisk = {
            id: `risk-${Date.now()}`,
            description: newRisk.description,
            probability: newRisk.probability as any,
            impact: newRisk.impact as any,
            mitigationPlan: newRisk.mitigationPlan || '',
            status: 'Open',
            level
        };
        onUpdate({ ...project, risks: [...risks, risk] });
        setNewRisk({ probability: 'Medium', impact: 'Medium', status: 'Open', description: '', mitigationPlan: '' });
        setIsAdding(false);
    };

    const handleUpdateRisk = (id: string, updates: Partial<ProjectRisk>) => {
        onUpdate({ ...project, risks: risks.map(r => r.id === id ? { ...r, ...updates } : r) });
    };

    const handleDelete = (id: string) => {
        onUpdate({ ...project, risks: risks.filter(r => r.id !== id) });
    };

    const getLevelColor = (level: RiskLevel) => {
        switch (level) {
            case 'Critical': return 'bg-red-100 text-red-800 border-red-200';
            case 'High': return 'bg-orange-100 text-orange-800 border-orange-200';
            case 'Medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            default: return 'bg-blue-100 text-blue-800 border-blue-200';
        }
    };

    return (
        <div className="h-full flex flex-col p-8 bg-gray-50/50 overflow-y-auto custom-scrollbar">
            <div className="max-w-6xl mx-auto w-full">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                    <div>
                        <h2 className="text-2xl font-extrabold text-gray-900 flex items-center gap-3">
                            <ShieldAlert className="text-rose-600" /> {t('risk.register')}
                        </h2>
                        <p className="text-gray-500 mt-1">{t('risk.subtitle')}</p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={handleGenerateRisks}
                            disabled={isGenerating}
                            className="flex items-center gap-2 bg-white border border-indigo-200 text-indigo-600 px-4 py-2.5 rounded-xl font-bold shadow-sm hover:bg-indigo-50 transition-all disabled:opacity-50"
                        >
                            {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Bot size={18} />}
                            {t('risk.ai_detect')}
                        </button>
                        <button
                            onClick={() => setIsAdding(!isAdding)}
                            className="flex items-center gap-2 bg-rose-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg hover:bg-rose-700 transition-all"
                        >
                            <Plus size={18} /> {t('risk.add')}
                        </button>
                    </div>
                </div>

                {isAdding && (
                    <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200 mb-6 animate-in slide-in-from-top-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">{t('fin.desc')}</label>
                                <input className="w-full border p-2 rounded" value={newRisk.description} onChange={e => setNewRisk({ ...newRisk, description: e.target.value })} placeholder={t('risk.desc_placeholder')} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">{t('risk.mitigation')}</label>
                                <input className="w-full border p-2 rounded" value={newRisk.mitigationPlan} onChange={e => setNewRisk({ ...newRisk, mitigationPlan: e.target.value })} placeholder={t('risk.mitigation_placeholder')} />
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4 mb-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">{t('risk.probability')}</label>
                                <select className="w-full border p-2 rounded" value={newRisk.probability} onChange={e => setNewRisk({ ...newRisk, probability: e.target.value as any })}>
                                    <option>Low</option><option>Medium</option><option>High</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">{t('risk.impact')}</label>
                                <select className="w-full border p-2 rounded" value={newRisk.impact} onChange={e => setNewRisk({ ...newRisk, impact: e.target.value as any })}>
                                    <option>Low</option><option>Medium</option><option>High</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setIsAdding(false)} className="px-4 py-2 text-gray-500 font-bold">{t('common.cancel')}</button>
                            <button onClick={handleAddManual} className="px-6 py-2 bg-rose-600 text-white rounded font-bold">{t('risk.save')}</button>
                        </div>
                    </div>
                )}

                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="p-4 font-bold text-gray-600">{t('risk.issue')}</th>
                                <th className="p-4 font-bold text-gray-600">{t('risk.level')}</th>
                                <th className="p-4 font-bold text-gray-600">{t('risk.mitigation')}</th>
                                <th className="p-4 font-bold text-gray-600">{t('table.status')}</th>
                                <th className="p-4 font-bold text-gray-600 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {risks.length === 0 ? (
                                <tr><td colSpan={5} className="p-8 text-center text-gray-400 italic">{t('risk.no_risks')}</td></tr>
                            ) : (
                                risks.map(risk => (
                                    <tr key={risk.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="p-4">
                                            <div className="font-bold text-gray-800">{risk.description}</div>
                                            <div className="text-xs text-gray-400 mt-1">{t('risk.prob_short')}: {risk.probability} • {t('risk.impact_short')}: {risk.impact}</div>
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold border ${getLevelColor(risk.level)}`}>
                                                {risk.level}
                                            </span>
                                        </td>
                                        <td className="p-4 text-gray-600 max-w-xs truncate" title={risk.mitigationPlan}>{risk.mitigationPlan}</td>
                                        <td className="p-4">
                                            <button
                                                onClick={() => handleUpdateRisk(risk.id, { status: risk.status === 'Open' ? 'Mitigated' : 'Open' })}
                                                className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-bold border ${risk.status === 'Open' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}
                                            >
                                                {risk.status === 'Mitigated' && <CheckSquare size={12} />}
                                                {risk.status}
                                            </button>
                                        </td>
                                        <td className="p-4">
                                            <button onClick={() => handleDelete(risk.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
