import React from 'react';
import {
  Coffee,
  Cookie,
  Package,
  Utensils,
  PenTool,
  Plus,
  Zap,
  Tag,
  ArrowRight,
} from 'lucide-react';
import { ExpenseTemplate } from '../../../types';

interface FrequentShortcutsBarProps {
  templates: ExpenseTemplate[];
  onSelectTemplate: (template: ExpenseTemplate) => void;
  onManageTemplates: () => void;
  canManage: boolean;
}

export const FrequentShortcutsBar: React.FC<FrequentShortcutsBarProps> = ({
  templates,
  onSelectTemplate,
  onManageTemplates,
  canManage,
}) => {
  const frequentTemplates = templates.filter((t) => t.is_frequent);

  const getTemplateIcon = (name: string, category: string) => {
    const text = (name + ' ' + category).toLowerCase();
    if (text.includes('tea') || text.includes('coffee') || text.includes('refreshment')) {
      return <Coffee className="w-4 h-4 text-[var(--accent)]" />;
    }
    if (text.includes('snack') || text.includes('biscuit') || text.includes('singara')) {
      return <Cookie className="w-4 h-4 text-[var(--status-amber)]" />;
    }
    if (text.includes('pack') || text.includes('box') || text.includes('tape')) {
      return <Package className="w-4 h-4 text-[var(--status-teal)]" />;
    }
    if (text.includes('lunch') || text.includes('meal') || text.includes('biryani') || text.includes('food')) {
      return <Utensils className="w-4 h-4 text-[var(--status-blue)]" />;
    }
    if (text.includes('marker') || text.includes('stationery') || text.includes('paper')) {
      return <PenTool className="w-4 h-4 text-purple-600" />;
    }
    return <Zap className="w-4 h-4 text-[var(--accent)]" />;
  };

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[var(--surface-sunken)] text-[var(--accent)] border border-[var(--border)]">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-[var(--text)] uppercase tracking-wider flex items-center gap-1.5">
              Frequent-Entry Shortcuts
              <span className="text-[10px] px-1.5 py-0.2 rounded font-mono font-normal bg-[var(--surface-sunken)] border border-[var(--border)] text-[var(--text-muted)] lowercase">
                1-click petty cash
              </span>
            </h4>
            <p className="text-[11px] text-[var(--text-muted)]">
              Instantly record recurring daily petty expenses without repeated manual typing
            </p>
          </div>
        </div>

        {canManage && (
          <button
            onClick={onManageTemplates}
            className="text-[11px] font-semibold text-[var(--accent)] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>Manage Templates</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>

      {frequentTemplates.length === 0 ? (
        <div className="py-4 text-center text-xs text-[var(--text-muted)] border border-dashed border-[var(--border)] rounded-lg">
          No frequent shortcuts configured yet. Click "Manage Templates" to add shortcuts.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
          {frequentTemplates.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => onSelectTemplate(tpl)}
              className="group text-left p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-sunken)] hover:bg-[var(--surface-hover)] hover:border-[var(--accent)] transition-all cursor-pointer flex flex-col justify-between"
            >
              <div className="flex items-start justify-between w-full mb-2">
                <div className="p-1 rounded-lg bg-[var(--surface)] border border-[var(--border)] shadow-2xs group-hover:scale-105 transition-transform">
                  {getTemplateIcon(tpl.name, tpl.category_name)}
                </div>
                {tpl.default_amount ? (
                  <span className="text-xs font-mono font-black text-[var(--status-red)]">
                    &#2547;{tpl.default_amount.toLocaleString()}
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-[var(--text-muted)]">Variable</span>
                )}
              </div>

              <div>
                <div className="text-xs font-bold text-[var(--text)] truncate group-hover:text-[var(--accent)]">
                  {tpl.name}
                </div>
                <div className="text-[10px] text-[var(--text-muted)] truncate flex items-center gap-1 mt-0.5">
                  <Tag className="w-2.5 h-2.5" />
                  <span>{tpl.subcategory || tpl.category_name}</span>
                </div>
              </div>
            </button>
          ))}

          {canManage && (
            <button
              onClick={onManageTemplates}
              className="p-3 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] transition-colors text-[var(--text-muted)] hover:text-[var(--text)] flex flex-col items-center justify-center gap-1 cursor-pointer text-center"
            >
              <Plus className="w-4 h-4" />
              <span className="text-[10px] font-bold">New Shortcut</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
