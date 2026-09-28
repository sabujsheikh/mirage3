import React, { useState } from 'react';
import {
  FolderTree,
  Plus,
  Edit2,
  Trash2,
  Tag,
  Check,
  X,
  Building2,
  Layers,
  AlertCircle,
} from 'lucide-react';
import { ExpenseCategoryDefinition, Account, ExpenseType } from '../../../types';

interface CategoriesTabProps {
  categories: ExpenseCategoryDefinition[];
  accounts: Account[];
  onRefresh: () => void;
  canManage: boolean;
}

export const CategoriesTab: React.FC<CategoriesTabProps> = ({
  categories,
  accounts,
  onRefresh,
  canManage,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategoryDefinition | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [type, setType] = useState<ExpenseType>('daily');
  const [expenseAccountId, setExpenseAccountId] = useState('');
  const [subcategories, setSubcategories] = useState<string[]>([]);
  const [newSubcategoryInput, setNewSubcategoryInput] = useState('');
  const [active, setActive] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Available expense accounts from chart of accounts
  const expenseAccounts = accounts.filter((a) => a.type === 'expense');

  const openCreateModal = () => {
    setEditingCategory(null);
    setName('');
    setType('daily');
    setExpenseAccountId(expenseAccounts[0]?.id || 'acc_office_exp');
    setSubcategories([]);
    setNewSubcategoryInput('');
    setActive(true);
    setErrorMsg('');
    setShowModal(true);
  };

  const openEditModal = (cat: ExpenseCategoryDefinition) => {
    setEditingCategory(cat);
    setName(cat.name);
    setType(cat.type);
    setExpenseAccountId(cat.expense_account_id);
    setSubcategories([...cat.subcategories]);
    setNewSubcategoryInput('');
    setActive(cat.active);
    setErrorMsg('');
    setShowModal(true);
  };

  const handleAddSubcategory = () => {
    const val = newSubcategoryInput.trim();
    if (!val) return;
    if (subcategories.some((s) => s.toLowerCase() === val.toLowerCase())) {
      setErrorMsg('This subcategory already exists.');
      return;
    }
    setSubcategories([...subcategories, val]);
    setNewSubcategoryInput('');
    setErrorMsg('');
  };

  const handleRemoveSubcategory = (index: number) => {
    setSubcategories(subcategories.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Category name is required.');
      return;
    }
    if (!expenseAccountId) {
      setErrorMsg('Expense ledger account is required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const acc = accounts.find((a) => a.id === expenseAccountId);
      const payload = {
        name: name.trim(),
        type,
        expense_account_id: expenseAccountId,
        expense_account_name: acc ? acc.name : expenseAccountId,
        subcategories,
        active,
      };

      if (editingCategory) {
        const res = await fetch(`/api/accounting/expense-categories/${editingCategory.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to update category');
        }
      } else {
        const res = await fetch('/api/accounting/expense-categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to create category');
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

  const handleDelete = async (id: string, catName: string) => {
    if (!window.confirm(`Delete expense category "${catName}"?`)) return;
    try {
      const res = await fetch(`/api/accounting/expense-categories/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete category');
      }
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[var(--surface)] border border-[var(--border)] p-3.5 rounded-xl">
        <div>
          <h4 className="text-xs font-bold text-[var(--text)] uppercase tracking-wider">
            Expense Taxonomy & Ledger Mapping
          </h4>
          <p className="text-[11px] text-[var(--text-muted)]">
            Define high-level expense groups and subcategories linked to double-entry general ledger accounts
          </p>
        </div>

        {canManage && (
          <button onClick={openCreateModal} className="erp-btn-primary w-full sm:w-auto">
            <Plus className="w-3.5 h-3.5" />
            <span>Create Category</span>
          </button>
        )}
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((cat) => (
          <div
            key={cat.id}
            className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-xs flex flex-col justify-between hover:border-[var(--accent)] transition-all"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <h4 className="text-xs font-bold text-[var(--text)]">{cat.name}</h4>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded font-bold bg-[var(--surface-sunken)] border border-[var(--border)] text-[var(--accent)]">
                      Type: {cat.type}
                    </span>
                    {cat.is_system && (
                      <span className="text-[10px] font-mono text-[var(--text-muted)] bg-[var(--surface-sunken)] px-1 rounded">
                        System Core
                      </span>
                    )}
                  </div>
                </div>

                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    cat.active
                      ? 'bg-[color-mix(in_srgb,var(--status-teal)_12%,transparent)] text-[var(--status-teal)]'
                      : 'bg-[var(--surface-sunken)] text-[var(--text-muted)]'
                  }`}
                >
                  {cat.active ? 'Active' : 'Disabled'}
                </span>
              </div>

              {/* Linked Ledger Account */}
              <div className="my-2.5 p-2 rounded-lg bg-[var(--surface-sunken)] border border-[var(--border)] text-[11px]">
                <div className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">Ledger Account</div>
                <div className="font-semibold text-[var(--text)] truncate">
                  {cat.expense_account_name || cat.expense_account_id}
                </div>
              </div>

              {/* Subcategories tags */}
              <div>
                <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Tag className="w-3 h-3" />
                  <span>Subcategories ({cat.subcategories.length})</span>
                </div>
                <div className="flex flex-wrap gap-1.5 min-h-[48px]">
                  {cat.subcategories.length === 0 ? (
                    <span className="text-[11px] text-[var(--text-muted)] italic">No specific subcategories</span>
                  ) : (
                    cat.subcategories.map((sub, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded text-[10px] bg-[var(--surface-sunken)] border border-[var(--border)] text-[var(--text)] font-medium"
                      >
                        {sub}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>

            {canManage && (
              <div className="flex items-center justify-end gap-1.5 mt-4 pt-3 border-t border-[var(--border)]">
                <button
                  onClick={() => openEditModal(cat)}
                  className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] cursor-pointer"
                  title="Edit Category"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                {!cat.is_system && (
                  <button
                    onClick={() => handleDelete(cat.id, cat.name)}
                    className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--status-red)] hover:bg-[color-mix(in_srgb,var(--status-red)_10%,transparent)] cursor-pointer"
                    title="Delete Category"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* --- MODAL: Add / Edit Category --- */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-xs">
            <div className="p-5 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-sunken)]">
              <div>
                <h3 className="text-sm font-bold text-[var(--text)]">
                  {editingCategory ? 'Edit Expense Category' : 'Create Expense Category'}
                </h3>
                <p className="text-xs text-[var(--text-muted)]">Configure category name, type and subcategories</p>
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
                <label className="block font-bold text-[var(--text)] mb-1">Category Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Daily / Operational Expenses"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[var(--text)] mb-1">Expense Type *</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as ExpenseType)}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
                  >
                    <option value="daily">Daily Petty Cash</option>
                    <option value="recurring">Recurring / Monthly</option>
                    <option value="supplies">Office & Packaging Supplies</option>
                    <option value="other">General Operational</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[var(--text)] mb-1">Status</label>
                  <select
                    value={active ? 'true' : 'false'}
                    onChange={(e) => setActive(e.target.value === 'true')}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
                  >
                    <option value="true">Active</option>
                    <option value="false">Disabled</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-[var(--text)] mb-1">Linked Expense Ledger Account *</label>
                <select
                  value={expenseAccountId}
                  onChange={(e) => setExpenseAccountId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
                >
                  {expenseAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.code})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-[var(--text-muted)] mt-1">
                  When expenses in this category are logged, this GL account is debited automatically.
                </p>
              </div>

              {/* Subcategories Editor */}
              <div>
                <label className="block font-bold text-[var(--text)] mb-1">Subcategories</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Type subcategory and press Add"
                    value={newSubcategoryInput}
                    onChange={(e) => setNewSubcategoryInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSubcategory();
                      }
                    }}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
                  />
                  <button
                    type="button"
                    onClick={handleAddSubcategory}
                    className="px-3 py-1.5 rounded-lg bg-[var(--surface-sunken)] border border-[var(--border)] text-[var(--text)] font-semibold hover:bg-[var(--surface-hover)] cursor-pointer"
                  >
                    Add
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5 p-2 rounded-lg border border-[var(--border)] bg-[var(--surface-sunken)] min-h-[60px]">
                  {subcategories.length === 0 ? (
                    <span className="text-[11px] text-[var(--text-muted)] p-1 italic">No subcategories added yet.</span>
                  ) : (
                    subcategories.map((sub, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] font-medium"
                      >
                        <span>{sub}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSubcategory(idx)}
                          className="text-[var(--text-muted)] hover:text-[var(--status-red)] cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))
                  )}
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
                  {isSubmitting ? 'Saving...' : editingCategory ? 'Update Category' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
