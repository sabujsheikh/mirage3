import React, { useState, useEffect, useMemo } from 'react';
import { PageHeader } from '../common/PageHeader';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import Papa from 'papaparse';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import {
  Order,
  Customer,
  PaymentTransaction,
  CustomerReturn,
  JournalEntry,
} from '../../types';
import {
  Landmark,
  Search,
  RefreshCw,
  Eye,
  Calendar,
  Filter,
  ArrowUpRight,
  ArrowDownLeft,
  FileText,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  UserCheck,
  CreditCard,
  RotateCcw,
  CheckCircle2,
  Clock,
  AlertCircle,
  Download,
  BarChart3,
} from 'lucide-react';

export const SalesPaymentsAccountingView: React.FC = () => {
  const {
    orders,
    customers,
    paymentAccounts,
    customerReturns,
    journalEntries,
    refreshAll,
  } = useApp();

  const { currentUser, can, tier, sessionToken } = useAuth();

  // Access check: Tier 1 (Owner), Tier 2 (Accountant), or explicit 'view_sales_financial_ledger' capability
  const hasAccess = Boolean(
    currentUser && (
      tier === 1 ||
      tier === 2 ||
      can('view_sales_financial_ledger') ||
      currentUser.capabilities?.includes('view_sales_financial_ledger') ||
      currentUser.toggles?.['view_sales_financial_ledger'] === true
    )
  );

  const [loading, setLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [accountFlowFilter, setAccountFlowFilter] = useState<string>('all'); // 'all', 'cash', 'bank', 'bkash', 'nagad'
  const [dateRangeFilter, setDateRangeFilter] = useState<string>('30days'); // 'today', 'yesterday', 'day_before', '7days', '15days', '30days', 'custom'
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('all'); // 'all', 'paid', 'due', 'multiple'
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');

  // Chart and export states
  const [chartData, setChartData] = useState<{ date: string; income: number; expense: number; net: number }[]>([]);
  const [chartLoading, setChartLoading] = useState<boolean>(false);

  // Expanded rows for multiple payments / breakdowns
  const [expandedRowIds, setExpandedRowIds] = useState<Record<string, boolean>>({});

  // Modals
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      await refreshAll();
    } finally {
      setLoading(false);
    }
  };

  const buildQueryParams = () => {
    const params = new URLSearchParams();
    if (dateRangeFilter === 'today') {
      const todayStr = new Date().toISOString().slice(0, 10);
      params.set('date_from', todayStr);
      params.set('date_to', todayStr);
    } else if (dateRangeFilter === 'yesterday') {
      const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      params.set('date_from', yest);
      params.set('date_to', yest);
    } else if (dateRangeFilter === 'day_before') {
      const dbDay = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
      params.set('date_from', dbDay);
      params.set('date_to', dbDay);
    } else if (dateRangeFilter === '7days') {
      const d = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      params.set('date_from', d);
    } else if (dateRangeFilter === '15days') {
      const d = new Date(Date.now() - 15 * 86400000).toISOString().slice(0, 10);
      params.set('date_from', d);
    } else if (dateRangeFilter === '30days') {
      const d = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      params.set('date_from', d);
    } else if (dateRangeFilter === 'custom') {
      if (customStartDate) params.set('date_from', customStartDate);
      if (customEndDate) params.set('date_to', customEndDate);
    }
    if (paymentMethodFilter !== 'all') params.set('payment_method', paymentMethodFilter);
    if (accountFlowFilter !== 'all') params.set('payment_account_id', accountFlowFilter);
    if (searchQuery.trim()) params.set('search', searchQuery.trim());
    return params.toString();
  };

  // Fetch aggregated chart data
  useEffect(() => {
    let isMounted = true;
    const fetchChart = async () => {
      setChartLoading(true);
      try {
        const token = sessionToken || (typeof localStorage !== 'undefined' ? localStorage.getItem('mirage_session_token') : null);
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        if (currentUser?.id) headers['x-authenticated-user-id'] = currentUser.id;

        const q = buildQueryParams();
        const res = await fetch(`/api/accounting/financial-feed-aggregated?${q}`, { headers });
        if (res.ok) {
          const json = await res.json();
          if (isMounted) setChartData(Array.isArray(json) ? json : []);
        }
      } catch (err) {
        console.error('Failed to load aggregated chart data', err);
      } finally {
        if (isMounted) setChartLoading(false);
      }
    };
    fetchChart();
    return () => {
      isMounted = false;
    };
  }, [dateRangeFilter, customStartDate, customEndDate, paymentMethodFilter, accountFlowFilter, searchQuery, sessionToken, currentUser]);

  // CSV Export handler
  const handleExportCSV = async () => {
    try {
      const token = sessionToken || (typeof localStorage !== 'undefined' ? localStorage.getItem('mirage_session_token') : null);
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (currentUser?.id) headers['x-authenticated-user-id'] = currentUser.id;

      const q = buildQueryParams();
      const res = await fetch(`/api/accounting/financial-transactions?${q}`, { headers });
      if (!res.ok) throw new Error('Failed to fetch transactions for export');
      const data = await res.json();
      const txs = Array.isArray(data) ? data : (data.transactions || []);

      const csvData = txs.map((tx: any) => ({
        Date: tx.date || '',
        Reference: tx.reference || '',
        Type: tx.transaction_type || '',
        Description: tx.description || '',
        'Money In (BDT)': tx.money_in || 0,
        'Money Out (BDT)': tx.money_out || 0,
        'Running Balance (BDT)': tx.running_balance || 0,
        Account: tx.payment_account_name || '',
        Staff: tx.created_by_name || '',
      }));

      const csv = Papa.unparse(csvData);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `sales_financial_ledger_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      console.error('CSV Export failed:', err);
      alert('Failed to export CSV: ' + err.message);
    }
  };

  // Compute customer previous due helper
  const getCustomerPreviousDue = (customerId: string, currentOrderId: string): number => {
    const cust = customers.find((c) => c.id === customerId);
    if (!cust) return 0;
    // Sum due/pending amounts across customer's other orders
    const custOrders = orders.filter((o) => o.customer_id === customerId && o.id !== currentOrderId && o.status !== 'cancelled');
    let totalDue = 0;
    custOrders.forEach((o) => {
      const paid = (o.payments || []).filter((p) => p.status === 'completed').reduce((sum, p) => sum + p.amount, 0);
      const due = Math.max(0, o.total - paid);
      totalDue += due;
    });
    return totalDue > 0 ? totalDue : ((cust as any).balance || 0);
  };

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const yesterday = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
    const dayBefore = new Date(now.getTime() - 2 * 86400000).toISOString().slice(0, 10);

    return (orders || []).filter((ord) => {
      if (ord.status === 'cancelled') return false;

      // Date filtering
      const ordDate = (ord.transaction_date || ord.created_at || '').slice(0, 10);
      if (dateRangeFilter === 'today' && ordDate !== todayStr) return false;
      if (dateRangeFilter === 'yesterday' && ordDate !== yesterday) return false;
      if (dateRangeFilter === 'day_before' && ordDate !== dayBefore) return false;
      if (dateRangeFilter === '7days') {
        const d = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
        if (ordDate < d) return false;
      }
      if (dateRangeFilter === '15days') {
        const d = new Date(now.getTime() - 15 * 86400000).toISOString().slice(0, 10);
        if (ordDate < d) return false;
      }
      if (dateRangeFilter === '30days') {
        const d = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
        if (ordDate < d) return false;
      }
      if (dateRangeFilter === 'custom') {
        if (customStartDate && ordDate < customStartDate) return false;
        if (customEndDate && ordDate > customEndDate) return false;
      }

      // Search query (order number, invoice, customer name, phone)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchId = ord.id.toLowerCase().includes(q);
        const matchInv = (ord.invoice_number || '').toLowerCase().includes(q);
        const matchCust = (ord.customer_name || '').toLowerCase().includes(q);
        const matchPhone = (ord.customer_phone || '').toLowerCase().includes(q);
        if (!matchId && !matchInv && !matchCust && !matchPhone) return false;
      }

      // Payment Method filter
      const payments = ord.payments || [];
      const isMultiple = payments.filter((p) => p.status === 'completed').length > 1;
      const primaryMethod = payments[0]?.method || ord.fulfillment_method;
      if (paymentMethodFilter !== 'all') {
        if (paymentMethodFilter === 'multiple' && !isMultiple) return false;
        if (paymentMethodFilter !== 'multiple' && primaryMethod !== paymentMethodFilter) return false;
      }

      // Payment Status filter
      const totalPaid = payments.filter((p) => p.status === 'completed').reduce((sum, p) => sum + p.amount, 0);
      const totalDue = Math.max(0, ord.total - totalPaid);
      if (paymentStatusFilter === 'paid' && totalDue > 0.01) return false;
      if (paymentStatusFilter === 'due' && totalDue <= 0.01) return false;
      if (paymentStatusFilter === 'multiple' && !isMultiple) return false;

      // Order Status filter
      if (orderStatusFilter !== 'all' && ord.status !== orderStatusFilter) return false;

      // Account Flow filter (cash, bank, bkash, nagad)
      if (accountFlowFilter !== 'all') {
        const matchesAccount = payments.some((p) => {
          const accId = (p.payment_account_id || '').toLowerCase();
          if (accountFlowFilter === 'cash' && (accId.includes('cash') || p.method === 'cash')) return true;
          if (accountFlowFilter === 'bank' && (accId.includes('bank') || p.method === 'bank' || p.method === 'card')) return true;
          if (accountFlowFilter === 'bkash' && (accId.includes('bkash') || p.method === 'bkash')) return true;
          if (accountFlowFilter === 'nagad' && (accId.includes('nagad') || p.method === 'nagad')) return true;
          return false;
        });
        if (!matchesAccount) return false;
      }

      return true;
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [orders, searchQuery, accountFlowFilter, dateRangeFilter, customStartDate, customEndDate, paymentMethodFilter, paymentStatusFilter, orderStatusFilter]);

  // Running balance computation across filtered orders
  const tableRowsWithRunningBalance = useMemo(() => {
    let running = 0;
    return filteredOrders.map((ord) => {
      const paid = (ord.payments || []).filter((p) => p.status === 'completed').reduce((sum, p) => sum + p.amount, 0);
      const due = Math.max(0, ord.total - paid);
      running += paid - due; // Cumulative financial ledger flow
      const prevDue = getCustomerPreviousDue(ord.customer_id, ord.id);
      const returnsForOrder = (customerReturns || []).filter((r) => r.order_id === ord.id || r.invoice_number === ord.invoice_number);

      return {
        order: ord,
        paid,
        due,
        prevDue,
        runningBalance: running,
        returns: returnsForOrder,
      };
    });
  }, [filteredOrders, customers, customerReturns]);

  // Summary Metrics
  const summaryMetrics = useMemo(() => {
    let totalSales = 0;
    let totalPaid = 0;
    let totalDue = 0;
    tableRowsWithRunningBalance.forEach((row) => {
      totalSales += row.order.total;
      totalPaid += row.paid;
      totalDue += row.due;
    });
    return { totalSales, totalPaid, totalDue };
  }, [tableRowsWithRunningBalance]);

  const rangeTotals = useMemo(() => {
    let totalInflow = 0;
    let totalOutflow = 0;
    chartData.forEach((item) => {
      totalInflow += item.income || 0;
      totalOutflow += item.expense || 0;
    });
    const netCashFlow = totalInflow - totalOutflow;
    return { totalInflow, totalOutflow, netCashFlow };
  }, [chartData]);

  if (!hasAccess) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-6">
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-[var(--text)]">Access Restricted</h2>
          <p className="text-xs text-[var(--text-secondary)] max-w-md mx-auto">
            The Sales & Payments financial ledger is restricted to Owner (Tier 1), Accountant (Tier 2), or staff explicitly granted the <code className="text-[var(--accent)] font-mono">view_sales_financial_ledger</code> permission toggle.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--text)]">Sales & Payments Financial Ledger</h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Date Range Picker Component */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-[var(--surface-sunken)] px-3 py-2 rounded-lg border border-[var(--border)] text-xs">
              <Calendar className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              <select
                value={dateRangeFilter}
                onChange={(e) => setDateRangeFilter(e.target.value)}
                className="bg-transparent text-[var(--text)] focus:outline-none cursor-pointer font-medium"
              >
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="day_before">Day Before Yesterday</option>
                <option value="7days">Last 7 Days</option>
                <option value="15days">Last 15 Days</option>
                <option value="30days">Last 30 Days</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>
            {dateRangeFilter === 'custom' && (
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-2.5 py-2 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)]"
                />
                <span className="text-xs text-[var(--text-muted)]">to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-2.5 py-2 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)]"
                />
              </div>
            )}
          </div>

          <button
            onClick={handleExportCSV}
            className="px-3 py-2 bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20 border border-[var(--accent)]/30 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
            title="Export filtered financial transactions to CSV"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            onClick={handleRefresh}
            className="px-3 py-2 border border-[var(--border)] rounded-lg hover:bg-[var(--accent)]/10 text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[var(--card)] p-4 rounded-xl border border-[var(--border)]">
          <div className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">Total Sales (Filtered)</div>
          <div className="text-2xl font-bold font-mono text-[var(--text)]">৳{summaryMetrics.totalSales.toLocaleString()}</div>
          <div className="text-[11px] text-[var(--text-muted)] mt-1">{filteredOrders.length} orders recorded</div>
        </div>
        <div className="bg-[var(--card)] p-4 rounded-xl border border-[var(--border)]">
          <div className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">Total Collected (Paid)</div>
          <div className="text-2xl font-bold font-mono text-emerald-500">৳{summaryMetrics.totalPaid.toLocaleString()}</div>
          <div className="text-[11px] text-[var(--text-muted)] mt-1">Realized revenue & settled funds</div>
        </div>
        <div className="bg-[var(--card)] p-4 rounded-xl border border-[var(--border)]">
          <div className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">Outstanding Current Due</div>
          <div className="text-2xl font-bold font-mono text-amber-500">৳{summaryMetrics.totalDue.toLocaleString()}</div>
          <div className="text-[11px] text-[var(--text-muted)] mt-1">Pending order balances & COD receivable</div>
        </div>
      </div>

      {/* Daily Income vs Expense Trend Chart */}
      <div className="bg-[var(--card)] p-5 rounded-xl border border-[var(--border)] space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[var(--accent)]" />
            <h2 className="text-sm font-bold text-[var(--text)]">Daily Income vs. Expense Trends</h2>
          </div>
          <span className="text-xs text-[var(--text-muted)] font-mono">
            {chartData.length} data point(s)
          </span>
        </div>

        <div className="h-64 w-full">
          {chartLoading ? (
            <div className="h-full flex items-center justify-center text-xs text-[var(--text-muted)]">
              Loading trend analytics...
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-[var(--text-muted)]">
              No financial activity data found for the selected range/filters.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} stroke="var(--border)" />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} stroke="var(--border)" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--card)',
                    borderColor: 'var(--border)',
                    borderRadius: '8px',
                    fontSize: '11px',
                    color: 'var(--text)',
                  }}
                  formatter={(value: any) => [`৳${Number(value || 0).toLocaleString()}`, '']}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Bar dataKey="income" name="Income (৳)" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Expense (৳)" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-[var(--card)] p-3 rounded-xl border border-[var(--border)] space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search orders by #, invoice, customer, phone..."
              className="w-full pl-8 pr-3 py-1.5 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          {/* Account Flow Quick Selects */}
          <div className="flex items-center gap-1 bg-[var(--surface-sunken)] p-0.5 rounded-lg border border-[var(--border)] text-xs">
            {[
              { id: 'all', label: 'All' },
              { id: 'cash', label: 'Cash' },
              { id: 'bank', label: 'Bank' },
              { id: 'bkash', label: 'bKash' },
              { id: 'nagad', label: 'Nagad' },
            ].map((acc) => (
              <button
                key={acc.id}
                onClick={() => setAccountFlowFilter(acc.id)}
                className={`px-2 py-1 rounded-md font-medium transition-all cursor-pointer ${
                  accountFlowFilter === acc.id
                    ? 'bg-[var(--accent)] text-white shadow-xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                {acc.label}
              </button>
            ))}
          </div>
        </div>

        {/* Secondary Filter Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-[var(--border)] text-xs">
          {/* Payment Method */}
          <div className="flex items-center gap-2 bg-[var(--surface-sunken)] px-2.5 py-1.5 rounded-lg border border-[var(--border)]">
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase shrink-0">Method:</span>
            <select
              value={paymentMethodFilter}
              onChange={(e) => setPaymentMethodFilter(e.target.value)}
              className="w-full bg-transparent text-xs text-[var(--text)] focus:outline-none cursor-pointer"
            >
              <option value="all">All Methods</option>
              <option value="cash">Cash</option>
              <option value="bkash">bKash</option>
              <option value="nagad">Nagad</option>
              <option value="bank">Bank</option>
              <option value="card">Card</option>
              <option value="cod_pending">COD Pending</option>
              <option value="multiple">Multiple Payment</option>
            </select>
          </div>

          {/* Payment Status */}
          <div className="flex items-center gap-2 bg-[var(--surface-sunken)] px-2.5 py-1.5 rounded-lg border border-[var(--border)]">
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase shrink-0">Payment:</span>
            <select
              value={paymentStatusFilter}
              onChange={(e) => setPaymentStatusFilter(e.target.value)}
              className="w-full bg-transparent text-xs text-[var(--text)] focus:outline-none cursor-pointer"
            >
              <option value="all">All Payment Status</option>
              <option value="paid">Fully Paid</option>
              <option value="due">Has Due Balance</option>
              <option value="multiple">Multiple Payments</option>
            </select>
          </div>

          {/* Order Status */}
          <div className="flex items-center gap-2 bg-[var(--surface-sunken)] px-2.5 py-1.5 rounded-lg border border-[var(--border)]">
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase shrink-0">Order:</span>
            <select
              value={orderStatusFilter}
              onChange={(e) => setOrderStatusFilter(e.target.value)}
              className="w-full bg-transparent text-xs text-[var(--text)] focus:outline-none cursor-pointer"
            >
              <option value="all">All Order Status</option>
              <option value="confirmed">Confirmed</option>
              <option value="packed">Packed</option>
              <option value="dispatched">Dispatched</option>
              <option value="delivered">Delivered</option>
            </select>
          </div>
        </div>
      </div>

      {/* Date Range Cash Flow Summary Card */}
      <div className="bg-[var(--card)] p-4 rounded-xl border border-[var(--border)] flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <div className="text-xs font-bold text-[var(--text)] uppercase tracking-wider">Date Range Cash Flow Summary</div>
          <div className="text-[11px] text-[var(--text-muted)] mt-0.5">Aggregated inflow, outflow & net cash flow for selected date filter</div>
        </div>
        <div className="flex items-center gap-6 text-right">
          <div>
            <div className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Total Inflow</div>
            <div className="text-base font-bold font-mono text-emerald-500">৳{rangeTotals.totalInflow.toLocaleString()}</div>
          </div>
          <div className="border-l border-[var(--border)] pl-6">
            <div className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Total Outflow</div>
            <div className="text-base font-bold font-mono text-rose-500">৳{rangeTotals.totalOutflow.toLocaleString()}</div>
          </div>
          <div className="border-l border-[var(--border)] pl-6">
            <div className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Net Cash Flow</div>
            <div className={`text-base font-bold font-mono ${rangeTotals.netCashFlow >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              ৳{rangeTotals.netCashFlow.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] relative">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-20 bg-[var(--surface-sunken)] shadow-xs">
              <tr className="bg-[var(--surface-sunken)] text-[var(--text-muted)] border-b border-[var(--border)] uppercase font-semibold text-[10px] tracking-wider">
                <th className="sticky left-0 z-30 bg-[var(--surface-sunken)] py-3 px-4 border-r border-[var(--border)] shadow-xs">Order / Invoice</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-right">Total (৳)</th>
                <th className="py-3 px-4">Payment Method</th>
                <th className="py-3 px-4 text-right">Paid (৳)</th>
                <th className="py-3 px-4 text-right">Current Due</th>
                <th className="py-3 px-4 text-right">Previous Due</th>
                <th className="py-3 px-4 text-right">Running Balance</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {tableRowsWithRunningBalance.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-[var(--text-muted)]">
                    No sales or payment records found matching the selected filters.
                  </td>
                </tr>
              ) : (
                tableRowsWithRunningBalance.map(({ order, paid, due, prevDue, runningBalance, returns }) => {
                  const completedPayments = (order.payments || []).filter((p) => p.status === 'completed');
                  const isMultiple = completedPayments.length > 1;
                  const isExpanded = !!expandedRowIds[order.id];

                  return (
                    <React.Fragment key={order.id}>
                      <tr
                        onClick={() => setSelectedOrder(order)}
                        className="odd:bg-[var(--card)] even:bg-[var(--surface-sunken)]/50 hover:bg-[var(--surface-hover)] cursor-pointer transition-colors group"
                      >
                        {/* Order / Invoice (Frozen Leftmost Column) */}
                        <td className="sticky left-0 z-10 py-3 px-4 font-mono bg-[var(--card)] group-odd:bg-[var(--card)] group-even:bg-[var(--surface-sunken)] group-hover:bg-[var(--surface-hover)] border-r border-[var(--border)] shadow-xs">
                          <div className="font-bold text-[var(--text)]">{order.invoice_number}</div>
                          <div className="text-[10px] text-[var(--text-muted)]">{order.id}</div>
                        </td>

                        {/* Customer */}
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const cust = customers.find((c) => c.id === order.customer_id);
                              if (cust) setSelectedCustomer(cust);
                            }}
                            className="font-medium text-[var(--text)] hover:text-[var(--accent)] text-left hover:underline"
                          >
                            {order.customer_name}
                          </button>
                          <div className="text-[10px] text-[var(--text-muted)] font-mono">{order.customer_phone}</div>
                        </td>

                        {/* Date */}
                        <td className="py-3 px-4 text-[var(--text-secondary)] whitespace-nowrap">
                          {new Date(order.transaction_date || order.created_at).toLocaleDateString()}
                        </td>

                        {/* Total */}
                        <td className="py-3 px-4 text-right font-mono font-bold text-[var(--text)]">
                          ৳{order.total.toLocaleString()}
                        </td>

                        {/* Payment Method */}
                        <td className="py-3 px-4">
                          {isMultiple ? (
                            <div className="space-y-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedRowIds((prev) => ({ ...prev, [order.id]: !isExpanded }));
                                }}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-500/10 text-purple-500 border border-purple-500/20 hover:bg-purple-500/25 cursor-pointer"
                              >
                                Multiple Payments ({completedPayments.length})
                                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </button>
                            </div>
                          ) : (
                            <span className="capitalize px-2 py-0.5 rounded text-[10px] font-medium bg-[var(--surface-sunken)] border border-[var(--border)] text-[var(--text)]">
                              {completedPayments[0]?.method || order.fulfillment_method || 'Cash'}
                            </span>
                          )}
                          {returns.length > 0 && (
                            <div className="text-[10px] text-rose-500 font-semibold mt-0.5">
                              {returns.length} Refund(s) Linked
                            </div>
                          )}
                        </td>

                        {/* Paid */}
                        <td className="py-3 px-4 text-right font-mono font-medium text-emerald-500">
                          ৳{paid.toLocaleString()}
                        </td>

                        {/* Current Due */}
                        <td className="py-3 px-4 text-right font-mono font-medium text-amber-500">
                          {due > 0 ? `৳${due.toLocaleString()}` : <span className="text-[var(--text-muted)]">৳0</span>}
                        </td>

                        {/* Previous Due */}
                        <td className="py-3 px-4 text-right font-mono text-[var(--text-secondary)]">
                          {prevDue > 0 ? `৳${prevDue.toLocaleString()}` : <span className="text-[var(--text-muted)]">-</span>}
                        </td>

                        {/* Running Balance */}
                        <td className="py-3 px-4 text-right font-mono font-semibold text-[var(--text)]">
                          ৳{runningBalance.toLocaleString()}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                              order.status === 'delivered'
                                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                : order.status === 'confirmed'
                                ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                                : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                            }`}
                          >
                            {order.status}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedOrder(order);
                            }}
                            className="p-1 rounded hover:bg-[var(--accent)]/10 text-[var(--text-muted)] hover:text-[var(--accent)] transition-all cursor-pointer"
                            title="View Financial & Order Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Multiple Payment Breakdown Row */}
                      {isMultiple && isExpanded && (
                        <tr className="bg-[var(--surface-sunken)]">
                          <td colSpan={11} className="px-6 py-3">
                            <div className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
                              Payment Method Breakdown for Invoice {order.invoice_number}:
                            </div>
                            <div className="flex flex-wrap gap-3">
                              {completedPayments.map((p, idx) => (
                                <div key={idx} className="bg-[var(--card)] px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs font-mono">
                                  <span className="text-[var(--text-muted)] uppercase font-sans font-bold text-[10px] mr-2">{p.method}:</span>
                                  <span className="text-emerald-500 font-bold">৳{p.amount.toLocaleString()}</span>
                                  {p.transaction_ref && <span className="text-[10px] text-[var(--text-muted)] ml-2">({p.transaction_ref})</span>}
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row Interaction Modal / Drawer (Complete Financial & Order Overview) */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-[var(--text)]">Financial & Order Overview</h3>
                  <span className="px-2 py-0.5 rounded text-xs font-mono bg-[var(--surface-sunken)] border border-[var(--border)]">
                    {selectedOrder.invoice_number}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">Order ID: {selectedOrder.id}</p>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-1 rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* Modal Content Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="bg-[var(--surface-sunken)] p-4 rounded-xl border border-[var(--border)] space-y-2">
                <div className="font-bold text-[var(--text)] uppercase tracking-wider text-[10px]">Customer Details</div>
                <div><span className="text-[var(--text-muted)]">Name:</span> <span className="font-medium text-[var(--text)]">{selectedOrder.customer_name}</span></div>
                <div><span className="text-[var(--text-muted)]">Phone:</span> <span className="font-mono text-[var(--text)]">{selectedOrder.customer_phone}</span></div>
                <div><span className="text-[var(--text-muted)]">Delivery Address:</span> <span className="text-[var(--text-secondary)]">{selectedOrder.delivery_address_text || 'N/A'}</span></div>
                <div><span className="text-[var(--text-muted)]">Previous Outstanding Due:</span> <span className="font-mono font-bold text-amber-500">৳{getCustomerPreviousDue(selectedOrder.customer_id, selectedOrder.id).toLocaleString()}</span></div>
              </div>

              <div className="bg-[var(--surface-sunken)] p-4 rounded-xl border border-[var(--border)] space-y-2">
                <div className="font-bold text-[var(--text)] uppercase tracking-wider text-[10px]">Order & Financial Summary</div>
                <div><span className="text-[var(--text-muted)]">Order Date:</span> <span className="text-[var(--text)]">{new Date(selectedOrder.transaction_date || selectedOrder.created_at).toLocaleString()}</span></div>
                <div><span className="text-[var(--text-muted)]">Order Status:</span> <span className="uppercase font-semibold text-[var(--accent)]">{selectedOrder.status}</span></div>
                <div><span className="text-[var(--text-muted)]">Fulfillment Method:</span> <span className="capitalize">{selectedOrder.fulfillment_method}</span></div>
                <div><span className="text-[var(--text-muted)]">Total Amount:</span> <span className="font-mono font-bold text-[var(--text)]">৳{selectedOrder.total.toLocaleString()}</span></div>
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-2">
              <div className="font-bold text-xs uppercase tracking-wider text-[var(--text-muted)]">Order Line Items</div>
              <div className="border border-[var(--border)] rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--surface-sunken)] text-[var(--text-muted)] text-[10px] uppercase font-bold border-b border-[var(--border)]">
                    <tr>
                      <th className="p-2.5">Product SKU / Name</th>
                      <th className="p-2.5 text-right">Qty</th>
                      <th className="p-2.5 text-right">Unit Price (৳)</th>
                      <th className="p-2.5 text-right">Total (৳)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {(selectedOrder.items || []).map((item, idx) => (
                      <tr key={idx}>
                        <td className="p-2.5 font-medium text-[var(--text)]">
                          <div>{item.product_name}</div>
                          <div className="text-[10px] text-[var(--text-muted)] font-mono">{item.sku}</div>
                        </td>
                        <td className="p-2.5 text-right font-mono">{item.quantity}</td>
                        <td className="p-2.5 text-right font-mono">৳{item.unit_price.toLocaleString()}</td>
                        <td className="p-2.5 text-right font-mono font-bold">৳{item.total_price.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Payment History */}
            <div className="space-y-2">
              <div className="font-bold text-xs uppercase tracking-wider text-[var(--text-muted)]">Payment History & Accounts</div>
              <div className="border border-[var(--border)] rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--surface-sunken)] text-[var(--text-muted)] text-[10px] uppercase font-bold border-b border-[var(--border)]">
                    <tr>
                      <th className="p-2.5">Method</th>
                      <th className="p-2.5">Account Bucket</th>
                      <th className="p-2.5 text-right">Amount (৳)</th>
                      <th className="p-2.5">Status</th>
                      <th className="p-2.5">Reference / Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {(selectedOrder.payments || []).map((p, idx) => (
                      <tr key={idx}>
                        <td className="p-2.5 font-medium uppercase">{p.method}</td>
                        <td className="p-2.5 font-mono text-[var(--text-secondary)]">{p.payment_account_id}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-emerald-500">৳{p.amount.toLocaleString()}</td>
                        <td className="p-2.5 capitalize">{p.status}</td>
                        <td className="p-2.5 text-[var(--text-muted)] font-mono">{p.transaction_ref || p.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Linked Accounting Journal Entry */}
            <div className="space-y-2">
              <div className="font-bold text-xs uppercase tracking-wider text-[var(--text-muted)]">Authoritative Accounting Journal Entries</div>
              <div className="bg-[var(--surface-sunken)] p-3 rounded-lg border border-[var(--border)] space-y-2 text-xs font-mono">
                {journalEntries
                  .filter((j) => j.reference_id === selectedOrder.id || j.description.includes(selectedOrder.invoice_number))
                  .map((j) => (
                    <div key={j.id} className="p-2 bg-[var(--card)] rounded border border-[var(--border)] space-y-1">
                      <div className="flex justify-between font-bold text-[var(--text)]">
                        <span>{j.entry_number} - {j.date}</span>
                        <span>Total: ৳{j.total_debit.toLocaleString()}</span>
                      </div>
                      <div className="text-[10px] text-[var(--text-secondary)]">{j.description}</div>
                      <div className="space-y-0.5 pt-1">
                        {j.lines.map((l, lIdx) => (
                          <div key={lIdx} className="flex justify-between text-[11px]">
                            <span>{l.account_name}</span>
                            <span>{l.debit > 0 ? `Dr. ৳${l.debit.toLocaleString()}` : `Cr. ৳${l.credit.toLocaleString()}`}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-[var(--border)]">
              <button
                onClick={() => setSelectedOrder(null)}
                className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg text-xs font-semibold hover:opacity-90 cursor-pointer"
              >
                Close Overview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Financial History Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
              <div>
                <h3 className="text-base font-bold text-[var(--text)]">Customer 360 Financial History</h3>
                <p className="text-xs text-[var(--text-muted)]">{selectedCustomer.name} &#8226; {selectedCustomer.phone}</p>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="p-1 rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="bg-[var(--surface-sunken)] p-3 rounded-lg border border-[var(--border)]">
                <div className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Total Orders</div>
                <div className="text-lg font-bold font-mono mt-0.5">{selectedCustomer.order_count}</div>
              </div>
              <div className="bg-[var(--surface-sunken)] p-3 rounded-lg border border-[var(--border)]">
                <div className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Total Spent</div>
                <div className="text-lg font-bold font-mono text-emerald-500 mt-0.5">৳{selectedCustomer.total_spent.toLocaleString()}</div>
              </div>
              <div className="bg-[var(--surface-sunken)] p-3 rounded-lg border border-[var(--border)]">
                <div className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Current Balance Due</div>
                <div className="text-lg font-bold font-mono text-amber-500 mt-0.5">৳{((selectedCustomer as any).balance || 0).toLocaleString()}</div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="font-bold text-xs uppercase tracking-wider text-[var(--text-muted)]">Order & Payment History</div>
              <div className="border border-[var(--border)] rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--surface-sunken)] text-[var(--text-muted)] text-[10px] uppercase font-bold border-b border-[var(--border)]">
                    <tr>
                      <th className="p-2.5">Invoice #</th>
                      <th className="p-2.5">Date</th>
                      <th className="p-2.5 text-right">Total (৳)</th>
                      <th className="p-2.5 text-right">Due (৳)</th>
                      <th className="p-2.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {orders
                      .filter((o) => o.customer_id === selectedCustomer.id)
                      .map((o) => {
                        const paid = (o.payments || []).filter((p) => p.status === 'completed').reduce((s, p) => s + p.amount, 0);
                        const due = Math.max(0, o.total - paid);
                        return (
                          <tr key={o.id} className="hover:bg-[var(--surface-hover)]">
                            <td className="p-2.5 font-mono font-bold">{o.invoice_number}</td>
                            <td className="p-2.5 text-[var(--text-secondary)]">{new Date(o.created_at).toLocaleDateString()}</td>
                            <td className="p-2.5 text-right font-mono font-bold">৳{o.total.toLocaleString()}</td>
                            <td className="p-2.5 text-right font-mono text-amber-500">৳{due.toLocaleString()}</td>
                            <td className="p-2.5 text-center uppercase font-semibold text-[10px]">{o.status}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-[var(--border)]">
              <button
                onClick={() => setSelectedCustomer(null)}
                className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg text-xs font-semibold hover:opacity-90 cursor-pointer"
              >
                Close Customer 360
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
