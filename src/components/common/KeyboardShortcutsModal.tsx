import React from 'react';
import { Modal } from './Modal';
import { Command, Keyboard, Sparkles } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
  const shortcuts = [
    { key: 'Ctrl + N', macKey: '⌘ + N', description: 'Create New Order (Messenger Parser)' },
    { key: 'Ctrl + P', macKey: '⌘ + P', description: 'Open Walk-in POS Sale' },
    { key: 'Ctrl + O', macKey: '⌘ + O', description: 'View All Orders' },
    { key: 'Ctrl + D', macKey: '⌘ + D', description: 'Go to Dashboard' },
    { key: 'Ctrl + S', macKey: '⌘ + S', description: 'Go to Products & Inventory' },
    { key: 'Ctrl + K', macKey: '⌘ + K', description: 'Quick Search / Command Bar' },
    { key: 'Shift + ?', macKey: 'Shift + ?', description: 'Toggle Keyboard Shortcuts Guide' },
    { key: 'Esc', macKey: 'Esc', description: 'Close Modals / Panels' },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center">
            <Keyboard className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-[15px] font-bold text-[var(--text)]">Keyboard Shortcuts</h3>
            <p className="text-[11px] text-[var(--text-secondary)]">Power user navigation & shortcuts for Mirage Perfume ERP</p>
          </div>
        </div>
      }
      size="md"
    >
      <div className="space-y-4 py-2">
        <div className="p-3 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-xl flex items-center gap-2 text-[12px] text-[var(--text-secondary)]">
          <Sparkles className="w-4 h-4 text-[var(--accent)] shrink-0" />
          <span>Press these key combinations anywhere in the app for instant navigation and actions.</span>
        </div>

        <div className="border border-[var(--border)] rounded-xl overflow-hidden divide-y divide-[var(--border)] bg-[var(--surface)]">
          {shortcuts.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between px-4 py-3 hover:bg-[var(--surface-hover)] transition-colors">
              <span className="text-[13px] font-medium text-[var(--text)]">{item.description}</span>
              <div className="flex items-center gap-1.5">
                <kbd className="px-2 py-1 text-[11px] font-mono font-bold bg-[var(--surface-sunken)] border border-[var(--border)] rounded-md text-[var(--text)] shadow-xs">
                  {item.key}
                </kbd>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
};
