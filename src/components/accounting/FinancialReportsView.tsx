import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Scale,
  DollarSign,
  FileSpreadsheet,
  Download,
  Printer,
  Calendar,
  Building,
  CheckCircle2,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  RefreshCw,
  Search,
  Filter,
  Layers,
  Wallet,
  Landmark,
  FileCheck2,
  ArrowRightLeft,
  Eye,
  X,
  ExternalLink,
} from 'lucide-react';
import { PageHeader } from '../common/PageHeader';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import {
  ProfitLossReport,
  BalanceSheetReport,
  PaymentAccountsReportData,
  DailyBusinessControlReportData,
  FinancialCrossCheckReport,
  JournalEntry,
} from '../../types';

export const FinancialReportsView: React.FC = () => {
  const {
    pnlReport,
    balanceSheetReport,
    accounts,
    paymentAccounts,
    journalEntries,
    orders,
    expenses,
    fetchPnlReport,
    fetchBalanceSheetReport,
    fetchPaymentAccountsReport,
    fetchDailyBusinessControlReport,
    fetchFinancialCrossCheck,
    refreshAll,
    setActivePath,
  } = useApp();
  const { can } = useAuth();

  const [activeReportTab, setActiveReportTab] = useState<
    'pnl' | 'balance_sheet' | 'trial_balance' | 'payment_accounts' | 'daily_control' | 'cross_check'
  >('pnl');

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Payment Accounts Report State
  const [paymentReportData, setPaymentReportData] = useState<PaymentAccountsReportData | null>(null);
  const [selectedPmtAccId, setSelectedPmtAccId] = useState('all');
  const [selectedPmtAccType, setSelectedPmtAccType] = useState('all');
  const [selectedTxType, setSelectedTxType] = useState('all');
  const [pmtSearch, setPmtSearch] = useState('');

  // Daily Business Control Report State
  const [dailyControlData, setDailyControlData] = useState<DailyBusinessControlReportData | null>(null);
  const [dailyControlStartDate, setDailyControlStartDate] = useState('');
  const [dailyControlEndDate, setDailyControlEndDate] = useState('');

  // Financial Cross-Check State
  const [crossCheckData, setCrossCheckData] = useState<FinancialCrossCheckReport | null>(null);

  // Drill-down Modal State
  const [drilldownModal, setDrilldownModal] = useState<{
    open: boolean;
    title: string;
    type: 'journal' | 'order' | 'expense' | 'day_orders';
    data: any;
  }>({
    open: false,
    title: '',
    type: 'journal',
    data: null,
  });

  // Initial load
  useEffect(() => {
    loadAllReports();
  }, []);

  const loadAllReports = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        fetchPnlReport(startDate, endDate).catch((e) => console.warn('P&L load error:', e)),
        fetchBalanceSheetReport().catch((e) => console.warn('Balance Sheet load error:', e)),
        loadPaymentReport(),
        loadDailyControlReport(),
        loadCrossCheckReport(),
      ]);
    } catch (e) {
      console.warn('Reports load error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPaymentReport = async () => {
    try {
      const data = await fetchPaymentAccountsReport({
        account_id: selectedPmtAccId !== 'all' ? selectedPmtAccId : undefined,
        account_type: selectedPmtAccType !== 'all' ? selectedPmtAccType : undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        transaction_type: selectedTxType !== 'all' ? selectedTxType : undefined,
        search: pmtSearch || undefined,
      });
      setPaymentReportData(data);
    } catch (e) {
      console.warn('Payment report load error:', e);
    }
  };

  const loadDailyControlReport = async () => {
    try {
      const data = await fetchDailyBusinessControlReport({
        start_date: dailyControlStartDate || undefined,
        end_date: dailyControlEndDate || undefined,
      });
      setDailyControlData(data);
    } catch (e) {
      console.warn('Daily control report load error:', e);
    }
  };

  const loadCrossCheckReport = async () => {
    try {
      const data = await fetchFinancialCrossCheck();
      setCrossCheckData(data);
    } catch (e) {
      console.warn('Cross check report load error:', e);
    }
  };

  const handleFilterPnl = async () => {
    setIsLoading(true);
    try {
      await fetchPnlReport(startDate, endDate);
      await fetchBalanceSheetReport();
    } catch (e) {
      console.warn('Filter error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrilldownJournal = (jeId: string) => {
    const entry = journalEntries.find((j) => j.id === jeId || j.entry_number === jeId);
    if (entry) {
      setDrilldownModal({
        open: true,
        title: `Journal Entry: ${entry.entry_number}`,
        type: 'journal',
        data: entry,
      });
    }
  };

  const handleDrilldownOrder = (orderIdOrInvoice: string) => {
    const order = orders.find((o) => o.id === orderIdOrInvoice || o.invoice_number === orderIdOrInvoice);
    if (order) {
      setDrilldownModal({
        open: true,
        title: `Order Details: ${order.invoice_number}`,
        type: 'order',
        data: order,
      });
    }
  };

  const handleDrilldownExpense = (expenseIdOrNum: string) => {
    const exp = expenses.find((e) => e.id === expenseIdOrNum || e.expense_number === expenseIdOrNum);
    if (exp) {
      setDrilldownModal({
        open: true,
        title: `Expense Record: ${exp.expense_number}`,
        type: 'expense',
        data: exp,
      });
    }
  };

  const handleDrilldownDayOrders = (date: string, invoiceNums?: string[]) => {
    const dayOrders = orders.filter(
      (o) =>
        (invoiceNums && invoiceNums.includes(o.invoice_number)) ||
        o.business_date === date ||
        o.created_at.slice(0, 10) === date
    );
    setDrilldownModal({
      open: true,
      title: `Day Sales & Invoices: ${date} (${dayOrders.length} orders)`,
      type: 'day_orders',
      data: { date, orders: dayOrders },
    });
  };

  const safeAccounts = Array.isArray(accounts) ? accounts : [];

  // Trial Balance calculation from Accounts
  const trialBalanceAccounts = safeAccounts.map((acc) => {
    const isDebit = acc.type === 'asset' || acc.type === 'expense';
    const debit = isDebit ? Math.max(0, acc.balance) : 0;
    const credit = !isDebit ? Math.max(0, acc.balance) : 0;
    return {
      ...acc,
      debit,
      credit,
    };
  });

  const totalTbDebit = trialBalanceAccounts.reduce((s, a) => s + a.debit, 0);
  const totalTbCredit = trialBalanceAccounts.reduce((s, a) => s + a.credit, 0);
  const isTbBalanced = Math.abs(totalTbDebit - totalTbCredit) < 1;

  return (
    <div className="space-y-6" id="financial-reports-view">
      {/* Top Header */}
      <PageHeader
        eyebrow="Finance & Accounting"
        title="Financial & Control Reports"
        desc="Authoritative general ledger statements, payment accounts audit, daily control, and balance cross-checks"
      />

      {/* Tabs */}
      <div className="flex border-b border-[var(--border)] gap-2 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveReportTab('pnl')}
          className={`px-3 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeReportTab === 'pnl'
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          Profit & Loss Statement
        </button>

        <button
          onClick={() => setActiveReportTab('balance_sheet')}
          className={`px-3 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeReportTab === 'balance_sheet'
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          <Scale className="w-3.5 h-3.5" />
          Balance Sheet
        </button>

        <button
          onClick={() => setActiveReportTab('trial_balance')}
          className={`px-3 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeReportTab === 'trial_balance'
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          Trial Balance
        </button>

        <button
          onClick={() => {
            setActiveReportTab('payment_accounts');
            loadPaymentReport();
          }}
          className={`px-3 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeReportTab === 'payment_accounts'
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          <Wallet className="w-3.5 h-3.5" />
          Payment Accounts Report
        </button>

        <button
          onClick={() => {
            setActiveReportTab('daily_control');
            loadDailyControlReport();
          }}
          className={`px-3 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeReportTab === 'daily_control'
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          Daily Business Control
        </button>

        <button
          onClick={() => {
            setActiveReportTab('cross_check');
            loadCrossCheckReport();
          }}
          className={`px-3 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeReportTab === 'cross_check'
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          <FileCheck2 className="w-3.5 h-3.5" />
          Financial Cross-Check
        </button>
      </div>

      {/* TAB 1: PROFIT & LOSS STATEMENT */}
      {activeReportTab === 'pnl' && pnlReport && (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-xl text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[var(--text)]">Period Range:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2.5 py-1 bg-[var(--surface)] border border-[var(--border)] rounded text-xs text-[var(--text)]"
              />
              <span className="text-[var(--text-muted)]">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2.5 py-1 bg-[var(--surface)] border border-[var(--border)] rounded text-xs text-[var(--text)]"
              />
              <button
                onClick={handleFilterPnl}
                disabled={isLoading}
                className="px-3 py-1 bg-[var(--accent)] text-[var(--accent-contrast)] font-bold rounded hover:opacity-90 transition-all cursor-pointer flex items-center gap-1"
              >
                <Filter className="w-3 h-3" />
                Apply Filter
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="px-2.5 py-1 bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] hover:bg-[var(--surface-hover)] font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Statement
              </button>
            </div>
          </div>

          {/* Summary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-[var(--text-muted)] mb-2">
                <span className="text-xs font-medium">Net Sales Revenue</span>
                <DollarSign className="w-4 h-4 text-[var(--status-green)]" />
              </div>
              <div className="text-2xl font-bold font-mono text-[var(--text)]">
                ৳{pnlReport.revenue.net_revenue.toLocaleString()}
              </div>
              <div className="text-[11px] text-[var(--text-muted)] mt-1">
                Gross: ৳{(pnlReport.revenue.product_sales + pnlReport.revenue.delivery_income).toLocaleString()} • Returns: ৳{pnlReport.revenue.sales_returns.toLocaleString()}
              </div>
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-[var(--text-muted)] mb-2">
                <span className="text-xs font-medium">Gross Profit</span>
                <TrendingUp className="w-4 h-4 text-[var(--status-teal)]" />
              </div>
              <div className="text-2xl font-bold font-mono text-[var(--status-teal)]">
                ৳{pnlReport.gross_profit.toLocaleString()}
              </div>
              <div className="text-[11px] text-[var(--text-muted)] mt-1">
                Gross Margin: <span className="font-bold">{pnlReport.gross_margin_percent.toFixed(1)}%</span>
              </div>
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-[var(--text-muted)] mb-2">
                <span className="text-xs font-medium">Total Operating Expenses</span>
                <ArrowDownRight className="w-4 h-4 text-[var(--status-amber)]" />
              </div>
              <div className="text-2xl font-bold font-mono text-[var(--status-amber)]">
                ৳{pnlReport.operating_expenses.total_operating_expenses.toLocaleString()}
              </div>
              <div className="text-[11px] text-[var(--text-muted)] mt-1">Overheads, payroll & courier freight</div>
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-[var(--text-muted)] mb-2">
                <span className="text-xs font-medium">Net Operating Profit</span>
                <CheckCircle2 className="w-4 h-4 text-[var(--accent)]" />
              </div>
              <div
                className={`text-2xl font-black font-mono ${
                  pnlReport.net_operating_profit >= 0 ? 'text-[var(--status-green)]' : 'text-[var(--status-red)]'
                }`}
              >
                ৳{pnlReport.net_operating_profit.toLocaleString()}
              </div>
              <div className="text-[11px] text-[var(--text-muted)] mt-1">
                Net Margin: <span className="font-bold">{pnlReport.net_margin_percent.toFixed(1)}%</span>
              </div>
            </div>
          </div>

          {/* Statement Table */}
          <div className="dense-table-container">
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-sunken)]">
              <div>
                <h3 className="text-sm font-bold text-[var(--text)]">Statement of Comprehensive Income (P&L)</h3>
                <p className="text-xs text-[var(--text-muted)]">Period: {pnlReport.period}</p>
              </div>
            </div>

            <div className="p-6 space-y-6 text-xs font-sans">
              {/* REVENUE SECTION */}
              <div className="space-y-2">
                <div className="flex justify-between items-center py-2 font-bold text-[var(--text)] border-b border-[var(--border)] uppercase text-[11px]">
                  <span>1. Revenue & Inflows</span>
                  <span>Amount (BDT)</span>
                </div>
                <div className="flex justify-between py-1 text-[var(--text-muted)]">
                  <span>Product Perfume Sales (Account 4010)</span>
                  <span className="font-mono text-[var(--text)] font-semibold">
                    ৳{pnlReport.revenue.product_sales.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between py-1 text-[var(--text-muted)]">
                  <span>Customer Delivery Fee Income (Account 4020)</span>
                  <span className="font-mono text-[var(--text)] font-semibold">
                    ৳{pnlReport.revenue.delivery_income.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between py-1 text-[var(--status-red)]">
                  <span>Less: Sales Returns & Customer Refunds (Account 4030)</span>
                  <span className="font-mono font-semibold">-৳{pnlReport.revenue.sales_returns.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-2 font-bold text-[var(--text)] border-t border-dashed border-[var(--border)]">
                  <span>Net Sales Revenue</span>
                  <span className="font-mono font-bold text-sm">
                    ৳{pnlReport.revenue.net_revenue.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* COGS SECTION */}
              <div className="space-y-2">
                <div className="flex justify-between items-center py-2 font-bold text-[var(--text)] border-b border-[var(--border)] uppercase text-[11px]">
                  <span>2. Cost of Goods Sold (COGS)</span>
                  <span>Amount (BDT)</span>
                </div>
                <div className="flex justify-between py-1 text-[var(--text-muted)]">
                  <span>Weighted Average Landed Inventory Cost of Sold Units (Account 5010)</span>
                  <span className="font-mono text-[var(--status-red)] font-semibold">
                    -৳{pnlReport.cogs.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between py-2 font-black text-[var(--status-teal)] border-t border-[var(--border)] bg-[var(--surface-sunken)] px-3 rounded-lg text-sm">
                  <span>Gross Operating Profit (Gross Margin {pnlReport.gross_margin_percent.toFixed(1)}%)</span>
                  <span className="font-mono font-black">৳{pnlReport.gross_profit.toLocaleString()}</span>
                </div>
              </div>

              {/* OPERATING EXPENSES SECTION */}
              <div className="space-y-2">
                <div className="flex justify-between items-center py-2 font-bold text-[var(--text)] border-b border-[var(--border)] uppercase text-[11px]">
                  <span>3. Operating Expenses</span>
                  <span>Amount (BDT)</span>
                </div>
                <div className="flex justify-between py-1 text-[var(--text-muted)]">
                  <span>Banani Showroom & Office Rent (Account 6010)</span>
                  <span className="font-mono text-[var(--text)]">৳{pnlReport.operating_expenses.rent.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1 text-[var(--text-muted)]">
                  <span>Employee Salaries & Compensation (Account 6020)</span>
                  <span className="font-mono text-[var(--text)]">৳{pnlReport.operating_expenses.salaries.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1 text-[var(--text-muted)]">
                  <span>Steadfast Courier Freight & RTO Return Fees (Account 6030)</span>
                  <span className="font-mono text-[var(--text)]">
                    ৳{pnlReport.operating_expenses.courier_freight_rto.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between py-1 text-[var(--text-muted)]">
                  <span>Showroom Tester & Marketing Bottles (Account 6040)</span>
                  <span className="font-mono text-[var(--text)]">
                    ৳{pnlReport.operating_expenses.showroom_testers.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between py-1 text-[var(--text-muted)]">
                  <span>Damaged & Broken Stock Loss (Account 6050)</span>
                  <span className="font-mono text-[var(--text)]">
                    ৳{pnlReport.operating_expenses.damaged_stock_loss.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between py-1 text-[var(--text-muted)]">
                  <span>Electricity, Fiber Internet & Utilities (Account 6060)</span>
                  <span className="font-mono text-[var(--text)]">
                    ৳{pnlReport.operating_expenses.utilities_office.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between py-1 text-[var(--text-muted)]">
                  <span>Meta Ads & Marketing (Account 6070)</span>
                  <span className="font-mono text-[var(--text)]">
                    ৳{pnlReport.operating_expenses.marketing_ads.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between py-1 text-[var(--text-muted)]">
                  <span>Packaging Boxes, Bubble Wrap & Tape (Account 6080)</span>
                  <span className="font-mono text-[var(--text)]">
                    ৳{pnlReport.operating_expenses.packing_supplies.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between py-1 text-[var(--text-muted)]">
                  <span>Daily Cash Till Shortage Loss (Account 6100)</span>
                  <span className="font-mono text-[var(--text)]">
                    ৳{pnlReport.operating_expenses.cash_shortage.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between py-2 font-bold text-[var(--status-amber)] border-t border-dashed border-[var(--border)]">
                  <span>Total Operating Expenses</span>
                  <span className="font-mono font-bold">
                    ৳{pnlReport.operating_expenses.total_operating_expenses.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* NET OPERATING PROFIT */}
              <div className="flex justify-between items-center py-4 px-4 bg-[var(--accent)] text-[var(--accent-contrast)] rounded-xl font-bold text-base">
                <div>
                  <span>Net Operating Profit (EBITDA)</span>
                  <span className="block text-xs font-normal opacity-80">
                    Net Margin: {pnlReport.net_margin_percent.toFixed(1)}% of Revenue
                  </span>
                </div>
                <span className="font-mono text-xl font-black">
                  ৳{pnlReport.net_operating_profit.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: BALANCE SHEET */}
      {activeReportTab === 'balance_sheet' && balanceSheetReport && (
        <div className="space-y-6">
          <div className="dense-table-container">
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-sunken)]">
              <div>
                <h3 className="text-sm font-bold text-[var(--text)]">Balance Sheet (Statement of Financial Position)</h3>
                <p className="text-xs text-[var(--text-muted)]">As of {balanceSheetReport.as_of_date}</p>
              </div>

              <div className="flex items-center gap-1.5">
                <span
                  className={`px-2.5 py-1 rounded text-xs font-bold ${
                    balanceSheetReport.is_balanced
                      ? 'bg-[color-mix(in_srgb,var(--status-green)_10%,transparent)] text-[var(--status-green)]'
                      : 'bg-[color-mix(in_srgb,var(--status-red)_10%,transparent)] text-[var(--status-red)]'
                  }`}
                >
                  {balanceSheetReport.is_balanced
                    ? 'Balanced (Assets = Liabilities + Equity)'
                    : 'Discrepancy Detected'}
                </span>
              </div>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 text-xs font-sans">
              {/* ASSETS COLUMN */}
              <div className="space-y-4">
                <div className="flex justify-between items-center py-2 font-bold text-[var(--text)] border-b border-[var(--border)] uppercase text-[11px]">
                  <span>Assets</span>
                  <span>Amount (BDT)</span>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between py-1 text-[var(--text-muted)]">
                    <span>Cash in Hand (Showroom Till)</span>
                    <span className="font-mono text-[var(--text)] font-semibold">
                      ৳{balanceSheetReport.assets.cash_in_hand.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 text-[var(--text-muted)]">
                    <span>City Bank Operating Account</span>
                    <span className="font-mono text-[var(--text)] font-semibold">
                      ৳{balanceSheetReport.assets.bank_deposits.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 text-[var(--text-muted)]">
                    <span>MFS Wallets (bKash & Nagad Merchant)</span>
                    <span className="font-mono text-[var(--text)] font-semibold">
                      ৳{balanceSheetReport.assets.mfs_wallets.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 text-[var(--text-muted)]">
                    <span>Courier Receivable (Steadfast Clearing)</span>
                    <span className="font-mono text-[var(--text)] font-semibold">
                      ৳{balanceSheetReport.assets.courier_receivable.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 text-[var(--text-muted)]">
                    <span>Perfume Inventory Valuation (On-Hand Stock)</span>
                    <span className="font-mono text-[var(--text)] font-semibold">
                      ৳{balanceSheetReport.assets.inventory_valuation.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center py-3 px-3 bg-[var(--surface-sunken)] rounded-lg font-black text-sm text-[var(--accent)] border border-[var(--border)]">
                  <span>Total Assets</span>
                  <span className="font-mono">৳{balanceSheetReport.assets.total_assets.toLocaleString()}</span>
                </div>
              </div>

              {/* LIABILITIES & EQUITY COLUMN */}
              <div className="space-y-4">
                <div className="flex justify-between items-center py-2 font-bold text-[var(--text)] border-b border-[var(--border)] uppercase text-[11px]">
                  <span>Liabilities & Equity</span>
                  <span>Amount (BDT)</span>
                </div>

                <div className="space-y-2">
                  <p className="font-bold text-[var(--text)] uppercase text-[10px] tracking-wider text-[var(--text-muted)]">
                    Liabilities
                  </p>
                  <div className="flex justify-between py-1 text-[var(--text-muted)]">
                    <span>Dubai Supplier Payables</span>
                    <span className="font-mono text-[var(--status-red)] font-semibold">
                      ৳{balanceSheetReport.liabilities.supplier_payables.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 font-bold text-[var(--text)] border-t border-dashed border-[var(--border)]">
                    <span>Total Liabilities</span>
                    <span className="font-mono">
                      ৳{balanceSheetReport.liabilities.total_liabilities.toLocaleString()}
                    </span>
                  </div>

                  <p className="font-bold text-[var(--text)] uppercase text-[10px] tracking-wider text-[var(--text-muted)] pt-2">
                    Owner Equity
                  </p>
                  <div className="flex justify-between py-1 text-[var(--text-muted)]">
                    <span>Owner Capital & Opening Equity</span>
                    <span className="font-mono text-[var(--text)] font-semibold">
                      ৳{balanceSheetReport.equity.owner_capital.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 text-[var(--text-muted)]">
                    <span>Current Retained Earnings (YTD Net Profit)</span>
                    <span className="font-mono text-[var(--status-green)] font-semibold">
                      ৳{balanceSheetReport.equity.current_retained_earnings.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 font-bold text-[var(--text)] border-t border-dashed border-[var(--border)]">
                    <span>Total Equity</span>
                    <span className="font-mono">৳{balanceSheetReport.equity.total_equity.toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center py-3 px-3 bg-[var(--surface-sunken)] rounded-lg font-black text-sm text-[var(--accent)] border border-[var(--border)]">
                  <span>Total Liabilities & Equity</span>
                  <span className="font-mono">
                    ৳{(balanceSheetReport.liabilities.total_liabilities + balanceSheetReport.equity.total_equity).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: TRIAL BALANCE */}
      {activeReportTab === 'trial_balance' && (
        <div className="space-y-4">
          <div className="dense-table-container">
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-sunken)]">
              <div>
                <h3 className="text-sm font-bold text-[var(--text)]">Chart of Accounts Trial Balance</h3>
                <p className="text-xs text-[var(--text-muted)]">Summary of debit and credit balances for all accounts</p>
              </div>

              <span
                className={`px-2.5 py-1 rounded text-xs font-bold ${
                  isTbBalanced
                    ? 'bg-[color-mix(in_srgb,var(--status-green)_10%,transparent)] text-[var(--status-green)]'
                    : 'bg-[color-mix(in_srgb,var(--status-red)_10%,transparent)] text-[var(--status-red)]'
                }`}
              >
                {isTbBalanced ? 'Balanced Ledger' : 'Discrepancy Detected'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="dense-table">
                <thead className="bg-[var(--surface-sunken)] border-b border-[var(--border)] text-[var(--text-muted)] uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="py-2.5 px-4 text-left">Account Code</th>
                    <th className="py-2.5 px-4 text-left">Account Name</th>
                    <th className="py-2.5 px-4 text-left">Type</th>
                    <th className="py-2.5 px-4 text-right">Debit Balance (৳)</th>
                    <th className="py-2.5 px-4 text-right">Credit Balance (৳)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] font-mono text-xs">
                  {trialBalanceAccounts.map((acc) => (
                    <tr key={acc.id} className="hover:bg-[var(--surface-hover)]">
                      <td className="py-2 px-4 font-bold text-[var(--accent)]">{acc.code}</td>
                      <td className="py-2 px-4 font-sans font-semibold text-[var(--text)]">{acc.name}</td>
                      <td className="py-2 px-4 font-sans">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[var(--surface-sunken)] border border-[var(--border)]">
                          {acc.type}
                        </span>
                      </td>
                      <td className="py-2 px-4 text-right font-bold text-[var(--text)]">
                        {acc.debit > 0 ? `৳${acc.debit.toLocaleString()}` : '—'}
                      </td>
                      <td className="py-2 px-4 text-right font-bold text-[var(--text)]">
                        {acc.credit > 0 ? `৳${acc.credit.toLocaleString()}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-[var(--surface-sunken)] font-black text-xs border-t-2 border-[var(--border)]">
                  <tr>
                    <td colSpan={3} className="py-3 px-4 uppercase">
                      Total Trial Balance
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-[var(--status-green)] text-sm">
                      ৳{totalTbDebit.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-[var(--status-green)] text-sm">
                      ৳{totalTbCredit.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: PAYMENT ACCOUNTS REPORT */}
      {activeReportTab === 'payment_accounts' && (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="p-3.5 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-xl space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1">Account</label>
                <select
                  value={selectedPmtAccId}
                  onChange={(e) => {
                    setSelectedPmtAccId(e.target.value);
                  }}
                  className="w-full px-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded text-xs text-[var(--text)] font-medium"
                >
                  <option value="all">All Payment Accounts</option>
                  {paymentAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.account_name} ({acc.account_type.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1">Account Type</label>
                <select
                  value={selectedPmtAccType}
                  onChange={(e) => setSelectedPmtAccType(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded text-xs text-[var(--text)] font-medium"
                >
                  <option value="all">All Types</option>
                  <option value="cash">Cash / Petty Cash</option>
                  <option value="bank">Bank Accounts</option>
                  <option value="mfs">MFS Wallets (bKash/Nagad)</option>
                  <option value="gateway">Payment Gateways</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1">Date Range</label>
                <div className="flex items-center gap-1">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-1/2 px-2 py-1 bg-[var(--surface)] border border-[var(--border)] rounded text-[11px] text-[var(--text)]"
                  />
                  <span className="text-[var(--text-muted)]">-</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-1/2 px-2 py-1 bg-[var(--surface)] border border-[var(--border)] rounded text-[11px] text-[var(--text)]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1">Transaction Type</label>
                <select
                  value={selectedTxType}
                  onChange={(e) => setSelectedTxType(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded text-xs text-[var(--text)] font-medium"
                >
                  <option value="all">All Transaction Types</option>
                  <option value="pos_sale">Sales Collection</option>
                  <option value="expense">Operating Expense</option>
                  <option value="fund_transfer_in">Fund Transfer In</option>
                  <option value="fund_transfer_out">Fund Transfer Out</option>
                  <option value="deposit">Deposit</option>
                  <option value="withdrawal">Withdrawal</option>
                  <option value="manual_adjustment">Manual Adjustment</option>
                  <option value="courier_settlement">Courier Settlement</option>
                  <option value="customer_return">Customer Refund</option>
                  <option value="payroll">Salary Disbursement</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1">Search & Filter</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={pmtSearch}
                    onChange={(e) => setPmtSearch(e.target.value)}
                    placeholder="Search ref/note..."
                    className="flex-1 px-2 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded text-xs text-[var(--text)]"
                  />
                  <button
                    onClick={loadPaymentReport}
                    className="px-2.5 py-1.5 bg-[var(--accent)] text-[var(--accent-contrast)] font-bold rounded text-xs cursor-pointer hover:opacity-90"
                  >
                    <Search className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* KPI Summary Cards */}
          {paymentReportData && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 shadow-xs">
                <span className="text-[11px] font-medium text-[var(--text-muted)] block mb-1">Total Accounts</span>
                <span className="text-xl font-bold text-[var(--text)] font-mono">
                  {paymentReportData.summary.total_accounts}
                </span>
              </div>
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 shadow-xs">
                <span className="text-[11px] font-medium text-[var(--text-muted)] block mb-1">Opening Balance</span>
                <span className="text-xl font-bold font-mono text-[var(--text)]">
                  ৳{paymentReportData.summary.opening_balance.toLocaleString()}
                </span>
              </div>
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 shadow-xs">
                <span className="text-[11px] font-medium text-[var(--text-muted)] block mb-1">Total Money In</span>
                <span className="text-xl font-bold font-mono text-[var(--status-green)]">
                  +৳{paymentReportData.summary.total_money_in.toLocaleString()}
                </span>
              </div>
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 shadow-xs">
                <span className="text-[11px] font-medium text-[var(--text-muted)] block mb-1">Total Money Out</span>
                <span className="text-xl font-bold font-mono text-[var(--status-red)]">
                  -৳{paymentReportData.summary.total_money_out.toLocaleString()}
                </span>
              </div>
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 shadow-xs">
                <span className="text-[11px] font-medium text-[var(--text-muted)] block mb-1">Closing Balance</span>
                <span className="text-xl font-black font-mono text-[var(--accent)]">
                  ৳{paymentReportData.summary.closing_balance.toLocaleString()}
                </span>
              </div>
            </div>
          )}

          {/* Accounts Summary Breakdown */}
          {paymentReportData && paymentReportData.accounts_summary.length > 0 && (
            <div className="dense-table-container">
              <div className="p-3 border-b border-[var(--border)] bg-[var(--surface-sunken)] flex items-center justify-between">
                <h4 className="text-xs font-bold text-[var(--text)] uppercase tracking-wider">Account Balances Summary</h4>
                <span className="text-[11px] text-[var(--text-muted)] font-mono">
                  {paymentReportData.accounts_summary.length} Accounts
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="dense-table">
                  <thead className="bg-[var(--surface-sunken)] border-b border-[var(--border)] text-[var(--text-muted)] uppercase text-[11px]">
                    <tr>
                      <th className="py-2 px-3 text-left">Account Name</th>
                      <th className="py-2 px-3 text-left">Type</th>
                      <th className="py-2 px-3 text-left">Number / Ref</th>
                      <th className="py-2 px-3 text-right">Opening (৳)</th>
                      <th className="py-2 px-3 text-right">Money In (৳)</th>
                      <th className="py-2 px-3 text-right">Money Out (৳)</th>
                      <th className="py-2 px-3 text-right">Closing (৳)</th>
                      <th className="py-2 px-3 text-center">Txns</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)] font-mono text-xs">
                    {paymentReportData.accounts_summary.map((acc) => (
                      <tr key={acc.account_id} className="hover:bg-[var(--surface-hover)]">
                        <td className="py-2 px-3 font-sans font-bold text-[var(--text)]">{acc.account_name}</td>
                        <td className="py-2 px-3 font-sans">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-[var(--surface-sunken)] border border-[var(--border)]">
                            {acc.account_type}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-[var(--text-muted)] text-[11px]">{acc.account_number}</td>
                        <td className="py-2 px-3 text-right">৳{acc.opening_balance.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right text-[var(--status-green)] font-semibold">
                          +৳{acc.total_money_in.toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right text-[var(--status-red)] font-semibold">
                          -৳{acc.total_money_out.toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right font-black text-[var(--text)]">
                          ৳{acc.closing_balance.toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-center text-[var(--text-muted)]">{acc.transaction_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Transactions Statement with Drill-down */}
          {paymentReportData && (
            <div className="dense-table-container">
              <div className="p-3 border-b border-[var(--border)] bg-[var(--surface-sunken)] flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-[var(--text)] uppercase tracking-wider">
                    Transaction Audit Ledger
                  </h4>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Showing {paymentReportData.transactions.length} filtered transactions with double-entry drill-down
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="dense-table">
                  <thead className="bg-[var(--surface-sunken)] border-b border-[var(--border)] text-[var(--text-muted)] uppercase text-[11px]">
                    <tr>
                      <th className="py-2 px-3 text-left">Date</th>
                      <th className="py-2 px-3 text-left">Account</th>
                      <th className="py-2 px-3 text-left">Type</th>
                      <th className="py-2 px-3 text-left">Reference & Description</th>
                      <th className="py-2 px-3 text-right">Money In (৳)</th>
                      <th className="py-2 px-3 text-right">Money Out (৳)</th>
                      <th className="py-2 px-3 text-right">Running (৳)</th>
                      <th className="py-2 px-3 text-left">User</th>
                      <th className="py-2 px-3 text-center">Drill-down</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)] font-mono text-xs">
                    {paymentReportData.transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-[var(--surface-hover)]">
                        <td className="py-2 px-3 text-[var(--text-muted)] text-[11px] whitespace-nowrap">{tx.date}</td>
                        <td className="py-2 px-3 font-sans font-semibold text-[var(--text)]">{tx.payment_account_name}</td>
                        <td className="py-2 px-3 font-sans">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-[var(--surface-sunken)] border border-[var(--border)]">
                            {tx.transaction_type.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-sans">
                          <div className="font-semibold text-[var(--text)]">{tx.reference}</div>
                          <div className="text-[11px] text-[var(--text-muted)] truncate max-w-xs">{tx.description}</div>
                        </td>
                        <td className="py-2 px-3 text-right text-[var(--status-green)] font-semibold">
                          {tx.money_in > 0 ? `+৳${tx.money_in.toLocaleString()}` : '—'}
                        </td>
                        <td className="py-2 px-3 text-right text-[var(--status-red)] font-semibold">
                          {tx.money_out > 0 ? `-৳${tx.money_out.toLocaleString()}` : '—'}
                        </td>
                        <td className="py-2 px-3 text-right font-black text-[var(--text)]">
                          ৳{tx.running_balance.toLocaleString()}
                        </td>
                        <td className="py-2 px-3 font-sans text-[var(--text-muted)] text-[11px]">{tx.created_by_name}</td>
                        <td className="py-2 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {tx.journal_entry_id && (
                              <button
                                onClick={() => handleDrilldownJournal(tx.journal_entry_id!)}
                                title="View Double-Entry Journal Entry"
                                className="p-1 text-[var(--accent)] hover:bg-[var(--surface-sunken)] rounded cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {tx.source_record_type === 'order' && tx.source_record_id && (
                              <button
                                onClick={() => handleDrilldownOrder(tx.source_record_id!)}
                                title="View Customer Order"
                                className="p-1 text-[var(--status-teal)] hover:bg-[var(--surface-sunken)] rounded cursor-pointer"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {tx.source_record_type === 'expense' && tx.source_record_id && (
                              <button
                                onClick={() => handleDrilldownExpense(tx.source_record_id!)}
                                title="View Expense Voucher"
                                className="p-1 text-[var(--status-amber)] hover:bg-[var(--surface-sunken)] rounded cursor-pointer"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {paymentReportData.transactions.length === 0 && (
                      <tr>
                        <td colSpan={9} className="py-6 text-center text-[var(--text-muted)] font-sans">
                          No transactions found for the selected filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: DAILY BUSINESS CONTROL REPORT */}
      {activeReportTab === 'daily_control' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-xl text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[var(--text)]">Business Date Filter:</span>
              <input
                type="date"
                value={dailyControlStartDate}
                onChange={(e) => setDailyControlStartDate(e.target.value)}
                className="px-2.5 py-1 bg-[var(--surface)] border border-[var(--border)] rounded text-xs text-[var(--text)]"
              />
              <span className="text-[var(--text-muted)]">to</span>
              <input
                type="date"
                value={dailyControlEndDate}
                onChange={(e) => setDailyControlEndDate(e.target.value)}
                className="px-2.5 py-1 bg-[var(--surface)] border border-[var(--border)] rounded text-xs text-[var(--text)]"
              />
              <button
                onClick={loadDailyControlReport}
                className="px-3 py-1 bg-[var(--accent)] text-[var(--accent-contrast)] font-bold rounded hover:opacity-90 transition-all cursor-pointer flex items-center gap-1"
              >
                <Filter className="w-3 h-3" />
                Filter
              </button>
            </div>
            <button
              onClick={() => window.print()}
              className="px-2.5 py-1 bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] hover:bg-[var(--surface-hover)] font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Control Sheet
            </button>
          </div>

          {/* Daily Business Control Table */}
          {dailyControlData && (
            <div className="dense-table-container">
              <div className="p-3 border-b border-[var(--border)] bg-[var(--surface-sunken)] flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[var(--text)]">Daily Operational & Financial Control Matrix</h3>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Comprehensive daily reconciliation across orders, delivery status, MFS/Bank/Cash inflows, COGS, and net cash balance
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="dense-table text-xs">
                  <thead className="bg-[var(--surface-sunken)] border-b border-[var(--border)] text-[var(--text-muted)] uppercase text-[10px] tracking-tight font-semibold">
                    <tr>
                      <th className="py-2.5 px-2.5 text-left">Date</th>
                      <th className="py-2.5 px-2 text-center">Orders</th>
                      <th className="py-2.5 px-2 text-right">Order Val (৳)</th>
                      <th className="py-2.5 px-2 text-center">Items</th>
                      <th className="py-2.5 px-2 text-center">Draft/Pend</th>
                      <th className="py-2.5 px-2 text-center">In Transit</th>
                      <th className="py-2.5 px-2 text-center">Delivered</th>
                      <th className="py-2.5 px-2 text-center">Returns</th>
                      <th className="py-2.5 px-2 text-right">Cash (৳)</th>
                      <th className="py-2.5 px-2 text-right">Bank (৳)</th>
                      <th className="py-2.5 px-2 text-right">bKash (৳)</th>
                      <th className="py-2.5 px-2 text-right">Nagad (৳)</th>
                      <th className="py-2.5 px-2 text-right text-[var(--status-green)]">Total Col (৳)</th>
                      <th className="py-2.5 px-2 text-right text-[var(--status-red)]">COGS (৳)</th>
                      <th className="py-2.5 px-2 text-right text-[var(--status-amber)]">Expense (৳)</th>
                      <th className="py-2.5 px-2.5 text-right font-black text-[var(--accent)]">Balance (৳)</th>
                      <th className="py-2.5 px-2 text-center">Drill</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)] font-mono text-[11px]">
                    {dailyControlData.rows.map((row) => (
                      <tr key={row.date} className="hover:bg-[var(--surface-hover)]">
                        <td className="py-2 px-2.5 font-sans font-bold text-[var(--text)] whitespace-nowrap">
                          {row.date}
                        </td>
                        <td className="py-2 px-2 text-center font-bold text-[var(--text)]">{row.orders_count}</td>
                        <td className="py-2 px-2 text-right">৳{row.order_value.toLocaleString()}</td>
                        <td className="py-2 px-2 text-center">{row.order_quantity}</td>
                        <td className="py-2 px-2 text-center text-[var(--status-amber)]">{row.draft_pending}</td>
                        <td className="py-2 px-2 text-center text-[var(--status-teal)]">{row.delivery_pending}</td>
                        <td className="py-2 px-2 text-center text-[var(--status-green)] font-bold">{row.delivery_done}</td>
                        <td className="py-2 px-2 text-center text-[var(--status-red)]">
                          {row.return_quantity > 0 ? `${row.return_quantity} (৳${row.return_amount})` : '0'}
                        </td>
                        <td className="py-2 px-2 text-right">{row.cash_collection > 0 ? `৳${row.cash_collection.toLocaleString()}` : '—'}</td>
                        <td className="py-2 px-2 text-right">{row.bank_transfer > 0 ? `৳${row.bank_transfer.toLocaleString()}` : '—'}</td>
                        <td className="py-2 px-2 text-right">
                          {row.bkash_personal + row.bkash_merchant > 0
                            ? `৳${(row.bkash_personal + row.bkash_merchant).toLocaleString()}`
                            : '—'}
                        </td>
                        <td className="py-2 px-2 text-right">{row.nagad > 0 ? `৳${row.nagad.toLocaleString()}` : '—'}</td>
                        <td className="py-2 px-2 text-right font-bold text-[var(--status-green)]">
                          ৳{row.total_collection.toLocaleString()}
                        </td>
                        <td className="py-2 px-2 text-right text-[var(--status-red)] font-medium">
                          ৳{row.cogs_invoice_cost.toLocaleString()}
                        </td>
                        <td className="py-2 px-2 text-right text-[var(--status-amber)] font-medium">
                          ৳{row.operating_expenses.toLocaleString()}
                        </td>
                        <td
                          className={`py-2 px-2.5 text-right font-black ${
                            row.collection_balance >= 0 ? 'text-[var(--status-green)]' : 'text-[var(--status-red)]'
                          }`}
                        >
                          ৳{row.collection_balance.toLocaleString()}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button
                            onClick={() => handleDrilldownDayOrders(row.date, row.invoice_numbers)}
                            title="Drill-down Day Orders"
                            className="p-1 text-[var(--accent)] hover:bg-[var(--surface-sunken)] rounded cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-[var(--surface-sunken)] font-black text-xs border-t-2 border-[var(--border)] font-mono">
                    <tr>
                      <td className="py-3 px-2.5 uppercase font-sans">Summary Total</td>
                      <td className="py-3 px-2 text-center">{dailyControlData.summary.orders_count}</td>
                      <td className="py-3 px-2 text-right">৳{dailyControlData.summary.order_value.toLocaleString()}</td>
                      <td className="py-3 px-2 text-center">{dailyControlData.summary.order_quantity}</td>
                      <td className="py-3 px-2 text-center text-[var(--status-amber)]">{dailyControlData.summary.draft_pending}</td>
                      <td className="py-3 px-2 text-center text-[var(--status-teal)]">{dailyControlData.summary.delivery_pending}</td>
                      <td className="py-3 px-2 text-center text-[var(--status-green)]">{dailyControlData.summary.delivery_done}</td>
                      <td className="py-3 px-2 text-center text-[var(--status-red)]">{dailyControlData.summary.return_quantity}</td>
                      <td className="py-3 px-2 text-right">৳{dailyControlData.summary.cash_collection.toLocaleString()}</td>
                      <td className="py-3 px-2 text-right">৳{dailyControlData.summary.bank_transfer.toLocaleString()}</td>
                      <td className="py-3 px-2 text-right">
                        ৳{(dailyControlData.summary.bkash_personal + dailyControlData.summary.bkash_merchant).toLocaleString()}
                      </td>
                      <td className="py-3 px-2 text-right">৳{dailyControlData.summary.nagad.toLocaleString()}</td>
                      <td className="py-3 px-2 text-right text-[var(--status-green)]">
                        ৳{dailyControlData.summary.total_collection.toLocaleString()}
                      </td>
                      <td className="py-3 px-2 text-right text-[var(--status-red)]">
                        ৳{dailyControlData.summary.cogs_invoice_cost.toLocaleString()}
                      </td>
                      <td className="py-3 px-2 text-right text-[var(--status-amber)]">
                        ৳{dailyControlData.summary.operating_expenses.toLocaleString()}
                      </td>
                      <td className="py-3 px-2.5 text-right font-black text-[var(--accent)] text-sm">
                        ৳{dailyControlData.summary.collection_balance.toLocaleString()}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 6: FINANCIAL CROSS-CHECK */}
      {activeReportTab === 'cross_check' && (
        <div className="space-y-6">
          <div className="p-4 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-xl flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[var(--text)]">Automated General Ledger Parity & Integrity Check</h3>
              <p className="text-xs text-[var(--text-muted)]">
                Cross-validates operational sales, payment receipts, double-entry debits/credits, courier receivables, and stock ledger
              </p>
            </div>
            {crossCheckData && (
              <div className="flex items-center gap-2">
                <span
                  className={`px-3 py-1 rounded text-xs font-bold ${
                    crossCheckData.is_fully_balanced
                      ? 'bg-[color-mix(in_srgb,var(--status-green)_10%,transparent)] text-[var(--status-green)] border border-[var(--status-green)]'
                      : 'bg-[color-mix(in_srgb,var(--status-red)_10%,transparent)] text-[var(--status-red)] border border-[var(--status-red)]'
                  }`}
                >
                  {crossCheckData.is_fully_balanced
                    ? 'All 5 Ledger Cross-Checks in Perfect Parity'
                    : 'Discrepancy Detected in Cross-Check'}
                </span>
                <button
                  onClick={loadCrossCheckReport}
                  className="p-1.5 bg-[var(--surface)] border border-[var(--border)] rounded hover:bg-[var(--surface-hover)] cursor-pointer"
                  title="Re-run cross-check"
                >
                  <RefreshCw className="w-4 h-4 text-[var(--text)]" />
                </button>
              </div>
            )}
          </div>

          {/* Cross Check Matrix */}
          {crossCheckData && (
            <div className="space-y-3">
              {crossCheckData.checks.map((chk, index) => (
                <div
                  key={chk.id}
                  className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-[var(--surface-sunken)] border border-[var(--border)] text-[10px] font-bold flex items-center justify-center font-mono">
                          {index + 1}
                        </span>
                        <h4 className="text-sm font-bold text-[var(--text)]">{chk.title}</h4>
                      </div>
                      <p className="text-xs text-[var(--text-muted)] mt-1 ml-7">{chk.description}</p>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded text-xs font-bold ${
                        chk.is_balanced
                          ? 'bg-[color-mix(in_srgb,var(--status-green)_10%,transparent)] text-[var(--status-green)]'
                          : 'bg-[color-mix(in_srgb,var(--status-red)_10%,transparent)] text-[var(--status-red)]'
                      }`}
                    >
                      {chk.is_balanced ? 'Balanced' : 'Discrepancy'}
                    </span>
                  </div>

                  {/* Amounts comparison bar */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-[var(--surface-sunken)] p-3 rounded-lg text-xs font-mono">
                    <div>
                      <span className="text-[11px] font-sans text-[var(--text-muted)] block">
                        {chk.operational_metric_label}
                      </span>
                      <span className="text-base font-bold text-[var(--text)]">
                        ৳{chk.operational_amount.toLocaleString()}
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] font-sans text-[var(--text-muted)] block">
                        {chk.accounting_metric_label}
                      </span>
                      <span className="text-base font-bold text-[var(--text)]">
                        ৳{chk.accounting_amount.toLocaleString()}
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] font-sans text-[var(--text-muted)] block">Net Variance Delta</span>
                      <span
                        className={`text-base font-bold ${
                          chk.variance < 1 ? 'text-[var(--status-green)]' : 'text-[var(--status-red)]'
                        }`}
                      >
                        ৳{chk.variance.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {chk.notes && (
                    <div className="text-[11px] text-[var(--text-muted)] font-sans border-l-2 border-[var(--accent)] pl-2.5 py-0.5">
                      {chk.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* DRILL-DOWN MODAL */}
      {drilldownModal.open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-sunken)] rounded-t-2xl">
              <h3 className="text-sm font-bold text-[var(--text)]">{drilldownModal.title}</h3>
              <button
                onClick={() => setDrilldownModal({ open: false, title: '', type: 'journal', data: null })}
                className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text)] rounded-lg hover:bg-[var(--surface-hover)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {/* JOURNAL DRILL-DOWN */}
              {drilldownModal.type === 'journal' && drilldownModal.data && (
                <div className="space-y-4 font-sans">
                  <div className="grid grid-cols-2 gap-3 p-3 bg-[var(--surface-sunken)] rounded-xl">
                    <div>
                      <span className="text-[11px] text-[var(--text-muted)] block">Entry Number</span>
                      <span className="font-mono font-bold text-[var(--accent)]">
                        {drilldownModal.data.entry_number}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-[var(--text-muted)] block">Date & Type</span>
                      <span className="font-semibold">
                        {drilldownModal.data.date} ({drilldownModal.data.entry_type})
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[11px] text-[var(--text-muted)] block">Description</span>
                      <span className="font-medium text-[var(--text)]">{drilldownModal.data.description}</span>
                    </div>
                  </div>

                  <div className="border border-[var(--border)] rounded-xl overflow-hidden">
                    <table className="dense-table">
                      <thead className="bg-[var(--surface-sunken)] text-[var(--text-muted)] uppercase text-[11px]">
                        <tr>
                          <th className="py-2 px-3 text-left">Account ID / Name</th>
                          <th className="py-2 px-3 text-left">Line Description</th>
                          <th className="py-2 px-3 text-right">Debit (৳)</th>
                          <th className="py-2 px-3 text-right">Credit (৳)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)] font-mono text-xs">
                        {drilldownModal.data.lines?.map((line: any, idx: number) => {
                          const acc = accounts.find((a) => a.id === line.account_id);
                          return (
                            <tr key={idx}>
                              <td className="py-2 px-3">
                                <div className="font-bold text-[var(--text)]">{acc ? acc.name : line.account_id}</div>
                                <div className="text-[10px] text-[var(--text-muted)] font-mono">{line.account_id}</div>
                              </td>
                              <td className="py-2 px-3 font-sans text-[var(--text-muted)]">
                                {line.line_desc || '—'}
                              </td>
                              <td className="py-2 px-3 text-right font-bold text-[var(--text)]">
                                {line.debit > 0 ? `৳${line.debit.toLocaleString()}` : '—'}
                              </td>
                              <td className="py-2 px-3 text-right font-bold text-[var(--text)]">
                                {line.credit > 0 ? `৳${line.credit.toLocaleString()}` : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ORDER DRILL-DOWN */}
              {drilldownModal.type === 'order' && drilldownModal.data && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 p-3 bg-[var(--surface-sunken)] rounded-xl text-xs">
                    <div>
                      <span className="text-[11px] text-[var(--text-muted)] block">Customer</span>
                      <span className="font-bold text-[var(--text)]">{drilldownModal.data.customer_name}</span>
                      <span className="text-[11px] text-[var(--text-muted)] block">{drilldownModal.data.customer_phone}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-[var(--text-muted)] block">Channel / Status</span>
                      <span className="font-bold uppercase text-[var(--accent)]">{drilldownModal.data.channel}</span> •{' '}
                      <span className="font-bold uppercase">{drilldownModal.data.status}</span>
                    </div>
                  </div>

                  <div className="border border-[var(--border)] rounded-xl overflow-hidden">
                    <table className="dense-table">
                      <thead className="bg-[var(--surface-sunken)] text-[var(--text-muted)] uppercase text-[11px]">
                        <tr>
                          <th className="py-2 px-3 text-left">Item / Perfume</th>
                          <th className="py-2 px-3 text-center">Qty</th>
                          <th className="py-2 px-3 text-right">Unit Price</th>
                          <th className="py-2 px-3 text-right">Line Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)] text-xs">
                        {drilldownModal.data.items?.map((it: any) => (
                          <tr key={it.id}>
                            <td className="py-2 px-3 font-semibold">{it.product_name}</td>
                            <td className="py-2 px-3 text-center font-mono">{it.quantity}</td>
                            <td className="py-2 px-3 text-right font-mono">৳{it.unit_price}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold">৳{it.total_price}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-[var(--surface-sunken)] font-bold text-xs">
                        <tr>
                          <td colSpan={3} className="py-2 px-3 text-right">
                            Delivery Fee:
                          </td>
                          <td className="py-2 px-3 text-right font-mono">
                            ৳{drilldownModal.data.delivery_charge || 0}
                          </td>
                        </tr>
                        <tr>
                          <td colSpan={3} className="py-2 px-3 text-right uppercase">
                            Grand Total:
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-black text-sm text-[var(--accent)]">
                            ৳{drilldownModal.data.total?.toLocaleString()}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* EXPENSE DRILL-DOWN */}
              {drilldownModal.type === 'expense' && drilldownModal.data && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 p-3 bg-[var(--surface-sunken)] rounded-xl">
                    <div>
                      <span className="text-[11px] text-[var(--text-muted)] block">Voucher Number</span>
                      <span className="font-mono font-bold text-[var(--accent)]">
                        {drilldownModal.data.expense_number}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-[var(--text-muted)] block">Category</span>
                      <span className="font-bold">{drilldownModal.data.category_name || drilldownModal.data.category}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[11px] text-[var(--text-muted)] block">Description</span>
                      <span className="font-medium text-[var(--text)]">{drilldownModal.data.description}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-[var(--text-muted)] block">Payment Account</span>
                      <span className="font-semibold text-[var(--text)]">
                        {drilldownModal.data.payment_account_name || 'Cash Till'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-[var(--text-muted)] block">Amount</span>
                      <span className="font-mono font-black text-base text-[var(--status-red)]">
                        ৳{drilldownModal.data.amount?.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* DAY ORDERS LIST DRILL-DOWN */}
              {drilldownModal.type === 'day_orders' && drilldownModal.data && (
                <div className="space-y-4">
                  <div className="border border-[var(--border)] rounded-xl overflow-hidden">
                    <table className="dense-table text-xs">
                      <thead className="bg-[var(--surface-sunken)] text-[var(--text-muted)] uppercase text-[11px]">
                        <tr>
                          <th className="py-2 px-3 text-left">Invoice</th>
                          <th className="py-2 px-3 text-left">Customer</th>
                          <th className="py-2 px-3 text-left">Channel</th>
                          <th className="py-2 px-3 text-left">Status</th>
                          <th className="py-2 px-3 text-right">Total (৳)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]">
                        {drilldownModal.data.orders?.map((ord: any) => (
                          <tr key={ord.id} className="hover:bg-[var(--surface-hover)]">
                            <td className="py-2 px-3 font-mono font-bold text-[var(--accent)]">{ord.invoice_number}</td>
                            <td className="py-2 px-3 font-medium">{ord.customer_name}</td>
                            <td className="py-2 px-3 uppercase text-[10px]">{ord.channel}</td>
                            <td className="py-2 px-3">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-[var(--surface-sunken)] border border-[var(--border)]">
                                {ord.status}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold">
                              ৳{ord.total?.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-[var(--border)] bg-[var(--surface-sunken)] flex justify-end rounded-b-2xl">
              <button
                onClick={() => setDrilldownModal({ open: false, title: '', type: 'journal', data: null })}
                className="px-4 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded text-xs font-bold hover:bg-[var(--surface-hover)] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
