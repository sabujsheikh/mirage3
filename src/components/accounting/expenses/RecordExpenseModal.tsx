import React, { useState, useEffect } from 'react';
import {
  FileText,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  ArrowRight,
  ShieldAlert,
  CreditCard,
  Building2,
  Tag,
  Receipt,
  Info,
} from 'lucide-react';
import {
  ExpenseCategoryDefinition,
  Account,
  ExpenseTemplate,
  ExpenseBudget,
  ExpenseType,
} from '../../../types';

interface RecordExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: ExpenseCategoryDefinition[];
  accounts: Account[];
  budgets: ExpenseBudget[];
  initialTemplate?: ExpenseTemplate | null;
  onSuccess: () => void;
  recordExpense: (data: any) => Promise<any>;
}

export const RecordExpenseModal: React.FC<RecordExpenseModalProps> = ({
  isOpen,
  onClose,
  categories,
  accounts,
  budgets,
  initialTemplate,
  onSuccess,
  recordExpense,
}) => {
  if (!isOpen) return null;

  const [categoryId, setCategoryId] = useState(
    initialTemplate?.category_id || categories[0]?.id || 'cat_daily'
  );
  const [subcategory, setSubcategory] = useState(initialTemplate?.subcategory || '');
  const [expenseType, setExpenseType] = useState<ExpenseType>(
    initialTemplate?.expense_type || 'daily'
  );
  const [amount, setAmount] = useState<number | ''>(
    initialTemplate?.default_amount !== undefined ? initialTemplate.default_amount : ''
  );
  const [paymentAccountId, setPaymentAccountId] = useState(
    initialTemplate?.default_payment_account_id || 'acc_cash'
  );
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank' | 'bkash' | 'nagad'>(
    initialTemplate?.default_payment_method || 'cash'
  );
  const [description, setDescription] = useState(
    initialTemplate?.default_description || initialTemplate?.name || ''
  );
  const [vendorRecipient, setVendorRecipient] = useState('');
  const [receiptReference, setReceiptReference] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // When initialTemplate changes
  useEffect(() => {
    if (initialTemplate) {
      setCategoryId(initialTemplate.category_id);
      setSubcategory(initialTemplate.subcategory || '');
      setExpenseType(initialTemplate.expense_type || 'daily');
      setAmount(initialTemplate.default_amount !== undefined ? initialTemplate.default_amount : '');
      setPaymentAccountId(initialTemplate.default_payment_account_id || 'acc_cash');
      setPaymentMethod(initialTemplate.default_payment_method || 'cash');
      setDescription(initialTemplate.default_description || initialTemplate.name || '');
    }
  }, [initialTemplate]);

  // Accounts
  const assetAccounts = accounts.filter((a) => a.type === 'asset');
  const selectedPaymentAccount = accounts.find((a) => a.id === paymentAccountId);
  const selectedCategory = categories.find((c) => c.id === categoryId);
  const expenseAccount = accounts.find((a) => a.id === selectedCategory?.expense_account_id);

  // Check matching budget for live warning
  const matchingBudget = budgets.find((b) => {
    if (b.category_id !== categoryId) return false;
    if (b.subcategory && subcategory && b.subcategory.toLowerCase() !== subcategory.toLowerCase()) {
      return false;
    }
    return true;
  });

  const parsedAmount = typeof amount === 'number' ? amount : 0;
  let budgetWarning: { type: 'ok' | 'near' | 'exceeded'; message: string } | null = null;

  if (matchingBudget && parsedAmount > 0) {
    const currentSpent = matchingBudget.spent || 0;
    const projectedSpent = currentSpent + parsedAmount;
    const limit = matchingBudget.amount;
    const projectedPercent = Math.round((projectedSpent / limit) * 100);

    if (projectedSpent > limit) {
      const over = projectedSpent - limit;
      budgetWarning = {
        type: 'exceeded',
        message: `Exceeds ${matchingBudget.period} budget! Currently ৳${currentSpent.toLocaleString()} / ৳${limit.toLocaleString()} spent. Adding ৳${parsedAmount.toLocaleString()} will overshoot budget by ৳${over.toLocaleString()} (${projectedPercent}%).`,
      };
    } else if (projectedPercent >= (matchingBudget.warning_threshold_percent || 80)) {
      budgetWarning = {
        type: 'near',
        message: `Approaching ${matchingBudget.period} budget limit (${projectedPercent}%). ৳${projectedSpent.toLocaleString()} of ৳${limit.toLocaleString()} allocated.`,
      };
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryId) {
      setErrorMsg('Please select an expense category.');
      return;
    }
    if (!amount || parsedAmount <= 0) {
      setErrorMsg('Expense amount must be greater than 0.');
      return;
    }
    if (!description.trim()) {
      setErrorMsg('Please enter a description for the expense voucher.');
      return;
    }
    if (!paymentAccountId) {
      setErrorMsg('Please select the payment asset account.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const cat = selectedCategory;
      const payload = {
        category: cat ? cat.type : 'other',
        category_id: categoryId,
        category_name: cat ? cat.name : 'Operational',
        subcategory: subcategory.trim() || undefined,
        expense_type: expenseType,
        description: description.trim(),
        amount: parsedAmount,
        expense_account_id: cat?.expense_account_id || 'acc_office_exp',
        expense_account_name: expenseAccount?.name || 'Office Expenses',
        payment_account_id: paymentAccountId,
        payment_account_name: selectedPaymentAccount?.name || 'Cash in Hand',
        payment_method: paymentMethod,
        receipt_reference: receiptReference.trim() || undefined,
        vendor_recipient: vendorRecipient.trim() || undefined,
        date: expenseDate ? new Date(expenseDate).toISOString() : new Date().toISOString(),
      };

      await recordExpense(payload);
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to record expense voucher');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-xs flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-sunken)]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[var(--surface)] text-[var(--status-red)] border border-[var(--border)] shadow-xs">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--text)]">
                {initialTemplate ? `Record Expense: ${initialTemplate.name}` : 'Record New Expense Voucher'}
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                Creates an audited expense record and posts balanced double-entry journal entries
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text)] p-1 rounded-lg text-lg cursor-pointer leading-none"
          >
            &times;
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-3 bg-[color-mix(in_srgb,var(--status-red)_10%,transparent)] border border-[color-mix(in_srgb,var(--status-red)_30%,transparent)] rounded-xl text-[var(--status-red)] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Category & Subcategory */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-[var(--text)] mb-1">Expense Category *</label>
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
                    {c.name} ({c.type})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-[var(--text)] mb-1">Subcategory</label>
              {selectedCategory && selectedCategory.subcategories.length > 0 ? (
                <select
                  value={subcategory}
                  onChange={(e) => setSubcategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
                >
                  <option value="">General (None)</option>
                  {selectedCategory.subcategories.map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="e.g. Snacks, Courier, Tape"
                  value={subcategory}
                  onChange={(e) => setSubcategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
                />
              )}
            </div>
          </div>

          {/* Amount and Expense Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-[var(--text)] mb-1">Amount (&#2547;) *</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-sm font-mono text-[var(--text-muted)]">&#2547;</span>
                <input
                  type="number"
                  step="any"
                  min="1"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                  className="w-full pl-8 pr-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--status-red)] font-mono font-bold text-base"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-[var(--text)] mb-1">Voucher Date *</label>
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
              >
              </input>
            </div>
          </div>

          {/* Real-time Budget Warning */}
          {budgetWarning && (
            <div
              className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                budgetWarning.type === 'exceeded'
                  ? 'bg-[color-mix(in_srgb,var(--status-red)_10%,transparent)] border-[color-mix(in_srgb,var(--status-red)_30%,transparent)] text-[var(--status-red)]'
                  : 'bg-[color-mix(in_srgb,var(--status-amber)_10%,transparent)] border-[color-mix(in_srgb,var(--status-amber)_30%,transparent)] text-[var(--status-amber)]'
              }`}
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed font-medium">
                <span className="font-bold block">
                  {budgetWarning.type === 'exceeded' ? 'Budget Limit Exceeded' : 'Budget Limit Warning'}
                </span>
                {budgetWarning.message}
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block font-bold text-[var(--text)] mb-1">Description / Memo *</label>
            <input
              type="text"
              placeholder="e.g. Afternoon tea & biscuits for showroom sales staff"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
            />
          </div>

          {/* Payment Account & Method */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-[var(--text)] mb-1">Paid From (Asset Account) *</label>
              <select
                value={paymentAccountId}
                onChange={(e) => setPaymentAccountId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] font-semibold"
              >
                {assetAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} (&#2547;{a.balance.toLocaleString()})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-[var(--text)] mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
              >
                <option value="cash">Cash (Shop Till)</option>
                <option value="bank">Bank Transfer / Cheque</option>
                <option value="bkash">bKash Merchant</option>
                <option value="nagad">Nagad Merchant</option>
              </select>
            </div>
          </div>

          {/* Vendor / Recipient & Receipt Reference */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-[var(--text)] mb-1">Vendor / Paid To (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Sweet Tea Stall, DESCO, Daraz"
                value={vendorRecipient}
                onChange={(e) => setVendorRecipient(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
              />
            </div>

            <div>
              <label className="block font-bold text-[var(--text)] mb-1">Receipt / Voucher Ref (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Cash Memo #4829, Bill #9821"
                value={receiptReference}
                onChange={(e) => setReceiptReference(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
              />
            </div>
          </div>

          {/* Double Entry Ledger Preview */}
          <div className="p-3 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border)]">
            <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2 flex items-center gap-1">
              <FileText className="w-3 h-3" />
              <span>Double-Entry General Ledger Posting Preview</span>
            </div>
            <div className="space-y-1.5 text-xs font-mono">
              <div className="flex items-center justify-between text-[var(--status-red)]">
                <span>Dr. {expenseAccount?.name || 'Expense Account'}</span>
                <span className="font-bold">&#2547;{parsedAmount.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-[var(--status-teal)] pl-4">
                <span>Cr. {selectedPaymentAccount?.name || 'Asset Account'}</span>
                <span className="font-bold">&#2547;{parsedAmount.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] rounded-lg hover:bg-[var(--surface-hover)] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || parsedAmount <= 0}
              className="erp-btn-primary"
            >
              {isSubmitting ? 'Recording...' : 'Post Expense Voucher'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
