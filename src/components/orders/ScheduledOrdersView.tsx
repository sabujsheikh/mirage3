import React, { useEffect, useState } from 'react';
import {
  Search,
  Phone,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Order } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { OrderWorkspaceModal } from './OrderWorkspaceModal';
import { CustomerProfileModal } from './CustomerProfileModal';
import { CancelOrderModal } from './CancelOrderModal';
import { EditOrderModal } from './EditOrderModal';
import {
  PAGE_SIZE_OPTIONS,
  orderPaymentState,
  getCustomerStats,
} from './orderHelpers';

export const ScheduledOrdersView: React.FC = () => {
  const {
    customers,
    orders,
    cancelOrder,
    refreshAll,
    customerReturns,
  } = useApp();

  // Page state
  const [pageOrders, setPageOrders] = useState<Order[]>([]);
  const [serverTotal, setServerTotal] = useState(0);
  const [serverTotalPages, setServerTotalPages] = useState(1);
  const [serverPageSize, setServerPageSize] = useState(25);
  const effectivePageSize = serverPageSize === 0 ? 100000 : serverPageSize;
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [pageRefreshKey, setPageRefreshKey] = useState(0);

  // Tabs for Scheduled: all | due_today | upcoming | future | overdue
  const [activeTab, setActiveTab] = useState<'all' | 'due_today' | 'upcoming' | 'future' | 'overdue'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [isProcessingMove, setIsProcessingMove] = useState(false);

  // Modals
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [customerProfileData, setCustomerProfileData] = useState<{
    customerName: string;
    phone: string;
    address: string;
    rating: number;
    notes: string;
    stats: any;
    orders: Order[];
  } | null>(null);
  const [cancellationTarget, setCancellationTarget] = useState<Order | null>(null);

  const dhakaDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  // Fetch scheduled orders from API
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      page: String(currentPage),
      page_size: String(effectivePageSize),
      view: 'scheduled',
    });

    if (searchQuery.trim()) params.set('search', searchQuery.trim());

    setIsLoadingOrders(true);
    fetch(`/api/orders?${params.toString()}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((result) => {
        if (controller.signal.aborted) return;
        setPageOrders(result.orders || []);
        setServerTotal(result.total || 0);
        setServerTotalPages(result.total_pages || 1);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') console.error('Failed to fetch scheduled orders:', err);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingOrders(false);
      });

    return () => controller.abort();
  }, [effectivePageSize, currentPage, searchQuery, pageRefreshKey]);

  // Calculate days difference from today
  const getScheduleDiffDays = (scheduledDate?: string) => {
    if (!scheduledDate) return 999;
    const today = new Date(dhakaDate);
    const target = new Date(scheduledDate);
    const diffTime = target.getTime() - today.getTime();
    return Math.round(diffTime / (1000 * 3600 * 24));
  };

  // Filter orders by active tab (strictly excluding cancelled orders)
  const displayedOrders = pageOrders.filter((order) => {
    if (order.status === 'cancelled') return false;
    const diff = getScheduleDiffDays(order.scheduled_date);

    if (activeTab === 'due_today' && diff !== 0) return false;
    if (activeTab === 'overdue' && diff >= 0) return false;
    if (activeTab === 'upcoming' && (diff <= 0 || diff > 7)) return false;
    if (activeTab === 'future' && diff <= 7) return false;

    return true;
  });

  // Tab counts
  const dueTodayCount = pageOrders.filter((o) => getScheduleDiffDays(o.scheduled_date) === 0).length;
  const overdueCount = pageOrders.filter((o) => getScheduleDiffDays(o.scheduled_date) < 0).length;
  const upcomingCount = pageOrders.filter((o) => {
    const diff = getScheduleDiffDays(o.scheduled_date);
    return diff > 0 && diff <= 7;
  }).length;

  // Move single order to today's orders
  const handleMoveToToday = async (order: Order) => {
    setIsProcessingMove(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/move-to-today`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to move order to Today');
      }
      const updated = await res.json();
      if (selectedOrder?.id === order.id) setSelectedOrder(updated);
      await refreshAll();
      setPageRefreshKey((v) => v + 1);
    } catch (err: any) {
      alert(err.message || 'Error moving order to Today');
    } finally {
      setIsProcessingMove(false);
    }
  };

  // Bulk move to today
  const handleBulkMoveToToday = async () => {
    if (selectedOrderIds.length === 0) return;
    setIsProcessingMove(true);
    try {
      for (const orderId of selectedOrderIds) {
        await fetch(`/api/orders/${orderId}/move-to-today`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
      }
      await refreshAll();
      setSelectedOrderIds([]);
      setPageRefreshKey((v) => v + 1);
    } finally {
      setIsProcessingMove(false);
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedOrderIds(displayedOrders.map((o) => o.id));
    } else {
      setSelectedOrderIds([]);
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleConfirmCancellation = async (orderId: string, reason: string) => {
    await cancelOrder(orderId, reason);
    setSelectedOrder(null);
    setPageOrders((prev) => prev.filter((o) => o.id !== orderId));
    setServerTotal((prev) => Math.max(0, prev - 1));
    await refreshAll();
    setPageRefreshKey((v) => v + 1);
  };

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto" id="scheduled-orders-view">
      {/* Purpose Banner */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-[var(--text)]">Scheduled Orders Register</div>
            <div className="text-xs text-[var(--text-secondary)]">
              Orders scheduled for designated future delivery dates (birthdays, gifts, or requested schedules). Activate into Today&apos;s Queue when delivery date arrives.
            </div>
          </div>
        </div>
        <div className="text-right text-xs font-num whitespace-nowrap bg-[var(--surface)] border border-[var(--border)] px-3 py-1.5 rounded-lg font-semibold text-[var(--text)]">
          <span className="text-[var(--text-secondary)]">Scheduled: </span>
          <span className="text-amber-700 dark:text-amber-300 font-bold">{serverTotal}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          <button
            onClick={() => { setActiveTab('all'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'all'
                ? 'bg-[var(--accent)] text-[var(--accent-contrast)] shadow-xs'
                : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border)]'
            }`}
          >
            <span>All Scheduled</span>
            <span className="px-1.5 py-0.2 rounded font-num text-[10px] bg-black/15">{serverTotal}</span>
          </button>

          <button
            onClick={() => { setActiveTab('due_today'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'due_today'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border)]'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Due Today</span>
            <span className="px-1.5 py-0.2 rounded font-num text-[10px] bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
              {dueTodayCount}
            </span>
          </button>

          <button
            onClick={() => { setActiveTab('upcoming'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'upcoming'
                ? 'bg-[var(--accent)] text-[var(--accent-contrast)] shadow-xs'
                : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border)]'
            }`}
          >
            <span>Upcoming (Next 7 Days)</span>
            <span className="px-1.5 py-0.2 rounded font-num text-[10px] pill-teal border">
              {upcomingCount}
            </span>
          </button>

          <button
            onClick={() => { setActiveTab('future'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'future'
                ? 'bg-[var(--accent)] text-[var(--accent-contrast)] shadow-xs'
                : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border)]'
            }`}
          >
            <span>Future (Later)</span>
          </button>

          {overdueCount > 0 && (
            <button
              onClick={() => { setActiveTab('overdue'); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'overdue'
                  ? 'bg-[var(--status-red)] text-white shadow-xs'
                  : 'bg-[var(--surface)] text-[var(--status-red)] hover:bg-[var(--surface-hover)] border border-[var(--status-red)]/30'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Overdue</span>
              <span className="px-1.5 py-0.2 rounded font-num text-[10px] pill-red">
                {overdueCount}
              </span>
            </button>
          )}
        </div>

        {/* Floating Bulk Action Bar */}
        {selectedOrderIds.length > 0 && (
          <div className="rounded-xl border border-amber-500 bg-[var(--surface)] p-3 shadow-md flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-200">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-600 text-white text-xs font-bold font-num">
                {selectedOrderIds.length}
              </span>
              <span className="text-xs font-semibold text-[var(--text)]">
                {selectedOrderIds.length === 1 ? '1 scheduled order selected' : `${selectedOrderIds.length} scheduled orders selected`}
              </span>
              <button
                type="button"
                onClick={() => setSelectedOrderIds([])}
                className="text-xs text-[var(--text-secondary)] hover:text-[var(--text)] underline cursor-pointer ml-1"
              >
                Deselect all
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleBulkMoveToToday}
                disabled={isProcessingMove}
                className="erp-btn-primary !bg-emerald-600 hover:!bg-emerald-700 text-xs flex items-center gap-1.5 text-white disabled:opacity-50 cursor-pointer"
              >
                {isProcessingMove ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                <span>Activate / Move Selected to Today&apos;s Queue ({selectedOrderIds.length})</span>
              </button>
            </div>
          </div>
        )}

        {/* Filter Bar */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 shadow-xs flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                refreshAll();
                setPageRefreshKey((v) => v + 1);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] border-[var(--border)] transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Schedule</span>
            </button>
          </div>

          <div className="relative ml-auto">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              placeholder="Search scheduled orders, date, customer..."
              className="erp-input pl-7 w-52 sm:w-64 text-xs"
            />
            <Search className="w-3.5 h-3.5 text-[var(--text-secondary)] absolute left-2.5 top-2.5" />
          </div>
        </div>
      </div>

      {/* Scheduled Orders Table */}
      <div className="dense-table-container">
        <div className="overflow-auto max-h-[70vh]">
          <table className="dense-table min-w-[1350px]">
            <thead>
              <tr>
                <th className="w-28">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      onChange={handleSelectAll}
                      checked={displayedOrders.length > 0 && selectedOrderIds.length === displayedOrders.length}
                      disabled={displayedOrders.length === 0}
                      className="rounded border-[var(--border)] text-[var(--accent)] cursor-pointer w-3.5 h-3.5"
                    />
                    <span>Order #</span>
                  </div>
                </th>
                <th className="w-52">Customer &amp; Phone</th>
                <th className="w-48 text-center">Scheduled Delivery Date</th>
                <th className="w-36 text-center">Timing Status</th>
                <th className="w-56">Items &amp; Notes</th>
                <th className="w-28 text-right">Payment</th>
                <th className="w-24 text-right">Total</th>
                <th className="w-36 text-center">Activate Action</th>
              </tr>
            </thead>
            <tbody>
              {displayedOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-xs text-[var(--text-secondary)]">
                    No scheduled orders match the selected filter.
                  </td>
                </tr>
              ) : (
                displayedOrders.map((order) => {
                  const pState = orderPaymentState(order, customerReturns);
                  const isSelected = selectedOrderIds.includes(order.id);
                  const diff = getScheduleDiffDays(order.scheduled_date);

                  return (
                    <tr
                      key={order.id}
                      onClick={() => setSelectedOrder(order)}
                      className={`dense-table-row-clickable hover:bg-[var(--surface-hover)] ${
                        isSelected ? 'dense-table-row-selected' : ''
                      }`}
                    >
                      {/* Order # */}
                      <td className="align-middle">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleSelectOne(order.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded border-[var(--border)] text-[var(--accent)] cursor-pointer w-3.5 h-3.5"
                          />
                          <span className="font-num font-bold text-amber-700 dark:text-amber-300 hover:underline">
                            #{order.invoice_number.replace('INV-2026-', '')}
                          </span>
                        </div>
                      </td>

                      {/* Customer & Phone */}
                      <td className="align-middle">
                        <div className="space-y-0.5">
                          <div className="font-semibold text-[var(--text)] line-clamp-1">{order.customer_name}</div>
                          <div className="flex items-center gap-1 font-num text-[11px] text-[var(--accent)] font-semibold">
                            <Phone className="w-2.5 h-2.5 shrink-0" />
                            <span>{order.customer_phone}</span>
                          </div>
                        </div>
                      </td>

                      {/* Scheduled Delivery Date */}
                      <td className="align-middle text-center">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[var(--border)] bg-[var(--surface-sunken)] font-num font-bold text-xs text-[var(--text)]">
                          <Calendar className="w-3.5 h-3.5 text-amber-600" />
                          <span>{order.scheduled_date || 'Not specified'}</span>
                        </div>
                      </td>

                      {/* Timing Status */}
                      <td className="align-middle text-center">
                        {diff === 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 whitespace-nowrap animate-pulse">
                            <Clock className="w-3 h-3" />
                            <span>DUE TODAY</span>
                          </span>
                        ) : diff < 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold pill-red border whitespace-nowrap">
                            <AlertTriangle className="w-3 h-3" />
                            <span>OVERDUE ({Math.abs(diff)}d)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-[var(--surface-sunken)] text-[var(--text-secondary)] border border-[var(--border)] whitespace-nowrap font-num">
                            <span>In {diff} days</span>
                          </span>
                        )}
                      </td>

                      {/* Items & Notes */}
                      <td className="align-middle">
                        <div className="space-y-0.5">
                          <div className="text-[11px] font-medium text-[var(--text)] line-clamp-1">
                            {order.items.map((it) => `${it.quantity}x ${it.product_name}`).join(', ')}
                          </div>
                          {order.notes && (
                            <div className="text-[10px] text-amber-700 dark:text-amber-300 line-clamp-1">
                              Note: {order.notes}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Payment */}
                      <td className="align-middle text-right whitespace-nowrap font-num">
                        {pState.received > 0 ? (
                          <span className="font-bold text-[var(--status-green)] text-xs">
                            ৳{pState.received.toLocaleString()} paid
                          </span>
                        ) : (
                          <span className="text-[var(--text-secondary)] text-[11px]">COD Pending</span>
                        )}
                      </td>

                      {/* Total */}
                      <td className="align-middle text-right font-num font-bold text-[var(--text)]">
                        ৳{order.total.toLocaleString()}
                      </td>

                      {/* Action: Activate / Move to Today */}
                      <td className="align-middle text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleMoveToToday(order)}
                          disabled={isProcessingMove}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 mx-auto shadow-xs disabled:opacity-50 cursor-pointer whitespace-nowrap"
                          title="Activate and move into Today's Orders queue"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Move to Today</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Footer */}
      {displayedOrders.length > 0 && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="text-[11px] text-[var(--text-secondary)] font-num whitespace-nowrap">
            Showing {(currentPage - 1) * effectivePageSize + 1}–
            {Math.min(currentPage * effectivePageSize, serverTotal)} of {serverTotal}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] disabled:opacity-30 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-num text-[var(--text)] px-2 font-semibold">
              Page {currentPage} of {serverTotalPages}
            </span>
            <button
              onClick={() => setCurrentPage(Math.min(serverTotalPages, currentPage + 1))}
              disabled={currentPage >= serverTotalPages}
              className="p-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] disabled:opacity-30 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            <select
              value={serverPageSize}
              onChange={(e) => { setServerPageSize(Number(e.target.value)); setCurrentPage(1); }}
              className="erp-select text-xs ml-2"
            >
              {PAGE_SIZE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt === 0 ? 'All' : `${opt} / page`}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Shared Order Workspace Modal */}
      {selectedOrder && (
        <OrderWorkspaceModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onMoveToToday={handleMoveToToday}
          isMoving={isProcessingMove}
          onCancelOrder={(order) => setCancellationTarget(order)}
          onEditOrder={(order) => {
            setEditingOrder(order);
            setShowEditModal(true);
          }}
        />
      )}

      {/* Edit Order Modal */}
      {editingOrder && (
        <EditOrderModal
          order={editingOrder}
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setEditingOrder(null);
          }}
          onOrderUpdated={(updated) => setSelectedOrder(updated)}
        />
      )}

      {/* Customer Profile Modal */}
      {customerProfileData && (
        <CustomerProfileModal
          data={customerProfileData}
          onClose={() => setCustomerProfileData(null)}
          onUpdateRating={() => {}}
        />
      )}

      {/* Cancel Order Modal */}
      {cancellationTarget && (
        <CancelOrderModal
          order={cancellationTarget}
          isOpen={true}
          onClose={() => setCancellationTarget(null)}
          onConfirm={handleConfirmCancellation}
        />
      )}
    </div>
  );
};
