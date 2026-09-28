import React, { useEffect, useState } from 'react';
import {
  Search,
  Phone,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Boxes,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Clock,
  ArrowRight,
  Package,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Order } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { OrderWorkspaceModal } from './OrderWorkspaceModal';
import { CustomerProfileModal } from './CustomerProfileModal';
import { CancelOrderModal } from './CancelOrderModal';
import {
  PAGE_SIZE_OPTIONS,
  orderPaymentState,
  getCustomerStats,
} from './orderHelpers';

export const PreOrdersView: React.FC = () => {
  const {
    customers,
    orders,
    products,
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

  // Tabs for Pre-Orders: all | in_stock | awaiting | advance_paid | cod_pending
  const [activeTab, setActiveTab] = useState<'all' | 'in_stock' | 'awaiting' | 'advance_paid' | 'cod_pending'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [isProcessingMove, setIsProcessingMove] = useState(false);

  // Modals
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
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

  // Fetch pre-orders from API
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      page: String(currentPage),
      page_size: String(effectivePageSize),
      view: 'pre_orders',
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
        if (err.name !== 'AbortError') console.error('Failed to fetch pre-orders:', err);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingOrders(false);
      });

    return () => controller.abort();
  }, [effectivePageSize, currentPage, searchQuery, pageRefreshKey]);

  // Check product stock availability for pre-orders
  const checkOrderStockAvailable = (order: Order): {
    allInStock: boolean;
    stockDetails: { productName: string; available: number; required: number }[];
  } => {
    let allInStock = true;
    const stockDetails = (order.items || []).map((item) => {
      const prod = products.find((p) => p.id === item.product_id);
      const totalAvailable = prod?.stock_available ?? 0;
      if (totalAvailable < item.quantity) {
        allInStock = false;
      }
      return {
        productName: item.product_name,
        available: totalAvailable,
        required: item.quantity,
      };
    });

    return { allInStock, stockDetails };
  };

  // Filter orders by active tab (strictly excluding cancelled orders)
  const displayedOrders = pageOrders.filter((order) => {
    if (order.status === 'cancelled') return false;
    const { allInStock } = checkOrderStockAvailable(order);
    const pState = orderPaymentState(order, customerReturns);

    if (activeTab === 'in_stock' && !allInStock) return false;
    if (activeTab === 'awaiting' && allInStock) return false;
    if (activeTab === 'advance_paid' && pState.state === 'unpaid') return false;
    if (activeTab === 'cod_pending' && pState.state !== 'unpaid') return false;

    return true;
  });

  // Tab counts
  const stockAvailableCount = pageOrders.filter((o) => checkOrderStockAvailable(o).allInStock).length;
  const awaitingCount = pageOrders.filter((o) => !checkOrderStockAvailable(o).allInStock).length;

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
    <div className="space-y-4 max-w-[1400px] mx-auto" id="pre-orders-view">
      {/* Purpose Banner */}
      <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-purple-500/20 text-purple-700 dark:text-purple-300 flex items-center justify-center shrink-0">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-[var(--text)]">Pre-Orders Register &amp; Inbound Stock Intake</div>
            <div className="text-xs text-[var(--text-secondary)]">
              Orders awaiting inbound import shipments. Check component inventory availability and activate into Today&apos;s Orders once stock arrives.
            </div>
          </div>
        </div>
        <div className="text-right text-xs font-num whitespace-nowrap bg-[var(--surface)] border border-[var(--border)] px-3 py-1.5 rounded-lg font-semibold text-[var(--text)]">
          <span className="text-[var(--text-secondary)]">Pre-Orders: </span>
          <span className="text-purple-700 dark:text-purple-300 font-bold">{serverTotal}</span>
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
            <span>All Pre-Orders</span>
            <span className="px-1.5 py-0.2 rounded font-num text-[10px] bg-black/15">{serverTotal}</span>
          </button>

          <button
            onClick={() => { setActiveTab('in_stock'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'in_stock'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border)]'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Stock Now Available</span>
            <span className="px-1.5 py-0.2 rounded font-num text-[10px] bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
              {stockAvailableCount}
            </span>
          </button>

          <button
            onClick={() => { setActiveTab('awaiting'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'awaiting'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border)]'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Awaiting Stock</span>
            <span className="px-1.5 py-0.2 rounded font-num text-[10px] bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
              {awaitingCount}
            </span>
          </button>

          <button
            onClick={() => { setActiveTab('advance_paid'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'advance_paid'
                ? 'bg-[var(--accent)] text-[var(--accent-contrast)] shadow-xs'
                : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border)]'
            }`}
          >
            <span>Advance Paid</span>
          </button>

          <button
            onClick={() => { setActiveTab('cod_pending'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'cod_pending'
                ? 'bg-[var(--accent)] text-[var(--accent-contrast)] shadow-xs'
                : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border)]'
            }`}
          >
            <span>COD Pending</span>
          </button>
        </div>

        {/* Floating Bulk Action Bar */}
        {selectedOrderIds.length > 0 && (
          <div className="rounded-xl border border-emerald-500 bg-[var(--surface)] p-3 shadow-md flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-200">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold font-num">
                {selectedOrderIds.length}
              </span>
              <span className="text-xs font-semibold text-[var(--text)]">
                {selectedOrderIds.length === 1 ? '1 pre-order selected' : `${selectedOrderIds.length} pre-orders selected`}
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
                <span>Move Selected to Today&apos;s Queue ({selectedOrderIds.length})</span>
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
              <span>Refresh Pre-Orders</span>
            </button>
          </div>

          <div className="relative ml-auto">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              placeholder="Search pre-orders, perfume SKU, customer..."
              className="erp-input pl-7 w-52 sm:w-64 text-xs"
            />
            <Search className="w-3.5 h-3.5 text-[var(--text-secondary)] absolute left-2.5 top-2.5" />
          </div>
        </div>
      </div>

      {/* Pre-Orders Table */}
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
                <th className="w-24">Order Date</th>
                <th className="w-64">Items Requested</th>
                <th className="w-48 text-center">Current Stock Status</th>
                <th className="w-28 text-right">Advance Paid</th>
                <th className="w-24 text-right">Order Total</th>
                <th className="w-36 text-center">Fulfill Action</th>
              </tr>
            </thead>
            <tbody>
              {displayedOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-xs text-[var(--text-secondary)]">
                    No pre-orders match the selected filter.
                  </td>
                </tr>
              ) : (
                displayedOrders.map((order) => {
                  const { allInStock, stockDetails } = checkOrderStockAvailable(order);
                  const pState = orderPaymentState(order, customerReturns);
                  const isSelected = selectedOrderIds.includes(order.id);

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
                          <span className="font-num font-bold text-purple-700 dark:text-purple-300 hover:underline">
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

                      {/* Order Date */}
                      <td className="align-middle text-[11px] text-[var(--text-secondary)] whitespace-nowrap font-num">
                        {new Date(order.created_at).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </td>

                      {/* Items Requested */}
                      <td className="align-middle">
                        <div className="space-y-1">
                          {order.items.map((it, idx) => (
                            <div key={idx} className="text-[11px] flex items-center justify-between gap-2">
                              <span className="font-medium text-[var(--text)] line-clamp-1">{it.product_name}</span>
                              <span className="font-num font-bold text-[var(--text-secondary)] whitespace-nowrap">
                                {it.quantity}x
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>

                      {/* Stock Status */}
                      <td className="align-middle text-center">
                        {allInStock ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 whitespace-nowrap">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>In Stock — Ready to Fulfill</span>
                          </span>
                        ) : (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 whitespace-nowrap">
                              <AlertTriangle className="w-3 h-3" />
                              <span>Awaiting Inbound Stock</span>
                            </span>
                            <div className="text-[9px] text-[var(--text-secondary)]">
                              {stockDetails
                                .filter((s) => s.available < s.required)
                                .map((s) => `${s.productName.slice(0, 15)}: ${s.available} avail`)
                                .join(', ')}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Advance Paid */}
                      <td className="align-middle text-right whitespace-nowrap font-num">
                        {pState.received > 0 ? (
                          <span className="font-bold text-[var(--status-green)]">
                            ৳{pState.received.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-[var(--text-secondary)] text-[11px]">Unpaid (COD)</span>
                        )}
                      </td>

                      {/* Total */}
                      <td className="align-middle text-right font-num font-bold text-[var(--text)]">
                        ৳{order.total.toLocaleString()}
                      </td>

                      {/* Action: Move to Today */}
                      <td className="align-middle text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleMoveToToday(order)}
                          disabled={isProcessingMove}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 mx-auto shadow-xs disabled:opacity-50 cursor-pointer whitespace-nowrap"
                          title="Move to Today's Orders queue to begin fulfillment"
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
