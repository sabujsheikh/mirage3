import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '../common/PageHeader';
import {
  CreditCard,
  Plus,
  Search,
  Filter,
  TrendingDown,
  FileText,
  DollarSign,
  Calendar,
  Building,
  RefreshCw,
  Tag,
  Receipt,
  Sparkles,
  Zap,
  Clock,
  ShieldAlert,
  RotateCcw,
  Eye,
  CheckCircle2,
  AlertCircle,
  FolderTree,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import {
  ExpenseRecord,
  ExpenseCategoryDefinition,
  ExpenseTemplate,
  ExpenseBudget,
} from '../../types';

import { FrequentShortcutsBar } from './expenses/FrequentShortcutsBar';
import { BudgetsTab } from './expenses/BudgetsTab';
import { TemplatesTab } from './expenses/TemplatesTab';
import { RecurringSchedulesTab, RecurringScheduleItem } from './expenses/RecurringSchedulesTab';
import { CategoriesTab } from './expenses/CategoriesTab';
import { RecordExpenseModal } from './expenses/RecordExpenseModal';
import { VoidExpenseModal } from './expenses/VoidExpenseModal';

type ActiveTab = 'vouchers' | 'budgets' | 'templates' | 'schedules' | 'categories';

export const ExpensesView: React.FC = () => {
  const { expenses, accounts, recordExpense, voidExpense, refreshAll } = useApp();
  const { can, sessionToken, currentUser } = useAuth();
  const canManage = can('manage_accounts');

  const safeExpenses = Array.isArray(expenses) ? expenses : [];

  const [activeTab, setActiveTab] = useState<ActiveTab>('vouchers');

  // Backend entities
  const [categories, setCategories] = useState<ExpenseCategoryDefinition[]>([]);
  const [templates, setTemplates] = useState<ExpenseTemplate[]>([]);
  const [budgets, setBudgets] = useState<ExpenseBudget[]>([]);
  const [schedules, setSchedules] = useState<RecurringScheduleItem[]>([]);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);

  // Paginated Expenses state
  const [paginatedExpenses, setPaginatedExpenses] = useState<ExpenseRecord[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isQuerying, setIsQuerying] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'voided'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modals state
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [selectedTemplateForRecord, setSelectedTemplateForRecord] = useState<ExpenseTemplate | null>(null);
  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
  const [selectedExpenseToVoid, setSelectedExpenseToVoid] = useState<ExpenseRecord | null>(null);

  // Details Modal
  const [viewingExpense, setViewingExpense] = useState<ExpenseRecord | null>(null);

  const getAuthHeaders = useCallback(() => {
    const token = sessionToken || (typeof localStorage !== 'undefined' ? localStorage.getItem('mirage_session_token') : null);
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      headers['x-session-token'] = token;
    }
    if (currentUser?.id) {
      headers['x-authenticated-user-id'] = currentUser.id;
    }
    return headers;
  }, [sessionToken, currentUser]);

  // Load auxiliary data: categories, templates, budgets, schedules
  const loadAuxiliaryData = useCallback(async () => {
    setIsLoadingMetadata(true);
    try {
      const headers = getAuthHeaders();
      const [catRes, tplRes, bgtRes, schRes] = await Promise.all([
        fetch('/api/accounting/expense-categories', { headers }).then((r) => (r.ok ? r.json() : [])),
        fetch('/api/accounting/expense-templates', { headers }).then((r) => (r.ok ? r.json() : [])),
        fetch('/api/accounting/expense-budgets', { headers }).then((r) => (r.ok ? r.json() : [])),
        fetch('/api/accounting/expense-schedules', { headers }).then((r) => (r.ok ? r.json() : [])),
      ]);

      if (Array.isArray(catRes)) setCategories(catRes);
      if (Array.isArray(tplRes)) setTemplates(tplRes);
      if (Array.isArray(bgtRes)) setBudgets(bgtRes);
      if (Array.isArray(schRes)) setSchedules(schRes);
    } catch (err) {
      console.error('Failed to load auxiliary expense metadata', err);
    } finally {
      setIsLoadingMetadata(false);
    }
  }, [getAuthHeaders]);

  // Fetch paginated expenses
  const fetchExpensesList = useCallback(async () => {
    setIsQuerying(true);
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', limit.toString());
      if (searchTerm.trim()) params.set('search', searchTerm.trim());
      if (categoryFilter !== 'all') params.set('category', categoryFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (startDate) params.set('start_date', startDate);
      if (endDate) params.set('end_date', endDate);

      const headers = getAuthHeaders();
      const res = await fetch(`/api/accounting/expenses/query?${params.toString()}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setPaginatedExpenses(data.expenses || []);
        setTotalPages(data.totalPages || 1);
        setTotalCount(data.total || 0);
      } else {
        // Fallback to local filtering of context expenses if query endpoint has an issue
        const filtered = safeExpenses.filter((e) => {
          if (statusFilter === 'active' && e.status === 'voided') return false;
          if (statusFilter === 'voided' && e.status !== 'voided') return false;
          if (categoryFilter !== 'all' && e.category_id !== categoryFilter && e.category !== categoryFilter) {
            return false;
          }
          if (searchTerm.trim()) {
            const q = searchTerm.toLowerCase();
            const match =
              (e.expense_number || '').toLowerCase().includes(q) ||
              (e.description || '').toLowerCase().includes(q) ||
              (e.receipt_reference || '').toLowerCase().includes(q);
            if (!match) return false;
          }
          return true;
        });
        setPaginatedExpenses(filtered.slice((page - 1) * limit, page * limit));
        setTotalPages(Math.max(1, Math.ceil(filtered.length / limit)));
        setTotalCount(filtered.length);
      }
    } catch (err) {
      console.error('Failed to query expenses', err);
    } finally {
      setIsQuerying(false);
    }
  }, [page, limit, searchTerm, categoryFilter, statusFilter, startDate, endDate, safeExpenses, getAuthHeaders]);

  useEffect(() => {
    loadAuxiliaryData();
  }, [loadAuxiliaryData]);

  useEffect(() => {
    fetchExpensesList();
  }, [fetchExpensesList]);

  // Handle template selection from Frequent Shortcuts Bar or Templates Tab
  const handleUseTemplate = (tpl: ExpenseTemplate) => {
    setSelectedTemplateForRecord(tpl);
    setIsRecordModalOpen(true);
  };

  const handleOpenNewExpense = () => {
    setSelectedTemplateForRecord(null);
    setIsRecordModalOpen(true);
  };

  const handleConfirmVoid = async (id: string, reason: string) => {
    await voidExpense(id, reason);
    await refreshAll();
    await loadAuxiliaryData();
    await fetchExpensesList();
  };

  // Metrics
  const activeExpenses = safeExpenses.filter((e) => e.status !== 'voided');
  const totalExpenseAmount = activeExpenses.reduce((sum, e) => sum + e.amount, 0);

  const todayStr = new Date().toISOString().split('T')[0];
  const todayPettyCash = activeExpenses
    .filter((e) => (e.date || '').startsWith(todayStr) && e.payment_method === 'cash')
    .reduce((sum, e) => sum + e.amount, 0);

  const rentAndUtilities = activeExpenses
    .filter((e) => e.category === 'rent' || e.category === 'utility' || e.category_id === 'cat_recurring')
    .reduce((sum, e) => sum + e.amount, 0);

  const marketingAndSupplies = activeExpenses
    .filter(
      (e) =>
        e.category === 'marketing' ||
        e.category === 'packing_supplies' ||
        e.category_id === 'cat_marketing' ||
        e.category_id === 'cat_supplies'
    )
    .reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-6" id="expenses-view">
      {/* Page Header */}
      <PageHeader
        eyebrow="Accounting & Finance"
        title="Expense Management"
        desc="Operational disbursements, daily petty cash, monthly recurring bills, and budget monitoring"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                loadAuxiliaryData();
                fetchExpensesList();
                refreshAll();
              }}
              className="p-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            {canManage && (
              <button onClick={handleOpenNewExpense} className="erp-btn-primary">
                <Plus className="w-3.5 h-3.5" />
                <span>Record Voucher</span>
              </button>
            )}
          </div>
        }
      />

      {/* Frequent Shortcuts Bar (Shown on Vouchers Tab) */}
      {activeTab === 'vouchers' && (
        <FrequentShortcutsBar
          templates={templates}
          onSelectTemplate={handleUseTemplate}
          onManageTemplates={() => setActiveTab('templates')}
          canManage={canManage}
        />
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[var(--text-muted)] mb-2">
            <span className="text-xs font-semibold">Total Operating Outflows</span>
            <TrendingDown className="w-4 h-4 text-[var(--status-red)]" />
          </div>
          <div className="text-2xl font-mono font-black text-[var(--status-red)]">
            &#2547;{totalExpenseAmount.toLocaleString()}
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-1">
            {activeExpenses.length} active audited vouchers
          </div>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[var(--text-muted)] mb-2">
            <span className="text-xs font-semibold">Today's Cash Till Outflow</span>
            <Receipt className="w-4 h-4 text-[var(--status-amber)]" />
          </div>
          <div className="text-2xl font-mono font-black text-[var(--status-amber)]">
            &#2547;{todayPettyCash.toLocaleString()}
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-1">Daily petty cash & supplies</div>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[var(--text-muted)] mb-2">
            <span className="text-xs font-semibold">Rent & Utilities</span>
            <Building className="w-4 h-4 text-[var(--accent)]" />
          </div>
          <div className="text-2xl font-mono font-black text-[var(--text)]">
            &#2547;{rentAndUtilities.toLocaleString()}
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-1">Showroom, DESCO & Internet</div>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[var(--text-muted)] mb-2">
            <span className="text-xs font-semibold">Marketing & Supplies</span>
            <Sparkles className="w-4 h-4 text-[var(--status-teal)]" />
          </div>
          <div className="text-2xl font-mono font-black text-[var(--status-teal)]">
            &#2547;{marketingAndSupplies.toLocaleString()}
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-1">Meta Ads, Bubble wrap & boxes</div>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="border-b border-[var(--border)] flex items-center gap-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('vouchers')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'vouchers'
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Expense Vouchers</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-[var(--surface-sunken)] border border-[var(--border)]">
            {totalCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('budgets')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'budgets'
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Budgets & Spending Limits</span>
          {budgets.filter((b) => b.status === 'near_budget' || b.status === 'exceeded').length > 0 && (
            <span className="w-2 h-2 rounded-full bg-[var(--status-amber)] animate-pulse" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('templates')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'templates'
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          <Zap className="w-4 h-4" />
          <span>Shortcuts & Presets</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-[var(--surface-sunken)] border border-[var(--border)]">
            {templates.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('schedules')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'schedules'
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Recurring Monthly Bills</span>
          {schedules.filter((s) => s.status === 'overdue' || s.status === 'due_today').length > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold bg-[var(--status-red)] text-white">
              {schedules.filter((s) => s.status === 'overdue' || s.status === 'due_today').length} Due
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('categories')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'categories'
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          <FolderTree className="w-4 h-4" />
          <span>Categories & GL Mapping</span>
        </button>
      </div>

      {/* --- TAB 1: EXPENSE VOUCHERS LIST --- */}
      {activeTab === 'vouchers' && (
        <div className="space-y-4">
          {/* Search and Filters Bar */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3.5 shadow-xs flex flex-wrap gap-2.5 items-center justify-between">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Search voucher #, description, ref, vendor..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-sunken)] text-[var(--text)] focus:outline-hidden"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPage(1);
                }}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-sunken)] text-[var(--text)] focus:outline-hidden"
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as any);
                  setPage(1);
                }}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-sunken)] text-[var(--text)] focus:outline-hidden"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="voided">Voided Vouchers</option>
              </select>

              <div className="flex items-center gap-1 text-xs">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setPage(1);
                  }}
                  className="px-2 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-sunken)] text-[var(--text)] text-xs"
                  placeholder="Start date"
                />
                <span className="text-[var(--text-muted)]">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setPage(1);
                  }}
                  className="px-2 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-sunken)] text-[var(--text)] text-xs"
                  placeholder="End date"
                />
              </div>

              {(searchTerm || categoryFilter !== 'all' || statusFilter !== 'all' || startDate || endDate) && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setCategoryFilter('all');
                    setStatusFilter('all');
                    setStartDate('');
                    setEndDate('');
                    setPage(1);
                  }}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text)] bg-[var(--surface-sunken)] hover:bg-[var(--surface-hover)] cursor-pointer"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          {/* Vouchers Table */}
          <div className="dense-table-container bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="dense-table w-full text-xs">
                <thead className="bg-[var(--surface-sunken)] border-b border-[var(--border)] text-[var(--text-muted)] uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="py-3 px-4 text-left">Voucher # & Date</th>
                    <th className="py-3 px-4 text-left">Category & Subcategory</th>
                    <th className="py-3 px-4 text-left">Description & Vendor</th>
                    <th className="py-3 px-4 text-left">Payment Account</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {isQuerying ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-xs text-[var(--text-muted)]">
                        <RefreshCw className="w-4 h-4 animate-spin inline-block mr-2" />
                        Loading expense vouchers...
                      </td>
                    </tr>
                  ) : paginatedExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-xs text-[var(--text-muted)]">
                        No expense vouchers match your filter criteria.
                      </td>
                    </tr>
                  ) : (
                    paginatedExpenses.map((exp) => {
                      const isVoided = exp.status === 'voided';
                      return (
                        <tr
                          key={exp.id}
                          className={`hover:bg-[var(--surface-hover)] transition-colors ${
                            isVoided ? 'opacity-60 bg-[var(--surface-sunken)]/50' : ''
                          }`}
                        >
                          <td className="py-3 px-4 font-mono">
                            <div className="font-bold text-[var(--text)]">{exp.expense_number}</div>
                            <div className="text-[10px] text-[var(--text-muted)]">
                              {(exp.date || '').slice(0, 10)}
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-semibold text-[var(--accent)]">
                              {exp.category_name || exp.category.replace('_', ' ')}
                            </div>
                            {exp.subcategory && (
                              <div className="text-[10px] text-[var(--text-muted)] flex items-center gap-1 mt-0.5">
                                <Tag className="w-2.5 h-2.5" />
                                <span>{exp.subcategory}</span>
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-4 max-w-xs">
                            <div className={`font-medium text-[var(--text)] ${isVoided ? 'line-through' : ''}`}>
                              {exp.description}
                            </div>
                            {(exp.vendor_recipient || exp.receipt_reference) && (
                              <div className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">
                                {exp.vendor_recipient && <span>To: {exp.vendor_recipient} </span>}
                                {exp.receipt_reference && <span>Ref: {exp.receipt_reference}</span>}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-medium text-[var(--text)]">{exp.payment_account_name}</div>
                            <div className="text-[10px] text-[var(--text-muted)] uppercase font-mono">
                              Channel: {exp.payment_method}
                            </div>
                          </td>

                          <td className="py-3 px-4 text-right font-mono font-black text-sm">
                            <span className={isVoided ? 'text-[var(--text-muted)] line-through' : 'text-[var(--status-red)]'}>
                              &#2547;{exp.amount.toLocaleString()}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-center">
                            {isVoided ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[color-mix(in_srgb,var(--status-red)_12%,transparent)] text-[var(--status-red)] border border-[color-mix(in_srgb,var(--status-red)_30%,transparent)]">
                                <RotateCcw className="w-2.5 h-2.5" />
                                Voided
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[color-mix(in_srgb,var(--status-teal)_12%,transparent)] text-[var(--status-teal)] border border-[color-mix(in_srgb,var(--status-teal)_30%,transparent)]">
                                <CheckCircle2 className="w-2.5 h-2.5" />
                                Active
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setViewingExpense(exp)}
                                className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] cursor-pointer"
                                title="View Voucher Details"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              {!isVoided && canManage && (
                                <button
                                  onClick={() => {
                                    setSelectedExpenseToVoid(exp);
                                    setIsVoidModalOpen(true);
                                  }}
                                  className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--status-red)] hover:bg-[color-mix(in_srgb,var(--status-red)_10%,transparent)] cursor-pointer"
                                  title="Void Expense Voucher"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-3 bg-[var(--surface-sunken)] border-t border-[var(--border)] flex items-center justify-between text-xs">
              <div className="text-[var(--text-muted)]">
                Showing <span className="font-bold text-[var(--text)]">{paginatedExpenses.length}</span> of{' '}
                <span className="font-bold text-[var(--text)]">{totalCount}</span> vouchers
              </div>

              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-[var(--text-muted)] font-mono">
                  Page {page} of {totalPages}
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] disabled:opacity-40 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 2: BUDGETS & SPENDING LIMITS --- */}
      {activeTab === 'budgets' && (
        <BudgetsTab
          budgets={budgets}
          categories={categories}
          onRefresh={() => {
            loadAuxiliaryData();
            fetchExpensesList();
          }}
          canManage={canManage}
        />
      )}

      {/* --- TAB 3: TEMPLATES & SHORTCUTS --- */}
      {activeTab === 'templates' && (
        <TemplatesTab
          templates={templates}
          categories={categories}
          accounts={accounts}
          onUseTemplate={handleUseTemplate}
          onRefresh={() => {
            loadAuxiliaryData();
            fetchExpensesList();
          }}
          canManage={canManage}
        />
      )}

      {/* --- TAB 4: RECURRING BILLS SCHEDULE --- */}
      {activeTab === 'schedules' && (
        <RecurringSchedulesTab
          schedules={schedules}
          onPaySchedule={handleUseTemplate}
          canManage={canManage}
        />
      )}

      {/* --- TAB 5: CATEGORIES & GL MAPPING --- */}
      {activeTab === 'categories' && (
        <CategoriesTab
          categories={categories}
          accounts={accounts}
          onRefresh={() => {
            loadAuxiliaryData();
            fetchExpensesList();
          }}
          canManage={canManage}
        />
      )}

      {/* --- MODAL: RECORD EXPENSE VOUCHER --- */}
      <RecordExpenseModal
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        categories={categories}
        accounts={accounts}
        budgets={budgets}
        initialTemplate={selectedTemplateForRecord}
        onSuccess={async () => {
          await refreshAll();
          await loadAuxiliaryData();
          await fetchExpensesList();
        }}
        recordExpense={recordExpense}
      />

      {/* --- MODAL: VOID EXPENSE VOUCHER --- */}
      <VoidExpenseModal
        isOpen={isVoidModalOpen}
        onClose={() => {
          setIsVoidModalOpen(false);
          setSelectedExpenseToVoid(null);
        }}
        expense={selectedExpenseToVoid}
        onConfirmVoid={handleConfirmVoid}
      />

      {/* --- MODAL: VIEW EXPENSE DETAILS --- */}
      {viewingExpense && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-xs">
            <div className="p-5 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-sunken)]">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-[var(--accent)]" />
                <div>
                  <h3 className="text-sm font-bold text-[var(--text)]">Expense Voucher Details</h3>
                  <p className="text-xs text-[var(--text-muted)] font-mono">{viewingExpense.expense_number}</p>
                </div>
              </div>
              <button
                onClick={() => setViewingExpense(null)}
                className="text-[var(--text-muted)] hover:text-[var(--text)] p-1 text-lg leading-none cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border)]">
                <div>
                  <div className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">Category</div>
                  <div className="font-bold text-[var(--accent)]">
                    {viewingExpense.category_name || viewingExpense.category}
                  </div>
                  {viewingExpense.subcategory && (
                    <div className="text-[11px] text-[var(--text-muted)]">Sub: {viewingExpense.subcategory}</div>
                  )}
                </div>

                <div>
                  <div className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">Amount</div>
                  <div className="text-lg font-mono font-black text-[var(--status-red)]">
                    &#2547;{viewingExpense.amount.toLocaleString()}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">Date Logged</div>
                  <div className="font-mono text-[var(--text)]">{(viewingExpense.date || '').slice(0, 10)}</div>
                </div>

                <div>
                  <div className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">Logged By</div>
                  <div className="text-[var(--text)]">{viewingExpense.created_by_name || 'Staff'}</div>
                </div>
              </div>

              <div>
                <div className="text-[10px] text-[var(--text-muted)] uppercase font-semibold mb-1">Description</div>
                <div className="p-2.5 rounded-lg bg-[var(--surface-sunken)] border border-[var(--border)] text-[var(--text)]">
                  {viewingExpense.description}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[10px] text-[var(--text-muted)] uppercase font-semibold mb-1">Paid From Account</div>
                  <div className="font-semibold text-[var(--text)]">{viewingExpense.payment_account_name}</div>
                  <div className="text-[10px] text-[var(--text-muted)] font-mono">Method: {viewingExpense.payment_method}</div>
                </div>

                <div>
                  <div className="text-[10px] text-[var(--text-muted)] uppercase font-semibold mb-1">Reference / Vendor</div>
                  <div className="font-mono text-[var(--text)]">
                    {viewingExpense.receipt_reference || 'N/A'}
                  </div>
                  {viewingExpense.vendor_recipient && (
                    <div className="text-[11px] text-[var(--text-muted)]">To: {viewingExpense.vendor_recipient}</div>
                  )}
                </div>
              </div>

              {/* Journal Details */}
              <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-sunken)]">
                <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2 flex items-center gap-1">
                  <FileText className="w-3 h-3 text-[var(--accent)]" />
                  <span>General Ledger Audit Reference</span>
                </div>
                <div className="space-y-1 font-mono text-[11px]">
                  <div className="flex justify-between text-[var(--status-red)]">
                    <span>Dr. {viewingExpense.expense_account_name}</span>
                    <span>&#2547;{viewingExpense.amount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-[var(--status-teal)] pl-3">
                    <span>Cr. {viewingExpense.payment_account_name}</span>
                    <span>&#2547;{viewingExpense.amount.toLocaleString()}</span>
                  </div>
                  {viewingExpense.journal_entry_id && (
                    <div className="text-[10px] text-[var(--text-muted)] pt-1 mt-1 border-t border-[var(--border)]">
                      Journal Entry ID: {viewingExpense.journal_entry_id}
                    </div>
                  )}
                </div>
              </div>

              {/* Void Status Details if voided */}
              {viewingExpense.status === 'voided' && (
                <div className="p-3 rounded-xl border border-[var(--status-red)] bg-[color-mix(in_srgb,var(--status-red)_8%,transparent)]">
                  <div className="font-bold text-[var(--status-red)] flex items-center gap-1.5 mb-1">
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Voided & Reversed on {(viewingExpense.voided_at || '').slice(0, 10)}</span>
                  </div>
                  <p className="text-[11px] text-[var(--text)]">
                    <strong>Reason:</strong> {viewingExpense.void_reason || 'Reversed by authorized user'}
                  </p>
                  {viewingExpense.reversal_journal_entry_id && (
                    <p className="text-[10px] text-[var(--text-muted)] font-mono mt-1">
                      Reversal Journal Entry: {viewingExpense.reversal_journal_entry_id}
                    </p>
                  )}
                </div>
              )}

              <div className="flex justify-end pt-2 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setViewingExpense(null)}
                  className="px-4 py-2 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] rounded-lg hover:bg-[var(--surface-hover)] cursor-pointer font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
