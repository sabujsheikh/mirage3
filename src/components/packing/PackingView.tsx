import React, { useState, useRef, useEffect } from 'react';
import {
  Package,
  Scan,
  CheckCircle2,
  AlertCircle,
  Truck,
  Printer,
  Clock,
  Check,
  Search,
  ShieldCheck,
  Volume2,
  VolumeX,
  FileText,
  AlertTriangle,
  Gift,
  Scale,
  Box,
  Send,
  BadgeCheck,
  ClipboardCheck,
  Tag,
  Building2,
  MapPin,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Order, OrderItem } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { InvoiceModal } from '../orders/InvoiceModal';
import { ShippingLabelModal } from './ShippingLabelModal';
import { MerchantStickerModal } from './MerchantStickerModal';
import { AddressStickerModal } from './AddressStickerModal';
import { sound } from '../../lib/audio';

// Physical handoff stages for a packed order (Section 9/11): packed ->
// booked (label pending) -> label printed (awaiting dispatch) -> ready.
type packingStage = 'packed' | 'booked' | 'label_printed' | 'instant_ready' | 'ready';

export const PackingView: React.FC = () => {
  const { orders, packOrder, bookCourier, recordLabelPrinted, verifyTrackingBarcode, dispatchOrder } = useApp();
  const { currentUser, can } = useAuth();

  const [activeTab, setActiveTab] = useState<'station' | 'handoff'>('station');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [scanInput, setScanInput] = useState<string>('');
  const [scannedItems, setScannedItems] = useState<Record<string, number>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // QA Checklist state
  const [bubbleWrapChecked, setBubbleWrapChecked] = useState<boolean>(true);
  const [fragileStickerChecked, setFragileStickerChecked] = useState<boolean>(true);
  const [freeGiftChecked, setFreeGiftChecked] = useState<boolean>(false);
  const [packageWeight, setPackageWeight] = useState<number>(450);
  const [boxSize, setBoxSize] = useState<string>('Medium Box');
  const [qaNotes, setQaNotes] = useState<string>('');

  // Modals
  const [showInvoiceModal, setShowInvoiceModal] = useState<boolean>(false);
  const [showShippingLabelModal, setShowShippingLabelModal] = useState<boolean>(false);
  const [labelOrder, setLabelOrder] = useState<Order | null>(null);
  const [showMerchantStickerModal, setShowMerchantStickerModal] = useState<boolean>(false);
  const [merchantStickerOrder, setMerchantStickerOrder] = useState<Order | null>(null);
  const [showAddressStickerModal, setShowAddressStickerModal] = useState<boolean>(false);
  const [addressStickerOrder, setAddressStickerOrder] = useState<Order | null>(null);

  const handleOpenMerchantSticker = (order: Order) => {
    setMerchantStickerOrder(order);
    setShowMerchantStickerModal(true);
  };

  const handleOpenAddressSticker = (order: Order) => {
    setAddressStickerOrder(order);
    setShowAddressStickerModal(true);
  };

  // Dispatch / Courier Handoff Tab state
  const [dispatchSearch, setDispatchSearch] = useState<string>('');
  const [selectedForBatchDispatch, setSelectedForBatchDispatch] = useState<string[]>([]);
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);
  const [flowMsg, setFlowMsg] = useState<string | null>(null);
  const [trackErrorMsg, setTrackErrorMsg] = useState<string | null>(null);
  // Per-order manual tracking scan input (keyed by order id)
  const [trackScanInputs, setTrackScanInputs] = useState<Record<string, string>>({});

  const barcodeInputRef = useRef<HTMLInputElement | null>(null);

  // Filter queues
  const pendingOrders = orders.filter(o => o.status === 'confirmed');
  const packedOrders = orders.filter(o => o.status === 'packed');

  // Classify each packed order's physical handoff stage (Section 9/11)
  // packed (not booked) -> booked/label pending -> label printed ->
  // tracking verified -> ready to dispatch
  const stageOf = (o: Order): packingStage => {
    if (o.fulfillment_method === 'instant_delivery') return 'instant_ready';
    if (!o.courier_booked) return 'packed';
    if (!o.label_printed) return 'booked';
    if (!o.tracking_verified) return 'label_printed';
    return 'ready';
  };

  const filteredPending = pendingOrders.filter(o => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      o.invoice_number.toLowerCase().includes(q) ||
      o.customer_name.toLowerCase().includes(q) ||
      o.customer_phone.includes(q)
    );
  });

  const filteredPacked = packedOrders.filter(o => {
    if (!dispatchSearch) return true;
    const q = dispatchSearch.toLowerCase();
    return (
      o.invoice_number.toLowerCase().includes(q) ||
      o.customer_name.toLowerCase().includes(q) ||
      o.customer_phone.includes(q) ||
      (o.courier_tracking_code && o.courier_tracking_code.toLowerCase().includes(q))
    );
  });

  useEffect(() => {
    if (selectedOrder) {
      barcodeInputRef.current?.focus();
      // Initialize scan counts
      setScannedItems({});
      setErrorMsg(null);
      setSuccessMsg(null);
      // Auto estimate weight based on bottle count: ~350g bottle + 100g box
      const totalBottles = selectedOrder.items.reduce((s, i) => s + i.quantity, 0);
      setPackageWeight(totalBottles * 350 + 100);
      setBoxSize(totalBottles === 1 ? 'Small Box (100ml)' : totalBottles <= 3 ? 'Medium Box' : 'Large Gift Box');
      setFreeGiftChecked(selectedOrder.total >= 5000 || Boolean(selectedOrder.testers && selectedOrder.testers.length > 0));
    }
  }, [selectedOrder]);

  const handleSelectOrder = (order: Order) => {
    setSelectedOrder(order);
  };

  const handleScanBarcode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanInput.trim()) return;

    const trimmed = scanInput.trim().toUpperCase();

    // 1. If scan matches an invoice number or order barcode, switch to that order
    const matchedOrder = pendingOrders.find(
      o => o.invoice_number.toUpperCase() === trimmed || o.order_barcode?.toUpperCase() === trimmed
    );
    if (matchedOrder) {
      setSelectedOrder(matchedOrder);
      sound.playSuccessBeep();
      setSuccessMsg(`Loaded Order ${matchedOrder.invoice_number} from scanner!`);
      setScanInput('');
      return;
    }

    if (!selectedOrder) {
      setErrorMsg(`Scanned "${scanInput}". Please select an order first or scan an Invoice Barcode.`);
      sound.playErrorBuzzer();
      setScanInput('');
      return;
    }

    // 2. Match item in selected order
    const matchedItem = selectedOrder.items.find(
      it =>
        it.barcode.toUpperCase() === trimmed ||
        it.sku.toUpperCase() === trimmed ||
        it.product_name.toUpperCase().includes(trimmed)
    );

    if (matchedItem) {
      const currentCount = scannedItems[matchedItem.product_id] || 0;
      if (currentCount + 1 > matchedItem.quantity) {
        setErrorMsg(`All ${matchedItem.quantity} unit(s) of ${matchedItem.product_name} are already scanned!`);
        sound.playErrorBuzzer();
      } else {
        const newCount = currentCount + 1;
        setScannedItems(prev => ({
          ...prev,
          [matchedItem.product_id]: newCount,
        }));
        setErrorMsg(null);
        sound.playSuccessBeep();

        // Check if this completes all items
        const allCompleted = selectedOrder.items.every(it => {
          const count = it.product_id === matchedItem.product_id ? newCount : (scannedItems[it.product_id] || 0);
          return count >= it.quantity;
        });

        if (allCompleted) {
          setSuccessMsg(`All ${selectedOrder.items.length} items verified! Ready to seal.`);
        }
      }
    } else {
      setErrorMsg(`Barcode "${scanInput}" does not match any perfume in Order #${selectedOrder.invoice_number}!`);
      sound.playErrorBuzzer();
    }

    setScanInput('');
    barcodeInputRef.current?.focus();
  };

  const isOrderFullyScanned =
    selectedOrder &&
    selectedOrder.items.every(it => (scannedItems[it.product_id] || 0) >= it.quantity);

  const handleCompletePacking = async () => {
    if (!selectedOrder) return;
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const packed = await packOrder(selectedOrder.id, {
        package_weight_grams: packageWeight,
        box_size: boxSize,
        qa_notes: qaNotes || undefined,
      });

      sound.playSuccessBeep();
      setSuccessMsg(`Order ${selectedOrder.invoice_number} successfully verified, stock deducted & marked PACKED!`);

      setTimeout(() => {
        setSelectedOrder(null);
        setSuccessMsg(null);
      }, 800);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to complete packing');
      sound.playErrorBuzzer();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSupervisorOverride = () => {
    if (!selectedOrder) return;
    if (confirm(`Supervisor Override: Mark all items verified for Order ${selectedOrder.invoice_number}?`)) {
      const autoScanned: Record<string, number> = {};
      selectedOrder.items.forEach(it => {
        autoScanned[it.product_id] = it.quantity;
      });
      setScannedItems(autoScanned);
      sound.playSuccessBeep();
      setSuccessMsg('Supervisor override applied. All items marked as verified.');
    }
  };

  // ---- Courier Handoff workflow handlers (Section 9/11) ----
  const handleBook = async (order: Order) => {
    setDispatchingId(order.id);
    try {
      const updated = await bookCourier(order.id);
      sound.playSuccessBeep();
      setFlowMsg(`Order ${order.invoice_number} booked with Steadfast (Consignment #${updated.courier_consignment_id}, Tracking: ${updated.courier_tracking_code}). Now print & attach the 4x6 thermal label.`);
    } catch (err: any) {
      alert(err.message || 'Booking failed');
      sound.playErrorBuzzer();
    } finally {
      setDispatchingId(null);
    }
  };

  const handlePrintLabel = (order: Order) => {
    // Block printing unless the order has a real Steadfast consignment/tracking id
    if (!order.courier_booked || !order.courier_tracking_code) {
      alert(`Book this order with Steadfast first \u2014 no tracking ID available yet to print on the thermal label.\n\nOrder: ${order.invoice_number}`);
      return;
    }
    setLabelOrder(order);
    setShowShippingLabelModal(true);
  };

  // Called once the label has actually been printed/attached via the modal.
  const handleLabelPrinted = async (order: Order) => {
    setDispatchingId(order.id);
    try {
      await recordLabelPrinted(order.id);
      sound.playSuccessBeep();
      setFlowMsg(`Order ${order.invoice_number}: thermal label marked printed & attached. Scan the consignment/tracking barcode on the label to verify, then dispatch.`);
    } catch (err: any) {
      alert(err.message || 'Failed to record label print');
      sound.playErrorBuzzer();
    } finally {
      setDispatchingId(null);
    }
  };

  const handleVerifyTracking = async (order: Order, scannedBarcode: string) => {
    if (!scannedBarcode.trim()) return;
    setDispatchingId(order.id);
    try {
      const updated = await verifyTrackingBarcode(order.id, scannedBarcode.trim());
      sound.playSuccessBeep();
      setFlowMsg(`Order ${order.invoice_number}: tracking barcode "${updated.courier_tracking_code}" verified. Ready to dispatch.`);
    } catch (err: any) {
      // A wrong barcode is rejected \u2014 order stays in Packing (Section 9/11)
      setTrackErrorMsg(err.message || 'Tracking verification failed');
      sound.playErrorBuzzer();
    } finally {
      setDispatchingId(null);
    }
  };

  const handleDispatch = async (order: Order) => {
    setDispatchingId(order.id);
    try {
      const updated = await dispatchOrder(order.id);
      sound.playSuccessBeep();
      setFlowMsg(`Order ${order.invoice_number} dispatched (${updated.courier_tracking_code}). Removed from the Packing queue \u2014 further tracking from Steadfast.`);
    } catch (err: any) {
      alert(err.message || 'Dispatch failed');
      sound.playErrorBuzzer();
    } finally {
      setDispatchingId(null);
    }
  };

  const handleBatchDispatch = async () => {
    if (selectedForBatchDispatch.length === 0) return;
    if (!confirm(`Dispatch all ${selectedForBatchDispatch.length} selected parcel(s)? Only fully booked + label-printed + verified orders can be dispatched.`)) return;

    for (const orderId of selectedForBatchDispatch) {
      try {
        await dispatchOrder(orderId);
      } catch (err: any) {
        console.error('Failed to dispatch order:', orderId, err);
        alert(`Failed to dispatch order ${orderId}: ${err.message}`);
      }
    }
    setSelectedForBatchDispatch([]);
    sound.playSuccessBeep();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-[var(--accent)] text-white flex items-center justify-center font-bold shadow-xs">
            <Package className="w-6 h-6 text-[var(--accent-secondary)]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-[var(--accent)]">Packing & Dispatch Station</h1>
              <span className="px-2 py-0.5 bg-[var(--accent)]/10 text-[var(--accent)] text-[10px] font-bold rounded uppercase">
                Tier 4 Restricted UI
              </span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Hands-free barcode scan verification &#8226; Physical on-hand stock deduction &#8226; Delivery handoff
            </p>
          </div>
        </div>

        {/* Tab Switcher & Live Indicators */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('station')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'station'
                ? 'bg-[var(--accent)] text-white shadow-xs'
                : 'bg-[var(--surface-sunken)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            <Scan className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
            <span>Packing Station ({pendingOrders.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('handoff')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'handoff'
                ? 'bg-[var(--accent)] text-white shadow-xs'
                : 'bg-[var(--surface-sunken)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            <Truck className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
            <span>Courier Handoff ({packedOrders.length})</span>
          </button>
        </div>
      </div>

      {activeTab === 'station' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Queue of Confirmed Orders */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs font-bold text-[var(--text)] uppercase tracking-wider">
                    Orders Awaiting Packing
                  </h3>
                  <span className="w-2 h-2 rounded-full bg-[var(--status-green)] animate-pulse" title="Live Broadcast Listening" />
                </div>
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 bg-[var(--status-amber)]/10 text-[var(--status-amber)] rounded">
                  {pendingOrders.length} Pending
                </span>
              </div>

              {/* Search in queue */}
              <div className="relative mb-3">
                <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search invoice, customer, phone..."
                  className="w-full pl-8 pr-3 py-2 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg focus:border-[var(--accent)] focus:outline-hidden"
                />
              </div>

              {/* Queue List */}
              <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
                {filteredPending.length === 0 ? (
                  <div className="p-8 text-center bg-[var(--surface-sunken)] rounded-lg border border-dashed border-[var(--border)]">
                    <Package className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2" />
                    <p className="text-xs font-semibold text-[var(--text-secondary)]">All orders are packed!</p>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                      New Messenger & Walk-in orders will pop up here live.
                    </p>
                  </div>
                ) : (
                  filteredPending.map(order => {
                    const isSelected = selectedOrder?.id === order.id;
                    const totalBottles = order.items.reduce((s, i) => s + i.quantity, 0);

                    return (
                      <button
                        key={order.id}
                        type="button"
                        onClick={() => handleSelectOrder(order)}
                        className={`w-full p-3.5 text-left rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                          isSelected
                            ? 'bg-[var(--accent)]/5 border-[var(--accent)] shadow-sm'
                            : 'bg-[var(--card)] border-[var(--border)] hover:border-[var(--accent)]/40 hover:bg-[var(--surface-sunken)]/80'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-black text-xs text-[var(--accent)]">
                            {order.invoice_number}
                          </span>
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-[color-mix(in_srgb,var(--status-teal)_10%,transparent)] text-[var(--status-teal)] rounded border border-[color-mix(in_srgb,var(--status-teal)_25%,transparent)]">
                            {order.fulfillment_method === 'steadfast' ? 'Steadfast COD' : order.fulfillment_method === 'instant_delivery' ? `Instant \u2022 ${order.instant_delivery_provider || 'rider'}` : order.fulfillment_method}
                          </span>
                        </div>

                        {order.order_type === 'merchant_fulfillment' && (
                          <div className="mt-1 flex items-center gap-1">
                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 rounded border border-emerald-500/30 flex items-center gap-1">
                              <Building2 className="w-2.5 h-2.5" />
                              Merchant{order.merchant_name ? `: ${order.merchant_name}` : ''}
                            </span>
                          </div>
                        )}

                        <div className="text-xs font-bold text-[var(--text)] mt-1.5">{order.customer_name}</div>
                        <div className="text-[11px] text-[var(--text-secondary)] font-mono mt-0.5">{order.customer_phone}</div>

                        <div className="text-[11px] text-[var(--text-secondary)] line-clamp-1 mt-1 bg-[var(--surface-sunken)] p-1.5 rounded border border-[var(--border)]/60">
                          {order.delivery_address_text || 'Shop pickup'}
                        </div>

                        {/* Clearly Highlighted PACKING NOTE for Packing Team */}
                        {order.packing_note && (
                          <div className="mt-2 p-2 rounded-lg bg-[color-mix(in_srgb,var(--status-amber)_15%,var(--surface))] border border-[color-mix(in_srgb,var(--status-amber)_40%,transparent)] text-xs text-left">
                            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-[var(--status-amber)]">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-[var(--status-amber)]" />
                              <span>PACKING NOTE</span>
                            </div>
                            <p className="mt-1 text-[11px] font-bold text-[var(--text)] whitespace-pre-wrap leading-tight">
                              {order.packing_note}
                            </p>
                          </div>
                        )}

                        {/* Free Samples / Testers Tag on Card */}
                        {order.testers && order.testers.length > 0 && (
                          <div className="mt-1.5 flex items-center gap-1">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[color-mix(in_srgb,var(--status-green)_12%,var(--surface))] border border-[color-mix(in_srgb,var(--status-green)_30%,transparent)] text-[var(--status-green)] flex items-center gap-1">
                              <Gift className="w-3 h-3 text-[var(--status-green)]" />
                              <span>{order.testers.reduce((s, t) => s + t.quantity, 0)} Sample(s) to Pack</span>
                            </span>
                          </div>
                        )}

                        <div className="mt-2.5 pt-2 border-t border-[var(--border)] flex items-center justify-between text-xs">
                          <span className="font-mono font-semibold text-[var(--text)]">
                            {totalBottles} bottle(s)
                          </span>
                          <span className="font-mono font-black text-[var(--accent)]">
                            &#2547;{order.total.toLocaleString()}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Right: Active Packing Verification Station */}
          <div className="lg:col-span-7 space-y-4">
            {selectedOrder ? (
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 shadow-xs space-y-5">
                {/* Station Top Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[var(--border)] pb-4 gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black uppercase text-[var(--accent-secondary)] tracking-wider">
                        ACTIVE VERIFICATION STATION
                      </span>
                      <span className="text-[10px] font-mono bg-[var(--surface-sunken)] px-2 py-0.5 rounded text-[var(--text-secondary)]">
                        {selectedOrder.invoice_number}
                      </span>
                    </div>
                    <h3 className="text-base font-black text-[var(--accent)] mt-0.5">
                      {selectedOrder.customer_name}
                    </h3>
                    {selectedOrder.order_type === 'merchant_fulfillment' && (
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 inline-flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          Merchant: {selectedOrder.merchant_name || 'Dropship Merchant'}
                        </span>
                        {selectedOrder.merchant_id && (
                          <span className="text-[10px] font-mono bg-[var(--surface-sunken)] px-1.5 py-0.5 rounded border border-[var(--border)] text-[var(--text-secondary)]">
                            MID: {selectedOrder.merchant_id}
                          </span>
                        )}
                        {selectedOrder.parcel_id && (
                          <span className="text-[10px] font-mono bg-[var(--surface-sunken)] px-1.5 py-0.5 rounded border border-[var(--border)] text-[var(--text-secondary)]">
                            Parcel: {selectedOrder.parcel_id}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="text-xs text-[var(--text-secondary)] font-mono mt-0.5">
                      {selectedOrder.customer_phone} &#8226; COD Total: &#2547;{selectedOrder.total.toLocaleString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedOrder.order_type === 'merchant_fulfillment' && (
                      <button
                        onClick={() => handleOpenMerchantSticker(selectedOrder)}
                        className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 text-xs font-bold text-emerald-700 dark:text-emerald-300 rounded-lg hover:bg-emerald-500/20 flex items-center gap-1.5 cursor-pointer shadow-xs"
                        title="Print Dropship Fulfillment Thermal Sticker (Does not reveal internal SKU or pricing)"
                      >
                        <Tag className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Merchant Sticker</span>
                      </button>
                    )}

                    {selectedOrder.order_type !== 'merchant_fulfillment' && (
                      <button
                        onClick={() => setShowInvoiceModal(true)}
                        className="px-3 py-1.5 bg-[var(--surface-sunken)] border border-[var(--border)] text-xs font-bold text-[var(--text)] rounded-lg hover:bg-[var(--surface-hover)] flex items-center gap-1.5 cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>View Invoice</span>
                      </button>
                    )}

                    <button
                      onClick={handleSupervisorOverride}
                      className="px-3 py-1.5 bg-[color-mix(in_srgb,var(--status-amber)_10%,transparent)] border border-[color-mix(in_srgb,var(--status-amber)_25%,transparent)] text-xs font-bold text-[var(--status-amber)] rounded-lg hover:bg-[color-mix(in_srgb,var(--status-amber)_16%,transparent)] flex items-center gap-1.5 cursor-pointer"
                      title="Mark all items verified without physical scanning"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-[var(--status-amber)]" />
                      <span>Override</span>
                    </button>
                  </div>
                </div>

                {/* Prominently Highlighted PACKING NOTE for Active Order (Section 10/11) */}
                {selectedOrder.packing_note && (
                  <div className="p-3.5 bg-[color-mix(in_srgb,var(--status-amber)_15%,var(--surface))] border-2 border-[var(--status-amber)] rounded-xl space-y-1 animate-in fade-in">
                    <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-[var(--status-amber)]">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-[var(--status-amber)]" />
                      <span>PACKING NOTE — SPECIAL ATTENTION REQUIRED</span>
                    </div>
                    <p className="text-xs font-bold text-[var(--text)] whitespace-pre-wrap leading-relaxed pl-5.5">
                      {selectedOrder.packing_note}
                    </p>
                  </div>
                )}

                {/* Notifications & Audio Status */}
                {errorMsg && (
                  <div className="p-3.5 bg-[color-mix(in_srgb,var(--status-red)_10%,transparent)] text-[var(--status-red)] border border-[color-mix(in_srgb,var(--status-red)_25%,transparent)] rounded-lg text-xs font-bold flex items-center gap-2 animate-shake">
                    <AlertCircle className="w-4 h-4 shrink-0 text-[var(--status-red)]" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {successMsg && (
                  <div className="p-3.5 bg-[color-mix(in_srgb,var(--status-green)_10%,transparent)] text-[var(--status-green)] border border-[color-mix(in_srgb,var(--status-green)_25%,transparent)] rounded-lg text-xs font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-[var(--status-green)]" />
                    <span>{successMsg}</span>
                  </div>
                )}

                {/* Hands-free Barcode Scanner Input */}
                <form onSubmit={handleScanBarcode} className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-[var(--text-secondary)]">
                    <span className="flex items-center gap-1 uppercase tracking-wider text-[var(--accent)]">
                      <Scan className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
                      BARCODE SCAN GUN INPUT (AUTO-FOCUSED)
                    </span>
                    <span className="text-[var(--text-muted)] font-normal">
                      Scan bottle barcode or SKU code
                    </span>
                  </div>

                  <div className="relative">
                    <input
                      ref={barcodeInputRef}
                      type="text"
                      value={scanInput}
                      onChange={e => setScanInput(e.target.value)}
                      placeholder="Ready for barcode scanner trigger..."
                      className="w-full pl-4 pr-24 py-3 text-sm font-mono font-black bg-[var(--surface-sunken)] border-2 border-[var(--accent)] rounded-xl focus:bg-[var(--card)] focus:ring-2 focus:ring-[var(--accent)]/20 focus:outline-hidden"
                    />
                    <button
                      type="submit"
                      className="absolute right-2 top-2 px-4 py-1.5 bg-[var(--accent)] text-white text-xs font-bold rounded-lg hover:opacity-90 cursor-pointer shadow-xs"
                    >
                      Scan Match
                    </button>
                  </div>
                </form>

                {/* Line Items Checklist */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold uppercase text-[var(--text)]">
                    <span>Bottles to Verify ({selectedOrder.items.length} unique SKU)</span>
                    <span className="font-mono text-[var(--accent)]">
                      {(Object.values(scannedItems) as number[]).reduce((s, c) => s + c, 0)} /{' '}
                      {selectedOrder.items.reduce((s, i) => s + i.quantity, 0)} Units Scanned
                    </span>
                  </div>

                  <div className="border border-[var(--border)] rounded-xl overflow-hidden divide-y divide-[var(--border)]">
                    {selectedOrder.items.map((it, idx) => {
                      const scanned = scannedItems[it.product_id] || 0;
                      const isMatched = scanned >= it.quantity;

                      return (
                        <div
                          key={idx}
                          className={`p-3.5 flex items-center justify-between text-xs transition-colors ${
                            isMatched ? 'bg-[color-mix(in_srgb,var(--status-green)_8%,var(--surface))] border-l-4 border-l-[var(--status-green)]' : 'bg-[var(--card)]'
                          }`}
                        >
                          <div className="pr-4">
                            <div className="font-bold text-[var(--text)] text-sm">{it.product_name}</div>
                            <div className="font-mono text-[11px] text-[var(--text-secondary)] mt-0.5 flex items-center gap-2">
                              <span>SKU: <strong className="text-[var(--text)]">{it.sku}</strong></span>
                              <span>&#8226;</span>
                              <span>Barcode: <strong className="text-[var(--text)]">{it.barcode}</strong></span>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 shrink-0">
                            <div className="text-right">
                              <span className="font-mono font-black text-base text-[var(--accent)]">
                                {scanned} / {it.quantity}
                              </span>
                              <span className="text-[10px] text-[var(--text-secondary)] block uppercase">verified</span>
                            </div>

                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold transition-transform ${
                                isMatched
                                  ? 'bg-[var(--status-green)] text-white shadow-xs scale-105'
                                  : 'bg-[var(--surface-hover)] text-[var(--text-muted)]'
                              }`}
                            >
                              <Check className="w-4 h-4 stroke-[3]" />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Free Testers / Samples to Pack */}
                {selectedOrder.testers && selectedOrder.testers.length > 0 && (
                  <div className="p-3.5 bg-[color-mix(in_srgb,var(--status-green)_10%,var(--surface))] border-2 border-[var(--status-green)]/40 rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold uppercase text-[var(--status-green)]">
                      <div className="flex items-center gap-1.5">
                        <Gift className="w-4 h-4 text-[var(--status-green)]" />
                        <span>Include Free Testers / Samples ({selectedOrder.testers.length} items)</span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-[var(--surface)] border border-[color-mix(in_srgb,var(--status-green)_30%,transparent)] rounded text-[var(--status-green)]">
                        NO SCAN REQUIRED — INCLUDE IN PARCEL
                      </span>
                    </div>
                    <div className="divide-y divide-[var(--border)] border border-[var(--border)] rounded-lg bg-[var(--card)]">
                      {selectedOrder.testers.map((t, idx) => (
                        <div key={idx} className="p-2.5 flex items-center justify-between text-xs">
                          <div>
                            <div className="font-bold text-[var(--text)] flex items-center gap-1.5">
                              <span>{t.product_name}</span>
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-[color-mix(in_srgb,var(--status-green)_15%,var(--surface))] text-[var(--status-green)] border border-[color-mix(in_srgb,var(--status-green)_30%,transparent)]">
                                FREE TESTER
                              </span>
                            </div>
                            <div className="text-[10px] font-mono text-[var(--text-secondary)] mt-0.5">
                              {t.sku ? `SKU: ${t.sku}` : 'Complimentary Sample Vial'}
                            </div>
                          </div>
                          <div className="font-mono font-bold text-xs bg-[var(--surface-sunken)] px-3 py-1 rounded-md border border-[var(--border)] text-[var(--text)]">
                            Qty: {t.quantity}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Packaging QA Checklist & Dimensions */}
                <div className="p-4 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-xl space-y-3">
                  <div className="text-xs font-bold uppercase text-[var(--text)] flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-[var(--accent)]" />
                    <span>Packaging QA & Dispatch Checklist</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <label className="flex items-center gap-2 bg-[var(--card)] p-2.5 border border-[var(--border)] rounded-lg text-xs font-semibold cursor-pointer hover:bg-[var(--surface-sunken)]">
                      <input
                        type="checkbox"
                        checked={bubbleWrapChecked}
                        onChange={e => setBubbleWrapChecked(e.target.checked)}
                        className="rounded text-[var(--accent)] focus:ring-0"
                      />
                      <span>Double Bubble Wrap</span>
                    </label>

                    <label className="flex items-center gap-2 bg-[var(--card)] p-2.5 border border-[var(--border)] rounded-lg text-xs font-semibold cursor-pointer hover:bg-[var(--surface-sunken)]">
                      <input
                        type="checkbox"
                        checked={fragileStickerChecked}
                        onChange={e => setFragileStickerChecked(e.target.checked)}
                        className="rounded text-[var(--accent)] focus:ring-0"
                      />
                      <span>Fragile Glass Sticker</span>
                    </label>

                    <label className="flex items-center gap-2 bg-[var(--card)] p-2.5 border border-[var(--border)] rounded-lg text-xs font-semibold cursor-pointer hover:bg-[var(--surface-sunken)]">
                      <input
                        type="checkbox"
                        checked={freeGiftChecked}
                        onChange={e => setFreeGiftChecked(e.target.checked)}
                        className="rounded text-[var(--accent)] focus:ring-0"
                      />
                      <span className="flex items-center gap-1">
                        <Gift className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
                        <span>Tester / Sample Vial</span>
                      </span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-[var(--text-secondary)] mb-1">
                        Parcel Weight (Grams)
                      </label>
                      <div className="relative">
                        <Scale className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-2.5" />
                        <input
                          type="number"
                          value={packageWeight}
                          onChange={e => setPackageWeight(Number(e.target.value))}
                          className="w-full pl-8 pr-3 py-1.5 text-xs font-mono font-bold bg-[var(--card)] border border-[var(--border)] rounded-lg focus:border-[var(--accent)] focus:outline-hidden"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase text-[var(--text-secondary)] mb-1">
                        Box Size
                      </label>
                      <select
                        value={boxSize}
                        onChange={e => setBoxSize(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs font-semibold bg-[var(--card)] border border-[var(--border)] rounded-lg focus:border-[var(--accent)] focus:outline-hidden"
                      >
                        <option value="Small Box (100ml)">Small Box (1 Bottle)</option>
                        <option value="Medium Box">Medium Box (2-3 Bottles)</option>
                        <option value="Large Gift Box">Large Box / Gift Combo</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Complete Packing Action */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleCompletePacking}
                    disabled={!isOrderFullyScanned || isSubmitting}
                    className="w-full py-3.5 bg-[var(--accent)] text-white text-sm font-bold rounded-xl hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-[0.99]"
                  >
                    {isSubmitting ? (
                      <span>Deducting Stock & Sealing Parcel...</span>
                    ) : (
                      <>
                        <ShieldCheck className="w-5 h-5 text-[var(--accent-secondary)]" />
                        <span>
                          {isOrderFullyScanned
                            ? 'Deduct Stock, Seal Parcel & Generate Shipping Label'
                            : 'Scan All Bottles to Complete Packing'}
                        </span>
                      </>
                    )}
                  </button>
                  <p className="text-[11px] text-[var(--text-secondary)] text-center mt-2">
                    * Clicking this button deducts on-hand warehouse inventory and prints the Steadfast shipping label.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-16 text-center shadow-xs">
                <div className="w-14 h-14 bg-[var(--surface-sunken)] rounded-full flex items-center justify-center mx-auto mb-3 text-[var(--accent)]">
                  <Scan className="w-7 h-7" />
                </div>
                <h4 className="text-sm font-bold text-[var(--text)]">Packing Station Idle</h4>
                <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto mt-1">
                  Select an order from the queue on the left, or trigger your physical barcode gun on any printed invoice receipt to begin.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Courier Handoff Tab \u2014 booking \u2192 thermal label \u2192 verify \u2192 dispatch */
        <div className="space-y-4">
          {/* Workflow summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Packed</div>
                <span className="w-2 h-2 rounded-full bg-[var(--status-teal)]" />
              </div>
              <div className="text-2xl font-black text-[var(--accent)] font-mono mt-1">
                {packedOrders.filter(o => stageOf(o) === 'packed').length}
              </div>
              <div className="text-[10px] text-[var(--text-muted)]">Awaiting handoff preparation</div>
            </div>
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Booked</div>
                <span className="w-2 h-2 rounded-full bg-[color-mix(in_srgb,var(--status-amber)_10%,transparent)]" />
              </div>
              <div className="text-2xl font-black text-[var(--accent)] font-mono mt-1">
                {packedOrders.filter(o => stageOf(o) === 'booked').length}
              </div>
              <div className="text-[10px] text-[var(--text-muted)]">Label pending</div>
            </div>
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Label Printed</div>
                <span className="w-2 h-2 rounded-full bg-[var(--status-teal)]" />
              </div>
              <div className="text-2xl font-black text-[var(--accent)] font-mono mt-1">
                {packedOrders.filter(o => stageOf(o) === 'label_printed').length}
              </div>
              <div className="text-[10px] text-[var(--text-muted)]">Awaiting tracking verify</div>
            </div>
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Ready to Dispatch</div>
                <span className="w-2 h-2 rounded-full bg-[var(--status-green)]" />
              </div>
              <div className="text-2xl font-black text-[var(--accent)] font-mono mt-1">
                {packedOrders.filter(o => stageOf(o) === 'ready').length}
              </div>
              <div className="text-[10px] text-[var(--text-muted)]">Verified &#8212; can hand over</div>
            </div>
          </div>

          {/* Handoff instructions + flow message */}
          <div className="bg-[var(--accent)] text-white rounded-xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center gap-3">
            <Truck className="w-6 h-6 text-[var(--accent-secondary)] shrink-0" />
            <div className="text-xs leading-relaxed flex-1">
              <span className="font-bold text-[var(--accent-secondary)] mr-1">Physical handoff:</span>
              Steadfast orders require booking, label printing, tracking verification, and dispatch. Instant Delivery orders use an address sticker and are handed to the selected rider service after packing.
            </div>
          </div>

          {flowMsg && (
            <div className="p-3.5 bg-[color-mix(in_srgb,var(--status-green)_10%,transparent)] text-[var(--status-green)] border border-[color-mix(in_srgb,var(--status-green)_25%,transparent)] rounded-lg text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-[var(--status-green)]" />
              <span>{flowMsg}</span>
            </div>
          )}

          {/* Header + batch dispatch */}
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
              <div>
                <h3 className="text-base font-bold text-[var(--accent)]">
                  Steadfast Booked & Packed &#8212; Physical Dispatch Queue
                </h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  Every packed order stays visible here through booking, label, verify & dispatch.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {selectedForBatchDispatch.length > 0 && (
                  <button
                    onClick={handleBatchDispatch}
                    className="px-4 py-2 bg-[var(--accent)] text-white text-xs font-bold rounded-lg hover:opacity-90 cursor-pointer shadow-xs flex items-center gap-1.5"
                  >
                    <Truck className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
                    <span>Dispatch Selected ({selectedForBatchDispatch.length})</span>
                  </button>
                )}
              </div>
            </div>

            {/* Search bar */}
            <div className="relative">
              <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-2.5" />
              <input
                type="text"
                value={dispatchSearch}
                onChange={e => setDispatchSearch(e.target.value)}
                placeholder="Search packed parcels by invoice, recipient, or tracking code..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg focus:border-[var(--accent)] focus:outline-hidden"
              />
            </div>

            {/* Stage legend */}
            <div className="flex flex-wrap items-center gap-2 text-[10px] text-[var(--text-secondary)]">
              <span className="px-2 py-0.5 rounded-full bg-[var(--surface-sunken)] border border-[var(--border)] font-bold">Packed</span>
              <span className="px-2 py-0.5 rounded-full bg-[color-mix(in_srgb,var(--status-amber)_10%,transparent)] border border-[color-mix(in_srgb,var(--status-amber)_25%,transparent)] text-[var(--status-amber)] font-bold">Booked / Label Pending</span>
              <span className="px-2 py-0.5 rounded-full bg-[color-mix(in_srgb,var(--status-teal)_10%,transparent)] border border-[color-mix(in_srgb,var(--status-teal)_25%,transparent)] text-[var(--status-teal)] font-bold">Label Printed / Awaiting Dispatch</span>
              <span className="px-2 py-0.5 rounded-full bg-[color-mix(in_srgb,var(--status-green)_10%,transparent)] border border-[color-mix(in_srgb,var(--status-green)_25%,transparent)] text-[var(--status-green)] font-bold">Ready to Dispatch</span>
            </div>

            {/* Table of Packed Orders with stage & actions */}
            <div className="border border-[var(--border)] rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[var(--surface-sunken)] border-b border-[var(--border)] text-[var(--text-secondary)] font-bold uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="p-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={
                            filteredPacked.length > 0 &&
                            selectedForBatchDispatch.length === filteredPacked.length
                          }
                          onChange={e => {
                            if (e.target.checked) {
                              setSelectedForBatchDispatch(filteredPacked.map(o => o.id));
                            } else {
                              setSelectedForBatchDispatch([]);
                            }
                          }}
                          className="rounded text-[var(--accent)]"
                        />
                      </th>
                      <th className="p-2.5">Invoice</th>
                      <th className="p-2.5">Customer</th>
                      <th className="p-2.5">Tracking / Consignment</th>
                      <th className="p-2.5">Handoff Stage</th>
                      <th className="p-2.5 text-right">Total</th>
                      <th className="p-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {filteredPacked.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-[var(--text-secondary)]">
                          No packed parcels in the dispatch queue.
                        </td>
                      </tr>
                    ) : (
                      filteredPacked.map(order => {
                        const stage = stageOf(order);
                        const bookingInProgress = dispatchingId === order.id;
                        const canDispatch = stage === 'ready' || stage === 'instant_ready';
                        const trackInput = trackScanInputs[order.id] || '';
                        return (
                          <tr key={order.id} className="hover:bg-[var(--surface-sunken)]/70 transition-colors align-top">
                            <td className="p-3 text-center">
                              <input
                                type="checkbox"
                                checked={selectedForBatchDispatch.includes(order.id)}
                                disabled={!canDispatch}
                                title={canDispatch ? 'Select to dispatch' : 'Must be booked + label printed + verified first'}
                                onChange={e => {
                                  if (e.target.checked) {
                                    setSelectedForBatchDispatch(prev => [...prev, order.id]);
                                  } else {
                                    setSelectedForBatchDispatch(prev => prev.filter(id => id !== order.id));
                                  }
                                }}
                                className="rounded text-[var(--accent)]"
                              />
                            </td>
                            <td className="p-3">
                              <div className="font-mono font-bold text-[var(--accent)]">{order.invoice_number}</div>
                              <div className="text-[10px] text-[var(--text-muted)] font-mono">
                                {new Date(order.created_at).toLocaleDateString('en-GB')}
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="font-bold text-[var(--text)] flex items-center gap-1.5 flex-wrap">
                                <span>{order.customer_name}</span>
                                {order.order_type === 'merchant_fulfillment' && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 text-[9px] font-bold rounded-full bg-[color-mix(in_srgb,var(--status-purple)_12%,transparent)] text-[var(--status-purple)] border border-[color-mix(in_srgb,var(--status-purple)_30%,transparent)]">
                                    <Building2 className="w-2.5 h-2.5" />
                                    <span>Dropship</span>
                                  </span>
                                )}
                              </div>
                              <div className="font-mono text-[11px] text-[var(--text-secondary)]">{order.customer_phone}</div>
                                {order.order_type === 'merchant_fulfillment' && (order.merchant_name || order.parcel_id) && (
                                  <div className="text-[10px] text-[var(--status-purple)] font-medium mt-0.5">
                                    {order.merchant_name && <span>{order.merchant_name}</span>}
                                    {order.merchant_name && order.parcel_id && <span> &#8226; </span>}
                                    {order.parcel_id && <span className="font-num">PID: {order.parcel_id}</span>}
                                  </div>
                                )}
                                {order.items.length > 0 && (
                                  <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                                    {order.items.reduce((s, i) => s + i.quantity, 0)} item(s) &#8226; {order.packed_by_name || 'Staff'}
                                  </div>
                                )}
                              </td>
                              <td className="p-3">
                                {order.fulfillment_method === 'instant_delivery' ? (
                                  <div>
                                    <div className="font-num font-bold text-[var(--status-teal)]">{order.instant_delivery_provider?.toUpperCase() || 'INSTANT DELIVERY'}</div>
                                    <div className="text-[10px] text-[var(--text-muted)]">No Steadfast consignment</div>
                                  </div>
                                ) : order.courier_tracking_code ? (
                                  <div>
                                    <div className="font-num font-bold text-[var(--status-teal)]">{order.courier_tracking_code}</div>
                                    <div className="text-[10px] text-[var(--text-muted)] font-num">
                                      Consignment: {order.courier_consignment_id || '\u2014'}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-[10px] text-[var(--text-muted)] italic">Not booked yet</div>
                                )}
                              </td>
                              <td className="p-3">
                                {stage === 'packed' && order.fulfillment_method === 'steadfast' && (
                                  <span className="inline-flex items-center font-medium rounded-full border whitespace-nowrap px-2.5 py-1 text-xs bg-[var(--surface-sunken)] border-[var(--border)] text-[var(--text)]">
                                    Packed
                                  </span>
                                )}
                                {stage === 'booked' && (
                                  <span className="inline-flex items-center font-medium rounded-full border whitespace-nowrap px-2.5 py-1 text-xs bg-[color-mix(in_srgb,var(--status-amber)_10%,transparent)] border-[color-mix(in_srgb,var(--status-amber)_30%,transparent)] text-[var(--status-amber)]">
                                    Booked / Label Pending
                                  </span>
                                )}
                                {stage === 'label_printed' && (
                                  <span className="inline-flex items-center font-medium rounded-full border whitespace-nowrap px-2.5 py-1 text-xs bg-[color-mix(in_srgb,var(--status-teal)_10%,transparent)] border-[color-mix(in_srgb,var(--status-teal)_30%,transparent)] text-[var(--status-teal)]">
                                    Label Printed / Awaiting Dispatch
                                  </span>
                                )}
                                {stage === 'instant_ready' && (
                                  <span className="inline-flex items-center font-medium rounded-full border whitespace-nowrap px-2.5 py-1 text-xs bg-[color-mix(in_srgb,var(--status-teal)_10%,transparent)] border-[color-mix(in_srgb,var(--status-teal)_30%,transparent)] text-[var(--status-teal)]">
                                    Instant Delivery / Handoff Ready
                                  </span>
                                )}
                                {stage === 'ready' && (
                                  <span className="inline-flex items-center font-medium rounded-full border whitespace-nowrap px-2.5 py-1 text-xs bg-[color-mix(in_srgb,var(--status-green)_10%,transparent)] border-[color-mix(in_srgb,var(--status-green)_30%,transparent)] text-[var(--status-green)]">
                                    Ready to Dispatch
                                  </span>
                                )}
                                {stage === 'ready' && order.tracking_verified_by && (
                                  <div className="text-[10px] text-[var(--text-muted)] mt-1">
                                    Verified by {order.tracking_verified_by}
                                  </div>
                                )}
                              </td>
                              <td className="p-3 text-right font-num font-black text-[var(--accent)]">
                                &#2547;{order.total.toLocaleString()}
                              </td>
                            <td className="p-3">
                              <div className="flex flex-col gap-1 items-start">
                                {stage === 'packed' && order.fulfillment_method === 'steadfast' && (
                                  <button
                                    onClick={() => handleBook(order)}
                                    disabled={bookingInProgress}
                                    className="px-2.5 py-1 bg-[var(--accent)] hover:opacity-90 text-white text-[11px] font-bold rounded cursor-pointer flex items-center gap-1 disabled:opacity-50"
                                  >
                                    <Send className="w-3 h-3 text-[var(--accent-secondary)]" />
                                    <span>{bookingInProgress ? 'Booking...' : 'Book w/ Steadfast'}</span>
                                  </button>
                                )}

                                {stage === 'instant_ready' && (
                                  <button
                                    onClick={() => handleOpenAddressSticker(order)}
                                    className="px-2.5 py-1 bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] hover:bg-[color-mix(in_srgb,var(--accent)_20%,transparent)] text-[var(--accent)] text-[11px] font-bold rounded cursor-pointer border border-[color-mix(in_srgb,var(--accent)_30%,transparent)] flex items-center gap-1"
                                    title="Print the normal customer address sticker"
                                  >
                                    <MapPin className="w-3 h-3" />
                                    <span>Address Sticker</span>
                                  </button>
                                )}

                                {stage === 'booked' && (
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => handlePrintLabel(order)}
                                      disabled={bookingInProgress}
                                      className="px-2.5 py-1 bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] hover:bg-[color-mix(in_srgb,var(--accent)_20%,transparent)] text-[var(--accent)] text-[11px] font-bold rounded cursor-pointer border border-[color-mix(in_srgb,var(--accent)_30%,transparent)] flex items-center gap-1 disabled:opacity-50"
                                      title="Print & attach the 4x6 thermal label"
                                    >
                                      <Printer className="w-3 h-3" />
                                      <span>Print Label</span>
                                    </button>
                                    <button
                                      onClick={() => handleLabelPrinted(order)}
                                      disabled={bookingInProgress}
                                      className="px-2.5 py-1 bg-[color-mix(in_srgb,var(--status-teal)_10%,transparent)] bg-[color-mix(in_srgb,var(--status-teal)_16%,transparent)] text-[var(--status-teal)] text-[11px] font-bold rounded cursor-pointer border border-[color-mix(in_srgb,var(--status-teal)_25%,transparent)] flex items-center gap-1 disabled:opacity-50"
                                      title="Confirm the thermal label has been printed & attached"
                                    >
                                      <ClipboardCheck className="w-3 h-3" />
                                      <span>Confirm Attached</span>
                                    </button>
                                  </div>
                                )}

                                {(stage === 'label_printed' || stage === 'ready') && (
                                  <div className="w-full flex items-center gap-1">
                                    <input
                                      type="text"
                                      value={trackInput}
                                      onChange={e => setTrackScanInputs(prev => ({ ...prev, [order.id]: e.target.value }))}
                                      disabled={bookingInProgress || stage === 'ready'}
                                      placeholder={stage === 'ready' ? `Verified: ${order.courier_tracking_code}` : 'Scan tracking barcode'}
                                      className="w-40 px-2 py-1 text-[11px] font-mono bg-[var(--surface-sunken)] border border-[var(--border)] rounded focus:border-[var(--accent)] focus:outline-hidden disabled:opacity-60"
                                    />
                                    {stage === 'label_printed' && (
                                      <button
                                        onClick={() => {
                                          handleVerifyTracking(order, trackInput);
                                          setTrackScanInputs(prev => ({ ...prev, [order.id]: '' }));
                                        }}
                                        disabled={bookingInProgress || !trackInput.trim()}
                                        className="px-2 py-1 bg-[var(--status-green)] hover:opacity-90 text-white text-[11px] font-bold rounded cursor-pointer flex items-center gap-1 disabled:opacity-50"
                                        title="Verify scanned tracking barcode belongs to this order"
                                      >
                                        <BadgeCheck className="w-3 h-3" />
                                        <span>Verify</span>
                                      </button>
                                    )}
                                  </div>
                                )}

                                {stage === 'instant_ready' && (
                                  <button
                                    onClick={() => handleOpenAddressSticker(order)}
                                    className="px-2.5 py-1 bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] hover:bg-[color-mix(in_srgb,var(--accent)_20%,transparent)] text-[var(--accent)] text-[11px] font-bold rounded cursor-pointer border border-[color-mix(in_srgb,var(--accent)_30%,transparent)] flex items-center gap-1"
                                    title="Print the normal customer address sticker"
                                  >
                                    <MapPin className="w-3 h-3" />
                                    <span>Address Sticker</span>
                                  </button>
                                )}

                                {canDispatch && (
                                  <button
                                    onClick={() => handleDispatch(order)}
                                    disabled={bookingInProgress}
                                    className="px-2.5 py-1 bg-[var(--status-green)] hover:opacity-90 text-white text-[11px] font-bold rounded cursor-pointer flex items-center gap-1 disabled:opacity-50"
                                  >
                                    <Truck className="w-3 h-3" />
                                    <span>{bookingInProgress ? 'Handing Over...' : stage === 'instant_ready' ? 'Hand Over to Rider' : 'Dispatch'}</span>
                                  </button>
                                )}
                                
                                {order.order_type === 'merchant_fulfillment' && (
                                  <button
                                    onClick={() => handleOpenMerchantSticker(order)}
                                    className="px-2.5 py-1 bg-[color-mix(in_srgb,var(--status-purple)_10%,transparent)] hover:bg-[color-mix(in_srgb,var(--status-purple)_18%,transparent)] text-[var(--status-purple)] text-[11px] font-bold rounded cursor-pointer border border-[color-mix(in_srgb,var(--status-purple)_30%,transparent)] flex items-center gap-1"
                                    title="Print 100x100mm Dropship Fulfillment Thermal Sticker"
                                  >
                                    <Tag className="w-3 h-3" />
                                    <span>Merchant Sticker</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {trackErrorMsg && (
              <div className="p-3.5 bg-[color-mix(in_srgb,var(--status-red)_10%,transparent)] text-[var(--status-red)] border border-[color-mix(in_srgb,var(--status-red)_25%,transparent)] rounded-lg text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-[var(--status-red)]" />
                <span>{trackErrorMsg}</span>
                <button onClick={() => setTrackErrorMsg(null)} className="ml-auto text-[var(--status-red)] hover:text-[var(--status-red)] cursor-pointer text-[11px]">Dismiss</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Invoice Modal */}
      {selectedOrder && (
        <InvoiceModal
          order={selectedOrder}
          isOpen={showInvoiceModal}
          onClose={() => setShowInvoiceModal(false)}
        />
      )}

      {/* 4x6 Thermal Shipping Label Modal */}
      {labelOrder && (
        <ShippingLabelModal
          order={labelOrder}
          isOpen={showShippingLabelModal}
          onPrint={handleLabelPrinted}
          onClose={() => {
            setShowShippingLabelModal(false);
            setLabelOrder(null);
          }}
        />
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

      {addressStickerOrder && (
        <AddressStickerModal
          order={addressStickerOrder}
          isOpen={showAddressStickerModal}
          onClose={() => {
            setShowAddressStickerModal(false);
            setAddressStickerOrder(null);
          }}
        />
      )}
    </div>
  );
};
