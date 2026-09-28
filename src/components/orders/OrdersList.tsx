import React, { useEffect, useState, useRef } from 'react';
import {
  Search,
  Filter,
  Printer,
  User,
  Phone,
  MapPin,
  AlertTriangle,
  FileText,
  Pencil,
  Truck,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  ShieldCheck,
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
  Boxes,
  Calendar,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Order, OrderStatus } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { Modal } from '../common/Modal';
import { InvoiceModal } from './InvoiceModal';
import { EditOrderModal } from './EditOrderModal';
import { generateShippingLabelPdf } from '../../lib/labelPdf';
import { generateInvoicePdf } from '../../lib/invoicePdf';
import { generateOrderSheetPdf } from '../../lib/orderSheetPdf';
import { generateMerchantStickerPdf } from '../../lib/merchantStickerPdf';
import { MerchantStickerModal } from '../packing/MerchantStickerModal';

export const OrdersList: React.FC<{
  filterStatus?: OrderStatus | 'cancelled';
  defaultDateFilter?: 'all' | 'today' | 'yesterday' | 'week' | 'month';
  viewMode?: 'all' | 'today' | 'pre_orders';
}> = ({
  filterStatus,
  defaultDateFilter = 'all',
  viewMode,
}) => {
  const {
    orders,
    products,
    customers,
    courierBookings,
    bookCourier,
    packOrder,
    cancelOrder,
    refreshAll,
    settings,
    customerReturns,
    movePreOrderToToday,
    bulkMovePreOrdersToToday,
  } = useApp();
  const { can } = useAuth();
  const isTodayView = defaultDateFilter === 'today';
  const isCancelledView = filterStatus === 'cancelled';
  const isPreOrdersView = viewMode === 'pre_orders' || (filterStatus as string) === 'pre_orders';
  const [pageOrders, setPageOrders] = useState<Order[]>([]);
  const [serverTotal, setServerTotal] = useState(0);
  const [serverTotalPages, setServerTotalPages] = useState(1);
  const [serverStatusCounts, setServerStatusCounts] = useState<Record<string, number>>({});
  const [serverPageSize, setServerPageSize] = useState(isTodayView ? 25 : 25);
  // 0 = "All" (server cap is 100000, which is effectively the full dataset)
  const PAGE_SIZE_OPTIONS = [25, 50, 100, 500, 1000, 0];
  const effectivePageSize = serverPageSize === 0 ? 100000 : serverPageSize;
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [pageRefreshKey, setPageRefreshKey] = useState(0);
  const [movingOrderId, setMovingOrderId] = useState<string | null>(null);
  const [bulkMoveMessage, setBulkMoveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filter & Search states
  const [activeTab, setActiveTab] = useState<string>(viewMode === 'pre_orders' ? 'pre_orders' : (filterStatus || 'all'));
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [channelFilter, setChannelFilter] = useState<'all' | 'messenger' | 'walk-in'>('all');
  const [orderTypeFilter, setOrderTypeFilter] = useState<'all' | 'direct_sale' | 'merchant_fulfillment'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'yesterday' | 'week' | 'month'>(defaultDateFilter);
  const [customerFilter, setCustomerFilter] = useState<'all' | 'new' | 'returning' | 'risk'>('all');
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [isProcessingBulk, setIsProcessingBulk] = useState<boolean>(false);

  // Glance hover popover + filter popover + table-level header menu (single ⋮)
  const [glancePopover, setGlancePopover] = useState<{ order: Order; x: number; y: number } | null>(null);
  const [showFilterPopover, setShowFilterPopover] = useState(false);
  const filterPopoverRef = useRef<HTMLDivElement>(null);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const headerMenuRef = useRef<HTMLDivElement>(null);

  // Column visibility — fixed columns are always visible, optional ones are toggleable
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => new Set(['payment', 'items']));
  const [showColumnsDropdown, setShowColumnsDropdown] = useState(false);
  const columnsDropdownRef = useRef<HTMLDivElement>(null);

  // Modals state
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState<boolean>(false);
  const [activeInvoiceOrder, setActiveInvoiceOrder] = useState<Order | null>(null);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [showMerchantStickerModal, setShowMerchantStickerModal] = useState<boolean>(false);
  const [merchantStickerOrder, setMerchantStickerOrder] = useState<Order | null>(null);
  // Sticker block message state: shown when sticker print is attempted for unbooked order
  const [stickerBlockMsg, setStickerBlockMsg] = useState<string | null>(null);
  const [cancellationTarget, setCancellationTarget] = useState<Order | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [cancellationOtherReason, setCancellationOtherReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  const cancellationReasons = [
    'Customer changed their mind',
    'Product out of stock',
    'Duplicate order',
    'Wrong item/details entered',
    'Customer unreachable / no response',
    'Price/payment disagreement',
    'Suspected fake/fraudulent order',
    'Other (please specify)',
  ];

  // Close the glance popover / filter popover / header menu on Escape, resize, outside click or scroll
  useEffect(() => {
    const closeGlance = () => setGlancePopover(null);
    const handleClick = (e: MouseEvent) => {
      if (filterPopoverRef.current && !filterPopoverRef.current.contains(e.target as Node)) {
        setShowFilterPopover(false);
      }
      if (columnsDropdownRef.current && !columnsDropdownRef.current.contains(e.target as Node)) {
        setShowColumnsDropdown(false);
      }
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target as Node)) {
        setShowHeaderMenu(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setGlancePopover(null);
        setShowColumnsDropdown(false);
        setShowHeaderMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('resize', closeGlance);
    window.addEventListener('scroll', closeGlance, true);
    const closeColumns = () => setShowColumnsDropdown(false);
    window.addEventListener('scroll', closeColumns, true);
    const closeHeaderMenu = () => setShowHeaderMenu(false);
    window.addEventListener('scroll', closeHeaderMenu, true);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('resize', closeGlance);
      window.removeEventListener('scroll', closeGlance, true);
      window.removeEventListener('scroll', closeColumns, true);
      window.removeEventListener('scroll', closeHeaderMenu, true);
    };
  }, []);

  // ---- Payment detail helpers (order detail panel, sections 3 & 4) ----
  const paymentMethodLabel = (method: string): string => {
    switch (method) {
      case 'cash': return 'Cash';
      case 'bkash': return 'bKash';
      case 'nagad': return 'Nagad';
      case 'bank': return 'Bank';
      case 'card': return 'Card';
      case 'cod_pending': return 'COD (Steadfast)';
      default: return method;
    }
  };

  const paymentAccountLabel = (accountId?: string): string => {
    switch (accountId) {
      case 'acc_cash': return 'Till (Cash)';
      case 'acc_bkash': return 'bKash Wallet';
      case 'acc_nagad': return 'Nagad Wallet';
      case 'acc_bank': return 'Business Bank Account';
      case 'acc_bank_personal': return 'Personal Bank Account';
      case 'acc_courier_rec': return 'Courier Receivable';
      default: return accountId ? accountId.replace('acc_', '') : '';
    }
  };

  const fulfillmentLabel = (order: Order): string => {
    if (order.order_type === 'merchant_fulfillment') return 'Dropship Fulfillment';
    switch (order.fulfillment_method) {
      case 'steadfast':
        return 'Steadfast';
      case 'instant_delivery':
        return `Instant${order.instant_delivery_provider ? ` \u00B7 ${order.instant_delivery_provider}` : ''}`;
      case 'in_house':
        return 'In-house Delivery';
      case 'self_pickup':
        return 'Self Pickup';
      case 'n_a_walk_in':
        return 'Walk-in';
      default:
        return 'Steadfast';
    }
  };

  // Paid = sum of completed (non-refunded) payments on the order
  const orderPaymentsReceived = (order: Order): number =>
    (order.payments || []).reduce(
      (sum, p) =>
        p.status === 'completed' && p.method !== 'cod_pending'
          ? sum + (p.amount || 0)
          : sum,
      0
    );

  // Total refunded across this order's customer returns + refunded payments
  const orderRefunded = (order: Order): number => {
    const fromReturns = (customerReturns || [])
      .filter(r => r.order_id === order.id)
      .reduce((s, r) => s + (r.refund_amount || 0), 0);
    const fromPayments = (order.payments || [])
      .filter(p => p.status === 'refunded')
      .reduce((s, p) => s + (p.amount || 0), 0);
    return fromReturns + fromPayments;
  };

  // Payment state: Unpaid / Partially Paid / Paid / Refunded (or Partially Refunded)
  const orderPaymentState = (order: Order): {
    state: 'unpaid' | 'partial' | 'paid' | 'refunded' | 'partial_refund';
    label: string;
    received: number;
  } => {
    const received = orderPaymentsReceived(order);
    const refunded = orderRefunded(order);
    const due = order.total || 0;

    if (refunded > 0 && refunded < Math.max(1, received)) {
      return { state: 'partial_refund', label: 'Partially Refunded', received };
    }
    if (refunded > 0 && refunded >= Math.max(1, received)) {
      return { state: 'refunded', label: 'Refunded', received };
    }
    if (received <= 0) return { state: 'unpaid', label: 'Unpaid', received };
    if (received + 0.5 < due) return { state: 'partial', label: 'Partially Paid', received };
    return { state: 'paid', label: 'Paid', received };
  };

  // COD / Prepaid status for the Cod column — shows whether cash is still owed
  // (Steadfast COD not yet collected) or the order has been settled.
  const orderCodStatus = (order: Order): {
    tone: 'amber' | 'green' | 'red';
    label: string;
  } => {
    const received = orderPaymentsReceived(order);
    const refunded = orderRefunded(order);
    const due = order.total || 0;

    if (refunded > 0 && refunded >= Math.max(1, received)) return { tone: 'red', label: 'Refunded' };
    if (order.fulfillment_method === 'steadfast' && received + 0.5 < due) {
      return { tone: 'amber', label: 'COD' };
    }
    if (received <= 0) return { tone: 'amber', label: 'Unpaid' };
    if (received + 0.5 < due) return { tone: 'amber', label: 'Partial' };
    return { tone: 'green', label: 'Paid' };
  };

  // Deep Customer Profile State
  const [customerProfileData, setCustomerProfileData] = useState<{
    customerName: string;
    phone: string;
    address: string;
    rating: number;
    notes: string;
    stats: any;
    orders: Order[];
  } | null>(null);

  // Customer Rating State (Local/Session state)
  const [customerRatings, setCustomerRatings] = useState<Record<string, number>>({});

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = effectivePageSize;

  const localDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    const controller = new AbortController();
    const isPreOrderViewActive = viewMode === 'pre_orders' || activeTab === 'pre_orders';
    const params = new URLSearchParams({
      page: String(currentPage),
      page_size: String(pageSize),
      view: isPreOrderViewActive ? 'pre_orders' : (isTodayView ? 'today' : 'all'),
    });
    // The server owns the current Asia/Dhaka work-period boundary for Today.
    if (activeTab === 'processing' || activeTab === 'packed' || activeTab === 'dispatched' || activeTab === 'completed' || activeTab === 'cancelled') params.set('status', activeTab === 'processing' ? 'confirmed' : activeTab === 'completed' ? 'delivered' : activeTab);
    if (!isTodayView && !isPreOrderViewActive && dateFilter !== 'all') {
      const date = new Date();
      if (dateFilter === 'yesterday') {
        date.setDate(date.getDate() - 1);
        params.set('date_from', localDateString(date));
        params.set('date_to', localDateString(date));
      } else {
        date.setDate(date.getDate() - (dateFilter === 'week' ? 7 : 30));
        params.set('date_from', localDateString(date));
      }
    }
    if (channelFilter !== 'all') params.set('channel', channelFilter);
    if (orderTypeFilter !== 'all') params.set('order_type', orderTypeFilter === 'direct_sale' ? 'direct_sale' : 'merchant_fulfillment');
    if (searchQuery.trim()) params.set('search', searchQuery.trim());

    setIsLoadingOrders(true);
    fetch(`/api/orders?${params.toString()}`, { signal: controller.signal })
      .then(response => response.json())
      .then(result => {
        if (controller.signal.aborted) return;
        setPageOrders(result.orders || []);
        setServerTotal(result.total || 0);
        setServerTotalPages(result.total_pages || 1);
        setServerStatusCounts(result.status_counts || {});
      })
      .catch(error => { if (error.name !== 'AbortError') console.error('Failed to fetch order page:', error); })
      .finally(() => { if (!controller.signal.aborted) setIsLoadingOrders(false); });
    return () => controller.abort();
  }, [activeTab, channelFilter, dateFilter, isTodayView, viewMode, orderTypeFilter, pageSize, currentPage, searchQuery, pageRefreshKey]);

  // Relative Time Helper
  const getRelativeTime = (dateStr: string) => {
    const now = new Date();
    const past = new Date(dateStr);
    const diffMs = now.getTime() - past.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 45) return `${Math.max(1, diffSec)}s ago`;
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay === 1) return 'Yesterday';
    if (diffDay < 7) return `${diffDay}d ago`;
    return past.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  // Customer statistics calculator for inline glance & deep profile
  const getCustomerStats = (phone: string, currentOrderId?: string) => {
    const normalizedPhone = phone.replace(/[^0-9]/g, '');
    const cust = customers.find(
      c => c.phone === normalizedPhone || (normalizedPhone.length >= 11 && c.phone.endsWith(normalizedPhone.slice(-11)))
    );
    const customerOrders = orders.filter(
      o => {
        const oPhone = o.customer_phone.replace(/[^0-9]/g, '');
        return (oPhone && oPhone === normalizedPhone) || (cust && o.customer_id === cust.id);
      }
    );

    const total = Math.max(customerOrders.length, cust?.order_count || 1);
    const completedOrders = customerOrders.filter(o => o.status === 'delivered');
    const completed = completedOrders.length;
    const pending = customerOrders.filter(o => ['confirmed', 'packed', 'dispatched'].includes(o.status)).length;
    const cancelled = customerOrders.filter(o => o.status === 'cancelled').length;
    const refunded = cust?.rto_count || (cust?.risk_flag ? 1 : 0);

    const totalSpend = customerOrders
      .filter(o => o.status !== 'cancelled')
      .reduce((sum, o) => sum + o.total, 0);

    const avgOrderValue = total > 0 ? Math.round(totalSpend / Math.max(1, customerOrders.filter(o => o.status !== 'cancelled').length)) : 0;

    const historicalOutcomes = completed + cancelled + refunded;
    const isNew = historicalOutcomes === 0;
    const successRate = historicalOutcomes > 0 ? Math.round((completed / historicalOutcomes) * 100) : null;

    // Preferred channel & fulfillment
    const messengerCount = customerOrders.filter(o => o.channel === 'messenger').length;
    const walkInCount = customerOrders.filter(o => o.channel === 'walk-in').length;
    const preferredChannel = messengerCount >= walkInCount ? 'Messenger (Online)' : 'Walk-in Showroom';

    const steadfastCount = customerOrders.filter(o => o.fulfillment_method === 'steadfast').length;
    const inHouseCount = customerOrders.filter(o => o.fulfillment_method === 'in_house').length;
    const pickupCount = customerOrders.filter(o => o.fulfillment_method === 'self_pickup').length;
    const preferredFulfillment =
      steadfastCount >= inHouseCount && steadfastCount >= pickupCount
        ? 'Steadfast Courier COD'
        : inHouseCount >= pickupCount
        ? 'In-House Hand Delivery'
        : 'Store Self-Pickup';

    const currentRating = customerRatings[normalizedPhone] || (cust?.risk_flag ? 2 : successRate && successRate >= 80 ? 5 : 4);

    return {
      total,
      completed,
      pending,
      cancelled,
      refunded,
      successRate,
      isNew,
      totalSpend,
      avgOrderValue,
      preferredChannel,
      preferredFulfillment,
      currentRating,
      isRisk: cust?.risk_flag || (cancelled + refunded >= 2 && (successRate ?? 0) < 50),
      rawCustomer: cust,
      allOrders: customerOrders,
    };
  };

  // Status Tab Counts
  const counts = {
    all: isTodayView ? serverTotal : orders.length,
    pre_orders: orders.filter(o => o.order_timing === 'pre_order' && o.status !== 'cancelled').length,
    processing: isTodayView ? (serverStatusCounts.confirmed || 0) : orders.filter(o => o.status === 'confirmed').length,
    packed: isTodayView ? (serverStatusCounts.packed || 0) : orders.filter(o => o.status === 'packed').length,
    dispatched: isTodayView ? (serverStatusCounts.dispatched || 0) : orders.filter(o => o.status === 'dispatched').length,
    completed: isTodayView ? (serverStatusCounts.delivered || 0) : orders.filter(o => o.status === 'delivered').length,
    cancelled: isTodayView ? (serverStatusCounts.cancelled || 0) : orders.filter(o => o.status === 'cancelled').length,
    rto: courierBookings.filter(b => b.status === 'rto').length,
  };

  // Filtering Logic
  const filteredOrders = pageOrders.filter(o => {
    // Tab Filter
    if (activeTab === 'pre_orders' && o.order_timing !== 'pre_order') return false;
    if (activeTab === 'processing' && o.status !== 'confirmed') return false;
    if (activeTab === 'packed' && o.status !== 'packed') return false;
    if (activeTab === 'dispatched' && o.status !== 'dispatched') return false;
    if (activeTab === 'completed' && o.status !== 'delivered') return false;
    if (activeTab === 'cancelled' && o.status !== 'cancelled') return false;
    if (activeTab === 'rto') {
      const isRto = courierBookings.some(b => b.order_id === o.id && b.status === 'rto');
      if (!isRto) return false;
    }

    // Channel Filter
    if (channelFilter !== 'all' && o.channel !== channelFilter) return false;

    // Order Type Filter (Direct Sale vs Dropship Fulfillment)
    if (orderTypeFilter !== 'all') {
      const isDropship = o.order_type === 'merchant_fulfillment';
      if (orderTypeFilter === 'merchant_fulfillment' && !isDropship) return false;
      if (orderTypeFilter === 'direct_sale' && isDropship) return false;
    }

    // Date Filter is enforced by the server for this paged view.
    if (dateFilter !== 'all' && !isTodayView) {
      const orderDate = new Date(o.created_at);
      const now = new Date();
      if (dateFilter === 'today') {
        if (orderDate.toDateString() !== now.toDateString()) return false;
      } else if (dateFilter === 'yesterday') {
        const yest = new Date(now);
        yest.setDate(now.getDate() - 1);
        if (orderDate.toDateString() !== yest.toDateString()) return false;
      } else if (dateFilter === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (orderDate < weekAgo) return false;
      } else if (dateFilter === 'month') {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        if (orderDate < monthAgo) return false;
      }
    }

    // Customer Filter
    if (customerFilter !== 'all') {
      const stats = getCustomerStats(o.customer_phone, o.id);
      if (customerFilter === 'new' && !stats.isNew) return false;
      if (customerFilter === 'returning' && stats.isNew) return false;
      if (customerFilter === 'risk' && !stats.isRisk) return false;
    }

    // Search Query Filter is enforced by the server for this paged view.
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchInv = o.invoice_number.toLowerCase().includes(q);
      const matchCust = o.customer_name.toLowerCase().includes(q);
      const matchPhone = o.customer_phone.includes(q);
      const matchAddr = (o.delivery_address_text || '').toLowerCase().includes(q);
      const matchMerchant = (o.merchant_name || '').toLowerCase().includes(q) ||
        (o.merchant_id || '').toLowerCase().includes(q) ||
        (o.parcel_id || '').toLowerCase().includes(q) ||
        (o.end_customer_name || '').toLowerCase().includes(q);
      const matchItem = o.items.some(
        it => it.product_name.toLowerCase().includes(q) || it.sku.toLowerCase().includes(q)
      );
      if (!matchInv && !matchCust && !matchPhone && !matchAddr && !matchMerchant && !matchItem) return false;
    }

    return true;
  });

  // Pagination calculations
  const totalPages = serverTotalPages;
  const paginatedOrders = filteredOrders;

  const hasWesternPendingWork = (order: Order) =>
    !['packed', 'dispatched', 'delivered', 'cancelled', 'returned', 'rto'].includes(order.status) &&
    order.items.some(item => item.perfume_type === 'Western' || products.some(product => product.id === item.product_id && product.perfume_type === 'Western'));

  // Bulk Actions
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedOrderIds(paginatedOrders.map(o => o.id));
    } else {
      setSelectedOrderIds([]);
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedOrderIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Shared bulk eligibility helpers
  const isOrderBooked = (order: Order) =>
    Boolean(order.courier_tracking_code || courierBookings.find(b => b.order_id === order.id)?.consignment_no);

  // Bulk Book Steadfast - books only (never packs; packing stays in Packing queue)
  const handleBulkBook = async () => {
    const targets = orders.filter(o =>
      selectedOrderIds.includes(o.id) &&
      o.fulfillment_method === 'steadfast' &&
      (o.status === 'confirmed' || o.status === 'packed') &&
      !isOrderBooked(o)
    );
    if (targets.length === 0) return;
    setIsProcessingBulk(true);
    try {
      for (const target of targets) await bookCourier(target.id);
      await refreshAll();
      setSelectedOrderIds([]);
      setPageRefreshKey(value => value + 1);
    } finally {
      setIsProcessingBulk(false);
    }
  };

  // Bulk Print Steadfast thermal stickers - only for booked Steadfast orders
  const handleBulkPrintStickers = () => {
    const targets = orders.filter(o =>
      selectedOrderIds.includes(o.id) &&
      o.fulfillment_method === 'steadfast' &&
      isOrderBooked(o)
    );
    if (targets.length === 0) return;
    for (const target of targets) {
      generateShippingLabelPdf(target, {
        business_name: settings?.company_name || 'Mirage Perfume Bangladesh',
        business_phone: settings?.phone || '',
      });
    }
  };

  // Bulk Print Invoices - never for merchant fulfillment (no Mirage customer invoice)
  const handleBulkPrintInvoices = () => {
    const targets = orders.filter(o =>
      selectedOrderIds.includes(o.id) &&
      o.order_type !== 'merchant_fulfillment'
    );
    if (targets.length === 0) return;
    for (const target of targets) {
      generateInvoicePdf(target, {
        business_name: settings?.company_name || 'Mirage Perfume Bangladesh',
        business_phone: settings?.phone || '',
        business_address: settings?.address || '',
      });
    }
  };

  // Bulk Move Pre-Orders to Today's Orders
  const handleBulkMovePreOrders = async () => {
    if (selectedOrderIds.length === 0) return;
    setIsProcessingBulk(true);
    setBulkMoveMessage(null);
    try {
      const res = await bulkMovePreOrdersToToday(selectedOrderIds);
      if (res.failed_count > 0) {
        setBulkMoveMessage({
          type: 'error',
          text: `Moved ${res.moved_count} order(s). ${res.failed_count} failed: ${res.errors.join('; ')}`,
        });
      } else {
        setBulkMoveMessage({
          type: 'success',
          text: `Successfully moved ${res.moved_count} order(s) into Today's Orders queue!`,
        });
      }
      setSelectedOrderIds([]);
      await refreshAll();
      setPageRefreshKey(v => v + 1);
    } catch (err: any) {
      setBulkMoveMessage({ type: 'error', text: err.message || 'Failed to move pre-orders' });
    } finally {
      setIsProcessingBulk(false);
    }
  };

  // Single Move Order to Today's Orders
  const handleMoveOrderToToday = async (e: React.MouseEvent, order: Order) => {
    e.stopPropagation();
    setMovingOrderId(order.id);
    setBulkMoveMessage(null);
    try {
      await movePreOrderToToday(order.id);
      setBulkMoveMessage({
        type: 'success',
        text: `Order #${order.invoice_number.replace('INV-2026-', '')} moved into Today's Orders queue!`,
      });
      await refreshAll();
      setPageRefreshKey(v => v + 1);
    } catch (err: any) {
      setBulkMoveMessage({ type: 'error', text: err.message || 'Failed to move order' });
    } finally {
      setMovingOrderId(null);
    }
  };

  const bulkTargetCounts = {
    book: orders.filter(o => selectedOrderIds.includes(o.id) && o.fulfillment_method === 'steadfast' && (o.status === 'confirmed' || o.status === 'packed') && !isOrderBooked(o)).length,
    stickers: orders.filter(o => selectedOrderIds.includes(o.id) && o.fulfillment_method === 'steadfast' && isOrderBooked(o)).length,
    invoices: orders.filter(o => selectedOrderIds.includes(o.id) && o.order_type !== 'merchant_fulfillment').length,
    preOrders: orders.filter(o => selectedOrderIds.includes(o.id) && (o.order_timing === 'pre_order' || o.order_timing === 'scheduled')).length,
  };

  // Per-order sticker print - blocked unless a real Steadfast consignment ID exists
  const handlePrintSticker = (e: React.MouseEvent, order: Order) => {
    e.stopPropagation();
    const booking = courierBookings.find(b => b.order_id === order.id);
    const trackingId = order.courier_tracking_code || booking?.consignment_no;
    if (!trackingId) {
      setStickerBlockMsg(
        `Book this order with Steadfast first - no tracking ID available yet to print on the sticker.\n\nOrder: ${order.invoice_number} (${order.customer_name})`
      );
      return;
    }
    generateShippingLabelPdf(order, {
      business_name: settings?.company_name || 'Mirage Perfume Bangladesh',
      business_phone: settings?.phone || '',
    });
  };


  // Open Deep Customer Profile Modal
  const handleOpenCustomerProfile = (e: React.MouseEvent, order: Order) => {
    e.stopPropagation();
    const stats = getCustomerStats(order.customer_phone, order.id);
    const normalizedPhone = order.customer_phone.replace(/[^0-9]/g, '');

    setCustomerProfileData({
      customerName: order.customer_name,
      phone: order.customer_phone,
      address: order.delivery_address_text || 'Showroom In-Store Handoff',
      rating: customerRatings[normalizedPhone] || stats.currentRating,
      notes: order.notes || (stats.isRisk ? 'Requires advance COD verification before dispatch.' : 'VIP Customer. Priority fragrance packaging.'),
      stats,
      orders: stats.allOrders.length > 0 ? stats.allOrders : [order],
    });
  };

  const handleUpdateRating = (newRating: number) => {
    if (!customerProfileData) return;
    const normalizedPhone = customerProfileData.phone.replace(/[^0-9]/g, '');
    setCustomerRatings(prev => ({ ...prev, [normalizedPhone]: newRating }));
    setCustomerProfileData(prev => prev ? { ...prev, rating: newRating } : null);
  };

  const handleSendToSteadfast = async (e: React.MouseEvent, order: Order) => {
    e.stopPropagation();
    // "Book Steadfast" = courier booking only (Section 12). Booking is not
    // dispatch - the order is packed in the Packing queue, then the thermal
    // label is printed, then it is dispatched. This never packs here.
    if (!['confirmed', 'packed'].includes(order.status)) return;
    await bookCourier(order.id);
    setPageRefreshKey(value => value + 1);
  };

  const handleConfirmCancellation = async () => {
    if (!cancellationTarget || !cancellationReason) return;
    const reason = cancellationReason === 'Other (please specify)'
      ? `Other (please specify): ${cancellationOtherReason.trim()}`
      : cancellationReason;
    if (!reason) return;
    setIsCancelling(true);
    try {
      const updated = await cancelOrder(cancellationTarget.id, reason);
      setCancellationTarget(null);
      setCancellationReason('');
      setCancellationOtherReason('');
      setSelectedOrder(updated);
      setPageRefreshKey(value => value + 1);
    } finally {
      setIsCancelling(false);
    }
  };

  // ---- Glance pill hover popover ----
  const GLANCE_POPOVER_W = 220;
  const GLANCE_POPOVER_H = 150;
  const openGlancePopover = (order: Order, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const top = rect.bottom + GLANCE_POPOVER_H > window.innerHeight
      ? rect.top - GLANCE_POPOVER_H - 6
      : rect.bottom + 6;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - GLANCE_POPOVER_W - 8));
    setGlancePopover({ order, x: left, y: top });
  };

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto" id="orders-main-view">
      {/* Header & Status Tabs Bar */}
      <div className="flex flex-col gap-3">
        {/* Top Status Tabs */}
        {!isCancelledView && <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          <button
            onClick={() => { setActiveTab('all'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'all'
                ? 'bg-[var(--accent)] text-[var(--accent-contrast)] shadow-xs'
                : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border)]'
            }`}
          >
            <span>All Orders</span>
            <span className="px-1.5 py-0.2 rounded font-num text-[10px] bg-black/15">{counts.all}</span>
          </button>

          <button
            onClick={() => { setActiveTab('pre_orders'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'pre_orders'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border)]'
            }`}
          >
            <Boxes className="w-3.5 h-3.5" />
            <span>Pre-Orders</span>
            <span className="px-1.5 py-0.2 rounded font-num text-[10px] bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/30">{counts.pre_orders}</span>
          </button>

          <button
            onClick={() => { setActiveTab('processing'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'processing'
                ? 'bg-[var(--accent)] text-[var(--accent-contrast)] shadow-xs'
                : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border)]'
            }`}
          >
            <span>Confirmed</span>
            <span className="px-1.5 py-0.2 rounded font-num text-[10px] pill-teal border">{counts.processing}</span>
          </button>

          <button
            onClick={() => { setActiveTab('packed'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'packed'
                ? 'bg-[var(--accent)] text-[var(--accent-contrast)] shadow-xs'
                : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border)]'
            }`}
          >
            <span>Packed</span>
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
            <span>Dispatched</span>
            <span className="px-1.5 py-0.2 rounded font-num text-[10px] pill-teal border">{counts.dispatched}</span>
          </button>

          <button
            onClick={() => { setActiveTab('completed'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'completed'
                ? 'bg-[var(--accent)] text-[var(--accent-contrast)] shadow-xs'
                : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border)]'
            }`}
          >
            <span>Delivered</span>
            <span className="px-1.5 py-0.2 rounded font-num text-[10px] pill-green border">{counts.completed}</span>
          </button>

          <button
            onClick={() => { setActiveTab('rto'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'rto'
                ? 'bg-[var(--accent)] text-[var(--accent-contrast)] shadow-xs'
                : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border)]'
            }`}
          >
            <span>Returns / RTO</span>
            <span className="px-1.5 py-0.2 rounded font-num text-[10px] pill-red border">{counts.rto}</span>
          </button>

          <button
            onClick={() => { setActiveTab('cancelled'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'cancelled'
                ? 'bg-[var(--accent)] text-[var(--accent-contrast)] shadow-xs'
                : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border)]'
            }`}
          >
            <span>Cancelled</span>
            <span className="px-1.5 py-0.2 rounded font-num text-[10px] bg-[var(--surface-sunken)] border border-[var(--border)]">{counts.cancelled}</span>
          </button>
        </div>}

        {isCancelledView && (
          <div className="rounded-xl border border-[var(--status-red)]/25 bg-[var(--status-red)]/5 px-4 py-3 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-[var(--text)]">Cancelled Order Register</h2>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">Permanent cancellation history, refund accountability, and physical stock recovery status.</p>
            </div>
            <div className="text-right shrink-0">
              <div className="text-lg font-bold font-num text-[var(--status-red)]">{serverTotal}</div>
              <div className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wide">cancelled records</div>
            </div>
          </div>
        )}

        {isPreOrdersView && !isCancelledView && (
          <div className="rounded-xl border border-purple-500/25 bg-purple-500/5 px-4 py-3 flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Boxes className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <h2 className="text-sm font-bold text-[var(--text)]">Pre-Orders Register</h2>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Orders awaiting incoming stock or import shipments. Review stock availability and approve or move them directly to Today&apos;s Orders.
              </p>
            </div>
            <div className="text-right shrink-0">
              <div className="text-lg font-bold font-num text-purple-600 dark:text-purple-400">{serverTotal}</div>
              <div className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wide">pre-order records</div>
            </div>
          </div>
        )}

        {bulkMoveMessage && (
          <div className={`p-3 rounded-xl border flex items-center justify-between gap-2 text-xs font-semibold ${
            bulkMoveMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
              : 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300'
          }`}>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{bulkMoveMessage.text}</span>
            </div>
            <button onClick={() => setBulkMoveMessage(null)} className="p-1 hover:opacity-70 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Floating Contextual Bulk Action Bar - Appears smoothly when 1+ orders are selected */}
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
              {/* Book Steadfast - only when some selected orders are Steadfast + not yet booked */}
              {bulkTargetCounts.book > 0 && (
                <button
                  onClick={handleBulkBook}
                  disabled={isProcessingBulk}
                  className="erp-btn-primary text-xs flex items-center gap-1.5 disabled:opacity-50"
                  title={`Book ${bulkTargetCounts.book} Steadfast order${bulkTargetCounts.book > 1 ? 's' : ''} with the courier (no dispatch)`}
                >
                  {isProcessingBulk ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span>Booking...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Book {bulkTargetCounts.book}</span>
                    </>
                  )}
                </button>
              )}

              {/* Print Thermal Stickers - only for selected orders already booked with Steadfast */}
              {bulkTargetCounts.stickers > 0 && (
                <button
                  onClick={handleBulkPrintStickers}
                  className="erp-btn-secondary text-xs flex items-center gap-1.5"
                  title={`Print ${bulkTargetCounts.stickers} Steadfast thermal sticker${bulkTargetCounts.stickers > 1 ? 's' : ''} (booked orders only)`}
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{bulkTargetCounts.stickers} Sticker{bulkTargetCounts.stickers > 1 ? 's' : ''}</span>
                </button>
              )}

              {/* Print Invoices - never for merchant fulfillment */}
              {bulkTargetCounts.invoices > 0 && !isCancelledView && (
                <button
                  onClick={handleBulkPrintInvoices}
                  className="erp-btn-secondary text-xs flex items-center gap-1.5"
                  title={`Print ${bulkTargetCounts.invoices} customer invoice${bulkTargetCounts.invoices > 1 ? 's' : ''} (A4)`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>{bulkTargetCounts.invoices} Invoice{bulkTargetCounts.invoices > 1 ? 's' : ''}</span>
                </button>
              )}

              {/* Print Summary Order Sheet - always available for any selection (ghost/secondary) */}
              {!isCancelledView && (
                <button
                  onClick={() => {
                    const selectedOrders = orders.filter(o => selectedOrderIds.includes(o.id));
                    generateOrderSheetPdf(selectedOrders, courierBookings, "Selected Orders Summary Sheet");
                  }}
                  className="erp-btn-ghost text-xs flex items-center gap-1.5"
                  title="Print a packing summary sheet for the selected orders"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Summary Sheet</span>
                </button>
              )}

              {/* Bulk Move Pre-Orders to Today */}
              {(bulkTargetCounts.preOrders > 0 || isPreOrdersView) && (
                <button
                  type="button"
                  onClick={handleBulkMovePreOrders}
                  disabled={isProcessingBulk}
                  className="erp-btn-primary text-xs flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
                  title="Approve and move selected pre-orders into Today's Orders queue"
                >
                  {isProcessingBulk ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span>Moving to Today...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Move to Today ({selectedOrderIds.length})</span>
                    </>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={() => setSelectedOrderIds([])}
                className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] rounded-lg cursor-pointer transition-colors"
                title="Cancel selection"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Dense Filters Bar \u2014 Search + Date + Filter dropdown inline */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 shadow-xs flex flex-wrap items-center justify-between gap-2.5">
          {/* Left: Date Filter + Filter Dropdown + Column Toggle */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Date Filter \u2014 always inline */}
            {!isTodayView && !isCancelledView && <select
              value={dateFilter}
              onChange={(e) => { setDateFilter(e.target.value as any); setCurrentPage(1); }}
              className="erp-select text-xs"
            >
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="week">Past 7 Days</option>
              <option value="month">Past 30 Days</option>
            </select>}

            {/* Secondary Filters Dropdown \u2014 Channels, Order Types, Customer Types */}
            {!isCancelledView && (
              <div className="relative" ref={filterPopoverRef}>
                <button
                  type="button"
                  onClick={() => setShowFilterPopover(!showFilterPopover)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                    showFilterPopover || channelFilter !== 'all' || orderTypeFilter !== 'all' || customerFilter !== 'all'
                      ? 'bg-[var(--accent)] text-[var(--accent-contrast)] border-[var(--accent)]'
                      : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] border-[var(--border)]'
                  }`}
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>Filters</span>
                  {(channelFilter !== 'all' || orderTypeFilter !== 'all' || customerFilter !== 'all') && (
                    <span className="px-1 py-0.2 rounded font-num text-[9px] bg-white/20">
                      {[channelFilter !== 'all', orderTypeFilter !== 'all', customerFilter !== 'all'].filter(Boolean).length}
                    </span>
                  )}
                  <ChevronDown className={`w-3 h-3 transition-transform ${showFilterPopover ? 'rotate-180' : ''}`} />
                </button>

                {showFilterPopover && (
                  <div className="absolute left-0 top-full mt-1 z-50 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-lg p-3 w-56 space-y-3">
                    {/* Channel */}
                    <div>
                      <label className="block text-[10px] uppercase font-semibold text-[var(--text-secondary)] mb-1 tracking-wider">Channel</label>
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
                    {/* Order Type */}
                    <div>
                      <label className="block text-[10px] uppercase font-semibold text-[var(--text-secondary)] mb-1 tracking-wider">Order Type</label>
                      <select
                        value={orderTypeFilter}
                        onChange={(e) => { setOrderTypeFilter(e.target.value as any); setCurrentPage(1); }}
                        className="erp-select text-xs w-full"
                      >
                        <option value="all">All Order Types</option>
                        <option value="direct_sale">Direct Sale</option>
                        <option value="merchant_fulfillment">Dropship Fulfillment</option>
                      </select>
                    </div>
                    {/* Customer Type */}
                    <div>
                      <label className="block text-[10px] uppercase font-semibold text-[var(--text-secondary)] mb-1 tracking-wider">Customer Type</label>
                      <select
                        value={customerFilter}
                        onChange={(e) => { setCustomerFilter(e.target.value as any); setCurrentPage(1); }}
                        className="erp-select text-xs w-full"
                      >
                        <option value="all">All Customer Types</option>
                        <option value="new">New Customers</option>
                        <option value="returning">Returning Customers</option>
                        <option value="risk">High Risk Flag</option>
                      </select>
                    </div>
                    {/* Clear All */}
                    {(channelFilter !== 'all' || orderTypeFilter !== 'all' || customerFilter !== 'all') && (
                      <button
                        type="button"
                        onClick={() => {
                          setChannelFilter('all');
                          setOrderTypeFilter('all');
                          setCustomerFilter('all');
                          setCurrentPage(1);
                        }}
                        className="w-full text-center text-[11px] font-semibold text-[var(--status-red)] hover:underline cursor-pointer py-1"
                      >
                        Clear all filters
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Columns Toggle — show/hide optional columns */}
            <div className="relative" ref={columnsDropdownRef}>
              <button
                type="button"
                onClick={() => setShowColumnsDropdown(!showColumnsDropdown)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                  showColumnsDropdown
                    ? 'bg-[var(--accent)] text-[var(--accent-contrast)] border-[var(--accent)]'
                    : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] border-[var(--border)]'
                }`}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
                <span>Columns</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${showColumnsDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showColumnsDropdown && (
                <div className="absolute left-0 top-full mt-1 z-50 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-lg p-3 w-48">
                  <div className="text-[10px] uppercase font-semibold text-[var(--text-secondary)] mb-2 tracking-wider">Optional Columns</div>
                  {[
                    { key: 'payment', label: 'Payment' },
                    { key: 'items', label: 'Items' },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 py-1 cursor-pointer text-xs text-[var(--text)] hover:text-[var(--accent)]">
                      <input
                        type="checkbox"
                        checked={visibleColumns.has(key)}
                        onChange={() => {
                          setVisibleColumns(prev => {
                            const next = new Set(prev);
                            if (next.has(key)) next.delete(key); else next.add(key);
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

            {/* Table-level More Options menu — the single ⋮ for the whole table */}
            <div className="relative" ref={headerMenuRef}>
              <button
                type="button"
                onClick={() => setShowHeaderMenu(!showHeaderMenu)}
                className={`flex items-center justify-center w-8 h-8 rounded-lg border transition-colors cursor-pointer ${
                  showHeaderMenu
                    ? 'bg-[var(--accent)] text-[var(--accent-contrast)] border-[var(--accent)]'
                    : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] border-[var(--border)]'
                }`}
                title="More options"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {showHeaderMenu && (
                <div className="absolute right-0 top-full mt-1 z-50 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-lg p-1.5 w-60">
                  <div className="text-[10px] uppercase font-semibold text-[var(--text-secondary)] px-2.5 pt-1 pb-1.5 tracking-wider">Table options</div>
                  <button
                    type="button"
                    onClick={() => { refreshAll(); setPageRefreshKey(v => v + 1); setShowHeaderMenu(false); }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer text-left"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-[var(--text-secondary)] shrink-0" />
                    Refresh Orders
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const targets = paginatedOrders.filter(o => o.order_type !== 'merchant_fulfillment');
                      targets.forEach(o => generateInvoicePdf(o, {
                        business_name: settings?.company_name || 'Mirage Perfume Bangladesh',
                        business_phone: settings?.phone || '',
                        business_address: settings?.address || '',
                      }));
                      setShowHeaderMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer text-left"
                  >
                    <Printer className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
                    Print Invoices (Current Page)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const targets = paginatedOrders.filter(o => o.fulfillment_method === 'steadfast' && isOrderBooked(o));
                      targets.forEach(o => generateShippingLabelPdf(o, {
                        business_name: settings?.company_name || 'Mirage Perfume Bangladesh',
                        business_phone: settings?.phone || '',
                      }));
                      setShowHeaderMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer text-left"
                  >
                    <Tag className="w-3.5 h-3.5 text-[var(--status-green)] shrink-0" />
                    Print Stickers (Current Page)
                  </button>
                </div>
              )}
            </div>

            {/* Right: Search only - pagination lives in the table footer */}
            <div className="relative ml-auto">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                placeholder="Search orders, SKU, phone..."
                className="erp-input pl-7 w-48 sm:w-60"
              />
              <Search className="w-3.5 h-3.5 text-[var(--text-secondary)] absolute left-2.5 top-2" />
            </div>
          </div>
        </div>
      </div>

      {isTodayView && (
        <div className="bg-[var(--accent)] text-[var(--accent-contrast)] rounded-xl px-4 py-3 flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-bold">Today&apos;s work queue</div>
            <div className="text-xs opacity-80">Review confirmed orders, pack what is ready, and complete dispatch actions.</div>
          </div>
          <div className="text-right text-xs font-num whitespace-nowrap">{counts.processing + counts.packed + counts.dispatched} active</div>
        </div>
      )}

      {!isTodayView && (
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
          <div>
            <h2 className="text-base font-bold text-[var(--text)]">Order history</h2>
            <p className="text-xs text-[var(--text-secondary)]">Search and inspect past transactions across the full database.</p>
          </div>
          <span className="text-xs text-[var(--text-secondary)] font-num">Page {currentPage} of {totalPages}</span>
        </div>
      )}

      {/* Main High-Density Orders Table (Universal Clickable Row) */}
      <div className="dense-table-container">
        <div className="overflow-auto max-h-[70vh]">
          <table className="dense-table min-w-[1800px]">
            <thead>
              <tr>
                {/* Order column - hosts the compact Select All control */}
                <th className="w-28">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      onChange={handleSelectAll}
                      checked={paginatedOrders.length > 0 && selectedOrderIds.length === paginatedOrders.length}
                      disabled={paginatedOrders.length === 0}
                      className="rounded border-[var(--border)] text-[var(--accent)] cursor-pointer w-3.5 h-3.5 disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Select all on this page"
                    />
                    <span>Order</span>
                  </div>
                </th>
                <th className="w-56">Customer &amp; Address</th>
                <th className="w-20">Date</th>
                <th className="w-24 text-center">Status</th>
                <th className="w-24 text-center">Cust. Type</th>
                <th className="w-32 text-center">Fulfillment</th>
                <th className="w-20 text-center">Cod</th>
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
              {paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={14 + (visibleColumns.has('payment') ? 1 : 0) + (visibleColumns.has('items') ? 1 : 0)} className="p-10 text-center text-xs text-[var(--text-secondary)]">
                    No orders found matching the filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((order) => {
                  const stats = getCustomerStats(order.customer_phone, order.id);
                  const isSelected = selectedOrderIds.includes(order.id);
                  const courierBooking = courierBookings.find(b => b.order_id === order.id);
                  const booked = isOrderBooked(order);
                  const glanceR = stats.pending > 0 ? 4 : stats.completed > 0 ? 3 : (stats.cancelled + stats.refunded) > 0 ? 2 : 1;
                  const glanceLabel = glanceR === 4 ? `${stats.pending} Pending` : glanceR === 3 ? `${stats.completed} Delivered` : glanceR === 2 ? `${stats.cancelled + stats.refunded} Cancelled` : 'New';

                  const pState = orderPaymentState(order);
                  const codState = orderCodStatus(order);
                  const custTypeLabel = stats.isRisk ? 'Risk' : stats.isNew ? 'New' : 'Returning';
                  const consignment = order.courier_tracking_code || courierBooking?.consignment_no || courierBooking?.booking_id || '';
                  const itemQty = (order.items || []).reduce((s, it) => s + (it.quantity || 0), 0);
                  const originLabel = order.channel === 'walk-in' ? 'Walk-in' : 'Messenger';

                  return (
                    <tr
                      onClick={() => setSelectedOrder(order)}
                      className={`dense-table-row-clickable ${
                        isSelected ? 'dense-table-row-selected' : ''
                      }`}
                    >
                      {/* Order Column: hover checkbox + #INV - no checkbox column reserved */}
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
                            {order.order_timing === 'pre_order' && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30">
                                <Boxes className="w-2.5 h-2.5" />
                                <span>Pre-Order</span>
                              </span>
                            )}
                            {order.order_timing === 'scheduled' && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                                <Calendar className="w-2.5 h-2.5" />
                                <span>Sched {order.scheduled_date ? `(${order.scheduled_date})` : ''}</span>
                              </span>
                            )}
                            {order.order_type === 'merchant_fulfillment' && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-[color-mix(in_srgb,var(--status-purple)_12%,transparent)] text-[var(--status-purple)] border border-[color-mix(in_srgb,var(--status-purple)_30%,transparent)]">
                                <Building2 className="w-2.5 h-2.5" />
                                <span>Dropship</span>
                              </span>
                            )}
                            {isTodayView && hasWesternPendingWork(order) && (
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-bold pill-amber">
                                Western - Packing Pending
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 font-num text-[11px] text-[var(--accent)] font-semibold">
                            <Phone className="w-2.5 h-2.5 shrink-0" />
                            <span>{order.customer_phone}</span>
                          </div>
                          {order.order_type === 'merchant_fulfillment' && (order.merchant_name || order.parcel_id) && (
                            <div className="text-[10px] text-[var(--status-purple)] font-medium line-clamp-1">
                              {order.merchant_name && <span>{order.merchant_name}</span>}
                              {order.merchant_name && order.parcel_id && <span> &bull; </span>}
                              {order.parcel_id && <span className="font-mono">PID: {order.parcel_id}</span>}
                            </div>
                          )}
                          <div className="text-[10px] text-[var(--text-secondary)] line-clamp-1">
                            {order.delivery_address_text || 'Showroom In-Store Handoff'}
                          </div>
                          {isCancelledView && (
                            <div className="mt-1 space-y-0.5 text-[10px]">
                              <div className="text-[var(--status-red)] font-semibold line-clamp-1">Reason: {order.cancel_reason || '\u2014'}</div>
                              <div className="text-[var(--text-secondary)]">By {order.cancelled_by_name || '\u2014'} &#183; Refund &#2547;{(order.refunded_amount || 0).toLocaleString()}</div>
                              {order.physical_recovery_required && <div className="text-[var(--status-amber)] font-semibold">Physical scan-back required</div>}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Date */}
                      <td className="align-middle text-[11px] text-[var(--text-secondary)] whitespace-nowrap font-num">
                        {getRelativeTime(order.created_at)}
                      </td>

                      {/* Status Pill */}
                      <td className="align-middle text-center">
                        <StatusBadge status={order.status} size="sm" />
                        {(order.order_timing === 'pre_order' || order.order_timing === 'scheduled') && (
                          <div className="mt-1 flex flex-col items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={(e) => handleMoveOrderToToday(e, order)}
                              disabled={movingOrderId === order.id}
                              className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-opacity flex items-center gap-0.5 shadow-xs cursor-pointer disabled:opacity-50"
                              title="Move this order to Today's Orders queue"
                            >
                              {movingOrderId === order.id ? (
                                <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-2.5 h-2.5" />
                              )}
                              <span>To Today</span>
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Cust. Type: Risk / New / Returning */}
                      <td className="align-middle text-center">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap ${
                          stats.isRisk ? 'pill-red' : stats.isNew ? 'bg-[var(--surface-sunken)] text-[var(--text-secondary)] border border-[var(--border)]' : 'pill-green'
                        }`}>
                          {custTypeLabel}
                        </span>
                      </td>

                      {/* Fulfillment - booking action only in Today's; All/Cancelled show historical label */}
                      <td className="align-middle text-center" onClick={(e) => e.stopPropagation()}>
                        {!isTodayView ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--surface-sunken)] text-[var(--text-secondary)] font-semibold text-[10px] border border-[var(--border)] whitespace-nowrap">
                            {order.fulfillment_method === 'steadfast' && <Truck className="w-2.5 h-2.5" />}
                            {fulfillmentLabel(order)}
                          </span>
                        ) : order.fulfillment_method === 'steadfast' && ['confirmed', 'packed'].includes(order.status) && !booked ? (
                          <button
                            type="button"
                            onClick={(e) => handleSendToSteadfast(e, order)}
                            className="px-2 py-0.5 bg-[var(--accent)] hover:opacity-90 text-[var(--accent-contrast)] rounded text-[10px] font-semibold shadow-xs cursor-pointer"
                          >
                            Book Steadfast
                          </button>
                        ) : order.fulfillment_method === 'steadfast' && booked ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--surface-sunken)] text-[var(--accent)] font-semibold text-[10px] border border-[var(--border)] font-num whitespace-nowrap" title={order.courier_tracking_code || courierBooking?.consignment_no || ''}>
                            <CheckCircle2 className="w-2.5 h-2.5 text-[var(--accent)]" />
                            Booked
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--surface-sunken)] text-[var(--text-secondary)] font-semibold text-[10px] border border-[var(--border)] whitespace-nowrap">
                            {order.fulfillment_method === 'steadfast' && <Truck className="w-2.5 h-2.5" />}
                            {fulfillmentLabel(order)}
                          </span>
                        )}
                      </td>

                      {/* COD / Prepaid */}
                      <td className="align-middle text-center">
                        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold font-num border whitespace-nowrap ${
                          codState.tone === 'amber' ? 'pill-amber' : codState.tone === 'red' ? 'pill-red' : 'pill-green'
                        }`}>
                          {codState.tone === 'red' && <XCircle className="w-2.5 h-2.5" />}
                          {codState.label}
                        </span>
                      </td>

                      {/* Print - quick primary print (invoice, or merchant sticker) */}
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

                      {/* Consignment / tracking no */}
                      <td className="align-middle whitespace-nowrap">
                        {consignment ? (
                          <span className="font-mono text-[10px] font-semibold text-[var(--accent)]" title={consignment}>{consignment}</span>
                        ) : (
                          <span className="text-[var(--text-secondary)] text-[11px]">—</span>
                        )}
                      </td>

                      {/* Score - customer rating */}
                      <td className="align-middle text-right whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold font-num text-[var(--accent-secondary)] border border-[color-mix(in_srgb,var(--accent-secondary)_30%,transparent)] bg-[color-mix(in_srgb,var(--accent-secondary)_12%,transparent)]">
                          <Star className="w-2.5 h-2.5 fill-[var(--accent-secondary)] text-[var(--accent-secondary)]" />
                          {stats.currentRating}.0
                        </span>
                      </td>

                      {/* Total */}
                      <td className="align-middle text-right font-num font-bold text-[var(--text)]">
                        &#2547;{order.total.toLocaleString()}
                      </td>

                      {/* Origin: Messenger / Walk-in */}
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

                      {/* Glance: compact milestone pill - hover popover, click opens profile */}
                      <td className="align-middle text-right" onClick={(e) => e.stopPropagation()}>
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold font-num border cursor-pointer whitespace-nowrap ${
                            glanceR === 4 ? 'pill-amber' : glanceR === 3 ? 'pill-green' : glanceR === 2 ? 'pill-red' : 'bg-[var(--surface-sunken)] text-[var(--text-secondary)]'
                          }`}
                          onClick={(e) => handleOpenCustomerProfile(e, order)}
                          onMouseEnter={(e) => openGlancePopover(order, e.currentTarget)}
                          onMouseLeave={() => setGlancePopover(null)}
                          title={`Customer History: ${stats.completed} Delivered, ${stats.pending} In-Progress, ${stats.refunded} RTO, ${stats.cancelled} Cancelled`}
                        >
                          {glanceLabel}
                        </span>
                      </td>

                      {/* Payment (optional column) */}
                      {visibleColumns.has('payment') && (
                        <td className="align-middle whitespace-nowrap">
                          <div className="text-[10px] font-bold text-[var(--text)]">{pState.label}</div>
                          <div className="text-[10px] text-[var(--text-secondary)] font-num">
                            {pState.received > 0 ? `৳${pState.received.toLocaleString()} received` : '\u2014'}
                          </div>
                        </td>
                      )}

                      {/* Items (optional column) */}
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

      {/* Pagination Footer - range, page nav, and per-page selector for all views */}
      {paginatedOrders.length > 0 && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="text-[11px] text-[var(--text-secondary)] font-num whitespace-nowrap">
            Showing {(currentPage - 1) * effectivePageSize + 1}&#8211;{Math.min(currentPage * effectivePageSize, serverTotal)} of {serverTotal}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] disabled:opacity-30 transition-colors cursor-pointer disabled:cursor-not-allowed"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            {(() => {
              const total = totalPages || 1;
              const cur = currentPage;
              const pages: (number | 'gap')[] = [];
              if (total <= 7) {
                for (let i = 1; i <= total; i++) pages.push(i);
              } else {
                const windowStart = Math.max(1, Math.min(cur - 1, total - 4));
                const windowEnd = Math.min(total, windowStart + 4);
                if (windowStart > 1) { pages.push(1); if (windowStart > 2) pages.push('gap'); }
                for (let i = windowStart; i <= windowEnd; i++) pages.push(i);
                if (windowEnd < total) { if (windowEnd < total - 1) pages.push('gap'); pages.push(total); }
              }
              return (
                <div className="flex items-center gap-0.5">
                  {pages.map((p, idx) => p === 'gap' ? (
                    <span key={`g${idx}`} className="px-1 text-[11px] text-[var(--text-secondary)] font-num">&#8230;</span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setCurrentPage(p)}
                      className={`min-w-[26px] h-[26px] px-1 rounded-lg text-[11px] font-num font-semibold transition-colors cursor-pointer ${
                        p === cur
                          ? 'bg-[var(--accent)] text-[var(--accent-contrast)]'
                          : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
                      }`}
                      aria-label={`Go to page ${p}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              );
            })()}
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
              className="p-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] disabled:opacity-30 transition-colors cursor-pointer disabled:cursor-not-allowed"
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
              {PAGE_SIZE_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt === 0 ? 'All' : `${opt} / page`}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Glance hover popover - fixed, informational, pointer-events-none */}
      {glancePopover && glancePopover.order && (
        <div
          className="fixed z-[72] w-[220px] bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xl p-3 pointer-events-none"
          style={{ left: glancePopover.x, top: glancePopover.y }}
        >
          {(() => {
            const gp = getCustomerStats(glancePopover.order.customer_phone, glancePopover.order.id);
            return (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[10px] uppercase font-semibold tracking-wider text-[var(--text-secondary)]">
                  <span>Customer History</span>
                  <span className="font-num text-[var(--accent)]">{gp.total} Orders</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[var(--text-secondary)]">Delivered</span>
                  <span className="font-num font-bold text-[var(--status-green)]">+{gp.completed}</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[var(--text-secondary)]">In Progress</span>
                  <span className="font-num font-bold text-[var(--status-amber)]">{gp.pending}</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[var(--text-secondary)]">RTO</span>
                  <span className="font-num font-bold text-[var(--status-red)]">{gp.refunded}</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[var(--text-secondary)]">Cancelled</span>
                  <span className="font-num font-bold text-[var(--status-red)]">{gp.cancelled}</span>
                </div>
                <div className="border-t border-[var(--border)] pt-1.5 flex items-center justify-between text-[11px]">
                  <span className="text-[var(--text-secondary)]">Success Rate</span>
                  <span className={`font-num font-bold ${gp.successRate === null ? 'text-[var(--text-secondary)]' : gp.successRate >= 80 ? 'text-[var(--status-green)]' : gp.successRate >= 50 ? 'text-[var(--status-amber)]' : 'text-[var(--status-red)]'}`}>
                    {gp.successRate === null ? 'New' : `${gp.successRate}%`}
                  </span>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ========================================================================= */}
      {/* DEEP CUSTOMER PROFILE WORKSPACE MODAL (Section 5, 6)                      */}
      {/* ========================================================================= */}
      {customerProfileData && (
        <Modal
          open={!!customerProfileData}
          onClose={() => setCustomerProfileData(null)}
          size="xl"
          title={
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] flex items-center justify-center font-bold text-xs">
                {customerProfileData.customerName.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h3 className="text-[14px] font-bold text-[var(--text)]">{customerProfileData.customerName}</h3>
                <div className="text-[11px] font-num text-[var(--accent)] font-semibold">{customerProfileData.phone}</div>
              </div>
            </div>
          }
          subtitle={
            <div className="flex items-center gap-3 mt-1 text-xs">
              <span className="text-[var(--text-secondary)]">Internal Customer Rating:</span>
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    onClick={() => handleUpdateRating(star)}
                    className={`w-4 h-4 cursor-pointer transition-colors ${
                      star <= customerProfileData.rating
                        ? 'fill-[var(--accent-secondary)] text-[var(--accent-secondary)]'
                        : 'text-[var(--border)] hover:text-[var(--accent-secondary)]'
                    }`}
                  />
                ))}
                <span className="font-num font-bold text-[var(--text)] ml-1 text-xs">{customerProfileData.rating}.0 / 5</span>
              </div>
            </div>
          }
          footer={
            <button
              type="button"
              onClick={() => setCustomerProfileData(null)}
              className="erp-btn-secondary"
            >
              Close Profile
            </button>
          }
        >
          <div className="space-y-4">
            {/* Customer Summary Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-center text-xs">
              <div className="bg-[var(--surface-sunken)] p-2.5 rounded-lg border border-[var(--border)]">
                <div className="text-[10px] text-[var(--text-secondary)] uppercase font-semibold">Lifetime Spend</div>
                <div className="text-base font-bold font-num text-[var(--text)] mt-0.5">
                  &#2547;{customerProfileData.stats.totalSpend.toLocaleString()}
                </div>
              </div>

              <div className="bg-[var(--surface-sunken)] p-2.5 rounded-lg border border-[var(--border)]">
                <div className="text-[10px] text-[var(--text-secondary)] uppercase font-semibold">Total Orders</div>
                <div className="text-base font-bold font-num text-[var(--text)] mt-0.5">
                  {customerProfileData.stats.total}
                </div>
              </div>

              <div className="bg-[var(--surface-sunken)] p-2.5 rounded-lg border border-[var(--border)]">
                <div className="text-[10px] text-[var(--text-secondary)] uppercase font-semibold">Delivered</div>
                <div className="text-base font-bold font-num text-[var(--status-green)] mt-0.5">
                  {customerProfileData.stats.completed}
                </div>
              </div>

              <div className="bg-[var(--surface-sunken)] p-2.5 rounded-lg border border-[var(--border)]">
                <div className="text-[10px] text-[var(--text-secondary)] uppercase font-semibold">RTO / Returns</div>
                <div className="text-base font-bold font-num text-[var(--status-red)] mt-0.5">
                  {customerProfileData.stats.refunded}
                </div>
              </div>

              <div className="bg-[var(--surface-sunken)] p-2.5 rounded-lg border border-[var(--border)]">
                <div className="text-[10px] text-[var(--text-secondary)] uppercase font-semibold">Success Rate</div>
                <div className="text-base font-bold font-num text-[var(--status-teal)] mt-0.5">
                  {customerProfileData.stats.successRate !== null ? `${customerProfileData.stats.successRate}%` : 'New'}
                </div>
              </div>

              <div className="bg-[var(--surface-sunken)] p-2.5 rounded-lg border border-[var(--border)]">
                <div className="text-[10px] text-[var(--text-secondary)] uppercase font-semibold">Avg Order Value</div>
                <div className="text-base font-bold font-num text-[var(--text)] mt-0.5">
                  &#2547;{customerProfileData.stats.avgOrderValue.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Risk & Behavior Signals */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div
                className={`p-3 rounded-lg border flex items-center gap-2.5 ${
                  customerProfileData.stats.isRisk ? 'pill-red' : 'pill-green'
                }`}
              >
                {customerProfileData.stats.isRisk ? (
                  <>
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <div>
                      <span className="font-bold">High Delivery Risk Flag:</span> History of returns or cancellations. Require advance delivery payment or phone confirmation before dispatch.
                    </div>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <div>
                      <span className="font-bold">Verified Reliable Customer:</span> High delivery acceptance rate. Safe for immediate courier dispatch without advance deposit.
                    </div>
                  </>
                )}
              </div>

              <div className="p-3 rounded-lg bg-[var(--surface-sunken)] border border-[var(--border)] space-y-1">
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Preferred Channel:</span>
                  <span className="font-semibold text-[var(--text)]">{customerProfileData.stats.preferredChannel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Preferred Fulfillment:</span>
                  <span className="font-semibold text-[var(--text)]">{customerProfileData.stats.preferredFulfillment}</span>
                </div>
              </div>
            </div>

            {/* Saved Delivery Addresses & Customer Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="bg-[var(--surface-sunken)] p-3 rounded-lg border border-[var(--border)] space-y-1">
                <div className="font-semibold text-[var(--text)] flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[var(--accent)]" />
                  <span>Primary Delivery Address</span>
                </div>
                <div className="text-[var(--text-secondary)]">{customerProfileData.address}</div>
              </div>

              <div className="bg-[var(--surface-sunken)] p-3 rounded-lg border border-[var(--border)] space-y-1">
                <div className="font-semibold text-[var(--text)] flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[var(--accent)]" />
                  <span>Customer Relationship Notes</span>
                </div>
                <div className="text-[var(--text-secondary)]">{customerProfileData.notes}</div>
              </div>
            </div>

            {/* Full Itemized Lifetime Purchase History */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <h4 className="font-semibold text-xs text-[var(--text)] uppercase tracking-wider">
                  Lifetime Purchase History ({customerProfileData.orders.length} orders)
                </h4>
              </div>

              <div className="border border-[var(--border)] rounded-lg overflow-hidden text-xs max-h-56 overflow-y-auto">
                <table className="dense-table">
                  <thead>
                    <tr>
                      <th>Order / Date</th>
                      <th>Items & SKUs</th>
                      <th>Channel / Method</th>
                      <th className="text-right">Total</th>
                      <th className="text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerProfileData.orders.map((ord) => (
                      <tr key={ord.id} className="hover:bg-[var(--surface-hover)]">
                        <td>
                          <div className="font-num font-bold text-[var(--accent)]">
                            {ord.invoice_number}
                            {ord.sale_type === 'wholesale' && (
                              <span className="ml-1.5 text-[9px] uppercase font-bold bg-[var(--accent-secondary)]/15 text-[var(--accent-secondary)] px-1 py-0.5 rounded">
                                WS
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-[var(--text-secondary)] font-num">
                            {new Date(ord.created_at).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })}
                          </div>
                        </td>
                        <td>
                          <div className="space-y-0.5">
                            {ord.items.map((it, idx) => (
                              <div key={idx} className="text-[11px]">
                                <span className="font-medium text-[var(--text)]">{it.product_name}</span>{' '}
                                <span className="text-[var(--text-secondary)] font-num">({it.quantity}x @ &#2547;{it.unit_price})</span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td>
                          <div className="capitalize text-[11px]">{ord.channel}</div>
                          <div className="text-[10px] text-[var(--text-secondary)] capitalize">{ord.fulfillment_method.replace('_', ' ')}</div>
                        </td>
                        <td className="text-right font-num font-bold">
                          &#2547;{ord.total.toLocaleString()}
                        </td>
                        <td className="text-center">
                          <StatusBadge status={ord.status} size="sm" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* CENTERED ORDER DETAIL WORKSPACE MODAL (Section 4)                         */}
      {/* ========================================================================= */}
      {selectedOrder && (
        <Modal
          open={!!selectedOrder}
          onClose={() => setSelectedOrder(null)}
          size="lg"
          title={
            <span className="flex items-center gap-2.5 flex-wrap">
              <span>Order Workspace: {selectedOrder.invoice_number}</span>
              <StatusBadge status={selectedOrder.status} size="sm" />
              {selectedOrder.order_timing === 'pre_order' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30">
                  <Boxes className="w-3 h-3" />
                  <span>Pre-Order</span>
                </span>
              )}
              {selectedOrder.order_timing === 'scheduled' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  <Calendar className="w-3 h-3" />
                  <span>Scheduled {selectedOrder.scheduled_date ? `for ${selectedOrder.scheduled_date}` : ''}</span>
                </span>
              )}
            </span>
          }
          subtitle={
            <span>
              Created on {new Date(selectedOrder.created_at).toLocaleString()} by {selectedOrder.created_by_name}
            </span>
          }
          footer={
            <div className="flex items-center gap-2">
              {(selectedOrder.order_timing === 'pre_order' || selectedOrder.order_timing === 'scheduled') && selectedOrder.status !== 'cancelled' && (
                <button
                  type="button"
                  onClick={async (e) => {
                    await handleMoveOrderToToday(e, selectedOrder);
                    setSelectedOrder(prev => prev ? { ...prev, order_timing: 'today' } : null);
                  }}
                  disabled={movingOrderId === selectedOrder.id}
                  className="erp-btn-primary bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {movingOrderId === selectedOrder.id ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  <span>Move to Today&apos;s Orders</span>
                </button>
              )}
              {selectedOrder.status !== 'cancelled' && (
                <button
                  type="button"
                  onClick={() => setCancellationTarget(selectedOrder)}
                  className="erp-btn-secondary text-[var(--status-red)] border-[var(--status-red)]"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Cancel Order</span>
                </button>
              )}
              {selectedOrder.status === 'confirmed' && can('create_edit_orders') && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingOrder(selectedOrder);
                    setShowEditModal(true);
                  }}
                  className="erp-btn-secondary"
                >
                  <Pencil className="w-3.5 h-3.5 text-[var(--status-amber)]" />
                  <span>Edit Order</span>
                </button>
              )}
              {selectedOrder.order_type !== 'merchant_fulfillment' && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveInvoiceOrder(selectedOrder);
                    setShowInvoiceModal(true);
                  }}
                  className="erp-btn-primary"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>View & Print Invoice</span>
                </button>
              )}
              {selectedOrder.order_type === 'merchant_fulfillment' && (
                <button
                  type="button"
                  onClick={() => {
                    setMerchantStickerOrder(selectedOrder);
                    setShowMerchantStickerModal(true);
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[color-mix(in_srgb,var(--status-purple)_12%,transparent)] hover:bg-[color-mix(in_srgb,var(--status-purple)_20%,transparent)] text-[var(--status-purple)] border border-[color-mix(in_srgb,var(--status-purple)_30%,transparent)] flex items-center gap-1.5 cursor-pointer"
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Merchant Sticker</span>
                </button>
              )}
            </div>
          }
        >
          <div className="space-y-4">
            {selectedOrder.status === 'cancelled' && (
              <div className="rounded-lg border border-[var(--status-red)]/30 bg-[var(--status-red)]/5 p-3 text-xs space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 font-bold text-[var(--status-red)]">
                    <XCircle className="w-4 h-4" />
                    <span>Cancelled Order Record</span>
                  </div>
                  <StatusBadge status="cancelled" size="sm" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div><span className="block text-[10px] text-[var(--text-secondary)] uppercase">Cancelled From</span><strong>{selectedOrder.cancelled_from_status || '\u2014'}</strong></div>
                  <div><span className="block text-[10px] text-[var(--text-secondary)] uppercase">Cancelled At</span><strong>{selectedOrder.cancelled_at ? new Date(selectedOrder.cancelled_at).toLocaleString() : '\u2014'}</strong></div>
                  <div><span className="block text-[10px] text-[var(--text-secondary)] uppercase">Cancelled By</span><strong>{selectedOrder.cancelled_by_name || '\u2014'}</strong></div>
                  <div><span className="block text-[10px] text-[var(--text-secondary)] uppercase">Refunded</span><strong className="font-num">&#2547;{(selectedOrder.refunded_amount || 0).toLocaleString()}</strong></div>
                </div>
                <div><span className="font-semibold">Reason:</span> {selectedOrder.cancel_reason || '\u2014'}</div>
                {selectedOrder.physical_recovery_required && (
                  <div className="flex items-center gap-1.5 text-[var(--status-amber)] font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5" /> Physical stock recovery requires a separate scan-back.
                  </div>
                )}
              </div>
            )}
            {/* Dropship Fulfillment Badge & Details if applicable */}
            {selectedOrder.order_type === 'merchant_fulfillment' && (
              <div className="p-3 bg-[color-mix(in_srgb,var(--status-purple)_8%,transparent)] border border-[color-mix(in_srgb,var(--status-purple)_25%,transparent)] rounded-lg text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-[color-mix(in_srgb,var(--status-purple)_16%,transparent)] text-[var(--status-purple)] border border-[color-mix(in_srgb,var(--status-purple)_35%,transparent)]">
                      <Building2 className="w-3 h-3" />
                              <span>Dropship Fulfillment</span>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMerchantStickerOrder(selectedOrder);
                      setShowMerchantStickerModal(true);
                    }}
                    className="text-[11px] font-bold text-[var(--status-purple)] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Tag className="w-3 h-3" />
                    <span>Print Thermal Sticker</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
                  <div>
                    <span className="text-[var(--text-muted)] block text-[10px]">Merchant / Company</span>
                    <span className="font-semibold text-[var(--text)]">{selectedOrder.merchant_name || '\u2014'}</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)] block text-[10px]">Merchant ID</span>
                    <span className="font-mono font-semibold text-[var(--text)]">{selectedOrder.merchant_id || '\u2014'}</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)] block text-[10px]">Parcel ID</span>
                    <span className="font-mono font-bold text-[var(--status-purple)]">{selectedOrder.parcel_id || '\u2014'}</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)] block text-[10px]">End Customer Name</span>
                    <span className="font-semibold text-[var(--text)]">{selectedOrder.end_customer_name || selectedOrder.customer_name}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Customer & Address Details */}
            <div className="grid grid-cols-2 gap-3 bg-[var(--surface-sunken)] p-3 rounded-lg border border-[var(--border)] text-xs">
              <div>
                <div className="font-semibold text-[var(--text-secondary)] text-[10px] uppercase">
                  {selectedOrder.order_type === 'merchant_fulfillment' ? 'Recipient / End Customer' : 'Customer'}
                </div>
                <div className="font-semibold text-sm text-[var(--text)] mt-0.5">{selectedOrder.customer_name}</div>
                <div className="font-num text-[var(--accent)] font-semibold mt-0.5">{selectedOrder.customer_phone}</div>
              </div>
              <div>
                <div className="font-semibold text-[var(--text-secondary)] text-[10px] uppercase">Fulfillment & Delivery</div>
                <div className="capitalize font-semibold text-[var(--text)] mt-0.5">{selectedOrder.fulfillment_method.replace('_', ' ')}</div>
                <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">{selectedOrder.delivery_address_text || 'Showroom In-Store Handoff'}</div>
              </div>
            </div>

            {/* Items Table */}
            <div>
              <div className="text-xs font-semibold text-[var(--text)] mb-1.5 uppercase">Items Ordered</div>
              <div className="border border-[var(--border)] rounded-lg overflow-hidden text-xs">
                <table className="dense-table">
                  <thead>
                    <tr>
                      <th>Perfume Item</th>
                      <th className="text-center">Qty</th>
                      <th className="text-right">Unit Price</th>
                      <th className="text-right">Item Discount</th>
                      <th className="text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.items.map((it, idx) => (
                      <tr key={idx}>
                        <td className="font-medium text-[var(--text)]">{it.product_name}</td>
                        <td className="text-center font-num font-bold text-[var(--text)]">{it.quantity}</td>
                        <td className="text-right font-num text-[var(--text)]">&#2547;{it.unit_price}</td>
                        <td className="text-right font-num">
                          {it.discount_amount > 0
                            ? <span className="status-red">-&#2547;{it.discount_amount.toLocaleString()}</span>
                            : <span className="text-[var(--text-secondary)]">&#8212;</span>}
                        </td>
                        <td className="text-right font-num font-bold text-[var(--text)]">&#2547;{it.total_price}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Summary - gross, discounts, final due, payment status, payment breakdown */}
            <div className="bg-[var(--surface-sunken)] p-3 rounded-lg border border-[var(--border)] space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Gross Subtotal:</span>
                <span className="font-num text-[var(--text)]">&#2547;{(selectedOrder.subtotal || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Delivery Charge:</span>
                <span className="font-num text-[var(--text)]">&#2547;{(selectedOrder.delivery_charge || 0).toLocaleString()}</span>
              </div>
              {((selectedOrder.items || []).reduce((s, it) => s + (it.discount_amount || 0), 0)) > 0 && (
                <div className="flex justify-between status-red">
                  <span>Item Discounts:</span>
                  <span className="font-num">-&#2547;{(selectedOrder.items || []).reduce((s, it) => s + (it.discount_amount || 0), 0).toLocaleString()}</span>
                </div>
              )}
              {(selectedOrder.discount_amount || 0) > 0 && (
                <div className="flex justify-between status-red">
                  <span>Overall Discount:</span>
                  <span className="font-num">-&#2547;{selectedOrder.discount_amount.toLocaleString()}</span>
                </div>
              )}
              <div className="border-t border-[var(--border)] pt-1.5 flex justify-between font-bold text-sm text-[var(--accent)]">
                <span>Total Amount:</span>
                <span className="font-num">&#2547;{(selectedOrder.total || 0).toLocaleString()}</span>
              </div>
            </div>

            {/* Payment status + breakdown */}
            {(() => {
              const ps = orderPaymentState(selectedOrder);
              const payments = selectedOrder.payments || [];
              return (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[var(--text)]">Payment:</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        ps.state === 'paid'
                          ? 'bg-[var(--status-green)]/15 text-[var(--status-green)]'
                          : ps.state === 'unpaid'
                          ? 'bg-[var(--status-red)]/15 text-[var(--status-red)]'
                          : ps.state === 'partial' || ps.state === 'partial_refund'
                          ? 'bg-[var(--status-amber)]/15 text-[var(--status-amber)]'
                          : 'bg-[var(--status-gray)]/15 text-[var(--status-gray)]'
                      }`}
                    >
                      {ps.label}
                    </span>
                  </div>
                  {ps.state === 'partial' && (
                    <p className="text-[11px] text-[var(--text-secondary)]">
                      Paid <span className="font-num font-semibold text-[var(--status-green)]">&#2547;{ps.received.toLocaleString()}</span> / Due{' '}
                      <span className="font-num font-semibold status-red">&#2547;{((selectedOrder.total || 0) - ps.received).toLocaleString()}</span>
                    </p>
                  )}
                  {payments.length > 0 && (
                    <div className="border border-[var(--border)] rounded-lg overflow-hidden text-xs">
                      <table className="dense-table">
                        <thead>
                          <tr>
                            <th>Method</th>
                            <th>Account</th>
                            <th className="text-right">Amount</th>
                            <th>Ref / Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {payments.map((p, i) => (
                            <tr key={i}>
                              <td className="font-medium text-[var(--text)]">
                                {paymentMethodLabel(p.method)}
                                {p.status === 'refunded' && (
                                  <span className="ml-1 text-[9px] text-[var(--status-red)] font-bold">(Refunded)</span>
                                )}
                              </td>
                              <td className="text-[var(--text-secondary)]">{paymentAccountLabel(p.payment_account_id)}</td>
                              <td className="text-right font-num font-semibold text-[var(--text)]">&#2547;{p.amount.toLocaleString()}</td>
                              <td className="text-[var(--text-secondary)]">
                                {p.transaction_ref ? `${p.transaction_ref} \u00B7 ` : ''}
                                {new Date(p.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric' })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <div className="flex justify-between text-[11px] pt-0.5">
                    <span className="text-[var(--text-secondary)]">Received:</span>
                    <span className="font-num font-semibold text-[var(--status-green)]">&#2547;{ps.received.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[var(--text-secondary)]">Remaining Due:</span>
                    <span className="font-num font-semibold status-red">&#2547;{Math.max(0, (selectedOrder.total || 0) - ps.received).toLocaleString()}</span>
                  </div>
                </div>
              );
            })()}
          </div>
        </Modal>
      )}

      {cancellationTarget && (
        <Modal
          open={true}
          onClose={() => { if (!isCancelling) setCancellationTarget(null); }}
          title="Cancel Order"
          subtitle={`${cancellationTarget.invoice_number} \u00B7 ${cancellationTarget.customer_name}`}
          size="sm"
          footer={
            <div className="flex justify-end gap-2">
              <button type="button" className="erp-btn-secondary" onClick={() => setCancellationTarget(null)} disabled={isCancelling}>Keep Order</button>
              <button
                type="button"
                className="erp-btn-primary !bg-[var(--status-red)]"
                onClick={handleConfirmCancellation}
                disabled={isCancelling || !cancellationReason || (cancellationReason === 'Other (please specify)' && !cancellationOtherReason.trim())}
              >
                <XCircle className="w-3.5 h-3.5" /> {isCancelling ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="rounded-lg border border-[var(--status-amber)]/30 bg-[var(--status-amber)]/5 p-3 text-xs text-[var(--text)]">
              This changes the order status permanently. Confirmed orders release their reservation. Orders that have already left the shelf require a separate physical scan-back if the stock returns.
            </div>
            <label className="block text-xs font-semibold text-[var(--text)]">
              Cancellation reason
              <select value={cancellationReason} onChange={e => setCancellationReason(e.target.value)} className="erp-select w-full mt-1.5">
                <option value="">Select a reason</option>
                {cancellationReasons.map(reason => <option key={reason} value={reason}>{reason}</option>)}
              </select>
            </label>
            {cancellationReason === 'Other (please specify)' && (
              <label className="block text-xs font-semibold text-[var(--text)]">
                Details required
                <textarea value={cancellationOtherReason} onChange={e => setCancellationOtherReason(e.target.value)} className="erp-input w-full mt-1.5 min-h-20" placeholder="Explain why this order is being cancelled" />
              </label>
            )}
          </div>
        </Modal>
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
          onOrderUpdated={(updated) => {
            setSelectedOrder(updated);
          }}
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

      {/* Sticker Block Modal - shown when sticker print attempted before Steadfast booking */}
      {stickerBlockMsg && (
        <Modal
          isOpen={true}
          onClose={() => setStickerBlockMsg(null)}
          title="Sticker Cannot Be Printed Yet"
          size="sm"
        >
          <div className="space-y-4 p-2">
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-10 h-10 rounded-full bg-[var(--status-amber)]/15 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-[var(--status-amber)]" />
              </div>
              <div className="space-y-1.5">
                <p className="text-sm font-semibold text-[var(--text)]">
                  Book this order with Steadfast first
                </p>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  No tracking ID is available yet to print on the courier sticker. A sticker can only be printed <strong>after</strong> the order has been successfully booked with Steadfast and a real Parcel/Consignment ID has been assigned.
                </p>
                <p className="text-[11px] font-mono bg-[var(--surface-sunken)] border border-[var(--border)] rounded px-2 py-1 text-[var(--text-secondary)] mt-2">
                  {stickerBlockMsg.split('\n').filter(l => l.startsWith('Order:')).join('')}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                className="erp-btn-secondary text-xs"
                onClick={() => setStickerBlockMsg(null)}
              >
                Understood
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* 100x100mm Dropship Fulfillment Thermal Sticker Modal */}
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
