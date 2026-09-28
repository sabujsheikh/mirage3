import React, { useEffect, useState } from 'react';
import {
  Search,
  Phone,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  XCircle,
  AlertTriangle,
  FileText,
  DollarSign,
  User,
  Clock,
  RotateCcw,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Order } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { OrderWorkspaceModal } from './OrderWorkspaceModal';
import { CustomerProfileModal } from './CustomerProfileModal';
import {
  PAGE_SIZE_OPTIONS,
  getCustomerStats,
} from './orderHelpers';

const REASON_CATEGORIES = [
  { id: 'all', label: 'All Cancelled' },
  { id: 'stock', label: 'Out of Stock' },
  { id: 'mind', label: 'Customer Changed Mind' },
  { id: 'unreachable', label: 'Customer Unreachable' },
  { id: 'fraud', label: 'Other / Fraud Risk' },
];

export const CancelledOrdersView: React.FC = () => {
  const {
    customers,
    orders,
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

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [reasonDropdownFilter, setReasonDropdownFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);

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

  // Fetch cancelled orders
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      page: String(currentPage),
      page_size: String(effectivePageSize),
      status: 'cancelled',
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
        if (err.name !== 'AbortError') console.error('Failed to fetch cancelled orders:', err);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingOrders(false);
      });

    return () => controller.abort();
  }, [effectivePageSize, currentPage, searchQuery, pageRefreshKey]);

  // Client-side categorization filter
  const displayedOrders = pageOrders.filter((order) => {
    const reasonText = (order.cancel_reason || '').toLowerCase();

    if (activeCategory === 'stock' && !reasonText.includes('stock')) return false;
    if (activeCategory === 'mind' && !reasonText.includes('mind') && !reasonText.includes('change')) return false;
    if (activeCategory === 'unreachable' && !reasonText.includes('unreachable') && !reasonText.includes('response')) return false;
    if (activeCategory === 'fraud' && (reasonText.includes('stock') || reasonText.includes('mind') || reasonText.includes('unreachable'))) return false;

    if (reasonDropdownFilter !== 'all') {
      if (reasonDropdownFilter === 'stock' && !reasonText.includes('stock')) return false;
      if (reasonDropdownFilter === 'mind' && !reasonText.includes('mind') && !reasonText.includes('change')) return false;
      if (reasonDropdownFilter === 'unreachable' && !reasonText.includes('unreachable')) return false;
      if (reasonDropdownFilter === 'fraud' && !reasonText.includes('fraud') && !reasonText.includes('fake')) return false;
    }

    return true;
  });

  const totalRefundedSum = displayedOrders.reduce((sum, o) => sum + (o.refunded_amount || 0), 0);

  const handleOpenCustomerProfile = (e: React.MouseEvent, order: Order) => {
    e.stopPropagation();
    const stats = getCustomerStats(order.customer_phone, order.id, customers, orders);
    setCustomerProfileData({
      customerName: order.customer_name,
      phone: order.customer_phone,
      address: order.delivery_address_text || 'Showroom In-Store Handoff',
      rating: stats.currentRating,
      notes: order.notes || 'Order cancelled record.',
      stats,
      orders: stats.allOrders.length > 0 ? stats.allOrders : [order],
    });
  };

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto" id="cancelled-orders-view">
      {/* Purpose Banner */}
      <div className="bg-[var(--status-red)]/10 border border-[var(--status-red)]/30 rounded-xl px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[var(--status-red)]/20 text-[var(--status-red)] flex items-center justify-center shrink-0">
            <XCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-[var(--text)]">Cancelled Orders Register &amp; Audit Trail</div>
            <div className="text-xs text-[var(--text-secondary)]">
              Auditing cancelled orders, root-cause reasons, refund accountability, and physical stock recovery status.
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right text-xs font-num whitespace-nowrap bg-[var(--surface)] border border-[var(--border)] px-3 py-1.5 rounded-lg font-semibold text-[var(--text)]">
            <span className="text-[var(--text-secondary)]">Total Cancelled: </span>
            <span className="text-[var(--status-red)] font-bold">{serverTotal}</span>
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          {REASON_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => { setActiveCategory(cat.id); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeCategory === cat.id
                  ? 'bg-[var(--status-red)] text-white shadow-xs'
                  : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border)]'
              }`}
            >
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Filter Bar */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 shadow-xs flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={reasonDropdownFilter}
              onChange={(e) => { setReasonDropdownFilter(e.target.value); setCurrentPage(1); }}
              className="erp-select text-xs font-semibold"
            >
              <option value="all">All Reasons</option>
              <option value="stock">Product Out of Stock</option>
              <option value="mind">Customer Changed Mind</option>
              <option value="unreachable">Customer Unreachable</option>
              <option value="fraud">Suspected Fake / Fraud</option>
            </select>

            <button
              type="button"
              onClick={() => {
                refreshAll();
                setPageRefreshKey((v) => v + 1);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] border-[var(--border)] transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>

          <div className="relative ml-auto">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              placeholder="Search by customer, phone, reason..."
              className="erp-input pl-7 w-52 sm:w-64 text-xs"
            />
            <Search className="w-3.5 h-3.5 text-[var(--text-secondary)] absolute left-2.5 top-2.5" />
          </div>
        </div>
      </div>

      {/* Cancelled Orders High-Density Table */}
      <div className="dense-table-container">
        <div className="overflow-auto max-h-[70vh]">
          <table className="dense-table min-w-[1300px]">
            <thead>
              <tr>
                <th className="w-28">Order #</th>
                <th className="w-56">Customer &amp; Phone</th>
                <th className="w-28">Cancelled Date</th>
                <th className="w-48">Cancellation Reason</th>
                <th className="w-32">Cancelled By</th>
                <th className="w-24 text-center">Prev. Status</th>
                <th className="w-28 text-right">Refund Status</th>
                <th className="w-36 text-center">Stock Recovery</th>
                <th className="w-24 text-right">Order Total</th>
                <th className="w-20 text-center">Audit</th>
              </tr>
            </thead>
            <tbody>
              {displayedOrders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-10 text-center text-xs text-[var(--text-secondary)]">
                    No cancelled orders match the selected reason criteria.
                  </td>
                </tr>
              ) : (
                displayedOrders.map((order) => {
                  const cancelledDate = order.cancelled_at
                    ? new Date(order.cancelled_at).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : new Date(order.created_at).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      });

                  const isRefunded = (order.refunded_amount || 0) > 0;
                  const needsPhysicalRecovery = order.physical_recovery_required;

                  return (
                    <tr
                      key={order.id}
                      onClick={() => setSelectedOrder(order)}
                      className="dense-table-row-clickable hover:bg-[var(--surface-hover)]"
                    >
                      {/* Order column */}
                      <td className="align-middle">
                        <span className="font-num font-bold text-[var(--status-red)] hover:underline">
                          #{order.invoice_number.replace('INV-2026-', '')}
                        </span>
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

                      {/* Cancelled Date */}
                      <td className="align-middle text-[11px] text-[var(--text-secondary)] whitespace-nowrap font-num">
                        {cancelledDate}
                      </td>

                      {/* Reason */}
                      <td className="align-middle">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-[var(--status-red)]/10 text-[var(--status-red)] border border-[var(--status-red)]/30 line-clamp-1">
                          {order.cancel_reason || 'Cancelled by staff'}
                        </span>
                      </td>

                      {/* Cancelled By */}
                      <td className="align-middle text-[11px] text-[var(--text-secondary)] whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3 text-[var(--text-secondary)]" />
                          <span>{order.cancelled_by_name || order.created_by_name || 'Staff'}</span>
                        </div>
                      </td>

                      {/* Previous Status */}
                      <td className="align-middle text-center whitespace-nowrap">
                        {order.cancelled_from_status ? (
                          <span className="text-[10px] uppercase font-bold text-[var(--text-secondary)] bg-[var(--surface-sunken)] px-1.5 py-0.5 rounded border border-[var(--border)]">
                            {order.cancelled_from_status}
                          </span>
                        ) : (
                          <span className="text-[var(--text-secondary)] text-[10px]">—</span>
                        )}
                      </td>

                      {/* Refund Status */}
                      <td className="align-middle text-right whitespace-nowrap">
                        {isRefunded ? (
                          <span className="font-num font-bold text-[var(--status-amber)] text-xs">
                            ৳{(order.refunded_amount || 0).toLocaleString()} refunded
                          </span>
                        ) : (
                          <span className="text-[var(--text-secondary)] text-[11px]">No refund</span>
                        )}
                      </td>

                      {/* Stock Recovery Status */}
                      <td className="align-middle text-center whitespace-nowrap">
                        {needsPhysicalRecovery ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold pill-amber border">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Scan-back Required</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-[var(--surface-sunken)] text-[var(--text-secondary)] border border-[var(--border)]">
                            <RotateCcw className="w-2.5 h-2.5" />
                            <span>Reserved Released</span>
                          </span>
                        )}
                      </td>

                      {/* Total */}
                      <td className="align-middle text-right font-num font-bold text-[var(--text)] line-through opacity-75">
                        ৳{order.total.toLocaleString()}
                      </td>

                      {/* Audit */}
                      <td className="align-middle text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setSelectedOrder(order)}
                          className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--surface-hover)] rounded-lg transition-colors cursor-pointer"
                          title="View order audit record"
                        >
                          <FileText className="w-4 h-4" />
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
              aria-label="Previous page"
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
              aria-label="Next page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            <select
              value={serverPageSize}
              onChange={(e) => { setServerPageSize(Number(e.target.value)); setCurrentPage(1); }}
              className="erp-select text-xs ml-2"
              aria-label="Orders per page"
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

      {/* Shared Order Workspace Modal for inspecting the cancelled order */}
      {selectedOrder && (
        <OrderWorkspaceModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
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
    </div>
  );
};
