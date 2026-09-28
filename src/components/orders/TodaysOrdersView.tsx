import React, { useEffect, useState, useRef } from 'react';
import {
  Search,
  Printer,
  Phone,
  Truck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Send,
  RefreshCw,
  Star,
  Tag,
  Building2,
  X,
  ChevronDown,
  MoreVertical,
  Store,
  FileText,
  AlertTriangle,
  Copy,
  Check,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Order, OrderStatus } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { InvoiceModal } from './InvoiceModal';
import { EditOrderModal } from './EditOrderModal';
import { MerchantStickerModal } from '../packing/MerchantStickerModal';
import { OrderWorkspaceModal } from './OrderWorkspaceModal';
import { CustomerProfileModal } from './CustomerProfileModal';
import { CancelOrderModal } from './CancelOrderModal';
import { Modal } from '../common/Modal';
import { generateShippingLabelPdf } from '../../lib/labelPdf';
import { generateInvoicePdf } from '../../lib/invoicePdf';
import { generateOrderSheetPdf } from '../../lib/orderSheetPdf';
import {
  PAGE_SIZE_OPTIONS,
  fulfillmentLabel,
  orderPaymentState,
  orderCodStatus,
  getRelativeTime,
  getCustomerStats,
} from './orderHelpers';

export const TodaysOrdersView: React.FC = () => {
  const {
    orders,
    products,
    customers,
    courierBookings,
    bookCourier,
    cancelOrder,
    refreshAll,
    settings,
    customerReturns,
  } = useApp();
  const { can } = useAuth();

  // Page state
  const [pageOrders, setPageOrders] = useState<Order[]>([]);
  const [serverTotal, setServerTotal] = useState(0);
  const [serverTotalPages, setServerTotalPages] = useState(1);
  const [serverStatusCounts, setServerStatusCounts] = useState<Record<string, number>>({});
  const [serverPageSize, setServerPageSize] = useState(25);
  const effectivePageSize = serverPageSize === 0 ? 100000 : serverPageSize;
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [pageRefreshKey, setPageRefreshKey] = useState(0);

  // Tabs for Today: all | needs_booking | confirmed | packed | dispatched
  const [activeTab, setActiveTab] = useState<'all' | 'needs_booking' | 'confirmed' | 'packed' | 'dispatched'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState<'all' | 'messenger' | 'walk-in'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);
  const [bookingOrderIds, setBookingOrderIds] = useState<Set<string>>(new Set());
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSuccessMsg, setBookingSuccessMsg] = useState<string | null>(null);

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => new Set(['payment', 'items']));
  const [showColumnsDropdown, setShowColumnsDropdown] = useState(false);
  const columnsDropdownRef = useRef<HTMLDivElement>(null);

  // Table header menu
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const headerMenuRef = useRef<HTMLDivElement>(null);

  // Glance Popover & Customer profile
  const [glancePopover, setGlancePopover] = useState<{ order: Order; x: number; y: number } | null>(null);
  const [customerRatings, setCustomerRatings] = useState<Record<string, number>>({});
  const [customerProfileData, setCustomerProfileData] = useState<{
    customerName: string;
    phone: string;
    address: string;
    rating: number;
    notes: string;
    stats: any;
    orders: Order[];
  } | null>(null);

  // Modals
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [activeInvoiceOrder, setActiveInvoiceOrder] = useState<Order | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [showMerchantStickerModal, setShowMerchantStickerModal] = useState(false);
  const [merchantStickerOrder, setMerchantStickerOrder] = useState<Order | null>(null);
  const [cancellationTarget, setCancellationTarget] = useState<Order | null>(null);
  const [stickerBlockMsg, setStickerBlockMsg] = useState<string | null>(null);

  // Close menus on outside click / escape
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (columnsDropdownRef.current && !columnsDropdownRef.current.contains(e.target as Node)) {
        setShowColumnsDropdown(false);
      }
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target as Node)) {
        setShowHeaderMenu(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowColumnsDropdown(false);
        setShowHeaderMenu(false);
        setGlancePopover(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  // Fetch orders for Today's Work Queue from backend API
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      page: String(currentPage),
      page_size: String(effectivePageSize),
      view: 'today',
    });

    if (activeTab === 'confirmed' || activeTab === 'packed' || activeTab === 'dispatched') {
      params.set('status', activeTab);
    }
    if (channelFilter !== 'all') params.set('channel', channelFilter);
    if (searchQuery.trim()) params.set('search', searchQuery.trim());

    setIsLoadingOrders(true);
    fetch(`/api/orders?${params.toString()}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((result) => {
        if (controller.signal.aborted) return;
        setPageOrders(result.orders || []);
        setServerTotal(result.total || 0);
        setServerTotalPages(result.total_pages || 1);
        setServerStatusCounts(result.status_counts || {});
      })
      .catch((err) => {
        if (err.name !== 'AbortError') console.error('Failed to fetch today orders:', err);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingOrders(false);
      });

    return () => controller.abort();
  }, [activeTab, channelFilter, effectivePageSize, currentPage, searchQuery, pageRefreshKey]);

  const isOrderBooked = (order: Order) =>
    Boolean(
      order.courier_booked ||
      order.courier_tracking_code ||
      courierBookings.some((b) => b.order_id === order.id && (b.consignment_no || b.booking_id))
    );

  // Client-side filtering for 'needs_booking' tab if selected, and strictly excluding cancelled orders
  const displayedOrders = pageOrders.filter((order) => {
    if (order.status === 'cancelled') return false;
    if (activeTab === 'needs_booking') {
      return (
        (order.fulfillment_method === 'steadfast' || !order.fulfillment_method) &&
        ['confirmed', 'packed'].includes(order.status) &&
        !isOrderBooked(order)
      );
    }
    return true;
  });

  // Tab counts
  const allKnownOrders = pageOrders.length > 0 ? pageOrders : orders;
  const needsBookingCount = allKnownOrders.filter(
    (o) =>
      o.status !== 'cancelled' &&
      (o.fulfillment_method === 'steadfast' || !o.fulfillment_method) &&
      ['confirmed', 'packed'].includes(o.status) &&
      !isOrderBooked(o)
  ).length;

  const counts = {
    all: serverTotal,
    needs_booking: needsBookingCount,
    confirmed: serverStatusCounts.confirmed || 0,
    packed: serverStatusCounts.packed || 0,
    dispatched: serverStatusCounts.dispatched || 0,
  };

  // Bulk selections
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

  const getSelectedOrders = (): Order[] => {
    const map = new Map<string, Order>();
    orders.forEach((o) => map.set(o.id, o));
    pageOrders.forEach((o) => map.set(o.id, o));
    return selectedOrderIds.map((id) => map.get(id)).filter((o): o is Order => Boolean(o));
  };

  const selectedOrdersList = getSelectedOrders();

  const bulkTargetCounts = {
    book: selectedOrdersList.filter(
      (o) =>
        (o.fulfillment_method === 'steadfast' || !o.fulfillment_method) &&
        ['confirmed', 'packed'].includes(o.status) &&
        !isOrderBooked(o)
    ).length,
    stickers: selectedOrdersList.filter(
      (o) => (o.fulfillment_method === 'steadfast' || !o.fulfillment_method) && isOrderBooked(o)
    ).length,
    invoices: selectedOrdersList.filter(
      (o) => o.order_type !== 'merchant_fulfillment'
    ).length,
  };

  // Single order booking with Steadfast
  const handleBookSingle = async (e: React.MouseEvent, order: Order) => {
    e.stopPropagation();
    if (bookingOrderIds.has(order.id) || isProcessingBulk) return;
    setBookingOrderIds((prev) => new Set(prev).add(order.id));
    setBookingError(null);
    try {
      const booked = await bookCourier(order.id);
      const tracking = booked.courier_tracking_code || booked.courier_consignment_id || 'booked';
      setBookingSuccessMsg(`Order #${order.invoice_number.replace('INV-2026-', '')} booked with Steadfast! (Consignment: ${tracking})`);
      setTimeout(() => setBookingSuccessMsg(null), 4000);
      await refreshAll();
      setPageRefreshKey((v) => v + 1);
    } catch (err: any) {
      console.error('Failed to book Steadfast order:', err);
      setBookingError(`Failed to book #${order.invoice_number.replace('INV-2026-', '')}: ${err.message || 'Courier API error'}`);
      setTimeout(() => setBookingError(null), 6000);
    } finally {
      setBookingOrderIds((prev) => {
        const next = new Set(prev);
        next.delete(order.id);
        return next;
      });
    }
  };

  // Bulk booking for selected orders
  const handleBulkBook = async () => {
    const targets = selectedOrdersList.filter(
      (o) =>
        (o.fulfillment_method === 'steadfast' || !o.fulfillment_method) &&
        ['confirmed', 'packed'].includes(o.status) &&
        !isOrderBooked(o)
    );
    if (targets.length === 0) return;
    setIsProcessingBulk(true);
    setBookingError(null);
    let successCount = 0;
    const errors: string[] = [];
    try {
      for (const target of targets) {
        try {
          await bookCourier(target.id);
          successCount++;
        } catch (err: any) {
          errors.push(`#${target.invoice_number.replace('INV-2026-', '')}: ${err.message}`);
        }
      }
      await refreshAll();
      setSelectedOrderIds([]);
      setPageRefreshKey((v) => v + 1);
      if (successCount > 0) {
        setBookingSuccessMsg(`Successfully booked ${successCount} order(s) to Steadfast Courier.`);
        setTimeout(() => setBookingSuccessMsg(null), 4000);
      }
      if (errors.length > 0) {
        setBookingError(`Errors on ${errors.length} order(s): ${errors.slice(0, 3).join(', ')}${errors.length > 3 ? '...' : ''}`);
        setTimeout(() => setBookingError(null), 6000);
      }
    } finally {
      setIsProcessingBulk(false);
    }
  };

  // Book all unbooked eligible orders currently active today
  const handleBookAllUnbooked = async () => {
    const targets = displayedOrders.filter(
      (o) =>
        o.status !== 'cancelled' &&
        (o.fulfillment_method === 'steadfast' || !o.fulfillment_method) &&
        ['confirmed', 'packed'].includes(o.status) &&
        !isOrderBooked(o)
    );
    if (targets.length === 0) return;
    setIsProcessingBulk(true);
    setBookingError(null);
    let successCount = 0;
    const errors: string[] = [];
    try {
      for (const target of targets) {
        try {
          await bookCourier(target.id);
          successCount++;
        } catch (err: any) {
          errors.push(`#${target.invoice_number.replace('INV-2026-', '')}: ${err.message}`);
        }
      }
      await refreshAll();
      setSelectedOrderIds([]);
      setPageRefreshKey((v) => v + 1);
      if (successCount > 0) {
        setBookingSuccessMsg(`Successfully booked all ${successCount} order(s) to Steadfast Courier.`);
        setTimeout(() => setBookingSuccessMsg(null), 4000);
      }
      if (errors.length > 0) {
        setBookingError(`Failed to book ${errors.length} order(s): ${errors.slice(0, 3).join(', ')}${errors.length > 3 ? '...' : ''}`);
        setTimeout(() => setBookingError(null), 6000);
      }
    } finally {
      setIsProcessingBulk(false);
    }
  };

  const handleBulkPrintStickers = () => {
    const targets = orders.filter(
      (o) => selectedOrderIds.includes(o.id) && o.fulfillment_method === 'steadfast' && isOrderBooked(o)
    );
    if (targets.length === 0) return;
    targets.forEach((target) => {
      generateShippingLabelPdf(target, {
        business_name: settings?.company_name || 'Mirage Perfume Bangladesh',
        business_phone: settings?.phone || '',
      });
    });
  };

  const handleBulkPrintInvoices = () => {
    const targets = orders.filter(
      (o) => selectedOrderIds.includes(o.id) && o.order_type !== 'merchant_fulfillment'
    );
    if (targets.length === 0) return;
    targets.forEach((target) => {
      generateInvoicePdf(target, {
        business_name: settings?.company_name || 'Mirage Perfume Bangladesh',
        business_phone: settings?.phone || '',
        business_address: settings?.address || '',
      });
    });
  };

  const handleSendToSteadfast = async (e: React.MouseEvent, order: Order) => {
    e.stopPropagation();
    if (!['confirmed', 'packed'].includes(order.status)) return;
    await bookCourier(order.id);
    await refreshAll();
    setPageRefreshKey((v) => v + 1);
  };

  const handleOpenCustomerProfile = (e: React.MouseEvent, order: Order) => {
    e.stopPropagation();
    const stats = getCustomerStats(order.customer_phone, order.id, customers, orders, customerRatings);
    const normalizedPhone = order.customer_phone.replace(/[^0-9]/g, '');

    setCustomerProfileData({
      customerName: order.customer_name,
      phone: order.customer_phone,
      address: order.delivery_address_text || 'Showroom In-Store Handoff',
      rating: customerRatings[normalizedPhone] || stats.currentRating,
      notes:
        order.notes ||
        (stats.isRisk
          ? 'Requires advance COD verification before dispatch.'
          : 'VIP Customer. Priority fragrance packaging.'),
      stats,
      orders: stats.allOrders.length > 0 ? stats.allOrders : [order],
    });
  };

  const handleConfirmCancellation = async (orderId: string, reason: string) => {
    await cancelOrder(orderId, reason);
    setSelectedOrder(null);
    setPageOrders((prev) => prev.filter((o) => o.id !== orderId));
    setServerTotal((prev) => Math.max(0, prev - 1));
    await refreshAll();
    setPageRefreshKey((v) => v + 1);
  };

  const hasWesternPendingWork = (order: Order) =>
    !['packed', 'dispatched', 'delivered', 'cancelled', 'returned', 'rto'].includes(order.status) &&
    order.items.some(
      (item) =>
        item.perfume_type === 'Western' ||
        products.some((product) => product.id === item.product_id && product.perfume_type === 'Western')
    );

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto" id="todays-orders-view">
      {/* Purpose Banner */}
      <div className="bg-[var(--accent)] text-[var(--accent-contrast)] rounded-xl px-4 py-3 flex items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="text-sm font-bold">Today&apos;s Work Queue</div>
          <div className="text-xs opacity-85">
            Operational processing for orders scheduled or confirmed today. Review, book couriers, pack, and complete dispatch.
          </div>
        </div>
        <div className="text-right text-xs font-num whitespace-nowrap bg-black/15 px-3 py-1.5 rounded-lg font-semibold">
          {counts.confirmed + counts.packed + counts.dispatched} Active Today
        </div>
      </div>

      {/* Booking feedback toasts */}
      {bookingSuccessMsg && (
        <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 bg-emerald-500/10 border border-emerald-500/25 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs font-semibold animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{bookingSuccessMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setBookingSuccessMsg(null)}
            className="p-1 text-emerald-600 hover:text-emerald-800 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {bookingError && (
        <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 bg-rose-500/10 border border-rose-500/25 text-rose-800 dark:text-rose-300 rounded-xl text-xs font-semibold animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{bookingError}</span>
          </div>
          <button
            type="button"
            onClick={() => setBookingError(null)}
            className="p-1 text-rose-600 hover:text-rose-800 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Tabs bar: Operational stages only */}
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
            <span>All Today</span>
            <span className="px-1.5 py-0.2 rounded font-num text-[10px] bg-black/15">{counts.all}</span>
          </button>

          <button
            onClick={() => { setActiveTab('needs_booking'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'needs_booking'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border)]'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Needs Booking</span>
            <span className="px-1.5 py-0.2 rounded font-num text-[10px] bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
              {counts.needs_booking}
            </span>
          </button>

          <button
            onClick={() => { setActiveTab('confirmed'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'confirmed'
                ? 'bg-[var(--accent)] text-[var(--accent-contrast)] shadow-xs'
                : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border)]'
            }`}
          >
            <span>Ready to Pack</span>
            <span className="px-1.5 py-0.2 rounded font-num text-[10px] pill-teal border">{counts.confirmed}</span>
          </button>

          <button
            onClick={() => { setActiveTab('packed'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'packed'
                ? 'bg-[var(--accent)] text-[var(--accent-contrast)] shadow-xs'
                : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border)]'
            }`}
          >
            <span>Packed / Ready to Ship</span>
            <span className="px-1.5 py-0.2 rounded font-num text-[10px] pill-amber border">{counts.packed}</span>
          </button>

          <button
            onClick={() => { setActiveTab('dispatched'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'dispatched'
                ? 'bg-[var(--accent)] text-[var(--accent-contrast)] shadow-xs'
                : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border)]'
            }`}
          >
            <span>Out for Delivery</span>
            <span className="px-1.5 py-0.2 rounded font-num text-[10px] pill-teal border">{counts.dispatched}</span>
          </button>
        </div>

        {/* Floating Bulk Action Bar */}
        {selectedOrderIds.length > 0 && (
          <div className="rounded-xl border border-[var(--accent)] bg-[var(--surface)] p-3 shadow-md flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-bold font-num">
                {selectedOrderIds.length}
              </span>
              <span className="text-xs font-semibold text-[var(--text)]">
                {selectedOrderIds.length === 1 ? '1 order selected' : `${selectedOrderIds.length} orders selected`}
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
              {bulkTargetCounts.book > 0 && (
                <button
                  onClick={handleBulkBook}
                  disabled={isProcessingBulk}
                  className="erp-btn-primary text-xs flex items-center gap-1.5 disabled:opacity-50"
                  title={`Book ${bulkTargetCounts.book} Steadfast orders`}
                >
                  {isProcessingBulk ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span>Booking...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Book Steadfast ({bulkTargetCounts.book})</span>
                    </>
                  )}
                </button>
              )}

              {bulkTargetCounts.stickers > 0 && (
                <button
                  onClick={handleBulkPrintStickers}
                  className="erp-btn-secondary text-xs flex items-center gap-1.5"
                  title={`Print ${bulkTargetCounts.stickers} Steadfast thermal stickers`}
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Stickers ({bulkTargetCounts.stickers})</span>
                </button>
              )}

              {bulkTargetCounts.invoices > 0 && (
                <button
                  onClick={handleBulkPrintInvoices}
                  className="erp-btn-secondary text-xs flex items-center gap-1.5"
                  title={`Print ${bulkTargetCounts.invoices} customer invoices`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Invoices ({bulkTargetCounts.invoices})</span>
                </button>
              )}

              <button
                onClick={() => {
                  const targets = orders.filter((o) => selectedOrderIds.includes(o.id));
                  generateOrderSheetPdf(targets, courierBookings, "Today's Orders Packing Sheet");
                }}
                className="erp-btn-ghost text-xs flex items-center gap-1.5"
                title="Print a packing summary sheet for today"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Summary Sheet</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedOrderIds([])}
                className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] rounded-lg cursor-pointer"
                title="Cancel selection"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Dense Controls Bar */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 shadow-xs flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Channel filter */}
            <select
              value={channelFilter}
              onChange={(e) => { setChannelFilter(e.target.value as any); setCurrentPage(1); }}
              className="erp-select text-xs"
            >
              <option value="all">All Channels</option>
              <option value="messenger">Messenger</option>
              <option value="walk-in">Walk-in POS</option>
            </select>

            {/* Column toggle */}
            <div className="relative" ref={columnsDropdownRef}>
              <button
                type="button"
                onClick={() => setShowColumnsDropdown(!showColumnsDropdown)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] border-[var(--border)] transition-colors cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="9" y1="3" x2="9" y2="21" />
                  <line x1="15" y1="3" x2="15" y2="21" />
                </svg>
                <span>Columns</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${showColumnsDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showColumnsDropdown && (
                <div className="absolute left-0 top-full mt-1 z-50 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-lg p-3 w-48">
                  <div className="text-[10px] uppercase font-semibold text-[var(--text-secondary)] mb-2 tracking-wider">
                    Optional Columns
                  </div>
                  {[
                    { key: 'payment', label: 'Payment' },
                    { key: 'items', label: 'Items' },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 py-1 cursor-pointer text-xs text-[var(--text)] hover:text-[var(--accent)]">
                      <input
                        type="checkbox"
                        checked={visibleColumns.has(key)}
                        onChange={() => {
                          setVisibleColumns((prev) => {
                            const next = new Set(prev);
                            if (next.has(key)) next.delete(key);
                            else next.add(key);
                            return next;
                          });
                        }}
                        className="rounded border-[var(--border)] text-[var(--accent)] w-3.5 h-3.5 cursor-pointer"
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Header menu */}
            <div className="relative" ref={headerMenuRef}>
              <button
                type="button"
                onClick={() => setShowHeaderMenu(!showHeaderMenu)}
                className="flex items-center justify-center w-8 h-8 rounded-lg border bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] border-[var(--border)] transition-colors cursor-pointer"
                title="Table options"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {showHeaderMenu && (
                <div className="absolute left-0 top-full mt-1 z-50 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-lg p-1.5 w-60">
                  <div className="text-[10px] uppercase font-semibold text-[var(--text-secondary)] px-2.5 pt-1 pb-1.5 tracking-wider">
                    Today&apos;s Options
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      refreshAll();
                      setPageRefreshKey((v) => v + 1);
                      setShowHeaderMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer text-left"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-[var(--text-secondary)] shrink-0" />
                    Refresh Today&apos;s Queue
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const targets = displayedOrders.filter((o) => o.order_type !== 'merchant_fulfillment');
                      targets.forEach((o) =>
                        generateInvoicePdf(o, {
                          business_name: settings?.company_name || 'Mirage Perfume Bangladesh',
                          business_phone: settings?.phone || '',
                          business_address: settings?.address || '',
                        })
                      );
                      setShowHeaderMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer text-left"
                  >
                    <Printer className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
                    Print Invoices (Current Page)
                  </button>
                </div>
              )}
            </div>

            {/* Quick action: Book all unbooked to Steadfast */}
            {counts.needs_booking > 0 && (
              <button
                type="button"
                onClick={handleBookAllUnbooked}
                disabled={isProcessingBulk}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-2xs hover:shadow-xs transition-all cursor-pointer disabled:opacity-50 active:scale-95"
                title={`Book all ${counts.needs_booking} unbooked Steadfast orders immediately`}
              >
                {isProcessingBulk ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                    <span>Booking All ({counts.needs_booking})...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 shrink-0" />
                    <span>Book All to Steadfast ({counts.needs_booking})</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Search input */}
          <div className="relative ml-auto">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              placeholder="Search today's orders..."
              className="erp-input pl-7 w-48 sm:w-60 text-xs"
            />
            <Search className="w-3.5 h-3.5 text-[var(--text-secondary)] absolute left-2.5 top-2.5" />
          </div>
        </div>
      </div>

      {/* Main High-Density Table */}
      <div className="dense-table-container">
        <div className="overflow-x-auto scrollbar-thin max-h-[70vh]">
          <table className="dense-table w-full min-w-[1050px]">
            <thead>
              <tr>
                <th className="w-[110px]">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      onChange={handleSelectAll}
                      checked={displayedOrders.length > 0 && selectedOrderIds.length === displayedOrders.length}
                      disabled={displayedOrders.length === 0}
                      className="rounded border-[var(--border)] text-[var(--accent)] cursor-pointer w-3.5 h-3.5"
                      title="Select all on this page"
                    />
                    <span>Invoice &amp; Date</span>
                  </div>
                </th>
                <th className="w-[160px]">Customer &amp; Delivery</th>
                <th className="w-[60px] text-center">Qty</th>
                <th className="w-[90px] text-center">Status</th>
                <th className="w-[100px] text-center">Payment</th>
                <th className="w-[110px] text-right">Financials</th>
                <th className="w-[70px] text-center">Return</th>
                <th className="w-[130px] text-center">Shipping</th>
                <th className="w-[70px] text-right">Est. 1st</th>
                <th className="w-[70px] text-right">Actual</th>
                <th className="w-[70px] text-right">Variance</th>
                <th className="w-[130px]">Notes</th>
                <th className="w-[80px]">Added By</th>
              </tr>
            </thead>
            <tbody>
              {displayedOrders.length === 0 ? (
                <tr>
                  <td
                    colSpan={13}
                    className="p-10 text-center text-xs text-[var(--text-secondary)]"
                  >
                    No orders in Today&apos;s queue matching the filter criteria.
                  </td>
                </tr>
              ) : (
                displayedOrders.map((order) => {
                  const stats = getCustomerStats(order.customer_phone, order.id, customers, orders, customerRatings);
                  const isSelected = selectedOrderIds.includes(order.id);
                  const courierBooking = courierBookings.find((b) => b.order_id === order.id);
                  const pState = orderPaymentState(order, customerReturns);
                  const itemQty = (order.items || []).reduce((s, it) => s + (it.quantity || 0), 0);
                  
                  const estCourier = order.courier_estimated_charge ?? 70;
                  const actualCourier = order.actual_courier_charge ?? estCourier;
                  const variance = actualCourier - estCourier;

                  return (
                    <tr
                      key={order.id}
                      onClick={() => setSelectedOrder(order)}
                      className={`dense-table-row-clickable ${isSelected ? 'dense-table-row-selected' : ''}`}
                    >
                      {/* Invoice & Date */}
                      <td className="align-middle py-2.5">
                        <div className="space-y-0.5">
                          <div className="relative flex items-center gap-1.5">
                            <span
                              className={`inline-flex items-center justify-center ${
                                isSelected ? 'opacity-100' : 'opacity-70'
                              }`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleSelectOne(order.id)}
                                className="rounded border-[var(--border)] text-[var(--accent)] cursor-pointer w-3 h-3"
                                title="Select this order"
                              />
                            </span>
                            <span className="font-num font-bold text-[var(--accent)] hover:underline text-[12px]">
                              #{order.invoice_number.replace('INV-2026-', '')}
                            </span>
                          </div>
                          <div className="text-[10px] text-[var(--text-secondary)] font-num">
                            {new Date(order.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                          </div>
                        </div>
                      </td>

                      {/* Customer & Address */}
                      <td className="align-middle py-2.5">
                        <div className="space-y-0.5">
                          <div className="font-semibold text-[var(--text)] text-[12px] line-clamp-1 flex items-center gap-1">
                            <span>{order.customer_name}</span>
                            {order.order_type === 'merchant_fulfillment' && (
                              <span className="px-1 py-0.2 rounded text-[8px] font-bold bg-purple-500/10 text-purple-600">Dropship</span>
                            )}
                          </div>
                          <div className="font-num text-[11px] text-[var(--accent)] font-medium">
                            {order.customer_phone}
                          </div>
                          <div className="text-[10px] text-[var(--text-secondary)] line-clamp-1">
                            {order.delivery_address_text || 'Showroom In-Store Handoff'}
                          </div>
                        </div>
                      </td>

                      {/* Qty */}
                      <td className="align-middle py-2.5 text-center font-num font-semibold text-[12px] text-[var(--text)]">
                        {itemQty} pcs
                      </td>

                      {/* Order Status */}
                      <td className="align-middle py-2.5 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          order.status === 'confirmed' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' :
                          order.status === 'packed' ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20' :
                          order.status === 'dispatched' ? 'bg-purple-500/10 text-purple-600 border border-purple-500/20' :
                          order.status === 'delivered' ? 'bg-emerald-600 text-white' :
                          'bg-gray-500/10 text-gray-600'
                        }`}>
                          {order.status.toUpperCase()}
                        </span>
                      </td>

                      {/* Payment Status & Method */}
                      <td className="align-middle py-2.5 text-center">
                        <div className="space-y-0.5">
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            pState.state === 'paid' ? 'bg-emerald-500/10 text-emerald-600' :
                            pState.state === 'partial' ? 'bg-amber-500/10 text-amber-600' :
                            'bg-rose-500/10 text-rose-600'
                          }`}>
                            {pState.label}
                          </span>
                          <div className="text-[10px] text-[var(--text-secondary)] font-medium capitalize">
                            {(order.payments || []).map(p => p.method).filter(m => m !== 'cod_pending').join(', ') || 'COD'}
                          </div>
                        </div>
                      </td>

                      {/* Financials (Total, Paid, Due) */}
                      <td className="align-middle py-2.5 text-right font-num text-[11px]">
                        <div className="font-bold text-[var(--text)]">৳{order.total.toLocaleString()}</div>
                        <div className="text-[10px] text-emerald-600">Paid: ৳{(order.paid_amount || 0).toLocaleString()}</div>
                        <div className="text-[10px] text-rose-600 font-semibold">Due: ৳{(order.due_amount || 0).toLocaleString()}</div>
                      </td>

                      {/* Return Status */}
                      <td className="align-middle py-2.5 text-center text-[11px]">
                        {(order.refunded_amount || 0) > 0 ? (
                          <span className="px-1.5 py-0.5 bg-rose-500/10 text-rose-600 rounded text-[10px] font-bold">Returned</span>
                        ) : (
                          <span className="text-[var(--text-secondary)] text-[10px]">None</span>
                        )}
                      </td>

                      {/* Shipping Status & Quick Booking Action */}
                      <td className="align-middle py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-col items-center justify-center gap-1">
                          {isOrderBooked(order) ? (
                            <div className="flex flex-col items-center">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                <CheckCircle2 className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                                <span>Booked</span>
                              </span>
                              <div className="flex items-center gap-1 mt-0.5">
                                <span className="text-[10px] text-[var(--text)] font-mono font-medium">
                                  {order.courier_tracking_code || courierBooking?.consignment_no || 'No Tracking'}
                                </span>
                                {(order.courier_tracking_code || courierBooking?.consignment_no) && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const code = order.courier_tracking_code || courierBooking?.consignment_no;
                                      if (code) {
                                        navigator.clipboard.writeText(code);
                                        setBookingSuccessMsg(`Tracking #${code} copied to clipboard!`);
                                        setTimeout(() => setBookingSuccessMsg(null), 2500);
                                      }
                                    }}
                                    className="p-0.5 text-[var(--text-secondary)] hover:text-[var(--accent)] cursor-pointer transition-colors"
                                    title="Copy tracking code"
                                  >
                                    <Copy className="w-2.5 h-2.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-0.5">
                              <button
                                type="button"
                                onClick={(e) => handleBookSingle(e, order)}
                                disabled={bookingOrderIds.has(order.id) || isProcessingBulk}
                                className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-2xs hover:shadow-xs transition-all cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed group whitespace-nowrap"
                                title="Click to book this order with Steadfast Courier immediately"
                              >
                                {bookingOrderIds.has(order.id) ? (
                                  <>
                                    <RefreshCw className="w-3 h-3 animate-spin shrink-0" />
                                    <span>Booking...</span>
                                  </>
                                ) : (
                                  <>
                                    <Send className="w-3 h-3 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                                    <span>Book Steadfast</span>
                                  </>
                                )}
                              </button>
                              <span className="text-[9px] text-amber-600 dark:text-amber-400 font-medium">
                                {bookingOrderIds.has(order.id) ? 'Connecting...' : 'Click to book'}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Est. 1st Delivery Charge */}
                      <td className="align-middle py-2.5 text-right font-num text-[11px] font-semibold text-[var(--text)]">
                        ৳{estCourier}
                      </td>

                      {/* Actual Delivery Charge */}
                      <td className="align-middle py-2.5 text-right font-num text-[11px] font-semibold text-[var(--text)]">
                        ৳{actualCourier}
                      </td>

                      {/* Delivery Variance */}
                      <td className={`align-middle py-2.5 text-right font-num text-[11px] font-bold ${
                        variance > 0 ? 'text-rose-600' : variance < 0 ? 'text-emerald-600' : 'text-[var(--text-secondary)]'
                      }`}>
                        {variance > 0 ? `+৳${variance}` : variance < 0 ? `-৳${Math.abs(variance)}` : '৳0'}
                      </td>

                      {/* Notes */}
                      <td className="align-middle py-2.5 text-[11px]">
                        <div className="space-y-0.5 line-clamp-2">
                          {order.invoice_note && (
                            <div className="text-[10px] text-[var(--text)] bg-[var(--surface-sunken)] p-1 rounded">
                              <span className="font-bold">Sell:</span> {order.invoice_note}
                            </div>
                          )}
                          {order.notes && (
                            <div className="text-[10px] text-[var(--text-secondary)] bg-[var(--surface-sunken)] p-1 rounded">
                              <span className="font-bold">Staff:</span> {order.notes}
                            </div>
                          )}
                          {!order.invoice_note && !order.notes && (
                            <span className="text-[10px] text-[var(--text-secondary)] italic">No notes</span>
                          )}
                        </div>
                      </td>

                      {/* Added By */}
                      <td className="align-middle py-2.5 text-[11px] text-[var(--text-secondary)] font-medium">
                        {order.created_by_name || 'Staff'}
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

      {/* Shared Order Workspace Modal */}
      {selectedOrder && (
        <OrderWorkspaceModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onCancelOrder={(order) => setCancellationTarget(order)}
          onEditOrder={(order) => {
            setEditingOrder(order);
            setShowEditModal(true);
          }}
          onViewInvoice={(order) => {
            setActiveInvoiceOrder(order);
            setShowInvoiceModal(true);
          }}
          onPrintMerchantSticker={(order) => {
            setMerchantStickerOrder(order);
            setShowMerchantStickerModal(true);
          }}
        />
      )}

      {/* Customer Profile Modal */}
      {customerProfileData && (
        <CustomerProfileModal
          data={customerProfileData}
          onClose={() => setCustomerProfileData(null)}
          onUpdateRating={(rating) => {
            const phone = customerProfileData.phone.replace(/[^0-9]/g, '');
            setCustomerRatings((prev) => ({ ...prev, [phone]: rating }));
            setCustomerProfileData((prev) => (prev ? { ...prev, rating } : null));
          }}
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

      {/* Invoice Modal */}
      {activeInvoiceOrder && (
        <InvoiceModal
          order={activeInvoiceOrder}
          isOpen={showInvoiceModal}
          onClose={() => setShowInvoiceModal(false)}
        />
      )}

      {/* Merchant Dropship Sticker Modal */}
      {merchantStickerOrder && (
        <MerchantStickerModal
          order={merchantStickerOrder}
          isOpen={showMerchantStickerModal}
          onClose={() => {
            setShowMerchantStickerModal(false);
            setMerchantStickerOrder(null);
          }}
        />
      )}
    </div>
  );
};
