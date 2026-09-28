import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Save,
  Search,
  ShoppingCart,
  MapPin,
  Phone,
  User,
  AlertTriangle,
  CheckCircle2,
  Boxes,
  Building2,
  Tag,
  Package,
  Store,
  Calendar,
  Clock,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Order, OrderType, OrderTiming } from '../../types';

interface EditOrderModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onOrderUpdated?: (updated: Order) => void;
}

interface EditableItem {
  product_id: string;
  product_name: string;
  sku: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  available_stock: number;
}

export const EditOrderModal: React.FC<EditOrderModalProps> = ({
  order,
  isOpen,
  onClose,
  onOrderUpdated,
}) => {
  const { products, editOrder } = useApp();

  const [orderType, setOrderType] = useState<OrderType>('direct_sale');
  const [merchantName, setMerchantName] = useState<string>('');
  const [merchantId, setMerchantId] = useState<string>('');
  const [parcelId, setParcelId] = useState<string>('');
  const [endCustomerName, setEndCustomerName] = useState<string>('');

  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [deliveryAddress, setDeliveryAddress] = useState<string>('');
  const [fulfillmentMethod, setFulfillmentMethod] = useState<'steadfast' | 'instant_delivery' | 'in_house' | 'self_pickup' | 'n_a_walk_in'>('steadfast');
  const [instantDeliveryProvider, setInstantDeliveryProvider] = useState<'pathao' | 'uber' | 'other'>('pathao');
  const [deliveryCharge, setDeliveryCharge] = useState<number>(70);
  const [orderDiscount, setOrderDiscount] = useState<number>(0);
  const [orderTiming, setOrderTiming] = useState<OrderTiming>('today');
  const [scheduledDate, setScheduledDate] = useState<string>('');
  const [items, setItems] = useState<EditableItem[]>([]);
  const [searchProductQuery, setSearchProductQuery] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  useEffect(() => {
    if (order) {
      setOrderType(order.order_type || 'direct_sale');
      setOrderTiming(order.order_timing || 'today');
      setScheduledDate(order.scheduled_date || '');
      setMerchantName(order.merchant_name || '');
      setMerchantId(order.merchant_id || '');
      setParcelId(order.parcel_id || '');
      setEndCustomerName(order.end_customer_name || '');
      setCustomerName(order.customer_name || '');
      setCustomerPhone(order.customer_phone || '');
      setDeliveryAddress(order.delivery_address_text || '');
      setFulfillmentMethod(order.fulfillment_method || 'steadfast');
      setInstantDeliveryProvider(order.instant_delivery_provider || 'pathao');
      setDeliveryCharge(order.delivery_charge !== undefined ? order.delivery_charge : 70);
      setOrderDiscount(order.discount_amount || 0);

      const mappedItems: EditableItem[] = (order.items || []).map((it) => {
        const prod = products.find((p) => p.id === it.product_id);
        const avail = prod?.stock_available ?? 0;
        return {
          product_id: it.product_id,
          product_name: it.product_name,
          sku: it.sku,
          quantity: it.quantity,
          unit_price: it.unit_price,
          discount_amount: it.discount_amount || 0,
          available_stock: avail,
        };
      });
      setItems(mappedItems);
      setErrorMessage('');
      setSuccessMessage('');
    }
  }, [order, products, isOpen]);

  if (!isOpen || !order) return null;

  // Search filtered products for adding
  const searchResults = searchProductQuery.trim()
    ? products
        .filter(
          (p) =>
            p.display_name.toLowerCase().includes(searchProductQuery.toLowerCase()) ||
            p.sku.toLowerCase().includes(searchProductQuery.toLowerCase()) ||
            p.barcode.includes(searchProductQuery)
        )
        .slice(0, 5)
    : [];

  const handleAddItem = (prod: any) => {
    const existingIndex = items.findIndex((i) => i.product_id === prod.id);
    if (existingIndex >= 0) {
      const updated = [...items];
      updated[existingIndex].quantity += 1;
      setItems(updated);
    } else {
      setItems([
        ...items,
        {
          product_id: prod.id,
          product_name: prod.display_name,
          sku: prod.sku,
          quantity: 1,
          unit_price: prod.selling_price,
          discount_amount: 0,
          available_stock: prod.stock_available ?? 0,
        },
      ]);
    }
    setSearchProductQuery('');
  };

  const handleQuantityChange = (index: number, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItem(index);
      return;
    }
    const updated = [...items];
    updated[index].quantity = newQty;
    setItems(updated);
  };

  const handleUnitPriceChange = (index: number, newPrice: number) => {
    const updated = [...items];
    updated[index].unit_price = Math.max(0, newPrice);
    setItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Calculations
  const calculatedSubtotal = items.reduce((sum, it) => sum + it.unit_price * it.quantity, 0);
  const calculatedTotal = Math.max(0, calculatedSubtotal - orderDiscount + deliveryCharge);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      setErrorMessage('Order must have at least one line item.');
      return;
    }

    if (!customerName.trim() || !customerPhone.trim()) {
      setErrorMessage('Customer name and phone number are required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const payload = {
        customer_name: customerName,
        customer_phone: customerPhone,
        delivery_address: deliveryAddress,
        order_type: orderType,
        merchant_name: orderType === 'merchant_fulfillment' ? (merchantName.trim() || undefined) : undefined,
        merchant_id: orderType === 'merchant_fulfillment' ? (merchantId.trim() || undefined) : undefined,
        parcel_id: orderType === 'merchant_fulfillment' ? (parcelId.trim() || undefined) : undefined,
        end_customer_name: orderType === 'merchant_fulfillment' ? (endCustomerName.trim() || undefined) : undefined,
        fulfillment_method: fulfillmentMethod,
        instant_delivery_provider: fulfillmentMethod === 'instant_delivery' ? instantDeliveryProvider : undefined,
        rider_delivery_charge: fulfillmentMethod === 'instant_delivery' ? Number(deliveryCharge) : undefined,
        delivery_charge: fulfillmentMethod === 'instant_delivery' ? 0 : Number(deliveryCharge),
        discount_amount: Number(orderDiscount),
        order_timing: orderTiming,
        scheduled_date: orderTiming === 'scheduled' ? (scheduledDate || undefined) : undefined,
        items: items.map((it) => ({
          product_id: it.product_id,
          quantity: it.quantity,
          unit_price: it.unit_price,
          discount_amount: it.discount_amount || 0,
        })),
      };

      const updated = await editOrder(order.id, payload);
      setSuccessMessage('Order successfully updated! Stock reservations adjusted.');
      if (onOrderUpdated) {
        onOrderUpdated(updated);
      }
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update order');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(var(--accent-rgb),0.10)] p-4">
      <div className="bg-[var(--surface)] rounded-2xl shadow-2xl max-w-3xl w-full border border-[var(--border)] max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[var(--border)] bg-[var(--surface-sunken)] flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-[var(--text)]">
                Edit Order: {order.invoice_number}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold pill-amber border uppercase">
                Confirmed Order
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Modify customer details, quantities, or line items with atomic stock adjustment
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[var(--text-muted)] hover:text-[var(--text)] rounded-lg hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-xs">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-[color-mix(in_srgb,var(--status-red)_10%,transparent)] border border-[color-mix(in_srgb,var(--status-red)_30%,transparent)] text-[var(--status-red)] font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-xl bg-[color-mix(in_srgb,var(--status-green)_10%,transparent)] border border-[color-mix(in_srgb,var(--status-green)_30%,transparent)] text-[var(--status-green)] font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Order Model Distinction */}
          <div className="bg-[var(--surface-sunken)] p-4 rounded-xl border border-[var(--border)] space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[11px] uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5 text-[var(--accent)]" />
                Order Model Distinction
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  orderType === 'merchant_fulfillment'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                    : 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400'
                }`}
              >
                {orderType === 'merchant_fulfillment' ? 'Dropship Fulfillment' : 'Direct Sale'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setOrderType('direct_sale')}
                className={`py-2 px-3 text-xs font-bold rounded-lg border flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  orderType === 'direct_sale'
                    ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-xs'
                    : 'bg-[var(--surface)] text-[var(--text)] border-[var(--border)] hover:bg-[var(--surface-hover)]'
                }`}
              >
                <Store className="w-3.5 h-3.5" />
                <span>Direct Sale</span>
              </button>

              <button
                type="button"
                onClick={() => setOrderType('merchant_fulfillment')}
                className={`py-2 px-3 text-xs font-bold rounded-lg border flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  orderType === 'merchant_fulfillment'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-[var(--surface)] text-[var(--text)] border-[var(--border)] hover:bg-[var(--surface-hover)]'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Dropship Fulfillment</span>
              </button>
            </div>

            {orderType === 'merchant_fulfillment' && (
              <div className="pt-2 border-t border-[var(--border)] space-y-2.5 animate-in fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[var(--text)] mb-1">
                      Merchant / Company Name <span className="text-[10px] font-normal text-[var(--text-muted)]">(Optional)</span>
                    </label>
                    <div className="relative">
                      <Building2 className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={merchantName}
                        onChange={(e) => setMerchantName(e.target.value)}
                        placeholder="e.g. Aroma Luxe Resellers"
                        className="w-full pl-8 pr-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-xs font-medium text-[var(--text)] focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[var(--text)] mb-1">
                      Merchant ID <span className="text-[10px] font-normal text-[var(--text-muted)]">(Optional)</span>
                    </label>
                    <div className="relative">
                      <Tag className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={merchantId}
                        onChange={(e) => setMerchantId(e.target.value)}
                        placeholder="e.g. MER-4409"
                        className="w-full pl-8 pr-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-xs font-mono font-medium text-[var(--text)] focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[var(--text)] mb-1">
                      Parcel ID <span className="text-[10px] font-normal text-[var(--text-muted)]">(Optional)</span>
                    </label>
                    <div className="relative">
                      <Package className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={parcelId}
                        onChange={(e) => setParcelId(e.target.value)}
                        placeholder="e.g. ALR-78219"
                        className="w-full pl-8 pr-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-xs font-mono font-medium text-[var(--text)] focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[var(--text)] mb-1">
                      End Customer Name <span className="text-[10px] font-normal text-[var(--text-muted)]">(Optional)</span>
                    </label>
                    <div className="relative">
                      <User className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={endCustomerName}
                        onChange={(e) => setEndCustomerName(e.target.value)}
                        placeholder="e.g. Tanzeem Rahman"
                        className="w-full pl-8 pr-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-xs font-medium text-[var(--text)] focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Order Timing: Today / Scheduled / Pre-Order */}
          <div className="bg-[var(--surface-sunken)] p-4 rounded-xl border border-[var(--border)] space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[11px] uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[var(--accent)]" />
                Order Timing / Operational Queue
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  orderTiming === 'today'
                    ? 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400'
                    : orderTiming === 'scheduled'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
                    : 'bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400'
                }`}
              >
                {orderTiming === 'today' ? 'Today' : orderTiming === 'scheduled' ? `Scheduled: ${scheduledDate || 'Set Date'}` : 'Pre-Order'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setOrderTiming('today')}
                className={`py-2 px-2 text-xs font-bold rounded-lg border flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  orderTiming === 'today'
                    ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-xs'
                    : 'bg-[var(--surface)] text-[var(--text)] border-[var(--border)] hover:bg-[var(--surface-hover)]'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Today</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setOrderTiming('scheduled');
                  if (!scheduledDate) {
                    const tom = new Date();
                    tom.setDate(tom.getDate() + 1);
                    setScheduledDate(tom.toISOString().slice(0, 10));
                  }
                }}
                className={`py-2 px-2 text-xs font-bold rounded-lg border flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  orderTiming === 'scheduled'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                    : 'bg-[var(--surface)] text-[var(--text)] border-[var(--border)] hover:bg-[var(--surface-hover)]'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Scheduled</span>
              </button>

              <button
                type="button"
                onClick={() => setOrderTiming('pre_order')}
                className={`py-2 px-2 text-xs font-bold rounded-lg border flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  orderTiming === 'pre_order'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                    : 'bg-[var(--surface)] text-[var(--text)] border-[var(--border)] hover:bg-[var(--surface-hover)]'
                }`}
              >
                <Boxes className="w-3.5 h-3.5" />
                <span>Pre-Order</span>
              </button>
            </div>

            {orderTiming === 'scheduled' && (
              <div className="pt-2 border-t border-[var(--border)] space-y-1.5 animate-in fade-in">
                <label className="block text-[11px] font-bold text-[var(--text)]">
                  Scheduled Fulfillment Date *
                </label>
                <div className="relative max-w-xs">
                  <Calendar className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-2.5" />
                  <input
                    type="date"
                    required
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    min={new Date().toISOString().slice(0, 10)}
                    className="w-full pl-8 pr-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-xs font-medium text-[var(--text)] focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <p className="text-[10px] text-[var(--text-muted)]">
                  Order will automatically surface in Today&apos;s Orders queue on this scheduled date.
                </p>
              </div>
            )}

            {orderTiming === 'pre_order' && (
              <div className="pt-2 border-t border-[var(--border)] space-y-1 animate-in fade-in">
                <p className="text-[11px] font-medium text-purple-700 dark:text-purple-300">
                  Pre-Orders await stock arrival or import. Physical stock is not immediately held until moved/approved into Today&apos;s Orders.
                </p>
              </div>
            )}
          </div>

          {/* Customer & Delivery Information */}
          <div className="bg-[var(--surface-sunken)] p-4 rounded-xl border border-[var(--border)] space-y-3">
            <h3 className="font-bold text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
              Customer & Delivery Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-[var(--text)] mb-1">
                  Customer Name *
                </label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-xs font-medium text-[var(--text)] focus:ring-1 focus:ring-[var(--accent)]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[var(--text)] mb-1">
                  Customer Phone *
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-xs font-mono font-medium text-[var(--text)] focus:ring-1 focus:ring-[var(--accent)]"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-[var(--text)] mb-1">
                  Fulfillment Method
                </label>
                <select
                  value={fulfillmentMethod}
                  onChange={(e) => setFulfillmentMethod(e.target.value as any)}
                  className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-xs font-medium text-[var(--text)] focus:ring-1 focus:ring-[var(--accent)]"
                >
                  <option value="steadfast">Steadfast Courier COD</option>
                  <option value="instant_delivery">Instant Delivery</option>
                  <option value="in_house">In-House / Staff Hand Delivery</option>
                  <option value="self_pickup">Self-Pickup at Showroom</option>
                </select>
                {fulfillmentMethod === 'instant_delivery' && (
                  <select
                    value={instantDeliveryProvider}
                    onChange={(e) => setInstantDeliveryProvider(e.target.value as 'pathao' | 'uber' | 'other')}
                    className="w-full mt-2 px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-xs font-medium text-[var(--text)] focus:ring-1 focus:ring-[var(--accent)]"
                  >
                    <option value="pathao">Pathao</option>
                    <option value="uber">Uber</option>
                    <option value="other">Other</option>
                  </select>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[var(--text)] mb-1">
                  Delivery Charge (&#2547;)
                </label>
                <input
                  type="number"
                  min="0"
                  value={deliveryCharge}
                  onChange={(e) => setDeliveryCharge(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-xs font-mono font-bold text-[var(--text)] focus:ring-1 focus:ring-[var(--accent)]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[var(--text)] mb-1">
                Full Delivery Address
              </label>
              <div className="relative">
                <MapPin className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-2.5" />
                <textarea
                  rows={2}
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="Street, area, landmarks, Dhaka/District..."
                  className="w-full pl-8 pr-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-xs font-medium text-[var(--text)] focus:ring-1 focus:ring-[var(--accent)]"
                />
              </div>
            </div>
          </div>

          {/* Line Items Management */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="font-bold text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
                Ordered Line Items
              </h3>

              {/* Product Search & Add */}
              <div className="relative flex-1 max-w-sm">
                <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchProductQuery}
                  onChange={(e) => setSearchProductQuery(e.target.value)}
                  placeholder="Search perfume to add item..."
                  className="w-full pl-8 pr-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-xs font-medium text-[var(--text)] focus:ring-1 focus:ring-[var(--accent)]"
                />

                {/* Autocomplete Dropdown */}
                {searchResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xl z-20 max-h-48 overflow-y-auto divide-y divide-[var(--border)]">
                    {searchResults.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => handleAddItem(p)}
                        className="p-2.5 hover:bg-[var(--surface-hover)] cursor-pointer flex items-center justify-between"
                      >
                        <div>
                          <div className="font-bold text-[var(--text)]">{p.display_name}</div>
                          <div className="text-[10px] text-[var(--text-muted)] font-mono">
                            SKU: {p.sku} &#8226; Stock Available: {p.stock_available ?? 0}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-bold font-mono text-[var(--accent)]">
                            &#2547;{p.selling_price.toLocaleString()}
                          </span>
                          <span className="block text-[10px] text-[var(--status-green)] font-semibold">+ Add</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Line Items Table */}
            <div className="border border-[var(--border)] rounded-xl overflow-hidden bg-[var(--surface)]">
              <table className="w-full text-left">
                <thead className="bg-[var(--surface-sunken)] border-b border-[var(--border)] text-[10px] text-[var(--text-secondary)] uppercase font-bold">
                  <tr>
                    <th className="p-2.5">Item</th>
                    <th className="p-2.5 text-center w-24">Qty</th>
                    <th className="p-2.5 text-right w-24">Price</th>
                    <th className="p-2.5 text-right w-24">Total</th>
                    <th className="p-2 text-center w-10">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {items.map((it, idx) => (
                    <tr key={idx} className="hover:bg-[var(--surface-hover)]">
                      <td className="p-3">
                        <div className="font-bold text-[var(--text)]">{it.product_name}</div>
                        <div className="text-[10px] text-[var(--text-muted)] font-mono">SKU: {it.sku}</div>
                      </td>

                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleQuantityChange(idx, it.quantity - 1)}
                            className="w-6 h-6 rounded bg-[var(--surface-sunken)] hover:bg-[var(--border)] border border-[var(--border)] flex items-center justify-center font-bold text-xs cursor-pointer"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={it.quantity}
                            onChange={(e) => handleQuantityChange(idx, Math.max(1, Number(e.target.value)))}
                            className="w-12 text-center py-1 bg-[var(--surface)] border border-[var(--border)] rounded font-mono font-bold text-xs text-[var(--text)]"
                          />
                          <button
                            type="button"
                            onClick={() => handleQuantityChange(idx, it.quantity + 1)}
                            className="w-6 h-6 rounded bg-[var(--surface-sunken)] hover:bg-[var(--border)] border border-[var(--border)] flex items-center justify-center font-bold text-xs cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </td>

                      <td className="p-3 text-right">
                        <input
                          type="number"
                          min="0"
                          value={it.unit_price}
                          onChange={(e) => handleUnitPriceChange(idx, Number(e.target.value))}
                          className="w-20 text-right py-1 px-2 bg-[var(--surface)] border border-[var(--border)] rounded font-mono font-bold text-xs text-[var(--text)]"
                        />
                      </td>

                      <td className="p-3 text-right font-mono font-bold text-[var(--text)]">
                        &#2547;{(it.unit_price * it.quantity).toLocaleString()}
                      </td>

                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1.5 text-[var(--status-red)] hover:bg-[color-mix(in_srgb,var(--status-red)_10%,transparent)] rounded-lg cursor-pointer transition-colors"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals & Summary */}
          <div className="bg-[var(--surface-sunken)] p-4 rounded-xl border border-[var(--border)] space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-[var(--text-muted)]">Subtotal ({items.length} items):</span>
              <span className="font-mono font-bold text-[var(--text)]">&#2547;{calculatedSubtotal.toLocaleString()}</span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-[var(--text-muted)]">Delivery Charge:</span>
              <span className="font-mono font-bold text-[var(--text)]">&#2547;{deliveryCharge.toLocaleString()}</span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-[var(--text-muted)]">Order Discount (&#2547;):</span>
              <input
                type="number"
                min="0"
                value={orderDiscount}
                onChange={(e) => setOrderDiscount(Number(e.target.value))}
                className="w-24 text-right py-1 px-2 bg-[var(--surface)] border border-[var(--border)] rounded font-mono font-bold text-xs text-[var(--status-red)]"
              />
            </div>

            <div className="border-t border-[var(--border)] pt-2 flex justify-between items-center text-sm font-bold text-[var(--accent)]">
              <span>Final Updated Total:</span>
              <span className="font-mono text-base">&#2547;{calculatedTotal.toLocaleString()}</span>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-[var(--border)] rounded-xl text-xs font-bold text-[var(--text)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-[var(--accent)] text-white rounded-xl text-xs font-bold hover:opacity-90 shadow-sm transition-opacity cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSubmitting ? 'Updating Order...' : 'Save & Recalculate'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
