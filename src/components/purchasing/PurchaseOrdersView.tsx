import { PageHeader } from '../common/PageHeader';
import React, { useState } from 'react';
import {
  Truck,
  Plus,
  Search,
  Package,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  FileText,
  DollarSign,
  Building2,
  Calendar,
  Layers,
  ArrowRight,
  Printer,
  ChevronRight,
  Eye,
  Percent,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus, CurrencyCode } from '../../types';
import { StatusBadge } from '../common/StatusBadge';

export const PurchaseOrdersView: React.FC = () => {
  const {
    purchaseOrders,
    suppliers,
    products,
    createPurchaseOrder,
    updatePurchaseOrderStatus,
    receivePurchaseOrderItems,
  } = useApp();
  const { can } = useAuth();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showReceiveModal, setShowReceiveModal] = useState<boolean>(false);
  const [receivingPO, setReceivingPO] = useState<PurchaseOrder | null>(null);
  const [receivingQuantities, setReceivingQuantities] = useState<{ [itemId: string]: number }>({});
  const [receiveNotes, setReceiveNotes] = useState<string>('');

  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);

  // Form State for PO Creation
  const [supplierId, setSupplierId] = useState<string>('');
  const [orderDate, setOrderDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [expectedDate, setExpectedDate] = useState<string>('');
  const [targetWarehouseId, setTargetWarehouseId] = useState<string>('wh_shop');
  const [currency, setCurrency] = useState<CurrencyCode>('AED');
  const [exchangeRate, setExchangeRate] = useState<number>(33.0);
  const [freightTotalBdt, setFreightTotalBdt] = useState<number>(0);
  const [customsDutyTotalBdt, setCustomsDutyTotalBdt] = useState<number>(0);
  const [otherCostsBdt, setOtherCostsBdt] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');

  // PO Line Items State
  const [poLines, setPoLines] = useState<{
    product_id: string;
    quantity: number;
    unit_cost_foreign: number;
    unit_cost_bdt: number;
  }[]>([]);

  const [productSearch, setProductSearch] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Filtering
  const filteredPOs = purchaseOrders.filter(po => {
    const matchesSearch =
      po.po_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      po.supplier_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      po.items.some(i => i.product_name.toLowerCase().includes(searchQuery.toLowerCase()) || i.sku.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || po.status === statusFilter;
    const matchesSupplier = supplierFilter === 'all' || po.supplier_id === supplierFilter;
    return matchesSearch && matchesStatus && matchesSupplier;
  });

  // KPIs
  const totalPOValue = purchaseOrders.reduce((s, po) => s + (po.status !== 'cancelled' ? po.total_amount_bdt : 0), 0);
  const openPOCount = purchaseOrders.filter(po => po.status === 'ordered' || po.status === 'partially_received').length;
  const receivedPOCount = purchaseOrders.filter(po => po.status === 'received').length;
  const totalBottlesOrdered = purchaseOrders.reduce((sum, po) => sum + po.items.reduce((iSum, it) => iSum + it.quantity_ordered, 0), 0);

  // Handlers for PO Creation
  const handleOpenCreate = () => {
    const firstSupp = suppliers[0];
    setSupplierId(firstSupp ? firstSupp.id : '');
    setCurrency(firstSupp ? firstSupp.currency : 'AED');
    setExchangeRate(firstSupp ? firstSupp.default_exchange_rate || 33.0 : 33.0);
    setOrderDate(new Date().toISOString().slice(0, 10));
    setExpectedDate('');
    setTargetWarehouseId('wh_shop');
    setFreightTotalBdt(0);
    setCustomsDutyTotalBdt(0);
    setOtherCostsBdt(0);
    setNotes('');
    setPoLines([]);
    setProductSearch('');
    setErrorMsg('');
    setShowCreateModal(true);
  };

  const handleSupplierChange = (suppId: string) => {
    setSupplierId(suppId);
    const supp = suppliers.find(s => s.id === suppId);
    if (supp) {
      setCurrency(supp.currency);
      setExchangeRate(supp.default_exchange_rate || (supp.currency === 'AED' ? 33.0 : supp.currency === 'USD' ? 122.0 : 1.0));
    }
  };

  const handleAddProductLine = (prodId: string) => {
    const prod = products.find(p => p.id === prodId);
    if (!prod) return;

    if (poLines.some(l => l.product_id === prodId)) {
      setPoLines(poLines.map(l => l.product_id === prodId ? { ...l, quantity: l.quantity + 1 } : l));
      return;
    }

    const unitForeign = Math.round((prod.avg_cost / (exchangeRate || 1)) * 100) / 100;
    setPoLines([
      ...poLines,
      {
        product_id: prod.id,
        quantity: 12,
        unit_cost_foreign: unitForeign,
        unit_cost_bdt: Math.round(unitForeign * exchangeRate),
      },
    ]);
  };

  const handleUpdateLineQty = (index: number, qty: number) => {
    const updated = [...poLines];
    updated[index].quantity = Math.max(1, qty);
    setPoLines(updated);
  };

  const handleUpdateLineCostForeign = (index: number, foreignCost: number) => {
    const updated = [...poLines];
    updated[index].unit_cost_foreign = foreignCost;
    updated[index].unit_cost_bdt = Math.round(foreignCost * exchangeRate * 100) / 100;
    setPoLines(updated);
  };

  const handleRemoveLine = (index: number) => {
    setPoLines(poLines.filter((_, i) => i !== index));
  };

  // Landed Cost calculations for Create Modal
  const totalLineQty = poLines.reduce((s, l) => s + (l.quantity || 1), 0);
  const baseSubtotalBdt = poLines.reduce((s, l) => s + (l.unit_cost_bdt * l.quantity), 0);
  const freightPerUnit = totalLineQty > 0 ? (freightTotalBdt || 0) / totalLineQty : 0;
  const dutyPerUnit = totalLineQty > 0 ? (customsDutyTotalBdt || 0) / totalLineQty : 0;
  const grandTotalBdt = baseSubtotalBdt + (freightTotalBdt || 0) + (customsDutyTotalBdt || 0) + (otherCostsBdt || 0);

  const handleCreatePOSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) {
      setErrorMsg('Please select a supplier');
      return;
    }
    if (poLines.length === 0) {
      setErrorMsg('Please add at least one perfume line item');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      await createPurchaseOrder({
        supplier_id: supplierId,
        order_date: orderDate,
        expected_delivery_date: expectedDate || undefined,
        target_warehouse_id: targetWarehouseId,
        currency,
        exchange_rate: Number(exchangeRate),
        freight_total_bdt: Number(freightTotalBdt),
        customs_duty_total_bdt: Number(customsDutyTotalBdt),
        other_costs_bdt: Number(otherCostsBdt),
        notes,
        items: poLines.map(l => ({
          product_id: l.product_id,
          quantity_ordered: l.quantity,
          unit_cost_foreign: l.unit_cost_foreign,
          unit_cost_bdt: l.unit_cost_bdt,
          landed_freight_per_unit: Math.round(freightPerUnit * 100) / 100,
          landed_duty_per_unit: Math.round(dutyPerUnit * 100) / 100,
        })),
      });
      setShowCreateModal(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create Purchase Order');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handlers for Receiving Goods
  const handleOpenReceive = (po: PurchaseOrder) => {
    setReceivingPO(po);
    const initialQty: { [itemId: string]: number } = {};
    po.items.forEach(it => {
      const remaining = it.quantity_ordered - it.quantity_received;
      initialQty[it.id] = remaining > 0 ? remaining : 0;
    });
    setReceivingQuantities(initialQty);
    setReceiveNotes(`Consignment received for ${po.po_number}`);
    setErrorMsg('');
    setShowReceiveModal(true);
  };

  const handleReceiveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receivingPO) return;

    const itemsToReceive = Object.entries(receivingQuantities)
      .map(([itemId, qty]) => ({ item_id: itemId, quantity_receiving: Number(qty) }))
      .filter(i => i.quantity_receiving > 0);

    if (itemsToReceive.length === 0) {
      setErrorMsg('Please specify at least 1 unit to receive');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      await receivePurchaseOrderItems(receivingPO.id, {
        received_items: itemsToReceive,
        notes: receiveNotes,
      });
      setShowReceiveModal(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to receive PO items');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenDetail = (po: PurchaseOrder) => {
    setSelectedPO(po);
    setShowDetailModal(true);
  };

  return (
    <div className="space-y-6" id="purchase-orders-view-container">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--text)] flex items-center gap-2">
            <Package className="w-5 h-5 text-[var(--accent)]" />
            Purchase Orders & Landed Cost Tracking
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Section 14: Multi-currency purchase orders with landed air freight, customs duty, and atomic inventory receiving.
          </p>
        </div>

        {can('manage_purchases') && (
          <button
            id="btn-new-po"
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white text-xs font-bold rounded-lg hover:opacity-95 shadow-sm transition-all self-start sm:self-auto cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Create Purchase Order
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Total PO Volume</p>
            <p className="text-2xl font-black text-[var(--text)] mt-1">&#2547;{totalPOValue.toLocaleString()}</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{purchaseOrders.length} Total POs Issued</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[color-mix(in_srgb,var(--status-teal)_10%,transparent)] text-[var(--status-teal)] flex items-center justify-center font-bold">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Open / In-Transit</p>
            <p className="text-2xl font-black text-[var(--status-amber)] mt-1">{openPOCount}</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Air freight / customs clearance</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[color-mix(in_srgb,var(--status-amber)_10%,transparent)] text-[var(--status-amber)] flex items-center justify-center font-bold">
            <Truck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Completed / Received</p>
            <p className="text-2xl font-black text-[var(--status-green)] mt-1">{receivedPOCount}</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Fully inwarded to stock</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[color-mix(in_srgb,var(--status-green)_10%,transparent)] text-[var(--status-green)] flex items-center justify-center font-bold">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Bottles Ordered</p>
            <p className="text-2xl font-black text-[var(--text)] mt-1">{totalBottlesOrdered.toLocaleString()}</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Units across all batches</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[color-mix(in_srgb,var(--accent-secondary)_10%,transparent)] text-[var(--accent-secondary)] flex items-center justify-center font-bold">
            <Package className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter & Search */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search PO #, supplier, or perfume name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
          >
            <option value="all">All Statuses</option>
            <option value="ordered">Ordered / In-Transit</option>
            <option value="partially_received">Partially Received</option>
            <option value="received">Fully Received</option>
            <option value="draft">Draft</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
          >
            <option value="all">All Suppliers</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.country})</option>
            ))}
          </select>
        </div>
      </div>

      {/* PO Table */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="dense-table">
            <thead className="bg-[var(--surface-sunken)] border-b border-[var(--border)] text-[var(--text-muted)] uppercase tracking-wider font-bold">
              <tr>
                <th className="py-3 px-4">PO Number & Date</th>
                <th className="py-3 px-4">Supplier</th>
                <th className="py-3 px-4">Target Warehouse</th>
                <th className="py-3 px-4">Fulfillment Progress</th>
                <th className="py-3 px-4 text-right">Landed Total (BDT)</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filteredPOs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-[var(--text-muted)]">
                    No purchase orders match your criteria.
                  </td>
                </tr>
              ) : (
                filteredPOs.map((po) => {
                  const totalOrdered = po.items.reduce((s, i) => s + i.quantity_ordered, 0);
                  const totalRec = po.items.reduce((s, i) => s + i.quantity_received, 0);
                  const pct = totalOrdered > 0 ? Math.round((totalRec / totalOrdered) * 100) : 0;

                  return (
                    <tr key={po.id} className="hover:bg-[var(--surface-hover)] transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-[var(--text)]">{po.po_number}</div>
                        <div className="text-[11px] text-[var(--text-muted)] mt-0.5 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-[var(--accent)]" />
                          <span>{po.order_date}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-[var(--text)]">{po.supplier_name}</div>
                        <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                          Currency: <span className="font-bold text-[var(--status-amber)]">{po.currency}</span> (1 {po.currency} = &#2547;{po.exchange_rate})
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-medium text-[var(--text)]">{po.target_warehouse_name}</div>
                        <div className="text-[11px] text-[var(--text-muted)]">{po.items.length} line items</div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center justify-between text-[11px] font-bold text-[var(--text)] mb-1">
                          <span>{totalRec} / {totalOrdered} bottles</span>
                          <span>{pct}%</span>
                        </div>
                        <div className="w-full bg-[var(--border)] h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              pct === 100 ? 'bg-[color-mix(in_srgb,var(--status-green)_10%,transparent)]' : pct > 0 ? 'bg-[color-mix(in_srgb,var(--status-amber)_10%,transparent)]' : 'bg-neutral-400'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="font-black text-sm text-[var(--text)]">&#2547;{po.total_amount_bdt.toLocaleString()}</div>
                        <div className="text-[10px] text-[var(--text-muted)]">
                          Freight: &#2547;{(po.freight_total_bdt || 0).toLocaleString()} &#8226; Customs: &#2547;{(po.customs_duty_total_bdt || 0).toLocaleString()}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <StatusBadge status={po.status} />
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-2">
                          {po.status !== 'received' && po.status !== 'cancelled' && can('receive_inventory') && (
                            <button
                              onClick={() => handleOpenReceive(po)}
                              className="px-2.5 py-1 bg-[var(--accent)] hover:opacity-90 text-white rounded text-[11px] font-bold shadow-sm transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <Truck className="w-3 h-3" />
                              Receive
                            </button>
                          )}

                          <button
                            onClick={() => handleOpenDetail(po)}
                            title="View PO Details & Invoice"
                            className="p-1.5 bg-[var(--surface-sunken)] border border-[var(--border)] text-[var(--text)] hover:bg-[var(--accent)] hover:text-white rounded transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
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

      {/* --- MODAL: Create Purchase Order (Multi-line + Landed Cost Allocation) --- */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-sunken)]">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-[var(--accent)]" />
                <h3 className="text-sm font-bold text-[var(--text)]">Create New Purchase Order</h3>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text)] p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePOSubmit} className="p-6 space-y-5 max-h-[85vh] overflow-y-auto">
              {errorMsg && (
                <div className="p-3 bg-[color-mix(in_srgb,var(--status-red)_10%,transparent)] border border-[color-mix(in_srgb,var(--status-red)_30%,transparent)] rounded-xl text-[var(--status-red)] text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Top Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[var(--text)] mb-1">Supplier *</label>
                  <select
                    value={supplierId}
                    onChange={(e) => handleSupplierChange(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-[var(--accent)] font-semibold"
                  >
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.country})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text)] mb-1">Order Date</label>
                  <input
                    type="date"
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text)] mb-1">Target Inward Warehouse</label>
                  <select
                    value={targetWarehouseId}
                    onChange={(e) => setTargetWarehouseId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                  >
                    <option value="wh_shop">Shop Floor (Showroom)</option>
                    <option value="wh_main">Main / Back-store (2nd Floor)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text)] mb-1">Invoicing Currency</label>
                  <input
                    type="text"
                    readOnly
                    value={currency}
                    className="w-full px-3 py-2 text-xs bg-[var(--surface-sunken)]/50 border border-[var(--border)] rounded-lg text-[var(--status-amber)] font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text)] mb-1">Exchange Rate (to BDT)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={exchangeRate}
                    onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 1)}
                    className="w-full px-3 py-2 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-[var(--accent)] font-bold text-[var(--status-amber)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text)] mb-1">Expected Delivery Date</label>
                  <input
                    type="date"
                    value={expectedDate}
                    onChange={(e) => setExpectedDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
              </div>

              {/* Perfume Line Item Picker */}
              <div className="space-y-3 pt-3 border-t border-[var(--border)]">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-[var(--text)] uppercase tracking-wider">Perfume Catalog Line Items</h4>
                  <div className="w-72 relative">
                    <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search to add perfumes..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                </div>

                {productSearch && (
                  <div className="max-h-40 overflow-y-auto border border-[var(--border)] rounded-xl bg-[var(--surface-sunken)] divide-y divide-[var(--border)]">
                    {products
                      .filter(p => p.display_name.toLowerCase().includes(productSearch.toLowerCase()) || p.sku.toLowerCase().includes(productSearch.toLowerCase()))
                      .slice(0, 8)
                      .map(p => (
                        <div
                          key={p.id}
                          onClick={() => {
                            handleAddProductLine(p.id);
                            setProductSearch('');
                          }}
                          className="p-2 text-xs flex items-center justify-between hover:bg-[var(--accent)]/10 cursor-pointer transition-colors"
                        >
                          <div>
                            <span className="font-bold text-[var(--text)]">{p.display_name}</span>
                            <span className="text-[11px] text-[var(--text-muted)] ml-2 font-mono">({p.sku})</span>
                          </div>
                          <button type="button" className="px-2 py-0.5 bg-[var(--accent)] text-white text-[10px] font-bold rounded">
                            + Add Line
                          </button>
                        </div>
                      ))}
                  </div>
                )}

                {/* Items Table */}
                <div className="border border-[var(--border)] rounded-xl overflow-hidden">
                  <table className="dense-table">
                    <thead className="bg-[var(--surface-sunken)] border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase">
                      <tr>
                        <th className="py-2.5 px-3">Perfume / SKU</th>
                        <th className="py-2.5 px-3 text-center">Qty (Bottles)</th>
                        <th className="py-2.5 px-3 text-right">Unit ({currency})</th>
                        <th className="py-2.5 px-3 text-right">Base Cost (&#2547;)</th>
                        <th className="py-2.5 px-3 text-right">Landed Unit (&#2547;)</th>
                        <th className="py-2.5 px-3 text-right">Total Line (&#2547;)</th>
                        <th className="py-2.5 px-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {poLines.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-6 text-center text-xs text-[var(--text-muted)]">
                            No items added. Use the search box above to add perfumes to this purchase order.
                          </td>
                        </tr>
                      ) : (
                        poLines.map((line, idx) => {
                          const prod = products.find(p => p.id === line.product_id);
                          const totalLandedUnit = Math.round(line.unit_cost_bdt + freightPerUnit + dutyPerUnit);
                          const lineTotal = totalLandedUnit * line.quantity;

                          return (
                            <tr key={line.product_id} className="hover:bg-[var(--surface-hover)]">
                              <td className="py-2.5 px-3">
                                <div className="font-bold text-[var(--text)]">{prod?.display_name || line.product_id}</div>
                                <div className="text-[11px] text-[var(--text-muted)] font-mono">{prod?.sku}</div>
                              </td>

                              <td className="py-2.5 px-3 text-center">
                                <input
                                  type="number"
                                  min="1"
                                  value={line.quantity}
                                  onChange={(e) => handleUpdateLineQty(idx, parseInt(e.target.value) || 1)}
                                  className="w-16 px-2 py-1 text-xs text-center bg-[var(--surface-sunken)] border border-[var(--border)] rounded font-bold text-[var(--text)]"
                                />
                              </td>

                              <td className="py-2.5 px-3 text-right">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={line.unit_cost_foreign}
                                  onChange={(e) => handleUpdateLineCostForeign(idx, parseFloat(e.target.value) || 0)}
                                  className="w-20 px-2 py-1 text-xs text-right bg-[var(--surface-sunken)] border border-[var(--border)] rounded font-bold text-[var(--status-amber)]"
                                />
                              </td>

                              <td className="py-2.5 px-3 text-right font-medium text-[var(--text)]">
                                &#2547;{Math.round(line.unit_cost_bdt).toLocaleString()}
                              </td>

                              <td className="py-2.5 px-3 text-right font-bold text-[var(--status-green)]">
                                &#2547;{totalLandedUnit.toLocaleString()}
                              </td>

                              <td className="py-2.5 px-3 text-right font-black text-[var(--text)]">
                                &#2547;{lineTotal.toLocaleString()}
                              </td>

                              <td className="py-2.5 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveLine(idx)}
                                  className="p-1 text-[var(--status-red)] hover:text-[var(--status-red)] transition-colors"
                                >
                                  <X className="w-4 h-4" />
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

              {/* Landed Cost Breakdown & Clearance Fees */}
              <div className="p-4 bg-[var(--surface-sunken)] border border-[var(--border)] rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-[var(--text)] uppercase tracking-wider flex items-center gap-1.5">
                  <Percent className="w-4 h-4 text-[var(--accent)]" />
                  Landed Cost Allocation (Air Freight & Customs Duty)
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[var(--text)] mb-1">Total Air Freight (BDT)</label>
                    <input
                      type="number"
                      step="1"
                      value={freightTotalBdt}
                      onChange={(e) => setFreightTotalBdt(parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className="w-full px-3 py-2 text-xs bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--text)] font-semibold"
                    />
                    <p className="text-[10px] text-[var(--text-muted)] mt-1">
                      Allocated: <strong>&#2547;{Math.round(freightPerUnit)}</strong> / bottle
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[var(--text)] mb-1">Total Customs Duty (BDT)</label>
                    <input
                      type="number"
                      step="1"
                      value={customsDutyTotalBdt}
                      onChange={(e) => setCustomsDutyTotalBdt(parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className="w-full px-3 py-2 text-xs bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--text)] font-semibold"
                    />
                    <p className="text-[10px] text-[var(--text-muted)] mt-1">
                      Allocated: <strong>&#2547;{Math.round(dutyPerUnit)}</strong> / bottle
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[var(--text)] mb-1">Other Port / Handling (BDT)</label>
                    <input
                      type="number"
                      step="1"
                      value={otherCostsBdt}
                      onChange={(e) => setOtherCostsBdt(parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className="w-full px-3 py-2 text-xs bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--text)] font-semibold"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-[var(--border)] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                  <div className="text-[var(--text-muted)]">
                    Base Subtotal: <strong>&#2547;{Math.round(baseSubtotalBdt).toLocaleString()}</strong> &#8226; Freight & Duty: <strong>&#2547;{(freightTotalBdt + customsDutyTotalBdt + otherCostsBdt).toLocaleString()}</strong>
                  </div>
                  <div className="text-base font-black text-[var(--text)]">
                    Total Landed Cost: <span className="text-[var(--status-green)]">&#2547;{Math.round(grandTotalBdt).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text)] mb-1">Order Notes & Cargo Reference</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Flight EK582 Cargo consignment, Master Airway Bill (MAWB) #..."
                  className="w-full px-3 py-2 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-[var(--surface-sunken)] border border-[var(--border)] text-[var(--text)] text-xs font-bold rounded-lg hover:bg-[var(--border)] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || poLines.length === 0}
                  className="px-5 py-2 bg-[var(--accent)] text-white text-xs font-bold rounded-lg hover:opacity-95 shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating PO...' : 'Issue Purchase Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: Receive Goods (Shipment Inward) --- */}
      {showReceiveModal && receivingPO && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-sunken)]">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-[var(--accent)]" />
                <div>
                  <h3 className="text-sm font-bold text-[var(--text)]">
                    Receive Inward Shipment: {receivingPO.po_number}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    Supplier: {receivingPO.supplier_name} &#8226; Warehouse: {receivingPO.target_warehouse_name}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowReceiveModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text)] p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReceiveSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {errorMsg && (
                <div className="p-3 bg-[color-mix(in_srgb,var(--status-red)_10%,transparent)] border border-[color-mix(in_srgb,var(--status-red)_30%,transparent)] rounded-xl text-[var(--status-red)] text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <p className="text-xs text-[var(--text)] font-medium">
                Enter the physical quantity of bottles verified and received into inventory:
              </p>

              <div className="border border-[var(--border)] rounded-xl overflow-hidden">
                <table className="dense-table">
                  <thead className="bg-[var(--surface-sunken)] border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Perfume Name</th>
                      <th className="py-2.5 px-3 text-center">Ordered</th>
                      <th className="py-2.5 px-3 text-center">Prev Rec'd</th>
                      <th className="py-2.5 px-3 text-center">Receiving Now</th>
                      <th className="py-2.5 px-3 text-right">Landed Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {receivingPO.items.map((item) => {
                      const remaining = item.quantity_ordered - item.quantity_received;

                      return (
                        <tr key={item.id} className="hover:bg-[var(--surface-hover)]">
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-[var(--text)]">{item.product_name}</div>
                            <div className="text-[11px] text-[var(--text-muted)] font-mono">{item.sku}</div>
                          </td>

                          <td className="py-2.5 px-3 text-center font-semibold">{item.quantity_ordered}</td>
                          <td className="py-2.5 px-3 text-center text-[var(--status-green)] font-bold">{item.quantity_received}</td>

                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="number"
                              min="0"
                              max={remaining}
                              value={receivingQuantities[item.id] !== undefined ? receivingQuantities[item.id] : 0}
                              onChange={(e) => setReceivingQuantities({
                                ...receivingQuantities,
                                [item.id]: Math.min(remaining, Math.max(0, parseInt(e.target.value) || 0)),
                              })}
                              className="w-16 px-2 py-1 text-xs text-center bg-[var(--surface-sunken)] border border-[var(--border)] rounded font-bold text-[var(--accent)] text-sm"
                            />
                          </td>

                          <td className="py-2.5 px-3 text-right font-bold text-[var(--text)]">
                            &#2547;{item.total_landed_unit_cost_bdt.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text)] mb-1">Receiving Inspection & Batch Notes</label>
                <input
                  type="text"
                  value={receiveNotes}
                  onChange={(e) => setReceiveNotes(e.target.value)}
                  placeholder="e.g. All batch hologram seals intact, cartons verified"
                  className="w-full px-3 py-2 text-xs bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div className="p-3 bg-[color-mix(in_srgb,var(--status-green)_10%,transparent)] border border-[color-mix(in_srgb,var(--status-green)_20%,transparent)] rounded-xl text-[11px] text-[var(--status-green)]">
                Receiving will immediately add stock to <strong>{receivingPO.target_warehouse_name}</strong>, update weighted-average landed cost, record immutable stock movements (<code>PO_RECEIVING</code>), and post <strong>Dr Inventory, Cr Supplier Payables</strong>.
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setShowReceiveModal(false)}
                  className="px-4 py-2 bg-[var(--surface-sunken)] border border-[var(--border)] text-[var(--text)] text-xs font-bold rounded-lg hover:bg-[var(--border)] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-[var(--status-green)] text-white text-xs font-bold rounded-lg hover:opacity-90 shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Receiving...' : 'Confirm Goods Inward'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: PO Details / Printable View --- */}
      {showDetailModal && selectedPO && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-sunken)]">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[var(--accent)]" />
                <div>
                  <h3 className="text-sm font-bold text-[var(--text)]">Purchase Order Details: {selectedPO.po_number}</h3>
                  <p className="text-xs text-[var(--text-muted)]">Issued: {selectedPO.order_date}</p>
                </div>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text)] p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-[var(--surface-sunken)] rounded-xl border border-[var(--border)] text-xs">
                <div>
                  <p className="text-[11px] text-[var(--text-muted)] font-medium">Supplier</p>
                  <p className="font-bold text-[var(--text)] mt-0.5">{selectedPO.supplier_name}</p>
                </div>
                <div>
                  <p className="text-[11px] text-[var(--text-muted)] font-medium">Target Warehouse</p>
                  <p className="font-bold text-[var(--text)] mt-0.5">{selectedPO.target_warehouse_name}</p>
                </div>
                <div>
                  <p className="text-[11px] text-[var(--text-muted)] font-medium">Status</p>
                  <div className="mt-0.5"><StatusBadge status={selectedPO.status} /></div>
                </div>
                <div>
                  <p className="text-[11px] text-[var(--text-muted)] font-medium">Exchange Rate</p>
                  <p className="font-bold text-[var(--status-amber)] mt-0.5">1 {selectedPO.currency} = &#2547;{selectedPO.exchange_rate}</p>
                </div>
              </div>

              <div className="border border-[var(--border)] rounded-xl overflow-hidden">
                <table className="dense-table">
                  <thead className="bg-[var(--surface-sunken)] border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Product</th>
                      <th className="py-2.5 px-3 text-center">Ordered</th>
                      <th className="py-2.5 px-3 text-center">Received</th>
                      <th className="py-2.5 px-3 text-right">Unit ({selectedPO.currency})</th>
                      <th className="py-2.5 px-3 text-right">Landed Unit (&#2547;)</th>
                      <th className="py-2.5 px-3 text-right">Total (&#2547;)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {selectedPO.items.map(it => (
                      <tr key={it.id} className="hover:bg-[var(--surface-hover)]">
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-[var(--text)]">{it.product_name}</div>
                          <div className="text-[11px] text-[var(--text-muted)] font-mono">{it.sku}</div>
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold">{it.quantity_ordered}</td>
                        <td className="py-2.5 px-3 text-center font-bold text-[var(--status-green)]">{it.quantity_received}</td>
                        <td className="py-2.5 px-3 text-right font-medium text-[var(--status-amber)]">{it.unit_cost_foreign} {selectedPO.currency}</td>
                        <td className="py-2.5 px-3 text-right font-semibold text-[var(--status-green)]">&#2547;{it.total_landed_unit_cost_bdt.toLocaleString()}</td>
                        <td className="py-2.5 px-3 text-right font-black text-[var(--text)]">&#2547;{it.total_amount_bdt.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-4 bg-[var(--surface-sunken)] rounded-xl border border-[var(--border)] flex items-center justify-between text-xs">
                <div>
                  <p className="text-[var(--text-muted)]">
                    Air Freight: <strong>&#2547;{(selectedPO.freight_total_bdt || 0).toLocaleString()}</strong> &#8226; Customs Duty: <strong>&#2547;{(selectedPO.customs_duty_total_bdt || 0).toLocaleString()}</strong>
                  </p>
                  {selectedPO.notes && <p className="text-[11px] text-[var(--text-muted)] mt-1 italic">Notes: {selectedPO.notes}</p>}
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-[var(--text-muted)] uppercase font-bold">Grand Total Landed Cost</p>
                  <p className="text-xl font-black text-[var(--status-green)] mt-0.5">&#2547;{selectedPO.total_amount_bdt.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-[var(--border)] bg-[var(--surface-sunken)] flex items-center justify-end">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] text-xs font-bold rounded-lg hover:bg-[var(--border)] transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
