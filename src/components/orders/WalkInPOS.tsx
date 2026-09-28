import React, { useState, useRef, useEffect } from 'react';
import {
  Scan,
  ShoppingCart,
  Trash2,
  CheckCircle2,
  DollarSign,
  CreditCard,
  Smartphone,
  Building2,
  Landmark,
  Wallet,
  Percent,
  SplitSquareVertical,
  Plus,
  Search,
  Printer,
  Store,
  Coins,
  AlertTriangle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Product, Order } from '../../types';
import { InvoiceModal } from './InvoiceModal';
import { Modal } from '../common/Modal';
import { CustomerLookupInput } from '../common/CustomerLookupInput';

export const WalkInPOS: React.FC = () => {
  const { products, createOrder, customers, activeCashierClosing, unclosedCashierDays, setActivePath } = useApp();
  const { currentUser } = useAuth();

  const [barcodeInput, setBarcodeInput] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('Walk-in Customer');
  const [customerPhone, setCustomerPhone] = useState<string>('01700000000');

  const [cart, setCart] = useState<
    {
      product: Product;
      quantity: number;
      unitPrice: number;
      discount: number;
    }[]
  >([]);

  // Split payment state
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bkash' | 'nagad' | 'bank' | 'card' | 'split'>('cash');
  // Which bank money goes into when paying by bank/card (personal vs business)
  const [bankAccount, setBankAccount] = useState<'acc_bank' | 'acc_bank_personal'>('acc_bank');
  const [cashAmount, setCashAmount] = useState<number>(0);
  const [bkashAmount, setBkashAmount] = useState<number>(0);
  const [nagadAmount, setNagadAmount] = useState<number>(0);
  // Single-method bank (non-split) uses the selected bankAccount; split mode
  // lets staff split bank money across BOTH business and personal accounts.
  const [bankAmount, setBankAmount] = useState<number>(0);
  const [businessBankAmount, setBusinessBankAmount] = useState<number>(0);
  const [personalBankAmount, setPersonalBankAmount] = useState<number>(0);
  const [cardAmount, setCardAmount] = useState<number>(0);
  const [transactionRef, setTransactionRef] = useState<string>('');

  // Point 4: wholesale sale toggle (uses wholesale_price, prints wholesale invoice)
  const [wholesaleMode, setWholesaleMode] = useState<boolean>(false);
  // Confirm dialog shown before switching Retail \u2192 Wholesale (deliberate, not accidental).
  const [confirmWholesale, setConfirmWholesale] = useState<boolean>(false);

  // Order-level discount: entered either as fixed \u09F3 or a % of subtotal
  const [orderDiscount, setOrderDiscount] = useState<number>(0);
  const [orderDiscountMode, setOrderDiscountMode] = useState<'amount' | 'percent'>('amount');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState<boolean>(false);

  const barcodeInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    barcodeInputRef.current?.focus();
  }, []);

  const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const itemDiscountTotal = cart.reduce((sum, item) => sum + item.discount, 0);
  // Effective order discount: if in percent mode, derive from the (already item-discounted) running total
  const orderDiscountAmount =
    orderDiscountMode === 'percent'
      ? (subtotal - itemDiscountTotal) * (Math.max(0, Math.min(100, orderDiscount)) / 100)
      : Math.max(0, orderDiscount);
  const finalTotal = Math.max(0, subtotal - itemDiscountTotal - orderDiscountAmount);

  // Live split-payment tracking: what has been received vs. what is still due.
  const splitReceived =
    cashAmount + bkashAmount + nagadAmount + businessBankAmount + personalBankAmount + cardAmount;
  const splitRemaining = Math.max(0, finalTotal - splitReceived);

  // Effective wholesale price per product. A 'same_as_retail' product (or a
  // legacy row with no distinct wholesale price) uses the retail selling price;
  // only a 'separate' product uses its stored wholesale_price. Retail mode
  // always uses the fixed catalog selling price \u2014 never a typed-down price.
  const wholesalePriceFor = (prod: Product): number =>
    prod.wholesale_type === 'separate' || (
      prod.wholesale_type === undefined &&
      typeof prod.wholesale_price === 'number' &&
      prod.wholesale_price > 0 &&
      prod.wholesale_price !== (prod.selling_price ?? 0)
    )
      ? (typeof prod.wholesale_price === 'number' ? prod.wholesale_price : prod.selling_price)
      : prod.selling_price;

  const priceFor = (prod: Product, wholesale: boolean) =>
    wholesale ? wholesalePriceFor(prod) : prod.selling_price;

  // Reprice existing cart items when the retail/wholesale toggle changes.
  const setSaleMode = (wholesale: boolean) => {
    setWholesaleMode(wholesale);
    setCart(prev =>
      prev.map(it => ({
        ...it,
        unitPrice: priceFor(it.product, wholesale),
      }))
    );
  };

  // Update default single-method amount when total changes
  useEffect(() => {
    if (paymentMethod === 'cash') {
      setCashAmount(finalTotal);
    } else if (paymentMethod === 'bkash') {
      setBkashAmount(finalTotal);
    } else if (paymentMethod === 'nagad') {
      setNagadAmount(finalTotal);
    } else if (paymentMethod === 'bank') {
      setBankAmount(finalTotal);
    } else if (paymentMethod === 'card') {
      setCardAmount(finalTotal);
    }
  }, [finalTotal, paymentMethod]);

  const addProductToCart = (prod: Product) => {
    setErrorMsg(null);
    const existingIndex = cart.findIndex(c => c.product.id === prod.id);
    const currentCartQty = existingIndex >= 0 ? cart[existingIndex].quantity : 0;
    const available = prod.stock_available ?? 0;

    if (currentCartQty + 1 > available) {
      setErrorMsg(`Cannot add ${prod.display_name} \u2014 only ${available} available on Shop Floor`);
      return;
    }

    if (existingIndex >= 0) {
      setCart(prev =>
        prev.map((it, idx) => (idx === existingIndex ? { ...it, quantity: it.quantity + 1 } : it))
      );
    } else {
      setCart(prev => [
        ...prev,
        {
          product: prod,
          quantity: 1,
          unitPrice: priceFor(prod, wholesaleMode),
          discount: 0,
        },
      ]);
    }
  };

  const updateQuantity = (index: number, delta: number) => {
    setErrorMsg(null);
    const item = cart[index];
    const newQty = item.quantity + delta;
    const available = item.product.stock_available ?? 0;

    if (newQty <= 0) {
      setCart(prev => prev.filter((_, i) => i !== index));
      return;
    }

    if (newQty > available) {
      setErrorMsg(`Cannot set quantity to ${newQty} \u2014 only ${available} in stock`);
      return;
    }

    setCart(prev =>
      prev.map((it, idx) => (idx === index ? { ...it, quantity: newQty } : it))
    );
  };

  // Per-line discount. The unit price stays at the fixed catalog price \u2014 we
  // only ever reduce via the discount row (never a lower unit price), and we
  // clamp so the line's discounted total can't go negative.
  const setItemDiscount = (index: number, discount: number) => {
    setErrorMsg(null);
    const clean = Number.isFinite(discount) ? Math.max(0, discount) : 0;
    setCart(prev =>
      prev.map((it, idx) => {
        if (idx !== index) return it;
        const maxDisc = it.unitPrice * it.quantity;
        return { ...it, discount: Math.min(clean, maxDisc) };
      })
    );
  };

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    const query = barcodeInput.trim();
    const matched = products.find(
      p => p.barcode === query || p.sku.toLowerCase() === query.toLowerCase()
    );

    if (matched) {
      addProductToCart(matched);
      setBarcodeInput('');
    } else {
      setErrorMsg(`Product with barcode/SKU "${query}" not found.`);
    }
  };

  const filteredCatalog = searchQuery.trim()
    ? products.filter(
        p =>
          p.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.barcode.includes(searchQuery)
      )
    : products;

  const handleCheckout = async () => {
    if (cart.length === 0) {
      setErrorMsg('Cart is empty.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      // Build the payment transactions as a real array the backend accepts
      // (server/db.ts line ~576): [{ method, amount, account_id, transaction_ref }]
      const paymentInfo: any[] = [];
      const pushPay = (method: string, amount: number, account_id: string) => {
        if (amount > 0) {
          paymentInfo.push({
            method,
            amount: Math.round(amount),
            account_id,
            transaction_ref: transactionRef || undefined,
          });
        }
      };

      if (paymentMethod === 'split') {
        // Every method gets its own input so staff can collect money across
        // Cash, bKash, Nagad, Business Bank, Personal Bank, and Card in one sale.
        const splitParts: { method: string; amount: number; account_id: string }[] = [
          { method: 'cash', amount: cashAmount, account_id: 'acc_cash' },
          { method: 'bkash', amount: bkashAmount, account_id: 'acc_bkash' },
          { method: 'nagad', amount: nagadAmount, account_id: 'acc_nagad' },
          { method: 'bank', amount: businessBankAmount, account_id: 'acc_bank' },
          { method: 'bank', amount: personalBankAmount, account_id: 'acc_bank_personal' },
          { method: 'card', amount: cardAmount, account_id: 'acc_bank' },
        ];
        const splitSum = splitParts.reduce((s, p) => s + p.amount, 0);
        if (splitSum > finalTotal + 0.5) {
          throw new Error(`Payment total (\u09F3${splitSum.toLocaleString()}) exceeds Total Due (\u09F3${finalTotal.toLocaleString()}) by \u09F3${Math.abs(finalTotal - splitSum).toLocaleString()}.`);
        }
        splitParts.forEach(p => pushPay(p.method, p.amount, p.account_id));
      } else if (paymentMethod === 'bank') {
        pushPay('bank', Math.min(bankAmount, finalTotal), bankAccount);
      } else if (paymentMethod === 'card') {
        pushPay('card', Math.min(cardAmount, finalTotal), 'acc_bank');
      } else if (paymentMethod === 'bkash') {
        pushPay('bkash', Math.min(bkashAmount, finalTotal), 'acc_bkash');
      } else if (paymentMethod === 'nagad') {
        pushPay('nagad', Math.min(nagadAmount, finalTotal), 'acc_nagad');
      } else {
        pushPay('cash', Math.min(cashAmount, finalTotal), 'acc_cash');
      }

      if (paymentInfo.length === 0) {
        throw new Error('No payment amount entered.');
      }

      const order = await createOrder({
        customer_name: customerName || 'Walk-in Customer',
        customer_phone: customerPhone || '01700000000',
        channel: 'walk-in',
        fulfillment_method: 'n_a_walk_in',
        sale_type: wholesaleMode ? 'wholesale' : 'retail',
        business_date: activeCashierClosing?.business_date || new Date().toISOString().slice(0, 10),
        items: cart.map(it => ({
          product_id: it.product.id,
          quantity: it.quantity,
          unit_price: it.unitPrice,
          discount_amount: it.discount,
        })),
        delivery_charge: 0,
        discount_amount: Math.round(orderDiscountAmount),
        payment_info: paymentInfo,
      });

      setCompletedOrder(order);
      setShowInvoiceModal(true);
      setCart([]);
      setOrderDiscount(0);
      // Every new sale starts fresh in Retail mode (Point: deliberate, not accidental).
      setWholesaleMode(false);
      setConfirmWholesale(false);
      setCustomerName('Walk-in Customer');
      setCustomerPhone('01700000000');
    } catch (err: any) {
      setErrorMsg(err.message || 'Checkout failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto" id="walk-in-pos-view">
      {/* Top Banner with Barcode Scan Input */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center font-bold">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-[14px] font-semibold text-[var(--text)]">Walk-in Showroom POS</h2>
            <p className="text-[11px] text-[var(--text-secondary)]">
              Scan barcode or select items for instant showroom counter checkout.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Cashier Daily Closing Status Pill */}
          <button
            type="button"
            onClick={() => setActivePath('/orders/daily-closing')}
            className={`px-3 py-1.5 rounded-xl border text-[12px] font-semibold flex items-center gap-1.5 cursor-pointer transition-all ${
              unclosedCashierDays.length > 0
                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/25'
                : 'bg-[var(--surface-sunken)] text-[var(--text)] border-[var(--border)] hover:bg-[var(--surface-hover)]'
            }`}
            title="Manage personal daily sales collections and close business day"
          >
            {unclosedCashierDays.length > 0 ? (
              <>
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>Unclosed: {unclosedCashierDays[0].business_date}</span>
              </>
            ) : (
              <>
                <Coins className="w-3.5 h-3.5 text-emerald-600" />
                <span>
                  {activeCashierClosing
                    ? `${activeCashierClosing.business_date} • ৳${activeCashierClosing.sales_metrics.total_collected.toLocaleString()}`
                    : 'Daily Closing'}
                </span>
              </>
            )}
          </button>
          {/* Point 4: Retail / Wholesale mode toggle \u2014 turning ON requires explicit
              confirmation; turning OFF is instant. New sales always start Retail. */}
          <button
            type="button"
            onClick={() => {
              if (wholesaleMode) {
                setSaleMode(false);
              } else {
                setConfirmWholesale(true);
              }
            }}
            className={`px-3 py-1.5 rounded-xl border text-[12px] font-semibold flex items-center gap-1.5 cursor-pointer transition-all ${
              wholesaleMode
                ? 'bg-[var(--accent-secondary)] text-white border-[var(--accent-secondary)] shadow-xs'
                : 'bg-[var(--surface-sunken)] text-[var(--text)] border-[var(--border)] hover:bg-[var(--surface-hover)]'
            }`}
            title={wholesaleMode ? 'Switch back to retail pricing' : 'Apply wholesale pricing to this sale'}
          >
            <Building2 className="w-3.5 h-3.5" />
            {wholesaleMode ? 'Wholesale Mode ON' : 'Wholesale'}
          </button>
        </div>

        {/* Barcode Fast Scan Box */}
        <form onSubmit={handleBarcodeSubmit} className="flex items-center gap-2 max-w-md w-full">
          <div className="relative flex-1">
            <Scan className="w-4 h-4 text-[var(--accent)] absolute left-3 top-2.5" />
            <input
              ref={barcodeInputRef}
              type="text"
              value={barcodeInput}
              onChange={e => setBarcodeInput(e.target.value)}
              placeholder="Scan Barcode or Enter SKU..."
              className="w-full pl-9 pr-3 py-1.5 text-[12px] font-mono font-bold bg-[var(--surface-sunken)] border border-[var(--border)] rounded-xl focus:ring-1 focus:ring-[var(--accent)] focus:outline-hidden"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-1.5 bg-[var(--accent)] text-white text-[12px] font-semibold rounded-xl hover:opacity-90 cursor-pointer shadow-xs"
          >
            Add
          </button>
        </form>
      </div>

      {/* Prominent WHOLESALE SALE indicator \u2014 unmistakable while active */}
      {wholesaleMode && (
        <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-[var(--accent-secondary)]/15 border-2 border-[var(--accent-secondary)]">
          <Building2 className="w-4 h-4 text-[var(--accent-secondary)]" />
          <span className="text-[13px] font-extrabold tracking-wide text-[var(--accent-secondary)] uppercase">
            Wholesale Sale Active
          </span>
          <span className="text-[10px] text-[var(--accent-secondary)]/80 font-medium">
            per-product wholesale rules apply
          </span>
        </div>
      )}

      {errorMsg && (
        <div className="p-2.5 bg-[color-mix(in_srgb,var(--status-red)_10%,transparent)] border border-[color-mix(in_srgb,var(--status-red)_30%,transparent)] text-[var(--status-red)] rounded-xl text-[12px] font-medium">
          {errorMsg}
        </div>
      )}

      {/* POS Grid: Left is Catalog, Right is Cart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Catalog Grid */}
        <div className="lg:col-span-7 space-y-3">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="relative flex-1 mr-3">
                <Search className="w-3.5 h-3.5 text-[var(--text-secondary)] absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search perfumes by name, brand, or SKU..."
                  className="w-full pl-8 pr-3 py-1.5 text-[12px] bg-[var(--surface-sunken)] border border-[var(--border)] rounded-xl focus:ring-1 focus:ring-[var(--accent)] focus:outline-hidden"
                />
              </div>
              <span className="text-[11px] text-[var(--text-secondary)] whitespace-nowrap">
                {filteredCatalog.length} SKUs
              </span>
            </div>

            {/* Product Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[500px] overflow-y-auto pr-1 scrollbar-thin">
              {filteredCatalog.map(prod => {
                const isAvailable = (prod.stock_available || 0) > 0;
                return (
                  <button
                    key={prod.id}
                    type="button"
                    onClick={() => addProductToCart(prod)}
                    className="p-3 text-left bg-[var(--surface-sunken)] hover:bg-[var(--surface-hover)] border border-[var(--border)] hover:border-[var(--accent)]/30 rounded-xl transition-all flex flex-col justify-between cursor-pointer group shadow-2xs"
                  >
                    <div>
                      <div className="text-[10px] font-semibold text-[var(--accent)] uppercase tracking-wider">
                        {prod.brand}
                      </div>
                      <div className="text-[12px] font-bold text-[var(--text)] group-hover:text-[var(--accent)] line-clamp-2 mt-0.5">
                        {prod.name}
                      </div>
                      <div className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                        {prod.concentration} &#8226; {prod.size_variant}
                      </div>
                    </div>

                    <div className="mt-2 pt-2 border-t border-[var(--border)] flex items-center justify-between">
                      <div>
                        <div className="font-mono font-bold text-[13px] text-[var(--text)]">
                          &#2547;{priceFor(prod, wholesaleMode).toLocaleString()}
                        </div>
                        {wholesaleMode && (
                          <div className="text-[9px] font-semibold text-[var(--accent-secondary)]">
                            {prod.wholesale_type === 'separate' ||
                            (prod.wholesale_type === undefined &&
                              typeof prod.wholesale_price === 'number' &&
                              prod.wholesale_price > 0 &&
                              prod.wholesale_price !== (prod.selling_price ?? 0))
                              ? 'Wholesale rate'
                              : 'Same as Retail'}
                          </div>
                        )}
                      </div>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-lg ${
                          isAvailable ? 'bg-[color-mix(in_srgb,var(--status-green)_10%,transparent)] text-[var(--status-green)]' : 'bg-[color-mix(in_srgb,var(--status-red)_10%,transparent)] text-[var(--status-red)]'
                        }`}
                      >
                        {isAvailable ? `${prod.stock_available} avail` : 'Sold out'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Live Cart & Settlement Panel */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-2.5">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-[var(--accent)]" />
                <h3 className="text-[14px] font-semibold text-[var(--text)]">Cart ({cart.length})</h3>
              </div>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCart([])}
                  className="text-[11px] text-[var(--status-red)] hover:underline cursor-pointer font-medium"
                >
                  Clear Cart
                </button>
              )}
            </div>

            {/* Customer Inputs with Shared Customer Lookup & Recognition */}
            <CustomerLookupInput
              customerName={customerName}
              onCustomerNameChange={setCustomerName}
              customerPhone={customerPhone}
              onCustomerPhoneChange={setCustomerPhone}
              layout="pos"
              showAddress={false}
            />

            {/* Cart Table with Single-Word Headers */}
            <div className="border border-[var(--border)] rounded-xl overflow-hidden bg-[var(--surface)] max-h-56 overflow-y-auto">
              {cart.length === 0 ? (
                <div className="p-6 text-center text-[12px] text-[var(--text-secondary)]">
                  Cart is empty. Scan barcode or tap catalog item.
                </div>
              ) : (
                <table className="w-full text-left text-[12px]">
                  <thead className="bg-[var(--surface-sunken)] border-b border-[var(--border)] text-[10px] text-[var(--text-secondary)] uppercase font-bold">
                    <tr>
                      <th className="p-2">Item</th>
                      <th className="p-2 text-center w-20">Qty</th>
                      <th className="p-2 text-right w-20">Total</th>
                      <th className="p-2 text-center w-8">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {cart.map((item, idx) => (
                      <tr key={idx} className="hover:bg-[var(--surface-hover)]">
                        <td className="p-2">
                          <div className="font-semibold text-[var(--text)] line-clamp-1">{item.product.display_name}</div>
                          <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-secondary)] font-mono">
                            {wholesaleMode ? (
                              <span className="text-[var(--accent-secondary)] font-bold">WHOLESALE</span>
                            ) : null}
                            &#2547;{item.unitPrice} each
                          </div>
                        </td>

                        <td className="p-2 text-center">
                          <div className="inline-flex items-center border border-[var(--border)] rounded-lg bg-[var(--surface)]">
                            <button
                              type="button"
                              onClick={() => updateQuantity(idx, -1)}
                              className="px-1.5 py-0.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text)] cursor-pointer"
                            >
                              -
                            </button>
                            <span className="px-1.5 font-mono font-bold text-[11px]">{item.quantity}</span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(idx, 1)}
                              className="px-1.5 py-0.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text)] cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                          <div className="flex items-center justify-center gap-1 mt-1">
                            <input
                              type="number"
                              min="0"
                              value={item.discount}
                              onChange={e => setItemDiscount(idx, Number(e.target.value))}
                              placeholder="disc"
                              title="Discount for this line (&#2547;)"
                              className="w-16 px-1.5 py-0.5 text-right font-mono text-[10px] bg-[var(--surface)] border border-[var(--border)] rounded-md text-[var(--status-red)] focus:outline-hidden focus:ring-1 focus:ring-[var(--accent)]"
                            />
                          </div>
                        </td>

                        <td className="p-2 text-right font-mono font-bold text-[var(--text)]">
                          &#2547;{(item.unitPrice * item.quantity - item.discount).toLocaleString()}
                          {item.discount > 0 && (
                            <div className="text-[9px] font-medium text-[var(--status-red)] text-right">
                              -&#2547;{item.discount.toLocaleString()}
                            </div>
                          )}
                        </td>

                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => setCart(prev => prev.filter((_, i) => i !== idx))}
                            className="text-[var(--text-secondary)] hover:text-[var(--status-red)] cursor-pointer p-0.5 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-[var(--text-secondary)] block">
                Payment Method
              </label>
              <div className="grid grid-cols-3 gap-1.5 text-[12px]">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cash')}
                  className={`p-2 rounded-xl border font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                    paymentMethod === 'cash'
                      ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-xs'
                      : 'bg-[var(--surface-sunken)] text-[var(--text)] border-[var(--border)] hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>Cash</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('bkash')}
                  className={`p-2 rounded-xl border font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                    paymentMethod === 'bkash'
                      ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-xs'
                      : 'bg-[var(--surface-sunken)] text-[var(--text)] border-[var(--border)] hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>bKash</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('nagad')}
                  className={`p-2 rounded-xl border font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                    paymentMethod === 'nagad'
                      ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-xs'
                      : 'bg-[var(--surface-sunken)] text-[var(--text)] border-[var(--border)] hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  <Wallet className="w-3.5 h-3.5" />
                  <span>Nagad</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('bank')}
                  className={`p-2 rounded-xl border font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                    paymentMethod === 'bank'
                      ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-xs'
                      : 'bg-[var(--surface-sunken)] text-[var(--text)] border-[var(--border)] hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  <Landmark className="w-3.5 h-3.5" />
                  <span>Bank</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('card')}
                  className={`p-2 rounded-xl border font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                    paymentMethod === 'card'
                      ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-xs'
                      : 'bg-[var(--surface-sunken)] text-[var(--text)] border-[var(--border)] hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Card</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('split')}
                  className={`p-2 rounded-xl border font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                    paymentMethod === 'split'
                      ? 'bg-[var(--accent-secondary)] text-white border-[var(--accent-secondary)] shadow-xs'
                      : 'bg-[var(--surface-sunken)] text-[var(--text)] border-[var(--border)] hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  <SplitSquareVertical className="w-3.5 h-3.5" />
                  <span>Split / Multi</span>
                </button>
              </div>

              {/* Bank account selector (business / personal) \u2014 single-method Bank only */}
              {paymentMethod === 'bank' && (
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-[var(--text-secondary)]">Bank money goes into:</span>
                    <span className="text-[10px] font-mono text-[var(--text-secondary)]">&#2547;{bankAmount.toLocaleString()}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setBankAccount('acc_bank')}
                      className={`p-1.5 rounded-lg border font-semibold cursor-pointer ${
                        bankAccount === 'acc_bank'
                          ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                          : 'bg-[var(--surface-sunken)] text-[var(--text)] border-[var(--border)] hover:bg-[var(--surface-hover)]'
                      }`}
                    >
                      Business Account
                    </button>
                    <button
                      type="button"
                      onClick={() => setBankAccount('acc_bank_personal')}
                      className={`p-1.5 rounded-lg border font-semibold cursor-pointer ${
                        bankAccount === 'acc_bank_personal'
                          ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                          : 'bg-[var(--surface-sunken)] text-[var(--text)] border-[var(--border)] hover:bg-[var(--surface-hover)]'
                      }`}
                    >
                      Personal Account
                    </button>
                  </div>
                </div>
              )}

              {/* Split / multi-method amount inputs with live Due / Received / Remaining */}
              {paymentMethod === 'split' && (
                <div className="mt-2 space-y-1.5">
                  <div className="bg-[var(--surface-sunken)] p-2 rounded-lg border border-[var(--border)] space-y-1 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)]">Total Due</span>
                      <span className="font-mono font-semibold text-[var(--text)]">&#2547;{finalTotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)]">Received</span>
                      <span className="font-mono font-semibold text-[var(--status-green)]">&#2547;{splitReceived.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span className="text-[var(--text-secondary)]">Remaining Due</span>
                      <span className={`font-mono ${splitRemaining > 0.5 ? 'text-[var(--status-red)]' : 'text-[var(--status-green)]'}`}>
                        &#2547;{splitRemaining.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-[var(--text-secondary)] w-32">Cash</span>
                    <input
                      type="number"
                      min="0"
                      value={cashAmount}
                      onChange={e => setCashAmount(Number(e.target.value))}
                      className="w-28 px-2 py-1 text-right font-mono text-[12px] bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[var(--accent)]"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-[var(--text-secondary)] w-32">bKash</span>
                    <input
                      type="number"
                      min="0"
                      value={bkashAmount}
                      onChange={e => setBkashAmount(Number(e.target.value))}
                      className="w-28 px-2 py-1 text-right font-mono text-[12px] bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[var(--accent)]"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-[var(--text-secondary)] w-32">Nagad</span>
                    <input
                      type="number"
                      min="0"
                      value={nagadAmount}
                      onChange={e => setNagadAmount(Number(e.target.value))}
                      className="w-28 px-2 py-1 text-right font-mono text-[12px] bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[var(--accent)]"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-[var(--text-secondary)] w-32">Bank &#8212; Business Acct</span>
                    <input
                      type="number"
                      min="0"
                      value={businessBankAmount}
                      onChange={e => setBusinessBankAmount(Number(e.target.value))}
                      className="w-28 px-2 py-1 text-right font-mono text-[12px] bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[var(--accent)]"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-[var(--text-secondary)] w-32">Bank &#8212; Personal Acct</span>
                    <input
                      type="number"
                      min="0"
                      value={personalBankAmount}
                      onChange={e => setPersonalBankAmount(Number(e.target.value))}
                      className="w-28 px-2 py-1 text-right font-mono text-[12px] bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[var(--accent)]"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-[var(--text-secondary)] w-32">Card
                      <span className="block text-[9px] text-[var(--text-secondary)]">future use</span>
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={cardAmount}
                      onChange={e => setCardAmount(Number(e.target.value))}
                      className="w-28 px-2 py-1 text-right font-mono text-[12px] bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[var(--accent)]"
                    />
                  </div>
                </div>
              )}

              {/* Transaction ref (bKash/Nagad/Bank/card usually) */}
              {paymentMethod !== 'cash' && paymentMethod !== 'split' && (
                <input
                  type="text"
                  value={transactionRef}
                  onChange={e => setTransactionRef(e.target.value)}
                  placeholder="Transaction ID / Reference (optional)"
                  className="mt-1.5 w-full px-2.5 py-1.5 text-[11px] font-mono bg-[var(--surface-sunken)] border border-[var(--border)] rounded-xl focus:outline-hidden focus:ring-1 focus:ring-[var(--accent)]"
                />
              )}
            </div>

            {/* Total & Discount */}
            <div className="bg-[var(--surface-sunken)] p-3 rounded-xl border border-[var(--border)] space-y-1.5 text-[12px]">
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Subtotal:</span>
                <span className="font-mono font-semibold text-[var(--text)]">&#2547;{subtotal.toLocaleString()}</span>
              </div>
              {itemDiscountTotal > 0 && (
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Item Discounts:</span>
                  <span className="font-mono font-semibold text-[var(--status-red)]">-&#2547;{itemDiscountTotal.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between items-center gap-2">
                <span className="text-[var(--text-secondary)]">Order Discount:</span>
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-hidden">
                    <button
                      type="button"
                      onClick={() => { setOrderDiscountMode('amount'); }}
                      className={`px-2 py-0.5 text-[10px] font-bold cursor-pointer ${orderDiscountMode === 'amount' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)]'}`}
                    >
                      &#2547;
                    </button>
                    <button
                      type="button"
                      onClick={() => { setOrderDiscountMode('percent'); }}
                      className={`px-2 py-0.5 text-[10px] font-bold flex items-center gap-0.5 cursor-pointer ${orderDiscountMode === 'percent' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)]'}`}
                    >
                      <Percent className="w-3 h-3" />%
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      value={orderDiscount}
                      onChange={e => setOrderDiscount(Number(e.target.value))}
                      className="w-16 px-2 py-0.5 text-right font-mono font-semibold bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[12px] text-[var(--status-red)]"
                    />
                    {orderDiscountMode === 'percent' ? (
                      <span className="text-[10px] text-[var(--text-secondary)]">%</span>
                    ) : null}
                  </div>
                </div>
              </div>
              {orderDiscountMode === 'percent' && orderDiscount > 0 && (
                <div className="flex justify-between text-[11px]">
                  <span className="text-[var(--text-secondary)]">= &#2547;{(subtotal - itemDiscountTotal) * (orderDiscount / 100)} off</span>
                </div>
              )}
              <div className="border-t border-[var(--border)] pt-1.5 flex justify-between items-center text-[13px] font-bold text-[var(--accent)]">
                <span>Total Due:</span>
                <span className="font-mono text-[14px]">&#2547;{finalTotal.toLocaleString()}</span>
              </div>
            </div>

            {/* Complete Sale Button */}
            <button
              type="button"
              onClick={handleCheckout}
              disabled={isSubmitting || cart.length === 0}
              className="w-full py-2.5 bg-[var(--accent)] text-white text-[13px] font-semibold rounded-xl hover:opacity-90 shadow-xs transition-opacity cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? 'Processing...' : wholesaleMode ? `Complete Wholesale Sale (\u09F3${finalTotal.toLocaleString()})` : `Complete Sale (\u09F3${finalTotal.toLocaleString()})`}
            </button>
          </div>
        </div>
      </div>

      {/* Invoice Modal for Walk-in POS */}
      {completedOrder && (
        <InvoiceModal
          order={completedOrder}
          isOpen={showInvoiceModal}
          onClose={() => {
            setShowInvoiceModal(false);
            setCompletedOrder(null);
          }}
        />
      )}

      {/* Wholesale mode confirmation \u2014 switching Retail \u2192 Wholesale is deliberate */}
      {confirmWholesale && (
        <Modal
          isOpen={true}
          onClose={() => setConfirmWholesale(false)}
          title="Enable Wholesale Sale?"
          size="sm"
        >
          <div className="space-y-4 p-2">
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-10 h-10 rounded-full bg-[var(--accent-secondary)]/15 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-[var(--accent-secondary)]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--text)]">Wholesale pricing will apply</p>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed mt-1.5">
                  Each product's own wholesale rule will be used in this sale. Products with a{' '}
                  <strong>separate wholesale price</strong> use that lower rate; products set to{' '}
                  <strong>Same as Retail</strong> keep their retail price. The invoice will be marked as a
                  Wholesale supply invoice.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmWholesale(false)}
                className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--text)]"
              >
                Keep Retail
              </button>
              <button
                type="button"
                onClick={() => {
                  setSaleMode(true);
                  setConfirmWholesale(false);
                }}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[var(--accent-secondary)]"
              >
                Yes, Wholesale Sale
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
