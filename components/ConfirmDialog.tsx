
import React from 'react';
import { AlertTriangle, Info, X } from 'lucide-react';

export interface DialogOptions {
  title: string;
  message: string;
  type?: 'danger' | 'info';
  confirmText?: string;
  cancelText?: string;
  showCancel?: boolean; // Default true
  onConfirm: () => void;
  onCancel?: () => void;
}

interface ConfirmDialogProps {
  isOpen: boolean;
  options: DialogOptions | null;
  onClose: () => void;
}

import { useLanguage } from '../contexts/LanguageContext';

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ isOpen, options, onClose }) => {
  const { t } = useLanguage();

  if (!isOpen || !options) return null;

  const isDanger = options.type === 'danger';
  const showCancel = options.showCancel !== false;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden scale-100 animate-in zoom-in-95 duration-200 border border-gray-100">
        <div className="p-6 flex flex-col items-center text-center">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${isDanger ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
            {isDanger ? <AlertTriangle size={24} /> : <Info size={24} />}
          </div>

          <h3 className="text-lg font-bold text-gray-900 mb-2">
            {options.title}
          </h3>

          <p className="text-sm text-gray-500 leading-relaxed mb-6">
            {options.message}
          </p>

          <div className="flex gap-3 w-full">
            {showCancel && (
              <button
                onClick={() => {
                  if (options.onCancel) options.onCancel();
                  onClose();
                }}
                className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-sm transition-colors"
              >
                {options.cancelText || t('common.cancel')}
              </button>
            )}
            <button
              onClick={() => {
                options.onConfirm();
                onClose();
              }}
              className={`flex-1 px-4 py-2.5 text-white rounded-xl font-bold text-sm shadow-lg transition-all transform active:scale-95 ${isDanger
                ? 'bg-red-500 hover:bg-red-600 shadow-red-500/30'
                : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/30'
                }`}
            >
              {options.confirmText || t('common.confirm')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
