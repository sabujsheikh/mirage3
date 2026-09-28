import React, { useEffect, useState, useRef } from 'react';
import {
  Search,
  Printer,
  Phone,
  Truck,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Star,
  Tag,
  Building2,
  X,
  ChevronDown,
  MoreVertical,
  Store,
  FileText,
  Filter,
  Calendar,
  Send,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Plus,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Order } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { InvoiceModal } from './InvoiceModal';
import { EditOrderModal } from './EditOrderModal';
import { MerchantStickerModal } from '../packing/MerchantStickerModal';
import { OrderWorkspaceModal } from './OrderWorkspaceModal';
import { CustomerProfileModal } from './CustomerProfileModal';
import { CancelOrderModal } from './CancelOrderModal';
import { ManualSaleModal } from './ManualSaleModal';
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

export const AllOrdersView: React.FC = () => {
  const {
    orders,
    customers,
    courierBookings,
    cancelOrder,
    refreshAll,
    settings,
    customerReturns,
    bookCourier,
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

  // Tabs for All Orders: all | delivered | dispatched | confirmed | completed
  const [activeTab, setActiveTab] = useState<'all' | 'delivered' | 'dispatched' | 'confirmed' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRangeFilter, setDateRangeFilter] = useState<'all' | 'today' | 'yesterday' | '7days' | '30days'>('all');
  const [channelFilter, setChannelFilter] = useState<'all' | 'messenger' | 'walk-in'>('all');
  const [orderTypeFilter, setOrderTypeFilter] = useState<'all' | 'direct_sale' | 'merchant_fulfillment'>('all');
  const [customerTypeFilter, setCustomerTypeFilter] = useState<'all' | 'new' | 'returning' | 'risk'>('all');

  const [currentPage, setCurrentPage] = useState(1);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);
  const [bookingOrderIds, setBookingOrderIds] = useState<Set<string>>(new Set());
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSuccessMsg, setBookingSuccessMsg] = useState<string | null>(null);
  const [isAddSaleModalOpen, setIsAddSaleModalOpen] = useState(false);

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => new Set(['payment', 'items']));
  const [showColumnsDropdown, setShowColumnsDropdown] = useState(false);
  const columnsDropdownRef = useRef<HTMLDivElement>(null);

  // Secondary filters popover
  const [showFiltersPopover, setShowFiltersPopover] = useState(false);
  const filtersPopoverRef = useRef<HTMLDivElement>(null);

  // Table header menu
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const headerMenuRef = useRef<HTMLDivElement>(null);

  // Customer profile modal
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

  // Close menus on outside click / escape
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (columnsDropdownRef.current && !columnsDropdownRef.current.contains(e.target as Node)) {
        setShowColumnsDropdown(false);
      }
      if (filtersPopoverRef.current && !filtersPopoverRef.current.contains(e.target as Node)) {
        setShowFiltersPopover(false);
      }
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target as Node)) {
        setShowHeaderMenu(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowColumnsDropdown(false);
        setShowFiltersPopover(false);
        setShowHeaderMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  // Compute date_from and date_to for dateRangeFilter
  const getDateRangeBounds = () => {
    const now = new Date();
    const toDhakaString = (d: Date) =>
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Dhaka',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(d);

    const todayStr = toDhakaString(now);

    if (dateRangeFilter === 'today') {
      return { date_from: todayStr, date_to: todayStr };
    }
    if (dateRangeFilter === 'yesterday') {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yStr = toDhakaString(yesterday);
      return { date_from: yStr, date_to: yStr };
    }
    if (dateRangeFilter === '7days') {
      const past7 = new Date(now);
      past7.setDate(past7.getDate() - 7);
      return { date_from: toDhakaString(past7), date_to: todayStr };
    }
    if (dateRangeFilter === '30days') {
      const past30 = new Date(now);
      past30.setDate(past30.getDate() - 30);
      return { date_from: toDhakaString(past30), date_to: todayStr };
    }
    return { date_from: '', date_to: '' };
  };

  // Fetch orders from API
  useEffect(() => {
    const controller = new AbortController();
    const { date_from, date_to } = getDateRangeBounds();

    const params = new URLSearchParams({
      page: String(currentPage),
      page_size: String(effectivePageSize),
    });

    if (activeTab === 'delivered' || activeTab === 'dispatched' || activeTab === 'confirmed') {
      params.set('status', activeTab);
    }
    if (channelFilter !== 'all') params.set('channel', channelFilter);
    if (orderTypeFilter !== 'all') params.set('order_type', orderTypeFilter);
    if (date_from) params.set('date_from', date_from);
    if (date_to) params.set('date_to', date_to);
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
        if (err.name !== 'AbortError') console.error('Failed to fetch all orders:', err);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingOrders(false);
      });

    return () => controller.abort();
  }, [
    activeTab,
    dateRangeFilter,
    channelFilter,
    orderTypeFilter,
    effectivePageSize,
    currentPage,
    searchQuery,
    pageRefreshKey,
  ]);

  const isOrderBooked = (order: Order) =>
    Boolean(
      order.courier_booked ||
      order.courier_tracking_code ||
      courierBookings.some((b) => b.order_id === order.id && (b.consignment_no || b.booking_id))
    );

  // Client-side customer type filter if active
  const displayedOrders = pageOrders.filter((order) => {
    if (customerTypeFilter !== 'all') {
      const stats = getCustomerStats(order.customer_phone, order.id, customers, orders, customerRatings);
      if (customerTypeFilter === 'risk' && !stats.isRisk) return false;
      if (customerTypeFilter === 'new' && !stats.isNew) return false;
      if (customerTypeFilter === 'returning' && (stats.isRisk || stats.isNew)) return false;
    }
    return true;
  });

  const counts = {
    all: serverTotal,
    delivered: serverStatusCounts.delivered || 0,
    dispatched: serverStatusCounts.dispatched || 0,
    confirmed: serverStatusCounts.confirmed || 0,
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
          ? 'Requires advance verification before dispatch.'
          : 'Customer purchase profile record.'),
      stats,
      orders: stats.allOrders.length > 0 ? stats.allOrders : [order],
    });
  };

  const handleConfirmCancellation = async (orderId: string, reason: string) => {
    const updated = await cancelOrder(orderId, reason);
    setSelectedOrder(updated);
    await refreshAll();
    setPageRefreshKey((v) => v + 1);
  };

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto" id="all-orders-view">
      {/* Header Banner */}
      <div className="bg-[var(--surface-sunken)] border border-[var(--border)] rounded-xl px-4 py-3 flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-bold text-[var(--text)]">All Sales &amp; Orders Database</div>
          <div className="text-xs text-[var(--text-secondary)]">
            Complete historical order archive. Filter across time horizons, search past customer invoices, and audit order records.
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="text-right text-xs font-num whitespace-nowrap bg-[var(--surface)] border border-[var(--border)] px-3 py-1.5 rounded-lg font-semibold text-[var(--text)]">
            {serverTotal} Orders Found
          </div>
          <button
            type="button"
            onClick={() => setIsAddSaleModalOpen(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--accent-primary)] text-[var(--accent-text)] hover:opacity-95 shadow-xs transition-all cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Sale
          </button>
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
            <span>All Time</span>
            <span className="px-1.5 py-0.2 rounded font-num text-[10px] bg-black/15">{counts.all}</span>
          </button>

          <button
            onClick={() => { setActiveTab('delivered'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'delivered'
                ? 'bg-[var(--accent)] text-[var(--accent-contrast)] shadow-xs'
                : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border)]'
            }`}
          >
            <span>Delivered</span>
            <span className="px-1.5 py-0.2 rounded font-num text-[10px] pill-green border">{counts.delivered}</span>
          </button>

          <button
            onClick={() => { setActiveTab('dispatched'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'dispatched'
                ? 'bg-[var(--accent)] text-[var(--accent-contrast)] shadow-xs'
                : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border)]'
            }`}
          >
            <span>Dispatched</span>
            <span className="px-1.5 py-0.2 rounded font-num text-[10px] pill-teal border">{counts.dispatched}</span>
          </button>

          <button
            onClick={() => { setActiveTab('confirmed'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'confirmed'
                ? 'bg-[var(--accent)] text-[var(--accent-contrast)] shadow-xs'
                : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border)]'
            }`}
          >
            <span>Confirmed</span>
            <span className="px-1.5 py-0.2 rounded font-num text-[10px] pill-teal border">{counts.confirmed}</span>
          </button>
        </div>

        {/* Floating Bulk Action Bar */}
        {selectedOrderIds.length > 0 && (
          <div className="rounded-xl border border-[var(--accent)] bg-[var(--surface)] p-3 shadow-md flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-200">
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

              <button
                onClick={handleBulkPrintInvoices}
                className="erp-btn-secondary text-xs flex items-center gap-1.5"
                title="Print invoices for selected direct sale orders"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Print Invoices</span>
              </button>

              <button
                onClick={handleBulkPrintStickers}
                className="erp-btn-secondary text-xs flex items-center gap-1.5"
                title="Print Steadfast thermal shipping stickers"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Stickers</span>
              </button>

              <button
                onClick={() => {
                  const targets = orders.filter((o) => selectedOrderIds.includes(o.id));
                  generateOrderSheetPdf(targets, courierBookings, 'Order History Summary Sheet');
                }}
                className="erp-btn-ghost text-xs flex items-center gap-1.5"
                title="Print an itemized summary sheet"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Summary Sheet</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedOrderIds([])}
                className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Filter Controls Bar */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 shadow-xs flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Date Range Selector */}
            <select
              value={dateRangeFilter}
              onChange={(e) => { setDateRangeFilter(e.target.value as any); setCurrentPage(1); }}
              className="erp-select text-xs font-semibold"
            >
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="7days">Past 7 Days</option>
              <option value="30days">Past 30 Days</option>
            </select>

            {/* Secondary Filters Popover */}
            <div className="relative" ref={filtersPopoverRef}>
              <button
                type="button"
                onClick={() => setShowFiltersPopover(!showFiltersPopover)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                  channelFilter !== 'all' || orderTypeFilter !== 'all' || customerTypeFilter !== 'all'
                    ? 'bg-[var(--accent)] text-[var(--accent-contrast)] border-[var(--accent)]'
                    : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] border-[var(--border)]'
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Filters</span>
                {(channelFilter !== 'all' || orderTypeFilter !== 'all' || customerTypeFilter !== 'all') && (
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                )}
                <ChevronDown className={`w-3 h-3 transition-transform ${showFiltersPopover ? 'rotate-180' : ''}`} />
              </button>

              {showFiltersPopover && (
                <div className="absolute left-0 top-full mt-1 z-50 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-lg p-3.5 w-64 space-y-3">
                  <div className="text-[10px] uppercase font-semibold text-[var(--text-secondary)] tracking-wider">
                    Detailed Filters
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--text)] mb-1">Channel</label>
                    <select
                      value={channelFilter}
                      onChange={(e) => { setChannelFilter(e.target.value as any); setCurrentPage(1); }}
                      className="erp-select text-xs w-full"
                    >
                      <option value="all">All Channels</option>
                      <option value="messenger">Messenger</option>
                      <option value="walk-in">Walk-in POS</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--text)] mb-1">Order Model</label>
                    <select
                      value={orderTypeFilter}
                      onChange={(e) => { setOrderTypeFilter(e.target.value as any); setCurrentPage(1); }}
                      className="erp-select text-xs w-full"
                    >
                      <option value="all">All Order Types</option>
                      <option value="direct_sale">Direct Sale (Mirage)</option>
                      <option value="merchant_fulfillment">Dropship Fulfillment</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--text)] mb-1">Customer Type</label>
                    <select
                      value={customerTypeFilter}
                      onChange={(e) => { setCustomerTypeFilter(e.target.value as any); setCurrentPage(1); }}
                      className="erp-select text-xs w-full"
                    >
                      <option value="all">All Customer Profiles</option>
                      <option value="new">New Customers</option>
                      <option value="returning">Returning Customers</option>
                      <option value="risk">High Risk Flag</option>
                    </select>
                  </div>

                  <div className="pt-2 border-t border-[var(--border)] flex justify-between items-center">
                    <button
                      type="button"
                      onClick={() => {
                        setChannelFilter('all');
                        setOrderTypeFilter('all');
                        setCustomerTypeFilter('all');
                        setCurrentPage(1);
                      }}
                      className="text-xs text-[var(--text-secondary)] hover:text-[var(--text)] underline cursor-pointer"
                    >
                      Reset filters
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowFiltersPopover(false)}
                      className="erp-btn-primary text-xs"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Column toggle */}
            <div className="relative" ref={columnsDropdownRef}>
              <button
                type="button"
                onClick={() => setShowColumnsDropdown(!showColumnsDropdown)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] border-[var(--border)] transition-colors cursor-pointer"
              >
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

            {/* Options menu */}
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
                    Database Options
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
                    Refresh Order Database
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
                    Print Current Page Invoices
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Deep search */}
          <div className="relative ml-auto">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              placeholder="Search invoice, SKU, customer, phone..."
              className="erp-input pl-7 w-48 sm:w-64 text-xs"
            />
            <Search className="w-3.5 h-3.5 text-[var(--text-secondary)] absolute left-2.5 top-2.5" />
          </div>
        </div>
      </div>

      {/* Main High-Density Table */}
      <div className="dense-table-container">
        <div className="overflow-auto max-h-[70vh]">
          <table className="dense-table min-w-[1750px]">
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
                      title="Select all on this page"
                    />
                    <span>Order</span>
                  </div>
                </th>
                <th className="w-56">Customer &amp; Address</th>
                <th className="w-24">Date</th>
                <th className="w-24 text-center">Status</th>
                <th className="w-24 text-center">Cust. Type</th>
                <th className="w-32 text-center">Fulfillment</th>
                <th className="w-20 text-center">COD</th>
                <th className="w-16 text-center">Print</th>
                <th className="w-28">Consignment</th>
                <th className="w-24 text-right">Score</th>
                <th className="w-20 text-right">Total</th>
                <th className="w-20 text-center">Origin</th>
                <th className="w-28">Created By</th>
                <th className="w-24 text-right">Glance</th>
                {visibleColumns.has('payment') && <th className="w-28">Payment</th>}
                {visibleColumns.has('items') && <th className="w-20 text-center">Items</th>}
              </tr>
            </thead>
            <tbody>
              {displayedOrders.length === 0 ? (
                <tr>
                  <td
                    colSpan={14 + (visibleColumns.has('payment') ? 1 : 0) + (visibleColumns.has('items') ? 1 : 0)}
                    className="p-10 text-center text-xs text-[var(--text-secondary)]"
                  >
                    No historical orders match the selected search criteria.
                  </td>
                </tr>
              ) : (
                displayedOrders.map((order) => {
                  const stats = getCustomerStats(order.customer_phone, order.id, customers, orders, customerRatings);
                  const isSelected = selectedOrderIds.includes(order.id);
                  const courierBooking = courierBookings.find((b) => b.order_id === order.id);
                  const pState = orderPaymentState(order, customerReturns);
                  const codState = orderCodStatus(order, customerReturns);
                  const custTypeLabel = stats.isRisk ? 'Risk' : stats.isNew ? 'New' : 'Returning';
                  const consignment = order.courier_tracking_code || courierBooking?.consignment_no || courierBooking?.booking_id || '';
                  const itemQty = (order.items || []).reduce((s, it) => s + (it.quantity || 0), 0);
                  const originLabel = order.channel === 'walk-in' ? 'Walk-in' : 'Messenger';

                  const glanceR = stats.pending > 0 ? 4 : stats.completed > 0 ? 3 : (stats.cancelled + stats.refunded) > 0 ? 2 : 1;
                  const glanceLabel =
                    glanceR === 4
                      ? `${stats.pending} Pending`
                      : glanceR === 3
                      ? `${stats.completed} Delivered`
                      : glanceR === 2
                      ? `${stats.cancelled + stats.refunded} Cancelled`
                      : 'New';

                  return (
                    <tr
                      key={order.id}
                      onClick={() => setSelectedOrder(order)}
                      className={`dense-table-row-clickable ${isSelected ? 'dense-table-row-selected' : ''}`}
                    >
                      {/* Order column */}
                      <td className="align-middle">
                        <div className="relative inline-flex items-center">
                          <span
                            className={`dense-row-checkbox absolute left-0 top-1/2 -translate-y-1/2 inline-flex items-center justify-center ${
                              isSelected ? 'dense-row-checkbox-active opacity-100' : ''
                            }`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleSelectOne(order.id)}
                              className="rounded border-[var(--border)] text-[var(--accent)] cursor-pointer w-3.5 h-3.5"
                              title="Select this order"
                            />
                          </span>
                          <span className="font-num font-bold text-[var(--accent)] hover:underline pl-6">
                            #{order.invoice_number.replace('INV-2026-', '')}
                          </span>
                        </div>
                      </td>

                      {/* Customer & Address */}
                      <td className="align-middle">
                        <div className="space-y-0.5">
                          <div className="font-semibold text-[var(--text)] line-clamp-1 flex items-center gap-1.5 flex-wrap">
                            <span>{order.customer_name}</span>
                            {order.order_type === 'merchant_fulfillment' && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-[color-mix(in_srgb,var(--status-purple)_12%,transparent)] text-[var(--status-purple)] border border-[color-mix(in_srgb,var(--status-purple)_30%,transparent)]">
                                <Building2 className="w-2.5 h-2.5" />
                                <span>Dropship</span>
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 font-num text-[11px] text-[var(--accent)] font-semibold">
                            <Phone className="w-2.5 h-2.5 shrink-0" />
                            <span>{order.customer_phone}</span>
                          </div>
                          <div className="text-[10px] text-[var(--text-secondary)] line-clamp-1">
                            {order.delivery_address_text || 'Showroom In-Store Handoff'}
                          </div>
                        </div>
                      </td>

                      {/* Date */}
                      <td className="align-middle text-[11px] text-[var(--text-secondary)] whitespace-nowrap font-num">
                        {new Date(order.created_at).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>

                      {/* Status */}
                      <td className="align-middle text-center">
                        <StatusBadge status={order.status} size="sm" />
                      </td>

                      {/* Customer Type */}
                      <td className="align-middle text-center">
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap ${
                            stats.isRisk
                              ? 'pill-red'
                              : stats.isNew
                              ? 'bg-[var(--surface-sunken)] text-[var(--text-secondary)] border border-[var(--border)]'
                              : 'pill-green'
                          }`}
                        >
                          {custTypeLabel}
                        </span>
                      </td>

                      {/* Fulfillment */}
                      <td className="align-middle text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--surface-sunken)] text-[var(--text-secondary)] font-semibold text-[10px] border border-[var(--border)] whitespace-nowrap">
                          {order.fulfillment_method === 'steadfast' && <Truck className="w-2.5 h-2.5" />}
                          {fulfillmentLabel(order)}
                        </span>
                      </td>

                      {/* COD / Payment status */}
                      <td className="align-middle text-center">
                        <span
                          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold font-num border whitespace-nowrap ${
                            codState.tone === 'amber' ? 'pill-amber' : codState.tone === 'red' ? 'pill-red' : 'pill-green'
                          }`}
                        >
                          {codState.label}
                        </span>
                      </td>

                      {/* Print */}
                      <td className="align-middle text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => {
                            if (order.order_type === 'merchant_fulfillment') {
                              setMerchantStickerOrder(order);
                              setShowMerchantStickerModal(true);
                            } else {
                              setActiveInvoiceOrder(order);
                              setShowInvoiceModal(true);
                            }
                          }}
                          className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--surface-hover)] rounded-lg transition-colors cursor-pointer"
                          title={order.order_type === 'merchant_fulfillment' ? 'Print merchant sticker' : 'View & print invoice'}
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      </td>

                      {/* Consignment / Courier Action */}
                      <td className="align-middle whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        {consignment ? (
                          <div className="flex items-center gap-1">
                            <span className="font-mono text-[10px] font-semibold text-[var(--accent)]" title={consignment}>
                              {consignment}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(consignment);
                                setBookingSuccessMsg(`Consignment #${consignment} copied!`);
                                setTimeout(() => setBookingSuccessMsg(null), 2500);
                              }}
                              className="p-0.5 text-[var(--text-secondary)] hover:text-[var(--accent)] cursor-pointer transition-colors"
                              title="Copy consignment code"
                            >
                              <Copy className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        ) : ['confirmed', 'packed'].includes(order.status) && (order.fulfillment_method === 'steadfast' || !order.fulfillment_method) ? (
                          <button
                            type="button"
                            onClick={(e) => handleBookSingle(e, order)}
                            disabled={bookingOrderIds.has(order.id) || isProcessingBulk}
                            className="inline-flex items-center justify-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-2xs cursor-pointer active:scale-95 disabled:opacity-50 group whitespace-nowrap"
                            title="Book order with Steadfast Courier immediately"
                          >
                            {bookingOrderIds.has(order.id) ? (
                              <>
                                <RefreshCw className="w-2.5 h-2.5 animate-spin shrink-0" />
                                <span>Booking...</span>
                              </>
                            ) : (
                              <>
                                <Send className="w-2.5 h-2.5 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                                <span>Book</span>
                              </>
                            )}
                          </button>
                        ) : (
                          <span className="text-[var(--text-secondary)] text-[11px]">—</span>
                        )}
                      </td>

                      {/* Score */}
                      <td className="align-middle text-right whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold font-num text-[var(--accent-secondary)] border border-[color-mix(in_srgb,var(--accent-secondary)_30%,transparent)] bg-[color-mix(in_srgb,var(--accent-secondary)_12%,transparent)]">
                          <Star className="w-2.5 h-2.5 fill-[var(--accent-secondary)] text-[var(--accent-secondary)]" />
                          {stats.currentRating}.0
                        </span>
                      </td>

                      {/* Total */}
                      <td className="align-middle text-right font-num font-bold text-[var(--text)]">
                        ৳{order.total.toLocaleString()}
                      </td>

                      {/* Origin */}
                      <td className="align-middle text-center">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap bg-[var(--surface-sunken)] text-[var(--text-secondary)] border border-[var(--border)]">
                          {order.channel === 'walk-in' ? <Store className="w-2.5 h-2.5" /> : <Send className="w-2.5 h-2.5" />}
                          {originLabel}
                        </span>
                      </td>

                      {/* Created By */}
                      <td className="align-middle whitespace-nowrap text-[11px] text-[var(--text-secondary)]">
                        {order.created_by_name || '—'}
                      </td>

                      {/* Glance */}
                      <td className="align-middle text-right" onClick={(e) => e.stopPropagation()}>
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold font-num border cursor-pointer whitespace-nowrap ${
                            glanceR === 4
                              ? 'pill-amber'
                              : glanceR === 3
                              ? 'pill-green'
                              : glanceR === 2
                              ? 'pill-red'
                              : 'bg-[var(--surface-sunken)] text-[var(--text-secondary)]'
                          }`}
                          onClick={(e) => handleOpenCustomerProfile(e, order)}
                          title={`Customer Lifetime History: ${stats.completed} Delivered, ${stats.pending} In-Progress, ${stats.refunded} RTO, ${stats.cancelled} Cancelled`}
                        >
                          {glanceLabel}
                        </span>
                      </td>

                      {/* Optional Payment */}
                      {visibleColumns.has('payment') && (
                        <td className="align-middle whitespace-nowrap">
                          <div className="text-[10px] font-bold text-[var(--text)]">{pState.label}</div>
                          <div className="text-[10px] text-[var(--text-secondary)] font-num">
                            {pState.received > 0 ? `৳${pState.received.toLocaleString()} received` : '—'}
                          </div>
                        </td>
                      )}

                      {/* Optional Items */}
                      {visibleColumns.has('items') && (
                        <td className="align-middle text-center font-num text-[11px] text-[var(--text)]">
                          {itemQty}
                        </td>
                      )}
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

      {/* Manual & Historical Sale Modal */}
      {isAddSaleModalOpen && (
        <ManualSaleModal
          isOpen={isAddSaleModalOpen}
          onClose={() => setIsAddSaleModalOpen(false)}
          onSuccess={() => {
            refreshAll();
            setPageRefreshKey(v => v + 1);
          }}
        />
      )}
    </div>
  );
};
