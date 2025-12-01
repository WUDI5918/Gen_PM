
import React from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
  id: string;
  message: string;
  type: ToastType;
  onRemove: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ id, message, type, onRemove }) => {
  const styles = {
    success: 'bg-white border-emerald-500 text-emerald-700',
    error: 'bg-white border-red-500 text-red-700',
    info: 'bg-white border-blue-500 text-blue-700',
    warning: 'bg-white border-amber-500 text-amber-700',
  };

  const icons = {
    success: <CheckCircle size={20} className="text-emerald-500" />,
    error: <AlertCircle size={20} className="text-red-500" />,
    info: <Info size={20} className="text-blue-500" />,
    warning: <AlertTriangle size={20} className="text-amber-500" />,
  };

  return (
    <div className={`flex items-center gap-3 min-w-[300px] max-w-md p-4 rounded-lg shadow-lg border-l-4 animate-in slide-in-from-right-full duration-300 ${styles[type]}`}>
      <div className="shrink-0">{icons[type]}</div>
      <p className="text-sm font-medium text-gray-800 flex-1">{message}</p>
      <button onClick={() => onRemove(id)} className="text-gray-400 hover:text-gray-600 transition-colors">
        <X size={16} />
      </button>
    </div>
  );
};

interface ToastContainerProps {
  toasts: { id: string; message: string; type: ToastType }[];
  onRemove: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemove }) => {
  return (
    <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-3 pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast {...toast} onRemove={onRemove} />
        </div>
      ))}
    </div>
  );
};
