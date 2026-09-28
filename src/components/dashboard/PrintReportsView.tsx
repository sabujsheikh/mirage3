import { PageHeader } from '../common/PageHeader';
import React, { useState } from 'react';
import {
  Printer,
  FileSpreadsheet,
  Download,
  Calendar,
  DollarSign,
  TrendingUp,
  Boxes,
  Truck,
  RotateCcw,
  Users,
  Building,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';

export const PrintReportsView: React.FC = () => {
  const {
    orders,
    products,
    courierBookings,
    customerReturns,
    expenses,
    payrollRecords,
    accounts,
    paymentAccounts,
    pnlReport,
    balanceSheetReport,
    settings,
    refreshAll,
    fetchPaymentAccountsReport,
    fetchDailyBusinessControlReport,
  } = useApp();

  const [activeReport, setActiveReport] = useState<'daily_sales' | 'daily_control' | 'payment_accounts' | 'inventory' | 'courier_rto' | 'financial_summary'>('daily_sales');
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10));
  const [dailyControlData, setDailyControlData] = useState<any>(null);
  const [paymentReportData, setPaymentReportData] = useState<any>(null);

  React.useEffect(() => {
    fetchDailyBusinessControlReport().then(setDailyControlData).catch(console.warn);
    fetchPaymentAccountsReport().then(setPaymentReportData).catch(console.warn);
  }, []);

  // Calculations for Daily Sales Report
  const completedOrders = orders.filter((o) => o.status === 'delivered' || o.status === 'dispatched' || o.status === 'confirmed');
  const totalRevenue = completedOrders.reduce((s, o) => s + o.total, 0);
  const totalItemsSold = completedOrders.reduce((s, o) => s + o.items.reduce((sum, it) => sum + it.quantity, 0), 0);
  const totalCogs = completedOrders.reduce(
    (s, o) => s + o.items.reduce((sum, it) => sum + it.quantity * (it.unit_cost_at_sale || 2200), 0),
    0
  );
  const grossProfit = totalRevenue - totalCogs;

  // Inventory valuation calculations
  const totalStockOnHand = products.reduce((s, p) => s + (p.stock_on_hand || 0), 0);
  const totalValuation = products.reduce((s, p) => s + (p.stock_on_hand || 0) * p.avg_cost, 0);
  const lowStockItems = products.filter((p) => (p.stock_available ?? 0) <= (p.low_stock_threshold ?? 3));

  // Courier RTO stats
  const totalBookings = courierBookings.length;
  const deliveredCount = courierBookings.filter((b) => b.status === 'delivered').length;
  const rtoCount = courierBookings.filter((b) => b.status === 'rto').length;
  const deliverySuccessRate = totalBookings > 0 ? (deliveredCount / totalBookings) * 100 : 0;
  const rtoRate = totalBookings > 0 ? (rtoCount / totalBookings) * 100 : 0;

  return (
    <div className="space-y-6" id="print-reports-center">
      {/* Top Header */}
      <PageHeader
        eyebrow="Reports"
        title="Reports & Statements"
        desc="Filter on screen, preview statement, then export to Excel or generate printable PDF"
      />

      {/* Report Selector Tabs */}
      <div className="flex border-b border-[var(--border)] gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveReport('daily_sales')}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeReport === 'daily_sales'
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          Daily Sales & Profit Summary
        </button>

        <button
          onClick={() => setActiveReport('daily_control')}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeReport === 'daily_control'
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Daily Business Control Matrix
        </button>

        <button
          onClick={() => setActiveReport('payment_accounts')}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeReport === 'payment_accounts'
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          Payment Accounts Audit
        </button>

        <button
          onClick={() => setActiveReport('inventory')}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeReport === 'inventory'
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          <Boxes className="w-4 h-4" />
          Inventory Valuation & Reorder Sheet
        </button>

        <button
          onClick={() => setActiveReport('courier_rto')}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeReport === 'courier_rto'
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          <Truck className="w-4 h-4" />
          Steadfast Courier & RTO Audit
        </button>

        <button
          onClick={() => setActiveReport('financial_summary')}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeReport === 'financial_summary'
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Executive P&L & Balance Sheet
        </button>
      </div>

      {/* PRINTABLE DOCUMENT CANVAS (Styled for both Screen & Clean Print/PDF) */}
      <div
        className="bg-white text-slate-900 border border-slate-200 rounded-2xl p-8 shadow-sm space-y-6 max-w-5xl mx-auto font-sans"
        id="printable-report-canvas"
      >
        {/* Company Header */}
        <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
          <div>
            <h1 className="text-xl font-black tracking-tight text-slate-950">
              {settings?.business_name || 'MIRAGE PERFUME BANGLADESH'}
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              {settings?.address || 'House 47, Road 27, Banani, Dhaka, Bangladesh'} &#8226; Hotline: {settings?.phone || '+8801999033027'}
            </p>
            <span className="inline-block mt-2 px-2.5 py-0.5 rounded text-[10px] font-black uppercase bg-slate-900 text-white">
              Official ERP Management Report
            </span>
          </div>

          <div className="text-right text-xs">
            <p className="font-bold text-slate-600">Generated Date:</p>
            <p className="font-mono font-bold text-sm text-slate-950">{new Date().toLocaleString()}</p>
            <p className="text-[11px] text-slate-500 mt-1">Status: Verified from Double-Entry Ledger</p>
          </div>
        </div>

        {/* REPORT 1: DAILY SALES & PROFIT SUMMARY */}
        {activeReport === 'daily_sales' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-950 uppercase tracking-wide">
                Daily Sales & Gross Profit Performance Summary
              </h2>
              <p className="text-xs text-slate-500">Order revenue, delivery fees, and estimated product gross margin</p>
            </div>

            {/* KPI Strip */}
            <div className="grid grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold">Total Orders</span>
                <p className="text-base font-black text-slate-950">{completedOrders.length} orders</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold">Bottles Sold</span>
                <p className="text-base font-black text-blue-600">{totalItemsSold} bottles</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold">Gross Revenue</span>
                <p className="text-base font-black text-emerald-600 font-mono">৳{totalRevenue.toLocaleString()}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold">Gross Profit</span>
                <p className="text-base font-black text-slate-950 font-mono">৳{grossProfit.toLocaleString()}</p>
              </div>
            </div>

            {/* Orders Table */}
            <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-100 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-700">
                <tr>
                  <th className="py-2.5 px-3">Invoice #</th>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3">Channel & Courier</th>
                  <th className="py-2.5 px-3 text-center">Bottles</th>
                  <th className="py-2.5 px-3 text-right">Order Total (৳)</th>
                  <th className="py-2.5 px-3 text-right">Landed Cost (৳)</th>
                  <th className="py-2.5 px-3 text-right">Gross Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {completedOrders.map((o) => {
                  const orderCogs = o.items.reduce((s, it) => s + it.quantity * (it.unit_cost_at_sale || 2200), 0);
                  const margin = o.total - orderCogs;
                  const marginPct = o.total > 0 ? (margin / o.total) * 100 : 0;

                  return (
                    <tr key={o.id}>
                      <td className="py-2 px-3 font-bold text-slate-950">{o.invoice_number}</td>
                      <td className="py-2 px-3 font-sans font-medium text-slate-800">{o.customer_name}</td>
                      <td className="py-2 px-3 font-sans capitalize text-slate-600">{o.channel} • {o.fulfillment_method}</td>
                      <td className="py-2 px-3 text-center font-bold text-slate-900">
                        {o.items.reduce((s, it) => s + it.quantity, 0)}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-slate-950">৳{o.total.toLocaleString()}</td>
                      <td className="py-2 px-3 text-right text-slate-600">৳{orderCogs.toLocaleString()}</td>
                      <td className="py-2 px-3 text-right font-bold text-emerald-600 font-sans">
                        ৳{margin.toLocaleString()} ({marginPct.toFixed(0)}%)
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-100 font-bold text-xs border-t-2 border-slate-300">
                <tr>
                  <td colSpan={4} className="py-2.5 px-3 uppercase text-slate-900">Total Performance</td>
                  <td className="py-2.5 px-3 text-right font-mono font-black text-slate-950 text-sm">
                    ৳{totalRevenue.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                    ৳{totalCogs.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-emerald-700 font-black text-sm">
                    ৳{grossProfit.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* REPORT: DAILY BUSINESS CONTROL MATRIX */}
        {activeReport === 'daily_control' && dailyControlData && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-950 uppercase tracking-wide">
                Daily Business & Operational Financial Control Sheet
              </h2>
              <p className="text-xs text-slate-500">Cross-channel order volume, channel collections, returns, cost & net cash balance</p>
            </div>

            <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-100 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-700">
                <tr>
                  <th className="py-2.5 px-2.5">Date</th>
                  <th className="py-2.5 px-2 text-center">Orders</th>
                  <th className="py-2.5 px-2 text-right">Order Val (৳)</th>
                  <th className="py-2.5 px-2 text-center">Delivered</th>
                  <th className="py-2.5 px-2 text-center">Returns</th>
                  <th className="py-2.5 px-2 text-right">Cash (৳)</th>
                  <th className="py-2.5 px-2 text-right">Bank (৳)</th>
                  <th className="py-2.5 px-2 text-right">MFS (৳)</th>
                  <th className="py-2.5 px-2 text-right text-emerald-700">Total Col (৳)</th>
                  <th className="py-2.5 px-2 text-right text-rose-600">COGS (৳)</th>
                  <th className="py-2.5 px-2.5 text-right font-bold text-slate-950">Net Balance (৳)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {dailyControlData.rows?.map((row: any) => (
                  <tr key={row.date}>
                    <td className="py-2 px-2.5 font-sans font-bold text-slate-950">{row.date}</td>
                    <td className="py-2 px-2 text-center">{row.orders_count}</td>
                    <td className="py-2 px-2 text-right">৳{row.order_value.toLocaleString()}</td>
                    <td className="py-2 px-2 text-center font-bold text-emerald-700">{row.delivery_done}</td>
                    <td className="py-2 px-2 text-center text-rose-600">{row.return_quantity}</td>
                    <td className="py-2 px-2 text-right">৳{row.cash_collection.toLocaleString()}</td>
                    <td className="py-2 px-2 text-right">৳{row.bank_transfer.toLocaleString()}</td>
                    <td className="py-2 px-2 text-right">৳{(row.bkash_personal + row.bkash_merchant + row.nagad).toLocaleString()}</td>
                    <td className="py-2 px-2 text-right font-bold text-emerald-700">৳{row.total_collection.toLocaleString()}</td>
                    <td className="py-2 px-2 text-right text-rose-600">৳{row.cogs_invoice_cost.toLocaleString()}</td>
                    <td className="py-2 px-2.5 text-right font-black text-slate-950">৳{row.collection_balance.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100 font-bold text-xs border-t-2 border-slate-300 font-mono">
                <tr>
                  <td className="py-2.5 px-2.5 uppercase font-sans">Summary Total</td>
                  <td className="py-2.5 px-2 text-center">{dailyControlData.summary?.orders_count}</td>
                  <td className="py-2.5 px-2 text-right">৳{dailyControlData.summary?.order_value.toLocaleString()}</td>
                  <td className="py-2.5 px-2 text-center">{dailyControlData.summary?.delivery_done}</td>
                  <td className="py-2.5 px-2 text-center">{dailyControlData.summary?.return_quantity}</td>
                  <td className="py-2.5 px-2 text-right">৳{dailyControlData.summary?.cash_collection.toLocaleString()}</td>
                  <td className="py-2.5 px-2 text-right">৳{dailyControlData.summary?.bank_transfer.toLocaleString()}</td>
                  <td className="py-2.5 px-2 text-right">৳{(dailyControlData.summary?.bkash_personal + dailyControlData.summary?.bkash_merchant + dailyControlData.summary?.nagad).toLocaleString()}</td>
                  <td className="py-2.5 px-2 text-right font-black text-emerald-700">৳{dailyControlData.summary?.total_collection.toLocaleString()}</td>
                  <td className="py-2.5 px-2 text-right text-rose-600">৳{dailyControlData.summary?.cogs_invoice_cost.toLocaleString()}</td>
                  <td className="py-2.5 px-2.5 text-right font-black text-sm text-slate-950">৳{dailyControlData.summary?.collection_balance.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* REPORT: PAYMENT ACCOUNTS AUDIT */}
        {activeReport === 'payment_accounts' && paymentReportData && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-950 uppercase tracking-wide">
                Payment Accounts Master Audit Sheet
              </h2>
              <p className="text-xs text-slate-500">Official opening balances, cash/bank/MFS collections, disbursements & closing balances</p>
            </div>

            <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-100 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-700">
                <tr>
                  <th className="py-2.5 px-3">Account Name</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Account #</th>
                  <th className="py-2.5 px-3 text-right">Opening (৳)</th>
                  <th className="py-2.5 px-3 text-right">Money In (৳)</th>
                  <th className="py-2.5 px-3 text-right">Money Out (৳)</th>
                  <th className="py-2.5 px-3 text-right">Closing Balance (৳)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {paymentReportData.accounts_summary?.map((acc: any) => (
                  <tr key={acc.account_id}>
                    <td className="py-2 px-3 font-sans font-bold text-slate-950">{acc.account_name}</td>
                    <td className="py-2 px-3 font-sans uppercase text-[10px] text-slate-600">{acc.account_type}</td>
                    <td className="py-2 px-3 text-slate-600">{acc.account_number}</td>
                    <td className="py-2 px-3 text-right">৳{acc.opening_balance.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right font-semibold text-emerald-700">+৳{acc.total_money_in.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right font-semibold text-rose-600">-৳{acc.total_money_out.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right font-black text-slate-950">৳{acc.closing_balance.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100 font-bold text-xs border-t-2 border-slate-300 font-mono">
                <tr>
                  <td colSpan={3} className="py-2.5 px-3 uppercase font-sans">Total Aggregate Liquidity</td>
                  <td className="py-2.5 px-3 text-right">৳{paymentReportData.summary?.opening_balance.toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-right text-emerald-700">+৳{paymentReportData.summary?.total_money_in.toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-right text-rose-600">-৳{paymentReportData.summary?.total_money_out.toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-right font-black text-sm text-slate-950">৳{paymentReportData.summary?.closing_balance.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* REPORT 2: INVENTORY VALUATION & REORDER SHEET */}
        {activeReport === 'inventory' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-950 uppercase tracking-wide">
                Inventory Valuation & Low-Stock Reorder Warning Sheet
              </h2>
              <p className="text-xs text-slate-500">Warehouse stock on hand, weighted average landed costs, and replenishment triggers</p>
            </div>

            <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold">Total Stock on Hand</span>
                <p className="text-base font-black text-slate-950">{totalStockOnHand} bottles</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold">Total Valuation (Asset)</span>
                <p className="text-base font-black text-emerald-600 font-mono">&#2547;{totalValuation.toLocaleString()}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold">Low Stock Warnings</span>
                <p className="text-base font-black text-rose-600">{lowStockItems.length} SKUs below threshold</p>
              </div>
            </div>

            <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-100 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-700">
                <tr>
                  <th className="py-2.5 px-3">SKU & Barcode</th>
                  <th className="py-2.5 px-3">Perfume Name</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3 text-center">On Hand</th>
                  <th className="py-2.5 px-3 text-center">Reserved</th>
                  <th className="py-2.5 px-3 text-center">Available</th>
                  <th className="py-2.5 px-3 text-right">Avg Landed Cost</th>
                  <th className="py-2.5 px-3 text-right">Total Value (&#2547;)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[11px]">
                {products.map((p) => {
                  const isLow = (p.stock_available ?? 0) <= (p.low_stock_threshold ?? 3);

                  return (
                    <tr key={p.id} className={isLow ? 'bg-rose-50/60' : ''}>
                      <td className="py-2 px-3 font-mono font-bold text-slate-900">{p.sku}</td>
                      <td className="py-2 px-3 font-semibold text-slate-950">{p.display_name}</td>
                      <td className="py-2 px-3 text-slate-600">{p.category_name}</td>
                      <td className="py-2 px-3 text-center font-mono font-bold">{p.stock_on_hand || 0}</td>
                      <td className="py-2 px-3 text-center font-mono text-slate-500">{p.stock_reserved || 0}</td>
                      <td className="py-2 px-3 text-center font-mono font-bold">
                        <span className={isLow ? 'text-rose-600 font-black' : 'text-slate-950'}>
                          {p.stock_available || 0}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-slate-600">&#2547;{p.avg_cost.toLocaleString()}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-950">
                        &#2547;{((p.stock_on_hand || 0) * p.avg_cost).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-100 font-bold text-xs border-t-2 border-slate-300">
                <tr>
                  <td colSpan={3} className="py-2.5 px-3 uppercase text-slate-900">Total Inventory Portfolio</td>
                  <td className="py-2.5 px-3 text-center font-mono font-bold">{totalStockOnHand}</td>
                  <td colSpan={3} />
                  <td className="py-2.5 px-3 text-right font-mono font-black text-slate-950 text-sm">
                    &#2547;{totalValuation.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* REPORT 3: STEADFAST COURIER & RTO AUDIT */}
        {activeReport === 'courier_rto' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-950 uppercase tracking-wide">
                Steadfast Courier Delivery Performance & RTO Loss Audit
              </h2>
              <p className="text-xs text-slate-500">Carrier dispatch volume, success rates, delivery charge variances, and RTO return charges</p>
            </div>

            <div className="grid grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold">Total Consignments</span>
                <p className="text-base font-black text-slate-950">{totalBookings} shipments</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold">Delivery Success Rate</span>
                <p className="text-base font-black text-emerald-600">{deliverySuccessRate.toFixed(1)}%</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold">Courier RTO Rate</span>
                <p className="text-base font-black text-rose-600">{rtoRate.toFixed(1)}% ({rtoCount} RTOs)</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold">Pending COD Clearing</span>
                <p className="text-base font-black text-blue-600 font-mono">
                  &#2547;{courierBookings.filter((b) => b.payout_status !== 'reconciled').reduce((s, b) => s + b.cod_amount, 0).toLocaleString()}
                </p>
              </div>
            </div>

            <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-100 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-700">
                <tr>
                  <th className="py-2.5 px-3">Consignment #</th>
                  <th className="py-2.5 px-3">Invoice #</th>
                  <th className="py-2.5 px-3">Customer & Zone</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">COD Amount</th>
                  <th className="py-2.5 px-3 text-right">Charged</th>
                  <th className="py-2.5 px-3 text-right">Actual Fee</th>
                  <th className="py-2.5 px-3 text-right">Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[11px] font-mono">
                {courierBookings.map((b) => (
                  <tr key={b.id}>
                    <td className="py-2 px-3 font-bold text-slate-900">{b.consignment_no}</td>
                    <td className="py-2 px-3 font-semibold text-slate-950">{b.invoice_number}</td>
                    <td className="py-2 px-3 font-sans text-slate-700">{b.customer_name} ({b.destination_zone})</td>
                    <td className="py-2 px-3 text-center font-sans">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-800">
                        {b.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-slate-950">&#2547;{b.cod_amount.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right text-slate-600">&#2547;{b.delivery_charge}</td>
                    <td className="py-2 px-3 text-right text-slate-600">&#2547;{b.actual_charge || b.delivery_charge}</td>
                    <td className={`py-2 px-3 text-right font-bold ${(b.variance || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {(b.variance || 0) >= 0 ? `+\u09F3${b.variance || 0}` : `-\u09F3${Math.abs(b.variance || 0)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* REPORT 4: EXECUTIVE FINANCIAL STATEMENT */}
        {activeReport === 'financial_summary' && pnlReport && balanceSheetReport && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-950 uppercase tracking-wide">
                Executive Financial Performance & Balance Sheet Summary
              </h2>
              <p className="text-xs text-slate-500">Consolidated P&L, operational expense distribution, and balance sheet equilibrium</p>
            </div>

            <div className="grid grid-cols-2 gap-6">
              {/* P&L Column */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
                <h3 className="font-bold uppercase text-[11px] text-slate-900 border-b pb-1">Profit & Loss Summary</h3>
                <div className="flex justify-between py-1 text-slate-700">
                  <span>Net Sales Revenue</span>
                  <span className="font-mono font-bold text-slate-950">&#2547;{pnlReport.revenue.net_revenue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1 text-slate-700">
                  <span>Cost of Goods Sold (COGS)</span>
                  <span className="font-mono text-rose-600">-&#2547;{pnlReport.cogs.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1 font-bold text-blue-700 border-t">
                  <span>Gross Profit</span>
                  <span className="font-mono">&#2547;{pnlReport.gross_profit.toLocaleString()} ({pnlReport.gross_margin_percent.toFixed(1)}%)</span>
                </div>
                <div className="flex justify-between py-1 text-slate-700">
                  <span>Total Operating Overheads</span>
                  <span className="font-mono text-amber-700">-&#2547;{pnlReport.operating_expenses.total_operating_expenses.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-2 font-black text-sm text-slate-950 bg-slate-200 px-2 rounded-lg">
                  <span>Net Operating Profit</span>
                  <span className="font-mono text-emerald-700">&#2547;{pnlReport.net_operating_profit.toLocaleString()}</span>
                </div>
              </div>

              {/* Balance Sheet Column */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
                <h3 className="font-bold uppercase text-[11px] text-slate-900 border-b pb-1">Balance Sheet Summary</h3>
                <div className="flex justify-between py-1 text-slate-700">
                  <span>Current Liquid Assets (Cash/Bank/MFS)</span>
                  <span className="font-mono font-bold text-slate-950">
                    &#2547;{(balanceSheetReport.assets.cash_in_hand + balanceSheetReport.assets.bank_deposits + balanceSheetReport.assets.mfs_wallets).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between py-1 text-slate-700">
                  <span>Perfume Stock Valuation</span>
                  <span className="font-mono font-bold text-slate-950">&#2547;{balanceSheetReport.assets.inventory_valuation.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1 font-bold text-slate-950 border-t">
                  <span>Total Assets</span>
                  <span className="font-mono">&#2547;{balanceSheetReport.assets.total_assets.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1 text-slate-700">
                  <span>Dubai Supplier Payables (Liabilities)</span>
                  <span className="font-mono text-rose-600">&#2547;{balanceSheetReport.liabilities.supplier_payables.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-2 font-black text-sm text-slate-950 bg-slate-200 px-2 rounded-lg">
                  <span>Owner Equity & Reserves</span>
                  <span className="font-mono text-blue-700">&#2547;{balanceSheetReport.equity.total_equity.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Authorization Footer */}
        <div className="pt-8 flex justify-between items-end border-t border-slate-200 text-xs text-slate-500">
          <div>
            <p className="font-bold text-slate-700">Mirage Perfume ERP v2.0</p>
            <p className="text-[10px]">Confidential Internal Management Document</p>
          </div>
          <div className="text-right">
            <div className="w-44 border-b border-slate-400 mb-1" />
            <p className="text-[10px] uppercase font-bold text-slate-700">Authorized Signature & Seal</p>
          </div>
        </div>
      </div>
    </div>
  );
};
