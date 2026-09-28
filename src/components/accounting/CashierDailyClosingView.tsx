import React, { useState, useMemo } from 'react';
import { PageHeader } from '../common/PageHeader';
import {
  Coins,
  DollarSign,
  Plus,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Calendar,
  User,
  ArrowDownRight,
  ArrowUpRight,
  ShieldCheck,
  Building,
  RefreshCw,
  X,
  Clock,
  Send,
  Check,
  AlertCircle,
  Eye,
  ChevronDown,
  ChevronRight,
  Receipt,
  Layers,
  History,
  Info,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { CashierDailyClosing, CashierCashExpense } from '../../types';

export const CashierDailyClosingView: React.FC = () => {
  const {
    cashierClosings,
    activeCashierClosing,
    unclosedCashierDays,
    startCashierBusinessDay,
    addCashierCashExpense,
    submitCashierDailyClosing,
    reviewCashierDailyClosing,
    orders,
    accounts,
    refreshAll,
  } = useApp();
  const { currentUser, can, tier } = useAuth();

  const [activeTab, setActiveTab] = useState<'closing' | 'review' | 'history'>('closing');
  const [selectedClosingId, setSelectedClosingId] = useState<string | null>(null);

  // Filters for history
  const [historyCashierFilter, setHistoryCashierFilter] = useState<string>('all');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>('all');
  const [historySearch, setHistorySearch] = useState<string>('');

  // Modals
  const [showExpenseModal, setShowExpenseModal] = useState<boolean>(false);
  const [showStartDayModal, setShowStartDayModal] = useState<boolean>(false);
  const [showReviewModal, setShowReviewModal] = useState<boolean>(false);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');
  const [reviewNotes, setReviewNotes] = useState<string>('');

  // Start Day form state
  const [newDayFloat, setNewDayFloat] = useState<number>(5000);
  const [newDayDate, setNewDayDate] = useState<string>(new Date().toISOString().slice(0, 10));

  // Expense form state
  const [expCategory, setExpCategory] = useState<string>('office_tea_snacks');
  const [expDesc, setExpDesc] = useState<string>('');
  const [expAmount, setExpAmount] = useState<string>('');
  const [expRef, setExpRef] = useState<string>('');
  const [expError, setExpError] = useState<string>('');

  // Physical Denominations for Closing
  const [denom1000, setDenom1000] = useState<number>(0);
  const [denom500, setDenom500] = useState<number>(0);
  const [denom200, setDenom200] = useState<number>(0);
  const [denom100, setDenom100] = useState<number>(0);
  const [denom50, setDenom50] = useState<number>(0);
  const [denom20, setDenom20] = useState<number>(0);
  const [denom10, setDenom10] = useState<number>(0);
  const [denomCoins, setDenomCoins] = useState<number>(0);
  const [useDenominations, setUseDenominations] = useState<boolean>(true);
  const [directActualCash, setDirectActualCash] = useState<string>('');
  const [closingNotes, setClosingNotes] = useState<string>('');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showOrderBreakdown, setShowOrderBreakdown] = useState<boolean>(false);

  // Determine current active closing to work on
  const currentClosing = useMemo(() => {
    if (selectedClosingId) {
      return cashierClosings.find(c => c.id === selectedClosingId) || null;
    }
    // If active cashier closing is set, use it
    if (activeCashierClosing) return activeCashierClosing;
    // If user has unclosed days, prioritize the first one
    if (unclosedCashierDays.length > 0) return unclosedCashierDays[0];
    // Otherwise look in list for currentUser's open closing
    return cashierClosings.find(c => c.cashier_id === currentUser?.id && (c.status === 'open' || c.status === 'rejected')) || cashierClosings[0] || null;
  }, [selectedClosingId, activeCashierClosing, unclosedCashierDays, cashierClosings, currentUser]);

  // Denomination sum
  const denominationCount =
    denom1000 * 1000 +
    denom500 * 500 +
    denom200 * 200 +
    denom100 * 100 +
    denom50 * 50 +
    denom20 * 20 +
    denom10 * 10 +
    denomCoins;

  const actualCashCount = useDenominations ? denominationCount : (Number(directActualCash) || 0);

  // Sync denomination fields when switching closing
  React.useEffect(() => {
    if (currentClosing) {
      if (currentClosing.denominations) {
        setDenom1000(currentClosing.denominations.note_1000 || 0);
        setDenom500(currentClosing.denominations.note_500 || 0);
        setDenom200(currentClosing.denominations.note_200 || 0);
        setDenom100(currentClosing.denominations.note_100 || 0);
        setDenom50(currentClosing.denominations.note_50 || 0);
        setDenom20(currentClosing.denominations.note_20 || 0);
        setDenom10(currentClosing.denominations.note_10 || 0);
        setDenomCoins(currentClosing.denominations.coins || 0);
      } else if (currentClosing.actual_cash > 0) {
        setDirectActualCash(String(currentClosing.actual_cash));
        setUseDenominations(false);
      }
      setClosingNotes(currentClosing.closing_notes || '');
    }
  }, [currentClosing?.id]);

  // Calculated variance
  const calculatedVariance = currentClosing ? actualCashCount - currentClosing.expected_cash : 0;

  // Filtered orders for this closing's business day and cashier
  const closingOrders = useMemo(() => {
    if (!currentClosing) return [];
    return orders.filter(o => {
      if (o.status === 'cancelled') return false;
      const orderCashier = o.created_by;
      if (currentClosing.cashier_id && orderCashier && orderCashier !== currentClosing.cashier_id) return false;
      const date = o.business_date || o.transaction_date?.slice(0, 10) || o.created_at.slice(0, 10);
      return date === currentClosing.business_date;
    });
  }, [orders, currentClosing]);

  // Pending reviews count
  const pendingReviews = useMemo(() => {
    return cashierClosings.filter(c => c.status === 'submitted');
  }, [cashierClosings]);

  // Filtered history list
  const filteredHistory = useMemo(() => {
    return cashierClosings.filter(c => {
      if (historyCashierFilter !== 'all' && c.cashier_id !== historyCashierFilter) return false;
      if (historyStatusFilter !== 'all' && c.status !== historyStatusFilter) return false;
      if (historySearch.trim()) {
        const q = historySearch.toLowerCase();
        const matchesDate = c.business_date.includes(q);
        const matchesName = c.cashier_name.toLowerCase().includes(q);
        const matchesId = c.id.toLowerCase().includes(q);
        if (!matchesDate && !matchesName && !matchesId) return false;
      }
      return true;
    });
  }, [cashierClosings, historyCashierFilter, historyStatusFilter, historySearch]);

  const isSenior = tier <= 2 || can('manage_accounts') || can('manage_accounting');

  // Handle Recording Cash Expense
  const handleRecordExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentClosing) return;
    setExpError('');
    const amt = parseFloat(expAmount);
    if (isNaN(amt) || amt <= 0) {
      setExpError('Please enter a valid expense amount greater than 0');
      return;
    }
    if (!expDesc.trim()) {
      setExpError('Please provide a brief description for this cash expense');
      return;
    }

    setIsSubmitting(true);
    try {
      await addCashierCashExpense(currentClosing.id, {
        category: expCategory,
        description: expDesc.trim(),
        amount: amt,
        receipt_reference: expRef.trim() || undefined,
      });
      setShowExpenseModal(false);
      setExpDesc('');
      setExpAmount('');
      setExpRef('');
      setFeedbackMsg({ type: 'success', text: `Recorded cash expense of ৳${amt.toLocaleString()} successfully.` });
    } catch (err: any) {
      setExpError(err.message || 'Failed to record expense');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Submitting Closing
  const handleSubmitClosing = async () => {
    if (!currentClosing) return;
    setIsSubmitting(true);
    setFeedbackMsg(null);

    try {
      const denoms = useDenominations
        ? {
            note_1000: denom1000,
            note_500: denom500,
            note_200: denom200,
            note_100: denom100,
            note_50: denom50,
            note_20: denom20,
            note_10: denom10,
            coins: denomCoins,
          }
        : undefined;

      await submitCashierDailyClosing(currentClosing.id, {
        actual_cash: actualCashCount,
        denominations: denoms,
        closing_notes: closingNotes.trim() || undefined,
      });

      setFeedbackMsg({
        type: 'success',
        text: `Daily closing for ${currentClosing.business_date} submitted successfully. Awaiting senior review.`,
      });
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Failed to submit daily closing' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Review (Approve / Reject)
  const handleReviewDecision = async () => {
    if (!currentClosing) return;
    setIsSubmitting(true);
    try {
      await reviewCashierDailyClosing(currentClosing.id, {
        action: reviewAction,
        review_notes: reviewNotes.trim() || undefined,
      });
      setShowReviewModal(false);
      setFeedbackMsg({
        type: 'success',
        text: `Daily closing for ${currentClosing.business_date} has been ${reviewAction === 'approve' ? 'approved & balanced' : 'returned for correction'}.`,
      });
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Review action failed' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Starting a New Business Day
  const handleStartBusinessDay = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const newClosing = await startCashierBusinessDay({
        business_date: newDayDate,
        opening_float: Number(newDayFloat),
      });
      setShowStartDayModal(false);
      setSelectedClosingId(newClosing.id);
      setFeedbackMsg({
        type: 'success',
        text: `Business day for ${newDayDate} started with Opening Float of ৳${Number(newDayFloat).toLocaleString()}.`,
      });
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Failed to start business day' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6" id="cashier-daily-closing-view">
      {/* Page Header */}
      <PageHeader
        eyebrow="POS & Counter Sales"
        title="Cashier Daily Closing"
        desc="Sales collection tracking, physical till cash counting, expense recording, and business-day closing submissions"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowStartDayModal(true)}
              className="erp-btn-secondary flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Start Business Day</span>
            </button>
            {isSenior && pendingReviews.length > 0 && (
              <button
                onClick={() => setActiveTab('review')}
                className="px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 text-xs font-semibold flex items-center gap-1.5 hover:bg-amber-500/20 transition-all cursor-pointer"
              >
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{pendingReviews.length} Pending Review</span>
              </button>
            )}
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[var(--border)] pb-2 text-xs">
        <button
          onClick={() => setActiveTab('closing')}
          className={`px-3 py-2 font-medium rounded-lg transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'closing'
              ? 'bg-[var(--accent)] text-white shadow-xs'
              : 'text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)]'
          }`}
        >
          <Coins className="w-4 h-4" />
          <span>Active Closing & Balancing</span>
          {currentClosing && (
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                currentClosing.status === 'open'
                  ? 'bg-emerald-500/20 text-emerald-100'
                  : currentClosing.status === 'submitted'
                  ? 'bg-amber-500/20 text-amber-100'
                  : currentClosing.status === 'approved'
                  ? 'bg-blue-500/20 text-blue-100'
                  : 'bg-rose-500/20 text-rose-100'
              }`}
            >
              {currentClosing.status.toUpperCase()}
            </span>
          )}
        </button>

        {isSenior && (
          <button
            onClick={() => setActiveTab('review')}
            className={`px-3 py-2 font-medium rounded-lg transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === 'review'
                ? 'bg-[var(--accent)] text-white shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Senior Review Queue</span>
            {pendingReviews.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white font-bold text-[10px]">
                {pendingReviews.length}
              </span>
            )}
          </button>
        )}

        <button
          onClick={() => setActiveTab('history')}
          className={`px-3 py-2 font-medium rounded-lg transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'history'
              ? 'bg-[var(--accent)] text-white shadow-xs'
              : 'text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)]'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Closing History & Log</span>
        </button>
      </div>

      {/* Global Alerts / Feedback Messages */}
      {feedbackMsg && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/20 text-rose-800 dark:text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
          <button
            onClick={() => setFeedbackMsg(null)}
            className="p-1 hover:opacity-75 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Next-Day Unclosed Warning Banner */}
      {unclosedCashierDays.length > 0 && currentClosing?.business_date !== unclosedCashierDays[0].business_date && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-[13px]">Unclosed Business Day Pending: {unclosedCashierDays[0].business_date}</div>
              <div className="text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                You have an unsubmitted business day from {unclosedCashierDays[0].business_date} with ৳{unclosedCashierDays[0].sales_metrics.total_collected.toLocaleString()} collected across {unclosedCashierDays[0].sales_metrics.order_count} orders. Complete and submit this day first.
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              setSelectedClosingId(unclosedCashierDays[0].id);
              setActiveTab('closing');
            }}
            className="px-3.5 py-1.5 bg-amber-600 text-white rounded-xl font-semibold hover:bg-amber-700 cursor-pointer shadow-xs whitespace-nowrap"
          >
            Switch to {unclosedCashierDays[0].business_date} Closing →
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: ACTIVE CLOSING & BALANCING */}
      {/* ========================================================================= */}
      {activeTab === 'closing' && (
        <div className="space-y-6">
          {!currentClosing ? (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-8 text-center space-y-4 shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center mx-auto">
                <Coins className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[var(--text)]">No Active Business Day Open</h3>
                <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto mt-1">
                  Start your business day by setting your opening physical cash float to track counter sales and cash collections.
                </p>
              </div>
              <button
                onClick={() => setShowStartDayModal(true)}
                className="erp-btn-primary mx-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Start Business Day Now</span>
              </button>
            </div>
          ) : (
            <>
              {/* Closing Context Bar */}
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center font-bold">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[14px] text-[var(--text)]">{currentClosing.cashier_name}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          currentClosing.status === 'open'
                            ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                            : currentClosing.status === 'submitted'
                            ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                            : currentClosing.status === 'approved'
                            ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20'
                            : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                        }`}
                      >
                        {currentClosing.status === 'submitted' ? 'SUBMITTED (PENDING REVIEW)' : currentClosing.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[var(--text-muted)] mt-1 font-mono">
                      <span>Business Date: <strong>{currentClosing.business_date}</strong></span>
                      <span>•</span>
                      <span>Opening Float: <strong>৳{currentClosing.opening_float.toLocaleString()}</strong></span>
                      <span>•</span>
                      <span>Shift ID: <strong>{currentClosing.id}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Day Switcher / Actions */}
                <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                  {cashierClosings.length > 1 && (
                    <select
                      value={currentClosing.id}
                      onChange={e => setSelectedClosingId(e.target.value)}
                      className="px-3 py-1.5 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-xl font-medium focus:ring-1 focus:ring-[var(--accent)]"
                    >
                      {cashierClosings.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.business_date} — {c.cashier_name.split(' ')[0]} ({c.status.toUpperCase()})
                        </option>
                      ))}
                    </select>
                  )}
                  {isSenior && currentClosing.status === 'submitted' && (
                    <button
                      onClick={() => setShowReviewModal(true)}
                      className="px-3 py-1.5 bg-amber-600 text-white rounded-xl text-xs font-semibold hover:bg-amber-700 cursor-pointer shadow-xs flex items-center gap-1.5"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Review & Approve</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Status Alert if Needs Review / Rejected */}
              {currentClosing.status === 'rejected' && (
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 text-xs text-rose-800 dark:text-rose-300 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                    <span>Returned for Recount / Correction by Senior Manager</span>
                  </div>
                  <p className="text-rose-700/80 dark:text-rose-300/80">
                    Review notes: "{currentClosing.review_notes || 'Please recount physical cash and verify all cash expense vouchers.'}"
                  </p>
                </div>
              )}

              {/* Section 1: System-Calculated Sales Metrics */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                    <Receipt className="w-3.5 h-3.5" />
                    <span>1. Actual POS Sales & Collections (System Calculated)</span>
                  </h3>
                  <button
                    onClick={() => setShowOrderBreakdown(!showOrderBreakdown)}
                    className="text-xs text-[var(--accent)] hover:underline flex items-center gap-1 font-medium cursor-pointer"
                  >
                    <span>{showOrderBreakdown ? 'Hide Orders' : `View ${currentClosing.sales_metrics.order_count} Orders`}</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showOrderBreakdown ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 shadow-xs">
                    <div className="text-[11px] text-[var(--text-muted)]">Total Sales</div>
                    <div className="text-lg font-bold text-[var(--text)] mt-0.5">
                      &#2547;{currentClosing.sales_metrics.total_sales.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                      {currentClosing.sales_metrics.order_count} Orders
                    </div>
                  </div>

                  <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3 shadow-xs">
                    <div className="text-[11px] text-emerald-800 dark:text-emerald-300 font-semibold flex items-center justify-between">
                      <span>Cash Inflow</span>
                      <Coins className="w-3 h-3 text-emerald-600" />
                    </div>
                    <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
                      &#2547;{currentClosing.sales_metrics.cash_sales.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-emerald-700/70 dark:text-emerald-400/70 mt-0.5">
                      Physical Cash Drawer
                    </div>
                  </div>

                  <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 shadow-xs">
                    <div className="text-[11px] text-[var(--text-muted)]">bKash Sales</div>
                    <div className="text-lg font-bold text-[var(--text)] mt-0.5">
                      &#2547;{currentClosing.sales_metrics.bkash_sales.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-[var(--text-secondary)] mt-0.5">Merchant Wallet</div>
                  </div>

                  <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 shadow-xs">
                    <div className="text-[11px] text-[var(--text-muted)]">Nagad Sales</div>
                    <div className="text-lg font-bold text-[var(--text)] mt-0.5">
                      &#2547;{currentClosing.sales_metrics.nagad_sales.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-[var(--text-secondary)] mt-0.5">Merchant Wallet</div>
                  </div>

                  <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 shadow-xs">
                    <div className="text-[11px] text-[var(--text-muted)]">Card / Bank</div>
                    <div className="text-lg font-bold text-[var(--text)] mt-0.5">
                      &#2547;{(currentClosing.sales_metrics.card_sales + currentClosing.sales_metrics.bank_sales).toLocaleString()}
                    </div>
                    <div className="text-[10px] text-[var(--text-secondary)] mt-0.5">Direct Settlement</div>
                  </div>

                  <div className="bg-[var(--accent)]/5 border border-[var(--accent)]/20 rounded-xl p-3 shadow-xs">
                    <div className="text-[11px] text-[var(--accent)] font-semibold">Total Collected</div>
                    <div className="text-lg font-bold text-[var(--accent)] mt-0.5">
                      &#2547;{currentClosing.sales_metrics.total_collected.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-[var(--text-secondary)] mt-0.5">All Methods Combined</div>
                  </div>
                </div>

                {/* Orders Breakdown Drawer */}
                {showOrderBreakdown && (
                  <div className="mt-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden shadow-xs">
                    <div className="p-3 bg-[var(--surface-sunken)] border-b border-[var(--border)] flex items-center justify-between text-xs font-semibold">
                      <span>Transactions Recorded for {currentClosing.business_date}</span>
                      <span className="text-[var(--text-muted)] font-normal">{closingOrders.length} orders found</span>
                    </div>
                    {closingOrders.length === 0 ? (
                      <div className="p-4 text-center text-xs text-[var(--text-muted)]">
                        No transactions recorded for this business day yet.
                      </div>
                    ) : (
                      <div className="overflow-x-auto max-h-60 overflow-y-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-[var(--surface-sunken)] text-[var(--text-muted)] border-b border-[var(--border)]">
                            <tr>
                              <th className="py-2 px-3">Invoice #</th>
                              <th className="py-2 px-3">Time</th>
                              <th className="py-2 px-3">Customer</th>
                              <th className="py-2 px-3">Items</th>
                              <th className="py-2 px-3">Total Amount</th>
                              <th className="py-2 px-3">Payment Split</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--border)]">
                            {closingOrders.map(o => (
                              <tr key={o.id} className="hover:bg-[var(--surface-hover)]">
                                <td className="py-2 px-3 font-mono font-bold text-[var(--accent)]">
                                  {o.invoice_number}
                                </td>
                                <td className="py-2 px-3 text-[var(--text-secondary)]">
                                  {o.created_at ? new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                                </td>
                                <td className="py-2 px-3 font-medium text-[var(--text)]">
                                  {o.customer_name}
                                </td>
                                <td className="py-2 px-3 text-[var(--text-secondary)]">
                                  {o.items.length} item(s)
                                </td>
                                <td className="py-2 px-3 font-bold text-[var(--text)]">
                                  &#2547;{o.total.toLocaleString()}
                                </td>
                                <td className="py-2 px-3 text-[var(--text-secondary)]">
                                  {o.payments?.map(p => `${p.method.toUpperCase()}: ৳${p.amount.toLocaleString()}`).join(', ') || 'Cash: ৳' + o.total.toLocaleString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Section 2: Cash Expenses Paid from Till */}
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 space-y-4 shadow-xs">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                      <ArrowDownRight className="w-4 h-4 text-rose-500" />
                      <span>2. Cash Expenses Paid from Till Register</span>
                    </h3>
                    <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                      Approved business expenses paid out directly using counter cash notes reduce expected drawer physical cash.
                    </p>
                  </div>
                  {(currentClosing.status === 'open' || currentClosing.status === 'rejected') && (
                    <button
                      onClick={() => setShowExpenseModal(true)}
                      className="px-3 py-1.5 bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20 rounded-xl text-xs font-semibold flex items-center gap-1.5 hover:bg-rose-500/20 cursor-pointer transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Record Cash Expense</span>
                    </button>
                  )}
                </div>

                {currentClosing.cash_expenses.length === 0 ? (
                  <div className="p-4 rounded-xl bg-[var(--surface-sunken)] text-center text-xs text-[var(--text-muted)]">
                    No cash expenses recorded for this business day.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[var(--surface-sunken)] text-[var(--text-muted)] border-b border-[var(--border)]">
                        <tr>
                          <th className="py-2 px-3">Expense #</th>
                          <th className="py-2 px-3">Category</th>
                          <th className="py-2 px-3">Description</th>
                          <th className="py-2 px-3">Voucher / Ref</th>
                          <th className="py-2 px-3 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]">
                        {currentClosing.cash_expenses.map(exp => (
                          <tr key={exp.id} className="hover:bg-[var(--surface-hover)]">
                            <td className="py-2 px-3 font-mono font-bold text-[var(--accent)]">
                              {exp.expense_number || exp.id}
                            </td>
                            <td className="py-2 px-3 font-medium text-[var(--text)]">
                              {exp.category}
                            </td>
                            <td className="py-2 px-3 text-[var(--text-secondary)]">
                              {exp.description}
                            </td>
                            <td className="py-2 px-3 font-mono text-[var(--text-muted)]">
                              {exp.receipt_reference || '—'}
                            </td>
                            <td className="py-2 px-3 font-bold text-rose-600 text-right">
                              -&#2547;{exp.amount.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t-2 border-[var(--border)] font-bold">
                        <tr>
                          <td colSpan={4} className="py-2 px-3 text-right">Total Cash Expenses Deducted:</td>
                          <td className="py-2 px-3 text-rose-600 text-right">
                            -&#2547;{currentClosing.total_cash_expenses.toLocaleString()}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}

                {/* Expected Physical Cash Formula Card */}
                <div className="bg-[var(--surface-sunken)] border border-[var(--border)] rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-[var(--text)] font-medium">
                    <Info className="w-4 h-4 text-[var(--accent)] shrink-0" />
                    <span>
                      Opening Float (৳{currentClosing.opening_float.toLocaleString()}) + Cash Sales (৳{currentClosing.sales_metrics.cash_sales.toLocaleString()}) - Cash Expenses (৳{currentClosing.total_cash_expenses.toLocaleString()})
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-[var(--text-muted)]">Expected Drawer Cash:</span>
                    <span className="ml-2 font-mono font-bold text-base text-[var(--accent)]">
                      &#2547;{currentClosing.expected_cash.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 3: Physical Cash Count & Denominations */}
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 space-y-4 shadow-xs">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                      <Coins className="w-4 h-4 text-emerald-500" />
                      <span>3. Physical Cash Count & Denominations</span>
                    </h3>
                    <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                      Enter the actual count of notes and coins in the physical counter drawer.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setUseDenominations(!useDenominations)}
                      className="text-xs text-[var(--accent)] hover:underline font-semibold cursor-pointer"
                    >
                      {useDenominations ? 'Switch to Quick Total Entry' : 'Switch to Denomination Breakdown'}
                    </button>
                  </div>
                </div>

                {useDenominations ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                    <div className="bg-[var(--surface-sunken)] p-2.5 rounded-xl border border-[var(--border)]">
                      <label className="text-[11px] font-bold text-[var(--text-muted)] block">&#2547;1,000</label>
                      <input
                        type="number"
                        min="0"
                        disabled={currentClosing.status !== 'open' && currentClosing.status !== 'rejected'}
                        value={denom1000 || ''}
                        onChange={e => setDenom1000(Math.max(0, parseInt(e.target.value) || 0))}
                        placeholder="0"
                        className="w-full mt-1 px-2 py-1 text-xs font-mono font-bold text-[var(--text)] bg-[var(--surface)] border border-[var(--border)] rounded-lg text-center focus:ring-1 focus:ring-[var(--accent)] disabled:opacity-60"
                      />
                      <div className="text-[10px] text-[var(--text-secondary)] text-right mt-1">
                        ৳{(denom1000 * 1000).toLocaleString()}
                      </div>
                    </div>

                    <div className="bg-[var(--surface-sunken)] p-2.5 rounded-xl border border-[var(--border)]">
                      <label className="text-[11px] font-bold text-[var(--text-muted)] block">&#2547;500</label>
                      <input
                        type="number"
                        min="0"
                        disabled={currentClosing.status !== 'open' && currentClosing.status !== 'rejected'}
                        value={denom500 || ''}
                        onChange={e => setDenom500(Math.max(0, parseInt(e.target.value) || 0))}
                        placeholder="0"
                        className="w-full mt-1 px-2 py-1 text-xs font-mono font-bold text-[var(--text)] bg-[var(--surface)] border border-[var(--border)] rounded-lg text-center focus:ring-1 focus:ring-[var(--accent)] disabled:opacity-60"
                      />
                      <div className="text-[10px] text-[var(--text-secondary)] text-right mt-1">
                        ৳{(denom500 * 500).toLocaleString()}
                      </div>
                    </div>

                    <div className="bg-[var(--surface-sunken)] p-2.5 rounded-xl border border-[var(--border)]">
                      <label className="text-[11px] font-bold text-[var(--text-muted)] block">&#2547;200</label>
                      <input
                        type="number"
                        min="0"
                        disabled={currentClosing.status !== 'open' && currentClosing.status !== 'rejected'}
                        value={denom200 || ''}
                        onChange={e => setDenom200(Math.max(0, parseInt(e.target.value) || 0))}
                        placeholder="0"
                        className="w-full mt-1 px-2 py-1 text-xs font-mono font-bold text-[var(--text)] bg-[var(--surface)] border border-[var(--border)] rounded-lg text-center focus:ring-1 focus:ring-[var(--accent)] disabled:opacity-60"
                      />
                      <div className="text-[10px] text-[var(--text-secondary)] text-right mt-1">
                        ৳{(denom200 * 200).toLocaleString()}
                      </div>
                    </div>

                    <div className="bg-[var(--surface-sunken)] p-2.5 rounded-xl border border-[var(--border)]">
                      <label className="text-[11px] font-bold text-[var(--text-muted)] block">&#2547;100</label>
                      <input
                        type="number"
                        min="0"
                        disabled={currentClosing.status !== 'open' && currentClosing.status !== 'rejected'}
                        value={denom100 || ''}
                        onChange={e => setDenom100(Math.max(0, parseInt(e.target.value) || 0))}
                        placeholder="0"
                        className="w-full mt-1 px-2 py-1 text-xs font-mono font-bold text-[var(--text)] bg-[var(--surface)] border border-[var(--border)] rounded-lg text-center focus:ring-1 focus:ring-[var(--accent)] disabled:opacity-60"
                      />
                      <div className="text-[10px] text-[var(--text-secondary)] text-right mt-1">
                        ৳{(denom100 * 100).toLocaleString()}
                      </div>
                    </div>

                    <div className="bg-[var(--surface-sunken)] p-2.5 rounded-xl border border-[var(--border)]">
                      <label className="text-[11px] font-bold text-[var(--text-muted)] block">&#2547;50</label>
                      <input
                        type="number"
                        min="0"
                        disabled={currentClosing.status !== 'open' && currentClosing.status !== 'rejected'}
                        value={denom50 || ''}
                        onChange={e => setDenom50(Math.max(0, parseInt(e.target.value) || 0))}
                        placeholder="0"
                        className="w-full mt-1 px-2 py-1 text-xs font-mono font-bold text-[var(--text)] bg-[var(--surface)] border border-[var(--border)] rounded-lg text-center focus:ring-1 focus:ring-[var(--accent)] disabled:opacity-60"
                      />
                      <div className="text-[10px] text-[var(--text-secondary)] text-right mt-1">
                        ৳{(denom50 * 50).toLocaleString()}
                      </div>
                    </div>

                    <div className="bg-[var(--surface-sunken)] p-2.5 rounded-xl border border-[var(--border)]">
                      <label className="text-[11px] font-bold text-[var(--text-muted)] block">&#2547;20</label>
                      <input
                        type="number"
                        min="0"
                        disabled={currentClosing.status !== 'open' && currentClosing.status !== 'rejected'}
                        value={denom20 || ''}
                        onChange={e => setDenom20(Math.max(0, parseInt(e.target.value) || 0))}
                        placeholder="0"
                        className="w-full mt-1 px-2 py-1 text-xs font-mono font-bold text-[var(--text)] bg-[var(--surface)] border border-[var(--border)] rounded-lg text-center focus:ring-1 focus:ring-[var(--accent)] disabled:opacity-60"
                      />
                      <div className="text-[10px] text-[var(--text-secondary)] text-right mt-1">
                        ৳{(denom20 * 20).toLocaleString()}
                      </div>
                    </div>

                    <div className="bg-[var(--surface-sunken)] p-2.5 rounded-xl border border-[var(--border)]">
                      <label className="text-[11px] font-bold text-[var(--text-muted)] block">&#2547;10</label>
                      <input
                        type="number"
                        min="0"
                        disabled={currentClosing.status !== 'open' && currentClosing.status !== 'rejected'}
                        value={denom10 || ''}
                        onChange={e => setDenom10(Math.max(0, parseInt(e.target.value) || 0))}
                        placeholder="0"
                        className="w-full mt-1 px-2 py-1 text-xs font-mono font-bold text-[var(--text)] bg-[var(--surface)] border border-[var(--border)] rounded-lg text-center focus:ring-1 focus:ring-[var(--accent)] disabled:opacity-60"
                      />
                      <div className="text-[10px] text-[var(--text-secondary)] text-right mt-1">
                        ৳{(denom10 * 10).toLocaleString()}
                      </div>
                    </div>

                    <div className="bg-[var(--surface-sunken)] p-2.5 rounded-xl border border-[var(--border)]">
                      <label className="text-[11px] font-bold text-[var(--text-muted)] block">Coins</label>
                      <input
                        type="number"
                        min="0"
                        disabled={currentClosing.status !== 'open' && currentClosing.status !== 'rejected'}
                        value={denomCoins || ''}
                        onChange={e => setDenomCoins(Math.max(0, parseInt(e.target.value) || 0))}
                        placeholder="0"
                        className="w-full mt-1 px-2 py-1 text-xs font-mono font-bold text-[var(--text)] bg-[var(--surface)] border border-[var(--border)] rounded-lg text-center focus:ring-1 focus:ring-[var(--accent)] disabled:opacity-60"
                      />
                      <div className="text-[10px] text-[var(--text-secondary)] text-right mt-1">
                        ৳{denomCoins.toLocaleString()}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="max-w-md">
                    <label className="text-xs font-semibold text-[var(--text)] block mb-1">
                      Direct Physical Cash Count (৳)
                    </label>
                    <input
                      type="number"
                      min="0"
                      disabled={currentClosing.status !== 'open' && currentClosing.status !== 'rejected'}
                      value={directActualCash}
                      onChange={e => setDirectActualCash(e.target.value)}
                      placeholder="e.g. 24500"
                      className="w-full px-3 py-2 text-sm font-mono font-bold text-[var(--text)] bg-[var(--surface-sunken)] border border-[var(--border)] rounded-xl focus:ring-1 focus:ring-[var(--accent)] disabled:opacity-60"
                    />
                  </div>
                )}

                {/* Variance Display Card */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  <div className="bg-[var(--surface-sunken)] p-3.5 rounded-xl border border-[var(--border)]">
                    <div className="text-[11px] text-[var(--text-muted)] font-medium">Expected Physical Cash</div>
                    <div className="text-xl font-bold font-mono text-[var(--text)] mt-1">
                      &#2547;{currentClosing.expected_cash.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-[var(--text-secondary)] mt-0.5">System Calculation</div>
                  </div>

                  <div className="bg-[var(--surface-sunken)] p-3.5 rounded-xl border border-[var(--border)]">
                    <div className="text-[11px] text-[var(--text-muted)] font-medium">Counted Physical Cash</div>
                    <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                      &#2547;{actualCashCount.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-[var(--text-secondary)] mt-0.5">Actual Cash in Drawer</div>
                  </div>

                  <div
                    className={`p-3.5 rounded-xl border ${
                      calculatedVariance === 0
                        ? 'bg-emerald-500/10 border-emerald-500/20'
                        : calculatedVariance < 0
                        ? 'bg-rose-500/10 border-rose-500/20'
                        : 'bg-amber-500/10 border-amber-500/20'
                    }`}
                  >
                    <div className="text-[11px] font-semibold text-[var(--text-muted)] flex items-center justify-between">
                      <span>Cash Variance</span>
                      {calculatedVariance === 0 ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-rose-600" />
                      )}
                    </div>
                    <div
                      className={`text-xl font-bold font-mono mt-1 ${
                        calculatedVariance === 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : calculatedVariance < 0
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {calculatedVariance === 0
                        ? 'Exact Match (\u09F30)'
                        : calculatedVariance < 0
                        ? `- \u09F3${Math.abs(calculatedVariance).toLocaleString()} (Shortage)`
                        : `+ \u09F3${calculatedVariance.toLocaleString()} (Overage)`}
                    </div>
                    <div className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                      {calculatedVariance === 0
                        ? 'Perfect physical balance'
                        : calculatedVariance < 0
                        ? 'Shortage requires reason for senior review'
                        : 'Surplus will be credited to other income'}
                    </div>
                  </div>
                </div>

                {/* Closing Notes */}
                <div>
                  <label className="text-xs font-semibold text-[var(--text)] block mb-1">
                    Cashier Closing Notes (Optional)
                  </label>
                  <textarea
                    rows={2}
                    disabled={currentClosing.status !== 'open' && currentClosing.status !== 'rejected'}
                    value={closingNotes}
                    onChange={e => setClosingNotes(e.target.value)}
                    placeholder="Enter any explanations regarding variance, customer change shortages, or shift details..."
                    className="w-full px-3 py-2 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-xl focus:ring-1 focus:ring-[var(--accent)] disabled:opacity-60"
                  />
                </div>

                {/* Submit Action Bar */}
                <div className="pt-2 border-t border-[var(--border)] flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-xs text-[var(--text-muted)]">
                    {currentClosing.status === 'open' || currentClosing.status === 'rejected' ? (
                      <span>Once submitted, this shift will move to Senior Approval and cannot be modified.</span>
                    ) : (
                      <span>This closing was submitted on {currentClosing.submitted_at ? new Date(currentClosing.submitted_at).toLocaleString() : '—'}.</span>
                    )}
                  </div>

                  {(currentClosing.status === 'open' || currentClosing.status === 'rejected') && (
                    <button
                      onClick={handleSubmitClosing}
                      disabled={isSubmitting}
                      className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 cursor-pointer shadow-xs flex items-center gap-2 disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" />
                      <span>{isSubmitting ? 'Submitting...' : 'Submit Closing for Senior Review'}</span>
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: SENIOR REVIEW QUEUE (MANAGEMENT APPROVAL) */}
      {/* ========================================================================= */}
      {activeTab === 'review' && isSenior && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[var(--accent)]" />
              <span>Pending Senior Review Queue ({pendingReviews.length})</span>
            </h3>
            <span className="text-xs text-[var(--text-secondary)]">
              Senior managers must inspect collections, verify cash expenses, and sign off on till variances.
            </span>
          </div>

          {pendingReviews.length === 0 ? (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-8 text-center text-xs text-[var(--text-muted)] shadow-xs">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <div className="font-bold text-sm text-[var(--text)]">Review Queue Clear</div>
              <div className="mt-1">All cashier business-day closings have been approved and reconciled.</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {pendingReviews.map(cls => (
                <div
                  key={cls.id}
                  className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 space-y-4 shadow-xs"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center font-bold">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-sm text-[var(--text)]">{cls.cashier_name}</div>
                        <div className="text-xs text-[var(--text-muted)] mt-0.5">
                          Business Date: <strong>{cls.business_date}</strong> • Submitted: {cls.submitted_at ? new Date(cls.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedClosingId(cls.id);
                          setReviewAction('approve');
                          setShowReviewModal(true);
                        }}
                        className="px-3.5 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 cursor-pointer shadow-xs flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve Closing</span>
                      </button>
                      <button
                        onClick={() => {
                          setSelectedClosingId(cls.id);
                          setReviewAction('reject');
                          setShowReviewModal(true);
                        }}
                        className="px-3 py-1.5 bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20 rounded-xl text-xs font-semibold hover:bg-rose-500/20 cursor-pointer transition-all flex items-center gap-1.5"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Request Recount</span>
                      </button>
                    </div>
                  </div>

                  {/* Summary Columns */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
                    <div className="bg-[var(--surface-sunken)] p-2.5 rounded-xl border border-[var(--border)]">
                      <span className="text-[11px] text-[var(--text-muted)]">Orders</span>
                      <div className="font-bold text-[var(--text)] mt-0.5">{cls.sales_metrics.order_count} Sales</div>
                    </div>
                    <div className="bg-[var(--surface-sunken)] p-2.5 rounded-xl border border-[var(--border)]">
                      <span className="text-[11px] text-[var(--text-muted)]">Cash Sales</span>
                      <div className="font-bold text-emerald-600 mt-0.5">&#2547;{cls.sales_metrics.cash_sales.toLocaleString()}</div>
                    </div>
                    <div className="bg-[var(--surface-sunken)] p-2.5 rounded-xl border border-[var(--border)]">
                      <span className="text-[11px] text-[var(--text-muted)]">Cash Expenses</span>
                      <div className="font-bold text-rose-600 mt-0.5">-&#2547;{cls.total_cash_expenses.toLocaleString()}</div>
                    </div>
                    <div className="bg-[var(--surface-sunken)] p-2.5 rounded-xl border border-[var(--border)]">
                      <span className="text-[11px] text-[var(--text-muted)]">Expected Cash</span>
                      <div className="font-bold font-mono text-[var(--accent)] mt-0.5">&#2547;{cls.expected_cash.toLocaleString()}</div>
                    </div>
                    <div className="bg-[var(--surface-sunken)] p-2.5 rounded-xl border border-[var(--border)]">
                      <span className="text-[11px] text-[var(--text-muted)]">Counted Cash</span>
                      <div className="font-bold font-mono text-emerald-600 mt-0.5">&#2547;{cls.actual_cash.toLocaleString()}</div>
                    </div>
                    <div className={`p-2.5 rounded-xl border ${cls.cash_variance === 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}>
                      <span className="text-[11px] text-[var(--text-muted)]">Variance</span>
                      <div className={`font-bold font-mono mt-0.5 ${cls.cash_variance === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {cls.cash_variance === 0 ? '৳0 (Match)' : `৳${cls.cash_variance.toLocaleString()}`}
                      </div>
                    </div>
                  </div>

                  {cls.closing_notes && (
                    <div className="p-3 bg-[var(--surface-sunken)] rounded-xl border border-[var(--border)] text-xs text-[var(--text-secondary)]">
                      <strong className="text-[var(--text)]">Cashier Note:</strong> {cls.closing_notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: CLOSING HISTORY & AUDIT LOG */}
      {/* ========================================================================= */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* History Filters */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="text"
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                placeholder="Search date, cashier name..."
                className="px-3 py-1.5 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-xl font-medium focus:ring-1 focus:ring-[var(--accent)] w-full sm:w-60"
              />
              <select
                value={historyStatusFilter}
                onChange={e => setHistoryStatusFilter(e.target.value)}
                className="px-3 py-1.5 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-xl font-medium focus:ring-1 focus:ring-[var(--accent)]"
              >
                <option value="all">All Statuses</option>
                <option value="open">Open</option>
                <option value="submitted">Submitted (Needs Review)</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div className="text-xs text-[var(--text-muted)] font-mono">
              Showing {filteredHistory.length} of {cashierClosings.length} historical records
            </div>
          </div>

          {/* History Table */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--surface-sunken)] text-[var(--text-muted)] border-b border-[var(--border)] font-semibold">
                  <tr>
                    <th className="py-3 px-4">Business Date</th>
                    <th className="py-3 px-4">Cashier</th>
                    <th className="py-3 px-4">Total Sales</th>
                    <th className="py-3 px-4">Cash Inflow</th>
                    <th className="py-3 px-4">Expenses</th>
                    <th className="py-3 px-4">Expected Cash</th>
                    <th className="py-3 px-4">Counted Cash</th>
                    <th className="py-3 px-4">Variance</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {filteredHistory.map(cls => (
                    <tr key={cls.id} className="hover:bg-[var(--surface-hover)]">
                      <td className="py-3 px-4 font-mono font-bold text-[var(--text)]">
                        {cls.business_date}
                      </td>
                      <td className="py-3 px-4 font-medium text-[var(--text)]">
                        {cls.cashier_name}
                      </td>
                      <td className="py-3 px-4 font-bold text-[var(--text)]">
                        &#2547;{cls.sales_metrics.total_sales.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-emerald-600 font-semibold">
                        &#2547;{cls.sales_metrics.cash_sales.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-rose-600">
                        {cls.total_cash_expenses > 0 ? `-৳${cls.total_cash_expenses.toLocaleString()}` : '—'}
                      </td>
                      <td className="py-3 px-4 font-mono text-[var(--accent)] font-semibold">
                        &#2547;{cls.expected_cash.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-mono text-emerald-600 font-bold">
                        &#2547;{cls.actual_cash.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] ${
                            cls.cash_variance === 0
                              ? 'bg-emerald-500/10 text-emerald-600'
                              : cls.cash_variance < 0
                              ? 'bg-rose-500/10 text-rose-600'
                              : 'bg-amber-500/10 text-amber-600'
                          }`}
                        >
                          {cls.cash_variance === 0 ? '৳0' : `৳${cls.cash_variance.toLocaleString()}`}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            cls.status === 'open'
                              ? 'bg-emerald-500/10 text-emerald-600'
                              : cls.status === 'submitted'
                              ? 'bg-amber-500/10 text-amber-600'
                              : cls.status === 'approved'
                              ? 'bg-blue-500/10 text-blue-600'
                              : 'bg-rose-500/10 text-rose-600'
                          }`}
                        >
                          {cls.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedClosingId(cls.id);
                            setActiveTab('closing');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-[var(--surface-sunken)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[11px] font-medium text-[var(--accent)] cursor-pointer"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: RECORD CASH EXPENSE */}
      {/* ========================================================================= */}
      {showExpenseModal && currentClosing && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600">
                  <ArrowDownRight className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-[var(--text)]">Record Cash Expense Paid from Till</h3>
              </div>
              <button
                onClick={() => setShowExpenseModal(false)}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text)] rounded-lg hover:bg-[var(--surface-hover)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRecordExpense} className="space-y-3">
              {expError && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-700 dark:text-rose-300">
                  {expError}
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-[var(--text)] block mb-1">
                  Expense Category
                </label>
                <select
                  value={expCategory}
                  onChange={e => setExpCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-xl font-medium focus:ring-1 focus:ring-[var(--accent)]"
                >
                  <option value="office_tea_snacks">Office Tea, Snacks & Staff Refreshment</option>
                  <option value="packing_supplies">Packaging Materials & Dispatch Boxes</option>
                  <option value="courier_charges">Local Courier / Transport / Rickshaw</option>
                  <option value="utility">Cleaning Supplies & Shop Maintenance</option>
                  <option value="other">Other Small Cash Operational Expense</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--text)] block mb-1">
                  Description / Purpose *
                </label>
                <input
                  type="text"
                  required
                  value={expDesc}
                  onChange={e => setExpDesc(e.target.value)}
                  placeholder="e.g. Evening tea & singara for sales counter"
                  className="w-full px-3 py-2 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-xl focus:ring-1 focus:ring-[var(--accent)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[var(--text)] block mb-1">
                    Amount (৳) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={expAmount}
                    onChange={e => setExpAmount(e.target.value)}
                    placeholder="e.g. 150"
                    className="w-full px-3 py-2 text-xs font-mono font-bold bg-[var(--surface-sunken)] border border-[var(--border)] rounded-xl focus:ring-1 focus:ring-[var(--accent)]"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-[var(--text)] block mb-1">
                    Voucher / Bill Ref #
                  </label>
                  <input
                    type="text"
                    value={expRef}
                    onChange={e => setExpRef(e.target.value)}
                    placeholder="e.g. CASH-VOUCHER-12"
                    className="w-full px-3 py-2 text-xs font-mono bg-[var(--surface-sunken)] border border-[var(--border)] rounded-xl focus:ring-1 focus:ring-[var(--accent)]"
                  />
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-800 dark:text-amber-300">
                This expense will immediately post to Accounting and adjust your expected physical till cash down by ৳{parseFloat(expAmount) || 0}.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text)] rounded-xl border border-[var(--border)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-rose-600 text-white text-xs font-semibold rounded-xl hover:bg-rose-700 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Recording...' : 'Record Cash Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: START NEW BUSINESS DAY */}
      {/* ========================================================================= */}
      {showStartDayModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)]">
                  <Calendar className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-[var(--text)]">Start Business Day Register</h3>
              </div>
              <button
                onClick={() => setShowStartDayModal(false)}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text)] rounded-lg hover:bg-[var(--surface-hover)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleStartBusinessDay} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-[var(--text)] block mb-1">
                  Business Date
                </label>
                <input
                  type="date"
                  required
                  value={newDayDate}
                  onChange={e => setNewDayDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-[var(--surface-sunken)] border border-[var(--border)] rounded-xl focus:ring-1 focus:ring-[var(--accent)]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--text)] block mb-1">
                  Opening Cash Float (৳)
                </label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  required
                  value={newDayFloat}
                  onChange={e => setNewDayFloat(Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder="e.g. 5000"
                  className="w-full px-3 py-2 text-xs font-mono font-bold bg-[var(--surface-sunken)] border border-[var(--border)] rounded-xl focus:ring-1 focus:ring-[var(--accent)]"
                />
                <span className="text-[11px] text-[var(--text-muted)] mt-1 block">
                  Physical cash available in drawer at start of shift for giving change to customers.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setShowStartDayModal(false)}
                  className="px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text)] rounded-xl border border-[var(--border)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-[var(--accent)] text-white text-xs font-semibold rounded-xl hover:opacity-90 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Starting...' : 'Open Business Day'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SENIOR REVIEW APPROVAL / REJECTION */}
      {/* ========================================================================= */}
      {showReviewModal && currentClosing && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${reviewAction === 'approve' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>
                  {reviewAction === 'approve' ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                </div>
                <h3 className="text-sm font-bold text-[var(--text)]">
                  {reviewAction === 'approve' ? 'Approve & Reconcile Shift' : 'Request Recount & Correction'}
                </h3>
              </div>
              <button
                onClick={() => setShowReviewModal(false)}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text)] rounded-lg hover:bg-[var(--surface-hover)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border)] space-y-1">
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Cashier:</span>
                  <span className="font-bold text-[var(--text)]">{currentClosing.cashier_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Business Date:</span>
                  <span className="font-mono font-bold text-[var(--text)]">{currentClosing.business_date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Expected Cash:</span>
                  <span className="font-mono font-bold text-[var(--text)]">&#2547;{currentClosing.expected_cash.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Actual Physical Cash:</span>
                  <span className="font-mono font-bold text-emerald-600">&#2547;{currentClosing.actual_cash.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-t border-[var(--border)] pt-1 mt-1 font-bold">
                  <span className="text-[var(--text-muted)]">Variance:</span>
                  <span className={currentClosing.cash_variance === 0 ? 'text-emerald-600' : 'text-rose-600'}>
                    {currentClosing.cash_variance === 0 ? '৳0 (Exact Match)' : `৳${currentClosing.cash_variance.toLocaleString()}`}
                  </span>
                </div>
              </div>

              {reviewAction === 'approve' && currentClosing.cash_variance !== 0 && (
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-[11px]">
                  <strong>Accounting Impact:</strong> Approving this shift will automatically post a double-entry journal to balance the till:
                  {currentClosing.cash_variance < 0 ? (
                    <span className="block mt-1 font-mono">Dr Cash Shortage (acc_cash_shortage) ৳{Math.abs(currentClosing.cash_variance).toLocaleString()}, Cr Cash in Hand (acc_cash)</span>
                  ) : (
                    <span className="block mt-1 font-mono">Dr Cash in Hand (acc_cash) ৳{currentClosing.cash_variance.toLocaleString()}, Cr Other Income / Overages (acc_other_inc)</span>
                  )}
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-[var(--text)] block mb-1">
                  {reviewAction === 'approve' ? 'Approval Notes (Optional)' : 'Reason for Rejection / Recount Notes *'}
                </label>
                <textarea
                  rows={2}
                  required={reviewAction === 'reject'}
                  value={reviewNotes}
                  onChange={e => setReviewNotes(e.target.value)}
                  placeholder={reviewAction === 'approve' ? 'e.g. All vouchers verified, exact match.' : 'e.g. Missing voucher for ৳500 expense, recount ৳100 notes.'}
                  className="w-full px-3 py-2 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-xl focus:ring-1 focus:ring-[var(--accent)]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setShowReviewModal(false)}
                  className="px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text)] rounded-xl border border-[var(--border)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleReviewDecision}
                  disabled={isSubmitting || (reviewAction === 'reject' && !reviewNotes.trim())}
                  className={`px-4 py-1.5 text-white text-xs font-semibold rounded-xl cursor-pointer shadow-xs disabled:opacity-50 ${
                    reviewAction === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {isSubmitting ? 'Processing...' : reviewAction === 'approve' ? 'Confirm Approval' : 'Return to Cashier'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
