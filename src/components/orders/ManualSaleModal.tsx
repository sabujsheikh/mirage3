import React, { useState, useMemo } from 'react';
import {
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  CreditCard,
  User,
  Package,
  X,
  ChevronDown,
  ChevronUp,
  Truck,
  Store,
  Clock,
  FileText,
  DollarSign,
  AlertCircle,
  HelpCircle,
  Building2,
  SplitSquareVertical,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Product, OrderStatus, FulfillmentMethod } from '../../types';
import { CustomerLookupInput } from '../common/CustomerLookupInput';
import { Modal } from '../common/Modal';

interface ManualSaleItem {
  product_id: string;
  quantity: number;
  unit_price: number;
  retail_price: number;
  wholesale_price: number;
  discount_amount: number;
  is_custom_price: boolean;
}

interface ManualPaymentItem {
  method: 'cash' | 'bkash' | 'nagad' | 'bank' | 'card';
  account_id: string;
  account_name: string;
  amount: number;
  transaction_ref?: string;
  notes?: string;
  payment_date?: string;
}

export interface ManualSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (createdOrder: any) => void;
}

export const ManualSaleModal: React.FC<ManualSaleModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { products, accounts, users, settings, createOrder } = useApp();
  const { currentUser } = useAuth();

  const todayStr = useMemo(() => {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Dhaka',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }, []);

  // Form State
  const [saleType, setSaleType] = useState<'retail' | 'wholesale'>('retail');
  const [transactionDate, setTransactionDate] = useState<string>(todayStr);
  const [orderStatus, setOrderStatus] = useState<OrderStatus>('delivered');
  const [fulfillmentMethod, setFulfillmentMethod] = useState<FulfillmentMethod>('in_house');
  const [deliveredByUserId, setDeliveredByUserId] = useState<string>('');
  const [deliveryDate, setDeliveryDate] = useState<string>(todayStr);

  // Customer State
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [deliveryAddress, setDeliveryAddress] = useState<string>('');

  // Items State
  const [items, setItems] = useState<ManualSaleItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');

  // Pricing & Financials
  const [deliveryCharge, setDeliveryCharge] = useState<number>(0);
  const [orderDiscount, setOrderDiscount] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');

  // Payment State
  const [payments, setPayments] = useState<ManualPaymentItem[]>([]);
  const [isFullPaymentAuto, setIsFullPaymentAuto] = useState<boolean>(true);

  // UI sections & modals
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [showConfirmation, setShowConfirmation] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Configured Payment Accounts (reusing ERP accounts)
  const availablePaymentAccounts = useMemo(() => {
    // Filter asset/liquid accounts configured in ERP
    const assetAccs = accounts.filter(a => a.type === 'asset');
    if (assetAccs.length > 0) return assetAccs;
    // Fallback defaults
    return [
      { id: 'acc_cash', name: 'Cash in Hand (Till)', code: '1010', type: 'asset' },
      { id: 'acc_bkash', name: 'bKash Merchant / Personal', code: '1020', type: 'asset' },
      { id: 'acc_nagad', name: 'Nagad Account', code: '1030', type: 'asset' },
      { id: 'acc_bank', name: 'City Bank Ltd (Current)', code: '1040', type: 'asset' },
    ];
  }, [accounts]);

  // Wholesale helper
  const getProductWholesalePrice = (p: Product): number => {
    if (p.wholesale_price && p.wholesale_price > 0) return p.wholesale_price;
    return Math.round(p.selling_price * 0.85);
  };

  // Add Item to sale
  const handleAddItem = (productId: string) => {
    if (!productId) return;
    const prod = products.find(p => p.id === productId);
    if (!prod) return;

    // Check if already in list
    const existingIndex = items.findIndex(it => it.product_id === productId);
    if (existingIndex >= 0) {
      setItems(prev => prev.map((it, idx) => idx === existingIndex ? { ...it, quantity: it.quantity + 1 } : it));
      setSelectedProductId('');
      return;
    }

    const wholesale = getProductWholesalePrice(prod);
    const unitPrice = saleType === 'wholesale' ? wholesale : prod.selling_price;

    setItems(prev => [
      ...prev,
      {
        product_id: prod.id,
        quantity: 1,
        unit_price: unitPrice,
        retail_price: prod.selling_price,
        wholesale_price: wholesale,
        discount_amount: 0,
        is_custom_price: false,
      },
    ]);
    setSelectedProductId('');
    if (errors.items) setErrors(prev => ({ ...prev, items: '' }));
  };

  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateItem = (index: number, updates: Partial<ManualSaleItem>) => {
    setItems(prev => prev.map((it, idx) => {
      if (idx !== index) return it;
      const updated = { ...it, ...updates };
      if (updates.unit_price !== undefined) {
        const expectedPrice = saleType === 'wholesale' ? it.wholesale_price : it.retail_price;
        updated.is_custom_price = Math.abs(updates.unit_price - expectedPrice) > 0.01;
      }
      return updated;
    }));
  };

  // Switch between Retail & Wholesale mode
  const handleToggleSaleType = (newType: 'retail' | 'wholesale') => {
    setSaleType(newType);
    setItems(prev => prev.map(it => {
      if (it.is_custom_price) return it; // Preserve manual override
      const newUnit = newType === 'wholesale' ? it.wholesale_price : it.retail_price;
      return { ...it, unit_price: newUnit };
    }));
  };

  // Totals calculations
  const subtotal = useMemo(() => {
    return items.reduce((sum, it) => sum + (it.unit_price * it.quantity), 0);
  }, [items]);

  const totalItemDiscount = useMemo(() => {
    return items.reduce((sum, it) => sum + (it.discount_amount || 0), 0);
  }, [items]);

  const grandTotal = useMemo(() => {
    const effSub = Math.max(0, subtotal - totalItemDiscount - orderDiscount);
    return effSub + (deliveryCharge || 0);
  }, [subtotal, totalItemDiscount, orderDiscount, deliveryCharge]);

  // Payment management
  const totalPaid = useMemo(() => {
    return payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }, [payments]);

  const remainingDue = useMemo(() => {
    return Math.max(0, grandTotal - totalPaid);
  }, [grandTotal, totalPaid]);

  // Keep auto full payment in sync if enabled
  React.useEffect(() => {
    if (isFullPaymentAuto && grandTotal > 0) {
      const defaultAcc = availablePaymentAccounts[0] || { id: 'acc_cash', name: 'Cash in Hand (Till)' };
      setPayments([
        {
          method: 'cash',
          account_id: defaultAcc.id,
          account_name: defaultAcc.name,
          amount: grandTotal,
          payment_date: transactionDate,
          notes: 'Full payment',
        },
      ]);
    } else if (isFullPaymentAuto && grandTotal === 0) {
      setPayments([]);
    }
  }, [grandTotal, isFullPaymentAuto, transactionDate, availablePaymentAccounts]);

  const handleAddPaymentLine = () => {
    setIsFullPaymentAuto(false);
    const defaultAcc = availablePaymentAccounts[0] || { id: 'acc_cash', name: 'Cash in Hand (Till)' };
    const initialAmt = remainingDue > 0 ? remainingDue : 0;
    setPayments(prev => [
      ...prev,
      {
        method: 'cash',
        account_id: defaultAcc.id,
        account_name: defaultAcc.name,
        amount: initialAmt,
        payment_date: transactionDate,
        notes: '',
      },
    ]);
  };

  const handleRemovePaymentLine = (idx: number) => {
    setIsFullPaymentAuto(false);
    setPayments(prev => prev.filter((_, i) => i !== idx));
  };

  const handleUpdatePaymentLine = (idx: number, field: keyof ManualPaymentItem, value: any) => {
    setIsFullPaymentAuto(false);
    setPayments(prev => prev.map((p, i) => {
      if (i !== idx) return p;
      if (field === 'account_id') {
        const found = availablePaymentAccounts.find(a => a.id === value);
        let method: ManualPaymentItem['method'] = 'cash';
        const lower = (found?.name || '').toLowerCase();
        if (lower.includes('bkash')) method = 'bkash';
        else if (lower.includes('nagad')) method = 'nagad';
        else if (lower.includes('bank')) method = 'bank';
        else if (lower.includes('card')) method = 'card';
        return { ...p, account_id: value, account_name: found?.name || value, method };
      }
      return { ...p, [field]: value };
    }));
  };

  // Validation
  const validateForm = (): boolean => {
    const errs: Record<string, string> = {};
    if (!customerName.trim()) {
      errs.customerName = 'Customer name is required';
    }
    if (!customerPhone.trim()) {
      errs.customerPhone = 'Customer mobile number is required';
    }
    if (items.length === 0) {
      errs.items = 'Please add at least one product to the sale';
    }
    if (fulfillmentMethod !== 'n_a_walk_in' && fulfillmentMethod !== 'self_pickup' && !deliveryAddress.trim()) {
      errs.deliveryAddress = 'Delivery address is required for delivery fulfillment';
    }
    if (totalPaid > grandTotal + 0.01) {
      errs.payment = 'Total payments cannot exceed the sale total';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleOpenConfirmation = () => {
    setSubmitError(null);
    if (validateForm()) {
      setShowConfirmation(true);
    }
  };

  // Submission
  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Map items for API
      const orderItems = items.map(it => ({
        product_id: it.product_id,
        quantity: it.quantity,
        unit_price: it.unit_price,
        discount_amount: it.discount_amount || 0,
      }));

      // Map payments for API
      const paymentInfo = payments.filter(p => Number(p.amount) > 0).map(p => ({
        method: p.method,
        amount: Number(p.amount),
        account_id: p.account_id,
        transaction_ref: p.transaction_ref,
        notes: p.notes,
        payment_date: p.payment_date || transactionDate,
      }));

      const channel = fulfillmentMethod === 'n_a_walk_in' ? 'walk-in' : 'messenger';
      const isHistorical = transactionDate !== todayStr;

      const payload = {
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        delivery_address: deliveryAddress.trim() || undefined,
        channel,
        order_type: 'direct_sale',
        sale_type: saleType,
        fulfillment_method: fulfillmentMethod,
        status: orderStatus,
        items: orderItems,
        delivery_charge: deliveryCharge || 0,
        discount_amount: orderDiscount || 0,
        transaction_date: transactionDate,
        delivery_date: deliveryDate || transactionDate,
        delivered_by_user_id: deliveredByUserId || undefined,
        delivered_by_name: users.find(u => u.id === deliveredByUserId)?.name || undefined,
        notes: notes.trim() || undefined,
        is_manual_entry: true,
        payment_info: paymentInfo,
      };

      const createdOrder = await createOrder(payload);

      setShowConfirmation(false);
      onClose();
      if (onSuccess) onSuccess(createdOrder);
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to record manual sale');
      setShowConfirmation(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isBackdated = transactionDate && transactionDate < todayStr;

  return (
    <>
      <Modal
        isOpen={isOpen && !showConfirmation}
        onClose={onClose}
        title="Add Sale · Manual & Historical Sales Entry"
        size="lg"
      >
        <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1 text-[12px]">
          {submitError && (
            <div className="p-2.5 bg-[var(--surface-sunken)] border border-[var(--status-red)] text-[var(--status-red)] rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Top Bar: Transaction Date & Pricing Mode */}
          <div className="bg-[var(--surface-sunken)] border border-[var(--border)] rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div>
                <label className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase mb-1">
                  Transaction Date
                </label>
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
                  <input
                    type="date"
                    value={transactionDate}
                    onChange={e => setTransactionDate(e.target.value)}
                    className="px-2 py-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[12px] font-mono font-medium text-[var(--text)]"
                  />
                  {isBackdated && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--surface)] border border-[var(--border)] text-[var(--status-amber)]">
                      Historical Entry
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase mb-1">
                  Sale Status
                </label>
                <select
                  value={orderStatus}
                  onChange={e => setOrderStatus(e.target.value as OrderStatus)}
                  className="px-2.5 py-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[12px] font-medium text-[var(--text)]"
                >
                  <option value="delivered">Delivered / Completed (Immediate stock deduction)</option>
                  <option value="confirmed">Confirmed (Reserve stock for later dispatch)</option>
                  <option value="packed">Packed</option>
                  <option value="dispatched">Dispatched</option>
                </select>
              </div>
            </div>

            {/* Pricing Mode Toggle */}
            <div className="flex items-center gap-1.5 bg-[var(--surface)] border border-[var(--border)] p-0.5 rounded-lg">
              <button
                type="button"
                onClick={() => handleToggleSaleType('retail')}
                className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                  saleType === 'retail'
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-text)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
                }`}
              >
                Retail Pricing
              </button>
              <button
                type="button"
                onClick={() => handleToggleSaleType('wholesale')}
                className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                  saleType === 'wholesale'
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-text)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
                }`}
              >
                Wholesale Pricing
              </button>
            </div>
          </div>

          {/* Section 1: Customer Details with Shared Recognition */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-[12px] font-bold text-[var(--text)] flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
                Customer Information
              </h4>
              <span className="text-[10px] text-[var(--text-secondary)]">
                Recognizes existing customers from Customer Master
              </span>
            </div>

            <CustomerLookupInput
              customerName={customerName}
              onCustomerNameChange={name => {
                setCustomerName(name);
                if (errors.customerName) setErrors(prev => ({ ...prev, customerName: '' }));
              }}
              customerPhone={customerPhone}
              onCustomerPhoneChange={phone => {
                setCustomerPhone(phone);
                if (errors.customerPhone) setErrors(prev => ({ ...prev, customerPhone: '' }));
              }}
              deliveryAddress={deliveryAddress}
              onDeliveryAddressChange={addr => {
                setDeliveryAddress(addr);
                if (errors.deliveryAddress) setErrors(prev => ({ ...prev, deliveryAddress: '' }));
              }}
              showAddress={fulfillmentMethod !== 'n_a_walk_in' && fulfillmentMethod !== 'self_pickup'}
              nameRequired={true}
              phoneRequired={true}
              addressRequired={fulfillmentMethod !== 'n_a_walk_in' && fulfillmentMethod !== 'self_pickup'}
              errors={errors}
            />
          </div>

          {/* Section 2: Items Table & Product Selector */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-[12px] font-bold text-[var(--text)] flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
                Sale Items ({items.length})
              </h4>
              <div className="flex items-center gap-2">
                <select
                  value={selectedProductId}
                  onChange={e => handleAddItem(e.target.value)}
                  className="px-2.5 py-1 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg text-[11px] text-[var(--text)] max-w-xs cursor-pointer"
                >
                  <option value="">+ Add Product from Catalog...</option>
                  {products.map(prod => {
                    const available = prod.stock_available ?? 0;
                    return (
                      <option key={prod.id} value={prod.id}>
                        {prod.display_name} — (Avail: {available}) · ৳{saleType === 'wholesale' ? getProductWholesalePrice(prod).toLocaleString() : prod.selling_price.toLocaleString()}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {errors.items && (
              <p className="text-[11px] text-[var(--status-red)]">{errors.items}</p>
            )}

            {items.length === 0 ? (
              <div className="py-6 text-center text-[var(--text-secondary)] bg-[var(--surface-sunken)] rounded-xl border border-dashed border-[var(--border)]">
                No products added. Select a product above to add to this transaction.
              </div>
            ) : (
              <div className="border border-[var(--border)] rounded-xl overflow-hidden">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-[var(--surface-sunken)] border-b border-[var(--border)] text-[10px] text-[var(--text-secondary)] uppercase font-semibold">
                    <tr>
                      <th className="p-2">Product</th>
                      <th className="p-2 w-20 text-center">Stock</th>
                      <th className="p-2 w-16 text-center">Qty</th>
                      <th className="p-2 w-28 text-right">Unit Price (৳)</th>
                      <th className="p-2 w-24 text-right">Discount (৳)</th>
                      <th className="p-2 w-28 text-right">Total (৳)</th>
                      <th className="p-2 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {items.map((it, idx) => {
                      const prod = products.find(p => p.id === it.product_id);
                      const available = prod?.stock_available ?? 0;
                      const lineTotal = Math.max(0, it.unit_price * it.quantity - (it.discount_amount || 0));

                      return (
                        <tr key={it.product_id} className="hover:bg-[var(--surface-sunken)]/50">
                          <td className="p-2">
                            <div className="font-semibold text-[var(--text)]">{prod?.display_name || 'Product'}</div>
                            <div className="text-[10px] font-mono text-[var(--text-secondary)]">{prod?.sku}</div>
                          </td>
                          <td className="p-2 text-center font-mono">
                            <span className={available <= 0 ? 'text-[var(--status-red)] font-bold' : 'text-[var(--text-secondary)]'}>
                              {available}
                            </span>
                          </td>
                          <td className="p-2 text-center">
                            <input
                              type="number"
                              min="1"
                              value={it.quantity}
                              onChange={e => handleUpdateItem(idx, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                              className="w-14 px-1.5 py-1 text-center bg-[var(--surface)] border border-[var(--border)] rounded font-mono text-[11px]"
                            />
                          </td>
                          <td className="p-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <input
                                type="number"
                                min="0"
                                value={it.unit_price}
                                onChange={e => handleUpdateItem(idx, { unit_price: Math.max(0, parseFloat(e.target.value) || 0) })}
                                className={`w-24 px-1.5 py-1 text-right bg-[var(--surface)] border rounded font-mono text-[11px] ${
                                  it.is_custom_price ? 'border-[var(--accent-secondary)] font-bold text-[var(--accent-secondary)]' : 'border-[var(--border)]'
                                }`}
                              />
                            </div>
                            {it.is_custom_price && (
                              <span className="text-[9px] text-[var(--text-secondary)] block">Override (saved)</span>
                            )}
                          </td>
                          <td className="p-2 text-right">
                            <input
                              type="number"
                              min="0"
                              value={it.discount_amount}
                              onChange={e => handleUpdateItem(idx, { discount_amount: Math.max(0, parseFloat(e.target.value) || 0) })}
                              className="w-20 px-1.5 py-1 text-right bg-[var(--surface)] border border-[var(--border)] rounded font-mono text-[11px]"
                            />
                          </td>
                          <td className="p-2 text-right font-mono font-bold text-[var(--text)]">
                            ৳{lineTotal.toLocaleString()}
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="p-1 text-[var(--text-secondary)] hover:text-[var(--status-red)] cursor-pointer"
                              title="Remove item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Delivery & Order-Level Discount Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div>
                <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase mb-0.5">
                  Fulfillment Method
                </label>
                <select
                  value={fulfillmentMethod}
                  onChange={e => {
                    const method = e.target.value as FulfillmentMethod;
                    setFulfillmentMethod(method);
                    if (method === 'n_a_walk_in' || method === 'self_pickup') {
                      setDeliveryCharge(0);
                    } else if (deliveryCharge === 0) {
                      setDeliveryCharge(settings?.inside_dhaka_delivery || 70);
                    }
                  }}
                  className="w-full px-2 py-1.5 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg text-[11px]"
                >
                  <option value="in_house">In-House Staff Hand Delivery</option>
                  <option value="steadfast">Steadfast Courier COD</option>
                  <option value="instant_delivery">Instant Delivery (Pathao / Uber)</option>
                  <option value="self_pickup">Customer Self-Pickup</option>
                  <option value="n_a_walk_in">Walk-in Store Purchase</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase mb-0.5">
                  Delivery Charge (৳)
                </label>
                <input
                  type="number"
                  min="0"
                  value={deliveryCharge}
                  onChange={e => setDeliveryCharge(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full px-2 py-1.5 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase mb-0.5">
                  Order Discount (৳)
                </label>
                <input
                  type="number"
                  min="0"
                  value={orderDiscount}
                  onChange={e => setOrderDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full px-2 py-1.5 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg font-mono text-[11px]"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Payment Breakdown (Configured ERP accounts, full, partial, multiple) */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-[12px] font-bold text-[var(--text)] flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
                Payment Breakdown
              </h4>
              <div className="flex items-center gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => setIsFullPaymentAuto(!isFullPaymentAuto)}
                  className="text-[11px] text-[var(--accent-secondary)] hover:underline cursor-pointer"
                >
                  {isFullPaymentAuto ? 'Switch to Partial/Split' : 'Auto Full Paid'}
                </button>
                <button
                  type="button"
                  onClick={handleAddPaymentLine}
                  className="px-2 py-1 rounded bg-[var(--surface-sunken)] border border-[var(--border)] text-[var(--text)] font-semibold hover:bg-[var(--surface)] cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  + Split Payment
                </button>
              </div>
            </div>

            {errors.payment && (
              <p className="text-[11px] text-[var(--status-red)]">{errors.payment}</p>
            )}

            {payments.length === 0 ? (
              <div className="p-3 bg-[var(--surface-sunken)] rounded-lg border border-[var(--border)] text-[11px] text-[var(--text-secondary)] flex items-center justify-between">
                <span>No payments recorded yet. Sale will have 100% outstanding due (৳{grandTotal.toLocaleString()}).</span>
                <button
                  type="button"
                  onClick={handleAddPaymentLine}
                  className="px-2 py-1 rounded bg-[var(--accent-primary)] text-[var(--accent-text)] font-semibold cursor-pointer"
                >
                  Record Payment
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {payments.map((p, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-xl grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
                  >
                    <div className="sm:col-span-4">
                      <label className="block text-[9px] font-bold text-[var(--text-secondary)] uppercase mb-0.5">
                        Payment Account
                      </label>
                      <select
                        value={p.account_id}
                        onChange={e => handleUpdatePaymentLine(idx, 'account_id', e.target.value)}
                        className="w-full px-2 py-1 bg-[var(--surface)] border border-[var(--border)] rounded text-[11px] text-[var(--text)] font-medium cursor-pointer"
                      >
                        {availablePaymentAccounts.map(acc => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name} ({acc.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[9px] font-bold text-[var(--text-secondary)] uppercase mb-0.5">
                        Amount (৳)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={p.amount}
                        onChange={e => handleUpdatePaymentLine(idx, 'amount', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 bg-[var(--surface)] border border-[var(--border)] rounded text-[11px] font-mono font-bold text-[var(--text)] text-right"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[9px] font-bold text-[var(--text-secondary)] uppercase mb-0.5">
                        Payment Date
                      </label>
                      <input
                        type="date"
                        value={p.payment_date || transactionDate}
                        onChange={e => handleUpdatePaymentLine(idx, 'payment_date', e.target.value)}
                        className="w-full px-1.5 py-1 bg-[var(--surface)] border border-[var(--border)] rounded text-[10px] font-mono text-[var(--text)]"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[9px] font-bold text-[var(--text-secondary)] uppercase mb-0.5">
                        Trx Ref / Note
                      </label>
                      <input
                        type="text"
                        placeholder="Ref/Trx ID"
                        value={p.transaction_ref || ''}
                        onChange={e => handleUpdatePaymentLine(idx, 'transaction_ref', e.target.value)}
                        className="w-full px-2 py-1 bg-[var(--surface)] border border-[var(--border)] rounded text-[10px] text-[var(--text)] font-mono"
                      />
                    </div>

                    <div className="sm:col-span-1 flex justify-end pt-3 sm:pt-0">
                      <button
                        type="button"
                        onClick={() => handleRemovePaymentLine(idx)}
                        className="p-1 text-[var(--text-secondary)] hover:text-[var(--status-red)] cursor-pointer"
                        title="Remove payment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Payment Summary Box */}
            <div className="p-3 bg-[var(--surface-sunken)] rounded-xl border border-[var(--border)] flex flex-wrap items-center justify-between gap-3 text-[12px]">
              <div>
                <span className="text-[var(--text-secondary)] font-medium">Grand Total: </span>
                <span className="font-mono font-bold text-[var(--text)]">৳{grandTotal.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-[var(--text-secondary)] font-medium">Total Paid: </span>
                <span className="font-mono font-bold text-[var(--status-green)]">৳{totalPaid.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-[var(--text-secondary)] font-medium">Remaining Due: </span>
                <span className={`font-mono font-bold ${remainingDue > 0 ? 'text-[var(--status-red)]' : 'text-[var(--text-secondary)]'}`}>
                  ৳{remainingDue.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Section 4: Advanced / Additional Info (Collapsible) */}
          <div className="border border-[var(--border)] rounded-xl overflow-hidden bg-[var(--surface)]">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full px-3 py-2 bg-[var(--surface-sunken)] flex items-center justify-between text-[11px] font-bold text-[var(--text-secondary)] hover:text-[var(--text)] cursor-pointer"
            >
              <span>Additional Details (Delivery Person, Delivery Date, Notes)</span>
              {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showAdvanced && (
              <div className="p-3 space-y-3 text-[11px]">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase mb-0.5">
                      Delivered By (Staff / Rider)
                    </label>
                    <select
                      value={deliveredByUserId}
                      onChange={e => setDeliveredByUserId(e.target.value)}
                      className="w-full px-2 py-1.5 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg text-[11px]"
                    >
                      <option value="">Select staff member...</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.role})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase mb-0.5">
                      Delivery Date
                    </label>
                    <input
                      type="date"
                      value={deliveryDate}
                      onChange={e => setDeliveryDate(e.target.value)}
                      className="w-full px-2 py-1.5 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg font-mono text-[11px]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase mb-0.5">
                    Internal Note / Reason for Manual Entry
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="e.g. Backdated Messenger sale entered manually from paper log"
                    className="w-full px-2.5 py-1.5 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg text-[11px] text-[var(--text)]"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Action Bar */}
          <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-[12px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleOpenConfirmation}
              className="px-5 py-2 rounded-xl text-[12px] font-bold bg-[var(--accent-primary)] text-[var(--accent-text)] hover:opacity-95 shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              Review & Create Sale
            </button>
          </div>
        </div>
      </Modal>

      {/* Confirmation Step Dialog */}
      {showConfirmation && (
        <Modal
          isOpen={true}
          onClose={() => setShowConfirmation(false)}
          title="Confirm Manual Sale Entry"
          size="md"
        >
          <div className="space-y-4 text-[12px]">
            {isBackdated && (
              <div className="p-3 bg-[var(--surface-sunken)] border border-[var(--status-amber)] rounded-xl text-[var(--status-amber)] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span className="text-[11px]">
                  <strong>Historical Transaction Notice:</strong> This sale is dated <strong>{transactionDate}</strong> (backdated). System entry timestamp will record today.
                </span>
              </div>
            )}

            <div className="p-3 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-secondary)]">Customer:</span>
                <span className="font-bold text-[var(--text)]">{customerName} ({customerPhone})</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-secondary)]">Items Count:</span>
                <span className="font-mono font-semibold text-[var(--text)]">{items.length} products ({items.reduce((s, i) => s + i.quantity, 0)} units)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-secondary)]">Pricing Mode:</span>
                <span className="font-semibold text-[var(--text)] uppercase">{saleType}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-secondary)]">Status:</span>
                <span className="font-semibold text-[var(--status-green)] uppercase">{orderStatus}</span>
              </div>
              <div className="flex items-center justify-between border-t border-[var(--border)] pt-2">
                <span className="text-[var(--text-secondary)]">Total Sale Amount:</span>
                <span className="font-mono font-bold text-[14px] text-[var(--text)]">৳{grandTotal.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-secondary)]">Recorded Payments:</span>
                <span className="font-mono font-bold text-[var(--status-green)]">৳{totalPaid.toLocaleString()}</span>
              </div>
              {remainingDue > 0 && (
                <div className="flex items-center justify-between text-[var(--status-red)]">
                  <span>Remaining Due / Balance:</span>
                  <span className="font-mono font-bold">৳{remainingDue.toLocaleString()}</span>
                </div>
              )}
            </div>

            <p className="text-[11px] text-[var(--text-secondary)]">
              This action will create the sale record, allocate an invoice number, update inventory according to the selected status, record payments in the chart of accounts, and log an audit trail entry.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setShowConfirmation(false)}
                className="px-4 py-2 rounded-xl text-[12px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] cursor-pointer"
              >
                Back to Edit
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleFinalSubmit}
                className="px-5 py-2 rounded-xl text-[12px] font-bold bg-[var(--accent-primary)] text-[var(--accent-text)] hover:opacity-95 shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
              >
                {isSubmitting ? (
                  <>Processing...</>
                ) : (
                  <>Confirm & Save Sale</>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};
