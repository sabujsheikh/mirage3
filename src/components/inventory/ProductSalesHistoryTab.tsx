import React, { useMemo, useState } from 'react';
import {
  ShoppingBag,
  Receipt,
  History,
  Store,
  MessageSquare,
  Search,
  Filter,
  Tag,
  CheckCircle2,
  CalendarDays,
  Clock,
  ArrowDownUp,
  AlertCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Product, StockMovement, Order, OrderChannel, OrderStatus } from '../../types';
import { StatusBadge } from '../common/StatusBadge';

export interface ProductSalesHistoryTabProps {
  product: Product;
  latestReceivedDate?: string;
  movements: StockMovement[];
}

export interface SalesTransactionRow {
  id: string;
  orderId: string;
  orderNumber: string;
  saleDate: string;
  customerName: string;
  customerPhone?: string;
  channel: OrderChannel;
  status: OrderStatus;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  totalPrice: number;
  isCompleted: boolean;
  notes?: string;
}

export const ProductSalesHistoryTab: React.FC<ProductSalesHistoryTabProps> = ({
  product,
  latestReceivedDate,
  movements,
}) => {
  const { orders } = useApp();

  const [viewFilter, setViewFilter] = useState<'completed' | 'all'>('completed');
  const [channelFilter, setChannelFilter] = useState<'all' | 'messenger' | 'walk-in'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // --------------------------------------------------------------------------
  // 1. Transaction extraction from real Order & OrderItem data
  // --------------------------------------------------------------------------
  const allTransactions = useMemo(() => {
    const list: SalesTransactionRow[] = [];

    for (const order of orders) {
      if (!order.items || order.items.length === 0) continue;

      // Accuracy Rules:
      // - Cancelled, returned, and RTO orders are strictly excluded from completed sales
      const isExcluded = order.status === 'cancelled' || order.status === 'rto' || order.status === 'returned';

      // - Walk-in sales count immediately because stock leaves immediately (unless cancelled/returned)
      // - Online / Messenger orders count only when delivered
      const isCompleted = !isExcluded && (
        order.channel === 'walk-in' || order.status === 'delivered'
      );

      for (const item of order.items) {
        // Direct product line match
        if (item.product_id === product.id) {
          list.push({
            id: `${order.id}_${item.id || item.product_id}`,
            orderId: order.id,
            orderNumber: order.invoice_number || `ORD-${order.id.slice(0, 8)}`,
            saleDate: order.created_at,
            customerName: order.customer_name || (order.channel === 'walk-in' ? 'Walk-in Customer' : 'Customer'),
            customerPhone: order.customer_phone,
            channel: order.channel,
            status: order.status,
            quantity: item.quantity,
            unitPrice: item.unit_price,
            discountAmount: item.discount_amount || 0,
            totalPrice: item.total_price,
            isCompleted,
            notes: order.notes,
          });
        }
      }
    }

    // Sort newest transactions first
    return list.sort((a, b) => new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime());
  }, [orders, product.id]);

  // --------------------------------------------------------------------------
  // 2. Metrics calculation strictly from completed sales
  // --------------------------------------------------------------------------
  const completedTransactions = useMemo(
    () => allTransactions.filter(t => t.isCompleted),
    [allTransactions]
  );

  // Metric 1: Lifetime units sold
  const lifetimeUnitsSold = useMemo(
    () => completedTransactions.reduce((acc, t) => acc + t.quantity, 0),
    [completedTransactions]
  );

  // Metric 2: Total number of completed sales / orders
  const totalCompletedOrdersCount = useMemo(
    () => new Set(completedTransactions.map(t => t.orderId)).size,
    [completedTransactions]
  );

  // Lifetime revenue (complementary financial metric)
  const lifetimeRevenue = useMemo(
    () => completedTransactions.reduce((acc, t) => acc + t.totalPrice, 0),
    [completedTransactions]
  );

  // Metric 3: Units sold since the most recent stock receipt/import
  const soldSinceLastRestock = useMemo(() => {
    if (!latestReceivedDate) {
      return {
        units: lifetimeUnitsSold,
        hasRestock: false,
        label: 'Since initial stock (No restock recorded)',
      };
    }

    const restockTimestamp = new Date(latestReceivedDate).getTime();
    const count = completedTransactions
      .filter(t => new Date(t.saleDate).getTime() >= restockTimestamp)
      .reduce((acc, t) => acc + t.quantity, 0);

    const formattedDate = new Date(latestReceivedDate).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    return {
      units: count,
      hasRestock: true,
      label: `Since ${formattedDate}`,
    };
  }, [completedTransactions, latestReceivedDate, lifetimeUnitsSold]);

  // Channel breakdown metrics
  const channelStats = useMemo(() => {
    let messengerUnits = 0;
    let messengerOrders = new Set<string>();
    let walkInUnits = 0;
    let walkInOrders = new Set<string>();

    for (const t of completedTransactions) {
      if (t.channel === 'messenger') {
        messengerUnits += t.quantity;
        messengerOrders.add(t.orderId);
      } else {
        walkInUnits += t.quantity;
        walkInOrders.add(t.orderId);
      }
    }

    return {
      messengerUnits,
      messengerOrdersCount: messengerOrders.size,
      walkInUnits,
      walkInOrdersCount: walkInOrders.size,
    };
  }, [completedTransactions]);

  // --------------------------------------------------------------------------
  // 3. Filtered transactions for the table display
  // --------------------------------------------------------------------------
  const displayedTransactions = useMemo(() => {
    let result = viewFilter === 'completed' ? completedTransactions : allTransactions;

    if (channelFilter !== 'all') {
      result = result.filter(t => t.channel === channelFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        t =>
          t.orderNumber.toLowerCase().includes(q) ||
          t.customerName.toLowerCase().includes(q) ||
          (t.customerPhone && t.customerPhone.includes(q))
      );
    }

    return result;
  }, [viewFilter, completedTransactions, allTransactions, channelFilter, searchQuery]);

  // Helper date formatter
  const formatDateTime = (iso: string): { dateStr: string; timeStr: string } => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return { dateStr: '—', timeStr: '' };
    const dateStr = d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const timeStr = d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    return { dateStr, timeStr };
  };

  const formatMoney = (amount: number) => `৳${Math.round(amount).toLocaleString('en-US')}`;

  return (
    <div className="space-y-4">
      {/* ----------------- Top Summary Stat Cards ----------------- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Metric 1: Lifetime Units Sold */}
        <div className="border border-[var(--border)] rounded-xl bg-[var(--surface-sunken)] p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Lifetime Units Sold
            </span>
            <div className="w-7 h-7 rounded-lg bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] flex items-center justify-center text-[var(--accent)]">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold font-num text-[var(--text)] tracking-tight">
              {lifetimeUnitsSold}{' '}
              <span className="text-xs font-normal text-[var(--text-secondary)]">bottles</span>
            </div>
            <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
              Verified completed sales
            </div>
          </div>
        </div>

        {/* Metric 2: Total Sales / Orders */}
        <div className="border border-[var(--border)] rounded-xl bg-[var(--surface-sunken)] p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Total Orders
            </span>
            <div className="w-7 h-7 rounded-lg bg-[color-mix(in_srgb,var(--accent-secondary)_12%,transparent)] flex items-center justify-center text-[var(--accent-secondary)]">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold font-num text-[var(--text)] tracking-tight">
              {totalCompletedOrdersCount}{' '}
              <span className="text-xs font-normal text-[var(--text-secondary)]">orders</span>
            </div>
            <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
              Across walk-in & online
            </div>
          </div>
        </div>

        {/* Metric 3: Units Sold Since Last Restock */}
        <div className="border border-[var(--border)] rounded-xl bg-[var(--surface-sunken)] p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Since Last Restock
            </span>
            <div className="w-7 h-7 rounded-lg bg-[color-mix(in_srgb,var(--status-green)_12%,transparent)] flex items-center justify-center text-[var(--status-green)]">
              <History className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold font-num text-[var(--text)] tracking-tight">
              {soldSinceLastRestock.units}{' '}
              <span className="text-xs font-normal text-[var(--text-secondary)]">sold</span>
            </div>
            <div className="text-[11px] text-[var(--text-muted)] mt-0.5 truncate" title={soldSinceLastRestock.label}>
              {soldSinceLastRestock.label}
            </div>
          </div>
        </div>

        {/* Metric 4: Lifetime Sales Revenue */}
        <div className="border border-[var(--border)] rounded-xl bg-[var(--surface-sunken)] p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Total Sales Value
            </span>
            <div className="w-7 h-7 rounded-lg bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] flex items-center justify-center text-[var(--accent)]">
              <Tag className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold font-num text-[var(--accent)] tracking-tight">
              {formatMoney(lifetimeRevenue)}
            </div>
            <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
              Net revenue from this SKU
            </div>
          </div>
        </div>
      </div>

      {/* ----------------- Channel Distribution Pills ----------------- */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg border border-[var(--border)] bg-[var(--card)] text-[12px]">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Channel Breakdown:
          </span>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)] font-medium text-[11px]">
            <MessageSquare className="w-3 h-3" />
            Messenger: <strong className="font-num">{channelStats.messengerUnits}</strong> units ({channelStats.messengerOrdersCount} orders)
          </span>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[color-mix(in_srgb,var(--status-green)_10%,transparent)] text-[var(--status-green)] font-medium text-[11px]">
            <Store className="w-3 h-3" />
            Walk-in POS: <strong className="font-num">{channelStats.walkInUnits}</strong> units ({channelStats.walkInOrdersCount} orders)
          </span>
        </div>

        <div className="text-[11px] text-[var(--text-muted)]">
          Read-only audit trail grounded in real transaction ledger
        </div>
      </div>

      {/* ----------------- Search & Filter Controls ----------------- */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        {/* Search Input */}
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search by Order # or Customer..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-[12px] bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>

        {/* View mode & Channel filters */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Channel selector */}
          <div className="inline-flex items-center rounded-lg border border-[var(--border)] bg-[var(--surface-sunken)] p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => setChannelFilter('all')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                channelFilter === 'all'
                  ? 'bg-[var(--card)] text-[var(--text)] shadow-xs font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
              }`}
            >
              All Channels
            </button>
            <button
              type="button"
              onClick={() => setChannelFilter('messenger')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                channelFilter === 'messenger'
                  ? 'bg-[var(--card)] text-[var(--accent)] shadow-xs font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
              }`}
            >
              Messenger
            </button>
            <button
              type="button"
              onClick={() => setChannelFilter('walk-in')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                channelFilter === 'walk-in'
                  ? 'bg-[var(--card)] text-[var(--status-green)] shadow-xs font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
              }`}
            >
              Walk-in
            </button>
          </div>

          {/* Completed vs All view toggle */}
          <div className="inline-flex items-center rounded-lg border border-[var(--border)] bg-[var(--surface-sunken)] p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => setViewFilter('completed')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                viewFilter === 'completed'
                  ? 'bg-[var(--card)] text-[var(--text)] shadow-xs font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
              }`}
              title="Only finalized sales (Delivered online orders & immediate walk-in sales)"
            >
              Completed Sales ({completedTransactions.length})
            </button>
            <button
              type="button"
              onClick={() => setViewFilter('all')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                viewFilter === 'all'
                  ? 'bg-[var(--card)] text-[var(--text)] shadow-xs font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
              }`}
              title="All associated orders including pending, dispatched, or cancelled"
            >
              All Associated ({allTransactions.length})
            </button>
          </div>
        </div>
      </div>

      {/* ----------------- Transactions Table ----------------- */}
      <div className="border border-[var(--border)] rounded-xl overflow-hidden bg-[var(--card)]">
        {displayedTransactions.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-[var(--surface-sunken)] flex items-center justify-center mx-auto text-[var(--text-muted)]">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div className="text-[13px] font-semibold text-[var(--text)]">
              {searchQuery || channelFilter !== 'all'
                ? 'No matching sales transactions found'
                : 'No completed sales recorded for this product yet'}
            </div>
            <p className="text-[11px] text-[var(--text-muted)] max-w-md mx-auto">
              {searchQuery || channelFilter !== 'all'
                ? 'Try adjusting your search query or channel filter above.'
                : 'When walk-in sales are completed or online Messenger orders are delivered, they will automatically appear in this historical sales ledger.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px] border-collapse">
              <thead>
                <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] bg-[var(--surface-sunken)] border-b border-[var(--border)]">
                  <th className="px-3.5 py-2.5">Sale Date</th>
                  <th className="px-3.5 py-2.5">Order Number</th>
                  <th className="px-3.5 py-2.5">Customer</th>
                  <th className="px-3.5 py-2.5">Channel</th>
                  <th className="px-3.5 py-2.5 text-right font-num">Qty</th>
                  <th className="px-3.5 py-2.5 text-right font-num">Selling Price</th>
                  <th className="px-3.5 py-2.5 text-right font-num">Discount</th>
                  <th className="px-3.5 py-2.5 text-right font-num">Total Amount</th>
                  <th className="px-3.5 py-2.5">Order Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {displayedTransactions.map(t => {
                  const dt = formatDateTime(t.saleDate);
                  return (
                    <tr
                      key={t.id}
                      className={`hover:bg-[var(--surface-hover)] transition-colors ${
                        !t.isCompleted ? 'opacity-70 bg-[color-mix(in_srgb,var(--surface-sunken)_40%,transparent)]' : ''
                      }`}
                    >
                      {/* Sale Date */}
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <div className="font-medium text-[var(--text)]">{dt.dateStr}</div>
                        <div className="text-[10px] text-[var(--text-muted)] flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {dt.timeStr}
                        </div>
                      </td>

                      {/* Order Number */}
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <span className="font-num font-semibold text-[var(--accent)] hover:underline cursor-default">
                          {t.orderNumber}
                        </span>
                      </td>

                      {/* Customer Name */}
                      <td className="px-3.5 py-2.5">
                        <div className="font-medium text-[var(--text)] max-w-[160px] truncate" title={t.customerName}>
                          {t.customerName}
                        </div>
                        {t.customerPhone && (
                          <div className="text-[10px] font-num text-[var(--text-muted)]">
                            {t.customerPhone}
                          </div>
                        )}
                      </td>

                      {/* Channel */}
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        {t.channel === 'messenger' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--accent)]">
                            <MessageSquare className="w-3 h-3" /> Messenger
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[color-mix(in_srgb,var(--status-green)_12%,transparent)] text-[var(--status-green)]">
                            <Store className="w-3 h-3" /> Walk-in
                          </span>
                        )}
                      </td>

                      {/* Quantity Sold */}
                      <td className="px-3.5 py-2.5 text-right font-num font-bold text-[var(--text)] whitespace-nowrap">
                        {t.quantity}
                      </td>

                      {/* Actual Selling Price */}
                      <td className="px-3.5 py-2.5 text-right font-num text-[var(--text-secondary)] whitespace-nowrap">
                        {formatMoney(t.unitPrice)}
                      </td>

                      {/* Product-level Discount */}
                      <td className="px-3.5 py-2.5 text-right font-num whitespace-nowrap">
                        {t.discountAmount > 0 ? (
                          <span className="text-[var(--status-amber)] font-medium">
                            -{formatMoney(t.discountAmount)}
                          </span>
                        ) : (
                          <span className="text-[var(--text-muted)]">—</span>
                        )}
                      </td>

                      {/* Total Amount */}
                      <td className="px-3.5 py-2.5 text-right font-num font-semibold text-[var(--text)] whitespace-nowrap">
                        {formatMoney(t.totalPrice)}
                      </td>

                      {/* Relevant Order Status */}
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <StatusBadge
                            status={t.status}
                            label={
                              t.channel === 'walk-in' && t.status === 'delivered'
                                ? 'Walk-in Completed'
                                : undefined
                            }
                            size="sm"
                          />
                          {!t.isCompleted && (
                            <span
                              className="text-[10px] text-[var(--text-muted)] italic"
                              title="Not yet finalized or counted as completed sale"
                            >
                              (pending)
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="text-[11px] text-[var(--text-muted)] flex items-center justify-between px-1">
        <span>
          Showing {displayedTransactions.length} of {allTransactions.length} recorded order transactions
        </span>
        <span className="italic">
          Walk-in sales deduct immediately • Online Messenger sales count upon delivery
        </span>
      </div>
    </div>
  );
};
