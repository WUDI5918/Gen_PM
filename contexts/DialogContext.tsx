
import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { ConfirmDialog, DialogOptions } from '../components/ConfirmDialog';

interface DialogContextType {
  ask: (options: DialogOptions) => void;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export const DialogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<DialogOptions | null>(null);

  const ask = useCallback((opts: DialogOptions) => {
    setOptions(opts);
    setIsOpen(true);
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    // Delay clearing options slightly to allow animation to finish
    setTimeout(() => setOptions(null), 200);
  };

  return (
    <DialogContext.Provider value={{ ask }}>
      {children}
      <ConfirmDialog isOpen={isOpen} options={options} onClose={handleClose} />
    </DialogContext.Provider>
  );
};

export const useDialog = () => {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
};
