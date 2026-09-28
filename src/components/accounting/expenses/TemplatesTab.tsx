import React, { useState } from 'react';
import {
  FileCode,
  Zap,
  Clock,
  Plus,
  Edit2,
  Trash2,
  Play,
  Tag,
  CheckCircle2,
  CreditCard,
  Calendar,
} from 'lucide-react';
import { ExpenseTemplate, ExpenseCategoryDefinition, Account, ExpenseType } from '../../../types';

interface TemplatesTabProps {
  templates: ExpenseTemplate[];
  categories: ExpenseCategoryDefinition[];
  accounts: Account[];
  onUseTemplate: (template: ExpenseTemplate) => void;
  onRefresh: () => void;
  canManage: boolean;
}

export const TemplatesTab: React.FC<TemplatesTabProps> = ({
  templates,
  categories,
  accounts,
  onUseTemplate,
  onRefresh,
  canManage,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'frequent' | 'recurring'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ExpenseTemplate | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id || 'cat_daily');
  const [subcategory, setSubcategory] = useState('');
  const [expenseType, setExpenseType] = useState<ExpenseType>('daily');
  const [defaultAmount, setDefaultAmount] = useState<number | ''>('');
  const [paymentAccountId, setPaymentAccountId] = useState('acc_cash');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank' | 'bkash' | 'nagad'>('cash');
  const [defaultDescription, setDefaultDescription] = useState('');
  const [isFrequent, setIsFrequent] = useState(true);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringDay, setRecurringDay] = useState<number>(1);
  const [recurringFrequency, setRecurringFrequency] = useState<'monthly' | 'daily' | 'weekly'>('monthly');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const selectedCategoryObj = categories.find((c) => c.id === categoryId);

  const filteredTemplates = templates.filter((t) => {
    if (filterType === 'frequent' && !t.is_frequent) return false;
    if (filterType === 'recurring' && !t.is_recurring) return false;
    return true;
  });

  const openCreateModal = () => {
    setEditingTemplate(null);
    setName('');
    setCategoryId(categories[0]?.id || 'cat_daily');
    setSubcategory('');
    setExpenseType('daily');
    setDefaultAmount('');
    setPaymentAccountId('acc_cash');
    setPaymentMethod('cash');
    setDefaultDescription('');
    setIsFrequent(true);
    setIsRecurring(false);
    setRecurringDay(1);
    setErrorMsg('');
    setShowModal(true);
  };

  const openEditModal = (tpl: ExpenseTemplate) => {
    setEditingTemplate(tpl);
    setName(tpl.name);
    setCategoryId(tpl.category_id);
    setSubcategory(tpl.subcategory || '');
    setExpenseType(tpl.expense_type || 'daily');
    setDefaultAmount(tpl.default_amount || '');
    setPaymentAccountId(tpl.default_payment_account_id || 'acc_cash');
    setPaymentMethod(tpl.default_payment_method || 'cash');
    setDefaultDescription(tpl.default_description || '');
    setIsFrequent(Boolean(tpl.is_frequent));
    setIsRecurring(Boolean(tpl.is_recurring));
    setRecurringDay(tpl.recurring_day || 1);
    setRecurringFrequency(tpl.recurring_frequency || 'monthly');
    setErrorMsg('');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Template name is required.');
      return;
    }
    if (!categoryId) {
      setErrorMsg('Please select a category.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const cat = categories.find((c) => c.id === categoryId);
      const payload = {
        name: name.trim(),
        category_id: categoryId,
        category_name: cat ? cat.name : 'Operational',
        subcategory: subcategory.trim() || undefined,
        expense_type: expenseType,
        default_amount: defaultAmount === '' ? undefined : Number(defaultAmount),
        default_payment_account_id: paymentAccountId,
        default_payment_method: paymentMethod,
        default_description: defaultDescription.trim() || name.trim(),
        is_frequent: isFrequent,
        is_recurring: isRecurring,
        recurring_day: isRecurring ? Number(recurringDay) : undefined,
        recurring_frequency: isRecurring ? recurringFrequency : undefined,
      };

      if (editingTemplate) {
        const res = await fetch(`/api/accounting/expense-templates/${editingTemplate.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to update template');
        }
      } else {
        const res = await fetch('/api/accounting/expense-templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to create template');
        }
      }

      setShowModal(false);
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Operation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, tplName: string) => {
    if (!window.confirm(`Delete expense template "${tplName}"?`)) return;
    try {
      const res = await fetch(`/api/accounting/expense-templates/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete template');
      }
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Action and Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[var(--surface)] border border-[var(--border)] p-3.5 rounded-xl">
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-[var(--border)] bg-[var(--surface-sunken)] p-0.5 text-xs">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                filterType === 'all'
                  ? 'bg-[var(--surface)] text-[var(--text)] shadow-2xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              All Templates ({templates.length})
            </button>
            <button
              onClick={() => setFilterType('frequent')}
              className={`px-3 py-1 rounded-md font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                filterType === 'frequent'
                  ? 'bg-[var(--surface)] text-[var(--text)] shadow-2xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              <Zap className="w-3 h-3 text-[var(--accent)]" />
              Frequent Shortcuts ({templates.filter((t) => t.is_frequent).length})
            </button>
            <button
              onClick={() => setFilterType('recurring')}
              className={`px-3 py-1 rounded-md font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                filterType === 'recurring'
                  ? 'bg-[var(--surface)] text-[var(--text)] shadow-2xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              <Clock className="w-3 h-3 text-[var(--status-blue)]" />
              Recurring Bills ({templates.filter((t) => t.is_recurring).length})
            </button>
          </div>
        </div>

        {canManage && (
          <button
            onClick={openCreateModal}
            className="erp-btn-primary w-full sm:w-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create New Template</span>
          </button>
        )}
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTemplates.length === 0 ? (
          <div className="col-span-full py-12 text-center text-xs text-[var(--text-muted)] bg-[var(--surface)] border border-dashed border-[var(--border)] rounded-xl">
            No expense templates found.
          </div>
        ) : (
          filteredTemplates.map((tpl) => (
            <div
              key={tpl.id}
              className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-xs flex flex-col justify-between hover:border-[var(--accent)] transition-all"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h4 className="text-xs font-bold text-[var(--text)]">{tpl.name}</h4>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-[var(--text-muted)]">
                      <span className="font-semibold text-[var(--accent)]">{tpl.category_name}</span>
                      {tpl.subcategory && <span>&bull; {tpl.subcategory}</span>}
                    </div>
                  </div>

                  {tpl.default_amount ? (
                    <span className="text-sm font-mono font-black text-[var(--status-red)]">
                      &#2547;{tpl.default_amount.toLocaleString()}
                    </span>
                  ) : (
                    <span className="text-[11px] font-mono text-[var(--text-muted)]">Variable</span>
                  )}
                </div>

                <p className="text-[11px] text-[var(--text-muted)] line-clamp-2 my-2 italic">
                  "{tpl.default_description}"
                </p>

                <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-[var(--border)]">
                  {tpl.is_frequent && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[color-mix(in_srgb,var(--status-amber)_12%,transparent)] text-[var(--status-amber)] border border-[color-mix(in_srgb,var(--status-amber)_30%,transparent)] flex items-center gap-1">
                      <Zap className="w-2.5 h-2.5" />
                      Frequent Shortcut
                    </span>
                  )}
                  {tpl.is_recurring && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[color-mix(in_srgb,var(--status-blue)_12%,transparent)] text-[var(--status-blue)] border border-[color-mix(in_srgb,var(--status-blue)_30%,transparent)] flex items-center gap-1">
                      <Calendar className="w-2.5 h-2.5" />
                      Day {tpl.recurring_day} of month
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[var(--surface-sunken)] border border-[var(--border)] text-[var(--text-muted)]">
                    {tpl.default_payment_method.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-[var(--border)]">
                <button
                  onClick={() => onUseTemplate(tpl)}
                  className="px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-xs font-bold hover:opacity-90 transition-opacity flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>Use Template</span>
                </button>

                {canManage && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(tpl)}
                      className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] cursor-pointer"
                      title="Edit Template"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(tpl.id, tpl.name)}
                      className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--status-red)] hover:bg-[color-mix(in_srgb,var(--status-red)_10%,transparent)] cursor-pointer"
                      title="Delete Template"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* --- MODAL: Add / Edit Template --- */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-xs">
            <div className="p-5 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-sunken)]">
              <div>
                <h3 className="text-sm font-bold text-[var(--text)]">
                  {editingTemplate ? 'Edit Expense Template' : 'Create Expense Template'}
                </h3>
                <p className="text-xs text-[var(--text-muted)]">Configure prefilled presets and shortcut behavior</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text)] p-1 cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {errorMsg && (
                <div className="p-3 bg-[color-mix(in_srgb,var(--status-red)_10%,transparent)] border border-[color-mix(in_srgb,var(--status-red)_30%,transparent)] rounded-xl text-[var(--status-red)]">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="block font-bold text-[var(--text)] mb-1">Template Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Staff Snacks, Fiber Internet, Office Tea"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[var(--text)] mb-1">Category *</label>
                  <select
                    value={categoryId}
                    onChange={(e) => {
                      setCategoryId(e.target.value);
                      const cat = categories.find((c) => c.id === e.target.value);
                      if (cat) setExpenseType(cat.type);
                      setSubcategory('');
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] font-semibold"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[var(--text)] mb-1">Subcategory</label>
                  {selectedCategoryObj && selectedCategoryObj.subcategories.length > 0 ? (
                    <select
                      value={subcategory}
                      onChange={(e) => setSubcategory(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
                    >
                      <option value="">General (None)</option>
                      {selectedCategoryObj.subcategories.map((sub) => (
                        <option key={sub} value={sub}>
                          {sub}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="Subcategory name"
                      value={subcategory}
                      onChange={(e) => setSubcategory(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[var(--text)] mb-1">Default Amount (&#2547;)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Leave empty if variable"
                    value={defaultAmount}
                    onChange={(e) => setDefaultAmount(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--status-red)] font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[var(--text)] mb-1">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
                  >
                    <option value="cash">Cash in Hand (Shop Till)</option>
                    <option value="bank">City Bank Account</option>
                    <option value="bkash">bKash Merchant Wallet</option>
                    <option value="nagad">Nagad Merchant Wallet</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-[var(--text)] mb-1">Default Payment Account</label>
                <select
                  value={paymentAccountId}
                  onChange={(e) => setPaymentAccountId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
                >
                  {accounts
                    .filter((a) => a.type === 'asset')
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} (&#2547;{a.balance.toLocaleString()})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-[var(--text)] mb-1">Default Description</label>
                <input
                  type="text"
                  placeholder="e.g. Evening tea & biscuits for showroom sales team"
                  value={defaultDescription}
                  onChange={(e) => setDefaultDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
                />
              </div>

              {/* Toggles */}
              <div className="p-3 bg-[var(--surface-sunken)] rounded-xl border border-[var(--border)] space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isFrequent}
                    onChange={(e) => setIsFrequent(e.target.checked)}
                    className="rounded accent-[var(--accent)]"
                  />
                  <div>
                    <span className="font-bold text-[var(--text)]">Add to Frequent-Entry Shortcuts</span>
                    <p className="text-[10px] text-[var(--text-muted)]">
                      Appears in the 1-click petty cash shortcuts bar on the top of the Expenses screen
                    </p>
                  </div>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isRecurring}
                    onChange={(e) => setIsRecurring(e.target.checked)}
                    className="rounded accent-[var(--accent)]"
                  />
                  <div>
                    <span className="font-bold text-[var(--text)]">Recurring Monthly Bill</span>
                    <p className="text-[10px] text-[var(--text-muted)]">
                      Track due dates and receive alerts when payment is due
                    </p>
                  </div>
                </label>

                {isRecurring && (
                  <div className="pt-2 border-t border-[var(--border)] grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-[var(--text)] mb-1">Due Day of Month (1 - 31)</label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={recurringDay}
                        onChange={(e) => setRecurringDay(parseInt(e.target.value) || 1)}
                        className="w-full px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-[var(--text)] mb-1">Frequency</label>
                      <select
                        value={recurringFrequency}
                        onChange={(e) => setRecurringFrequency(e.target.value as any)}
                        className="w-full px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
                      >
                        <option value="monthly">Monthly</option>
                        <option value="weekly">Weekly</option>
                        <option value="daily">Daily</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] rounded-lg hover:bg-[var(--surface-hover)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="erp-btn-primary"
                >
                  {isSubmitting ? 'Saving...' : editingTemplate ? 'Update Template' : 'Create Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
