
import React, { useState, useMemo, useEffect } from 'react';
import { Project, ProjectExpense } from '../types';
import { DollarSign, Plus, Trash2, PieChart, TrendingDown, Wallet, ArrowUpRight, Tags, X } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { useLanguage } from '../contexts/LanguageContext';

interface FinanceManagerProps {
    project: Project;
    onUpdate: (project: Project) => void;
}

export const FinanceManager: React.FC<FinanceManagerProps> = ({ project, onUpdate }) => {
    const { addToast } = useToast();
    const { t } = useLanguage();
    const [isAdding, setIsAdding] = useState(false);
    const [isManagingCats, setIsManagingCats] = useState(false);
    const [newCatName, setNewCatName] = useState('');

    const defaultCategories = ['Labor', 'Software', 'Hardware', 'Marketing', 'Other'];
    const categories = project.info.expenseCategories || defaultCategories;

    const [newExpense, setNewExpense] = useState<Partial<ProjectExpense>>({ category: categories[0], date: new Date().toISOString().split('T')[0] });
    const [budgetInput, setBudgetInput] = useState(project.info.budgetTotal?.toString() || '');

    const expenses = project.expenses || [];
    const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
    const budget = project.info.budgetTotal || 0;
    const remaining = budget - totalSpent;
    const burnRate = budget > 0 ? Math.round((totalSpent / budget) * 100) : 0;

    // Ensure default category is valid when categories change
    useEffect(() => {
        if (newExpense.category && !categories.includes(newExpense.category)) {
            setNewExpense(prev => ({ ...prev, category: categories[0] }));
        }
    }, [categories, newExpense.category]);

    const handleUpdateBudget = () => {
        const val = parseFloat(budgetInput);
        if (!isNaN(val)) {
            onUpdate({ ...project, info: { ...project.info, budgetTotal: val } });
            addToast(t('fin.budget_updated'), 'success');
        }
    };

    const handleAddExpense = () => {
        if (!newExpense.title || !newExpense.amount) return;
        const expense: ProjectExpense = {
            id: `exp-${Date.now()}`,
            title: newExpense.title,
            amount: Number(newExpense.amount),
            category: newExpense.category || categories[0],
            date: newExpense.date || new Date().toISOString(),
            notes: newExpense.notes
        };
        onUpdate({ ...project, expenses: [...expenses, expense] });
        setNewExpense({ category: categories[0], date: new Date().toISOString().split('T')[0], title: '', amount: 0, notes: '' });
        setIsAdding(false);
        addToast(t('fin.expense_logged'), 'success');
    };

    const handleDeleteExpense = (id: string) => {
        onUpdate({ ...project, expenses: expenses.filter(e => e.id !== id) });
    };

    const handleAddCategory = () => {
        if (!newCatName.trim()) return;
        if (categories.includes(newCatName.trim())) {
            addToast(t('fin.cat_exists'), 'error');
            return;
        }
        const updatedCats = [...categories, newCatName.trim()];
        onUpdate({
            ...project,
            info: { ...project.info, expenseCategories: updatedCats }
        });
        setNewCatName('');
        addToast(t('fin.cat_added'), 'success');
    };

    const handleDeleteCategory = (cat: string) => {
        const updatedCats = categories.filter(c => c !== cat);
        onUpdate({
            ...project,
            info: { ...project.info, expenseCategories: updatedCats }
        });
        addToast(t('fin.cat_removed'), 'info');
    };

    return (
        <div className="h-full flex flex-col p-8 bg-gray-50/50 overflow-y-auto custom-scrollbar">
            <div className="max-w-5xl mx-auto w-full">
                <h2 className="text-2xl font-extrabold text-gray-900 mb-6 flex items-center gap-3">
                    <DollarSign className="text-emerald-600" /> {t('fin.budget')}
                </h2>

                {/* Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                        <div className="text-gray-500 text-xs font-bold uppercase mb-2 flex items-center gap-2"><Wallet size={14} /> {t('fin.total_budget')}</div>
                        <div className="flex items-center gap-2">
                            <span className="text-2xl font-bold text-gray-900">$</span>
                            <input
                                className="text-3xl font-extrabold text-gray-900 bg-transparent border-b border-dashed border-gray-300 outline-none w-full focus:border-emerald-500 transition-all"
                                value={budgetInput}
                                onChange={(e) => setBudgetInput(e.target.value)}
                                onBlur={handleUpdateBudget}
                                placeholder="0.00"
                            />
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                        <div className="text-gray-500 text-xs font-bold uppercase mb-2 flex items-center gap-2"><ArrowUpRight size={14} /> {t('fin.total_spent')}</div>
                        <div className="text-3xl font-extrabold text-rose-600">${totalSpent.toLocaleString()}</div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                        <div className="text-gray-500 text-xs font-bold uppercase mb-2 flex items-center gap-2"><PieChart size={14} /> {t('fin.remaining')}</div>
                        <div className={`text-3xl font-extrabold ${remaining < 0 ? 'text-red-600' : 'text-emerald-600'}`}>${remaining.toLocaleString()}</div>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-8">
                    <div className="flex justify-between text-sm font-bold mb-2">
                        <span>{t('fin.burn')}</span>
                        <span className={burnRate > 100 ? 'text-red-600' : 'text-gray-600'}>{burnRate}% {t('fin.used')}</span>
                    </div>
                    <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all ${burnRate > 100 ? 'bg-red-500' : burnRate > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                            style={{ width: `${Math.min(100, burnRate)}%` }}
                        ></div>
                    </div>
                </div>

                {/* Expense List */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                        <h3 className="font-bold text-gray-800">{t('fin.log')}</h3>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setIsManagingCats(!isManagingCats)}
                                className={`p-2 rounded-lg transition-colors border border-transparent ${isManagingCats ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
                                title={t('fin.manage_cats')}
                            >
                                <Tags size={16} />
                            </button>
                            <button
                                onClick={() => setIsAdding(!isAdding)}
                                className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-emerald-700 transition-colors"
                            >
                                <Plus size={16} /> {t('fin.log_btn')}
                            </button>
                        </div>
                    </div>

                    {isManagingCats && (
                        <div className="p-4 bg-gray-50 border-b border-gray-200 animate-in slide-in-from-top-2">
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="text-xs font-bold text-gray-500 uppercase">{t('fin.manage_cats')}</h4>
                                <button onClick={() => setIsManagingCats(false)}><X size={14} className="text-gray-400 hover:text-gray-600" /></button>
                            </div>

                            <div className="flex flex-wrap gap-2 mb-3">
                                {categories.map(cat => (
                                    <div key={cat} className="flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 rounded-md text-xs font-medium text-gray-700 shadow-sm">
                                        {cat}
                                        <button onClick={() => handleDeleteCategory(cat)} className="text-gray-400 hover:text-red-500 p-0.5 rounded hover:bg-red-50 transition-colors">
                                            <X size={10} />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <div className="flex gap-2 max-w-sm">
                                <input
                                    className="flex-1 text-xs border border-gray-300 rounded px-2 py-1.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
                                    placeholder={t('fin.new_cat_placeholder')}
                                    value={newCatName}
                                    onChange={e => setNewCatName(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
                                />
                                <button onClick={handleAddCategory} className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded font-bold hover:bg-indigo-700 transition-colors shadow-sm">{t('common.add')}</button>
                            </div>
                        </div>
                    )}

                    {isAdding && (
                        <div className="p-4 bg-emerald-50 border-b border-emerald-100 grid grid-cols-1 sm:grid-cols-5 gap-4 animate-in slide-in-from-top-2">
                            <input className="sm:col-span-2 p-2 rounded border border-emerald-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder={t('fin.desc')} value={newExpense.title} onChange={e => setNewExpense({ ...newExpense, title: e.target.value })} autoFocus />
                            <input className="p-2 rounded border border-emerald-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" type="number" placeholder={t('fin.amount')} value={newExpense.amount || ''} onChange={e => setNewExpense({ ...newExpense, amount: Number(e.target.value) })} />
                            <select className="p-2 rounded border border-emerald-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" value={newExpense.category} onChange={e => setNewExpense({ ...newExpense, category: e.target.value })}>
                                {categories.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <button onClick={handleAddExpense} className="bg-emerald-600 text-white rounded font-bold text-sm hover:bg-emerald-700 transition-colors shadow-sm">{t('common.add')}</button>
                        </div>
                    )}

                    <div className="divide-y divide-gray-100">
                        {expenses.length === 0 ? (
                            <div className="p-8 text-center text-gray-400 text-sm italic">{t('fin.no_expenses')}</div>
                        ) : (
                            expenses.slice().reverse().map(exp => (
                                <div key={exp.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors group">
                                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <div>
                                            <div className="font-bold text-gray-800">{exp.title}</div>
                                            <div className="text-xs text-gray-400">{new Date(exp.date).toLocaleDateString()}</div>
                                        </div>
                                        <div className="flex items-center">
                                            <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-bold uppercase">{exp.category}</span>
                                        </div>
                                        <div className="flex items-center font-mono font-bold text-gray-800">
                                            ${exp.amount.toLocaleString()}
                                        </div>
                                    </div>
                                    <button onClick={() => handleDeleteExpense(exp.id)} className="text-gray-300 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-all rounded hover:bg-red-50">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
