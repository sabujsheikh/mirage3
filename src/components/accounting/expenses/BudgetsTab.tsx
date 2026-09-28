import React, { useState } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Trash2,
  Edit2,
  Calendar,
  Clock,
  TrendingDown,
  Filter,
  DollarSign,
  Info,
} from 'lucide-react';
import { ExpenseBudget, ExpenseCategoryDefinition } from '../../../types';

interface BudgetsTabProps {
  budgets: ExpenseBudget[];
  categories: ExpenseCategoryDefinition[];
  onRefresh: () => void;
  canManage: boolean;
}

export const BudgetsTab: React.FC<BudgetsTabProps> = ({
  budgets,
  categories,
  onRefresh,
  canManage,
}) => {
  const [periodFilter, setPeriodFilter] = useState<'all' | 'daily' | 'monthly'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'alert' | 'ok'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState<ExpenseBudget | null>(null);

  // Form State
  const [categoryId, setCategoryId] = useState(categories[0]?.id || 'cat_daily');
  const [subcategory, setSubcategory] = useState('');
  const [period, setPeriod] = useState<'daily' | 'monthly'>('monthly');
  const [amount, setAmount] = useState<number>(5000);
  const [threshold, setThreshold] = useState<number>(80);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const selectedCategoryObj = categories.find((c) => c.id === categoryId);

  const filteredBudgets = budgets.filter((b) => {
    if (periodFilter !== 'all' && b.period !== periodFilter) return false;
    if (statusFilter === 'alert' && b.status === 'ok') return false;
    if (statusFilter === 'ok' && b.status !== 'ok') return false;
    return true;
  });

  const totalBudgeted = budgets.reduce((s, b) => s + b.amount, 0);
  const totalSpent = budgets.reduce((s, b) => s + (b.spent || 0), 0);
  const alertCount = budgets.filter((b) => b.status === 'near_budget' || b.status === 'exceeded').length;

  const openCreateModal = () => {
    setEditingBudget(null);
    setCategoryId(categories[0]?.id || '');
    setSubcategory('');
    setPeriod('monthly');
    setAmount(5000);
    setThreshold(80);
    setErrorMsg('');
    setShowModal(true);
  };

  const openEditModal = (b: ExpenseBudget) => {
    setEditingBudget(b);
    setCategoryId(b.category_id);
    setSubcategory(b.subcategory || '');
    setPeriod(b.period);
    setAmount(b.amount);
    setThreshold(b.warning_threshold_percent || 80);
    setErrorMsg('');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryId) {
      setErrorMsg('Please select a category.');
      return;
    }
    if (amount <= 0) {
      setErrorMsg('Budget amount must be greater than 0.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const cat = categories.find((c) => c.id === categoryId);
      const payload = {
        category_id: categoryId,
        category_name: cat ? cat.name : 'Operational',
        subcategory: subcategory.trim() || undefined,
        period,
        amount: Number(amount),
        warning_threshold_percent: Number(threshold) || 80,
      };

      if (editingBudget) {
        const res = await fetch(`/api/accounting/expense-budgets/${editingBudget.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to update budget');
        }
      } else {
        const res = await fetch('/api/accounting/expense-budgets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to create budget');
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

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete budget for "${name}"?`)) return;
    try {
      const res = await fetch(`/api/accounting/expense-budgets/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete budget');
      }
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[var(--text-muted)] mb-1">
            <span className="text-xs font-semibold">Total Monitored Limits</span>
            <DollarSign className="w-4 h-4 text-[var(--accent)]" />
          </div>
          <div className="text-2xl font-mono font-black text-[var(--text)]">
            &#2547;{totalBudgeted.toLocaleString()}
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-1">Across {budgets.length} configured budgets</div>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[var(--text-muted)] mb-1">
            <span className="text-xs font-semibold">Active Period Outflow</span>
            <TrendingDown className="w-4 h-4 text-[var(--status-red)]" />
          </div>
          <div className="text-2xl font-mono font-black text-[var(--status-red)]">
            &#2547;{totalSpent.toLocaleString()}
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-1">
            {totalBudgeted > 0 ? `${Math.round((totalSpent / totalBudgeted) * 100)}% of total allocation` : 'No limits'}
          </div>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[var(--text-muted)] mb-1">
            <span className="text-xs font-semibold">Threshold Alerts</span>
            <ShieldAlert className={`w-4 h-4 ${alertCount > 0 ? 'text-[var(--status-amber)]' : 'text-[var(--status-teal)]'}`} />
          </div>
          <div className={`text-2xl font-mono font-black ${alertCount > 0 ? 'text-[var(--status-amber)]' : 'text-[var(--status-teal)]'}`}>
            {alertCount} {alertCount === 1 ? 'Alert' : 'Alerts'}
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-1">
            {alertCount > 0 ? 'Budgets near limit or exceeded' : 'All budgets within safe limits'}
          </div>
        </div>
      </div>

      {/* Filter and Action Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[var(--surface)] border border-[var(--border)] p-3.5 rounded-xl">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-[var(--text-muted)]" />
          <select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value as any)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-sunken)] text-[var(--text)] focus:outline-hidden"
          >
            <option value="all">All Periods (Daily & Monthly)</option>
            <option value="daily">Daily Budgets Only</option>
            <option value="monthly">Monthly Budgets Only</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-sunken)] text-[var(--text)] focus:outline-hidden"
          >
            <option value="all">All Statuses</option>
            <option value="alert">Requires Attention (Near / Exceeded)</option>
            <option value="ok">Healthy (Within Budget)</option>
          </select>
        </div>

        {canManage && (
          <button
            onClick={openCreateModal}
            className="erp-btn-primary w-full sm:w-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Set New Budget</span>
          </button>
        )}
      </div>

      {/* Budgets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredBudgets.length === 0 ? (
          <div className="col-span-full py-12 text-center text-xs text-[var(--text-muted)] bg-[var(--surface)] border border-dashed border-[var(--border)] rounded-xl">
            No expense budgets match your active filter.
          </div>
        ) : (
          filteredBudgets.map((budget) => {
            const usedPct = budget.used_percentage || 0;
            const isExceeded = budget.status === 'exceeded';
            const isNear = budget.status === 'near_budget';

            return (
              <div
                key={budget.id}
                className={`bg-[var(--surface)] border rounded-xl p-4 shadow-xs flex flex-col justify-between transition-all ${
                  isExceeded
                    ? 'border-[var(--status-red)] ring-1 ring-[var(--status-red)]'
                    : isNear
                    ? 'border-[var(--status-amber)] ring-1 ring-[var(--status-amber)]'
                    : 'border-[var(--border)]'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-[var(--text)]">{budget.category_name}</span>
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded font-bold bg-[var(--surface-sunken)] border border-[var(--border)] text-[var(--text-muted)]">
                          {budget.period}
                        </span>
                      </div>
                      {budget.subcategory && (
                        <div className="text-[11px] text-[var(--accent)] font-semibold mt-0.5">
                          Sub: {budget.subcategory}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      {isExceeded && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[color-mix(in_srgb,var(--status-red)_12%,transparent)] text-[var(--status-red)] border border-[color-mix(in_srgb,var(--status-red)_30%,transparent)] flex items-center gap-1">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          Exceeded
                        </span>
                      )}
                      {isNear && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[color-mix(in_srgb,var(--status-amber)_12%,transparent)] text-[var(--status-amber)] border border-[color-mix(in_srgb,var(--status-amber)_30%,transparent)] flex items-center gap-1">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          Near Limit
                        </span>
                      )}
                      {!isExceeded && !isNear && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[color-mix(in_srgb,var(--status-teal)_12%,transparent)] text-[var(--status-teal)] border border-[color-mix(in_srgb,var(--status-teal)_30%,transparent)] flex items-center gap-1">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          Normal
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Numbers Breakdown */}
                  <div className="grid grid-cols-2 gap-2 my-3 p-2.5 rounded-lg bg-[var(--surface-sunken)] border border-[var(--border)] text-xs">
                    <div>
                      <div className="text-[10px] text-[var(--text-muted)]">Budget Limit</div>
                      <div className="font-mono font-bold text-[var(--text)]">&#2547;{budget.amount.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[var(--text-muted)]">Actual Spent</div>
                      <div className={`font-mono font-bold ${isExceeded ? 'text-[var(--status-red)]' : 'text-[var(--text)]'}`}>
                        &#2547;{(budget.spent || 0).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[var(--text-muted)]">
                        {isExceeded ? 'Overspent' : 'Remaining'}
                      </div>
                      <div
                        className={`font-mono font-bold ${
                          isExceeded ? 'text-[var(--status-red)]' : 'text-[var(--status-teal)]'
                        }`}
                      >
                        &#2547;{isExceeded ? (budget.overspent || 0).toLocaleString() : (budget.remaining || 0).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[var(--text-muted)]">Usage Ratio</div>
                      <div className="font-mono font-bold text-[var(--text)]">{usedPct}%</div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <div className="w-full h-2 rounded-full bg-[var(--surface-sunken)] overflow-hidden border border-[var(--border)]">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isExceeded
                            ? 'bg-[var(--status-red)]'
                            : isNear
                            ? 'bg-[var(--status-amber)]'
                            : 'bg-[var(--status-teal)]'
                        }`}
                        style={{ width: `${Math.min(usedPct, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-[var(--text-muted)] font-mono">
                      <span>0%</span>
                      <span>Warning Alert at {budget.warning_threshold_percent || 80}%</span>
                      <span>100%</span>
                    </div>
                  </div>
                </div>

                {canManage && (
                  <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-[var(--border)]">
                    <button
                      onClick={() => openEditModal(budget)}
                      className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] cursor-pointer"
                      title="Edit Budget"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(budget.id, `${budget.category_name} ${budget.subcategory || ''}`)}
                      className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--status-red)] hover:bg-[color-mix(in_srgb,var(--status-red)_10%,transparent)] cursor-pointer"
                      title="Delete Budget"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* --- MODAL: Add / Edit Budget --- */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-xs">
            <div className="p-5 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-sunken)]">
              <div>
                <h3 className="text-sm font-bold text-[var(--text)]">
                  {editingBudget ? 'Edit Expense Budget' : 'Configure Expense Budget'}
                </h3>
                <p className="text-xs text-[var(--text-muted)]">Set spending ceiling and early warning alerts</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text)] p-1 cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-[color-mix(in_srgb,var(--status-red)_10%,transparent)] border border-[color-mix(in_srgb,var(--status-red)_30%,transparent)] rounded-xl text-[var(--status-red)]">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="block font-bold text-[var(--text)] mb-1">Expense Category *</label>
                <select
                  value={categoryId}
                  onChange={(e) => {
                    setCategoryId(e.target.value);
                    setSubcategory('');
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] font-semibold"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-[var(--text)] mb-1">
                  Specific Subcategory (Optional)
                </label>
                {selectedCategoryObj && selectedCategoryObj.subcategories.length > 0 ? (
                  <select
                    value={subcategory}
                    onChange={(e) => setSubcategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
                  >
                    <option value="">All subcategories in this category</option>
                    {selectedCategoryObj.subcategories.map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="Leave empty for whole category, or type subcategory"
                    value={subcategory}
                    onChange={(e) => setSubcategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[var(--text)] mb-1">Budget Period *</label>
                  <select
                    value={period}
                    onChange={(e) => setPeriod(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="daily">Daily Petty Cash</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[var(--text)] mb-1">Limit (&#2547;) *</label>
                  <input
                    type="number"
                    min="10"
                    value={amount}
                    onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--status-red)] font-mono font-bold text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[var(--text)] mb-1">
                  Warning Alert Threshold: {threshold}%
                </label>
                <input
                  type="range"
                  min="50"
                  max="100"
                  step="5"
                  value={threshold}
                  onChange={(e) => setThreshold(parseInt(e.target.value) || 80)}
                  className="w-full accent-[var(--accent)]"
                />
                <div className="flex justify-between text-[10px] text-[var(--text-muted)] font-mono mt-0.5">
                  <span>50% (Early)</span>
                  <span>80% (Standard)</span>
                  <span>100% (Strict)</span>
                </div>
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
                  {isSubmitting ? 'Saving...' : editingBudget ? 'Update Budget' : 'Create Budget'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
